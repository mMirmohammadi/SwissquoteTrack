// Opt-in service P0 only. NOT a *.test.mjs gate; never starts a stack or loads keys.
// Approved run: ALLOW_SEPOLIA_BROWSER=yes SEPOLIA_BROWSER_CHAIN_ID=11155111
// SEPOLIA_RECIPIENT=0x... ALLOW_SEPOLIA_BROWSER_FUND=yes node --import tsx tests/browser/sepolia-service.mjs
// Fresh wallets normally need the optional third broadcast: 1 USDC from MOCK SQ_ACCOUNT.
// Required: ALLOW_SEPOLIA_LOCAL_RETENTION=yes. Optional SEPOLIA_RUN_ID=[A-Za-z0-9][A-Za-z0-9_-]{0,79};
// omitted id generates a UUID. Run from swissquote-wallet; .sepolia-runs/<id> is ignored,
// exclusive 0700; generated passphrase/card and encrypted IndexedDB/auth snapshots are secret 0600.
// No owner seed export. 300s write deadline + at most 8s retention/close grace. Never reuse a run id.
import assert from 'node:assert/strict';
import { createHarnessRetention } from './live-retention.mjs';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createPublicClient, http, keccak256, decodeEventLog, decodeFunctionData, hashMessage, recoverTypedDataAddress, isAddress, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { ADDRESSES, DAPP_ADDRESSES, PROXY_RUNTIME_CODE_HASH, factoryAbi, safeAbi, erc20Abi, fallbackHandlerAbi, decodeSetupCode, computeWalletAddress, buildWalletInitializer, safeTxFromWire, safeTxTypedData, hashSafeTx } from '../../packages/protocol/src/index.ts';

const CHAIN = 11155111;
const WALLET = 'http://localhost:5273';
const TOOL = 'http://localhost:5274';
const SQ = 'http://localhost:4101';
const PARTNER = 'http://localhost:4102';
const RPCS = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.ethpandaops.io', 'https://sepolia.gateway.tenderly.co'];
const READS = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_call', 'eth_getCode', 'eth_getStorageAt', 'eth_getBalance', 'eth_getLogs', 'eth_getTransactionReceipt', 'eth_getTransactionByHash']);
const WRITE_PATHS = new Set(['/relay/deploy', '/account/withdraw', '/relay/safe-tx']);
const SERVICE_POSTS = new Set([...WRITE_PATHS, '/auth/password/register', '/auth/passkey/register/options', '/auth/passkey/register/verify', '/kyc/mock-verify', '/guardian/enroll', '/wallets/challenge', '/wallets']);
const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const evidence = { schema: 'sepolia-service-p0-v1', outcome: 'not_run', chainId: CHAIN, claims: { identity: 'MOCK KYC and MOCK bank account', passkey: 'Chromium virtual authenticator; service verifies real WebAuthn, not hardware proof', recovery: 'Not tested', kit: 'Not tested', defi: 'Not tested' }, submitted: [], receipts: [], checks: [] };
let stage = 'authorization', browser, walletContext, retention, devicePassphrase = '', words = '', leak = false, networkViolation = false;
let cleanupPromise;
const cleanup = () => cleanupPromise ??= (async () => {
  try {
    // Always attempt a fresh secret IndexedDB/auth snapshot BEFORE destroying context.
    if (retention && walletContext) await retention.snapshot(walletContext, { owner: evidence.owner, requireDevice: Boolean(evidence.owner) });
  } catch { evidence.retention = { status: 'failed_stop_future_writes_inspect_private_run_locally' }; evidence.outcome = 'incomplete_retention_failed_inspect_private_run_locally'; process.exitCode = 1; }
  finally {
    if (retention) await retention.close().catch(() => { process.exitCode = 1; });
    if (browser) await browser.close().catch(() => {});
  }
})();
let deployment, proof, ownerPayment;
const attempts = new Map();
let deadline = 0;
const remaining = (cap = 20000) => { const ms = Math.floor(deadline - performance.now()); assert.ok(ms > 0); return Math.min(ms, cap); };
const publicJson = () => JSON.stringify(evidence, null, 2); // Only explicit public fields ever enter evidence.

async function run() {
  assert.equal(process.env.ALLOW_SEPOLIA_BROWSER, 'yes');
  assert.equal(process.env.SEPOLIA_BROWSER_CHAIN_ID, String(CHAIN));
  assert.equal(process.env.ALLOW_SEPOLIA_LOCAL_RETENTION, 'yes');
  const recipient = process.env.SEPOLIA_RECIPIENT;
  assert.ok(recipient && isAddress(recipient, { strict: false }) && !/^0x0{40}$/i.test(recipient));
  assert.ok(!same(recipient, '0x7f367cc41522ce07553e823bf3be79a889debe1b'));
  deadline = performance.now() + 300000;
  const abort = new AbortController();
  const timer = setTimeout(async () => {
    abort.abort();
    evidence.outcome = 'deadline_reached_inspect_public_hashes_before_any_retry';
    evidence.blocker = { stage, category: 'hard_300_second_deadline' };
    evidence.broadcastRequests = Object.fromEntries(attempts);
    // Deadline stops future writes; allow bounded fresh-retention cleanup before close.
    const exitTimer = setTimeout(() => { console.log(publicJson()); process.exit(1); }, 8000);
    await cleanup(); clearTimeout(exitTimer);
    console.log(publicJson()); process.exit(1);
  }, 300000);
  timer.unref();
  const get = async url => {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(remaining(8000))]) });
    assert.equal(response.ok, true); return response;
  };
  const clients = RPCS.slice(0, 2).map(url => createPublicClient({ chain: sepolia, transport: http(url, { timeout: 8000, retryCount: 0 }) }));
  const rpc = clients[0];
  const read = (client, address, abi, functionName, args, blockNumber) => client.readContract({ address, abi, functionName, ...(args ? { args } : {}), ...(blockNumber === undefined ? {} : { blockNumber }) });
  const events = (receipt, address, abi) => receipt.logs.filter(log => same(log.address, address)).flatMap(log => {
    try { return [decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true })]; } catch { return []; }
  });
  const mined = async (kind, result, expectedTo) => {
    const hash = result.transactionHash;
    assert.match(hash, /^0x[0-9a-f]{64}$/i);
    if (!evidence.submitted.some(item => same(item.hash, hash))) evidence.submitted.push({ kind, hash });
    const receipt = await rpc.waitForTransactionReceipt({ hash, timeout: remaining(65000), pollingInterval: 2000, retryCount: 0 });
    assert.equal(receipt.status, 'success');
    const tx = await rpc.getTransaction({ hash });
    assert.equal(Number(tx.chainId), CHAIN); assert.ok(same(tx.to, expectedTo));
    const second = await clients[1].waitForTransactionReceipt({ hash, timeout: remaining(15000), pollingInterval: 2000, retryCount: 0 });
    assert.equal(second.status, 'success'); assert.ok(same(second.blockHash, receipt.blockHash));
    const item = { kind, hash, wallet: evidence.wallet, chainId: CHAIN, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash, gasUsed: receipt.gasUsed.toString(), effectiveGasPrice: receipt.effectiveGasPrice.toString(), gasCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(), sponsor: tx.from, to: tx.to };
    evidence.receipts.push(item);
    return { receipt, tx };
  };
  try {
    // Before network, browser, keys or broadcasts: consent and private ignored run.
    retention = await createHarnessRetention();
    stage = 'read-only attach preflight';
    const [health, partner] = await Promise.all([(await get(`${SQ}/health`)).json(), (await get(`${PARTNER}/health`)).json()]);
    assert.equal(health.ok, true); assert.equal(health.chainId, CHAIN); assert.equal(health.mock, true);
    assert.equal(health.strictSponsorship, true); assert.ok(health.features.includes('strictSponsorship'));
    assert.equal(partner.service, 'partner'); assert.equal(partner.status, 'ok'); assert.equal(partner.mock, true);
    await Promise.all([get(WALLET), get(TOOL)]);
    assert.deepEqual(await Promise.all(clients.map(client => client.getChainId())), [CHAIN, CHAIN]);
    // Fixed public build path only; never read a key/env/service storage file.
    const portable = await readFile(new URL('../../apps/recovery-tool/dist/index.html', import.meta.url), 'utf8');
    assert.ok(portable.includes('data-tab="verify"') && portable.includes('check-current-owner'));
    evidence.toolBuildSha256 = createHash('sha256').update(portable).digest('hex');
    evidence.health = { chainId: health.chainId, strictSponsorship: health.strictSponsorship, mock: health.mock };
    const playwright = await import('playwright');
    const browserEnv = Object.fromEntries(['PATH', 'HOME', 'LANG', 'LD_LIBRARY_PATH', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || playwright.chromium.executablePath(), env: browserEnv, timeout: remaining() });
    walletContext = await browser.newContext({ serviceWorkers: 'block' });
    const toolContext = await browser.newContext({ serviceWorkers: 'block' });
    const walletOrigins = new Set([WALLET, TOOL, SQ, PARTNER]);
    const inspect = async route => {
      const request = route.request(); const url = new URL(request.url()); const body = request.postData() || '';
      if (url.href === new URL('../../apps/recovery-tool/dist/index.html', import.meta.url).href && request.method() === 'GET') return route.continue();
      if (words && `${request.url()} ${body}`.includes(words)) { leak = true; return route.abort(); }
      if (devicePassphrase && `${request.url()} ${body}`.includes(devicePassphrase)) { leak = true; return route.abort(); }
      if (RPCS.includes(url.origin) && url.href === `${url.origin}/`) {
        let calls; try { const data = JSON.parse(body); calls = Array.isArray(data) ? data : [data]; } catch { networkViolation = true; return route.abort(); }
        if (request.method() !== 'POST' || !calls.every(call => READS.has(call.method))) { networkViolation = true; return route.abort(); }
        return route.continue();
      }
      if (!walletOrigins.has(url.origin) || url.username || url.password) { networkViolation = true; return route.abort(); }
      if (url.origin === SQ && request.method() === 'POST') {
        if (!SERVICE_POSTS.has(url.pathname)) { networkViolation = true; return route.abort(); }
        if (WRITE_PATHS.has(url.pathname)) {
          const count = (attempts.get(url.pathname) || 0) + 1; attempts.set(url.pathname, count);
          if (count !== 1 || (url.pathname === '/account/withdraw' && process.env.ALLOW_SEPOLIA_BROWSER_FUND !== 'yes')) { networkViolation = true; return route.abort(); }
          const data = JSON.parse(body);
          assert.ok(performance.now() < deadline);
          await retention.guardWrite(walletContext, { owner: url.pathname === '/relay/deploy' ? data.owner : evidence.owner, wallet: evidence.wallet, deploy: url.pathname === '/relay/deploy' });
          if (url.pathname === '/relay/deploy') {
            // UI generates the owner, guardian addresses and salt. Deploy must be unsigned.
            assert.equal(data.chainId, CHAIN); assert.equal(data.signature, undefined); assert.equal(data.ownershipProof, undefined);
            deployment = { ...data, saltNonce: BigInt(data.saltNonce) };
            assert.equal(data.initializer, buildWalletInitializer(deployment));
            const proxy = await read(rpc, ADDRESSES.factory, factoryAbi, 'proxyCreationCode');
            assert.ok(same(data.wallet, computeWalletAddress(deployment, proxy)));
            const code = await rpc.getCode({ address: data.wallet }); assert.ok(!code || code === '0x');
            evidence.wallet = data.wallet; evidence.owner = data.owner;
            assert.ok(!same(data.wallet, recipient) && !same(data.owner, recipient));
          } else if (url.pathname === '/account/withdraw') {
            assert.equal(data.amount, '1000000'); assert.ok(same(data.to, evidence.wallet));
          } else {
            assert.ok(same(data.wallet, evidence.wallet)); assert.ok(['payment', 'pay'].includes(data.source));
            ownerPayment = data;
            const tx = safeTxFromWire(data.tx);
            assert.equal(tx.value, 0n); assert.equal(tx.operation, 0); assert.ok(same(tx.to, ADDRESSES.usdc));
            for (const field of ['safeTxGas', 'baseGas', 'gasPrice']) assert.equal(tx[field], 0n);
            for (const field of ['gasToken', 'refundReceiver']) assert.match(tx[field], /^0x0{40}$/i);
            const call = decodeFunctionData({ abi: erc20Abi, data: tx.data });
            assert.equal(call.functionName, 'transfer'); assert.ok(same(call.args[0], recipient)); assert.equal(call.args[1], 1000000n);
            const signer = await recoverTypedDataAddress({ ...safeTxTypedData(data.wallet, tx, CHAIN), signature: data.signature });
            assert.ok(same(signer, evidence.owner)); assert.equal(data.stepUpToken, undefined);
          }
        } else if (url.pathname === '/wallets') proof = JSON.parse(body).ownershipProof;
      }
      if (url.origin === PARTNER && request.method() === 'POST' && url.pathname !== '/enroll') { networkViolation = true; return route.abort(); }
      // A timeout/cleanup during validation must never release a paused write.
      if (url.origin === SQ && WRITE_PATHS.has(url.pathname) && request.method() === 'POST') {
        assert.equal(abort.signal.aborted, false); assert.equal(Boolean(cleanupPromise), false);
        assert.ok(performance.now() < deadline);
      }
      return route.continue();
    };
    // Reject unexpected methods/duplicates before service broadcast; never fulfill mocked responses.
    for (const context of [walletContext, toolContext]) await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (context === toolContext && ['http:', 'https:'].includes(url.protocol) && ![TOOL, ...RPCS].includes(url.origin)) { networkViolation = true; return route.abort(); }
      return inspect(route).catch(() => { networkViolation = true; return route.abort(); });
    });
    const page = await walletContext.newPage(); const tool = await toolContext.newPage();
    page.setDefaultTimeout(20000); tool.setDefaultTimeout(20000);
    const cdp = await walletContext.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    const idle = async () => { await page.locator('.status.info').waitFor({ state: 'hidden', timeout: remaining(85000) }); assert.equal(await page.locator('.status.error').count(), 0); };
    const click = async name => { await page.getByRole('button', { name }).click({ timeout: remaining() }); await idle(); };
    const actionResponse = async (path, action) => {
      const pending = page.waitForResponse(response => response.url() === `${SQ}${path}` && response.request().method() === 'POST', { timeout: remaining(65000) });
      void pending.catch(() => {}); // A failed click must not leave an unhandled timeout.
      await action(); const response = await pending; const result = await response.json();
      const kind = { '/relay/deploy': 'deploy', '/account/withdraw': 'mock-account-funding', '/relay/safe-tx': 'owner-payment-1-usdc' }[path];
      if (kind && /^0x[0-9a-f]{64}$/i.test(result.transactionHash || '')) evidence.submitted.push({ kind, hash: result.transactionHash });
      assert.equal(response.ok(), true); return result;
    };
    stage = 'offline independent card and public-tool default';
    // The portable HTML is loaded without network; generation stays in a separate browser context.
    await toolContext.setOffline(true);
    await tool.goto(new URL('../../apps/recovery-tool/dist/index.html', import.meta.url).href, { timeout: remaining() });
    assert.equal(await tool.locator('#network').innerText(), 'SEPOLIA · two pinned public nodes');
    await tool.locator('#generate').click(); words = (await tool.locator('#words li').allTextContents()).join(' ');
    assert.equal(words.split(/\s+/).length, 12);
    const guardian = await tool.locator('#guardian').innerText(); assert.ok(isAddress(guardian));
    devicePassphrase = `Device-${randomUUID()}`;
    await retention.retainCredentials({ devicePassphrase, cardWords: words });
    evidence.retention = { status: 'private_credentials_saved_before_deploy', runId: retention.runId };
    evidence.checks.push('separate context generated 12-word card offline; portable build defaults to Sepolia');
    stage = 'fresh registration and actual WebAuthn verification';
    await page.goto(WALLET, { timeout: remaining() });
    await page.locator('.sidebar-bottom').filter({ hasText: 'Sepolia test network' }).waitFor({ timeout: remaining() });
    await click('New here? Create a login');
    await page.getByLabel('Email address').fill(`sepolia-browser-${randomUUID()}@example.test`);
    await page.getByLabel('Login password').fill(`Login-${randomUUID()}`);
    const registration = await actionResponse('/auth/passkey/register/verify', () => page.getByRole('button', { name: /Create with a passkey/ }).click());
    assert.equal(registration.authMethod, 'passkey');
    evidence.checks.push('fresh password registration and service-verified WebAuthn enrollment; virtual authenticator only');
    await idle(); await page.getByRole('heading', { name: 'Create your self-custody wallet' }).waitFor({ timeout: remaining() });
    stage = 'MOCK KYC';
    const kyc = await actionResponse('/kyc/mock-verify', () => page.getByRole('button', { name: 'MOCK KYC: mark identity verified' }).click());
    assert.equal(kyc.mock, true); assert.equal(kyc.kycVerified, true); await idle();
    stage = 'unsigned UI deployment via service RELAYER';
    await page.getByLabel('Create a device passphrase').fill(devicePassphrase);
    // Pre-click export may contain auth only; interception exports and verifies the
    // newly encrypted owner before /relay/deploy is permitted to reach the service.
    await retention.snapshot(walletContext);
    await page.getByLabel('Recovery card public address').fill(guardian);
    const deployed = await actionResponse('/relay/deploy', () => page.getByRole('button', { name: /Create my wallet/ }).click());
    assert.ok(same(deployed.wallet, evidence.wallet));
    await retention.snapshot(walletContext, { owner: evidence.owner, requireDevice: true });
    const deployChain = await mined('deploy', deployed, ADDRESSES.factory);
    const creation = events(deployChain.receipt, ADDRESSES.factory, factoryAbi).find(event => event.eventName === 'ProxyCreation');
    assert.ok(creation && same(creation.args.proxy, evidence.wallet) && same(creation.args.singleton, ADDRESSES.safeL2));
    assert.ok(!same(deployChain.tx.from, evidence.owner) && !same(deployChain.tx.from, evidence.wallet));
    evidence.relayer = deployChain.tx.from;
    await idle(); await page.getByText('Verified as yours', { exact: true }).waitFor({ timeout: remaining() });
    // Wallet/setup binding occurs after mined deploy. Retain it before any funding.
    await retention.snapshot(walletContext, { owner: evidence.owner, wallet: evidence.wallet, requireDevice: true });
    evidence.retention = { status: 'encrypted_device_passphrase_and_card_saved_before_funding', runId: retention.runId };
    stage = 'fresh EIP-1271 ownership and deterministic creation checks';
    assert.ok(proof && same(proof.hash, hashMessage(proof.message)));
    assert.equal(await read(rpc, evidence.wallet, fallbackHandlerAbi, 'isValidSignature', [proof.hash, proof.signature]), '0x1626ba7e');
    evidence.ownershipProofHash = proof.hash;
    const setupCode = await page.getByLabel('Wallet setup code').inputValue(); const setup = decodeSetupCode(setupCode);
    assert.equal(setup.chainId, CHAIN); assert.ok(same(setup.wallet, evidence.wallet) && same(setup.owner, evidence.owner));
    for (const client of clients) {
      const blockNumber = deployChain.receipt.blockNumber;
      assert.equal(keccak256(await client.getCode({ address: evidence.wallet, blockNumber })), PROXY_RUNTIME_CODE_HASH);
      assert.deepEqual((await read(client, evidence.wallet, safeAbi, 'getOwners', undefined, blockNumber)).map(a => a.toLowerCase()), [evidence.owner.toLowerCase()]);
      assert.equal(await read(client, evidence.wallet, safeAbi, 'getThreshold', undefined, blockNumber), 1n);
      assert.equal(await read(client, evidence.wallet, safeAbi, 'nonce', undefined, blockNumber), 0n);
      assert.equal(await client.getBalance({ address: evidence.owner, blockNumber }), 0n);
    }
    evidence.checks.push('factory ProxyCreation matches fresh deterministic wallet; two public receipts agree; real Safe code, sole owner, threshold one, nonce zero and EIP-1271 verified');
    stage = 'independent two-public-node card and wallet verification';
    await toolContext.setOffline(false); await tool.goto(TOOL, { timeout: remaining() });
    assert.equal(await tool.locator('#network').innerText(), 'SEPOLIA · two pinned public nodes');
    await tool.locator('[data-tab="verify"]').click();
    await tool.locator('#setup').fill('https://invalid.example/setup'); await tool.locator('#check-button').click();
    await tool.locator('#status[data-state="error"]').waitFor({ timeout: remaining() });
    assert.match(await tool.locator('#status').innerText(), /copy-paste code, not a link or JSON/);
    await tool.locator('#setup').fill(setupCode); await tool.locator('#check-words').fill(Array(24).fill('abandon').join(' '));
    await tool.locator('#check-button').click(); await tool.locator('#status[data-state="error"]').waitFor({ timeout: remaining() });
    assert.match(await tool.locator('#status').innerText(), /12 recovery-card words/);
    evidence.checks.push('served tool rejects setup links and synthetic 24-word input; never supplied an owner seed');
    await tool.locator('#check-words').fill(words); await tool.locator('#check-current-owner').fill(evidence.owner);
    await tool.locator('#check-button').click(); await tool.locator('#status[data-state="success"]').waitFor({ timeout: remaining(65000) });
    assert.match(await tool.locator('#status').innerText(), /Both RPC checks passed/);
    assert.equal(await tool.locator('#check-words').inputValue(), '');
    await page.getByRole('checkbox', { name: 'I personally saw a green result in the independent tool.', exact: true }).check();
    evidence.checks.push('actual independent tool verified original initializer, expected current owner and card on both recovery paths using pinned public history nodes');
    stage = 'optional single MOCK-account real 1 USDC funding';
    // Token contract supplies the balance. No faucet, clock, reset or balance override.
    const walletUsdc = await read(rpc, ADDRESSES.usdc, erc20Abi, 'balanceOf', [evidence.wallet]);
    if (walletUsdc < 1000000n) {
      assert.equal(walletUsdc, 0n); assert.equal(process.env.ALLOW_SEPOLIA_BROWSER_FUND, 'yes');
      await page.getByLabel('Amount in USDC', { exact: true }).fill('1');
      const funding = await actionResponse('/account/withdraw', () => page.getByRole('button', { name: /Move to my wallet/ }).click());
      const funded = await mined('mock-account-funding', funding, ADDRESSES.usdc);
      assert.equal(funding.mock, true);
      const transfer = events(funded.receipt, ADDRESSES.usdc, transferAbi).find(event => same(event.args.from, funded.tx.from) && same(event.args.to, evidence.wallet) && event.args.value === 1000000n);
      assert.ok(transfer); evidence.mockAccountSender = funded.tx.from;
      await idle();
    }
    stage = 'single 1 USDC owner-signed payment with strict screening';
    const [primaryHead, secondaryHead] = await Promise.all(clients.map(client => client.getBlockNumber({ cacheTime: 0 })));
    const beforeBlock = primaryHead < secondaryHead ? primaryHead : secondaryHead;
    const beforeHashes = await Promise.all(clients.map(client => client.getBlock({ blockNumber: beforeBlock })));
    assert.ok(same(beforeHashes[0].hash, beforeHashes[1].hash));
    evidence.beforePaymentBlock = { number: beforeBlock.toString(), hash: beforeHashes[0].hash };
    const beforeWallet = await read(rpc, ADDRESSES.usdc, erc20Abi, 'balanceOf', [evidence.wallet], beforeBlock);
    const beforeRecipient = await read(rpc, ADDRESSES.usdc, erc20Abi, 'balanceOf', [recipient], beforeBlock);
    const beforeNonce = await read(rpc, evidence.wallet, safeAbi, 'nonce', undefined, beforeBlock);
    assert.equal(beforeNonce, 0n); assert.ok(beforeWallet >= 1000000n);
    await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('button', { name: '↗ Pay', exact: true }).click();
    await page.getByLabel('Recipient wallet address').fill(recipient); await page.getByLabel('Amount in USDC', { exact: true }).fill('1');
    await click(/Review payment/);
    const suffix = page.getByLabel('Recipient last four characters');
    if (await suffix.count()) await suffix.fill(recipient.slice(-4)); // Actual payPreview first-recipient guard.
    const payment = await actionResponse('/relay/safe-tx', () => page.getByRole('button', { name: 'Sign & send', exact: true }).click());
    assert.equal(payment.classification, 'Small'); assert.ok(payment.screening?.ok); assert.deepEqual(payment.screening.hits, []);
    const sources = payment.screening.sources;
    assert.ok(sources.some(source => source.startsWith('RedStone OFAC/EU/UN-derived sanctions oracle: clear (updated ')));
    for (const token of [ADDRESSES.usdc, DAPP_ADDRESSES.eurc]) assert.ok(sources.some(source => source.toLowerCase().startsWith(`circle issuer freeze list ${token.toLowerCase()}: clear`)));
    assert.ok(!sources.some(source => /local fixture|required.*unavailable/i.test(source)));
    // Do not persist arbitrary service strings: report only recognized public source categories.
    evidence.screening = { checkedAt: new Date(payment.screening.checkedAt).toISOString(), requiredLiveSanctionsClear: true, requiredIssuerFreezeListsClear: true, secondaryChainalysisLimited: true, warningCount: payment.screening.warnings.length, identityStillMock: true };
    assert.ok(same(payment.hash, hashSafeTx(evidence.wallet, safeTxFromWire(ownerPayment.tx), CHAIN)));
    const paid = await mined('owner-payment-1-usdc', payment, evidence.wallet);
    assert.ok(same(paid.tx.from, evidence.relayer));
    const safeEvents = events(paid.receipt, evidence.wallet, safeAbi);
    assert.ok(!safeEvents.some(event => event.eventName === 'ExecutionFailure'));
    assert.ok(safeEvents.some(event => event.eventName === 'ExecutionSuccess' && same(event.args.txHash, payment.hash) && event.args.payment === 0n));
    assert.ok(events(paid.receipt, ADDRESSES.usdc, transferAbi).some(event => same(event.args.from, evidence.wallet) && same(event.args.to, recipient) && event.args.value === 1000000n));
    for (const client of clients) {
      const blockNumber = paid.receipt.blockNumber;
      assert.equal(await read(client, evidence.wallet, safeAbi, 'nonce', undefined, blockNumber), beforeNonce + 1n);
      assert.equal(await read(client, ADDRESSES.usdc, erc20Abi, 'balanceOf', [evidence.wallet], blockNumber), beforeWallet - 1000000n);
      assert.equal(await read(client, ADDRESSES.usdc, erc20Abi, 'balanceOf', [recipient], blockNumber), beforeRecipient + 1000000n);
      assert.equal(await client.getBalance({ address: evidence.owner, blockNumber }), 0n);
      assert.equal(await client.getBalance({ address: evidence.wallet, blockNumber }), 0n);
    }
    await idle(); await page.getByText('Payment confirmed on chain.', { exact: true }).waitFor({ timeout: remaining() });
    assert.equal(leak, false); assert.equal(networkViolation, false);
    assert.equal(attempts.get('/relay/deploy'), 1); assert.equal(attempts.get('/relay/safe-tx'), 1); assert.ok(evidence.receipts.length <= 3);
    evidence.payment = { recipient, amountBaseUnits: '1000000', safeTxHash: payment.hash, nonceBefore: beforeNonce.toString(), nonceAfter: (beforeNonce + 1n).toString(), ownerEthAfterWei: '0', walletEthAfterWei: '0' };
    evidence.checks.push('one owner-signed Small payment; required live screening clear; same service relayer paid gas; Safe success event, exact Transfer and two-node USDC/nonce effects; owner and Safe ETH remain zero; card words never sent');
    evidence.outcome = 'passed';
  } finally {
    abort.abort(); clearTimeout(timer);
    const cleanupTimer = setTimeout(() => {
      evidence.outcome = 'incomplete_cleanup_deadline_inspect_private_run_locally';
      console.log(publicJson()); process.exit(1);
    }, 8000);
    await cleanup(); clearTimeout(cleanupTimer);
  }
}

try { await run(); }
catch (error) {
  evidence.outcome = attempts.size ? 'incomplete_inspect_service_and_public_chain_before_any_retry' : 'blocked_before_broadcast_attempt';
  evidence.broadcastRequests = Object.fromEntries(attempts);
  evidence.blocker = { stage, category: error?.name === 'TimeoutError' ? 'bounded_browser_timeout' : error?.code === 'ERR_ASSERTION' ? 'contract_or_configuration_assertion' : 'redacted_runtime_error' };
  // Never print browser exceptions, post bodies, auth responses, storage, seed, words or kit.
  process.exitCode = 1;
}
console.log(publicJson());
