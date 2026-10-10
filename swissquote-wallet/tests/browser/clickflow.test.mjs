import test from 'node:test';
import assert from 'node:assert/strict';
import { browserAvailability, walletUrl, toolUrl, toolHtml, assertLocalUrl, virtualAuthenticator, persistenceSnapshot, containsSecret } from './harness.mjs';
import { pathToFileURL } from 'node:url';

// Intentionally separate from mandatory5: requires the already-managed, deployed
// local chain and real SQ/partner services. No request mocks or chain resets.
test('real UI customer, card, wallet, kit, funding and hash-bound passkey payments', { timeout: 180000 }, async t => {
  const available = await browserAvailability();
  assert.equal(available.ok, true, available.reason);
  assertLocalUrl(walletUrl); assertLocalUrl(toolUrl);
  const browser = await available.playwright.chromium.launch({ headless: true, executablePath: available.executable });
  const walletContext = await browser.newContext({ acceptDownloads: true });
  const toolContext = await browser.newContext();
  let stage = 'launch';
  const observed = [];
  const secrets = [];
  let cardWordLeak = false;
  let page;
  try {
    for (const context of [walletContext, toolContext]) await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return route.abort();
      return route.continue();
    });
    page = await walletContext.newPage();
    page.setDefaultTimeout(20000);
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.port === '4001' || url.port === '4002') observed.push({ path: url.pathname, status: response.status() });
    });
    const tool = await toolContext.newPage();
    tool.setDefaultTimeout(20000);
    await virtualAuthenticator(walletContext, page);
    const step = async (name, action) => { stage = name; await action(); t.diagnostic(`PASS: ${name}`); };
    const successful = path => observed.some(item => item.path === path && item.status >= 200 && item.status < 300);
    const idle = async () => { await page.locator('.status.info').waitFor({ state: 'hidden' }); };
    const click = async (name) => {
      await page.getByRole('button', { name }).click(); await idle();
      if (await page.locator('.status.error').count()) throw new Error('UI action refused');
    };
    await step('separate offline card creation', async () => {
      await toolContext.setOffline(true);
      await tool.goto(pathToFileURL(toolHtml).href);
      await tool.locator('#generate').click();
    });
    const words = (await tool.locator('#words li').allTextContents()).join(' ');
    const guardian = await tool.locator('#guardian').innerText();
    secrets.push(words);
    page.on('request', request => {
      const url = new URL(request.url());
      if (['4001', '4002'].includes(url.port) || url.origin === new URL(walletUrl).origin) {
        if (`${request.url()} ${request.postData() || ''}`.includes(words)) cardWordLeak = true;
      }
    });
    await step('customer registration with actual SQ passkey verification', async () => {
      await page.goto(walletUrl);
      await click('New here? Create a login');
      await page.getByLabel('Email address').fill(`browser-${Date.now()}@example.test`);
      await page.getByLabel('Login password').fill('BrowserLogin-verification-2026');
      await click(/Create with a passkey/);
      assert.ok(successful('/auth/password/register'));
      assert.ok(successful('/auth/passkey/register/verify'));
      await page.getByRole('heading', { name: 'Create your self-custody wallet' }).waitFor();
    });
    await step('MOCK KYC and real wallet deployment/ownership', async () => {
      await click('MOCK KYC: mark identity verified');
      await page.getByLabel('Create a device passphrase').fill('BrowserDevice-verification-2026');
      await page.getByLabel('Recovery card public address').fill(guardian);
      await click(/Create my wallet/);
      await page.getByText('Verified as yours', { exact: true }).waitFor();
    });
    const setup = await page.getByLabel('Wallet setup code').inputValue();
    await step('independent card + wallet chain checks on two local endpoints', async () => {
      await toolContext.setOffline(false);
      await tool.goto(toolUrl);
      await tool.locator('[data-tab="check"]').click();
      await tool.locator('#setup').fill(setup);
      await tool.locator('#check-words').fill(words);
      await tool.locator('#check-button').click();
      await tool.locator('#status[data-state="success"]').waitFor();
      assert.match(await tool.locator('#status').innerText(), /Both RPC checks passed/);
      await page.getByRole('checkbox').check();
    });
    await step('actual encrypted kit download and offline opening', async () => {
      await click(/Security & kit/);
      const code = await page.locator('.kit-code strong').innerText(); secrets.push(code);
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: /Download encrypted kit/ }).click();
      const download = await pending;
      const stream = await download.createReadStream(); const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      const kit = JSON.parse(buffer.toString());
      assert.ok(kit && typeof kit === 'object');
      await toolContext.setOffline(true);
      await tool.goto(pathToFileURL(toolHtml).href);
      await tool.locator('[data-tab="kit"]').click();
      await tool.locator('#kit-file').setInputFiles({ name: 'downloaded-kit.json', mimeType: 'application/json', buffer });
      await tool.locator('#kit-code').fill(code);
      await tool.locator('#open-kit').click();
      await tool.locator('#kit-result').waitFor({ state: 'visible' });
      const seed = await tool.locator('#seed').innerText(); secrets.push(seed);
      assert.equal(seed.split(/\s+/).length, 24);
      assert.equal(containsSecret(await persistenceSnapshot(tool), secrets), false);
      assert.equal(containsSecret(await persistenceSnapshot(page), secrets), false);
      await tool.locator('#reset').click();
      await page.getByRole('button', { name: /I saved it/ }).click();
      assert.equal(cardWordLeak, false, 'Card words must not reach the wallet/SQ/partner requests');
    });
    await step('real MOCK account funding with chain receipt', async () => {
      await click(/Overview/);
      await page.getByLabel('Amount in USDC', { exact: true }).fill('20');
      await click(/Move to my wallet/);
      assert.ok(successful('/account/withdraw'));
      await page.getByText('Account transfer', { exact: true }).waitFor();
    });
    for (const [amount, large] of [['1', false], ['6', true]]) await step(large ? 'large send with actual SQ hash-bound step-up verification' : 'small owner-signed send without step-up', async () => {
      const before = observed.filter(item => item.path === '/auth/passkey/step-up/verify').length;
      await page.locator('nav').getByRole('button', { name: /Send money/ }).click();
      await page.getByLabel('Recipient wallet address').fill('0x000000000000000000000000000000000000dEaD');
      await page.getByLabel('Amount in USDC').fill(amount);
      await click(/Review payment/);
      const approval = large ? /Confirm with passkey & send/ : /Sign & send payment/;
      await click(approval);
      assert.ok(successful('/relay/safe-tx'));
      await page.getByText('Payment confirmed on chain.', { exact: true }).waitFor();
      const after = observed.filter(item => item.path === '/auth/passkey/step-up/verify').length;
      assert.equal(after - before, large ? 1 : 0);
      if (large) assert.ok(successful('/auth/passkey/step-up/verify'));
    });
    t.diagnostic('Local-only evidence; virtual authenticator, MOCK identity/account, no live Sepolia or hardware proof.');
  } catch (error) {
    // Never include entered seeds, credentials, kit codes, or request payloads in logs.
    const alerts = page ? await page.locator('.status.error').allTextContents().catch(() => []) : [];
    const notices = page ? await page.locator('.status.success').allTextContents().catch(() => []) : [];
    const redact = text => secrets.reduce((s, secret) => s.replaceAll(secret, '[redacted]'), text);
    const safeAlerts = alerts.map(redact);
    throw new Error(`Clickflow failed at ${stage}. UI alerts: ${safeAlerts.join(' | ') || 'none'}. UI notices: ${notices.map(redact).join(' | ') || 'none'}. Error: ${redact(error.message)}`);
  } finally { await browser.close(); }
});
