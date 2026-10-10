// SOURCE-PREPARED ONLY. Never invoke as part of normal tests or start/restart services.
// Future lead-only invocation requires all three exact opt-ins below. No keys/env/DB reads.
// ALLOW_SEPOLIA_PAYMENT_RESUME=yes ALLOW_SEPOLIA_LOCAL_RETENTION=yes
// SEPOLIA_RETAINED_RUN=e1490f6e-9acc-4fb0-b640-472b6806000c
// node --import tsx tests/browser/sepolia-payment-resume.mjs
// Attach to existing G10 ports only. No auth creation/refresh, funding, deployment,
// recovery, screening bypass, API preview, passkey step-up, or automatic payment retry.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, open, realpath, readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createPublicClient, http, keccak256, decodeFunctionData, encodeFunctionData, decodeEventLog, recoverTypedDataAddress, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { ADDRESSES, DAPP_ADDRESSES, DAPP_CODE_PINS, CONTRACT_CODE_HASHES, PROXY_RUNTIME_CODE_HASH, GUARD_STORAGE_SLOT, FALLBACK_STORAGE_SLOT, safeAbi, erc20Abi, moduleAbi, MODULES, SENTINEL_ADDRESS, safeTxFromWire, safeTxTypedData, hashSafeTx } from '../../packages/protocol/src/index.ts';
import { hasEncryptedDevice, createLiveRetention } from './live-retention.mjs';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const RUN = 'e1490f6e-9acc-4fb0-b640-472b6806000c';
const CHAIN = 11155111;
const UI = 'http://localhost:5273', TOOL = 'http://localhost:5274';
const SQ = 'http://localhost:4101', PARTNER = 'http://localhost:4102';
const WALLET = '0xa1fFBa9b87CD2253108fC67252E4fc2985088CFa';
const OWNER = '0xe2A8f6c183C96834f5A9cF93e57229B3b4D624fE';
const RECIPIENT = '0xB2F61CfeA95A87017FcdF539A0556158ed1b6B71';
const RELAYER = '0x6fc61DCE369786CFbf43536478C4CD521B4336f7';
const RPCS = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.ethpandaops.io'];
const READS = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_call', 'eth_getCode', 'eth_getStorageAt', 'eth_getBalance', 'eth_getLogs', 'eth_getTransactionReceipt', 'eth_getTransactionByHash']);
const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const fail = () => new Error('Resume guard failed.');
// No arbitrary response strings, exception messages, request bodies, auth, or storage enter output.
const evidence = { schema: 'sepolia-payment-resume-v1', outcome: 'not_run', chainId: CHAIN, originalRunId: RUN, wallet: WALLET, owner: OWNER, recipient: RECIPIENT, expectedSponsor: RELAYER, paymentPostAttempts: 0, paymentPostsReleased: 0, prior: { deployHash: '0xf6ce16bfaedaebc412ab845850de34f6b7b044c24e64ec31d601d6d2eaf98f00', deployBlock: '11887171', fundingHash: '0xe92f5ebb7ccfb6e26003567ff45b39923a8a8f1704ee978a29258221419db2d7', fundingBlock: '11887172' }, identity: 'MOCK KYC; existing account only', recovery: 'not tested', portableTool: 'original run already verified; not repeated' };
let browser, context, retention, secrets, original, stage = 'authorization', deadline = 0;
let authorized = false, violated = false, stopping = false, cleanupPromise, signedTx, originalAuthorization;
const abort = new AbortController();
const remaining = (cap = 15000) => { const ms = Math.floor(deadline - performance.now()); if (ms <= 0 || stopping) throw fail(); return Math.min(ms, cap); };

function checkStat(stat, mode, directory, initial) {
  if (stat.isSymbolicLink() || stat.uid !== BigInt(process.getuid()) || (stat.mode & 0o777n) !== BigInt(mode) || (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1n) || (initial && (stat.ino !== initial.ino || stat.dev !== initial.dev))) throw fail();
}
async function loadOriginal() {
  // Exact source-root directory, never an environment-selected path. No original writes.
  if (resolve(process.cwd()) !== ROOT || await realpath(ROOT) !== ROOT) throw fail();
  const ignored = (await readFile(join(dirname(ROOT), '.gitignore'), 'utf8')).split(/\r?\n/).map(line => line.trim());
  const index = ignored.indexOf('swissquote-wallet/.sepolia-runs/');
  if (index < 0 || ignored.slice(index + 1).some(line => line.startsWith('!'))) throw fail();
  const paths = [join(ROOT, '.sepolia-runs'), join(ROOT, '.sepolia-runs', RUN)];
  const directories = [], files = [];
  const verify = async () => {
    if (await realpath(ROOT) !== ROOT) throw fail();
    for (const item of directories) {
      checkStat(await lstat(item.path, { bigint: true }), 0o700, true, item.stat);
      checkStat(await item.handle.stat({ bigint: true }), 0o700, true, item.stat);
      if (await realpath(item.path) !== item.path) throw fail();
    }
    for (const item of files) {
      checkStat(await lstat(item.path, { bigint: true }), 0o600, false, item.stat);
      checkStat(await item.handle.stat({ bigint: true }), 0o600, false, item.stat);
    }
  };
  const close = async () => { await Promise.all([...files, ...directories].map(item => item.handle.close().catch(() => {}))); };
  try {
    for (const path of paths) {
      const stat = await lstat(path, { bigint: true }); checkStat(stat, 0o700, true);
      if (await realpath(path) !== path) throw fail();
      const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      directories.push({ path, stat, handle }); await verify();
    }
    for (const name of ['recovery-private.json', 'browser-state-0.json', 'browser-state-1.json']) {
      const path = join(paths[1], name);
      const stat = await lstat(path, { bigint: true }); checkStat(stat, 0o600, false);
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      files.push({ path, stat, handle }); await verify();
    }
    const boundedJson = async (item, max, empty = false) => {
      await verify();
      const before = await item.handle.stat({ bigint: true });
      if (before.size > BigInt(max) || (!empty && before.size === 0n)) throw fail();
      if (before.size === 0n) return undefined;
      const bytes = Buffer.alloc(Number(before.size)); let offset = 0;
      while (offset < bytes.length) {
        const result = await item.handle.read(bytes, offset, bytes.length - offset, offset);
        if (!result.bytesRead) throw fail(); offset += result.bytesRead;
      }
      const after = await item.handle.stat({ bigint: true }); await verify();
      if (after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs) throw fail();
      return { value: JSON.parse(bytes.toString('utf8')), stamp: after.mtimeNs, bytes };
    };
    const credentials = (await boundedJson(files[0], 16384)).value;
    assert.equal(Object.keys(credentials).sort().join(','), 'cardWords,devicePassphrase,schema');
    assert.equal(credentials.schema, 'sepolia-local-recovery-v1');
    assert.ok(typeof credentials.devicePassphrase === 'string' && credentials.devicePassphrase.length >= 12 && credentials.devicePassphrase.length <= 1024);
    assert.ok(typeof credentials.cardWords === 'string' && credentials.cardWords.length <= 1024 && credentials.cardWords.trim().split(/\s+/).length === 12);
    const candidates = [];
    for (const item of files.slice(1)) {
      const loaded = await boundedJson(item, 4 * 1024 * 1024, true);
      if (!loaded) continue; // An untouched alternate slot may be empty.
      const state = loaded.value;
      assert.equal(Object.keys(state).sort().join(','), 'cookies,origins');
      assert.ok(Array.isArray(state.cookies) && state.cookies.length <= 64);
      assert.ok(state.cookies.every(cookie => ['localhost', '.localhost'].includes(cookie.domain)));
      assert.ok(Array.isArray(state.origins) && state.origins.length <= 4);
      assert.ok(state.origins.every(origin => [UI, TOOL, SQ, PARTNER].includes(origin.origin) && Array.isArray(origin.localStorage) && origin.localStorage.length <= 64));
      assert.equal(hasEncryptedDevice(state, { owner: OWNER, wallet: WALLET }), true);
      assert.equal(hasEncryptedDevice({ origins: state.origins.filter(origin => origin.origin === UI) }, { owner: OWNER, wallet: WALLET }), true);
      candidates.push(loaded);
    }
    assert.ok(candidates.length > 0);
    candidates.sort((a, b) => a.stamp > b.stamp ? -1 : a.stamp < b.stamp ? 1 : 0);
    // Retention writes raw state, with no version wrapper. Filesystem mtimeNs is the
    // only available completed-slot order; conflicting equal timestamps fail closed.
    if (candidates.length === 2 && candidates[0].stamp === candidates[1].stamp && !candidates[0].bytes.equals(candidates[1].bytes)) throw fail();
    await verify();
    return { state: candidates[0].value, credentials, verify, close };
  } catch { await close(); throw fail(); }
}

const cleanup = () => cleanupPromise ??= (async () => {
  stopping = true; authorized = false; abort.abort();
  try {
    // Save raw encrypted IndexedDB + original auth again before destroying context.
    if (retention && context) await retention.snapshot(context, { owner: OWNER, wallet: WALLET, requireDevice: true });
  } catch { evidence.outcome = 'retention_failed_inspect_locally_no_retry'; process.exitCode = 1; }
  finally {
    if (retention) await retention.close().catch(() => { evidence.outcome = 'retention_failed_inspect_locally_no_retry'; process.exitCode = 1; });
    if (browser) await browser.close().catch(() => {});
    if (original) await original.close();
    secrets = undefined;
  }
})();

async function run() {
  assert.equal(process.env.ALLOW_SEPOLIA_PAYMENT_RESUME, 'yes');
  assert.equal(process.env.ALLOW_SEPOLIA_LOCAL_RETENTION, 'yes');
  assert.equal(process.env.SEPOLIA_RETAINED_RUN, RUN);
  if (process.env.SEPOLIA_BROWSER_CHAIN_ID !== undefined) assert.equal(process.env.SEPOLIA_BROWSER_CHAIN_ID, String(CHAIN));
  deadline = performance.now() + 180000;
  // Reserve the final 8s within (not after) the hard 180s limit for retention/close.
  const hardTimer = setTimeout(() => {
    stopping = true; authorized = false; abort.abort();
    evidence.outcome = 'hard_deadline_inspect_locally_and_public_chain_no_retry';
    console.log(JSON.stringify(evidence, null, 2)); process.exit(1);
  }, 180000);
  const stopTimer = setTimeout(() => {
    evidence.outcome = 'deadline_inspect_locally_and_public_chain_no_retry'; process.exitCode = 1;
    void cleanup();
  }, 172000);
  const get = async url => {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(remaining(8000))]) });
    assert.equal(response.ok, true); return response;
  };
  const clients = RPCS.map(url => createPublicClient({ chain: sepolia, transport: http(url, { timeout: 8000, retryCount: 0, methods: { include: [...READS] }, fetchFn: (input, init) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.ok(RPCS.includes(target.origin) && target.href === `${target.origin}/` && init?.method === 'POST');
    const parsed = JSON.parse(String(init.body)), calls = Array.isArray(parsed) ? parsed : [parsed];
    assert.ok(calls.length > 0 && calls.every(call => READS.has(call.method)));
    remaining();
    return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(remaining(8000)), ...(init.signal ? [init.signal] : [])]) });
  } }) }));
  const read = (client, address, abi, functionName, blockNumber, args) => client.readContract({ address, abi, functionName, blockNumber, ...(args ? { args } : {}) });
  const preflight = async () => {
    remaining();
    const [health, sender] = await Promise.all([(await get(`${SQ}/health`)).json(), (await get(`${SQ}/relay/status`)).json()]);
    assert.equal(health.ok, true); assert.equal(health.service, 'swissquote'); assert.equal(health.chainId, CHAIN);
    assert.equal(health.strictSponsorship, true); assert.equal(health.mock, true); assert.ok(health.features.includes('strictSponsorship'));
    // Current health source does not expose screeningMode. Do not infer live
    // compliance from strictSponsorship or permit a locally mocked screen.
    assert.equal(health.screeningMode, 'live public-chain screening sources (availability and freshness enforced)');
    assert.equal(sender.chainId, CHAIN); assert.equal(sender.blocked, false); assert.equal(sender.status, 'idle');
    assert.deepEqual(await Promise.all(clients.map(client => client.getChainId())), [CHAIN, CHAIN]);
    const heads = await Promise.all(clients.map(client => client.getBlockNumber({ cacheTime: 0 })));
    const blockNumber = heads[0] < heads[1] ? heads[0] : heads[1];
    const blocks = await Promise.all(clients.map(client => client.getBlock({ blockNumber })));
    assert.ok(same(blocks[0].hash, blocks[1].hash));
    const rows = [];
    for (const client of clients) {
      for (const [address, expected] of Object.entries(CONTRACT_CODE_HASHES)) assert.equal(keccak256(await client.getCode({ address, blockNumber })), expected);
      const tokenPin = DAPP_CODE_PINS.find(pin => same(pin.address, ADDRESSES.usdc)); assert.ok(tokenPin);
      assert.equal(keccak256(await client.getCode({ address: tokenPin.address, blockNumber })), tokenPin.codeHash);
      for (const pin of tokenPin.slots ?? []) {
        assert.equal(BigInt(await client.getStorageAt({ address: tokenPin.address, slot: pin.slot, blockNumber })), BigInt(pin.address));
        const code = await client.getCode({ address: pin.address, blockNumber });
        if (pin.codeHash) assert.equal(keccak256(code), pin.codeHash); else assert.ok(code === undefined || code === '0x');
      }
      assert.equal(keccak256(await client.getCode({ address: WALLET, blockNumber })), PROXY_RUNTIME_CODE_HASH);
      assert.equal(BigInt(await client.getStorageAt({ address: WALLET, slot: '0x0', blockNumber })), BigInt(ADDRESSES.safeL2));
      assert.equal(BigInt(await client.getStorageAt({ address: WALLET, slot: GUARD_STORAGE_SLOT, blockNumber })), 0n);
      assert.equal(BigInt(await client.getStorageAt({ address: WALLET, slot: FALLBACK_STORAGE_SLOT, blockNumber })), BigInt(ADDRESSES.fallbackHandler));
      assert.deepEqual((await read(client, WALLET, safeAbi, 'getOwners', blockNumber)).map(a => a.toLowerCase()), [OWNER.toLowerCase()]);
      assert.equal(await read(client, WALLET, safeAbi, 'getThreshold', blockNumber), 1n);
      assert.equal(await read(client, WALLET, safeAbi, 'nonce', blockNumber), 0n);
      const [modules, next] = await read(client, WALLET, safeAbi, 'getModulesPaginated', blockNumber, [SENTINEL_ADDRESS, 3n]);
      assert.deepEqual(modules.map(a => a.toLowerCase()).sort(), MODULES.map(a => a.toLowerCase()).sort()); assert.ok(same(next, SENTINEL_ADDRESS));
      for (const module of MODULES) assert.equal((await read(client, module, moduleAbi, 'getRecoveryRequest', blockNumber, [WALLET])).executeAfter, 0n);
      assert.equal(await read(client, ADDRESSES.usdc, erc20Abi, 'balanceOf', blockNumber, [WALLET]), 1000000n);
      assert.equal(await client.getBalance({ address: OWNER, blockNumber }), 0n); assert.equal(await client.getBalance({ address: WALLET, blockNumber }), 0n);
      rows.push(await read(client, ADDRESSES.usdc, erc20Abi, 'balanceOf', blockNumber, [RECIPIENT]));
    }
    assert.equal(rows[0], rows[1]);
    return { blockNumber, blockHash: blocks[0].hash, recipientBalance: rows[0] };
  };
  try {
    stage = 'secure_original_restore'; original = await loadOriginal(); secrets = original.credentials;
    // createLiveRetention is exclusive: never pass RUN or try to append to original.
    retention = await createLiveRetention({ optIn: 'yes', runId: randomUUID(), walletCwd: ROOT });
    evidence.resumeRunId = retention.runId;
    await retention.retainCredentials({ devicePassphrase: secrets.devicePassphrase, cardWords: secrets.cardWords });
    stage = 'readonly_attach_preflight';
    await Promise.all([get(UI), get(TOOL)]); const partner = await (await get(`${PARTNER}/health`)).json();
    assert.equal(partner.service, 'partner'); assert.equal(partner.status, 'ok'); assert.equal(partner.mock, true);
    await preflight();
    await original.verify();
    const playwright = await import('playwright');
    const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'LD_LIBRARY_PATH', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    browser = await playwright.chromium.launch({ headless: true, env, timeout: remaining() });
    context = await browser.newContext({ storageState: original.state, serviceWorkers: 'block', acceptDownloads: false });
    await retention.snapshot(context, { owner: OWNER, wallet: WALLET, requireDevice: true });
    evidence.restore = 'raw_playwright_state_encrypted_device_bound_fresh_snapshot_saved';
    const inspect = async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method(), body = request.postData() ?? '';
      if (stopping || abort.signal.aborted || url.username || url.password) throw fail();
      let outbound = `${request.url()} ${body}`; try { outbound = decodeURIComponent(outbound); } catch { /* Keep raw. */ }
      if (outbound.includes(secrets.devicePassphrase) || outbound.includes(secrets.cardWords) || secrets.cardWords.trim().split(/\s+/).every(word => outbound.includes(`"${word}"`))) throw fail();
      if (RPCS.includes(url.origin) && url.href === `${url.origin}/`) {
        const parsed = JSON.parse(body), calls = Array.isArray(parsed) ? parsed : [parsed];
        assert.ok(method === 'POST' && calls.length > 0 && calls.every(call => READS.has(call.method))); return route.continue();
      }
      if (url.origin === UI && method === 'GET') return route.continue();
      if (url.origin !== SQ || url.search || url.hash) throw fail();
      const readPaths = new Set(['/account', `/wallets/${WALLET}`, `/wallets/${WALLET.toLowerCase()}`, '/health', '/relay/status']);
      if (method === 'GET' && readPaths.has(url.pathname)) {
        if (url.pathname === '/account' || url.pathname.startsWith('/wallets/')) {
          const auth = request.headers().authorization;
          assert.ok(typeof auth === 'string' && /^Bearer [A-Za-z0-9_-]{16,1024}$/.test(auth));
          if (originalAuthorization === undefined) originalAuthorization = auth; else assert.equal(auth, originalAuthorization);
        }
        return route.continue();
      }
      if (method === 'OPTIONS' && (readPaths.has(url.pathname) || url.pathname === '/relay/safe-tx')) return route.continue();
      if (method !== 'POST' || url.pathname !== '/relay/safe-tx') throw fail();
      evidence.paymentPostAttempts++;
      assert.equal(evidence.paymentPostAttempts, 1); assert.equal(authorized, true); authorized = false;
      assert.ok(typeof originalAuthorization === 'string'); assert.equal(request.headers().authorization, originalAuthorization);
      assert.ok(body.length <= 16384);
      const data = JSON.parse(body);
      assert.ok(Object.keys(data).every(key => ['wallet', 'tx', 'signature', 'source', 'chainId'].includes(key)));
      assert.ok(same(data.wallet, WALLET)); assert.equal(data.chainId, CHAIN); assert.ok(['payment', 'pay'].includes(data.source));
      signedTx = safeTxFromWire(data.tx);
      assert.equal(signedTx.nonce, 0n); assert.equal(signedTx.value, 0n); assert.equal(signedTx.operation, 0); assert.ok(same(signedTx.to, ADDRESSES.usdc));
      for (const field of ['safeTxGas', 'baseGas', 'gasPrice']) assert.equal(signedTx[field], 0n);
      for (const field of ['gasToken', 'refundReceiver']) assert.equal(BigInt(signedTx[field]), 0n);
      const call = decodeFunctionData({ abi: erc20Abi, data: signedTx.data });
      assert.equal(call.functionName, 'transfer'); assert.ok(same(call.args[0], RECIPIENT)); assert.equal(call.args[1], 1000000n);
      assert.equal(signedTx.data.toLowerCase(), encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECIPIENT, 1000000n] }).toLowerCase());
      assert.ok(same(await recoverTypedDataAddress({ ...safeTxTypedData(WALLET, signedTx, CHAIN), signature: data.signature }), OWNER));
      await original.verify();
      evidence.before = await preflight(); evidence.before = { blockNumber: evidence.before.blockNumber.toString(), blockHash: evidence.before.blockHash, recipientBalance: evidence.before.recipientBalance.toString() };
      await retention.guardWrite(context, { owner: OWNER, wallet: WALLET });
      assert.equal(violated, false); remaining(); assert.equal(stopping, false); assert.equal(Boolean(cleanupPromise), false);
      evidence.safeTxHash = hashSafeTx(WALLET, signedTx, CHAIN); evidence.paymentPostsReleased++;
      return route.continue();
    };
    await context.route('**/*', route => inspect(route).catch(() => { violated = true; authorized = false; return route.abort(); }));
    // No HMR/socket or hidden alternate transport may carry a mutation.
    await context.routeWebSocket('**/*', socket => socket.close());
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('response', response => { if (response.url().startsWith(SQ) && response.status() === 401) { violated = true; authorized = false; } });
    stage = 'same_auth_ui_restore'; await page.goto(UI, { timeout: remaining() });
    // Source App session is currently memory-only. Raw storage cannot invent it.
    // If existing state cannot restore the exact session, STOP rather than login/inject.
    await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor({ timeout: remaining(8000) });
    await page.getByText('Verified as yours', { exact: true }).waitFor({ timeout: remaining() });
    assert.equal(violated, false);
    stage = 'ui_device_unlock';
    await page.getByLabel('Device passphrase', { exact: true }).fill(secrets.devicePassphrase);
    await page.getByRole('button', { name: 'Unlock device', exact: true }).click({ timeout: remaining() });
    await page.getByText('Device key locked', { exact: true }).waitFor({ state: 'hidden', timeout: remaining() });
    assert.equal(await page.locator('.status.error').count(), 0);
    stage = 'single_small_payment_ui_review';
    await page.getByRole('navigation', { name: 'Wallet navigation', exact: true }).getByRole('button', { name: '↗ Pay', exact: true }).click({ timeout: remaining() });
    await page.getByLabel('Recipient wallet address').fill(RECIPIENT); await page.getByLabel('Amount in USDC', { exact: true }).fill('1');
    await page.getByRole('button', { name: /Review payment/ }).click({ timeout: remaining() });
    const suffix = page.getByLabel('Recipient last four characters'); if (await suffix.count()) await suffix.fill(RECIPIENT.slice(-4));
    await retention.guardWrite(context, { owner: OWNER, wallet: WALLET });
    assert.equal(violated, false); remaining(); authorized = true;
    const pending = page.waitForResponse(response => response.url() === `${SQ}/relay/safe-tx` && response.request().method() === 'POST', { timeout: remaining(65000) });
    void pending.catch(() => {});
    await page.getByRole('button', { name: 'Sign & send', exact: true }).click({ timeout: remaining() });
    const response = await pending;
    // Bounded parse; never copy error/reason/text. Exact status/code pair allowlist.
    const text = await response.text(); assert.ok(text.length <= 65536); const result = JSON.parse(text);
    if (!response.ok()) {
      const allowed = new Map([[403, new Set(['SANCTIONS_BLOCK', 'SCREENING_UNAVAILABLE', 'NOT_SPONSORED', 'EFFECTS_MISMATCH'])]]);
      evidence.httpFailure = { status: [400, 401, 403, 409, 429, 502, 503].includes(response.status()) ? response.status() : 'unrecognized_status', code: allowed.get(response.status())?.has(result.code) ? result.code : 'redacted_or_absent_code' };
      evidence.outcome = 'http_refused_inspect_no_retry'; process.exitCode = 1; return;
    }
    assert.ok(hash(result.transactionHash)); evidence.transactionHash = result.transactionHash;
    assert.ok(same(result.hash, evidence.safeTxHash)); assert.equal(result.classification, 'Small');
    assert.equal(result.screening?.ok, true); assert.equal(result.screening.mock, false); assert.deepEqual(result.screening.hits, []);
    const sources = result.screening.sources; assert.ok(Array.isArray(sources));
    assert.ok(sources.some(source => typeof source === 'string' && source.startsWith('RedStone OFAC/EU/UN-derived sanctions oracle: clear (updated ')));
    for (const token of [ADDRESSES.usdc, DAPP_ADDRESSES.eurc]) assert.ok(sources.some(source => typeof source === 'string' && source.toLowerCase().startsWith(`circle issuer freeze list ${token.toLowerCase()}: clear`)));
    assert.ok(sources.every(source => typeof source === 'string' && !/local fixture|required.*unavailable/i.test(source)));
    evidence.liveScreening = 'required_sources_clear_identity_still_mock';
    stage = 'two_public_receipts_and_effects';
    const receipts = await Promise.all(clients.map(client => client.waitForTransactionReceipt({ hash: evidence.transactionHash, timeout: remaining(45000), pollingInterval: 2000, retryCount: 0 })));
    const receipt = receipts[0]; assert.equal(receipt.status, 'success');
    assert.deepEqual(receipts[1], receipt); // Entire receipt agreement, including logs.
    const transactions = await Promise.all(clients.map(client => client.getTransaction({ hash: evidence.transactionHash })));
    for (const tx of transactions) { assert.equal(Number(tx.chainId), CHAIN); assert.ok(same(tx.to, WALLET)); assert.ok(same(tx.from, RELAYER)); }
    const events = (address, abi) => receipt.logs.filter(log => same(log.address, address)).flatMap(log => { try { return [decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true })]; } catch { return []; } });
    const safeEvents = events(WALLET, safeAbi);
    assert.ok(!safeEvents.some(event => event.eventName === 'ExecutionFailure'));
    assert.equal(safeEvents.filter(event => event.eventName === 'ExecutionSuccess' && same(event.args.txHash, evidence.safeTxHash) && event.args.payment === 0n).length, 1);
    assert.equal(events(ADDRESSES.usdc, transferAbi).filter(event => same(event.args.from, WALLET) && same(event.args.to, RECIPIENT) && event.args.value === 1000000n).length, 1);
    for (const client of clients) {
      const blockNumber = receipt.blockNumber;
      assert.equal(await read(client, WALLET, safeAbi, 'nonce', blockNumber), 1n);
      assert.deepEqual((await read(client, WALLET, safeAbi, 'getOwners', blockNumber)).map(a => a.toLowerCase()), [OWNER.toLowerCase()]);
      assert.equal(await read(client, ADDRESSES.usdc, erc20Abi, 'balanceOf', blockNumber, [WALLET]), 0n);
      assert.equal(await read(client, ADDRESSES.usdc, erc20Abi, 'balanceOf', blockNumber, [RECIPIENT]), BigInt(evidence.before.recipientBalance) + 1000000n);
      assert.equal(await client.getBalance({ address: OWNER, blockNumber }), 0n); assert.equal(await client.getBalance({ address: WALLET, blockNumber }), 0n);
    }
    assert.equal(violated, false); assert.equal(evidence.paymentPostAttempts, 1); assert.equal(evidence.paymentPostsReleased, 1);
    evidence.payment = { transactionHash: evidence.transactionHash, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash, rpcAgreement: true, safeExecutionSuccess: true, executionFailureAbsent: true, exactTransferBaseUnits: '1000000', nonceAfter: '1', ownerEthAfterWei: '0', walletEthAfterWei: '0', walletUsdcAfter: '0', sponsor: RELAYER };
    evidence.outcome = 'passed';
  } finally {
    await cleanup(); clearTimeout(stopTimer); clearTimeout(hardTimer);
  }
}
try { await run(); }
catch {
  if (!['retention_failed_inspect_locally_no_retry', 'deadline_inspect_locally_and_public_chain_no_retry'].includes(evidence.outcome)) evidence.outcome = evidence.paymentPostsReleased ? 'unknown_or_pending_inspect_public_hash_and_service_no_retry' : 'blocked_before_payment_release';
  evidence.blocker = { stage, category: stage === 'same_auth_ui_restore' ? 'original_auth_not_restored_stop_no_login' : 'redacted_guard_or_runtime_failure' };
  process.exitCode = 1;
}
console.log(JSON.stringify(evidence, null, 2));
