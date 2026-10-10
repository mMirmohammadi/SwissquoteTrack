import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWords, validateCodeInput, parseJson, pinnedRpcUrls } from '../../apps/recovery-tool/src/validation.ts';

test('actual tool validation refuses links, JSON and oversized copy-paste input', () => {
  for (const input of ['', 'https://attacker.example/setup', '{"v":1}', 'a'.repeat(16001)]) {
    assert.throws(() => validateCodeInput(input));
  }
  assert.equal(validateCodeInput(' YWJjZA '), 'YWJjZA');
});
test('actual tool validation refuses owner seed length and malformed card text', () => {
  assert.throws(() => normalizeWords(Array(24).fill('abandon').join(' ')), /12 recovery-card words/);
  assert.throws(() => normalizeWords(Array(12).fill('123').join(' ')), /12 recovery-card words/);
  assert.equal(normalizeWords(Array(12).fill('ABANDON').join('  ')), Array(12).fill('abandon').join(' '));
  // BIP39 checksum validation belongs to protocol derivation, not this shape validator.
});
test('actual tool validation refuses non-object, malformed and oversized kit JSON', () => {
  for (const input of ['null', '[]', 'broken', 'a'.repeat(100001)]) assert.throws(() => parseJson(input));
  assert.deepEqual(parseJson('{"v":1}'), { v: 1 });
});
test('actual tool RPC configuration pins Sepolia and rejects remote local targets', () => {
  const pinned = ['https://rpc-one.example', 'https://rpc-two.example'];
  assert.deepEqual(pinnedRpcUrls(11155111, 'http://attacker.example', pinned), pinned);
  for (const config of ['http://attacker.example,http://localhost:8545', 'http://localhost:8545,http://localhost:8545', 'http://user:password@localhost:8545,http://127.0.0.1:8545']) {
    assert.throws(() => pinnedRpcUrls(31337, config, pinned));
  }
  assert.throws(() => pinnedRpcUrls(1, undefined, pinned), /Unsupported chain/);
});
