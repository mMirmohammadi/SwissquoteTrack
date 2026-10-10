import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { decodeFunctionData, encodeFunctionData, hashMessage, keccak256, toHex, type Hex, type PublicClient } from 'viem';
import { COMPOUND_EXTENSION, DAPP_ADDRESSES as A, DAPP_CODE_PINS, compoundAbi, dappTokenAbi, simulationProbes } from '@sq/protocol';
import { createApp } from '../src/app.ts';
import { digest } from '../src/store.ts';
import { MULTISEND, ZERO } from '../src/policy.ts';
import type { Address, ChainAdapter, SafeTx } from '../src/types.ts';

const wallet: Address = '0x1111111111111111111111111111111111111111';
const owner: Address = '0x5555555555555555555555555555555555555555';
const guardian: Address = '0x3333333333333333333333333333333333333333';
const baseNumber = 11887593n;
const parentHash = hashMessage('offline Compound base header');
const word = (n: bigint): Hex => toHex(n < 0n ? (1n << 256n) + n : n, { size: 32 });
const tuple = (values: readonly bigint[]): Hex => `0x${values.map(n => word(n).slice(2)).join('')}`;
const safeTx = (to: Address, data: Hex): SafeTx => ({ to, data, value: '0', operation: 0, safeTxGas: '0', baseGas: '0', gasPrice: '0', gasToken: ZERO, refundReceiver: ZERO, nonce: '0' });
function supplyTx(): SafeTx {
  const calls = [
    safeTx(A.usdc, encodeFunctionData({ abi: dappTokenAbi, functionName: 'approve', args: [A.compound, 1_000_000n] })),
    safeTx(A.compound, encodeFunctionData({ abi: compoundAbi, functionName: 'supply', args: [A.usdc, 1_000_000n] })),
    safeTx(A.usdc, encodeFunctionData({ abi: dappTokenAbi, functionName: 'approve', args: [A.compound, 0n] })),
  ];
  const packed = calls.map(c => '00' + c.to.slice(2) + word(0n).slice(2) + word(BigInt((c.data.length - 2) / 2)).slice(2) + c.data.slice(2)).join('');
  return { ...safeTx(MULTISEND, `0x8d80ff0a${word(32n).slice(2)}${word(BigInt(packed.length / 2)).slice(2)}${packed.padEnd(Math.ceil(packed.length / 64) * 64, '0')}`), operation: 1 };
}

// These are literal independent vectors, not modelCompound output. The first
// matches the saved two-node replay; the second advances time by 120 seconds.
const vectors = [
  { time: 1791672132n, credit: 999998n, supplyIndex: 1437657897106916n, borrowIndex: 1534021046802407n, trackingSupply: 74341688474620n, trackingBorrow: 4491953744271944n, utilization: 1002702493131017962n },
  { time: 1791672252n, credit: 999999n, supplyIndex: 1437659456431214n, borrowIndex: 1534022912059683n, trackingSupply: 74341689323124n, trackingBorrow: 4491953833662659n, utilization: 1002702624784164035n },
] as const;
const configuration: Record<string, bigint> = {
  baseScale: 1_000_000n, baseIndexScale: 1_000_000_000_000_000n, factorScale: 1_000_000_000_000_000_000n,
  supplyKink: 850_000_000_000_000_000n, supplyPerSecondInterestRateBase: 0n,
  supplyPerSecondInterestRateSlopeLow: 1_522_070_015n, supplyPerSecondInterestRateSlopeHigh: 50_735_667_174n,
  borrowKink: 850_000_000_000_000_000n, borrowPerSecondInterestRateBase: 475_646_879n,
  borrowPerSecondInterestRateSlopeLow: 1_680_618_975n, borrowPerSecondInterestRateSlopeHigh: 53_906_646_372n,
  baseTrackingSupplySpeed: 11_574_074_074n, baseTrackingBorrowSpeed: 1_145_833_333_333n,
  baseMinForRewards: 100_000_000n, trackingIndexScale: 1_000_000_000_000_000n,
};

// Public fixed-block code preimages captured by the parent, checked against
// every production pin before writing this offline fixture. No hash or simulator mocks.
const corpus = JSON.parse(readFileSync(new URL('./fixtures/sepolia-dapp-code.json', import.meta.url), 'utf8'));
assert.equal(corpus.chainId, 11155111);
assert.equal(corpus.blockNumber, '11887593');
const pinnedRuntime: Readonly<Record<string, Hex>> = corpus.codes;
const missingRuntime = DAPP_CODE_PINS.flatMap(pin => [pin, ...(pin.slots ?? []).filter(slot => slot.codeHash)]).filter(pin => !pinnedRuntime[pin.address.toLowerCase()]);
assert.equal(missingRuntime.length, 0, 'Reviewed pinned code corpus must be complete; never skip acceptance cases');
const corpusBlocker = false;

type Fault = 'none' | 'wrong-chain' | 'missing-extension' | 'wrong-extension' | 'missing-main' | 'wrong-main' | 'wrong-extension-config' | 'wrong-config' | 'credit+1' | 'missing-event' | 'reorg';
function fixture() {
  const events: string[] = [];
  let phase = 'preview', fault: Fault = 'none', vector: (typeof vectors)[number] = vectors[0], signValid = true, preflightFails = false;
  const capture = (name: string) => events.push(`${phase}:${name}`);
  const sameBlock = (n: bigint) => assert.equal(n, baseNumber, 'every code/storage/config/header read uses explicit base block');
  const log = (target: Address, name: string, from: Address, to: Address, amount: bigint) => ({ address: target, topics: [keccak256(toHex(`${name}(address,address,uint256)`)), word(BigInt(from)), word(BigInt(to))], data: word(amount) });
  const ok = (returnData: Hex, logs: ReturnType<typeof log>[] = []) => ({ status: '0x1' as const, returnData, logs });
  function evidence() {
    const probes = simulationProbes(wallet, 'supply');
    assert.equal(probes.length, 14, 'frozen extended plan remains 14 before / 3 actions / 14 after');
    function getter(key: string, after: boolean) {
      if (key === 'usdc') return word(after ? 0n : 1_000_000n);
      if (key === 'position') return word(after ? vector.credit + (fault === 'credit+1' ? 1n : 0n) : 0n);
      if (key === 'userBasic') return tuple(after ? [695575n, vector.trackingSupply, 0n, 0n, 0n] : [0n, 0n, 0n, 0n, 0n]);
      if (key === 'totalsBasic') return tuple(after ? [vector.supplyIndex, vector.borrowIndex, vector.trackingSupply, vector.trackingBorrow, 1636869111331n, 1538191064853n, vector.time, 0n] : [1437404818773468n, 1533718315546426n, 74341550762472n, 4491939236158804n, 1636868415756n, 1538191064853n, 1791652656n, 0n]);
      if (key === 'getUtilization') return word(after ? vector.utilization : 1002681548101469396n);
      if (key === 'getSupplyRate') return word(9040159720n);
      if (key in configuration) return word(configuration[key]);
      assert.ok(['eurc', 'borrow'].includes(key) || key.includes(':'), `unexpected named probe ${key}`);
      return word(0n);
    }
    const actionLogs = [log(A.usdc, 'Transfer', wallet, A.compound, 1_000_000n), log(A.compound, 'Supply', wallet, wallet, 1_000_000n), log(A.compound, 'Transfer', ZERO, wallet, vector.credit)];
    if (fault === 'missing-event') actionLogs.pop();
    return [{ number: toHex(baseNumber + 1n), timestamp: toHex(vector.time), parentHash, calls: [
      ...probes.map(p => ok(getter(p.key, false))),
      ok(word(1n), [log(A.usdc, 'Approval', wallet, A.compound, 1_000_000n)]), ok('0x', actionLogs), ok(word(1n), [log(A.usdc, 'Approval', wallet, A.compound, 0n)]),
      ...probes.map(p => ok(getter(p.key, true))),
    ] }];
  }
  let headerReads = 0;
  const client = {
    getChainId: async () => { capture('chain-id'); return fault === 'wrong-chain' ? 1 : 11155111; },
    getBlockNumber: async ({ cacheTime }: { cacheTime: number }) => { assert.equal(cacheTime, 0); capture('base-number'); headerReads = 0; return baseNumber; },
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => { sameBlock(blockNumber); capture('header'); return { number: baseNumber, hash: fault === 'reorg' && headerReads++ > 0 ? hashMessage('reorg') : parentHash, timestamp: vector.time - 12n }; },
    getCode: async ({ address, blockNumber }: { address: Address; blockNumber: bigint }) => {
      sameBlock(blockNumber); capture(`code:${address.toLowerCase()}`);
      if (address.toLowerCase() === COMPOUND_EXTENSION.toLowerCase() && fault === 'wrong-extension') return '0x00';
      if (address.toLowerCase() === A.compound.toLowerCase() && fault === 'wrong-main') return '0x00';
      if (address.toLowerCase() === COMPOUND_EXTENSION.toLowerCase() && fault === 'missing-extension' || address.toLowerCase() === A.compound.toLowerCase() && fault === 'missing-main') return '0x';
      return pinnedRuntime[address.toLowerCase()] ?? '0x';
    },
    getStorageAt: async ({ address, slot, blockNumber }: { address: Address; slot: Hex; blockNumber: bigint }) => { sameBlock(blockNumber); capture('storage'); const expected = DAPP_CODE_PINS.find(p => p.address.toLowerCase() === address.toLowerCase())?.slots?.find(p => p.slot === slot); assert.ok(expected); return word(BigInt(expected.address)); },
    call: async ({ to, data, blockNumber }: { to: Address; data: Hex; blockNumber: bigint }) => {
      sameBlock(blockNumber); assert.equal(to, A.compound); const { functionName } = decodeFunctionData({ abi: compoundAbi, data }); capture(`config:${functionName}`);
      if (functionName === 'extensionDelegate') return { data: word(BigInt(fault === 'wrong-extension-config' ? owner : COMPOUND_EXTENSION)) };
      if (functionName === 'baseToken') return { data: word(BigInt(A.usdc)) };
      assert.ok(functionName in configuration); return { data: word(configuration[functionName] + (fault === 'wrong-config' ? 1n : 0n)) };
    },
    readContract: async () => { assert.fail('Compound must not invoke a swap quote'); },
    request: async ({ method, params }: { method: string; params: [{ blockStateCalls: { calls: { from: Address; to: Address; data: Hex; value: Hex }[] }[]; validation: boolean; traceTransfers: boolean }, Hex] }) => {
      capture('effects-rpc'); assert.equal(method, 'eth_simulateV1'); assert.equal(params[1], toHex(baseNumber)); assert.equal(params[0].validation, false); assert.equal(params[0].traceTransfers, true);
      assert.deepEqual(Object.keys(params[0].blockStateCalls[0]), ['calls'], 'no state overrides');
      const calls = params[0].blockStateCalls[0].calls; assert.equal(calls.length, 31);
      for (const c of calls) { assert.equal(c.from, wallet); assert.equal(c.value, '0x0'); }
      const probes = simulationProbes(wallet, 'supply'); for (const offset of [0, 17]) probes.forEach((p, i) => { assert.equal(calls[offset + i].to, p.target); assert.equal(calls[offset + i].data, p.data); });
      return evidence();
    },
  } as unknown as PublicClient;
  const transaction = supplyTx();
  const chain: ChainAdapter = {
    chainId: 11155111, registrationBlock: async () => { capture('registration-block'); return baseNumber; }, computeWallet: async () => wallet,
    verifyWallet: async (_setup, options) => { assert.equal(options?.expectedCurrentOwner, owner); assert.equal(options?.blockNumber, baseNumber); capture('registration-rules'); return true; },
    verifyOwnership: async (_wallet, _message, signature, options) => { assert.equal(signature, '0x11'); assert.equal(options?.blockNumber, baseNumber); capture('registration-proof'); return true; },
    safeTxHash: async () => hashMessage('offline Compound signed calls'), safeNonce: async () => '0', verifyOwnerSignature: async () => { capture('owner-signature'); return signValid; },
    recoveryHash: async () => hashMessage('unused'), isGuardian: async () => false, signRecovery: async () => { throw new Error('unused'); },
    simulate: async operation => { capture('signed-safe-preflight'); assert.equal(operation.kind, 'safe-tx'); if (operation.kind === 'safe-tx') { assert.equal(operation.wallet, wallet); assert.equal(operation.signature, '0x11'); assert.deepEqual(operation.tx, { ...transaction, to: transaction.to.toLowerCase(), data: transaction.data.toLowerCase(), gasToken: ZERO.toLowerCase(), refundReceiver: ZERO.toLowerCase() }); } if (preflightFails) throw new Error('MOCK GS026'); },
    estimateGas: async () => { capture('estimate'); return 100n; }, send: async () => { capture('send'); return hashMessage('MOCK local send only'); },
    receiptStatus: async () => { capture('receipt'); return { status: 'confirmed', blockNumber: '11887594' }; },
  };
  const app = createApp({ databasePath: ':memory:', chain, simulationClients: [client], allowMock: true, features: ['strictSponsorship'], screeningSources: [{ label: 'MOCK offline screening', required: true, mock: true, check: async () => ({ hits: [] }) }] });
  app.store.put('user', 'fixture-user', { id: 'fixture-user', email: 'fixture@example.com', password: 'unused', kyc: true, resetAt: null, balance: '1000000', guardian });
  app.store.put('session', digest('fixture-session'), { userId: 'fixture-user', method: 'password', expires: Number.MAX_SAFE_INTEGER });
  async function call(path: string, body?: unknown) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as IncomingMessage;
    Object.assign(req, { method: body === undefined ? 'GET' : 'POST', url: path, headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-session' }, socket: { remoteAddress: 'fixture' } });
    let output = ''; const res = { statusCode: 0, setHeader: () => {}, end: (data: string) => { output = data; } } as unknown as ServerResponse;
    await app.handler(req, res); return { status: res.statusCode, body: JSON.parse(output) as Record<string, unknown> };
  }
  async function register() {
    const challenge = await call('/wallets/challenge', { wallet }); assert.equal(challenge.status, 200);
    const registration = await call('/wallets', { chainId: 11155111, wallet, owner, expectedCurrentOwner: owner, cardGuardian: '0x6666666666666666666666666666666666666666', partnerGuardian: '0x7777777777777777777777777777777777777777', sqGuardian: guardian, saltNonce: '1', nonce: challenge.body.nonce, signature: '0x11' });
    assert.equal(registration.status, 200, JSON.stringify(registration.body)); assert.equal(registration.body.owner, owner); events.length = 0;
  }
  const preview = () => call('/dapps/preview', { chainId: 11155111, wallet, tx: transaction, dappId: 'compound' });
  const relay = (effectsHash: unknown) => call('/relay/safe-tx', { chainId: 11155111, wallet, tx: transaction, dappId: 'compound', source: 'dapp', signature: '0x11', effectsHash });
  return { app, call, register, preview, relay, events, setPhase: (v: string) => { phase = v; }, setFault: (v: Fault) => { fault = v; }, setDrift: () => { vector = vectors[1]; }, setSignValid: (v: boolean) => { signValid = v; }, setPreflightFails: () => { preflightFails = true; } };
}

for (const fault of ['wrong-chain', 'missing-extension', 'wrong-extension'] as const) test(`real strict App ${fault} refuses preview and relay with zero mock sends`, async () => {
  const f = fixture(); try { await f.register(); f.setFault(fault); const preview = await f.preview(); assert.equal(preview.status, 403); assert.equal(preview.body.code, 'NOT_SPONSORED'); f.setPhase('relay'); const relay = await f.relay(hashMessage('unaccepted effects')); assert.equal(relay.status, 403, JSON.stringify({ body: relay.body, events: f.events })); assert.equal(relay.body.code, 'NOT_SPONSORED'); assert.ok(f.events.includes('relay:owner-signature')); assert.ok(f.events.includes('relay:signed-safe-preflight')); assert.ok(f.events.includes('relay:chain-id')); assert.ok(!f.events.some(e => e.endsWith(':send'))); assert.equal(f.app.store.get('sender-latch', '11155111:global'), undefined); } finally { await f.app.close(); }
});

test('independent literal vectors distinguish lawful 999998 and 999999 credit', () => {
  for (const v of vectors) { assert.equal(1_000_000n * 1_000_000_000_000_000n / v.supplyIndex, 695575n); assert.equal(695575n * v.supplyIndex / 1_000_000_000_000_000n, v.credit); }
});

test('real strict App accepts exact 999998 only after fresh checks and signed Safe preflight', { skip: corpusBlocker }, async () => {
  const f = fixture(); try { await f.register(); const preview = await f.preview(); assert.equal(preview.status, 200, JSON.stringify(preview.body)); assert.match(JSON.stringify(preview.body.summary), /0\.999998/); f.setPhase('relay'); const result = await f.relay(preview.body.effectsHash); assert.equal(result.status, 200, JSON.stringify(result.body)); const send = f.events.indexOf('relay:send'); assert.ok(send > 0); for (const name of ['owner-signature', 'signed-safe-preflight', 'estimate', 'chain-id', 'base-number', 'effects-rpc']) assert.ok(f.events.indexOf(`relay:${name}`) < send && f.events.includes(`relay:${name}`)); assert.equal(f.events.filter(e => e === 'relay:header').length, 2); for (const pin of DAPP_CODE_PINS) { assert.ok(f.events.includes(`relay:code:${pin.address.toLowerCase()}`)); for (const slot of pin.slots ?? []) assert.ok(f.events.includes(`relay:code:${slot.address.toLowerCase()}`)); } for (const name of ['extensionDelegate', 'baseToken', ...Object.keys(configuration)]) assert.ok(f.events.includes(`relay:config:${name}`) && f.events.indexOf(`relay:config:${name}`) < send); assert.ok(f.events.includes('relay:storage')); assert.equal(f.events.filter(e => e === 'relay:send').length, 1); assert.ok(f.events.indexOf('relay:receipt') > send); const status = await f.call('/relay/status'); assert.equal(status.body.status, 'idle'); assert.equal(status.body.blocked, false); } finally { await f.app.close(); }
});

for (const fault of ['drift', 'missing-extension', 'wrong-extension', 'missing-main', 'wrong-main', 'wrong-extension-config', 'wrong-config', 'credit+1', 'missing-event', 'reorg', 'bad-signature', 'preflight-revert'] as const) test(`fresh ${fault} after accepted preview produces zero sends`, { skip: corpusBlocker }, async () => {
  const f = fixture(); try { await f.register(); const preview = await f.preview(); assert.equal(preview.status, 200, JSON.stringify(preview.body)); f.setPhase('relay'); if (fault === 'drift') f.setDrift(); else if (fault === 'bad-signature') f.setSignValid(false); else if (fault === 'preflight-revert') f.setPreflightFails(); else f.setFault(fault); const result = await f.relay(preview.body.effectsHash); assert.notEqual(result.status, 200); if (fault === 'drift') { assert.equal(result.body.code, 'EFFECTS_MISMATCH'); assert.match(String(result.body.error), /observed effects changed since preview/); } assert.ok(!f.events.some(e => e.endsWith(':send'))); assert.equal(f.app.store.get('sender-latch', '11155111:global'), undefined); assert.equal(f.app.store.get('safe-submission', `${wallet}:0`), undefined); } finally { await f.app.close(); }
});
