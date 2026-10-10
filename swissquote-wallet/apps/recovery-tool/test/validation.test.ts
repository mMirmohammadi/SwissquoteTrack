import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJson, validateCodeInput, normalizeWords, pinnedRpcUrls, sameAddress } from '../src/validation.js';

test('rejects malformed and oversized codes without interpreting links', () => {
  for (const value of ['', '{}', 'https://attacker.invalid/', 'a'.repeat(16001), 'abc+def', '<script>']) assert.throws(() => validateCodeInput(value));
  assert.equal(validateCodeInput(' abc_def-123 '), 'abc_def-123');
});
test('kit input is a bounded JSON object', () => {
  for (const value of ['null','[]','1','"text"','{bad}', ' '.repeat(100001)]) assert.throws(() => parseJson(value));
  assert.deepEqual(parseJson('{"v":1}'), { v: 1 });
});
test('card accepts only 12 words, never a 24-word owner seed', () => {
  assert.equal(normalizeWords(('ABANDON ').repeat(11) + 'ABOUT'), ('abandon ').repeat(11) + 'about');
  for (const words of ['one two', ('abandon ').repeat(24), ('abandon ').repeat(11) + 'ab0ut']) assert.throws(() => normalizeWords(words));
});
test('Sepolia RPCs cannot be replaced by untrusted config', () => {
  const pinned = ['https://a.example','https://b.example'];
  assert.deepEqual(pinnedRpcUrls(11155111, 'https://attacker.invalid', pinned), pinned);
});
test('local RPC configuration rejects remote servers, credentials, duplicate URLs and wrong chain', () => {
  for (const urls of ['http://attacker.invalid,http://localhost:8545','http://u:p@localhost:8545,http://127.0.0.1:8545','http://localhost:8545,http://localhost:8545','https://localhost:8545,http://127.0.0.1:8545']) assert.throws(() => pinnedRpcUrls(31337, urls, []));
  assert.throws(() => pinnedRpcUrls(1, undefined, []));
  assert.equal(pinnedRpcUrls(31337, undefined, []).length, 2);
  assert(sameAddress('0xABc', '0xabc'));
});
