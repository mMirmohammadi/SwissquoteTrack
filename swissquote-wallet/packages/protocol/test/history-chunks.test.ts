import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeAbiParameters, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ADDRESSES, CHAIN_ID, FALLBACK_STORAGE_SLOT, GUARD_STORAGE_SLOT, HISTORY_RPC_URLS, LOCAL_CHAIN_ID, LOG_CHUNK_BLOCKS, MODULES, PUBLIC_RPC_URLS,
  SENTINEL_ADDRESS, SEPOLIA_HISTORY_START, historyStartBlock, verifyWallet, verifyWalletIndependent, type WalletSetup,
} from '../src/index.js';

// Fake RPC client: real pinned bytecode fixtures for the code checks, plus a recorded, range-aware eth_getLogs.
const key = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const owner = privateKeyToAccount(key(1)).address;
const sepoliaSetup: WalletSetup = { owner, cardGuardian: privateKeyToAccount(key(2)).address, partnerGuardian: privateKeyToAccount(key(3)).address, sqGuardian: privateKeyToAccount(key(4)).address, saltNonce: 7n };
const localSetup: WalletSetup = { ...sepoliaSetup, chainId: LOCAL_CHAIN_ID };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/contracts.json', import.meta.url), 'utf8')) as { contracts: { address: Address; code: Hex }[]; proxyCreationCode: Hex; proxyRuntimeCode: Hex };
const codes = new Map<string, Hex>(fixture.contracts.map(c => [c.address.toLowerCase(), c.code]));
const S = SEPOLIA_HISTORY_START;
type EventName = 'SafeMultiSigTransaction' | 'SafeModuleTransaction';
type ChainLog = { event: EventName; blockNumber: bigint; args: Record<string, unknown> };
type Range = { event: string; fromBlock: bigint; toBlock: bigint };
const ownerTx = (safeNonce: bigint, blockNumber: bigint): ChainLog => ({
  event: 'SafeMultiSigTransaction', blockNumber,
  args: { additionalInfo: encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'uint256' }], [safeNonce, owner, 1n]), operation: 0, to: owner, data: '0x' },
});
const moduleTx = (module: Address, operation: number, blockNumber: bigint): ChainLog => ({ event: 'SafeModuleTransaction', blockNumber, args: { module, to: owner, value: 0n, data: '0x', operation } });
interface FakeOptions { chainId?: number; heads: bigint[]; nonce?: bigint; logs?: ChainLog[]; failAt?: bigint; dropAt?: bigint }
function fakeClient({ chainId = CHAIN_ID, heads, nonce = 0n, logs = [], failAt, dropAt }: FakeOptions) {
  const ranges: Range[] = [];
  let headReads = 0;
  const inside = (block: bigint | undefined, from: bigint, to: bigint) => block !== undefined && from <= block && block <= to;
  const client = {
    getChainId: async () => chainId,
    getCode: async ({ address }: { address: Address }) => codes.get(address.toLowerCase()) ?? fixture.proxyRuntimeCode,
    getStorageAt: async ({ slot }: { slot: string }) => slot === GUARD_STORAGE_SLOT ? `0x${'0'.repeat(64)}` : encodeAbiParameters([{ type: 'uint256' }], [BigInt(slot === FALLBACK_STORAGE_SLOT ? ADDRESSES.fallbackHandler : ADDRESSES.safeL2)]),
    readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
      switch (functionName) {
        case 'proxyCreationCode': return fixture.proxyCreationCode;
        case 'nonce': return nonce;
        case 'getOwners': return [owner];
        case 'getThreshold': return 1n;
        case 'getModulesPaginated': return [MODULES, SENTINEL_ADDRESS];
        case 'getGuardians': return [sepoliaSetup.cardGuardian, address.toLowerCase() === ADDRESSES.moduleA.toLowerCase() ? sepoliaSetup.partnerGuardian : sepoliaSetup.sqGuardian];
        case 'threshold': return 2n;
        case 'guardiansCount': return 2n;
        case 'getRecoveryRequest': return { executeAfter: 0n };
        default: throw new Error(`Unexpected test read ${functionName}`);
      }
    },
    // A moving head: the verifier must read it once and stop every range there.
    getBlockNumber: async () => heads[Math.min(headReads++, heads.length - 1)]!,
    getLogs: async ({ event, fromBlock, toBlock }: { event: { name: string }; fromBlock: bigint; toBlock: bigint }) => {
      ranges.push({ event: event.name, fromBlock, toBlock });
      if (inside(failAt, fromBlock, toBlock)) throw new Error(`fixture RPC refused blocks ${fromBlock}-${toBlock}`);
      if (inside(dropAt, fromBlock, toBlock)) return []; // an incomplete provider silently omits this range
      return logs.filter(log => log.event === event.name && inside(log.blockNumber, fromBlock, toBlock));
    },
  } as unknown as PublicClient;
  return { client, ranges, headReads: () => headReads };
}
const span = (from: bigint, to: bigint) => [from, to] as const;
const spans = (ranges: Range[], event: EventName) => ranges.filter(r => r.event === event).map(r => span(r.fromBlock, r.toBlock));

test('RPC lists: history reads use tenderly + ethpandaops; publicnode stays first for sends and current reads; drpc is gone', () => {
  assert.equal(SEPOLIA_HISTORY_START, 11_886_000n);
  assert.equal(LOG_CHUNK_BLOCKS, 10_000n);
  assert.deepEqual([...HISTORY_RPC_URLS], ['https://sepolia.gateway.tenderly.co', 'https://rpc.sepolia.ethpandaops.io']);
  assert.equal(PUBLIC_RPC_URLS[0], 'https://ethereum-sepolia-rpc.publicnode.com');
  assert.deepEqual(PUBLIC_RPC_URLS.slice(1), [...HISTORY_RPC_URLS]);
  assert.ok(PUBLIC_RPC_URLS.every(url => url.startsWith('https://') && !url.includes('drpc')));
  assert.equal(new Set(PUBLIC_RPC_URLS).size, PUBLIC_RPC_URLS.length);
});

test('default history start: SEPOLIA_HISTORY_START on Sepolia, genesis on the local chain and on a fresh chain below the start', () => {
  assert.equal(historyStartBlock(CHAIN_ID, S + 500n), S);
  assert.equal(historyStartBlock(CHAIN_ID, S), S);
  assert.equal(historyStartBlock(CHAIN_ID, S - 1n), 0n);
  assert.equal(historyStartBlock(LOCAL_CHAIN_ID, S + 500n), 0n);
  assert.equal(historyStartBlock(LOCAL_CHAIN_ID, 100n), 0n);
});

for (const [label, blocks, expected] of [
  ['exactly three full chunks (30,000 blocks)', 30_000n, [span(S, S + 9_999n), span(S + 10_000n, S + 19_999n), span(S + 20_000n, S + 29_999n)]],
  ['three full chunks plus a one-block remainder (30,001 blocks)', 30_001n, [span(S, S + 9_999n), span(S + 10_000n, S + 19_999n), span(S + 20_000n, S + 29_999n), span(S + 30_000n, S + 30_000n)]],
  ['two full chunks plus a 5,001-block remainder (25,001 blocks)', 25_001n, [span(S, S + 9_999n), span(S + 10_000n, S + 19_999n), span(S + 20_000n, S + 25_000n)]],
  ['exactly one full chunk (10,000 blocks)', 10_000n, [span(S, S + 9_999n)]],
  ['a single block (head = start)', 1n, [span(S, S)]],
] as const) {
  test(`Sepolia history is read in <= 10,000-block chunks from the default start to the pinned head: ${label}`, async () => {
    const head = S + blocks - 1n;
    const fake = fakeClient({ heads: [head, head + 50n], nonce: 1n, logs: [ownerTx(0n, head)] });
    const result = await verifyWallet(fake.client, sepoliaSetup);
    assert.equal(result.ok, true, result.reasons.join('; '));
    assert.equal(fake.headReads(), 1, 'the head is read once and pinned');
    for (const event of ['SafeMultiSigTransaction', 'SafeModuleTransaction'] as const) assert.deepEqual(spans(fake.ranges, event), expected, event);
    assert.ok(fake.ranges.every(r => r.toBlock - r.fromBlock + 1n <= LOG_CHUNK_BLOCKS && r.toBlock <= head));
  });
}

test('local chain keeps genesis as the default start and reads the same history in chunks', async () => {
  const fake = fakeClient({ chainId: LOCAL_CHAIN_ID, heads: [25_000n], nonce: 2n, logs: [ownerTx(0n, 5n), ownerTx(1n, 24_999n)] });
  const result = await verifyWallet(fake.client, localSetup);
  assert.equal(result.ok, true, result.reasons.join('; '));
  assert.deepEqual(spans(fake.ranges, 'SafeMultiSigTransaction'), [span(0n, 9_999n), span(10_000n, 19_999n), span(20_000n, 25_000n)]);
  // A small local chain still needs a single request, as before this change.
  const small = fakeClient({ chainId: LOCAL_CHAIN_ID, heads: [120n] });
  assert.equal((await verifyWallet(small.client, localSetup)).ok, true);
  assert.deepEqual(spans(small.ranges, 'SafeModuleTransaction'), [span(0n, 120n)]);
});

test('a chain with Sepolia\'s id whose head is below the start is read from genesis, so nothing is skipped', async () => {
  const fake = fakeClient({ heads: [100n], logs: [moduleTx(owner, 0, 40n)] });
  const result = await verifyWallet(fake.client, sepoliaSetup);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('Forbidden module transaction in wallet history'));
  assert.deepEqual(spans(fake.ranges, 'SafeModuleTransaction'), [span(0n, 100n)]);
});

test('an explicit fromBlock wins over the Sepolia default, earlier or later', async () => {
  const head = S + 5n;
  const earlier = fakeClient({ heads: [head] });
  assert.equal((await verifyWallet(earlier.client, sepoliaSetup, { fromBlock: S - 15_000n })).ok, true);
  assert.deepEqual(spans(earlier.ranges, 'SafeModuleTransaction'), [span(S - 15_000n, S - 5_001n), span(S - 5_000n, head)]);
  const later = fakeClient({ heads: [S + 20_000n] });
  assert.equal((await verifyWallet(later.client, sepoliaSetup, { fromBlock: S + 12_345n })).ok, true);
  assert.deepEqual(spans(later.ranges, 'SafeModuleTransaction'), [span(S + 12_345n, S + 20_000n)]);
  // An explicit start of 0 on the local chain behaves exactly like the old default.
  const local = fakeClient({ chainId: LOCAL_CHAIN_ID, heads: [9_999n] });
  assert.equal((await verifyWallet(local.client, localSetup, { fromBlock: 0n })).ok, true);
  assert.deepEqual(spans(local.ranges, 'SafeModuleTransaction'), [span(0n, 9_999n)]);
});

test('an explicit fromBlock above the pinned head fails closed without reading history', async () => {
  const fake = fakeClient({ heads: [S + 10n] });
  const result = await verifyWallet(fake.client, sepoliaSetup, { fromBlock: S + 11n });
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, ['Invalid history start block']);
  assert.equal(fake.ranges.length, 0);
});

test('an RPC error in any chunk fails closed and stops further history reads', async () => {
  const head = S + 29_999n;
  // Module history (always read): the second chunk fails.
  const moduleFailure = fakeClient({ heads: [head], failAt: S + 15_000n });
  const moduleResult = await verifyWallet(moduleFailure.client, sepoliaSetup);
  assert.equal(moduleResult.ok, false);
  assert.deepEqual(moduleResult.reasons, [`fixture RPC refused blocks ${S + 10_000n}-${S + 19_999n}`]);
  assert.deepEqual(spans(moduleFailure.ranges, 'SafeModuleTransaction'), [span(S, S + 9_999n), span(S + 10_000n, S + 19_999n)]);
  // Owner multisig history (nonce > 0): the last chunk fails; module history is never reached.
  const ownerFailure = fakeClient({ heads: [head], nonce: 1n, logs: [ownerTx(0n, S + 1n)], failAt: head });
  const ownerResult = await verifyWallet(ownerFailure.client, sepoliaSetup);
  assert.equal(ownerResult.ok, false);
  assert.deepEqual(ownerResult.reasons, [`fixture RPC refused blocks ${S + 20_000n}-${head}`]);
  assert.equal(spans(ownerFailure.ranges, 'SafeModuleTransaction').length, 0);
  // Independent verification stays red when only one of the two RPCs fails.
  const healthy = fakeClient({ heads: [head] });
  const failing = fakeClient({ heads: [head], failAt: S });
  const both = await verifyWalletIndependent([healthy.client, failing.client], sepoliaSetup);
  assert.equal(both.ok, false);
  assert.ok(both.reasons.some(reason => reason.startsWith('RPC 2: fixture RPC refused blocks')));
});

test('the one-event-per-Safe-nonce rule and module checks see events in every chunk', async () => {
  const head = S + 29_999n;
  const logs = [ownerTx(0n, S), ownerTx(1n, S + 10_000n), ownerTx(2n, head)];
  assert.equal((await verifyWallet(fakeClient({ heads: [head], nonce: 3n, logs }).client, sepoliaSetup)).ok, true);
  // A provider that silently omits the middle chunk is caught by the nonce count.
  const dropped = await verifyWallet(fakeClient({ heads: [head], nonce: 3n, logs, dropAt: S + 10_000n }).client, sepoliaSetup);
  assert.equal(dropped.ok, false);
  assert.ok(dropped.reasons.includes('Incomplete Safe transaction history'));
  // Duplicate events for one nonce in different chunks still fail.
  const duplicate = await verifyWallet(fakeClient({ heads: [head], nonce: 2n, logs: [ownerTx(0n, S), ownerTx(0n, head)] }).client, sepoliaSetup);
  assert.equal(duplicate.ok, false);
  // A forbidden module transaction in the last chunk is found; allowed module calls in earlier chunks pass.
  const moduleLogs = [moduleTx(ADDRESSES.moduleA, 0, S + 3n), moduleTx(ADDRESSES.moduleB, 0, S + 10_001n)];
  assert.equal((await verifyWallet(fakeClient({ heads: [head], logs: moduleLogs }).client, sepoliaSetup)).ok, true);
  const forbidden = await verifyWallet(fakeClient({ heads: [head], logs: [...moduleLogs, moduleTx(ADDRESSES.moduleA, 1, head)] }).client, sepoliaSetup);
  assert.equal(forbidden.ok, false);
  assert.ok(forbidden.reasons.includes('Forbidden module transaction in wallet history'));
});
