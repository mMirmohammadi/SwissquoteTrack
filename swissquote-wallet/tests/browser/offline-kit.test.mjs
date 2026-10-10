import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Use the protocol package's installed loader: its source uses NodeNext .js
// specifiers that native Node TypeScript stripping cannot map to .ts files.
const protocolRequire = createRequire(new URL('../../packages/protocol/package.json', import.meta.url));
async function loadProtocol() {
  const { tsImport } = await import(protocolRequire.resolve('tsx/esm/api'));
  return tsImport('../../packages/protocol/src/index.ts', import.meta.url);
}
import { browserAvailability, persistenceSnapshot, containsSecret, toolHtml } from './harness.mjs';

test('portable HTML opens a real protocol kit offline and rejects the wrong code without persistence', async t => {
  const availability = await browserAvailability();
  let protocol;
  let blocker = availability.reason;
  if (availability.ok) {
    try {
      await access(toolHtml);
      protocol = await loadProtocol();
    } catch (error) { blocker = `Portable artifact or protocol entry unavailable: ${error.code || error.name}: ${error.message}`; }
  }
  if (!availability.ok || !protocol) {
    if (process.env.BROWSER_REQUIRED === '1') assert.fail(blocker);
    t.skip(blocker); return;
  }
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const owner = protocol.mnemonicToAddress(mnemonic);
  const code = await protocol.generateKitCode();
  const kit = await protocol.createKit(mnemonic, code, { owner, wallet: '0x1111111111111111111111111111111111111111', chainId: 31337 });
  assert.equal(containsSecret(kit, [mnemonic, code]), false);
  const browser = await availability.playwright.chromium.launch({ executablePath: availability.executable, headless: true });
  try {
    const context = await browser.newContext();
    await context.setOffline(true);
    const page = await context.newPage();
    const requests = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(toolHtml).href);
    await page.locator('[data-tab="kit"]').click();
    await page.locator('#kit-file').setInputFiles({ name: 'browser-kit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(kit)) });
    await page.locator('#kit-code').fill('WRONG-CODE');
    await page.locator('#open-kit').click();
    await page.locator('#status[data-state="error"]').waitFor();
    assert.equal(await page.locator('#kit-result').isVisible(), false);
    await page.locator('#kit-code').fill(code);
    await page.locator('#open-kit').click();
    await page.locator('#kit-result').waitFor();
    assert.equal(await page.locator('#seed').innerText(), mnemonic);
    assert.equal((await page.locator('#kit-owner').innerText()).toLowerCase(), owner.toLowerCase());
    assert.equal(containsSecret(await persistenceSnapshot(page), [mnemonic, code]), false);
    assert.deepEqual(requests, []);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#seed').innerText(), '');
    await page.reload();
    assert.equal((await page.locator('body').innerText()).includes(mnemonic), false);
  } finally { await browser.close(); }
});
