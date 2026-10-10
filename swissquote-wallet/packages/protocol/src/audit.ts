import { isAddress, keccak256, type Address, type PublicClient } from 'viem';
import { safeAbi, moduleAbi } from './abis.js';
import { ADDRESSES, CONTRACT_CODE_HASHES, PROXY_RUNTIME_CODE_HASH, GUARD_STORAGE_SLOT, FALLBACK_STORAGE_SLOT, MODULES, MODULE_WAITS, SENTINEL_ADDRESS, ZERO_ADDRESS } from './constants.js';
export interface AuditAnswer { question: string; answer: 'yes' | 'no' | 'unknown'; explanation: string }
export interface WalletAudit { facts: Record<string, string | boolean>; answers: AuditAnswer[]; warnings: string[] }
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const unique = (items: readonly string[]) => new Set(items.map(x => x.toLowerCase())).size === items.length;
const valid = (items: readonly Address[]) => unique(items) && items.every(x => isAddress(x, { strict: false }) && !same(x, ZERO_ADDRESS) && !same(x, SENTINEL_ADDRESS));
const baseWarnings = [
  'Swissquote publishes the wallet app. A malicious app version could copy the owner key; this read-only check does not audit the app or prove publisher identity.',
  'Screening controls fee sponsorship only. An owner-key holder can pay the network fee and send elsewhere, or sign off-chain permits.',
  'This is a snapshot of current rules, not a wallet-history verification or an independent security audit. Public RPC operators see the wallet address.',
];
const institutional = (): AuditAnswer[] => [
  { question: 'Can Swissquote alone move my money?', answer: 'unknown', explanation: 'On-chain addresses do not identify Swissquote. Compare the owners shown here with independently confirmed identities. Configured recovery guardians that are not owners cannot spend directly in the recognised setup.' },
  { question: 'Can Swissquote and the partner replace my key without my card?', answer: 'unknown', explanation: 'The shared guardian address must be independently confirmed as your card, and the other guardians as the helpers. Addresses alone cannot establish those identities.' },
];
/** Current-state audit only: all state/code reads and node comparison use one shared block. No signing or writes. */
export async function auditWallet(clients: readonly PublicClient[], wallet: Address): Promise<WalletAudit> {
  const facts: WalletAudit['facts'] = { wallet, verified: false };
  const warnings = [...baseWarnings];
  try {
    if (!isAddress(wallet, { strict: false }) || same(wallet, ZERO_ADDRESS) || same(wallet, SENTINEL_ADDRESS)) throw new Error('Invalid wallet address');
    if (clients.length < 2 || new Set(clients).size !== clients.length) throw new Error('Two distinct RPC clients are required');
    const urls = clients.map(c => (c.transport as { url?: string } | undefined)?.url).filter((url): url is string => !!url);
    if (new Set(urls).size !== urls.length) throw new Error('Duplicate RPC transport URL');
    const heads = await Promise.all(clients.map(c => c.getBlockNumber()));
    const blockNumber = heads.reduce((a, b) => a < b ? a : b);
    const snapshots = await Promise.all(clients.map(async client => {
      const chainId = await client.getChainId();
      if (![11155111, 31337].includes(chainId)) throw new Error('Unsupported audit chain');
      const block = await client.getBlock({ blockNumber });
      if (!block.hash || block.number !== blockNumber) throw new Error('Pinned block unavailable');
      const at = { blockNumber };
      const code = await client.getCode({ ...at, address: wallet });
      if (!code || keccak256(code) !== PROXY_RUNTIME_CODE_HASH) throw new Error('Wallet proxy code missing or unexpected');
      for (const [address, hash] of Object.entries(CONTRACT_CODE_HASHES)) {
        const dependency = await client.getCode({ ...at, address: address as Address });
        if (!dependency || keccak256(dependency) !== hash) throw new Error(`Contract code mismatch: ${address}`);
      }
      const singleton = await client.getStorageAt({ ...at, address: wallet, slot: '0x0' });
      const guard = await client.getStorageAt({ ...at, address: wallet, slot: GUARD_STORAGE_SLOT });
      const fallback = await client.getStorageAt({ ...at, address: wallet, slot: FALLBACK_STORAGE_SLOT });
      if (!singleton || !guard || !fallback) throw new Error('Wallet storage unreadable');
      const owners = await client.readContract({ ...at, address: wallet, abi: safeAbi, functionName: 'getOwners' });
      const threshold = await client.readContract({ ...at, address: wallet, abi: safeAbi, functionName: 'getThreshold' });
      const [modules, next] = await client.readContract({ ...at, address: wallet, abi: safeAbi, functionName: 'getModulesPaginated', args: [SENTINEL_ADDRESS, 3n] });
      const recovery = await Promise.all(MODULES.map(async address => ({
        address,
        guardians: await client.readContract({ ...at, address, abi: moduleAbi, functionName: 'getGuardians', args: [wallet] }),
        threshold: await client.readContract({ ...at, address, abi: moduleAbi, functionName: 'threshold', args: [wallet] }),
        count: await client.readContract({ ...at, address, abi: moduleAbi, functionName: 'guardiansCount', args: [wallet] }),
        pending: await client.readContract({ ...at, address, abi: moduleAbi, functionName: 'getRecoveryRequest', args: [wallet] }),
      })));
      return { chainId, hash: block.hash, timestamp: block.timestamp, singleton, guard, fallback, owners, threshold, modules, next, recovery };
    }));
    const snapshot = snapshots[0]!;
    const canonical = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : typeof v === 'string' ? v.toLowerCase() : v);
    if (snapshots.some(s => canonical(s) !== canonical(snapshot))) throw new Error('RPC state or pinned-block disagreement');
    Object.assign(facts, { chainId: String(snapshot.chainId), blockNumber: String(blockNumber), blockHash: snapshot.hash, blockTimestamp: String(snapshot.timestamp), owners: snapshot.owners.join(', '), ownerThreshold: String(snapshot.threshold), modules: snapshot.modules.join(', '), singleton: snapshot.singleton, guard: snapshot.guard, fallbackHandler: snapshot.fallback });
    if (BigInt(snapshot.singleton) !== BigInt(ADDRESSES.safeL2)) warnings.push('Unexpected Safe singleton.');
    if (BigInt(snapshot.guard) !== 0n) warnings.push('Hidden guard installed.');
    if (BigInt(snapshot.fallback) !== BigInt(ADDRESSES.fallbackHandler)) warnings.push('Unexpected fallback handler.');
    if (snapshot.owners.length !== 1 || snapshot.threshold !== 1n || !valid(snapshot.owners)) warnings.push('Extra, missing or invalid owner / unexpected owner threshold.');
    if (snapshot.modules.length !== 2 || !unique(snapshot.modules) || !MODULES.every(m => snapshot.modules.some(x => same(m, x))) || !same(snapshot.next, SENTINEL_ADDRESS)) warnings.push('Unknown, extra or missing module — cannot tell who else can move funds.');
    for (const [i, r] of snapshot.recovery.entries()) {
      facts[`module${i === 0 ? 'A' : 'B'}Guardians`] = r.guardians.join(', ');
      facts[`module${i === 0 ? 'A' : 'B'}Threshold`] = String(r.threshold);
      facts[`module${i === 0 ? 'A' : 'B'}ExecuteAfter`] = String(r.pending.executeAfter);
      facts[`module${i === 0 ? 'A' : 'B'}NewOwners`] = r.pending.newOwners.join(', ');
      if (r.guardians.length !== 2 || !valid(r.guardians) || r.threshold !== 2n || r.count !== 2n) warnings.push(`Unexpected guardians or threshold: ${r.address}`);
      if (r.guardians.some(g => snapshot.owners.some(o => same(g, o)))) warnings.push(`Recovery guardian is also an owner: ${r.address}`);
      if (r.pending.executeAfter !== 0n) warnings.push(`Recovery pending: ${r.address}; new owners ${r.pending.newOwners.join(', ')}; executes after chain timestamp ${r.pending.executeAfter}. Learn about it and cancel in time if it is not yours.`);
    }
    const [a, b] = snapshot.recovery;
    const shared = a!.guardians.filter(g => b!.guardians.some(x => same(g, x)));
    facts.sharedGuardian = shared.join(', ');
    if (shared.length !== 1) warnings.push('Recovery paths do not have exactly one shared guardian; card-required topology is unconfirmed.');
    // Pending requests affect safety but do not change the configured topology.
    const recognised = warnings.slice(baseWarnings.length).every(w => w.startsWith('Recovery pending:'));
    facts.verified = recognised;
    const answers = institutional();
    if (recognised) answers.push(
      { question: 'Can the two non-shared recovery guardians replace the owner without the shared guardian?', answer: 'no', explanation: 'Each recognised module requires both of its two guardians. The shared guardian is required on both paths. Confirm independently that it is your Recovery Card.' },
      { question: 'Can the shared guardian plus one helper replace the owner?', answer: 'yes', explanation: `With the configured pair: after ${MODULE_WAITS.A} seconds on module A (demo) or ${MODULE_WAITS.B} seconds on module B, unless the owner cancels in time. They then control the wallet. Production waiting times are not proved here.` },
    );
    answers.push({ question: 'Can a thief with the owner key or its 24 words spend?', answer: recognised ? 'yes' : 'unknown', explanation: recognised ? 'Yes, any amount. The owner can also cancel your recovery. An unlocked device that exposes the key remains the main risk.' : 'Unexpected rules prevent a complete assessment. Do not assume an extra module or guard protects a leaked owner key.' });
    return { facts, answers, warnings };
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'Trust-check RPC failure');
    return { facts, answers: institutional(), warnings };
  }
}
