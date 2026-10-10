import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryPartnerStore, SqlitePartnerStore, type PartnerRecord } from '../../services/partner/src/storage.ts';

// Synthetic fixture only: not a live key or funded account.
const original: PartnerRecord = {userRef:'victim-reference',faceDigest:'victim-face-digest',privateKey:`0x${'11'.repeat(32)}`,guardian:'0x1111111111111111111111111111111111111111'};
const replacement: PartnerRecord = {...original,faceDigest:'attacker-face-digest',privateKey:`0x${'22'.repeat(32)}`,guardian:'0x2222222222222222222222222222222222222222'};

for (const [label,create] of [
  ['memory',()=>new MemoryPartnerStore()],
  ['sqlite',()=>new SqlitePartnerStore(':memory:')],
] as const) {
  test(`SEC-STORE-${label}: existing userRef cannot overwrite face or guardian`,t=>{
    const store=create();if('close' in store)t.after(()=>store.close());
    assert.equal(store.insert(original),true);
    assert.equal(store.insert(replacement),false);
    assert.deepEqual(store.get(original.userRef),original);
  });
  test(`SEC-STORE-${label}: read caller cannot mutate stored enrollment`,t=>{
    const store=create();if('close' in store)t.after(()=>store.close());
    store.insert(original);const read=store.get(original.userRef)!;
    read.faceDigest='attacker';read.guardian=replacement.guardian;
    assert.deepEqual(store.get(original.userRef),original);
  });
}
