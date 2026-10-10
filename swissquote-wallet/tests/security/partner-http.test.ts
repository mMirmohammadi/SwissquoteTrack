import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { once } from 'node:events';
import { MemoryPartnerStore } from '../../services/partner/src/storage.ts';
import { createPartnerService, type RecoverySnapshot } from '../../services/partner/src/service.ts';
import { createPartnerServer } from '../../services/partner/src/server.ts';
import { hashRecovery, signRecovery, encodeCode } from '../../packages/protocol/src/index.ts';
import { createRequire } from 'node:module';
const { privateKeyToAccount } = createRequire(new URL('../../packages/protocol/package.json', import.meta.url))('viem/accounts');
// Explicit synthetic unfunded keys; no RPC connection or transaction submission.
const privateKey = `0x${'11'.repeat(32)}` as const;
const attackerKey = `0x${'22'.repeat(32)}` as const;
const guardian = privateKeyToAccount(privateKey).address as `0x${string}`;
const attackerGuardian = privateKeyToAccount(attackerKey).address as `0x${string}`;
const wallet = '0x1111111111111111111111111111111111111111' as const;
const newOwner = '0x2222222222222222222222222222222222222222' as const;
const card = '0x3333333333333333333333333333333333333333' as const;
const moduleA = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as const;
const moduleB = '0x38275826E1933303E508433dD5f289315Da2541c' as const;
const body = { mockFace: 'victim-face', wallet, newOwner, module: moduleA, chainId: 31337, nonce: '0' };
async function fixture(t: TestContext, override: Partial<RecoverySnapshot> = {}, unavailable = false) {
  const store = new MemoryPartnerStore();
  let signed = 0, reads = 0, generated = 0;
  const service = createPartnerService({ store, chainId: 31337, moduleA, chainReader: { readRecovery: async request => {
    reads++;
    assert.deepEqual(request, { wallet, newOwner, module: moduleA, chainId: 31337 });
    if (unavailable) throw new Error('synthetic provider failure');
    return { chainId: 31337, nonce: 0n, guardians: [guardian, card], threshold: 2n, recoveryHash: hashRecovery({ ...request, nonce: 0n }), ...override };
  } }, crypto: {
    generateGuardian: () => ++generated === 1 ? { privateKey, address: guardian } : { privateKey: attackerKey, address: attackerGuardian },
    hashRecovery,
    signRecovery: async (key, request) => { signed++; assert.equal(key, privateKey); return signRecovery(key, request); },
    encodeApproval: (approval, chainId) => encodeCode({ v: 1, kind: 'approval', chainId, ...approval }),
  } });
  const server = createPartnerServer({ service });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const request = async (path: string, value: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { signal: AbortSignal.timeout(5000), method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  const enrollment = await request('/enroll', { mockFace: body.mockFace });
  assert.equal(enrollment.status, 200, JSON.stringify(enrollment));
  assert.deepEqual(enrollment.body, { guardian });
  return { request, store, signed: () => signed, reads: () => reads, generated: () => generated };
}
test('SEC-PARTNER-01 another face cannot overwrite the wallet guardian; original face remains usable', async t => {
  const f = await fixture(t);
  const original = f.store.get(guardian);
  assert.ok(original);
  const separate = await f.request('/enroll', { mockFace: 'attacker-face' });
  assert.equal(separate.status, 200, JSON.stringify(separate));
  assert.deepEqual(separate.body, { guardian: attackerGuardian });
  assert.deepEqual(f.store.get(guardian), original);
  const denied = await f.request('/recovery/approve', { ...body, mockFace: 'attacker-face' });
  assert.equal(denied.status, 403);
  assert.equal(f.signed(), 0);
  assert.deepEqual(f.store.get(guardian), original);
  const valid = await f.request('/enroll', { mockFace: body.mockFace });
  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body, { guardian });
  assert.equal(f.generated(), 2);
  assert.equal((await f.request('/recovery/approve', body)).status, 200);
  assert.equal(f.signed(), 1);
});
test('SEC-PARTNER-02 wrong face refuses after guardian lookup without signing; valid face signs', async t => {
  const f = await fixture(t);
  const denied = await f.request('/recovery/approve', { ...body, mockFace: 'attacker-face' });
  assert.equal(denied.status, 403);
  assert.deepEqual(denied.body, { error: 'MOCK face mismatch' });
  assert.equal(f.signed(), 0);
  // The chain's guardian set selects the enrollment; a request carries no identity selector.
  assert.equal(f.reads(), 1);
  const valid = await f.request('/recovery/approve', body);
  assert.equal(valid.status, 200, JSON.stringify(valid));
  assert.equal(f.signed(), 1);
  assert.equal(f.reads(), 2);
  assert.equal(valid.body.signer, guardian);
  assert.match(String(valid.body.signature), /^0x[0-9a-f]{130}$/i);
  const { mockFace: _mockFace, ...expectedRequest } = body;
  assert.deepEqual(valid.body.request, expectedRequest);
});
for (const [label, change, status, reads] of [
  ['wrong module', { module: moduleB }, 400, 0], ['request chain mismatch', { chainId: 11155111 }, 400, 0], ['stale nonce', { nonce: '1' }, 409, 1],
] as const) {
  test(`SEC-PARTNER request ${label} never signs`, async t => {
    const f = await fixture(t);
    const result = await f.request('/recovery/approve', { ...body, ...change });
    assert.equal(result.status, status, JSON.stringify(result));
    assert.equal(f.signed(), 0);
    assert.equal(f.reads(), reads);
  });
}
for (const [label, override] of [
  ['RPC chain mismatch', { chainId: 11155111 }], ['guardian missing', { guardians: [card, newOwner] }], ['wrong threshold', { threshold: 1n }],
  ['duplicate guardians', { guardians: [guardian, guardian] }], ['hash mismatch', { recoveryHash: `0x${'00'.repeat(32)}` as `0x${string}` }],
] as const) {
  test(`SEC-PARTNER snapshot ${label} never signs`, async t => {
    const f = await fixture(t, override);
    const result = await f.request('/recovery/approve', body);
    assert.equal(result.status, 409, JSON.stringify(result));
    assert.equal(f.signed(), 0);
    assert.equal(f.reads(), 1);
  });
}
test('SEC-PARTNER-03 demo bypass is disabled by default', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/demo/fooled', { enabled: true })).status, 403);
  assert.deepEqual(await f.request('/demo/fooled', { enabled: false }), { status: 200, body: { enabled: false, mock: true } });
  assert.equal((await f.request('/recovery/approve', { ...body, mockFace: 'attacker-face' })).status, 403);
  assert.equal(f.signed(), 0);
});
test('SEC-PARTNER privacy: enrollment rejects legacy identity and guardian selectors', async t => {
  const f = await fixture(t);
  const original = f.store.get(guardian);
  for (const field of ['userRef', 'guardian']) {
    const result = await f.request('/enroll', { mockFace: 'attacker-face', [field]: field === 'guardian' ? guardian : 'victim-reference' });
    assert.equal(result.status, 400, JSON.stringify(result));
    assert.deepEqual(f.store.get(guardian), original);
  }
  assert.equal(f.generated(), 1);
  assert.equal(f.reads(), 0);
  assert.equal(f.signed(), 0);
});
test('SEC-PARTNER privacy: approval rejects identity and caller-selected guardian before lookup', async t => {
  const f = await fixture(t);
  for (const field of ['userRef', 'guardian']) {
    const result = await f.request('/recovery/approve', { ...body, [field]: field === 'guardian' ? guardian : 'victim-reference' });
    assert.equal(result.status, 400, JSON.stringify(result));
  }
  assert.equal(f.reads(), 0);
  assert.equal(f.signed(), 0);
});
test('SEC-PARTNER two enrolled partner guardians cannot authorize a helper-only module', async t => {
  const f = await fixture(t, { guardians: [guardian, attackerGuardian] });
  assert.equal((await f.request('/enroll', { mockFace: 'attacker-face' })).status, 200);
  const result = await f.request('/recovery/approve', body);
  assert.equal(result.status, 409, JSON.stringify(result));
  assert.deepEqual(result.body, { error: 'Required module A must contain exactly one enrolled partner guardian' });
  assert.equal(f.signed(), 0);
});
test('SEC-PARTNER chain lookup failure is sanitized and never signs', async t => {
  const f = await fixture(t, {}, true);
  const result = await f.request('/recovery/approve', body);
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: 'Chain verification unavailable; no approval signed' });
  assert.equal(f.reads(), 1);
  assert.equal(f.signed(), 0);
});
