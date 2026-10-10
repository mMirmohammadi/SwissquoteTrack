import { createPublicClient, http, isAddress, keccak256, type Address, type PublicClient } from 'viem';
import { sepolia, hardhat } from 'viem/chains';
import {
  CHAIN_ID, LOCAL_CHAIN_ID, PUBLIC_RPC_URLS, HISTORY_RPC_URLS, MODULES, MODULE_CODE_HASHES, generateCardSeed,
  mnemonicToAddress, mnemonicToPrivateKey, ownerFingerprint, decodeSetupCode,
  decodeRequestCode, encodeCode, verifyWalletIndependent, assertRecoveryHash,
  signRecovery, moduleAbi, safeAbi, PROXY_RUNTIME_CODE_HASH, auditWallet, openKit, type EmergencyKit, type RecoveryRequest,
} from './protocol.js';
import { normalizeWords, validateCodeInput, pinnedRpcUrls, parseJson, sameAddress } from './validation.js';

export type ToolConfig = { chainId: number; rpcUrls?: string };
/** One queue per endpoint/client; pace actual HTTP attempts, including viem retries. */
export function pacedFetch(fetchFn: typeof fetch, clock = {
  now: () => performance.now(),
  sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
}): typeof fetch {
  let tail: Promise<void> = Promise.resolve();
  let lastStart = -Infinity;
  return (input, init) => {
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const request = tail.then(async () => {
      // viem's finite HTTP timeout includes queue time. Never send an expired attempt.
      signal?.throwIfAborted();
      let remaining = 150 - (clock.now() - lastStart);
      while (remaining > 0) {
        await clock.sleep(remaining);
        signal?.throwIfAborted();
        remaining = 150 - (clock.now() - lastStart);
      }
      lastStart = clock.now();
      return fetchFn(input, init);
    });
    // A rejected/aborted fetch must not poison the endpoint queue.
    tail = request.then(() => undefined, () => undefined);
    return request;
  };
}
/** On Sepolia, publicUrls supplies the pinned pair (current reads: PUBLIC_RPC_URLS; wallet history: HISTORY_RPC_URLS). The local chain ignores it. */
export function makeClients(config: ToolConfig, publicUrls: readonly string[] = PUBLIC_RPC_URLS): PublicClient[] {
  const chain = config.chainId === CHAIN_ID ? sepolia : config.chainId === LOCAL_CHAIN_ID ? hardhat : undefined;
  if (!chain) throw new Error('Unsupported chain.');
  const urls = pinnedRpcUrls(config.chainId, config.rpcUrls, publicUrls);
  if (urls.length !== 2 || new Set(urls).size !== 2) throw new Error('Two independent public RPCs are required.');
  return urls.map(url => createPublicClient({ chain, transport: http(url, {
    timeout: 12_000, retryCount: 1, batch: false,
    ...(config.chainId === CHAIN_ID ? { fetchFn: pacedFetch(fetch) } : {}),
  }) }) as PublicClient);
}
export function createCard(): { words: string; guardian: string } {
  const words = generateCardSeed();
  return { words, guardian: mnemonicToAddress(words) };
}
/**
 * expectedCurrentOwner must be supplied independently by the user, never filled from RPC getOwners.
 * Wallet history is read from the protocol default start block (Sepolia: SEPOLIA_HISTORY_START; local: genesis)
 * through two history-capable RPCs; publicnode keeps only recent logs.
 */
export async function checkWallet(code: string, words: string, config: ToolConfig, clients = makeClients(config, HISTORY_RPC_URLS), expectedCurrentOwner?: string) {
  const setup = decodeSetupCode(validateCodeInput(code));
  if (setup.chainId !== config.chainId) throw new Error('Code chain does not match this tool.');
  const currentOwner = expectedCurrentOwner?.trim() || undefined;
  if (currentOwner && !isAddress(currentOwner, { strict: false })) throw new Error('Enter a valid independently confirmed current-owner address.');
  const cardGuardian = mnemonicToAddress(normalizeWords(words));
  return verifyWalletIndependent(clients, { owner: setup.owner, cardGuardian,
    partnerGuardian: setup.partnerGuardian, sqGuardian: setup.sqGuardian,
    saltNonce: BigInt(setup.saltNonce), chainId: setup.chainId }, { expectedWallet: setup.wallet, expectedCurrentOwner: currentOwner as Address | undefined });
}
export async function checkWalletRules(wallet: string, config: ToolConfig, clients = makeClients(config)) {
  if (!isAddress(wallet.trim(), { strict: false })) throw new Error('Enter a valid public wallet address.');
  const chains = await Promise.all(clients.map(client => client.getChainId()));
  if (chains.some(chainId => chainId !== config.chainId)) throw new Error('RPC returned the wrong chain.');
  return auditWallet(clients, wallet.trim() as Address);
}
export type RecoveryReview = { request: RecoveryRequest; signer: string; fingerprint: string };
export async function reviewRecovery(code: string, words: string, config: ToolConfig, clients = makeClients(config)): Promise<RecoveryReview> {
  const wire = decodeRequestCode(validateCodeInput(code));
  if (wire.chainId !== config.chainId) throw new Error('Code chain does not match this tool.');
  if (!MODULES.some(module => sameAddress(module, wire.module))) throw new Error('Unknown recovery module.');
  const request: RecoveryRequest = { wallet: wire.wallet, module: wire.module, newOwner: wire.newOwner, nonce: BigInt(wire.nonce), chainId: wire.chainId };
  const signer = mnemonicToAddress(normalizeWords(words));
  if (sameAddress(signer, request.newOwner)) throw new Error('New owner cannot be the card guardian.');
  if (clients.length !== 2 || new Set(clients).size !== 2) throw new Error('Two RPC checks from distinct clients are required.');
  await Promise.all(clients.map(async client => {
    if (await client.getChainId() !== config.chainId) throw new Error('RPC returned the wrong chain.');
    const moduleCode = await client.getCode({ address: request.module });
    if (!moduleCode || keccak256(moduleCode) !== MODULE_CODE_HASHES[request.module.toLowerCase()]) throw new Error('Recovery module code does not match the pinned contract.');
    const walletCode = await client.getCode({ address: request.wallet });
    if (!walletCode || walletCode === '0x') throw new Error('Wallet is not deployed.');
    await assertRecoveryHash(client, request);
    const nonce = await client.readContract({ address: request.module, abi: moduleAbi, functionName: 'nonce', args: [request.wallet] });
    if (BigInt(nonce) !== request.nonce) throw new Error('Recovery request is stale. Generate a new request.');
    const guardian = await client.readContract({ address: request.module, abi: moduleAbi, functionName: 'isGuardian', args: [request.wallet, signer as `0x${string}`] });
    if (!guardian) throw new Error('These card words are not a guardian of this wallet.');
  }));
  return { request, signer, fingerprint: ownerFingerprint(request.newOwner) };
}
export async function approveRecovery(code: string, words: string, config: ToolConfig, expectedReview: RecoveryReview, clients = makeClients(config)): Promise<string> {
  // Freshly repeat every chain check at the explicit confirmation boundary.
  const review = await reviewRecovery(code, words, config, clients);
  if (JSON.stringify(review, (_, value) => typeof value === 'bigint' ? value.toString() : value) !== JSON.stringify(expectedReview, (_, value) => typeof value === 'bigint' ? value.toString() : value)) throw new Error('Request changed. Review it again.');
  const approval = await signRecovery(mnemonicToPrivateKey(normalizeWords(words)), review.request);
  return encodeCode({ v: 1, kind: 'approval', chainId: config.chainId, ...approval });
}
/** Explicit optional network check after offline decryption; never labels a stale owner seed usable. */
export async function checkKitCurrentOwner(kit: { wallet: Address; owner: Address; chainId: number }, config: ToolConfig, clients = makeClients(config)) {
  if (kit.chainId !== config.chainId || !isAddress(kit.wallet, { strict: false }) || !isAddress(kit.owner, { strict: false })) throw new Error('Kit wallet or chain is invalid for this tool.');
  if (clients.length !== 2 || new Set(clients).size !== 2) throw new Error('Two distinct RPC checks are required.');
  const heads = await Promise.all(clients.map(client => client.getBlockNumber()));
  const blockNumber = heads.reduce((a, b) => a < b ? a : b);
  const states = await Promise.all(clients.map(async client => {
    if (await client.getChainId() !== config.chainId) throw new Error('RPC returned the wrong chain.');
    const block = await client.getBlock({ blockNumber });
    if (!block.hash || block.number !== blockNumber) throw new Error('Pinned block unavailable.');
    const code = await client.getCode({ address: kit.wallet, blockNumber });
    if (!code || keccak256(code) !== PROXY_RUNTIME_CODE_HASH) throw new Error('Wallet proxy code does not match.');
    const owners = await client.readContract({ address: kit.wallet, abi: safeAbi, functionName: 'getOwners', blockNumber });
    const threshold = await client.readContract({ address: kit.wallet, abi: safeAbi, functionName: 'getThreshold', blockNumber });
    return { hash: block.hash, owners, threshold };
  }));
  if (!sameAddress(states[0]!.hash, states[1]!.hash) || JSON.stringify(states[0]!.owners.map(x => x.toLowerCase())) !== JSON.stringify(states[1]!.owners.map(x => x.toLowerCase())) || states[0]!.threshold !== states[1]!.threshold) throw new Error('RPCs disagree on current ownership.');
  if (states[0]!.owners.length !== 1 || states[0]!.threshold !== 1n || !sameAddress(states[0]!.owners[0]!, kit.owner)) throw new Error('Stale or unsupported kit: its seed is not the sole current wallet owner. Do not use it to send or cancel.');
  return { blockNumber, blockHash: states[0]!.hash, owner: kit.owner };
}
export async function openEmergencyKit(text: string, code: string) {
  const kit = parseJson(text);
  if (kit.v !== 1 || ![CHAIN_ID, LOCAL_CHAIN_ID].includes(Number(kit.chainId))) throw new Error('Unsupported emergency kit version or chain.');
  // Protocol validates KDF parameters, checksum, authenticated ciphertext and owner binding.
  const opened = await openKit(kit as unknown as EmergencyKit, code.trim());
  return { ...opened, wallet: kit.wallet as Address, chainId: Number(kit.chainId) };
}
