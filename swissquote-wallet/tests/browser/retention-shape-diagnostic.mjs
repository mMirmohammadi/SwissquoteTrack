// Offline Chromium-only diagnostic. Never loads the app, a live state, or credentials.
// Emits field names/types and verdicts only; all payloads are synthetic.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { hasEncryptedDevice, createLiveRetention } from './live-retention.mjs';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const scratch = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !scratch.includes('/AgentsLocal/')) throw new Error('Owned scratch directory required');
const genericFailure = 'Secure local retention failed; further broadcasts are blocked.';
let browser;
const timer = setTimeout(() => { console.error('diagnostic_deadline'); process.exit(1); }, 28000);
// Redact every primitive recursively, including serialization IDs and string payloads.
function shape(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.map(shape);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  return typeof value;
}
function verdict(state, owner) {
  try { return hasEncryptedDevice(state, { owner }) ? 'present' : 'absent'; }
  catch (error) { assert.equal(error.message, genericFailure); return 'generic_failure'; }
}
try {
  const home = join(scratch, 'home'); await mkdir(home);
  browser = await chromium.launch({
    executablePath: '/tmp/sq-playwright/chromium-1248/chrome-linux64/chrome', headless: true,
    timeout: 10000, args: ['--disable-background-networking'],
    env: { PATH: '/usr/bin:/bin', HOME: home, LANG: 'C.UTF-8',
      LD_LIBRARY_PATH: '/tmp/sq-browser-libs/usr/lib/x86_64-linux-gnu',
      XDG_CACHE_HOME: home, XDG_CONFIG_HOME: home, XDG_DATA_HOME: home },
  });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  // Every request is fulfilled in-process, including storageState's own origin page.
  await context.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Synthetic offline diagnostic</title>' }));
  const page = await context.newPage();
  await page.goto('https://synthetic-retention.invalid/', { waitUntil: 'domcontentloaded', timeout: 5000 });
  const owner = `0x${'1'.repeat(40)}`, wallet = `0x${'2'.repeat(40)}`;
  const salt = new Uint8Array(16), iv = new Uint8Array(12);
  const material = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('SYNTHETIC encryption material'), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600000, salt }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('SYNTHETIC non-seed payload'));
  const envelope = { v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 }, salt: Buffer.from(salt).toString('base64url'), iv: Buffer.from(iv).toString('base64url'), ciphertext: Buffer.from(encrypted).toString('base64url') };
  const base = { id: 'SYNTHETIC-device', owner, envelope, createdAt: 'SYNTHETIC-date' };
  const cases = [
    ['wallet_absent', base],
    // Exact saveDevice object literal before deployment: wallet exists but undefined.
    ['wallet_explicit_undefined', { ...base, wallet: undefined }],
    ['wallet_bound', { ...base, wallet }],
  ];
  const result = { playwrightVersion: require('playwright/package.json').version, liveStateRead: false, networkTransport: 'route_fulfill_only', cases: [] };
  for (const [label, record] of cases) {
    await page.evaluate(async record => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('sq-wallet-device-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('keys', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('synthetic_idb_open_failed'));
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite'); const store = tx.objectStore('keys'); store.clear(); store.put(record);
        tx.oncomplete = resolve; tx.onerror = () => reject(new Error('synthetic_idb_write_failed'));
      }); db.close();
    }, record);
    const state = await context.storageState({ indexedDB: true });
    const db = state.origins.flatMap(origin => origin.indexedDB ?? []).find(db => db.name === 'sq-wallet-device-v1');
    assert.ok(db); const store = db.stores.find(store => store.name === 'keys'); assert.equal(store.records.length, 1);
    const exported = store.records[0];
    const directVerdict = verdict(state, owner);
    // Prove snapshot and deploy guard against the actual browser context, not a fake.
    const fixture = join(scratch, label); await mkdir(fixture);
    await writeFile(join(fixture, '.gitignore'), 'swissquote-wallet/.sepolia-runs/\n', { flag: 'wx' });
    const walletCwd = join(fixture, 'swissquote-wallet'); await mkdir(walletCwd);
    const retention = await createLiveRetention({ optIn: 'yes', runId: 'SYNTHETIC', walletCwd });
    let snapshotVerdict, guardVerdict, cleanupSnapshotVerdict;
    try {
      await retention.retainCredentials({ devicePassphrase: 'SYNTHETIC local-only credential', cardWords: Array(12).fill('SYNTHETIC').join(' ') });
      // Run guard first so failure must come from its actual snapshot, not a prior latch.
      try { await retention.guardWrite(context, { owner, deploy: true }); guardVerdict = 'allowed'; }
      catch (error) { assert.equal(error.message, genericFailure); guardVerdict = 'generic_failure'; }
      try { snapshotVerdict = await retention.snapshot(context, { owner, requireDevice: true }) ? 'present' : 'absent'; }
      catch (error) { assert.equal(error.message, genericFailure); snapshotVerdict = 'generic_failure'; }
      try { await retention.snapshot(context, { owner, requireDevice: true }); cleanupSnapshotVerdict = 'present'; }
      catch (error) { assert.equal(error.message, genericFailure); cleanupSnapshotVerdict = 'generic_failure'; }
    } finally { await retention.close(); }
    result.cases.push({ label, inputShape: shape(record), exportedRecordShape: shape(exported), directVerdict, snapshotVerdict, guardVerdict, cleanupSnapshotVerdict });
  }
  const [absent, undefinedCase, bound] = result.cases;
  assert.equal(absent.directVerdict, 'present'); assert.equal(bound.directVerdict, 'present');
  assert.equal(undefinedCase.directVerdict, 'generic_failure');
  assert.ok(Object.hasOwn(undefinedCase.exportedRecordShape, 'valueEncoded'));
  assert.equal(undefinedCase.snapshotVerdict, 'generic_failure');
  assert.equal(undefinedCase.guardVerdict, 'generic_failure');
  assert.equal(undefinedCase.cleanupSnapshotVerdict, 'generic_failure');
  console.log(JSON.stringify(result, null, 2));
  await context.close();
} catch { console.error('diagnostic_failed_without_payload'); process.exitCode = 1; }
finally { await browser?.close(); clearTimeout(timer); }
