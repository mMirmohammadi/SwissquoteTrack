import test from 'node:test';
import assert from 'node:assert/strict';
import { concatHex, encodeFunctionData, parseAbi, toHex, type Address, type Hex } from 'viem';
import { buildCancelRecoveryTx, decodeMultiSend, encodeMultiSend, makeSafeTx } from '../../packages/protocol/src/wallet.ts';
import { classifyTransaction } from '../../packages/protocol/src/classifier.ts';
import { decodeApprovalCode, decodeCode, decodeRequestCode, decodeSetupCode, encodeCode } from '../../packages/protocol/src/codes.ts';
const protocol = { buildCancelRecoveryTx, decodeMultiSend, encodeMultiSend, makeSafeTx, classifyTransaction, decodeApprovalCode, decodeCode, decodeRequestCode, decodeSetupCode, encodeCode };

const wallet = '0x1111111111111111111111111111111111111111' as Address;
const recipient = '0x2222222222222222222222222222222222222222' as Address;
const A = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as Address;
const B = '0x38275826E1933303E508433dD5f289315Da2541c' as Address;
const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
const msco = '0x9641d764fc13c8B624c04430C7356C1C7C8102e2' as Address;
const tokenAbi = parseAbi(['function transfer(address to,uint256 amount)', 'function approve(address spender,uint256 amount)', 'function transferFrom(address from,address to,uint256 amount)']);
const cancel = encodeFunctionData({ abi: parseAbi(['function cancelRecovery()']), functionName: 'cancelRecovery' });
const base = { v: 1 as const, chainId: 11155111 };
const setupCode = { ...base, kind: 'setup' as const, wallet, owner: recipient, partnerGuardian: A, sqGuardian: B, saltNonce: '7' };
const requestCode = { ...base, kind: 'request' as const, wallet, module: A, newOwner: recipient, nonce: '7' };
const approvalCode = { ...base, kind: 'approval' as const, signer: recipient, signature: `0x${'11'.repeat(65)}` as Hex };
const raw = (object: unknown) => Buffer.from(JSON.stringify(object)).toString('base64url');

for (const code of [setupCode, requestCode, approvalCode]) {
  test(`${code.kind} copy/paste code preserves schema without bigint loss`, () => {
    assert.deepEqual(protocol.decodeCode(protocol.encodeCode(code)), code);
  });
}

test('codes reject malformed transport, JSON and unsupported schema without crashing outside controlled error', () => {
  for (const value of ['', '%%%', 'ey', raw(null), raw([]), raw('text'), raw({}), raw({ ...requestCode, v: 2 }), raw({ ...requestCode, chainId: '11155111' }), raw({ ...requestCode, chainId: -1 }), raw({ ...requestCode, chainId: 1 }), raw({ ...requestCode, kind: 'unknown' })]) {
    assert.throws(() => protocol.decodeCode(value), value);
  }
});

test('request code rejects non-module targets, malformed addresses and non-uint256 nonce strings', () => {
  for (const field of ['wallet', 'module', 'newOwner'] as const) {
    for (const invalid of ['0x1234', 'not-an-address', null, 7]) {
      assert.throws(() => protocol.decodeRequestCode(raw({ ...requestCode, [field]: invalid })), `${field}: ${invalid}`);
    }
  }
  assert.throws(() => protocol.decodeRequestCode(raw({ ...requestCode, module: recipient })));
  for (const nonce of ['-1', '1.5', '0x01', '', 'NaN', '1e6', (2n ** 256n).toString(), 7, null]) {
    assert.throws(() => protocol.decodeRequestCode(raw({ ...requestCode, nonce })), `${nonce}`);
  }
});

for (const field of ['wallet', 'newOwner'] as const) {
  test(`request code rejects unusable zero address: ${field}`, () => {
    assert.throws(() => protocol.decodeRequestCode(raw({ ...requestCode, [field]: '0x0000000000000000000000000000000000000000' })), field);
  });
}
test('request code rejects sentinel replacement owner', () => {
  assert.throws(() => protocol.decodeRequestCode(raw({ ...requestCode, newOwner: '0x0000000000000000000000000000000000000001' })));
});

test('approval code rejects malformed EOA signer and signatures; kind-specific decoders reject wrong kind', () => {
  for (const signature of ['0x', '0x1234', '0xzz', `0x${'11'.repeat(64)}`, null, 4]) {
    assert.throws(() => protocol.decodeApprovalCode(raw({ ...approvalCode, signature })), `${signature}`);
  }
  assert.throws(() => protocol.decodeApprovalCode(raw({ ...approvalCode, signer: '0x1234' })));
  assert.throws(() => protocol.decodeSetupCode(raw(requestCode)));
  assert.throws(() => protocol.decodeRequestCode(raw(approvalCode)));
  assert.throws(() => protocol.decodeApprovalCode(raw(setupCode)));
});

function call(to: Address, data: Hex, value = 0n) { return { operation: 0 as const, to, value, data }; }
function multiSendCalldata(calls: Parameters<typeof protocol.encodeMultiSend>[0]): Hex {
  return encodeFunctionData({ abi: parseAbi(['function multiSend(bytes transactions)']), functionName: 'multiSend', args: [protocol.encodeMultiSend(calls)] });
}
function batch(calls: ReturnType<typeof call>[]) {
  return protocol.makeSafeTx({ to: msco, operation: 1, data: multiSendCalldata(calls) });
}
function token(method: 'transfer' | 'approve', amount: bigint) {
  return encodeFunctionData({ abi: tokenAbi, functionName: method, args: [recipient, amount] });
}

test('protective cancellation targets only known modules with zero value and exact selector', () => {
  for (const module of [A, B]) {
    const result = protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: module, data: cancel }));
    assert.equal(result.class, 'Protective');
    assert.equal(result.requiresPasskey, false);
    assert.equal(result.relayAllowed, true);
    assert.notEqual(protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: module, data: cancel, value: 1n })).class, 'Protective');
    assert.notEqual(protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: module, data: concatHex([cancel, '0x00']) })).class, 'Protective');
  }
  assert.notEqual(protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: recipient, data: cancel })).class, 'Protective');
  assert.equal(protocol.classifyTransaction(wallet, batch([call(A, cancel), call(B, cancel)])).class, 'Protective');
  const built = protocol.buildCancelRecoveryTx(wallet, 2n, [A, B]);
  assert.equal(built.nonce, 2n);
  assert.equal(protocol.classifyTransaction(wallet, built).class, 'Protective');
});

test('self and module calls are admin; all non-whitelisted delegatecalls are denied', () => {
  for (const target of [wallet, A, B]) {
    const result = protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: target }));
    assert.equal(result.class, 'Admin');
    assert.equal(result.requiresPasskey, true);
  }
  for (const target of [wallet, A, B, recipient, usdc]) {
    const result = protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: target, operation: 1 }));
    assert.equal(result.class, 'Admin');
    assert.equal(result.relayAllowed, false);
  }
});

test('USDC transfer/approval limits are strict above 5 USDC, recipients decoded, unlimited approval requires passkey', () => {
  for (const method of ['transfer', 'approve'] as const) {
    for (const amount of [0n, 5_000_000n, 5_000_001n, 2n ** 256n - 1n]) {
      const result = protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: usdc, data: token(method, amount) }));
      assert.equal(result.class, amount > 5_000_000n ? 'Large' : 'Small', `${method}: ${amount}`);
      assert.equal(result.requiresPasskey, amount > 5_000_000n);
      assert.ok(result.recipients.some(address => address.toLowerCase() === recipient.toLowerCase()));
    }
  }
  const data = encodeFunctionData({ abi: tokenAbi, functionName: 'transferFrom', args: [wallet, recipient, 6_000_000n] });
  const result = protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: usdc, data }));
  assert.equal(result.class, 'Large');
  assert.ok(result.recipients.some(address => address.toLowerCase() === recipient.toLowerCase()));
});

test('mixed batches inherit strictest class; cancellation cannot hide payment or admin call', () => {
  assert.equal(protocol.classifyTransaction(wallet, batch([call(A, cancel), call(usdc, token('transfer', 1n))])).class, 'Small');
  assert.equal(protocol.classifyTransaction(wallet, batch([call(usdc, token('transfer', 1n)), call(usdc, token('transfer', 6_000_000n))])).class, 'Large');
  assert.equal(protocol.classifyTransaction(wallet, batch([call(usdc, token('transfer', 6_000_000n)), call(wallet, '0x')])).class, 'Admin');
});

test('nested CALL to MultiSendCallOnly cannot be mistaken for owner-context protective cancellation', () => {
  const inner = multiSendCalldata([call(A, cancel), call(B, cancel)]);
  const result = protocol.classifyTransaction(wallet, batch([call(msco, inner)]));
  // Inner CALL sets msg.sender=MultiSendCallOnly, not wallet: these are NOT protective Safe calls.
  assert.notEqual(result.class, 'Protective');
});

test('malformed, empty and nested forbidden-delegatecall batches fail closed', () => {
  for (const data of ['0x', '0x1234', multiSendCalldata([])] as Hex[]) {
    assert.equal(protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: msco, operation: 1, data })).relayAllowed, false);
  }
  const forbidden = multiSendCalldata([{ ...call(recipient, '0x'), operation: 1 }]);
  assert.equal(protocol.classifyTransaction(wallet, protocol.makeSafeTx({ to: msco, operation: 1, data: forbidden })).relayAllowed, false);
  assert.equal(protocol.classifyTransaction(wallet, batch([call(msco, forbidden)])).relayAllowed, false);
});

test('multisend decoder rejects truncated headers, truncated data and unsupported operation', () => {
  for (const data of ['0x00', concatHex(['0x00', recipient, toHex(0n, { size: 32 }), toHex(10n, { size: 32 }), '0x1234']), concatHex(['0x02', recipient, toHex(0n, { size: 32 }), toHex(0n, { size: 32 })])] as Hex[]) {
    assert.throws(() => protocol.decodeMultiSend(data));
  }
});
