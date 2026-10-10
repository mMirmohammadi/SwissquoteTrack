import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, type Address, type Hex, type PublicClient } from 'viem';
import { checkDappBatch, compoundAbi, dappTokenAbi, DAPP_ADDRESSES as A, DAPP_REGISTRY, routerAbi } from '../../packages/protocol/src/dapps.js';
import { effectsFromSimulation, hashSimulationEffects, revalidateSimulation, simulateCalls, validateSwapQuote, verifyDappCode } from '../../packages/protocol/src/simulate.js';
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
const observed = (receivedPosition = 2_000_000n) => [{ number: '0x65', calls: [
  ...[10_000_000n, 0n, 0n, 0n, 0n, 0n, 0n, 0n].map(n => ({ status: '0x1', returnData: scalar(n), logs: [] })),
  { status: '0x1', returnData: scalar(1n), logs: [] }, { status: '0x1', returnData: '0x', logs: [] }, { status: '0x1', returnData: scalar(1n), logs: [] },
  ...[8_000_000n, 0n, receivedPosition, 0n, 0n, 0n, 0n, 0n].map(n => ({ status: '0x1', returnData: scalar(n), logs: [] })),
] }];
test('effects derive from complete observed balances, hash binds exact calls/wallet but not block or description', () => {
  const result = effectsFromSimulation(wallet, supply(), observed(), 100n);
  assert.equal(result.effects[1].amount, '2000000');
  assert.equal(result.blockNumber, '100');
  assert.equal(result.effectsHash, hashSimulationEffects(wallet, supply(), result.effects.map(e => ({ ...e, description: 'different copy' }))));
  assert.notEqual(result.effectsHash, hashSimulationEffects(stranger, supply(), result.effects));
  assert.notEqual(result.effectsHash, hashSimulationEffects(wallet, supply(1n), result.effects));
});
test('simulation refuses missing results, revert, false approval, changed allowance, borrowing or fabricated position', () => {
  assert.throws(() => effectsFromSimulation(wallet, supply(), [], 100n), /incomplete/);
  assert.throws(() => effectsFromSimulation(wallet, supply(), observed(0n), 100n), /Compound effects/);
  for (const [index, value] of [[0, '0x'], [8, scalar(0n)], [10, scalar(0n)], [14, scalar(1n)], [15, scalar(1n)]] as const) {
    const raw = observed(); raw[0].calls[index].returnData = value;
    assert.throws(() => effectsFromSimulation(wallet, supply(), raw, 100n));
  }
  const raw = observed(); raw[0].calls[9].status = '0x0';
  assert.throws(() => effectsFromSimulation(wallet, supply(), raw, 100n), /reverted/);
});
test('withdrawal effects require positive supply position and never create a borrow', () => {
  const probe = (n: bigint) => ({ status: '0x1', returnData: scalar(n), logs: [] });
  const raw = [{ number: '0x65', calls: [...[0n, 0n, 2_000_000n, 0n, 0n, 0n, 0n, 0n].map(probe), { status: '0x1', returnData: '0x', logs: [] }, ...[2_000_000n, 0n, 0n, 0n, 0n, 0n, 0n, 0n].map(probe)] }];
  const result = effectsFromSimulation(wallet, withdraw(), raw, 100n);
  assert.equal(result.effects[0].action, 'receive');
  assert.equal(result.effects[1].amount, '-2000000');
  raw[0].calls[12].returnData = scalar(2_000_000n);
  assert.throws(() => effectsFromSimulation(wallet, withdraw(), raw, 100n), /Borrowing/);
});
test('pins fail closed on missing code and outside-contract events fail closed', async () => {
  await assert.rejects(verifyDappCode({ getCode: async () => '0x' } as unknown as PublicClient, 100n), /Pinned dApp code/);
  const raw = observed();
  raw[0].calls[9].logs = [{ address: stranger, topics: [], data: '0x' }] as never[];
  assert.throws(() => effectsFromSimulation(wallet, supply(), raw, 100n), /event evidence/);
});
test('readonly clients/calls accepted; unavailable nodes never yield fake effects', async () => {
  const clients: readonly PublicClient[] = [{ getChainId: async () => { throw Error('offline'); } } as unknown as PublicClient];
  const calls: readonly MultiSendCall[] = supply();
  await assert.rejects(simulateCalls(clients, wallet, calls), /Simulation unavailable/);
  await assert.rejects(simulateCalls([], wallet, calls), /Simulation unavailable/);
  await assert.rejects(revalidateSimulation(clients, wallet, calls, '0x00'), /Simulation unavailable/);
  await assert.rejects(simulateCalls([{ getChainId: async () => 31337 } as unknown as PublicClient], wallet, calls), /Only Sepolia/);
});
