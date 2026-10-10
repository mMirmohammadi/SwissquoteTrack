import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeAbiParameters, encodeFunctionData, keccak256, parseAbi, toHex, type Address, type Hex, type PublicClient } from 'viem';
import { ADDRESSES, CONTRACT_CODE_HASHES, GUARD_STORAGE_SLOT, FALLBACK_STORAGE_SLOT, PROXY_CREATION_CODE_HASH, PROXY_RUNTIME_CODE_HASH } from '../../packages/protocol/src/constants.ts';
import { computeWalletAddress } from '../../packages/protocol/src/wallet.ts';
import { verifyWallet, verifyWalletIndependent } from '../../packages/protocol/src/verification.ts';

const fixture = JSON.parse(readFileSync(new URL('../../contracts/contracts/plan/sepolia-code.json', import.meta.url), 'utf8'));
const artifact = JSON.parse(readFileSync(new URL('../../contracts/node_modules/@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json', import.meta.url), 'utf8'));
const setup = { owner: '0x1111111111111111111111111111111111111111' as Address, cardGuardian: '0x2222222222222222222222222222222222222222' as Address, partnerGuardian: '0x3333333333333333333333333333333333333333' as Address, sqGuardian: '0x4444444444444444444444444444444444444444' as Address, saltNonce: 12n, chainId: 11155111 };
const wallet = computeWalletAddress(setup, artifact.bytecode);
const moduleB = JSON.parse(readFileSync(new URL('../../contracts/contracts/plan/sepolia-module-b.json', import.meta.url), 'utf8'));
const codes = new Map<string, Hex>(Object.values(fixture.contracts).map((item: any) => [item.address.toLowerCase(), item.code]));
codes.set(moduleB.address.toLowerCase(), moduleB.code);
const extra = '0x5555555555555555555555555555555555555555' as Address;
type Overrides = { chainId?: number; nonce?: bigint; owners?: Address[]; ownerThreshold?: bigint; modules?: Address[]; next?: Address; guardiansB?: Address[]; thresholdB?: bigint; pendingB?: bigint; guard?: bigint; codeAt?: Address; code?: Hex; logs?: any[]; moduleLogs?: any[]; rpcFailure?: boolean };
function client(overrides: Overrides = {}): PublicClient {
  return {
    getChainId: async () => overrides.chainId ?? 11155111,
    getCode: async ({ address }: { address: Address }) => overrides.codeAt?.toLowerCase() === address.toLowerCase() ? overrides.code : address.toLowerCase() === wallet.toLowerCase() ? artifact.deployedBytecode : codes.get(address.toLowerCase()),
    getStorageAt: async ({ slot }: { slot: Hex }) => toHex(slot === GUARD_STORAGE_SLOT ? overrides.guard ?? 0n : slot === FALLBACK_STORAGE_SLOT ? BigInt(ADDRESSES.fallbackHandler) : BigInt(ADDRESSES.safeL2), { size: 32 }),
    getBlockNumber: async () => 100n,
    getLogs: async ({ event }: any) => { if (overrides.rpcFailure) throw new Error('fixture history RPC unavailable'); return event.name === 'SafeModuleTransaction' ? overrides.moduleLogs ?? [] : overrides.logs ?? []; },
    readContract: async ({ functionName, address }: { functionName: string; address: Address }) => {
      const b = address.toLowerCase() === ADDRESSES.moduleB.toLowerCase();
      switch (functionName) {
        case 'proxyCreationCode': return artifact.bytecode;
        case 'nonce': return overrides.nonce ?? 0n;
        case 'getOwners': return overrides.owners ?? [setup.owner];
        case 'getThreshold': return overrides.ownerThreshold ?? 1n;
        case 'getModulesPaginated': return [overrides.modules ?? [ADDRESSES.moduleA, ADDRESSES.moduleB], overrides.next ?? '0x0000000000000000000000000000000000000001'];
        case 'getGuardians': return b ? overrides.guardiansB ?? [setup.cardGuardian, setup.sqGuardian] : [setup.cardGuardian, setup.partnerGuardian];
        case 'threshold': return b ? overrides.thresholdB ?? 2n : 2n;
        case 'guardiansCount': return 2n;
        case 'getRecoveryRequest': return { executeAfter: b ? overrides.pendingB ?? 0n : 0n };
        default: throw new Error(`unhandled fixture read: ${functionName}`);
      }
    },
  } as unknown as PublicClient;
}
const info = (nonce: bigint) => encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'uint256' }], [nonce, setup.owner, 1n]);
const log = (nonce: bigint, operation = 0, to = extra) => ({ args: { additionalInfo: info(nonce), operation, to, data: '0x' } });

test('pinned proxy artifact and saved Sepolia contract bytes agree with every code hash', () => {
  assert.equal(keccak256(artifact.bytecode), PROXY_CREATION_CODE_HASH);
  assert.equal(keccak256(artifact.deployedBytecode), PROXY_RUNTIME_CODE_HASH);
  for (const [address, hash] of Object.entries(CONTRACT_CODE_HASHES)) assert.equal(keccak256(codes.get(address)!), hash, address);
});
test('exact zero-nonce wallet verifies and mismatched deterministic address rejects', async () => {
  assert.equal((await verifyWallet(client(), setup, { expectedWallet: wallet })).ok, true);
  assert.equal((await verifyWallet(client(), setup, { expectedWallet: extra })).ok, false);
});
test('verification rejects hidden owners/modules/guard, weak B, missing card and pending recovery', async () => {
  for (const mutation of [{ owners: [setup.owner, extra] }, { ownerThreshold: 2n }, { modules: [ADDRESSES.moduleA, ADDRESSES.moduleB, extra] }, { next: extra }, { guard: 1n }, { thresholdB: 1n }, { guardiansB: [setup.partnerGuardian, setup.sqGuardian] }, { pendingB: 10n }]) {
    assert.equal((await verifyWallet(client(mutation), setup)).ok, false, JSON.stringify(mutation, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
  }
});
test('verification rejects malformed or substituted pinned bytecode and wrong chain', async () => {
  for (const mutation of [{ chainId: 31337 }, { codeAt: ADDRESSES.moduleA, code: '0x' as Hex }, { codeAt: ADDRESSES.moduleB, code: '0x6000' as Hex }, { codeAt: wallet, code: '0x6000' as Hex }]) assert.equal((await verifyWallet(client(mutation), setup)).ok, false);
});
test('later recheck requires complete transaction history and rejects forbidden delegatecall', async () => {
  assert.equal((await verifyWallet(client({ nonce: 2n, logs: [log(0n), log(1n)] }), setup)).ok, true);
  for (const logs of [[], [log(0n)], [log(0n), log(0n)], [log(0n), log(2n)], [log(0n), log(1n, 1)]]) assert.equal((await verifyWallet(client({ nonce: 2n, logs }), setup)).ok, false);
  assert.equal((await verifyWallet(client({ nonce: 1n, rpcFailure: true }), setup)).ok, false);
});
// These injected RPC histories are test doubles, not evidence that a pinned live
// module is malicious or that a real recovery/rotation transaction executed.
const moduleLog = (operation = 0, module = ADDRESSES.moduleA, data: Hex = '0x') => ({ args: { module, to: wallet, value: 0n, data, operation } });
for (const [label, malicious] of [
  ['delegatecall from a pinned module', moduleLog(1)],
  ['CALL from an unapproved module', moduleLog(0, extra)],
] as const) {
  test(`TEST DOUBLE: nonce-zero malicious module history rejects ${label}`, async () => {
    const result = await verifyWallet(client({ nonce: 0n, moduleLogs: [malicious] }), setup, { expectedWallet: wallet });
    assert.equal(result.ok, false, `nonce 0 must not skip module execution history: ok=${result.ok}; reasons=${result.reasons.join('; ')}`);
    assert.ok(result.reasons.some(reason => /module transaction/i.test(reason)));
  });
}
test('TEST DOUBLE: nonce-zero module-history RPC failure must not verify green', async () => {
  const result = await verifyWallet(client({ nonce: 0n, rpcFailure: true }), setup);
  assert.equal(result.ok, false, 'an unreadable module history must fail closed even before any owner transaction');
  assert.ok(result.reasons.some(reason => /fixture history RPC unavailable/.test(reason)));
});

const ownerSwap = encodeFunctionData({ abi: parseAbi(['function swapOwner(address prevOwner,address oldOwner,address newOwner)']), functionName: 'swapOwner', args: ['0x0000000000000000000000000000000000000001', setup.owner, extra] });
// Lifecycle contract: setup.owner remains immutable creation evidence;
// expectedCurrentOwner is a separately trusted caller expectation, never inferred
// solely from getOwners. These positive cases initially failed before the builder
// implemented that option, preserving independent regression evidence.
const lifecycleOptions: Parameters<typeof verifyWallet>[2] = { expectedWallet: wallet, expectedCurrentOwner: extra };
const lifecycleStates: [string, Overrides][] = [
  ['completed module recovery at Safe nonce zero', { nonce: 0n, owners: [extra], moduleLogs: [moduleLog(0, ADDRESSES.moduleA, ownerSwap)] }],
  ['owner-authorized rotation at Safe nonce one', { nonce: 1n, owners: [extra], logs: [{ args: { additionalInfo: info(0n), operation: 0, to: wallet, value: 0n, data: ownerSwap } }] }],
];
for (const [label, state] of lifecycleStates) {
  test(`TEST DOUBLE: ${label} verifies original CREATE2 plus expected current owner`, async () => {
    const result = await verifyWallet(client(state), setup, lifecycleOptions);
    assert.equal(result.wallet.toLowerCase(), wallet.toLowerCase(), 'owner replacement does not change the wallet address');
    assert.equal(result.ok, true, `legitimate owner replacement must remain verifiable: ${result.reasons.join('; ')}`);
    assert.equal((await verifyWalletIndependent([client(state), client(state)], setup, lifecycleOptions)).ok, true);
  });
}
test('TEST DOUBLE: changing creation setup owner cannot repair a recovered-wallet recheck', async () => {
  const changedSetup = { ...setup, owner: extra };
  assert.notEqual(computeWalletAddress(changedSetup, artifact.bytecode).toLowerCase(), wallet.toLowerCase());
  const result = await verifyWallet(client({ owners: [extra] }), changedSetup, { expectedWallet: wallet });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('Setup code wallet does not match deterministic template'));
});
for (const [label, owners] of [['mismatching', [setup.owner]], ['hidden additional', [extra, setup.owner]]] as const) {
  test(`TEST DOUBLE: expected current owner rejects ${label} owner`, async () => {
    assert.equal((await verifyWallet(client({ owners: [...owners] }), setup, lifecycleOptions)).ok, false);
  });
}
for (const expectedCurrentOwner of ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', '0x1234'] as const) {
  test(`TEST DOUBLE: current-owner expectation rejects unusable address ${expectedCurrentOwner}`, async () => {
    assert.equal((await verifyWallet(client(), setup, { expectedWallet: wallet, expectedCurrentOwner: expectedCurrentOwner })).ok, false);
  });
}

test('independent verifier refuses one client, repeated client object, state disagreement or one failed RPC', async () => {
  const one = client();
  assert.equal((await verifyWalletIndependent([one], setup)).ok, false);
  assert.equal((await verifyWalletIndependent([one, one], setup)).ok, false);
  assert.equal((await verifyWalletIndependent([one, client()], setup)).ok, true);
  assert.equal((await verifyWalletIndependent([one, client({ guard: 1n })], setup)).ok, false);
  assert.equal((await verifyWalletIndependent([one, client({ nonce: 1n, logs: [log(0n)] })], setup)).ok, false);
});
