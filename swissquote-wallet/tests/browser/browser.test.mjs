import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  browserAvailability, probeUrl, toolHtml, walletUrl, toolUrl,
  persistenceSnapshot, containsSecret, virtualAuthenticator,
} from './harness.mjs';

const availability = await browserAvailability();
async function requireBrowser(t) {
  if (availability.ok) return true;
  if (process.env.BROWSER_REQUIRED === '1') assert.fail(availability.reason);
  t.skip(availability.reason); return false;
}
async function requireServer(t, url) {
  if ((await probeUrl(url)).ok) return true;
  if (process.env.BROWSER_REQUIRED === '1') assert.fail(`Required local server unavailable: ${url}`);
  t.skip(`Required local server unavailable: ${url}`); return false;
}
async function browserTask(run) {
  const browser = await availability.playwright.chromium.launch({ executablePath: availability.executable, headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    await run(context, await context.newPage());
  } finally { await browser.close(); }
}

// All inputs below are public test fixtures, never production material.
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const owner = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const passphrase = 'browser-test-passphrase';

test('actual wallet storage encrypts seed, rejects short/wrong passphrases, survives reload without plaintext', async t => {
  if (!await requireBrowser(t) || !await requireServer(t, walletUrl)) return;
  await browserTask(async (_context, page) => {
    await page.goto(walletUrl);
    const result = await page.evaluate(async ({ mnemonic, owner, passphrase }) => {
      const storage = await import('/src/storage.ts');
      let shortRejected = false;
      try { await storage.saveDevice('browser-invalid', mnemonic, 'short', owner); }
      catch { shortRejected = true; }
      const record = await storage.saveDevice('browser-verifier', mnemonic, passphrase, owner);
      let wrongRejected = false;
      try { await storage.unlockDevice(record, 'incorrect-passphrase'); }
      catch { wrongRejected = true; }
      return { shortRejected, wrongRejected, envelope: record.envelope, recovered: await storage.unlockDevice(record, passphrase) === mnemonic };
    }, { mnemonic, owner, passphrase });
    assert.equal(result.shortRejected, true);
    assert.equal(result.wrongRejected, true);
    assert.equal(result.recovered, true);
    assert.equal(containsSecret(result.envelope, [mnemonic, passphrase]), false);
    assert.equal(result.envelope.v, 1);
    assert.deepEqual(result.envelope.kdf, { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 });
    assert.ok(result.envelope.salt && result.envelope.iv && result.envelope.ciphertext);
    assert.equal(containsSecret(await persistenceSnapshot(page), [mnemonic, passphrase]), false);
    await page.reload();
    assert.equal(containsSecret(await persistenceSnapshot(page), [mnemonic, passphrase]), false);
    assert.equal(await page.evaluate(async ({ passphrase, mnemonic }) => {
      const storage = await import('/src/storage.ts');
      return await storage.unlockDevice(await storage.loadDevice('browser-verifier'), passphrase) === mnemonic;
    }, { passphrase, mnemonic }), true);
  });
});

test('Chromium supports a resident verified virtual passkey', async t => {
  if (!await requireBrowser(t) || !await requireServer(t, walletUrl)) return;
  await browserTask(async (context, page) => {
    await page.goto(walletUrl);
    const { cdp, authenticatorId } = await virtualAuthenticator(context, page);
    const result = await page.evaluate(async () => {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credential = await navigator.credentials.create({ publicKey: {
        challenge, rp: { name: 'Browser verifier', id: location.hostname },
        user: { id: new Uint8Array([1, 2, 3]), name: 'browser-verifier', displayName: 'Browser verifier' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, timeout: 10000,
      } });
      const assertion = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: credential.rawId }], userVerification: 'required', timeout: 10000,
      } });
      return { created: credential.type, asserted: assertion.type };
    });
    assert.deepEqual(result, { created: 'public-key', asserted: 'public-key' });
    assert.equal((await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials.length, 1);
  });
});

test('portable recovery HTML creates a card entirely offline without persisting it', async t => {
  if (!await requireBrowser(t)) return;
  try { await access(toolHtml); }
  catch {
    if (process.env.BROWSER_REQUIRED === '1') assert.fail(`Portable HTML unavailable: ${toolHtml}`);
    t.skip(`Portable HTML unavailable: ${toolHtml}`); return;
  }
  const html = await readFile(toolHtml, 'utf8');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\bhref\s*=/i);
  await browserTask(async (context, page) => {
    const requests = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await context.setOffline(true);
    await page.goto(pathToFileURL(toolHtml).href);
    await page.locator('#generate').click();
    const words = (await page.locator('#words li').allTextContents()).join(' ');
    assert.equal(words.trim().split(/\s+/).length, 12);
    assert.equal(requests.length, 0, 'Card generation must not contact app/services/RPC');
    assert.equal(containsSecret(await persistenceSnapshot(page), [words]), false);
    await page.reload();
    assert.equal((await page.locator('body').innerText()).includes(words), false);
  });
});

test('recovery UI rejects malformed setup and request before RPC or approval', async t => {
  if (!await requireBrowser(t) || !await requireServer(t, toolUrl)) return;
  await browserTask(async (_context, page) => {
    await page.goto(toolUrl);
    for (const flow of ['setup', 'request']) {
      const posts = [];
      const listener = request => { if (request.method() === 'POST') posts.push(request.url()); };
      page.on('request', listener);
      await page.locator(`[data-tab="${flow === 'setup' ? 'check' : 'approve'}"]`).click();
      await page.locator(flow === 'setup' ? '#setup' : '#request').fill('invalid!not-a-code');
      await page.locator(flow === 'setup' ? '#check-words' : '#approve-words').fill(mnemonic);
      await page.locator(flow === 'setup' ? '#check-button' : '#review-button').click();
      await page.locator('#status[data-state="error"]').filter({ hasText: /invalid|valid.*code|paste/i }).waitFor();
      assert.equal(posts.length, 0, 'Malformed input must fail before RPC or service access');
      page.off('request', listener);
    }
  });
});
