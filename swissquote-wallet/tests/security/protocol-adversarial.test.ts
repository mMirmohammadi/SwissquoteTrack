import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
// Resolve viem through its owning workspace package, not an undeclared root dependency.
const { toFunctionSelector, encodeFunctionData } = createRequire(new URL('../../packages/protocol/package.json', import.meta.url))('viem');
// Import the real source entry; never replace classification with a test double.
import * as protocol from '../../packages/protocol/src/index.ts';

const wallet = '0x1111111111111111111111111111111111111111' as const;
const recipient = '0x2222222222222222222222222222222222222222' as const;
const unknownToken = '0x3333333333333333333333333333333333333333' as const;
const moduleA = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as const;
const moduleB = '0x38275826E1933303E508433dD5f289315Da2541c' as const;
const callOnly = '0x9641d764fc13c8B624c04430C7356C1C7C8102e2' as const;
const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
// Fixed contract ABI fixtures avoid adding a dependency at the workspace root.
const word = (n: bigint) => n.toString(16).padStart(64,'0');
const addressWord = (address: string) => address.slice(2).padStart(64,'0');
const cancel = toFunctionSelector('cancelRecovery()') as `0x${string}`;
const transfer = (amount: bigint) => `0xa9059cbb${addressWord(recipient)}${word(amount)}` as `0x${string}`;
const approve = (amount: bigint) => `0x095ea7b3${addressWord(recipient)}${word(amount)}` as `0x${string}`;
const classify = (input: Parameters<typeof protocol.makeSafeTx>[0]) => protocol.classifyTransaction(wallet, protocol.makeSafeTx(input));
// encodeMultiSend exports packed bytes; the Safe calls multiSend(bytes), not that raw payload.
const batch = (calls: Parameters<typeof protocol.encodeMultiSend>[0]) => ({to:callOnly, operation:1 as const, data:encodeFunctionData({abi:protocol.multiSendAbi,functionName:'multiSend',args:[protocol.encodeMultiSend(calls)]})});

// A parser rejection and relayAllowed:false both fail closed. Protective must never
// be assigned to malformed input, since services use that class to bypass budgets.
function rejectsRelay(input: Parameters<typeof protocol.makeSafeTx>[0]) {
  let result;
  try { result = classify(input); } catch { return; }
  assert.equal(result.relayAllowed, false, `must refuse: ${JSON.stringify(result)}`);
}

test('SEC-P01 valid two-module cancellation alone is Protective', () => {
  const tx = protocol.buildCancelRecoveryTx(wallet, 0n, [moduleA,moduleB]);
  const result = protocol.classifyTransaction(wallet, tx);
  assert.equal(result.class, 'Protective');
  assert.equal(result.requiresPasskey, false);
  assert.equal(result.relayAllowed, true);
});

test('SEC-P02 cancel selector on arbitrary target cannot bypass budget', () => {
  assert.notEqual(classify({to:recipient,data:cancel}).class, 'Protective');
});

test('SEC-P03 cancel plus transfer inherits Large, not Protective', () => {
  const result = classify(batch([
    {to:moduleA,value:0n,data:cancel,operation:0},
    {to:usdc,value:0n,data:transfer(5_000_001n),operation:0},
  ]));
  assert.notEqual(result.class, 'Protective');
  assert.equal(result.class, 'Large');
  assert.equal(result.requiresPasskey, true);
  assert.equal(result.relayAllowed, true);
});

test('SEC-P04 value-bearing cancel cannot gain Protective exemption', () => {
  assert.notEqual(classify({to:moduleA,value:1n,data:cancel}).class, 'Protective');
  assert.notEqual(classify(batch([{to:moduleA,value:1n,data:cancel,operation:0}])).class, 'Protective');
});

test('SEC-P05 unsupported outer delegatecall is never relayed', () => {
  rejectsRelay({to:recipient,operation:1,data:'0x'});
});

test('SEC-P06 inner delegatecall in CallOnly batch is never relayed', () => {
  rejectsRelay(batch([{to:moduleA,value:0n,data:cancel,operation:1}]));
});

test('SEC-P07 malformed multisend must fail closed', () => {
  for (const data of ['0x','0x8d80ff0a','0x8d80ff0a00', `${protocol.encodeMultiSend([{to:moduleA,value:0n,data:cancel,operation:0}]).slice(0,-64)}`]) {
    rejectsRelay({to:callOnly,operation:1,data:data as `0x${string}`});
  }
});

test('SEC-P08 empty CallOnly batch is not Protective', () => {
  let result;
  try { result = classify(batch([])); } catch { return; }
  assert.notEqual(result.class, 'Protective');
});

test('SEC-P09 unknown-token transfer cannot be Small without step-up', () => {
  const result = classify({to:unknownToken,data:transfer(10n ** 24n)});
  assert.equal(result.class === 'Large' || result.relayAllowed === false, true, JSON.stringify(result));
});

test('SEC-P10 unlimited USDC approval requires passkey', () => {
  const result = classify({to:usdc,data:approve((1n << 256n)-1n)});
  assert.equal(result.class, 'Large');
  assert.equal(result.requiresPasskey, true);
});

test('SEC-P11 zero-value Safe owner administration requires passkey', () => {
  const data = `0xe318b52b${addressWord('0x0000000000000000000000000000000000000001')}${addressWord(recipient)}${addressWord(unknownToken)}` as `0x${string}`;
  const result = classify({to:wallet,data});
  assert.equal(result.class,'Admin');
  assert.equal(result.requiresPasskey,true);
});

test('SEC-P13 genuine administration outranks Large in a valid batch', () => {
  const result = classify(batch([
    {to:wallet,value:0n,data:'0xe318b52b',operation:0},
    {to:usdc,value:0n,data:transfer(5_000_001n),operation:0},
  ]));
  assert.equal(result.class,'Admin');
  assert.equal(result.requiresPasskey,true);
  assert.equal(result.relayAllowed,true);
});

test('SEC-P12 exact USDC boundary is Small; one base unit above requires passkey', () => {
  assert.equal(classify({to:usdc,data:transfer(5_000_000n)}).class,'Small');
  assert.equal(classify({to:usdc,data:transfer(5_000_001n)}).requiresPasskey,true);
});
