import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('portable build has inline executable code and CSS, no external assets or secret storage', async () => {
  const html = await readFile(resolve(import.meta.dirname, '../dist/index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert(scripts[0]![1]!.length > 10000);
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  assert(!/<(?:script|link|img|iframe)\b[^>]*(?:src|href)=/i.test(markup));
  assert.match(html, /<style>/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /form-action 'none'/);
  const policy = html.match(/Content-Security-Policy" content="([^"]+)"/)![1]!;
  assert(!policy.includes('*'));
  for (const endpoint of ['http://127.0.0.1:8545', 'http://localhost:8545', 'http://127.0.0.1:8645', 'http://localhost:8645', 'ws://127.0.0.1:5174', 'ws://127.0.0.1:5274', 'https://rpc.sepolia.ethpandaops.io']) assert(policy.includes(endpoint));
  assert.match(html, /Current ownership is unverified/);
  assert.match(html, /MOCK independent publisher/);
  // Viem contains optional CCIP network code; the tool itself has no persistence calls.
  const main = await readFile(resolve(import.meta.dirname, '../src/main.ts'), 'utf8');
  assert(!/localStorage|sessionStorage|indexedDB|innerHTML\s*=/.test(main));
  assert.match(main, /cloneNode/);
  assert.match(main, /node\.textContent = ''/);
});
