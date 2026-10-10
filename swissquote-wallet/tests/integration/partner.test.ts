import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress, type Hex, type Address } from 'viem';
import * as p from '../../packages/protocol/src/index.ts';
import { createPartnerService, type RecoverySnapshot } from '../../services/partner/src/service.ts';
import { createPartnerServer } from '../../services/partner/src/server.ts';
import { MemoryPartnerStore } from '../../services/partner/src/storage.ts';

// Actual HTTP server and service + actual EIP-712 crypto; injected read-only chain
// snapshots isolate fail-closed policy tests. These are not real-chain evidence.
test('independent partner HTTP enrollment, thief refusal and on-chain hash binding', async t => {
  const key = generatePrivateKey();
  const guardian = privateKeyToAccount(key).address;
  const card = privateKeyToAccount(generatePrivateKey()).address;
  const wallet = '0x1111111111111111111111111111111111111111' as Address;
  const newOwner = privateKeyToAccount(generatePrivateKey()).address;
  const module = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as Address;
  const req = { wallet, newOwner, module, chainId: 31337, nonce: 7n };
  let snapshot: RecoverySnapshot = { chainId: 31337, nonce: 7n, guardians: [card, guardian], threshold: 2n, recoveryHash: p.hashRecovery(req) };
  let unavailable = false;
  let signatures = 0;
  const store = new MemoryPartnerStore();
  const service = createPartnerService({ store, chainId: 31337, moduleA: module, allowDemoFooled: true,
    chainReader: { async readRecovery() { if (unavailable) throw new Error('RPC unavailable'); return snapshot; } },
    crypto: {
      generateGuardian: () => ({ privateKey: key, address: guardian }),
      hashRecovery: p.hashRecovery,
      async signRecovery(secret, request) { signatures++; return p.signRecovery(secret, request); },
      encodeApproval: (approval, chainId) => p.encodeCode({ v: 1, kind: 'approval', chainId, ...approval }),
    },
  });
  const server = createPartnerServer({ service });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  async function post(path: string, body: unknown) {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  const enrollment = { userRef: 'opaque-independent-user', mockFace: 'MOCK enrolled face' };
  const payload = { ...enrollment, ...req, nonce: '7' };
  async function refuse(body: unknown, reason: RegExp) {
    const before = signatures;
    const response = await post('/recovery/approve', body);
    assert.ok(response.status >= 400 && response.status < 600);
    assert.match(response.body.error, reason);
    assert.equal(response.body.signature, undefined);
    assert.equal(signatures, before, 'no signature created after refusal');
  }
  await t.test('enrollment is stable, cannot be replaced by thief and never returns private key', async () => {
    const first = await post('/enroll', enrollment); assert.equal(first.status, 200);
    assert.equal(first.body.guardian, guardian); assert.equal(first.body.userRef, enrollment.userRef);
    assert.equal(JSON.stringify(first.body).includes(key), false);
    assert.equal((await post('/enroll', enrollment)).body.guardian, guardian);
    const thief = await post('/enroll', { ...enrollment, mockFace: 'MOCK thief' });
    assert.equal(thief.status, 403); assert.match(thief.body.error, /face mismatch/i);
  });
  await t.test('face mismatch refuses stolen-phone/email attacker; valid face signs exact bound request', async () => {
    await refuse({ ...payload, mockFace: 'MOCK thief' }, /face mismatch/i);
    const result = await post('/recovery/approve', payload); assert.equal(result.status, 200);
    assert.deepEqual(result.body.request, { wallet, module, newOwner, nonce: '7', chainId: 31337 });
    assert.equal((await recoverTypedDataAddress({ ...p.recoveryTypedData(req), signature: result.body.signature as Hex })).toLowerCase(), guardian.toLowerCase());
    const decoded = p.decodeApprovalCode(result.body.approvalCode);
    assert.equal(decoded.signer, guardian); assert.equal(decoded.signature, result.body.signature);
  });
  await t.test('nonce/module/chain, guardian membership, hash mismatch and RPC outage all fail closed', async () => {
    await refuse({ ...payload, nonce: '6' }, /Stale recovery nonce/);
    await refuse({ ...payload, module: '0x38275826E1933303E508433dD5f289315Da2541c' }, /module A only/);
    await refuse({ ...payload, chainId: 11155111 }, /chain/);
    const honest = snapshot;
    snapshot = { ...honest, guardians: [card, newOwner] }; await refuse(payload, /guardian/);
    snapshot = { ...honest, threshold: 1n }; await refuse(payload, /2-of-2/);
    snapshot = { ...honest, recoveryHash: `0x${'ff'.repeat(32)}` as Hex }; await refuse(payload, /hash mismatch/);
    snapshot = honest; unavailable = true; await refuse(payload, /verification unavailable/); unavailable = false;
    await refuse({ ...payload, privateKey: key }, /Unexpected request field/);
  });
  await t.test('MOCK fooled switch bypasses face only, never chain hash checks', async () => {
    assert.equal((await post('/demo/fooled', { enabled: true })).status, 200);
    const fooled = await post('/recovery/approve', { ...payload, mockFace: 'MOCK thief' }); assert.equal(fooled.status, 200);
    snapshot = { ...snapshot, recoveryHash: `0x${'ff'.repeat(32)}` as Hex };
    await refuse({ ...payload, mockFace: 'MOCK thief' }, /hash mismatch/);
  });
});
