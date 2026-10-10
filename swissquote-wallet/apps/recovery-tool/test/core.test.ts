import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCard, openEmergencyKit, reviewRecovery, checkWallet } from '../src/core.js';
import { generateKitCode, createKit, mnemonicToAddress, encodeCode, ADDRESSES, LOCAL_CHAIN_ID } from '@sq/protocol';
import type { PublicClient } from 'viem';
const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const config = { chainId: LOCAL_CHAIN_ID };
const address = '0x1111111111111111111111111111111111111111' as const;
const request = encodeCode({ v: 1, kind: 'request', chainId: LOCAL_CHAIN_ID, wallet: address, module: ADDRESSES.moduleA, newOwner: '0x2222222222222222222222222222222222222222', nonce: '0' });
test('card generation derives a valid 12-word guardian', () => {
  const card = createCard(); assert.equal(card.words.split(' ').length, 12); assert.equal(mnemonicToAddress(card.words), card.guardian);
});
test('kit roundtrip offline; ciphertext and authenticated metadata tampering fail', async () => {
  const code = await generateKitCode(); const owner = mnemonicToAddress(words);
  const kit = await createKit(words, code, { wallet: address, owner, chainId: LOCAL_CHAIN_ID });
  assert.deepEqual(await openEmergencyKit(JSON.stringify(kit), code), { mnemonic: words, owner, wallet: address, chainId: LOCAL_CHAIN_ID });
  const badCipher = (kit.ciphertext[0] === 'A' ? 'B' : 'A') + kit.ciphertext.slice(1);
  for (const modified of [{ ...kit, ciphertext: badCipher }, { ...kit, wallet: '0x3333333333333333333333333333333333333333' }, { ...kit, owner: address }, { ...kit, path: 'm/0' }, { ...kit, chainId: 1 }, { ...kit, kdf: { ...kit.kdf, iterations: 1 } }]) {
    await assert.rejects(openEmergencyKit(JSON.stringify(modified), code));
  }
  await assert.rejects(openEmergencyKit(JSON.stringify(kit), 'wrong-code'));
});
test('recovery fails closed with one client, wrong RPC chain or unpinned module bytecode', async () => {
  const client = { getChainId: async () => LOCAL_CHAIN_ID, getCode: async () => '0x00' } as unknown as PublicClient;
  await assert.rejects(reviewRecovery(request, words, config, [client]), /Two RPC/);
  await assert.rejects(reviewRecovery(request, words, config, [client, client]), /distinct clients/);
  await assert.rejects(reviewRecovery(request, words, config, [client, { ...client } as PublicClient]), /pinned contract/);
  const wrong = { getChainId: async () => 1 } as unknown as PublicClient;
  await assert.rejects(reviewRecovery(request, words, config, [wrong, { ...wrong } as PublicClient]), /wrong chain/);
});
test('recovery rejects wrong chain, unknown module and invalid BIP39 before network', async () => {
  const encode = (changes: Record<string, unknown>) => Buffer.from(JSON.stringify({ v: 1, kind: 'request', chainId: LOCAL_CHAIN_ID, wallet: address, module: ADDRESSES.moduleA, newOwner: '0x2222222222222222222222222222222222222222', nonce: '0', ...changes })).toString('base64url');
  await assert.rejects(reviewRecovery(encode({ chainId: 11155111 }), words, config, []), /chain/);
  await assert.rejects(reviewRecovery(encode({ module: address }), words, config, []), /module|Invalid request code/);
  await assert.rejects(reviewRecovery(request, 'abandon '.repeat(12).trim(), config, []), /BIP39/);
});
test('setup refuses an owner seed and malformed codes', async () => {
  await assert.rejects(checkWallet('https://attacker.invalid', words, config, []));
  const setup = encodeCode({ v: 1, kind: 'setup', chainId: LOCAL_CHAIN_ID, wallet: address, owner: address, partnerGuardian: ADDRESSES.moduleA, sqGuardian: ADDRESSES.moduleB, saltNonce: '0' });
  await assert.rejects(checkWallet(setup, 'abandon '.repeat(24), config, []), /12 recovery-card/);
});
