import { decodeAbiParameters, isAddress, keccak256, parseAbiItem, type Address, type PublicClient } from 'viem';
import { ADDRESSES, CHAIN_ID, CONTRACT_CODE_HASHES, FALLBACK_STORAGE_SLOT, GUARD_STORAGE_SLOT, LOG_CHUNK_BLOCKS, MODULES, PROXY_CREATION_CODE_HASH, PROXY_RUNTIME_CODE_HASH, SENTINEL_ADDRESS, SEPOLIA_HISTORY_START, ZERO_ADDRESS } from './constants.js';
import { factoryAbi, moduleAbi, safeAbi } from './abis.js';
import { computeWalletAddress, decodeMultiSendCall } from './wallet.js';
import type { WalletSetup, WalletVerification } from './types.js';
export interface VerificationOptions {
  /** First block of the history scan; must cover wallet creation. Default: historyStartBlock(chainId, head). */
  fromBlock?: bigint;
  expectedWallet?: Address;
  /** Authenticated current owner; never infer from the RPC's getOwners response. Setup owner remains the CREATE2 creation owner. */
  expectedCurrentOwner?: Address;
}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sameSet = (a: readonly Address[], b: readonly Address[]) => a.length === b.length && new Set(a.map(x => x.toLowerCase())).size === a.length && a.every(x => b.some(y => same(x, y)));
const multiSigEvent = parseAbiItem('event SafeMultiSigTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures,bytes additionalInfo)');
const moduleEvent = parseAbiItem('event SafeModuleTransaction(address module,address to,uint256 value,bytes data,uint8 operation)');
/**
 * Default first block of the wallet-history scan. On Sepolia no wallet of ours predates SEPOLIA_HISTORY_START.
 * Other chains, and a chain with Sepolia's id whose head is still below that block (a fresh test chain), are read from genesis.
 */
export function historyStartBlock(chainId: number, head: bigint): bigint {
  return chainId === CHAIN_ID && head >= SEPOLIA_HISTORY_START ? SEPOLIA_HISTORY_START : 0n;
}
/** Reads [fromBlock, toBlock] in consecutive ranges of at most LOG_CHUNK_BLOCKS blocks; any failed range rejects. */
async function readLogsInChunks<T>(fromBlock: bigint, toBlock: bigint, read: (fromBlock: bigint, toBlock: bigint) => Promise<readonly T[]>): Promise<T[]> {
  const logs: T[] = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_BLOCKS) {
    const end = start + LOG_CHUNK_BLOCKS - 1n < toBlock ? start + LOG_CHUNK_BLOCKS - 1n : toBlock;
    for (const log of await read(start, end)) logs.push(log);
  }
  return logs;
}
export async function verifyWallet(client: PublicClient, setup: WalletSetup, options: VerificationOptions = {}): Promise<WalletVerification> {
  let wallet = options.expectedWallet ?? ADDRESSES.factory;
  const reasons: string[] = [];
  let nonce: bigint | undefined;
  try {
    const chainId = await client.getChainId();
    if (chainId !== (setup.chainId ?? CHAIN_ID)) throw new Error('Wallet verification chain mismatch');
    // Pin all dependencies, including factory, before trusting proxyCreationCode or RPC-returned ABI values.
    for (const [address, expectedHash] of Object.entries(CONTRACT_CODE_HASHES)) {
      const code = await client.getCode({ address: address as Address });
      if (!code || keccak256(code) !== expectedHash) reasons.push(`Contract code mismatch: ${address}`);
    }
    if (reasons.length) return { ok: false, wallet, reasons };
    const proxyCode = await client.readContract({ address: ADDRESSES.factory, abi: factoryAbi, functionName: 'proxyCreationCode' });
    if (keccak256(proxyCode) !== PROXY_CREATION_CODE_HASH) throw new Error('Factory proxy creation code mismatch');
    wallet = computeWalletAddress(setup, proxyCode);
    if (options.expectedWallet && !same(wallet, options.expectedWallet)) reasons.push('Setup code wallet does not match deterministic template');
    const code = await client.getCode({ address: wallet });
    if (!code || keccak256(code) !== PROXY_RUNTIME_CODE_HASH) throw new Error('Wallet proxy code missing or unexpected');
    const singleton = await client.getStorageAt({ address: wallet, slot: '0x0' });
    if (!singleton || BigInt(singleton) !== BigInt(ADDRESSES.safeL2)) reasons.push('Unexpected Safe singleton');
    const guard = await client.getStorageAt({ address: wallet, slot: GUARD_STORAGE_SLOT });
    if (!guard || BigInt(guard) !== 0n) reasons.push('Hidden guard installed or unreadable');
    const fallback = await client.getStorageAt({ address: wallet, slot: FALLBACK_STORAGE_SLOT });
    if (!fallback || BigInt(fallback) !== BigInt(ADDRESSES.fallbackHandler)) reasons.push('Unexpected fallback handler');
    nonce = await client.readContract({ address: wallet, abi: safeAbi, functionName: 'nonce' });
    const owners = await client.readContract({ address: wallet, abi: safeAbi, functionName: 'getOwners' });
    const threshold = await client.readContract({ address: wallet, abi: safeAbi, functionName: 'getThreshold' });
    const expectedCurrentOwner = options.expectedCurrentOwner ?? setup.owner;
    if (typeof expectedCurrentOwner !== 'string' || !isAddress(expectedCurrentOwner, { strict: false }) || [ZERO_ADDRESS, SENTINEL_ADDRESS, wallet.toLowerCase()].includes(expectedCurrentOwner.toLowerCase())) throw new Error('Invalid expected current owner');
    if (!sameSet(owners, [expectedCurrentOwner]) || threshold !== 1n) reasons.push('Unexpected owners or owner threshold');
    const [modules, next] = await client.readContract({ address: wallet, abi: safeAbi, functionName: 'getModulesPaginated', args: [SENTINEL_ADDRESS, 3n] });
    if (!sameSet(modules, MODULES) || !same(next, SENTINEL_ADDRESS)) reasons.push('Hidden, missing, or duplicate recovery modules');
    for (const [module, helper] of [[ADDRESSES.moduleA, setup.partnerGuardian], [ADDRESSES.moduleB, setup.sqGuardian]] as const) {
      const guardians = await client.readContract({ address: module, abi: moduleAbi, functionName: 'getGuardians', args: [wallet] });
      const guardianThreshold = await client.readContract({ address: module, abi: moduleAbi, functionName: 'threshold', args: [wallet] });
      const count = await client.readContract({ address: module, abi: moduleAbi, functionName: 'guardiansCount', args: [wallet] });
      if (!sameSet(guardians, [setup.cardGuardian, helper]) || guardianThreshold !== 2n || count !== 2n) reasons.push(`Unexpected guardians or threshold: ${module}`);
      const pending = await client.readContract({ address: module, abi: moduleAbi, functionName: 'getRecoveryRequest', args: [wallet] });
      if (pending.executeAfter !== 0n) reasons.push(`Recovery pending: ${module}`);
    }
    // Module executions do not increment the Safe owner nonce, including recovery at nonce zero.
    // Pin the head once; every history range below ends at this block.
    const toBlock = await client.getBlockNumber();
    const fromBlock = options.fromBlock ?? historyStartBlock(chainId, toBlock);
    if (fromBlock > toBlock) throw new Error('Invalid history start block');
    if (nonce > 0n) {
      const transactions = await readLogsInChunks(fromBlock, toBlock, (from, to) => client.getLogs({ address: wallet, event: multiSigEvent, fromBlock: from, toBlock: to, strict: true }));
      const seen = new Set<string>();
      for (const log of transactions) {
        const [eventNonce] = decodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'uint256' }], log.args.additionalInfo);
        seen.add(eventNonce.toString());
        if (log.args.operation === 1) {
          if (!same(log.args.to, ADDRESSES.multiSendCallOnly)) reasons.push('Forbidden delegatecall in wallet history');
          else {
            const calls = decodeMultiSendCall(log.args.data);
            if (!calls.length || calls.some(c => c.operation !== 0)) reasons.push('Unsafe call-only batch in wallet history');
          }
        } else if (log.args.operation !== 0) reasons.push('Unknown operation in wallet history');
      }
      // One emitted SafeL2 transaction for each increment; incomplete providers must never turn verification green.
      if (BigInt(seen.size) !== nonce || [...seen].some(n => BigInt(n) >= nonce!)) reasons.push('Incomplete Safe transaction history');
    }
    const moduleTransactions = await readLogsInChunks(fromBlock, toBlock, (from, to) => client.getLogs({ address: wallet, event: moduleEvent, fromBlock: from, toBlock: to, strict: true }));
    if (moduleTransactions.some(log => log.args.operation !== 0 || !MODULES.some(m => same(m, log.args.module)))) reasons.push('Forbidden module transaction in wallet history');
  } catch (error) { reasons.push(error instanceof Error ? error.message : 'Wallet verification RPC failure'); }
  return { ok: reasons.length === 0, wallet, reasons, ...(nonce === undefined ? {} : { nonce }) };
}
export async function verifyWalletIndependent(clients: readonly PublicClient[], setup: WalletSetup, options: VerificationOptions = {}): Promise<WalletVerification> {
  if (clients.length < 2 || new Set(clients).size < 2) return { ok: false, wallet: options.expectedWallet ?? ADDRESSES.factory, reasons: ['Two independent public RPC clients are required'] };
  // Distinct client objects alone do not prove distinct providers: reject duplicate known transport URLs.
  const urls = clients.map(client => (client.transport as { url?: string } | undefined)?.url).filter((url): url is string => !!url);
  if (new Set(urls).size !== urls.length) return { ok: false, wallet: options.expectedWallet ?? ADDRESSES.factory, reasons: ['Duplicate public RPC transport URL'] };
  const results = await Promise.all(clients.map(client => verifyWallet(client, setup, options)));
  const first = results[0]!;
  const reasons = results.flatMap((r, i) => r.reasons.map(reason => `RPC ${i + 1}: ${reason}`));
  if (results.some(r => !same(r.wallet, first.wallet) || r.nonce !== first.nonce)) reasons.push('Public RPC state disagreement');
  return { ...first, ok: reasons.length === 0, reasons };
}
