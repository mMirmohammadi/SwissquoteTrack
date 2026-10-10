import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createPartnerService, type PartnerCrypto, type RecoverySnapshot } from '../src/service.ts';
import { createPartnerServer } from '../src/server.ts';
import { MemoryPartnerStore, SqlitePartnerStore } from '../src/storage.ts';

const wallet = '0x1111111111111111111111111111111111111111';
const newOwner = '0x2222222222222222222222222222222222222222';
const guardian = '0x3333333333333333333333333333333333333333';
const card = '0x4444444444444444444444444444444444444444';
const moduleA = '0x949d01d424bE050D09C16025dd007CB59b3A8c66';
const hash = `0x${'ab'.repeat(32)}` as const;
const signature = `0x${'12'.repeat(65)}` as const;
const key = `0x${'67'.repeat(32)}` as const; // Explicit synthetic injected test fixture; never a real guardian.
const enroll = { mockFace: 'MOCK client face' };
const approve = { ...enroll, wallet, newOwner, nonce: '7' };
function fixture(allowDemoFooled = false, store = new MemoryPartnerStore()) {
  let signs = 0;
  let snapshot: RecoverySnapshot = { chainId: 31337, nonce: 7n, guardians: [guardian, card], threshold: 2n, recoveryHash: hash };
  let unavailable = false;
  const crypto: PartnerCrypto = { generateGuardian: () => ({ privateKey: key, address: guardian }), hashRecovery: () => hash, signRecovery: async () => { signs++; return { signer: guardian, signature }; }, encodeApproval: () => 'approval-code' };
  const service = createPartnerService({ store, crypto, chainId: 31337, moduleA, allowDemoFooled, chainReader: { readRecovery: async () => { if (unavailable) throw new Error('private provider detail'); return snapshot; } } });
  service.enroll(enroll);
  return { service, signs: () => signs, set: (next: Partial<RecoverySnapshot>) => { snapshot = { ...snapshot, ...next }; }, unavailable: () => { unavailable = true; } };
}
test('enrollment is idempotent, does not expose keys or replace a guardian', () => {
  const f = fixture();
  assert.deepEqual(f.service.enroll(enroll), { guardian });
  assert.throws(() => f.service.enroll({ ...enroll, userRef: 'bank-identity' }), /Unexpected request field/);
  assert.throws(() => f.service.enroll({ ...enroll, privateKey: key }), /Unexpected request field/);
});
test('valid approval matches frozen response and decimal nonce', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.approve(approve), { signer: guardian, signature, approvalCode: 'approval-code', request: { wallet, newOwner, module: moduleA, nonce: '7', chainId: 31337 } });
  assert.equal(f.signs(), 1);
});
test('missing and mismatched MOCK identity never signs', async () => {
  const f = fixture();
  await assert.rejects(f.service.approve({ ...approve, userRef: 'bank-identity' }), /Unexpected request field/);
  await assert.rejects(f.service.approve({ ...approve, mockFace: 'thief' }), /face mismatch/);
  assert.equal(f.signs(), 0);
});
test('stale nonce, chain mismatch, wrong guardian, threshold, duplicate guardians, and hash fail closed', async () => {
  for (const change of [{ nonce: 8n }, { chainId: 11155111 }, { guardians: [newOwner, card] }, { threshold: 1n }, { guardians: [guardian, guardian] }, { recoveryHash: `0x${'cd'.repeat(32)}` as const }]) {
    const f = fixture(); f.set(change);
    await assert.rejects(f.service.approve(approve)); assert.equal(f.signs(), 0);
  }
});
test('malformed payloads, forbidden module and guardian-as-owner are refused', async () => {
  const f = fixture();
  for (const payload of [null, [], { ...approve, wallet: '0x0' }, { ...approve, newOwner: card }, { ...approve, newOwner: guardian }, { ...approve, nonce: '-1' }, { ...approve, nonce: '01' }, { ...approve, nonce: '9'.repeat(79) }, { ...approve, chainId: 11155111 }, { ...approve, module: card }, { ...approve, sqPrivateKey: key }]) await assert.rejects(f.service.approve(payload));
  assert.equal(f.signs(), 0);
});
test('MOCK fooled cannot sign with a mismatched face, even with legacy opt-in', async () => {
  for (const optIn of [false, true]) {
    const f = fixture(optIn);
    assert.equal(f.service.getDemoFooled(), false);
    assert.throws(() => f.service.setDemoFooled({ enabled: true }), /signing disabled/);
    assert.deepEqual(f.service.setDemoFooled({ enabled: false }), { enabled: false, mock: true });
    await assert.rejects(f.service.approve({ ...approve, mockFace: 'thief' }), /face mismatch/);
    assert.equal(f.signs(), 0);
  }
});
test('guardian matching is case-insensitive and ambiguous helper-only module fails closed', async () => {
  const store = new MemoryPartnerStore();
  const f = fixture(false, store);
  assert.equal(store.get(guardian.toUpperCase().replace('0X', '0x') as typeof guardian)?.guardian, guardian);
  store.insert({ faceDigest: 'ab'.repeat(32), privateKey: key, guardian: card });
  await assert.rejects(f.service.approve(approve), /exactly one enrolled partner guardian/);
  assert.equal(f.signs(), 0);
});
test('another face enrollment cannot replace the guardian configured on the wallet', async () => {
  const store = new MemoryPartnerStore();
  const f = fixture(false, store);
  assert.throws(() => f.service.enroll({ mockFace: 'thief' }), /storage unavailable/); // Injected generator repeats an occupied guardian.
  await assert.rejects(f.service.approve({ ...approve, mockFace: 'thief' }), /face mismatch/);
  assert.equal(f.signs(), 0);
});
test('RPC errors are sanitized and never result in signing', async () => {
  const f = fixture(); f.unavailable();
  await assert.rejects(f.service.approve(approve), /Chain verification unavailable/);
  assert.equal(f.signs(), 0);
});
test('independent SQLite stores persist enrollment with restrictive permissions and no raw face', () => {
  const directory = resolve(import.meta.dirname, '../test-artifacts', randomBytes(4).toString('hex'));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = resolve(directory, 'partner.sqlite');
  let store = new SqlitePartnerStore(file);
  assert.equal(store.insert({ faceDigest: 'aa'.repeat(32), guardian, privateKey: key }), true);
  assert.equal(store.insert({ faceDigest: 'aa'.repeat(32), guardian: card, privateKey: key }), false);
  assert.equal(store.insert({ faceDigest: 'bb'.repeat(32), guardian, privateKey: key }), false);
  store.close(); store = new SqlitePartnerStore(file);
  assert.equal(store.get(guardian)?.guardian, guardian);
  const other = new SqlitePartnerStore(':memory:'); assert.equal(other.get(guardian), undefined);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(readFileSync(file).includes(enroll.mockFace), false);
  assert.equal(readFileSync(file).includes('user_ref'), false);
  assert.equal(store.getByFaceDigest('aa'.repeat(32))?.guardian, guardian);
  store.close(); other.close();
});
test('HTTP routes are injectable, CORS restricted, JSON bounded, and errors sanitized', async t => {
  const f = fixture();
  const server = createPartnerServer({ service: f.service, bodyLimit: 512 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const listening = server.address(); assert.ok(listening && typeof listening === 'object');
  const url = `http://127.0.0.1:${listening.port}`;
  const post = (path: string, body: string, headers: Record<string, string> = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  assert.equal((await (await fetch(url + '/health')).json()).mock, true);
  assert.equal((await post('/enroll', JSON.stringify(enroll))).status, 200);
  assert.equal((await post('/recovery/approve', JSON.stringify(approve))).status, 200);
  const mismatch = await post('/recovery/approve', JSON.stringify({ ...approve, mockFace: 'thief' }));
  assert.equal(mismatch.status, 403); assert.deepEqual(await mismatch.json(), { error: 'MOCK face mismatch' });
  assert.equal((await post('/enroll', '{')).status, 400);
  assert.equal((await post('/enroll', ' '.repeat(513))).status, 413);
  assert.equal((await post('/enroll', JSON.stringify(enroll), { Origin: 'https://attacker.invalid' })).status, 403);
  assert.equal((await post('/enroll', JSON.stringify(enroll), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fetch(url + '/unknown')).status, 404);
  const cors = await fetch(url + '/enroll', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
  assert.equal(cors.status, 204); assert.equal(cors.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
});
