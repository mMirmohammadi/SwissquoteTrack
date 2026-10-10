import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { browserAvailability, walletUrl, sqUrl, toolHtml, restrictBrowserNetwork, virtualAuthenticator, persistenceSnapshot, containsSecret } from './harness.mjs';

// Actual UI + owned local services only. No API/RPC fixtures, clock changes,
// screenshots, seed injection or service startup. Feature flags are lead-owned.
async function login(page) {
  await page.goto(walletUrl);
  await page.getByRole('button', { name: 'New here? Create a login' }).click();
  const email = `v3-browser-${crypto.randomUUID()}@example.test`;
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Login password', { exact: true }).fill('V3-browser-login-fixture-2026');
  await page.getByRole('button', { name: 'Create login', exact: true }).click();
  await page.getByRole('heading', { name: 'Create your self-custody wallet' }).waitFor();
  return email;
}
async function session(run) {
  const available = await browserAvailability();
  assert.equal(available.ok, true, available.reason);
  const browser = await available.playwright.chromium.launch({ headless: true, executablePath: available.executable });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    await restrictBrowserNetwork(context);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await virtualAuthenticator(context, page);
    await run(browser, context, page);
  } finally { await browser.close(); }
}
async function downloadBytes(download) {
  const stream = await download.createReadStream();
  assert.ok(stream, 'Encrypted kit download must provide actual bytes');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('v3 recovery preserves one encrypted replacement across reload and gates finalization on its real offline kit', { timeout: 180000 }, async t => {
  let stage = 'login';
  try {
    await session(async (browser, context, page) => {
      const toolContext = await browser.newContext();
      await restrictBrowserNetwork(toolContext);
      await toolContext.setOffline(true);
      const tool = await toolContext.newPage();
      await tool.goto(pathToFileURL(toolHtml).href);
      await tool.locator('#generate').click();
      const words = (await tool.locator('#words li').allTextContents()).join(' ');
      const guardian = await tool.locator('#guardian').innerText();
      const unlock = 'V3-browser-replacement-fixture-2026';
      const secrets = [words, unlock];
      let leaked = false;
      context.on('request', request => {
        const text = `${request.url()} ${request.postData() || ''}`;
        if (secrets.some(secret => text.includes(secret))) leaked = true;
      });
      const email = await login(page);
      stage = 'wallet deployment';
      await page.getByRole('button', { name: 'MOCK KYC: mark identity verified', exact: true }).click();
      await page.getByRole('button', { name: '✓ MOCK KYC verified', exact: true }).waitFor();
      await page.locator('.status.info').waitFor({ state: 'hidden' });
      await page.getByLabel('Create a device passphrase', { exact: true }).fill('V3-browser-owner-fixture-2026');
      await page.getByLabel('Recovery card public address', { exact: true }).fill(guardian);
      const deploymentResponse = page.waitForResponse(response =>
        new URL(response.url()).origin === new URL(sqUrl).origin &&
        new URL(response.url()).pathname === '/relay/deploy' && response.request().method() === 'POST');
      void deploymentResponse.catch(() => {});
      await page.getByRole('button', { name: 'Create my wallet ↗', exact: true }).click();
      const deployed = await deploymentResponse;
      assert.equal(deployed.status(), 200, 'Own-wallet deployment service must accept the actual UI request');
      assert.match((await deployed.json()).transactionHash, /^0x[\da-fA-F]{64}$/);
      // Ownership text alone can be stale. This activity appears only after the
      // shell confirms the deployment receipt, and setup completion follows registration.
      await page.locator('.activity').filter({ hasText: 'Wallet created' }).filter({ hasText: 'Confirmed receipt' }).waitFor();
      await page.locator('.status.success').filter({ hasText: 'Wallet created. Save your emergency kit' }).waitFor();
      await page.getByText('Verified as yours', { exact: true }).waitFor();
      stage = 'protection contract';
      const protection = page.getByTestId('protection-panel');
      await protection.waitFor();
      await protection.getByText('Card + one helper required on each path', { exact: true }).waitFor();
      await protection.getByText('No pending request on either checked node', { exact: true }).waitFor();
      assert.match(await protection.innerText(), /not an automated|Not acknowledged/);
      stage = 'local DeFi refusal';
      await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('button', { name: /^◎\s*DeFi$/, exact: true }).click();
      const dapps = page.getByTestId('dapps-panel');
      await dapps.waitFor();
      assert.match(await dapps.getByRole('alert').innerText(), /unavailable on this network/);
      assert.equal(await dapps.getByTestId('dapp-preview').isDisabled(), true);
      assert.equal(await dapps.getByTestId('dapp-execute').count(), 0);
      stage = 'prepare replacement';
      await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('button', { name: /^↻\s*Recover access$/, exact: true }).click();
      let recovery = page.getByTestId('recovery-wizard');
      await recovery.waitFor();
      await recovery.getByLabel('New app unlock code · at least 12 characters', { exact: true }).fill(unlock);
      await recovery.getByTestId('recovery-prepare').click();
      await recovery.getByLabel('Public recovery request code', { exact: true }).waitFor();
      const request = await recovery.getByLabel('Public recovery request code', { exact: true }).inputValue();
      const owner = (await recovery.getByTestId('recovery-new-owner').innerText()).replace(/\s/g, '');
      assert.match(owner, /^0x[\da-fA-F]{40}$/);
      assert.equal(await recovery.getByTestId('recovery-start').isDisabled(), true);
      assert.equal(await recovery.getByTestId('recovery-finalize').isDisabled(), true);
      assert.equal(await recovery.getByTestId('recovery-card-approval').inputValue(), '');
      await recovery.getByTestId('recovery-card-approval').fill('invalid!not-an-approval');
      await recovery.getByRole('checkbox', { name: /I compared every group/ }).check();
      const recoveryPosts = [];
      const listener = req => { if (req.method() === 'POST' && /\/(recovery\/approve|relay\/recovery)$/.test(new URL(req.url()).pathname)) recoveryPosts.push(req.url()); };
      page.on('request', listener);
      await recovery.getByTestId('recovery-start').click();
      await page.locator('.status.error').waitFor();
      assert.deepEqual(recoveryPosts, [], 'Malformed card approval must be rejected before helper or relay submission');
      page.off('request', listener);
      stage = 'resume after reload';
      await page.reload();
      // Login is deliberately memory-only; reauthenticate through the actual UI.
      await page.getByRole('heading', { name: 'Sign in to Swissquote', exact: true }).waitFor();
      await page.getByLabel('Email address', { exact: true }).fill(email);
      await page.getByLabel('Login password', { exact: true }).fill('V3-browser-login-fixture-2026');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
      await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('button', { name: /^↻\s*Recover access$/, exact: true }).click();
      recovery = page.getByTestId('recovery-wizard');
      await recovery.getByLabel('Unlock saved replacement · app unlock code', { exact: true }).fill(unlock);
      await recovery.getByTestId('recovery-prepare').click();
      await recovery.getByLabel('Public recovery request code', { exact: true }).waitFor();
      assert.equal(await recovery.getByLabel('Public recovery request code', { exact: true }).inputValue(), request);
      assert.equal((await recovery.getByTestId('recovery-new-owner').innerText()).replace(/\s/g, ''), owner);
      stage = 'replacement kit download and offline decryption';
      await recovery.getByLabel('Unlock saved replacement · app unlock code', { exact: true }).fill(unlock);
      await recovery.getByRole('button', { name: 'Create new encrypted kit', exact: true }).click();
      const downloadButton = recovery.getByRole('button', { name: 'Download new encrypted kit', exact: true });
      await downloadButton.waitFor();
      const code = await recovery.locator('p').filter({ hasText: 'New kit code — store separately' }).locator('strong').innerText();
      secrets.push(code);
      const saved = recovery.getByRole('checkbox', { name: /I saved the new kit file/ });
      assert.equal(await saved.isDisabled(), true);
      assert.equal(await recovery.getByTestId('recovery-finalize').isDisabled(), true);
      const pending = page.waitForEvent('download');
      await downloadButton.click();
      const buffer = await downloadBytes(await pending);
      const kit = JSON.parse(buffer.toString());
      assert.equal(kit.owner.toLowerCase(), owner.toLowerCase());
      assert.equal(containsSecret(kit, secrets), false);
      await saved.check();
      assert.equal(await recovery.getByTestId('recovery-finalize').isDisabled(), true, 'Download acknowledgement alone cannot unlock finalization');
      await tool.locator('[data-tab="kit"]').click();
      await tool.locator('#kit-file').setInputFiles({ name: 'replacement-kit.json', mimeType: 'application/json', buffer });
      await tool.locator('#kit-code').fill(code);
      await tool.locator('#open-kit').click();
      await tool.locator('#kit-result').waitFor({ state: 'visible' });
      const seed = await tool.locator('#seed').innerText();
      assert.equal(seed.trim().split(/\s+/).length, 24);
      secrets.push(seed);
      assert.equal((await tool.locator('#kit-owner').innerText()).toLowerCase(), owner.toLowerCase());
      assert.equal(containsSecret(await persistenceSnapshot(tool), secrets), false);
      assert.equal(containsSecret(await persistenceSnapshot(page), secrets), false);
      assert.equal(leaked, false, 'Card, replacement unlock code, kit code and seed must never reach wallet services/RPC');
      await tool.locator('#reset').click();
      assert.equal(await tool.locator('#seed').innerText(), '');
      t.diagnostic('Real local prepare/resume/download only. No recovery approval, finalization, old-key refusal, clock change or live-network success claimed.');
    });
  } catch { throw new Error(`v3 recovery acceptance failed at ${stage}; secret-bearing browser exception omitted`); }
});

test('v3 audit exposes the trust-check testid contract instead of a placeholder', { timeout: 60000 }, async () => {
  try {
    await session(async (_browser, _context, page) => {
      await login(page);
      await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('button', { name: /^◎\s*Trust check$/, exact: true }).click();
      const audit = page.getByTestId('trust-check');
      await audit.waitFor();
      assert.doesNotMatch(await audit.innerText(), /This feature is not ready yet/);
    });
  } catch { throw new Error('v3 trust-check UI contract acceptance failed; secret-bearing browser exception omitted'); }
});
