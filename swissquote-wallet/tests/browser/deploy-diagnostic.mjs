// Bounded diagnosis only: own loopback runtime, real browser/UI, no recovery wait.
import { createRuntime } from '../../scripts/v3-local.mjs';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const allowedErrors = new Map([
  ['Operation failed; inspect local service and chain configuration', 'service_internal_configuration'],
  ['Initializer does not match approved template', 'initializer_template_mismatch'],
  ['Wallet address does not match template', 'wallet_template_mismatch'],
  ['Invalid EIP-1271 ownership proof', 'ownership_signature_refused'],
  ['Wallet rules do not match template', 'wallet_rules_refused'],
  ['Request chain mismatch', 'request_chain_mismatch'],
  ['MOCK KYC verification required', 'kyc_required'],
  ['Guardian does not belong to this client', 'guardian_client_mismatch'],
  ['Chain send preparation failed; nothing broadcast', 'chain_prebroadcast_failure'],
  ['One deployment per account', 'deployment_limit'],
]);
const categorize = value => allowedErrors.get(value) ?? (/strict mode violation/.test(value) ? 'selector_multiple_matches' : /Timeout/.test(value) ? 'selector_or_response_timeout' : /signature/i.test(value) ? 'signature_error_redacted' : /revert/i.test(value) ? 'chain_revert_redacted' : 'unclassified_redacted');
let runtime, browser, timer;
const report = { purpose: 'Actual own-wallet deployment diagnosis; no recovery or public writes', evidence: [], outcome: 'not_run' };
let stage = 'runtime';
const log = data => { report.evidence.push(data); console.log(JSON.stringify(data)); };
try {
  runtime = await createRuntime();
  Object.assign(process.env, runtime.env);
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('diagnostic_deadline')), 120000); });
  const work = async () => {
    await runtime.startChain();
    await runtime.startApps();
    stage = 'browser';
    const h = await import('./harness.mjs');
    const available = await h.browserAvailability();
    if (!available.ok) {
      log({ browserAvailability: 'unavailable', category: available.reason.startsWith('Chromium executable is unavailable') ? 'chromium_executable_unavailable' : 'playwright_package_unavailable' });
      throw new Error('browser_unavailable');
    }
    const browserEnv = Object.fromEntries(['PATH', 'HOME', 'LANG', 'LD_LIBRARY_PATH', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'].filter(key => runtime.env[key]).map(key => [key, runtime.env[key]]));
    browser = await available.playwright.chromium.launch({ headless: true, executablePath: available.executable, env: browserEnv });
    const context = await browser.newContext();
    await h.restrictBrowserNetwork(context);
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    await h.virtualAuthenticator(context, page);
    const posts = new Set(['/auth/register', '/auth/passkey/register/options', '/auth/passkey/register/verify', '/kyc/mock-verify', '/guardian/enroll', '/enroll', '/relay/deploy', '/wallets/challenge', '/wallets']);
    const responses = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (response.request().method() !== 'POST' || !posts.has(url.pathname)) return;
      const task = (async () => {
        const data = { api: url.pathname, port: Number(url.port), status: response.status() };
        if (!response.ok()) {
          const body = await response.json().catch(() => ({}));
          data.errorCategory = categorize(typeof body.error === 'string' ? body.error : '');
          if (allowedErrors.has(body.error)) data.safeError = body.error;
        }
        log(data);
      })();
      responses.push(task); void task.catch(() => {});
    });
    const idle = async () => { await page.locator('.status.info').waitFor({ state: 'hidden' }); };
    stage = 'offline_card';
    const toolContext = await browser.newContext(); await h.restrictBrowserNetwork(toolContext); await toolContext.setOffline(true);
    const tool = await toolContext.newPage();
    await tool.goto(pathToFileURL(h.toolHtml).href);
    await tool.locator('#generate').click();
    const guardian = await tool.locator('#guardian').innerText();
    if (!/^0x[0-9a-fA-F]{40}$/.test(guardian.trim())) throw new Error('card_address_invalid');
    log({ offlineCard: 'generated_real_public_address_without_reading_words' });
    stage = 'passkey_login';
    await page.goto(h.walletUrl);
    await page.getByRole('button', { name: 'New here? Create a login', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).fill(`v3-diag-${crypto.randomUUID()}@example.test`);
    await page.getByLabel('Login password', { exact: true }).fill('V3-diag-login-fixture-2026');
    await page.getByRole('button', { name: /Create with a passkey/ }).click(); await idle();
    await page.getByRole('heading', { name: 'Create your self-custody wallet', exact: true }).waitFor();
    stage = 'kyc';
    await page.getByRole('button', { name: 'MOCK KYC: mark identity verified', exact: true }).click(); await idle();
    const expected = page.getByRole('button', { name: '✓ MOCK KYC verified', exact: true });
    const candidates = page.getByRole('button', { name: /MOCK KYC verified/ });
    log({ selector: 'button exact name: ✓ MOCK KYC verified', exactMatches: await expected.count(), verifiedCandidateMatches: await candidates.count() });
    if (await candidates.count() === 1) {
      const label = (await candidates.innerText()).replace(/\s+/g, ' ').trim();
      log({ kycVisibleLabel: /^(?:✓\s*){1,3}MOCK KYC verified$/.test(label) ? label : 'unrecognized_redacted', verifiedDisabled: await candidates.isDisabled() });
    }
    // Observe the existing selector's failure, then continue using verified API/state evidence.
    try { await expected.waitFor({ timeout: 1500 }); log({ existingKycSelector: 'passed' }); }
    catch (error) { log({ existingKycSelector: 'failed', errorCategory: categorize(error.message) }); }
    stage = 'deployment';
    await page.getByLabel('Create a device passphrase', { exact: true }).fill('V3-diag-owner-fixture-2026');
    await page.getByLabel('Recovery card public address', { exact: true }).fill(guardian);
    const deployed = page.waitForResponse(response => new URL(response.url()).pathname === '/relay/deploy' && response.request().method() === 'POST', { timeout: 15000 });
    void deployed.catch(() => {});
    await page.getByRole('button', { name: 'Create my wallet ↗', exact: true }).click();
    const response = await deployed;
    if (response.ok()) {
      const data = await response.json();
      const { createPublicClient, http } = await import('viem');
      const client = createPublicClient({ transport: http('http://127.0.0.1:8645', { retryCount: 0 }) });
      const receipt = await client.waitForTransactionReceipt({ hash: data.transactionHash, timeout: 20000 });
      log({ deploymentReceipt: receipt.status, transactionHashValid: /^0x[0-9a-fA-F]{64}$/.test(data.transactionHash) });
      await idle();
      const errors = page.locator('.status.error');
      if (await errors.count()) log({ uiErrorCategory: categorize(await errors.innerText()) });
      log({ confirmedActivity: await page.locator('.activity').filter({ hasText: 'Wallet created' }).filter({ hasText: 'Confirmed receipt' }).count(), ownershipVerified: await page.getByText('Verified as yours', { exact: true }).count(), kitSuccess: await page.locator('.status.success').filter({ hasText: 'Wallet created. Save your emergency kit' }).count() });
      report.outcome = receipt.status === 'success' ? 'real_deployment_success' : 'receipt_failed';
    } else { report.outcome = 'deployment_api_failure'; }
    await Promise.allSettled(responses);
  };
  await Promise.race([work(), deadline, runtime.stopped.then(error => { throw error; })]);
} catch (error) {
  report.outcome = 'diagnostic_stopped';
  log({ failingStage: stage, errorCategory: error.message === 'diagnostic_deadline' ? '120s_deadline' : categorize(error.message) });
} finally {
  clearTimeout(timer);
  if (browser) await browser.close().catch(() => {});
  if (runtime) {
    await runtime.stop();
    report.ownedRuntimeStopCalled = true;
    const destination = path.join(runtime.runDir, 'deploy-diagnostic.json');
    await writeFile(destination, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ report: destination, outcome: report.outcome, ownedRuntimeStopCalled: true }));
  }
}
