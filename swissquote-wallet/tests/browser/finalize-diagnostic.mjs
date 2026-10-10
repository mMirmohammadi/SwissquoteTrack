import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { setTimeout as realWait } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import {
  browserAvailability, browserEnvironment, walletUrl, toolHtml,
  restrictBrowserNetwork, virtualAuthenticator, persistenceSnapshot, containsSecret,
} from './harness.mjs';

// Attach-only acceptance. This file never starts services, mines blocks, changes
// clocks, installs dependencies, reads keys, or replaces API/RPC/signatures.
// Identity/face checks are explicitly MOCK; Chromium passkey is virtual.
const protocolRequire = createRequire(new URL('../../packages/protocol/package.json', import.meta.url));
const LOGIN = 'V3-complete-login-fixture-2026';
const DEVICE = 'V3-complete-owner-fixture-2026';
const REPLACEMENT = 'V3-complete-replacement-fixture-2026';
const lower = value => value.toLowerCase();

async function downloadBytes(download) {
  const stream = await download.createReadStream();
  assert.ok(stream, 'Actual encrypted kit download stream required');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// No skips, including outside the gate: refusing a missing required/isolated
// environment is safer than accidentally attaching the running mainv2 stack.
test('v3 complete local recovery: card + partner, cancellation, real wait, kit, same wallet and old-owner refusal', { timeout: 480000 }, async t => {
  let stage = 'required isolated environment';
  let browser;
  const secrets = [DEVICE, REPLACEMENT];
  let leaked = false;
  const evidence = { responses: [], notices: [], originalNoticeSelector: false, caseInsensitiveNoticeSelector: false };
  const observedResponses = [];
  let finalPage;
  try {
    assert.equal(process.env.BROWSER_REQUIRED, '1', 'Run only with BROWSER_REQUIRED=1');
    const env = browserEnvironment();
    for (const [name, port] of Object.entries({ wallet: 5273, tool: 5274, sq: 4101, partner: 4102, rpc: 8645 })) {
      assert.equal(Number(new URL(env[name]).port), port, 'Only lead-owned isolated gate ports allowed');
    }
    stage = 'installed browser and real protocol loader';
    const available = await browserAvailability();
    assert.equal(available.ok, true, available.reason);
    const { tsImport } = await import(protocolRequire.resolve('tsx/esm/api'));
    const p = await tsImport('../../packages/protocol/src/index.ts', import.meta.url);
    const { createPublicClient, http, verifyTypedData } = protocolRequire('viem');
    // Both host aliases address the lead's one local chain, not independent operators.
    const rpcAliases = [new URL(env.rpc), new URL(env.rpc)];
    rpcAliases[0].hostname = '127.0.0.1'; rpcAliases[1].hostname = 'localhost';
    const clients = rpcAliases.map(url => createPublicClient({ transport: http(url.href, { timeout: 12000, retryCount: 0 }) }));
    assert.deepEqual(await Promise.all(clients.map(client => client.getChainId())), [31337, 31337]);
    const readState = async wallet => {
      const heads = await Promise.all(clients.map(client => client.getBlockNumber({ cacheTime: 0 })));
      const blockNumber = heads.reduce((a, b) => a < b ? a : b);
      const states = await Promise.all(clients.map(async client => {
        const [block, owners, threshold, pending] = await Promise.all([
          client.getBlock({ blockNumber }),
          client.readContract({ address: wallet, abi: p.safeAbi, functionName: 'getOwners', blockNumber }),
          client.readContract({ address: wallet, abi: p.safeAbi, functionName: 'getThreshold', blockNumber }),
          Promise.all([p.ADDRESSES.moduleA, p.ADDRESSES.moduleB].map(address => client.readContract({ address, abi: p.moduleAbi, functionName: 'getRecoveryRequest', args: [wallet], blockNumber }))),
        ]);
        return { blockHash: block.hash, timestamp: block.timestamp, owners: owners.map(lower), threshold, pending };
      }));
      assert.deepEqual(states[0], states[1], 'Both local host-alias reads must agree at the common block');
      return states[0];
    };
    browser = await available.playwright.chromium.launch({ headless: true, executablePath: available.executable });
    const context = await browser.newContext({ acceptDownloads: true });
    const toolContext = await browser.newContext();
    for (const ctx of [context, toolContext]) {
      await restrictBrowserNetwork(ctx);
      ctx.on('request', request => {
        if (!/^https?:/.test(request.url())) return;
        const text = `${request.url()} ${request.postData() || ''}`;
        if (containsSecret(text, secrets)) leaked = true;
      });
    }
    const page = await context.newPage(); page.setDefaultTimeout(25000);
    const tool = await toolContext.newPage(); tool.setDefaultTimeout(25000);
    await virtualAuthenticator(context, page);
    const idle = async () => {
      await page.locator('.status.info').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.status.error').count(), 0, 'UI action must succeed');
    };
    const action = async locator => { await locator.click(); await idle(); };
    const responseAt = (origin, path) => {
      const pendingResponse = page.waitForResponse(response =>
        new URL(response.url()).port === new URL(origin).port &&
        new URL(response.url()).pathname === path && response.request().method() === 'POST');
      // Observe rejection even when a preceding UI action fails, so the raw
      // Playwright exception cannot escape as an unhandled secret-bearing log.
      void pendingResponse.catch(() => {});
      return pendingResponse;
    };

    stage = 'own card generation from saved HTML offline';
    await toolContext.setOffline(true);
    await tool.goto(pathToFileURL(toolHtml).href);
    await tool.locator('#generate').click();
    const words = (await tool.locator('#words li').allTextContents()).join(' ');
    const guardian = await tool.locator('#guardian').innerText();
    assert.equal(words.split(/\s+/).length, 12); secrets.push(words);

    stage = 'own password identity plus real virtual-passkey enrollment';
    const email = `v3-complete-${crypto.randomUUID()}@example.test`;
    await page.goto(walletUrl);
    await page.getByRole('button', { name: 'New here? Create a login', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Login password', { exact: true }).fill(LOGIN);
    const passkeyResponse = responseAt(env.sq, '/auth/passkey/register/verify');
    await action(page.getByRole('button', { name: /Create with a passkey/ }));
    assert.equal((await passkeyResponse).status(), 200, 'Service must verify actual virtual WebAuthn response');
    await page.getByRole('heading', { name: 'Create your self-custody wallet', exact: true }).waitFor();

    stage = 'MOCK identity verification and real own-wallet deployment';
    await action(page.getByRole('button', { name: 'MOCK KYC: mark identity verified', exact: true }));
    await page.getByRole('button', { name: '✓ MOCK KYC verified', exact: true }).waitFor();
    await page.getByLabel('Create a device passphrase', { exact: true }).fill(DEVICE);
    await page.getByLabel('Recovery card public address', { exact: true }).fill(guardian);
    const deploymentResponse = responseAt(env.sq, '/relay/deploy');
    await action(page.getByRole('button', { name: 'Create my wallet ↗', exact: true }));
    const deployed = await deploymentResponse;
    assert.equal(deployed.status(), 200, 'Actual own-wallet deployment must succeed');
    const deployment = await deployed.json();
    assert.match(deployment.transactionHash, /^0x[\da-fA-F]{64}$/);
    const deploymentReceipt = await clients[0].waitForTransactionReceipt({ hash: deployment.transactionHash, timeout: 75000 });
    assert.equal(deploymentReceipt.status, 'success', 'Actual deployment receipt must succeed');
    await page.locator('.status.success').filter({ hasText: 'Wallet created. Save your emergency kit' }).waitFor();
    await page.getByText('Verified as yours', { exact: true }).waitFor();
    const setupCode = await page.getByLabel('Wallet setup code', { exact: true }).inputValue();
    const setup = p.decodeSetupCode(setupCode);
    assert.equal(setup.chainId, 31337);
    const original = await readState(setup.wallet);
    assert.deepEqual(original.owners, [lower(setup.owner)]);
    assert.equal(original.threshold, 1n);
    assert.ok(original.pending.every(record => record.executeAfter === 0n));
    t.diagnostic('Own wallet deployed on lead-owned local chain; MOCK KYC/face and virtual WebAuthn, no public-network claim.');

    stage = 'prepare saved encrypted replacement';
    await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('button', { name: /^↻\s*Recover access$/, exact: true }).click();
    const recovery = page.getByTestId('recovery-wizard');
    await recovery.waitFor();
    await recovery.getByTestId('recovery-helper').selectOption('0');
    await recovery.getByLabel('New app unlock code · at least 12 characters', { exact: true }).fill(REPLACEMENT);
    await action(recovery.getByTestId('recovery-prepare'));
    const replacementOwner = (await recovery.getByTestId('recovery-new-owner').innerText()).replace(/\s/g, '');
    assert.match(replacementOwner, /^0x[\da-fA-F]{40}$/);
    assert.notEqual(lower(replacementOwner), lower(setup.owner));
    assert.equal(await recovery.getByTestId('recovery-start').isDisabled(), true);

    const approveAndStart = async () => {
      const requestCode = await recovery.getByLabel('Public recovery request code', { exact: true }).inputValue();
      const wire = p.decodeRequestCode(requestCode);
      assert.equal(lower(wire.wallet), lower(setup.wallet));
      assert.equal(lower(wire.newOwner), lower(replacementOwner));
      assert.equal(lower(wire.module), lower(p.ADDRESSES.moduleA));
      const request = { wallet: wire.wallet, module: wire.module, newOwner: wire.newOwner, nonce: BigInt(wire.nonce), chainId: wire.chainId };
      // Saved portable page uses read-only local RPC for review/signing checks.
      // Card creation and kit decryption alone are fully offline.
      await toolContext.setOffline(false);
      await tool.locator('[data-tab="approve"]').click();
      await tool.locator('#request').fill(requestCode);
      await tool.locator('#approve-words').fill(words);
      await tool.locator('#review-button').click();
      await tool.locator('#review').waitFor({ state: 'visible' });
      assert.equal(lower(await tool.locator('#review-wallet').innerText()), lower(setup.wallet));
      assert.equal(lower(await tool.locator('#review-owner').innerText()), lower(replacementOwner));
      assert.equal(lower(await tool.locator('#review-module').innerText()), lower(p.ADDRESSES.moduleA));
      await tool.locator('#confirm').check();
      await tool.locator('#sign-button').click();
      await tool.locator('#approval-result').waitFor({ state: 'visible' });
      const approvalCode = await tool.locator('#approval').inputValue();
      const card = p.decodeApprovalCode(approvalCode);
      assert.equal(lower(card.signer), lower(guardian));
      assert.equal(await verifyTypedData({ ...p.recoveryTypedData(request), address: card.signer, signature: card.signature }), true);
      assert.equal(await tool.locator('#approve-words').inputValue(), '');
      await recovery.getByTestId('recovery-card-approval').fill(approvalCode);
      await recovery.getByRole('checkbox', { name: /I compared every group/ }).check();
      const helperResult = responseAt(env.partner, '/recovery/approve');
      const relayResult = responseAt(env.sq, '/relay/recovery');
      await action(recovery.getByTestId('recovery-start'));
      const helperResponse = await helperResult;
      assert.equal(helperResponse.status(), 200);
      const helper = await helperResponse.json();
      assert.equal(lower(helper.signer), lower(setup.partnerGuardian));
      assert.equal(await verifyTypedData({ ...p.recoveryTypedData(request), address: helper.signer, signature: helper.signature }), true);
      assert.deepEqual(helper.request, { ...request, nonce: request.nonce.toString() });
      const relayResponse = await relayResult;
      assert.equal(relayResponse.status(), 200);
      const relay = await relayResponse.json();
      assert.match(relay.transactionHash, /^0x[\da-fA-F]{64}$/);
      const receipt = await clients[0].waitForTransactionReceipt({ hash: relay.transactionHash, timeout: 75000 });
      assert.equal(receipt.status, 'success');
      const block = await clients[0].getBlock({ blockNumber: receipt.blockNumber });
      const state = await readState(setup.wallet);
      assert.deepEqual(state.pending[0].newOwners.map(lower), [lower(replacementOwner)]);
      assert.equal(state.pending[0].newThreshold, 1n);
      assert.equal(state.pending[0].executeAfter - block.timestamp, 180n, 'Module A must enforce actual 180-second contract wait');
      assert.equal(state.pending[1].executeAfter, 0n);
      assert.deepEqual(state.owners, [lower(setup.owner)]);
      return { wire, started: performance.now(), executeAfter: state.pending[0].executeAfter };
    };

    stage = 'first actual card-plus-partner start for cancellation';
    const cancelled = await approveAndStart();
    stage = 'owner-signed protective cancellation through actual UI/service';
    const alert = page.getByTestId('recovery-alert');
    await alert.getByRole('heading', { name: 'Someone is replacing your wallet key.', exact: true }).waitFor();
    const cancelResponse = responseAt(env.sq, '/relay/safe-tx');
    await action(alert.getByTestId('recovery-stop'));
    const stopped = await cancelResponse;
    assert.equal(stopped.status(), 200);
    const cancellation = await stopped.json();
    assert.equal((await clients[0].waitForTransactionReceipt({ hash: cancellation.transactionHash, timeout: 75000 })).status, 'success');
    const cleared = await readState(setup.wallet);
    assert.ok(cleared.pending.every(record => record.executeAfter === 0n), 'All pending paths must be clear after cancellation');
    assert.deepEqual(cleared.owners, [lower(setup.owner)]);
    t.diagnostic('Actual pending module-A request cancelled by the still-current owner; module B checked clear, not separately started.');

    stage = 'resume same replacement with current nonce after cancellation';
    await recovery.getByLabel('Unlock saved replacement · app unlock code', { exact: true }).fill(REPLACEMENT);
    await action(recovery.getByTestId('recovery-prepare'));
    assert.equal((await recovery.getByTestId('recovery-new-owner').innerText()).replace(/\s/g, ''), replacementOwner);
    const restartedWire = p.decodeRequestCode(await recovery.getByLabel('Public recovery request code', { exact: true }).inputValue());
    assert.ok(BigInt(restartedWire.nonce) > BigInt(cancelled.wire.nonce), 'Fresh request must not reuse cancelled initiation nonce');
    stage = 'fresh card approval and real partner restart';
    const pending = await approveAndStart();

    stage = 'required replacement kit download and fully offline decryption';
    await recovery.getByLabel('Unlock saved replacement · app unlock code', { exact: true }).fill(REPLACEMENT);
    assert.equal(await recovery.getByTestId('recovery-finalize').isDisabled(), true, 'No kit acknowledgement means no finalization');
    await action(recovery.getByRole('button', { name: 'Create new encrypted kit', exact: true }));
    const code = await recovery.locator('p').filter({ hasText: 'New kit code — store separately' }).locator('strong').innerText();
    secrets.push(code);
    const saved = recovery.getByRole('checkbox', { name: /I saved the new kit file/ });
    assert.equal(await saved.isDisabled(), true, 'Actual download must precede acknowledgement');
    const download = page.waitForEvent('download');
    await recovery.getByRole('button', { name: 'Download new encrypted kit', exact: true }).click();
    const buffer = await downloadBytes(await download);
    const kit = JSON.parse(buffer.toString());
    assert.equal(lower(kit.wallet), lower(setup.wallet));
    assert.equal(lower(kit.owner), lower(replacementOwner));
    assert.equal(kit.chainId, 31337);
    assert.equal(containsSecret(kit, secrets), false);
    await toolContext.setOffline(true);
    await tool.locator('[data-tab="kit"]').click();
    await tool.locator('#kit-file').setInputFiles({ name: 'actual-replacement-kit.json', mimeType: 'application/json', buffer });
    await tool.locator('#kit-code').fill('WRONG-CODE');
    await tool.locator('#open-kit').click();
    await tool.locator('#status[data-state="error"]').waitFor();
    assert.equal(await tool.locator('#kit-result').isVisible(), false);
    assert.equal(await tool.locator('#seed').innerText(), '');
    await tool.locator('#kit-code').fill(code);
    await tool.locator('#open-kit').click();
    await tool.locator('#kit-result').waitFor({ state: 'visible' });
    const seed = await tool.locator('#seed').innerText(); secrets.push(seed);
    assert.equal(seed.trim().split(/\s+/).length, 24);
    assert.equal(lower(await tool.locator('#kit-owner').innerText()), lower(replacementOwner));
    assert.equal(containsSecret(await persistenceSnapshot(tool), secrets), false);
    // This is a human acknowledgement in the UI, not a cryptographic test receipt.
    // The acceptance test only checks it after actually decrypting the downloaded kit.
    await saved.check();
    await recovery.getByLabel('Unlock saved replacement · app unlock code', { exact: true }).fill(REPLACEMENT);

    stage = 'early finalize refuses before any finalize service request';
    if (performance.now() - pending.started < 180000) {
      let finalizePosts = 0;
      const listener = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/relay/finalize') finalizePosts++; };
      page.on('request', listener);
      try {
        await recovery.getByTestId('recovery-finalize').click();
        await page.locator('.status.error').waitFor();
        assert.match(await page.locator('.status.error').innerText(), /waiting period.*15-second safety margin/);
        assert.equal(finalizePosts, 0);
        await page.getByRole('button', { name: 'Dismiss error', exact: true }).click();
      } finally { page.off('request', listener); }
    } else {
      // Slow setup must not silently turn the negative waiting-period assertion into a pass.
      assert.fail('Kit preparation consumed the entire wait; early-finalization refusal was not observed');
    }
    stage = 'real 180-second wall wait and naturally produced block maturity';
    await realWait(Math.max(0, 180000 - (performance.now() - pending.started)));
    assert.ok(performance.now() - pending.started >= 180000, 'Must actually wait 180 seconds, without changing any clock');
    // No evm_mine, hardhat/anvil time controls, page.clock or fake timers. A
    // stalled lead-owned chain is a blocker, never repaired or labelled ready.
    await recovery.getByRole('status').filter({ hasText: 'Waiting period complete on the last checked block' }).waitFor({ timeout: 75000 });
    const mature = await readState(setup.wallet);
    assert.ok(mature.timestamp >= pending.executeAfter + 15n, 'Natural block timestamp must include safety margin');
    assert.deepEqual(mature.owners, [lower(setup.owner)]);

    stage = 'final instrumentation setup';
    finalPage = page;
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (response.request().method() !== 'POST' || !['/relay/finalize', '/wallets/challenge', '/wallets'].includes(path)) return;
      const item = { operation: path === '/relay/finalize' ? 'finalize' : path === '/wallets/challenge' ? 'registration-challenge' : 'registration', status: response.status() };
      evidence.responses.push(item);
      if (path === '/wallets') observedResponses.push(response.json().then(body => { item.verified = body.verified === true; item.sameWallet = typeof body.wallet === 'string' && lower(body.wallet) === lower(setup.wallet); item.replacementOwner = typeof body.owner === 'string' && lower(body.owner) === lower(replacementOwner); }).catch(() => { item.jsonUnavailable = true; }));
    });
    await page.evaluate(() => {
      const categories = [
        ['registered', 'New owner confirmed by both nodes and registered'],
        ['registration-incomplete', 'Swissquote ownership registration is incomplete'],
        ['protection-incomplete', 'recovery is NOT yet secure'],
        ['stale-old-device', 'This device no longer controls the wallet'],
      ];
      window.__finalizeSafeNotices = [];
      const observe = () => {
        const text = document.querySelector('.status.success')?.textContent || '';
        for (const [category, match] of categories) if (text.includes(match) && !window.__finalizeSafeNotices.includes(category)) window.__finalizeSafeNotices.push(category);
      };
      window.__finalizeSafeObserver = new MutationObserver(observe);
      window.__finalizeSafeObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    stage = 'finalize UI action and API response';
    const finishResponse = responseAt(env.sq, '/relay/finalize');
    await action(recovery.getByTestId('recovery-finalize'));
    const finalizedResponse = await finishResponse;
    assert.equal(finalizedResponse.status(), 200);
    stage = 'finalize transaction receipt';
    const finalized = await finalizedResponse.json();
    const finalReceipt = await clients[0].waitForTransactionReceipt({ hash: finalized.transactionHash, timeout: 75000 });
    evidence.receipt = finalReceipt.status;
    assert.equal(finalReceipt.status, 'success');
    stage = 'same-wallet owner and threshold readback';
    const final = await readState(setup.wallet);
    evidence.chain = { soleReplacementOwner: final.owners.length === 1 && final.owners[0] === lower(replacementOwner), thresholdOne: final.threshold === 1n, bothModulesClear: final.pending.every(record => record.executeAfter === 0n) };
    assert.deepEqual(final.owners, [lower(replacementOwner)]);
    assert.equal(final.threshold, 1n);
    assert.ok(final.pending.every(record => record.executeAfter === 0n));
    stage = 'promotion completion UI heading';
    await recovery.getByRole('heading', { name: 'Done — same address', exact: true }).waitFor();
    evidence.doneHeading = true;
    stage = 'registration result and exact versus case-insensitive notice selectors';
    await Promise.all(observedResponses);
    evidence.notices = await page.evaluate(() => [...window.__finalizeSafeNotices]);
    evidence.originalNoticeSelector = await page.locator('.status.success').filter({ hasText: 'New owner confirmed by both nodes and registered' }).count() > 0;
    evidence.caseInsensitiveNoticeSelector = await page.locator('.status.success').filter({ hasText: /New owner confirmed by both nodes and registered/i }).count() > 0;
    evidence.oldKeyAvailable = await recovery.getByTestId('recovery-old-key').isEnabled();
    evidence.finalizeButtonGone = await recovery.getByTestId('recovery-finalize').count() === 0;
    evidence.prepareButtonGone = await recovery.getByTestId('recovery-prepare').count() === 0;
    evidence.registrationVerified = evidence.responses.some(item => item.operation === 'registration' && item.status === 200 && item.verified && item.sameWallet && item.replacementOwner);
    t.diagnostic(`Safe final-stage evidence: ${JSON.stringify(evidence)}`);
    assert.equal(evidence.registrationVerified, true, 'Diagnostic requires actual registered replacement owner');
    // Continue the entire copied flow even if only the original notice selector fails.
    // This does not change application behavior or convert the original acceptance into a pass.
    assert.equal(await recovery.getByTestId('recovery-wallet').inputValue(), setup.wallet);

    stage = 'actual old-owner GS026 refusal without sending';
    assert.equal(await recovery.getByTestId('recovery-old-key').isDisabled(), false, 'Already-unlocked original device key must remain available for this read-only check');
    const safeNonceBefore = await clients[0].readContract({ address: setup.wallet, abi: p.safeAbi, functionName: 'nonce' });
    let oldKeyPosts = 0;
    const oldKeyListener = request => { if (request.method() === 'POST' && /\/relay\//.test(new URL(request.url()).pathname)) oldKeyPosts++; };
    page.on('request', oldKeyListener);
    try {
      await action(recovery.getByTestId('recovery-old-key'));
      await recovery.getByRole('status').filter({ hasText: 'The wallet contract refused the old key (GS026). Read-only eth_call; no transaction sent.' }).waitFor();
      assert.equal(oldKeyPosts, 0, 'Old-owner probe must not submit to any relay');
      assert.equal(await clients[0].readContract({ address: setup.wallet, abi: p.safeAbi, functionName: 'nonce' }), safeNonceBefore);
    } finally { page.off('request', oldKeyListener); }
    assert.equal(containsSecret(await persistenceSnapshot(page), secrets), false);

    stage = 'reload and unlock actual promoted replacement device';
    await page.reload();
    await page.getByRole('heading', { name: 'Sign in to Swissquote', exact: true }).waitFor();
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Login password', { exact: true }).fill(LOGIN);
    await action(page.getByRole('button', { name: 'Sign in', exact: true }));
    await page.getByLabel('Device passphrase', { exact: true }).fill(REPLACEMENT);
    await action(page.getByRole('button', { name: 'Unlock device', exact: true }));
    await page.getByText('Verified as yours', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Wallet setup code', { exact: true }).inputValue(), setupCode, 'Original public setup must survive replacement installation');
    assert.equal(containsSecret(await persistenceSnapshot(page), secrets), false);

    stage = 'decrypted replacement kit confirms current owner using local nodes';
    await toolContext.setOffline(false);
    await tool.locator('#check-kit-owner').click();
    await tool.locator('#status[data-state="success"]').waitFor();
    assert.match(await tool.locator('#kit-state').innerText(), /Recorded owner is current at block/);
    await tool.locator('#reset').click();
    assert.equal(await tool.locator('#seed').innerText(), '');
    assert.equal(containsSecret(await persistenceSnapshot(tool), secrets), false);
    assert.equal(leaked, false, 'No card words, seed, device unlock or kit code may reach HTTP/RPC');
    t.diagnostic('Real local card/partner signatures, mined cancel/start/finalize, 180s real wait + natural block safety margin, offline downloaded-kit decrypt, same-wallet readbacks and read-only GS026. No production face ID, independent operators, public recovery, or automated kit-attestation claim.');
  } catch (error) {
    // Only enum-like categories and bounded boolean/number assertion values escape.
    // Never emit raw errors, request bodies, response bodies or stored device data.
    const category = error?.code === 'ERR_ASSERTION' ? 'assertion' : error?.name === 'TimeoutError' ? 'browser-timeout' : 'other-redacted';
    if (category === 'assertion') {
      const safeValue = value => typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ? value : 'redacted';
      evidence.assertion = { actual: safeValue(error.actual), expected: safeValue(error.expected) };
    }
    if (finalPage) {
      await Promise.all(observedResponses);
      evidence.notices = await finalPage.evaluate(() => [...(window.__finalizeSafeNotices || [])]).catch(() => []);
      evidence.wizardPresent = await finalPage.getByTestId('recovery-wizard').count().catch(() => -1);
      evidence.doneHeading = await finalPage.getByRole('heading', { name: 'Done — same address', exact: true }).count().then(count => count > 0).catch(() => false);
    }
    t.diagnostic(`Safe failure evidence: ${JSON.stringify(evidence)}`);
    throw new Error(`Complete local diagnostic failed at: ${stage}; category=${category}. Secret-bearing exception omitted; no completion claimed.`);
  } finally { if (browser) await browser.close(); }
});
