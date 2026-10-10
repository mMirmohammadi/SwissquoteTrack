import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalUrl, containsSecret } from './harness.mjs';

test('test harness refuses non-loopback targets', () => {
  for (const url of ['https://example.com', 'http://example.com', 'file:///tmp/page.html']) {
    assert.throws(() => assertLocalUrl(url), /loopback/);
  }
  assert.equal(assertLocalUrl('http://localhost:5173').port, '5173');
  assert.equal(assertLocalUrl('http://127.0.0.1:5174').port, '5174');
});
test('test harness detects raw secrets in nested persisted records', () => {
  assert.equal(containsSecret({ database: [{ values: { mnemonic: 'test seed words' } }] }, ['test seed words']), true);
  assert.equal(containsSecret({ ciphertext: 'opaque encrypted data' }, ['test seed words']), false);
});
