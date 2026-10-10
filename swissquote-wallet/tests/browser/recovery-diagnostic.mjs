// Own isolated runtime; real browser through first start only; sanitized diagnostics.
import { createRuntime } from '../../scripts/v3-local.mjs';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Runtime descendants inherit output descriptors. Capture the entire worker and
// expose ONLY schema-allowlisted diagnostic records, never raw service output.
if (process.env.SQ_RECOVERY_DIAGNOSTIC_WORKER !== '1') {
 const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, SQ_RECOVERY_DIAGNOSTIC_WORKER: '1' }, stdio: ['ignore','pipe','ignore'] });
 const keys = new Set(['api','port','status','category','stage','uiCategory','protectionHelper','selector','count','cardTypedDataVerified','cardGuardianMatches','startSelectorCount','startDisabled','firstStartPending','newOwnerMatches','alertCount','failingStage','report','outcome','runtimeStopped']);
 let buffered = '';
 child.stdout.on('data', chunk => { buffered += chunk; const lines = buffered.split('\n'); buffered = lines.pop(); for (const line of lines) { try { const data = JSON.parse(line); if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).every(k => keys.has(k))) console.log(JSON.stringify(data)); } catch {} } });
 child.on('error', () => { console.log(JSON.stringify({outcome:'worker_start_refused',category:'unclassified_redacted'})); process.exitCode=1; });
 const code = await new Promise(resolve => child.on('close', resolve));
 process.exit(typeof code === 'number' ? code : 1);
}
const errors = new Map([
 ['Approval signer does not match the required guardian.', 'guardian_mismatch'],
 ['Approval does not sign this exact wallet, chain, module, new owner and nonce. Return to your saved offline tool with the current public request.', 'typed_data_mismatch'],
 ['Helper approved a different recovery request. Nothing was submitted.', 'helper_request_mismatch'],
 ['A recovery may already be pending. Check its address and countdown before requesting another approval.', 'pending_or_uncertain'],
 ['Operation failed; inspect local service and chain configuration', 'service_internal_configuration'],
 ['MOCK face check failed', 'mock_face_refused'],
 ['Wallet is not verified for this client', 'wallet_not_registered_for_client'],
 ['MOCK face mismatch', 'mock_face_refused'],
]);
const category = e => errors.get(e) || (/Timeout/.test(e) ? 'selector_or_response_timeout' : /strict mode violation/.test(e) ? 'selector_multiple_matches' : /revert/i.test(e) ? 'chain_revert_redacted' : 'unclassified_redacted');
const report = { evidence: [], outcome: 'not_run' };
let runtime, browser, timer, stage = 'runtime';
const log = value => { report.evidence.push(value); console.log(JSON.stringify(value)); };
// Runtime service logs are not diagnostic output: prevent request or console errors escaping.
const stdout = process.stdout.write.bind(process.stdout), stderr = process.stderr.write.bind(process.stderr);
try {
 runtime = await createRuntime(); Object.assign(process.env, runtime.env);
 const work = async () => {
  process.stdout.write = () => true; process.stderr.write = () => true;
  // Force child output through suppressed parent streams, not inherited descriptors.
  const run = runtime.run; runtime.run = (...args) => run(...args);
  await runtime.startChain(); await runtime.startApps();
  process.stdout.write = stdout; process.stderr.write = stderr;
  stage = 'browser';
  const h = await import('./harness.mjs');
  const available = await h.browserAvailability(); if (!available.ok) throw new Error('browser_unavailable');
  browser = await available.playwright.chromium.launch({ headless: true, executablePath: available.executable, env: Object.fromEntries(['PATH','HOME','LANG','LD_LIBRARY_PATH','XDG_CACHE_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME'].filter(k => runtime.env[k]).map(k => [k,runtime.env[k]])) });
  const context = await browser.newContext(), toolContext = await browser.newContext();
  await h.restrictBrowserNetwork(context); await h.restrictBrowserNetwork(toolContext);
  const page = await context.newPage(), tool = await toolContext.newPage();
  page.setDefaultTimeout(12000); tool.setDefaultTimeout(12000); await h.virtualAuthenticator(context,page);
  const pendingLogs = [];
  page.on('response', response => {
   const u = new URL(response.url());
   const metadata = response.request().method() === 'GET' && u.pathname.startsWith('/wallets/');
   if (!metadata && (response.request().method() !== 'POST' || !['/auth/passkey/register/verify','/relay/deploy','/wallets','/recovery/approve','/relay/recovery'].includes(u.pathname))) return;
   const task = (async () => { const data = { api:metadata ? '/wallets/:wallet' : u.pathname, port:Number(u.port), status:response.status() }; if (!response.ok()) data.category = category((await response.json().catch(()=>({}))).error || ''); log(data); })(); pendingLogs.push(task); void task.catch(()=>{});
  });
  const idle = async () => { await page.locator('.status.info').waitFor({state:'hidden'}); if (await page.locator('.status.error').count()) { const e = await page.locator('.status.error').innerText(); log({stage,uiCategory:category(e.replace(/×$/,'').trim())}); throw new Error('ui_refusal'); } };
  const action = async l => { await l.click(); await idle(); };
  stage = 'offline_card'; await toolContext.setOffline(true); await tool.goto(pathToFileURL(h.toolHtml).href); await tool.locator('#generate').click();
  const words = (await tool.locator('#words li').allTextContents()).join(' '), guardian = await tool.locator('#guardian').innerText();
  stage = 'passkey'; await page.goto(h.walletUrl); await page.getByRole('button',{name:'New here? Create a login',exact:true}).click();
  await page.getByLabel('Email address',{exact:true}).fill(`v3-recovery-diag-${crypto.randomUUID()}@example.test`); await page.getByLabel('Login password',{exact:true}).fill('V3-diagnostic-login-fixture-2026');
  await action(page.getByRole('button',{name:/Create with a passkey/})); await page.getByRole('heading',{name:'Create your self-custody wallet',exact:true}).waitFor();
  await action(page.getByRole('button',{name:'MOCK KYC: mark identity verified',exact:true}));
  stage = 'deployment'; await page.getByLabel('Create a device passphrase',{exact:true}).fill('V3-diagnostic-owner-fixture-2026'); await page.getByLabel('Recovery card public address',{exact:true}).fill(guardian); await action(page.getByRole('button',{name:'Create my wallet ↗',exact:true}));
  await page.getByText('Verified as yours',{exact:true}).waitFor();
  const setupCode = await page.getByLabel('Wallet setup code',{exact:true}).inputValue();
  stage = 'protection'; const protection = page.getByTestId('protection-panel'); await protection.waitFor();
  const helperText = protection.getByText('Card + one helper required on each path',{exact:true});
  try { await helperText.waitFor({timeout:3500}); log({protectionHelper:'passed'}); } catch(e) { log({protectionHelper:'failed',category:category(e.message)}); }
  for (const value of ['Card + one helper required on each path','Unknown — public checks unavailable','Not checked','Unexpected recovery rules — do not fund','No pending request on either checked node']) log({selector:value,count:await protection.getByText(value,{exact:true}).count()});
  stage = 'prepare'; await page.getByRole('navigation',{name:'Wallet navigation',exact:true}).getByRole('button',{name:/^↻\s*Recover access$/,exact:true}).click();
  const recovery = page.getByTestId('recovery-wizard'); await recovery.waitFor(); await recovery.getByTestId('recovery-helper').selectOption('0'); await recovery.getByLabel('New app unlock code · at least 12 characters',{exact:true}).fill('V3-diagnostic-replacement-fixture-2026'); await action(recovery.getByTestId('recovery-prepare'));
  const requestCode = await recovery.getByLabel('Public recovery request code',{exact:true}).inputValue();
  stage = 'card_review'; await toolContext.setOffline(false); await tool.locator('[data-tab="approve"]').click(); await tool.locator('#request').fill(requestCode); await tool.locator('#approve-words').fill(words); await tool.locator('#review-button').click(); await tool.locator('#review').waitFor({state:'visible'}); await tool.locator('#confirm').check(); await tool.locator('#sign-button').click(); await tool.locator('#approval-result').waitFor({state:'visible'});
  const approvalCode = await tool.locator('#approval').inputValue();
  const require = createRequire(new URL('../../packages/protocol/package.json',import.meta.url)); const {tsImport} = await import(require.resolve('tsx/esm/api')); const p = await tsImport('../../packages/protocol/src/index.ts',import.meta.url); const {verifyTypedData,createPublicClient,http} = require('viem');
  const wire = p.decodeRequestCode(requestCode), card = p.decodeApprovalCode(approvalCode), request = {...wire,nonce:BigInt(wire.nonce)};
  log({cardTypedDataVerified:await verifyTypedData({...p.recoveryTypedData(request),address:card.signer,signature:card.signature}),cardGuardianMatches:card.signer.toLowerCase()===guardian.toLowerCase()});
  await recovery.getByTestId('recovery-card-approval').fill(approvalCode); await recovery.getByRole('checkbox',{name:/I compared every group/}).check();
  stage = 'first_recovery_start'; log({startSelectorCount:await recovery.getByTestId('recovery-start').count(),startDisabled:await recovery.getByTestId('recovery-start').isDisabled()});
  await action(recovery.getByTestId('recovery-start'));
  const client = createPublicClient({transport:http('http://127.0.0.1:8645',{retryCount:0})}); const pending = await client.readContract({address:p.ADDRESSES.moduleA,abi:p.moduleAbi,functionName:'getRecoveryRequest',args:[wire.wallet]});
  log({firstStartPending:pending.executeAfter>0n,newOwnerMatches:pending.newOwners[0]?.toLowerCase()===wire.newOwner.toLowerCase(),alertCount:await page.getByTestId('recovery-alert').count()});
  await Promise.allSettled(pendingLogs); report.outcome = 'first_start_passed';
 };
 const deadline = new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('150s_deadline')),150000);});
 await Promise.race([work(),deadline,runtime.stopped.then(e=>{throw e;})]);
} catch(e) { process.stdout.write=stdout;process.stderr.write=stderr;report.outcome='stopped';log({failingStage:stage,category:e.message==='150s_deadline'?'150s_deadline':category(e.message)}); }
finally { clearTimeout(timer);if(browser)await browser.close().catch(()=>{});if(runtime){await runtime.stop();report.runtimeStopped=true;const destination=path.join(runtime.runDir,'recovery-diagnostic.json');await writeFile(destination,JSON.stringify(report,null,2));console.log(JSON.stringify({report:destination,outcome:report.outcome,runtimeStopped:true}));} }
