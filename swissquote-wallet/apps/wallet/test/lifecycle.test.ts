import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCode, decodeSetupCode, mnemonicToAddress, type WalletResponse } from '@sq/protocol';
import type { Address } from 'viem';
import { creationMetadata, registerDeviceOwnership } from '../src/lifecycle';
import { promoteDevice, loadDevice, type DeviceRecord } from '../src/storage';
const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const owner = mnemonicToAddress(seed);
const wallet = '0x1111111111111111111111111111111111111111' as Address;
const originalOwner = '0x2222222222222222222222222222222222222222' as Address;
const cardGuardian = '0x3333333333333333333333333333333333333333' as Address;
const setupCode = encodeCode({ v: 1, kind: 'setup', chainId: 31337, wallet, owner: originalOwner, partnerGuardian: '0x4444444444444444444444444444444444444444', sqGuardian: '0x5555555555555555555555555555555555555555', saltNonce: '9' });
const record = { id: 'client', wallet, owner, createdAt: 'now', setupCode, cardGuardian, envelope: {} } as DeviceRecord;
const response: WalletResponse = { wallet, owner, clientId: 'client', chainId: 31337, verified: true };

test('current owner registration uses unchanged creation setup and a fresh wallet-bound proof on every retry', async () => {
  const original = globalThis.fetch;
  const registrations: Record<string, unknown>[] = [];
  let challenges = 0;
  try {
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(String(options?.body));
      if (String(url).endsWith('/wallets/challenge')) { assert.equal(body.wallet, wallet); return Response.json({ nonce: `fresh-${++challenges}` }); }
      assert(String(url).endsWith('/wallets')); registrations.push(body); return Response.json(response);
    };
    await registerDeviceOwnership(record, seed, 'client', 'test-session', 31337);
    await registerDeviceOwnership(record, seed, 'client', 'test-session', 31337);
    assert.equal(challenges, 2);
    for (const [index, body] of registrations.entries()) {
      assert.equal(body.setupCode, setupCode); assert.equal(body.expectedCurrentOwner, owner); assert.equal(body.cardGuardian, cardGuardian);
      const proof = body.ownershipProof as { nonce: string; message: string; signature: string };
      assert.equal(proof.nonce, `fresh-${index + 1}`); assert(proof.message.includes(proof.nonce)); assert.match(proof.signature, /^0x[0-9a-f]+$/i);
      assert.equal(decodeSetupCode(String(body.setupCode)).owner, originalOwner);
      assert.equal(JSON.stringify(body).includes(seed), false);
    }
    globalThis.fetch = async (url) => String(url).endsWith('/wallets/challenge') ? Response.json({ nonce: 'fresh-mismatch' }) : Response.json({ ...response, owner: originalOwner });
    await assert.rejects(registerDeviceOwnership(record, seed, 'client', 'test-session', 31337), /did not verify this current owner/);
  } finally { globalThis.fetch = original; }
});
test('fresh-device creation metadata stays wallet-bound and never replaces local original setup', () => {
  const pending = { ...record, setupCode: undefined, cardGuardian: undefined };
  assert.deepEqual(creationMetadata(pending, { ...response, setupCode, cardGuardian }), { setupCode, cardGuardian });
  assert.deepEqual(creationMetadata(record, { ...response, setupCode: 'malicious replacement', cardGuardian: owner }), { setupCode, cardGuardian });
  assert.throws(() => creationMetadata(pending, response), /unavailable/);
  assert.throws(() => creationMetadata(pending, { ...response, wallet: originalOwner, setupCode, cardGuardian }), /another wallet/);
});

// Minimal asynchronous IndexedDB double; regression checks execute storage code, not source regexes.
function indexedDbDouble(rows: Map<string, DeviceRecord>): IDBFactory {
  return { open: () => {
    const request: Record<string, unknown> = {};
    queueMicrotask(() => {
      request.result = { close() {}, transaction() {
        const tx: Record<string, unknown> = {};
        const store = {
          get(id: string) { const result = { result: rows.get(id) }; queueMicrotask(() => (tx.oncomplete as (() => void))?.()); return result; },
          put(value: DeviceRecord) { rows.set(value.id, structuredClone(value)); return { result: value.id }; },
          delete(id: string) { rows.delete(id); return { result: undefined }; },
        };
        tx.objectStore = () => store;
        queueMicrotask(() => (tx.oncomplete as (() => void))?.());
        return tx;
      } };
      (request.onsuccess as (() => void))();
    });
    return request;
  } } as unknown as IDBFactory;
}
test('replacement promotion retains original setup/card and saved ciphertext, including fresh-device recovery', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const rows = new Map<string, DeviceRecord>();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDbDouble(rows) });
  try {
    rows.set('client', { ...record, owner: originalOwner });
    rows.set('pending', { ...record, id: 'pending', setupCode: undefined, cardGuardian: undefined, envelope: { ciphertext: 'encrypted-new-key' } as DeviceRecord['envelope'] });
    const installed = await promoteDevice('pending', 'client', wallet);
    assert.equal(installed.setupCode, setupCode); assert.equal(installed.cardGuardian, cardGuardian); assert.equal(installed.owner, owner);
    assert.equal(installed.envelope.ciphertext, 'encrypted-new-key'); assert.equal(rows.has('pending'), false);
    assert.deepEqual(await loadDevice('client'), installed);
    rows.delete('client'); rows.set('pending', { ...record, id: 'pending' });
    assert.equal((await promoteDevice('pending', 'client', wallet)).setupCode, setupCode);
    rows.set('pending', { ...record, id: 'pending', wallet: originalOwner });
    await assert.rejects(promoteDevice('pending', 'client', wallet), /another wallet/);
    await assert.rejects(promoteDevice('client', 'client', wallet), /must differ/);
  } finally { if (original) Object.defineProperty(globalThis, 'indexedDB', original); else Reflect.deleteProperty(globalThis, 'indexedDB'); }
});
