import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, keccak256, toHex, type Address, type Hex, type PublicClient } from 'viem';
import { checkDappBatch, compoundAbi, dappTokenAbi, DAPP_ADDRESSES as A, DAPP_REGISTRY, routerAbi } from '../../packages/protocol/src/dapps.js';
import { effectsFromSimulation, hashSimulationEffects, revalidateSimulation, simulateCalls, simulationProbes, validateSwapQuote, verifyDappCode, type SimCall } from '../../packages/protocol/src/simulate.js';
import { decodeDappBatch } from '../../packages/protocol/src/dapps.js';
import { classifyTransaction } from '../../packages/protocol/src/classifier.js';
import { makeSafeTx, encodeMultiSend } from '../../packages/protocol/src/wallet.js';
import { ADDRESSES } from '../../packages/protocol/src/constants.js';
import type { MultiSendCall } from '../../packages/protocol/src/types.js';
const wallet: Address = '0x1234567890123456789012345678901234567890';
const stranger: Address = '0x2234567890123456789012345678901234567890';
const call = (to: Address, data: Hex): MultiSendCall => ({ to, data, value: 0n, operation: 0 });
const approve = (amount: bigint, spender: Address = A.compound, token: Address = A.usdc) => call(token, encodeFunctionData({ abi: dappTokenAbi, functionName: 'approve', args: [spender, amount] }));
const supply = (amount = 2_000_000n) => [approve(amount), call(A.compound, encodeFunctionData({ abi: compoundAbi, functionName: 'supply', args: [A.usdc, amount] })), approve(0n)];
const withdraw = () => [call(A.compound, encodeFunctionData({ abi: compoundAbi, functionName: 'withdraw', args: [A.usdc, 2_000_000n] }))];
const swap = (patch: Record<string, unknown> = {}, reverse = false) => {
  const p = { tokenIn: reverse ? A.eurc : A.usdc, tokenOut: reverse ? A.usdc : A.eurc, fee: 500, recipient: wallet, amountIn: 1_000_000n, amountOutMinimum: 980_000n, sqrtPriceLimitX96: 0n, ...patch };
  return [approve(p.amountIn, A.uniswap, p.tokenIn), call(A.uniswap, encodeFunctionData({ abi: routerAbi, functionName: 'exactInputSingle', args: [p] })), approve(0n, A.uniswap, p.tokenIn)];
};
test('registry has frozen UI fields and honest third-party warning', () => {
  assert.equal(DAPP_REGISTRY.length, 2);
  assert.match(DAPP_REGISTRY[1].name, /third-party/);
  for (const entry of DAPP_REGISTRY) { assert.equal(entry.chainId, 11155111); assert.match(entry.warning, /Not a bank deposit/); assert.ok(Object.isFrozen(entry)); }
});
test('exact approve/supply/revoke0 and lone supply-only withdrawal accepted', () => {
  assert.equal(checkDappBatch(wallet, supply()).ok, true);
  assert.equal(checkDappBatch(wallet, withdraw()).ok, true);
  assert.equal(checkDappBatch(wallet, swap()).ok, true);
  assert.equal(checkDappBatch(wallet, swap({ amountOutMinimum: 1_100_000n }, true)).ok, true);
});
for (const [name, mutation] of Object.entries({
  'missing reset': (c: MultiSendCall[]) => c.slice(0, 2),
  'missing approval': (c: MultiSendCall[]) => c.slice(1),
  'extra call': (c: MultiSendCall[]) => [...c, c[0]],
  'wrong spender': (c: MultiSendCall[]) => [approve(2_000_000n, stranger), ...c.slice(1)],
  'inexact approval': (c: MultiSendCall[]) => [approve(2_000_001n), ...c.slice(1)],
  'nonzero reset': (c: MultiSendCall[]) => [...c.slice(0, 2), approve(1n)],
  'wrong token': (c: MultiSendCall[]) => [approve(2_000_000n, A.compound, A.eurc), ...c.slice(1)],
  'delegatecall': (c: MultiSendCall[]) => [{ ...c[0], operation: 1 as const }, ...c.slice(1)],
  'value': (c: MultiSendCall[]) => [{ ...c[0], value: 1n }, ...c.slice(1)],
  'trailing bytes': (c: MultiSendCall[]) => [c[0], { ...c[1], data: `${c[1].data}00` as Hex }, c[2]],
  'unknown selector': (c: MultiSendCall[]) => [c[0], call(A.compound, '0x12345678'), c[2]],
})) test(`policy rejects ${name}`, () => assert.equal(checkDappBatch(wallet, mutation(supply())).code, 'NOT_SPONSORED'));
for (const [name, patch] of Object.entries({ recipient: { recipient: stranger }, fee: { fee: 3000 }, price: { sqrtPriceLimitX96: 1n }, cap: { amountIn: 5_000_001n }, zero: { amountIn: 0n }, minimum: { amountOutMinimum: 790_000n }, token: { tokenOut: stranger } })) test(`swap rejects wrong ${name}`, () => assert.equal(checkDappBatch(wallet, swap(patch)).ok, false));
test('fresh quote requires fixed range, 1% floor and reverse USDC cap', () => {
  const action = decodeDappBatch(wallet, swap());
  assert.doesNotThrow(() => validateSwapQuote(action, 986_500n));
  assert.throws(() => validateSwapQuote(action, 1_000_000n), /minus 1%/);
  assert.throws(() => validateSwapQuote(action, 799_999n), /range/);
  assert.throws(() => validateSwapQuote(action, 1_000_001n), /range/);
  const reverse = decodeDappBatch(wallet, swap({ amountIn: 5_000_000n, amountOutMinimum: 6_000_000n }, true));
  assert.throws(() => validateSwapQuote(reverse, 6_000_000n), /equivalent/);
});
test('classifier accepts exact dApp MultiSendCallOnly batch, refuses standalone approval and malformed batch', () => {
  const abi = [{ type: 'function', name: 'multiSend', stateMutability: 'payable', inputs: [{ name: 'transactions', type: 'bytes' }], outputs: [] }] as const;
  const tx = (calls: MultiSendCall[]) => makeSafeTx({ to: ADDRESSES.multiSendCallOnly, operation: 1, data: encodeFunctionData({ abi, functionName: 'multiSend', args: [encodeMultiSend(calls)] }) });
  assert.equal(classifyTransaction(wallet, tx(supply())).relayAllowed, true);
  assert.equal(classifyTransaction(wallet, tx(supply().slice(0, 2))).relayAllowed, false);
  assert.equal(classifyTransaction(wallet, makeSafeTx(approve(1n))).relayAllowed, false);
});
const scalar = (value: bigint) => `0x${value.toString(16).padStart(64, '0')}` as Hex;
const base = { hash: `0x${'ab'.repeat(32)}` as Hex, timestamp: 100n };
const zero: Address = '0x0000000000000000000000000000000000000000';
const tuple = (values: readonly bigint[]) => `0x${values.map(n => scalar(n).slice(2)).join('')}` as Hex;
const probe = (returnData: Hex): SimCall => ({ status: '0x1', returnData, logs: [] });
const event = (address: Address, name: string, from: Address, to: Address, amount: bigint) => ({ address, topics: [keccak256(toHex(`${name}(address,address,uint256)`)), scalar(BigInt(from)), scalar(BigInt(to))], data: scalar(amount) });
const plan = simulationProbes(wallet, 'supply');
const probeIndex = (key: string, after = false, actionCount = 3) => {
  const index = plan.findIndex(p => p.key === key);
  assert.notEqual(index, -1, `Missing named probe ${key}`);
  return index + (after ? plan.length + actionCount : 0);
};
const actionIndex = (offset = 1) => plan.length + offset;
// Hand-derived vector: J=S=1e15, no elapsed time, no aggregate debt.
// Thus B=P, Q=B+A, C=Q; tracking stays zero and mint/burn equals |Q-P|.
// These EXPECTED values do not call the production model.
const observed = (receivedPosition = 2_000_000n, withdrawal = false) => {
  const snapshot = (after: boolean) => {
    const position = withdrawal ? (after ? 0n : 2_000_000n) : (after ? receivedPosition : 0n);
    const usdc = withdrawal ? (after ? 2_000_000n : 0n) : (after ? 8_000_000n : 10_000_000n);
    const values: Record<string, Hex> = {
      usdc: scalar(usdc), eurc: scalar(0n), position: scalar(position), borrow: scalar(0n),
      userBasic: tuple([position, 0n, 0n, 0n, 0n]),
      totalsBasic: tuple([1_000_000_000_000_000n, 1_000_000_000_000_000n, 0n, 0n, position, 0n, 100n, 0n]),
      getUtilization: scalar(0n), baseIndexScale: scalar(1_000_000_000_000_000n),
      factorScale: scalar(1_000_000_000_000_000_000n), getSupplyRate: scalar(9_040_159_720n),
    };
    return plan.map(p => probe(values[p.key] ?? scalar(0n)));
  };
  const action: SimCall = { ...probe('0x'), logs: [
    event(A.usdc, 'Transfer', withdrawal ? A.compound : wallet, withdrawal ? wallet : A.compound, 2_000_000n),
    event(A.compound, withdrawal ? 'Withdraw' : 'Supply', wallet, wallet, 2_000_000n),
    event(A.compound, 'Transfer', withdrawal ? wallet : zero, withdrawal ? zero : wallet, 2_000_000n),
  ] };
  const execution = withdrawal ? [action] : [
    { ...probe(scalar(1n)), logs: [event(A.usdc, 'Approval', wallet, A.compound, 2_000_000n)] }, action,
    { ...probe(scalar(1n)), logs: [event(A.usdc, 'Approval', wallet, A.compound, 0n)] },
  ];
  return [{ number: '0x65', timestamp: '0x64', parentHash: base.hash, calls: [...snapshot(false), ...execution, ...snapshot(true)] }];
};
test('effects derive from complete observed balances, hash binds exact calls/wallet but not block or description', () => {
  const result = effectsFromSimulation(wallet, supply(), observed(), 100n, base);
  assert.equal(result.effects[1].amount, '2000000');
  assert.equal(result.blockNumber, '100');
  assert.equal(result.effectsHash, hashSimulationEffects(wallet, supply(), result.effects.map(e => ({ ...e, description: 'different copy' }))));
  assert.notEqual(result.effectsHash, hashSimulationEffects(stranger, supply(), result.effects));
  assert.notEqual(result.effectsHash, hashSimulationEffects(wallet, supply(1n), result.effects));
});
test('simulation refuses missing results, revert, false approval, changed allowance, borrowing or fabricated position', () => {
  assert.throws(() => effectsFromSimulation(wallet, supply(), [], 100n, base), /incomplete/);
  assert.throws(() => effectsFromSimulation(wallet, supply(), observed(0n), 100n, base), /Compound exact principal\/index\/balance\/tracking mismatch/);
  for (const [index, value] of [[probeIndex('usdc'), '0x'], [actionIndex(0), scalar(0n)], [actionIndex(2), scalar(0n)], [probeIndex(`${A.usdc.toLowerCase()}:${A.compound.toLowerCase()}`, true), scalar(1n)], [probeIndex('borrow', true), scalar(1n)]] as const) {
    const raw = observed(); raw[0].calls[index].returnData = value;
    assert.throws(() => effectsFromSimulation(wallet, supply(), raw, 100n, base));
  }
  const raw = observed(); raw[0].calls[actionIndex()].status = '0x0';
  assert.throws(() => effectsFromSimulation(wallet, supply(), raw, 100n, base), /reverted/);
});
test('withdrawal effects require positive supply position and never create a borrow', () => {
  const raw = observed(2_000_000n, true);
  const result = effectsFromSimulation(wallet, withdraw(), raw, 100n, base);
  assert.equal(result.effects[0].action, 'receive');
  assert.equal(result.effects[1].amount, '-2000000');
  raw[0].calls[probeIndex('borrow', true, 1)].returnData = scalar(2_000_000n);
  assert.throws(() => effectsFromSimulation(wallet, withdraw(), raw, 100n, base), /Borrowing/);
});
test('pins fail closed on missing code and outside-contract events fail closed', async () => {
  await assert.rejects(verifyDappCode({ getCode: async () => '0x' } as unknown as PublicClient, 100n), /Pinned dApp code/);
  const raw = observed();
  raw[0].calls[actionIndex()].logs![0].address = stranger;
  assert.throws(() => effectsFromSimulation(wallet, supply(), raw, 100n, base), /Compound event grammar\/order mismatch/);
});
test('regression: forward/reverse swap observations retain the eight-probe baseline without Compound tuples', () => {
  const baselineKeys = ['usdc', 'eurc', 'position', 'borrow', ...plan.slice(4, 8).map(p => p.key)];
  for (const reverse of [false, true]) {
    assert.deepEqual(simulationProbes(wallet, 'swap').map(p => p.key), baselineKeys);
    const received = reverse ? 1_100_000n : 986_500n;
    const before = [10_000_000n, 10_000_000n, 0n, 0n, 0n, 0n, 0n, 0n];
    const after = [before[0] + (reverse ? received : -1_000_000n), before[1] + (reverse ? -1_000_000n : received), ...before.slice(2)];
    // Deliberately no timestamp, parentHash or extended Compound evidence for swaps.
    const raw = [{ number: '0x65', calls: [...before.map(n => probe(scalar(n))), probe(scalar(1n)), probe(scalar(received)), probe(scalar(1n)), ...after.map(n => probe(scalar(n)))] }];
    const result = effectsFromSimulation(wallet, swap(reverse ? { amountOutMinimum: 1_100_000n } : {}, reverse), raw, 100n);
    assert.equal(raw[0].calls.length, 19);
    assert.equal(result.effects[0].amount, '1000000');
    assert.equal(result.effects[1].amount, String(received));
  }
});
test('regression: exact observed credit and principal mutations reject by one unit', () => {
  for (const offset of [-1n, 1n]) {
    const credit = observed(); credit[0].calls[probeIndex('position', true)].returnData = scalar(2_000_000n + offset);
    assert.throws(() => effectsFromSimulation(wallet, supply(), credit, 100n, base), /Compound exact principal\/index\/balance\/tracking mismatch/);
    const principal = observed(); principal[0].calls[probeIndex('userBasic', true)].returnData = tuple([2_000_000n + offset, 0n, 0n, 0n, 0n]);
    assert.throws(() => effectsFromSimulation(wallet, supply(), principal, 100n, base), /Compound exact principal\/index\/balance\/tracking mismatch/);
  }
});
test('regression: missing, duplicate and diverted Compound event evidence rejects', () => {
  const missing = observed(); missing[0].calls[actionIndex()].logs!.splice(1, 1);
  assert.throws(() => effectsFromSimulation(wallet, supply(), missing, 100n, base), /Compound event cardinality mismatch/);
  const duplicate = observed(); duplicate[0].calls[actionIndex()].logs!.push(duplicate[0].calls[actionIndex()].logs![0]);
  assert.throws(() => effectsFromSimulation(wallet, supply(), duplicate, 100n, base), /Compound event cardinality mismatch/);
  const diverted = observed(); diverted[0].calls[actionIndex()].logs![0].topics[2] = scalar(BigInt(stranger));
  assert.throws(() => effectsFromSimulation(wallet, supply(), diverted, 100n, base), /Compound event grammar\/order mismatch/);
});
test('regression: lawful exact rounding still changes the observed v1 effects hash', () => {
  const exact = effectsFromSimulation(wallet, supply(), observed(), 100n, base);
  const rounded = observed();
  // Hand-derived J=1.5*S: floor(2000000/1.5)=1333333 principal;
  // floor(1333333*1.5)=1999999 credit and mint. Zero elapsed, no debt.
  for (const after of [false, true]) {
    rounded[0].calls[probeIndex('totalsBasic', after)].returnData = tuple([1_500_000_000_000_000n, 1_000_000_000_000_000n, 0n, 0n, after ? 1_333_333n : 0n, 0n, 100n, 0n]);
  }
  rounded[0].calls[probeIndex('userBasic', true)].returnData = tuple([1_333_333n, 0n, 0n, 0n, 0n]);
  rounded[0].calls[probeIndex('position', true)].returnData = scalar(1_999_999n);
  rounded[0].calls[actionIndex()].logs![2].data = scalar(1_999_999n);
  const result = effectsFromSimulation(wallet, supply(), rounded, 100n, base);
  assert.equal(result.effects[1].amount, '1999999');
  assert.notEqual(result.effectsHash, exact.effectsHash);
});
test('readonly clients/calls accepted; unavailable nodes never yield fake effects', async () => {
  const clients: readonly PublicClient[] = [{ getChainId: async () => { throw Error('offline'); } } as unknown as PublicClient];
  const calls: readonly MultiSendCall[] = supply();
  await assert.rejects(simulateCalls(clients, wallet, calls), /Simulation unavailable/);
  await assert.rejects(simulateCalls([], wallet, calls), /Simulation unavailable/);
  await assert.rejects(revalidateSimulation(clients, wallet, calls, '0x00'), /Simulation unavailable/);
  await assert.rejects(simulateCalls([{ getChainId: async () => 31337 } as unknown as PublicClient], wallet, calls), /Only Sepolia/);
});
