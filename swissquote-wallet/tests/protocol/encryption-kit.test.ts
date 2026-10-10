import test from 'node:test';
import assert from 'node:assert/strict';
import * as protocol from '../../packages/protocol/src/crypto.ts';

// Well-known public BIP39 vector; never use this seed for funds.
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const passphrase = 'a public fixture passphrase';
const wallet = '0x1111111111111111111111111111111111111111' as const;
const metadata = () => ({ wallet, owner: protocol.mnemonicToAddress(mnemonic), chainId: 11155111 });
function mutateBase64(value: string): string {
  const bytes = Buffer.from(value, 'base64');
  bytes[0] ^= 1;
  return bytes.toString('base64url');
}

test('mnemonic derivation is pinned to standard Ethereum BIP44 and rejects invalid BIP39 checksum', () => {
  assert.equal(protocol.mnemonicToAddress(mnemonic).toLowerCase(), '0x9858effd232b4033e47d90003d41ec34ecaeda94');
  assert.throws(() => protocol.mnemonicToPrivateKey(Array(12).fill('abandon').join(' ')));
  assert.equal(protocol.generateOwnerSeed().split(' ').length, 24);
  assert.equal(protocol.generateCardSeed().split(' ').length, 12);
});

test('seed encryption uses specified KDF, random salt/IV, authenticated ciphertext and roundtrips', async () => {
  const one = await protocol.encryptSeed(mnemonic, passphrase);
  const two = await protocol.encryptSeed(mnemonic, passphrase);
  assert.deepEqual(one.kdf, { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 });
  assert.equal(one.v, 1);
  assert.notEqual(one.salt, two.salt);
  assert.notEqual(one.iv, two.iv);
  assert.notEqual(one.ciphertext, two.ciphertext);
  assert.equal(Buffer.from(one.iv, 'base64').length, 12);
  assert.ok(Buffer.from(one.salt, 'base64').length >= 16);
  assert.equal(await protocol.decryptSeed(one, passphrase), mnemonic);
  assert.ok(!JSON.stringify(one).includes(mnemonic));
  await assert.rejects(() => protocol.encryptSeed(mnemonic, 'too short'));
  await assert.rejects(() => protocol.decryptSeed(one, 'wrong fixture passphrase'));
  await assert.rejects(() => protocol.decryptSeed({ ...one, ciphertext: mutateBase64(one.ciphertext) }, passphrase));
  await assert.rejects(() => protocol.decryptSeed({ ...one, iv: mutateBase64(one.iv) }, passphrase));
});

test('KDF/version fields fail closed instead of accepting attacker-selected work factors', async () => {
  const envelope = await protocol.encryptSeed(mnemonic, passphrase);
  for (const modification of [{ v: 2 }, { kdf: { ...envelope.kdf, iterations: 1 } }, { kdf: { ...envelope.kdf, name: 'scrypt' } }, { salt: '' }, { iv: '' }, { ciphertext: '' }]) {
    await assert.rejects(() => protocol.decryptSeed({ ...envelope, ...modification } as never, passphrase));
  }
});

test('kit codes contain 160 bits of base32 entropy plus checksum and detect transcription errors', async () => {
  const code = await protocol.generateKitCode();
  const compact = code.replace(/[-\s]/g, '').toUpperCase();
  assert.match(compact, /^[A-Z2-7]+$/);
  assert.ok(compact.length > 32, '32 entropy characters plus checksum required');
  assert.equal(await protocol.validateKitCode(code), true);
  assert.equal(await protocol.validateKitCode(''), false);
  assert.equal(await protocol.validateKitCode('not a recovery code'), false);
  for (let index = 0; index < compact.length; index++) {
    const replacement = compact[index] === 'A' ? 'B' : 'A';
    assert.equal(await protocol.validateKitCode(compact.slice(0, index) + replacement + compact.slice(index + 1)), false, `single-character corruption at ${index}`);
  }
});

test('kit opens independently from mnemonic and metadata; no secrets leak into kit JSON', async () => {
  const code = await protocol.generateKitCode();
  const kit = await protocol.createKit(mnemonic, code, metadata());
  assert.equal(kit.path, "m/44'/60'/0'/0/0");
  assert.equal(kit.wallet, wallet);
  assert.equal(kit.chainId, 11155111);
  assert.equal(kit.modules.length, 2);
  assert.deepEqual(await protocol.openKit(kit, code), { mnemonic, owner: metadata().owner });
  assert.ok(!JSON.stringify(kit).includes(mnemonic));
  assert.ok(!JSON.stringify(kit).includes(code));
  const wrong = await protocol.generateKitCode();
  await assert.rejects(() => protocol.openKit(kit, wrong), (error: Error) => {
    assert.match(error.message, /code|decrypt|kit|invalid/i);
    assert.ok(!error.message.includes(mnemonic));
    assert.ok(!error.message.includes(wrong));
    return true;
  });
  await assert.rejects(() => protocol.createKit(mnemonic, 'bad-checksum', metadata()));
});

test('kit rejects tampered ciphertext, owner, path, chain and recovery modules', async () => {
  const code = await protocol.generateKitCode();
  const kit = await protocol.createKit(mnemonic, code, metadata());
  for (const modification of [{ ciphertext: mutateBase64(kit.ciphertext) }, { owner: wallet }, { path: "m/44'/60'/0'/0/1" }, { chainId: 1 }, { modules: [wallet] }]) {
    await assert.rejects(() => protocol.openKit({ ...kit, ...modification } as never, code), JSON.stringify(modification));
  }
});
