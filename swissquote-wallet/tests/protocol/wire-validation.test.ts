import test from 'node:test';
import assert from 'node:assert/strict';
import { safeTxFromWire, safeTxToWire } from '../../packages/protocol/src/api.ts';
import type { SafeTx } from '../../packages/protocol/src/types.ts';

const address = '0x1111111111111111111111111111111111111111' as const;
const tx: SafeTx = { to: address, value: 2n ** 128n, data: '0x', operation: 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: address, refundReceiver: address, nonce: 7n };

test('SafeTx HTTP wire conversion preserves bigint values larger than JS safe integer', () => {
  const wire = safeTxToWire(tx);
  assert.equal(typeof wire.value, 'string');
  assert.deepEqual(safeTxFromWire(JSON.parse(JSON.stringify(wire))), tx);
});

test('SafeTx wire rejects malformed unsigned numbers and operation', () => {
  for (const field of ['value', 'safeTxGas', 'baseGas', 'gasPrice', 'nonce'] as const) {
    for (const value of ['-1', '1.5', '1e9', '0x01', '', '01', 'NaN']) {
      assert.throws(() => safeTxFromWire({ ...safeTxToWire(tx), [field]: value }), `${field}: ${value}`);
    }
  }
  assert.throws(() => safeTxFromWire({ ...safeTxToWire(tx), operation: 2 } as never));
});

for (const field of ['value', 'safeTxGas', 'baseGas', 'gasPrice', 'nonce'] as const) {
  test(`SafeTx wire rejects uint256 overflow: ${field}`, () => {
    assert.throws(() => safeTxFromWire({ ...safeTxToWire(tx), [field]: (2n ** 256n).toString() }), field);
  });
}

for (const field of ['to', 'gasToken', 'refundReceiver'] as const) {
  test(`SafeTx wire rejects malformed address: ${field}`, () => {
    assert.throws(() => safeTxFromWire({ ...safeTxToWire(tx), [field]: '0x1234' } as never), field);
  });
}
for (const data of ['0x1', '0xzz', 'not hex']) {
  test(`SafeTx wire rejects malformed calldata: ${data}`, () => {
    assert.throws(() => safeTxFromWire({ ...safeTxToWire(tx), data } as never), data);
  });
}
