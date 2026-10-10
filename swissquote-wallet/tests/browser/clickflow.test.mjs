import test from 'node:test';
import assert from 'node:assert/strict';
import { browserAvailability, walletUrl, toolUrl, toolHtml, assertLocalUrl, virtualAuthenticator, persistenceSnapshot, containsSecret, serviceOrigins, restrictBrowserNetwork } from './harness.mjs';
import { pathToFileURL } from 'node:url';

// Intentionally separate from mandatory5: requires the already-managed, deployed
// local chain and real SQ/partner services. No request mocks or chain resets.
test('real UI customer, card, wallet, kit, funding and hash-bound passkey payments', { timeout: 180000 }, async t => {
  const available = await browserAvailability();
  assert.equal(available.ok, true, available.reason);
  assertLocalUrl(walletUrl); assertLocalUrl(toolUrl);
  const browserEnv = Object.fromEntries(['PATH', 'HOME', 'LANG', 'LD_LIBRARY_PATH', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const browser = await available.playwright.chromium.launch({ headless: true, executablePath: available.executable, env: browserEnv });
  const walletContext = await browser.newContext({ acceptDownloads: true });
  const toolContext = await browser.newContext();
  let stage = 'launch';
  const observed = [];
  const secrets = [];
  let cardWordLeak = false;
  let page;
  let diagnoseFailure = async () => {};
  try {
    for (const context of [walletContext, toolContext]) await restrictBrowserNetwork(context);
    page = await walletContext.newPage();
    page.setDefaultTimeout(20000);
    page.on('response', response => {
      const url = new URL(response.url());
      if (serviceOrigins.has(url.origin)) observed.push({ path: url.pathname, status: response.status() });
    });
    const tool = await toolContext.newPage();
    tool.setDefaultTimeout(20000);
    await virtualAuthenticator(walletContext, page);
    const step = async (name, action) => { stage = name; await action(); t.diagnostic(`PASS: ${name}`); };
    const successful = path => observed.some(item => item.path === path && item.status >= 200 && item.status < 300);
    const idle = async () => { await page.locator('.status.info').waitFor({ state: 'hidden' }); };
    const navigation = page.getByRole('navigation', { name: 'Wallet navigation', exact: true });
    const settingsButton = navigation.getByRole('button', { name: /^⚙\s*(?:Settings|Security & kit)$/, exact: true });
    const publicNavigationLabels = new Set(['◈ Overview', '↗ Send money', '↗ Pay', '↻ Recovery', '↻ Recover access', '⚙ Settings', '⚙ Security & kit', '◇ MOCK demo lab', '◇ Demo lab', '◎ DeFi', '◎ Trust check', '◎ Protection']);
    const diagnose = async (point) => {
      // Read only navigation button labels; emit exact allowlisted public text or a fixed category.
      const labels = await navigation.getByRole('button').evaluateAll(buttons => buttons.map(button => (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, ' ').trim().replace(/^([◈↗↻⚙◇◎])\s*/, '$1 ')));
      t.diagnostic(JSON.stringify({ point, stage, navigationButtons: labels.length,
        publicButtonLabels: labels.map(label => publicNavigationLabels.has(label) ? label : 'unrecognized_public_label_redacted'),
        legacySettingsMatches: await page.getByRole('button', { name: /^(Settings|.*Security & kit)$/ }).count(),
        scopedSettingsMatches: await settingsButton.count(), settingsPanels: await page.getByTestId('settings-panel').count(),
        kitCodes: await page.locator('.kit-code strong').count(),
        busyStatuses: await page.locator('.status.info').count(), errorStatuses: await page.locator('.status.error').count(),
        fundingAmountInputs: await page.getByLabel('Amount in USDC', { exact: true }).count(),
        fundingActions: await page.getByRole('button', { name: /Move to my wallet/ }).count(),
        disabledFundingActions: await page.getByRole('button', { name: /Move to my wallet/ }).evaluateAll(buttons => buttons.filter(button => button.disabled).length),
        retryOwnershipActions: await page.getByRole('button', { name: 'Retry registration', exact: true }).count(),
        independentChecks: await page.getByRole('checkbox', { name: 'I personally saw a green result in the independent tool.', exact: true }).evaluateAll(inputs => inputs.map(input => input.checked)),
        verifiedOwnershipLabels: await page.getByText('Verified as yours', { exact: true }).count() }));
    };
    diagnoseFailure = async () => { try { await diagnose('failure'); } catch { t.diagnostic('Failure DOM evidence unavailable; category diagnostic_unavailable'); } };
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
      if (serviceOrigins.has(url.origin) || url.origin === new URL(walletUrl).origin) {
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
      // Use card verification, not the public wallet-rules-only pane.
      await tool.locator('[data-tab="verify"]').click();
      await tool.locator('#setup').fill(setup);
      await tool.locator('#check-words').fill(words);
      await tool.locator('#check-button').click();
      await tool.locator('#status[data-state="success"]').waitFor();
      assert.match(await tool.locator('#status').innerText(), /Both RPC checks passed/);
      await page.getByRole('checkbox', { name: 'I personally saw a green result in the independent tool.', exact: true }).check();
    });
    await step('actual encrypted kit download and offline opening', async () => {
      stage = 'kit settings navigation';
      await diagnose('before settings navigation');
      assert.equal(await settingsButton.count(), 1, 'Exactly one wallet settings navigation button is required');
      await settingsButton.click();
      stage = 'kit settings idle';
      await idle();
      await diagnose('after settings navigation');
      const settings = page.getByTestId('settings-panel');
      const featureSettings = await settings.count() > 0;
      stage = 'current owner kit export action';
      if (featureSettings) await click('Export current owner kit');
      stage = 'current owner kit separate code';
      const code = await page.locator('.kit-code strong').innerText(); secrets.push(code);
      const pending = page.waitForEvent('download');
      void pending.catch(() => {}); // A failed click must not expose an unhandled browser exception.
      stage = 'current owner kit actual download';
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
      stage = 'offline downloaded kit file selection';
      await tool.locator('#kit-file').setInputFiles({ name: 'downloaded-kit.json', mimeType: 'application/json', buffer });
      await tool.locator('#kit-code').fill(code);
      await tool.locator('#open-kit').click();
      stage = 'offline kit decrypted seed visible';
      await tool.locator('#kit-result').waitFor({ state: 'visible' });
      const seed = await tool.locator('#seed').innerText(); secrets.push(seed);
      assert.equal(seed.split(/\s+/).length, 24);
      assert.equal(containsSecret(await persistenceSnapshot(tool), secrets), false);
      assert.equal(containsSecret(await persistenceSnapshot(page), secrets), false);
      await tool.locator('#reset').click();
      if (featureSettings) {
        stage = 'current kit saved-file acknowledgment after offline proof';
        await settings.getByRole('checkbox', { name: /I saved the file and wrote the kit code separately/ }).check();
        await idle();
      } else await page.getByRole('button', { name: /I saved it/ }).click();
      assert.equal(cardWordLeak, false, 'Card words must not reach the wallet/SQ/partner requests');
    });
    await step('real MOCK account funding with chain receipt', async () => {
      stage = 'funding overview navigation';
      await navigation.getByRole('button', { name: /^◈\s*Overview$/, exact: true }).click(); await idle();
      await diagnose('before account funding');
      stage = 'funding amount entry';
      await page.getByLabel('Amount in USDC', { exact: true }).fill('20');
      stage = 'funding ownership and independent-check retained after kit acknowledgment';
      assert.equal(await page.getByText('Verified as yours', { exact: true }).count(), 1, 'Kit acknowledgment must retain verified wallet ownership');
      assert.equal(await page.getByRole('checkbox', { name: 'I personally saw a green result in the independent tool.', exact: true }).isChecked(), true, 'Kit acknowledgment must retain the actual independent-check acknowledgment');
      assert.equal(await page.getByRole('button', { name: /Move to my wallet/ }).isEnabled(), true, 'Verified and independently checked wallet must allow account funding');
      stage = 'funding submit action';
      await click(/Move to my wallet/);
      stage = 'funding receipt evidence';
      assert.ok(successful('/account/withdraw'));
      await page.getByText('Account transfer', { exact: true }).waitFor();
    });
    for (const [amount, large] of [['1', false], ['6', true]]) await step(large ? 'large send with actual SQ hash-bound step-up verification' : 'small owner-signed send without step-up', async () => {
      const before = observed.filter(item => item.path === '/auth/passkey/step-up/verify').length;
      await navigation.getByRole('button', { name: /^↗\s*(?:Pay|Send money)$/, exact: true }).click();
      await page.getByLabel('Recipient wallet address').fill('0x000000000000000000000000000000000000dEaD');
      await page.getByLabel('Amount in USDC').fill(amount);
      await click(/Review payment/);
      const preview = page.getByTestId('pay-preview');
      if (await preview.count()) {
        const suffix = preview.getByLabel('Recipient last four characters', { exact: true });
        if (await suffix.count()) {
          // Complete the current first-recipient safeguard; never bypass a disabled approval.
          const approve = preview.getByRole('button', { name: /^(?:Confirm with passkey & send|Sign & send)$/ });
          assert.equal(await approve.isDisabled(), true, 'First-time recipient approval requires the address suffix');
          await suffix.fill('dEaD');
        }
      }
      const approval = large ? /Confirm with passkey & send/ : /^Sign & send(?: payment(?: ↗)?)?$/;
      await click(approval);
      assert.ok(successful('/relay/safe-tx'));
      await page.getByText('Payment confirmed on chain.', { exact: true }).waitFor();
      const after = observed.filter(item => item.path === '/auth/passkey/step-up/verify').length;
      assert.equal(after - before, large ? 1 : 0);
      if (large) assert.ok(successful('/auth/passkey/step-up/verify'));
    });
    t.diagnostic('Local-only evidence; virtual authenticator, MOCK identity/account, no live Sepolia or hardware proof.');
  } catch (error) {
    // Never emit exceptions, alert text, storage, generated words, or kit contents.
    const category = error?.name === 'TimeoutError' ? 'selector_or_response_timeout'
      : error?.code === 'ERR_ASSERTION' ? 'assertion_failed'
      : typeof error?.message === 'string' && error.message.includes('strict mode violation') ? 'selector_multiple_matches'
      : error?.message === 'UI action refused' ? 'ui_action_refused' : 'unclassified_redacted';
    if (page) await diagnoseFailure();
    throw new Error(`Clickflow failed at ${stage}; category ${category}; secret-bearing browser exception omitted`);
  } finally { await browser.close(); }
});
