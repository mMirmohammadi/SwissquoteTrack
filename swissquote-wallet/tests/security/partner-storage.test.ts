import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryPartnerStore, SqlitePartnerStore, type PartnerRecord } from '../../services/partner/src/storage.ts';

// Synthetic fixtures only: not live keys or funded accounts.
const original: PartnerRecord = { faceDigest: 'victim-face-digest', privateKey: `0x${'11'.repeat(32)}`, guardian: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
const replacement: PartnerRecord = { faceDigest: 'attacker-face-digest', privateKey: `0x${'22'.repeat(32)}`, guardian: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' };
const uppercaseGuardian = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as const;

for (const [label, create] of [
  ['memory', () => new MemoryPartnerStore()],
  ['sqlite', () => new SqlitePartnerStore(':memory:')],
] as const) {
  test(`SEC-STORE-${label}: existing guardian cannot overwrite face or key, even with different casing`, t => {
    const store = create();
    if ('close' in store) t.after(() => store.close());
    assert.equal(store.insert(original), true);
    assert.equal(store.insert({ ...replacement, guardian: uppercaseGuardian }), false);
    assert.deepEqual(store.get(original.guardian), original);
    assert.deepEqual(store.get(uppercaseGuardian), original);
    assert.deepEqual(store.getByFaceDigest(original.faceDigest), original);
    assert.equal(store.getByFaceDigest(replacement.faceDigest), undefined);
  });
  test(`SEC-STORE-${label}: read callers cannot mutate either stored enrollment index`, t => {
    const store = create();
    if ('close' in store) t.after(() => store.close());
    assert.equal(store.insert(original), true);
    for (const read of [store.get(original.guardian), store.getByFaceDigest(original.faceDigest)]) {
      assert.ok(read);
      read.faceDigest = replacement.faceDigest;
      read.guardian = replacement.guardian;
      read.privateKey = replacement.privateKey;
      assert.deepEqual(store.get(original.guardian), original);
      assert.deepEqual(store.getByFaceDigest(original.faceDigest), original);
      assert.equal(store.get(replacement.guardian), undefined);
      assert.equal(store.getByFaceDigest(replacement.faceDigest), undefined);
    }
  });
  test(`SEC-STORE-${label}: existing face digest cannot be rebound to another guardian`, t => {
    const store = create();
    if ('close' in store) t.after(() => store.close());
    assert.equal(store.insert(original), true);
    assert.equal(store.insert({ ...replacement, faceDigest: original.faceDigest }), false);
    assert.deepEqual(store.get(original.guardian), original);
    assert.deepEqual(store.getByFaceDigest(original.faceDigest), original);
    assert.equal(store.get(replacement.guardian), undefined);
    // A genuinely separate enrollment is allowed, without replacing the victim.
    assert.equal(store.insert(replacement), true);
    assert.deepEqual(store.get(original.guardian), original);
    assert.deepEqual(store.get(replacement.guardian), replacement);
  });
  test(`SEC-STORE-${label}: insert caller cannot mutate stored enrollment or its indexes`, t => {
    const store = create();
    if ('close' in store) t.after(() => store.close());
    const input = { ...original };
    assert.equal(store.insert(input), true);
    input.faceDigest = replacement.faceDigest;
    input.guardian = replacement.guardian;
    input.privateKey = replacement.privateKey;
    assert.deepEqual(store.get(original.guardian), original);
    assert.deepEqual(store.getByFaceDigest(original.faceDigest), original);
    assert.equal(store.get(replacement.guardian), undefined);
    assert.equal(store.getByFaceDigest(replacement.faceDigest), undefined);
  });
}
