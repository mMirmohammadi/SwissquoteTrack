import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalUrl, containsSecret, browserEnvironment, allowedBrowserRequest } from './harness.mjs';
import { spawnSync } from 'node:child_process';

test('test harness refuses non-loopback targets', () => {
  for (const url of ['https://example.com', 'http://example.com', 'file:///tmp/page.html']) {
    assert.throws(() => assertLocalUrl(url), /loopback/);
  }
  assert.equal(assertLocalUrl('http://localhost:5273').port, '5273');
  assert.equal(assertLocalUrl('http://127.0.0.1:5274').port, '5274');
  assert.throws(() => assertLocalUrl('http://user:password@localhost:5273'), /loopback/);
});
test('required and owned v3 browser runs select all five isolated endpoints', () => {
  for (const source of [{ BROWSER_REQUIRED: '1' }, { V3_LOCAL_OWNED_RUN: '/owned-fixture' }]) {
    const urls = browserEnvironment(source);
    assert.deepEqual(Object.values(urls).map(url => Number(new URL(url).port)), [5273, 5274, 4101, 4102, 8645]);
  }
});
test('explicit browser endpoints are honored without permitting isolated legacy attachment', () => {
  const selected = browserEnvironment({ BROWSER_WALLET_URL: 'http://127.0.0.1:5273', BROWSER_RPC_URL: 'http://localhost:8645' });
  assert.equal(selected.wallet, 'http://127.0.0.1:5273');
  assert.equal(selected.rpc, 'http://localhost:8645');
  for (const [name, port] of [['WALLET', 5173], ['TOOL', 5174], ['SQ', 4001], ['PARTNER', 4002], ['RPC', 8545]]) {
    assert.throws(() => browserEnvironment({ BROWSER_REQUIRED: '1', [`BROWSER_${name}_URL`]: `http://localhost:${port}` }), /isolated port/);
  }
});
test('browser network routing refuses external and unselected local stack ports', () => {
  assert.equal(allowedBrowserRequest('https://example.com'), false);
  assert.equal(allowedBrowserRequest('http://localhost:9999'), false);
  assert.equal(allowedBrowserRequest('file:///tmp/offline-tool.html'), true);
  assert.equal(allowedBrowserRequest(browserEnvironment().wallet), true);
});
test('BROWSER_REQUIRED=1 missing browser fails offline rather than skipping', () => {
  const env = { ...process.env, BROWSER_REQUIRED: '1', BROWSER_EXECUTABLE: '/nonexistent/sq-required-browser' };
  delete env.NODE_TEST_CONTEXT; // Nested runner must not inherit the parent's IPC mode.
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'offline-kit.test.mjs'], {
    cwd: new URL('.', import.meta.url), encoding: 'utf8', timeout: 20000,
    env,
  });
  assert.equal(run.error, undefined);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /Chromium executable is unavailable/);
  assert.doesNotMatch(run.stdout, /# SKIP/);
});
test('test harness detects raw secrets in nested persisted records', () => {
  assert.equal(containsSecret({ database: [{ values: { mnemonic: 'test seed words' } }] }, ['test seed words']), true);
  assert.equal(containsSecret({ ciphertext: 'opaque encrypted data' }, ['test seed words']), false);
});
