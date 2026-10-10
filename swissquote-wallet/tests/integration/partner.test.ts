import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress, verifyTypedData, type Hex, type Address } from 'viem';
import * as p from '../../packages/protocol/src/index.ts';
import { createPartnerService, type RecoverySnapshot } from '../../services/partner/src/service.ts';
import { createPartnerServer } from '../../services/partner/src/server.ts';
import { MemoryPartnerStore } from '../../services/partner/src/storage.ts';

// Actual HTTP server and service + actual EIP-712 crypto with ephemeral test keys;
// injected read-only snapshots isolate policy. No real-chain evidence or RPC calls.
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
  let generated = 0;
  let attackerGuardian: Address;
  const store = new MemoryPartnerStore();
  const crypto = {
    generateGuardian() {
      generated++;
      const privateKey = generated === 1 ? key : generatePrivateKey();
      return { privateKey, address: privateKeyToAccount(privateKey).address };
    },
    hashRecovery: p.hashRecovery,
    async signRecovery(secret: Hex, request: p.RecoveryRequest) { signatures++; return p.signRecovery(secret, request); },
    encodeApproval: (approval: { signer: Address; signature: Hex }, chainId: number) => p.encodeCode({ v: 1, kind: 'approval', chainId, ...approval }),
  };
  const chainReader = { async readRecovery() { if (unavailable) throw new Error('RPC unavailable'); return snapshot; } };
  // Legacy opt-in must not revive fooled signing, even in this explicit local lab.
  const service = createPartnerService({ store, chainId: 31337, moduleA: module, allowDemoFooled: true, chainReader, crypto });
  const server = createPartnerServer({ service });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  async function post(path: string, body: unknown) {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  const enrollment = { mockFace: 'MOCK enrolled face' };
  const payload = { ...enrollment, ...req, nonce: '7' };
  async function refuse(body: unknown, reason: RegExp) {
    const before = signatures;
    const response = await post('/recovery/approve', body);
    assert.ok(response.status >= 400 && response.status < 600);
    assert.match(response.body.error, reason);
    assert.deepEqual(Object.keys(response.body), ['error'], 'refusal exposes no approval, key or identity');
    assert.equal(signatures, before, 'no signature created after refusal');
  }
  await t.test('face enrollment is stable and private; attacker enrollment cannot replace wallet guardian', async () => {
    const first = await post('/enroll', enrollment); assert.equal(first.status, 200);
    assert.deepEqual(first.body, { guardian });
    assert.equal(JSON.stringify(first.body).includes(key), false);
    assert.deepEqual((await post('/enroll', enrollment)).body, { guardian });
    assert.equal(generated, 1, 'same face reuses its enrolled guardian');
    const originalRecord = store.get(guardian);
    const thief = await post('/enroll', { mockFace: 'MOCK thief' });
    assert.equal(thief.status, 200);
    attackerGuardian = thief.body.guardian as Address;
    assert.notEqual(attackerGuardian.toLowerCase(), guardian.toLowerCase());
    assert.deepEqual(thief.body, { guardian: attackerGuardian });
    assert.deepEqual(store.get(guardian), originalRecord, 'attacker cannot overwrite enrolled wallet guardian');
    assert.deepEqual(snapshot.guardians, [card, guardian], 'attacker enrollment cannot change wallet membership');
    assert.deepEqual((await post('/enroll', enrollment)).body, { guardian });
    for (const forbidden of [{ userRef: 'bank-identity' }, { guardian: attackerGuardian }, { wallet }, { privateKey: key }]) {
      const response = await post('/enroll', { ...enrollment, ...forbidden });
      assert.equal(response.status, 400); assert.match(response.body.error, /Unexpected request field/);
      assert.deepEqual(Object.keys(response.body), ['error']);
    }
    assert.equal(generated, 2, 'forbidden enrollment fields cannot generate keys');
  });
  await t.test('wallet guardian selects face verification; valid face signs only exact bound request', async () => {
    await refuse({ ...payload, mockFace: 'MOCK thief' }, /face mismatch/i);
    await refuse({ ...payload, mockFace: 'MOCK never enrolled' }, /face mismatch/i);
    const result = await post('/recovery/approve', payload); assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(result.body).sort(), ['approvalCode', 'request', 'signature', 'signer']);
    assert.deepEqual(result.body.request, { wallet, module, newOwner, nonce: '7', chainId: 31337 });
    assert.equal(result.body.signer, guardian);
    assert.equal(JSON.stringify(result.body).includes(key), false);
    assert.equal((await recoverTypedDataAddress({ ...p.recoveryTypedData(req), signature: result.body.signature as Hex })).toLowerCase(), guardian.toLowerCase());
    const decoded = p.decodeApprovalCode(result.body.approvalCode);
    assert.equal(decoded.signer, guardian); assert.equal(decoded.signature, result.body.signature);
    assert.equal(decoded.chainId, 31337);
    for (const change of [{ wallet: card }, { module: '0x38275826E1933303E508433dD5f289315Da2541c' as Address }, { newOwner: card }, { nonce: 8n }, { chainId: 11155111 }]) {
      assert.equal(await verifyTypedData({ ...p.recoveryTypedData({ ...req, ...change }), address: guardian, signature: result.body.signature as Hex }), false);
    }
    assert.equal(signatures, 1);
  });
  await t.test('nonce/module/chain, guardian membership, hash mismatch and RPC outage all fail closed', async () => {
    await refuse({ ...payload, nonce: '6' }, /Stale recovery nonce/);
    await refuse({ ...payload, module: '0x38275826E1933303E508433dD5f289315Da2541c' }, /module A only/);
    await refuse({ ...payload, chainId: 11155111 }, /chain/);
    for (const nonce of ['-1', '01', (2n ** 256n).toString()]) await refuse({ ...payload, nonce }, /Invalid recovery nonce/);
    const honest = snapshot;
    const cases: [Partial<RecoverySnapshot>, RegExp][] = [
      [{ chainId: 11155111 }, /RPC chain id mismatch/],
      [{ nonce: 8n }, /Stale recovery nonce/],
      [{ nonce: -1n }, /Invalid on-chain recovery nonce/],
      [{ nonce: 2n ** 256n }, /Invalid on-chain recovery nonce/],
      [{ guardians: [card, newOwner] }, /guardian/],
      [{ guardians: [card, attackerGuardian] }, /face mismatch/],
      [{ guardians: [guardian, attackerGuardian] }, /exactly one enrolled partner guardian/],
      [{ guardians: [guardian, guardian] }, /2-of-2/],
      [{ guardians: [guardian] }, /2-of-2/],
      [{ threshold: 1n }, /2-of-2/],
      [{ recoveryHash: `0x${'ff'.repeat(32)}` as Hex }, /hash mismatch/],
    ];
    for (const [change, reason] of cases) { snapshot = { ...honest, ...change }; await refuse(payload, reason); }
    snapshot = honest;
    await refuse({ ...payload, newOwner: guardian }, /cannot be a recovery guardian/);
    await refuse({ ...payload, newOwner: card }, /cannot be a recovery guardian/);
    await refuse({ ...payload, newOwner: wallet }, /must differ from wallet/);
    await refuse({ ...payload, wallet: card }, /hash mismatch/);
    await refuse({ ...payload, newOwner: attackerGuardian }, /hash mismatch/);
    unavailable = true; await refuse(payload, /verification unavailable/); unavailable = false;
    for (const forbidden of [{ userRef: 'bank-identity' }, { guardian: attackerGuardian }, { privateKey: key }]) {
      await refuse({ ...payload, ...forbidden }, /Unexpected request field/);
    }
  });
  await t.test('MOCK fooled signing is disabled globally, including explicit local lab legacy opt-in', async () => {
    const before = signatures;
    const enabled = await post('/demo/fooled', { enabled: true });
    assert.equal(enabled.status, 403); assert.match(enabled.body.error, /fooled signing disabled/i);
    assert.deepEqual(Object.keys(enabled.body), ['error']);
    assert.equal(service.getDemoFooled(), false);
    const disabled = await post('/demo/fooled', { enabled: false });
    assert.equal(disabled.status, 200); assert.deepEqual(disabled.body, { enabled: false, mock: true });
    await refuse({ ...payload, mockFace: 'MOCK thief' }, /face mismatch/i);
    const honest = snapshot;
    snapshot = { ...honest, recoveryHash: `0x${'ff'.repeat(32)}` as Hex };
    await refuse(payload, /hash mismatch/);
    snapshot = honest;
    // Injected Sepolia configuration only: no runtime, RPC, transaction or persistent keys.
    const sepolia = createPartnerService({ store, chainId: 11155111, moduleA: module, allowDemoFooled: true, chainReader, crypto });
    assert.throws(() => sepolia.setDemoFooled({ enabled: true }), /fooled signing disabled/i);
    assert.equal(sepolia.getDemoFooled(), false);
    assert.deepEqual(sepolia.setDemoFooled({ enabled: false }), { enabled: false, mock: true });
    assert.equal(signatures, before, 'fooled controls never create signatures');
    const valid = await post('/recovery/approve', payload);
    assert.equal(valid.status, 200, 'disabled fooled switch does not disable legitimate face approval');
    assert.equal(signatures, before + 1);
  });
});
