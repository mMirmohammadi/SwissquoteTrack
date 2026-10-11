import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeviceRecord } from '../src/storage';
import { hasIndependentCheck, independentCheckEvidence } from '../src/independent-check';
const wallet = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const other = '0x3333333333333333333333333333333333333333';
const record: DeviceRecord = { id: 'client', wallet, owner, setupCode: 'original-public-setup', cardGuardian: other, createdAt: 'now', envelope: {} as DeviceRecord['envelope'] };

test('manual acknowledgement survives serialization only for its wallet, owner, network and setup', () => {
  const saved: DeviceRecord = JSON.parse(JSON.stringify({ ...record, ...independentCheckEvidence(record, 11155111, true) }));
  assert.equal(hasIndependentCheck(saved, wallet, 11155111), true);
  assert.equal(hasIndependentCheck(saved, other, 11155111), false);
  assert.equal(hasIndependentCheck(saved, wallet, 31337), false);
  const changes: Partial<DeviceRecord>[] = [{ owner: other }, { wallet: other }, { setupCode: 'new-setup' }, { cardGuardian: owner }];
  for (const changed of changes) {
    assert.equal(hasIndependentCheck({ ...saved, ...changed }, wallet, 11155111), false);
  }
  assert.equal(hasIndependentCheck({ ...saved, ...independentCheckEvidence(saved, 11155111, false) }, wallet, 11155111), false);
});

test('missing and legacy unscoped timestamps never invent a scoped acknowledgement', () => {
  assert.equal(hasIndependentCheck(undefined, wallet, 11155111), false);
  assert.equal(hasIndependentCheck({ ...record, independentCheckedAt: '2026-10-11' }, wallet, 11155111), false);
  assert.throws(() => independentCheckEvidence({ ...record, wallet: undefined }, 11155111, true), /Create or recover/);
});
