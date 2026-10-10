// Owned, isolated local runtime. Never loads credentials or attaches to an existing chain.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { keccak256, stringToHex } from 'viem';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const ports = Object.freeze({ wallet: 5273, tool: 5274, swissquote: 4101, partner: 4102, chain: 8645 });
export const rpc = 'http://127.0.0.1:8645';
export function assertIsolatedRpc(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '8645' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Only isolated loopback HTTP RPC port 8645 is permitted');
  }
  return url.href;
}
export function localEnvironment(runDir, source = process.env) {
  const env = {};
  // Do not forward arbitrary credentials, NODE_OPTIONS, public RPCs or application flags.
  for (const key of ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'TERM', 'BROWSER_EXECUTABLE', 'PLAYWRIGHT_BROWSERS_PATH', 'LD_LIBRARY_PATH']) {
    if (source[key]) env[key] = source[key];
  }
  return Object.assign(env, {
    V3_LOCAL_OWNED_RUN: runDir, RUN_LOCAL_WALLET_INTEGRATION: '1', CHAIN: 'local', RPC_URLS: `${rpc},http://localhost:8645`, INTEGRATION_RPC_URL: rpc,
    RELAYER_PRIVATE_KEY: keccak256(stringToHex('sq-local-only/relayer')),
    SQ_ACCOUNT_PRIVATE_KEY: keccak256(stringToHex('sq-local-only/account')),
    ENABLE_MOCK: 'true', PARTNER_DEMO_FOOLED: 'false', ALLOW_SEPOLIA_WRITES: 'false',
    ALLOW_SEPOLIA_STORY: 'no', PORT: String(ports.swissquote), SQ_PORT: String(ports.swissquote),
    PARTNER_PORT: String(ports.partner), PARTNER_HOST: '127.0.0.1',
    PARTNER_ALLOWED_ORIGINS: `http://localhost:${ports.wallet},http://127.0.0.1:${ports.wallet}`,
    SQ_DATA_DIR: path.join(runDir, 'swissquote'), PARTNER_DATA_DIR: path.join(runDir, 'partner'),
    WEBAUTHN_RP_ID: 'localhost', WEBAUTHN_ORIGINS: `http://localhost:${ports.wallet},http://127.0.0.1:${ports.wallet}`,
    VITE_CHAIN: 'local', VITE_RPC_URLS: `${rpc},http://localhost:8645`,
    VITE_FEATURES: 'recoveryWizard,dapps,audit,protection,payPreview,strictSponsorship,partnerPrivacy',
    SQ_FEATURES: 'strictSponsorship',
    VITE_SQ_URL: `http://localhost:${ports.swissquote}`, VITE_PARTNER_URL: `http://localhost:${ports.partner}`,
    VITE_WALLET_PORT: String(ports.wallet), VITE_TOOL_PORT: String(ports.tool),
    BROWSER_REQUIRED: '1', BROWSER_WALLET_URL: `http://localhost:${ports.wallet}`,
    BROWSER_TOOL_URL: `http://localhost:${ports.tool}`, BROWSER_SQ_URL: `http://localhost:${ports.swissquote}`,
    BROWSER_PARTNER_URL: `http://localhost:${ports.partner}`, BROWSER_RPC_URL: rpc,
    HOME: path.join(runDir, 'browser-home'),
    XDG_CACHE_HOME: path.join(runDir, 'cache'), XDG_CONFIG_HOME: path.join(runDir, 'config'), XDG_DATA_HOME: path.join(runDir, 'data'),
  });
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Isolated port ${port} is unavailable; refusing to attach or stop its owner`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
export async function createRuntime() {
  // Vite automatically reads dotenv files: fail rather than load an unknown local credential/config file.
  for (const directory of [root, path.join(root, 'apps/wallet'), path.join(root, 'apps/recovery-tool')]) {
    for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
      if (existsSync(path.join(directory, name))) throw new Error('Local dotenv files are not allowed by the isolated launcher; use its fixed local configuration');
    }
  }
  for (const port of Object.values(ports)) await freePort(port);
  const scratchRoot = path.resolve(root, '../AgentsLocal');
  await mkdir(scratchRoot, { recursive: true });
  let runDir;
  for (;;) {
    runDir = path.join(scratchRoot, randomBytes(4).toString('hex'));
    try { await mkdir(runDir); break; } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const env = localEnvironment(runDir);
  for (const directory of [env.HOME, env.XDG_CACHE_HOME, env.XDG_CONFIG_HOME, env.XDG_DATA_HOME]) await mkdir(directory, { recursive: true });
  const children = new Set();
  let stopping = false;
  let fatal;
  const stopped = new Promise(resolve => { fatal = resolve; });
  function start(label, command, args, options = {}) {
    if (stopping) throw new Error('Isolated runtime is stopping');
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', detached: true, ...options });
    children.add(child);
    let output = '';
    if (child.stdout) child.stdout.on('data', chunk => { output += chunk; if (!options.quiet) process.stdout.write(chunk); });
    if (child.stderr) child.stderr.on('data', chunk => { if (!options.quiet) process.stderr.write(chunk); });
    const done = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        // A wrapper can exit before its descendants. Reap its group immediately,
        // then forget the PID so later cleanup cannot hit a reused process ID.
        if (child.pid) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') reject(error); }
        }
        children.delete(child);
      });
      child.once('close', (code, signal) => resolve({ code, signal, output }));
    });
    // Always observe failures, including long-running service startup failures.
    done.then(result => {
      if (!stopping && options.service) fatal(new Error(`${label} stopped (${result.signal ?? result.code})`));
    }, error => { if (!stopping) fatal(new Error(`${label} failed: ${error.message}`)); });
    return { child, done };
  }
  async function run(label, command, args, options = {}) {
    const task = start(label, command, args, options);
    const result = await Promise.race([task.done, stopped.then(error => { throw error; })]);
    if (result.code !== 0) throw new Error(`${label} failed (${result.signal ?? result.code})`);
    return result;
  }
  async function stop() {
    if (stopping) return;
    stopping = true;
    const signal = value => {
      for (const child of children) {
        if (!child.pid) continue;
        try { process.kill(-child.pid, value); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    };
    signal('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    signal('SIGKILL');
  }
  async function waitReady(url, chain = false) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const outcome = await Promise.race([
        fetch(url, { signal: AbortSignal.timeout(1500), redirect: 'error', ...(chain ? {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        } : {}) }).then(async response => response.ok && (!chain || (await response.json()).result === '0x7a69')).catch(() => false),
        stopped.then(error => { throw error; }),
      ]);
      if (outcome) return;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(`Isolated server readiness timed out: ${url}`);
  }
  async function startChain() {
    // Ignore Hardhat account output: local fixtures are public, but key logs are unnecessary.
    start('Local chain', 'npm', ['--prefix', 'contracts', 'run', 'node', '--', '--port', String(ports.chain)], { service: true, stdio: 'ignore' });
    await waitReady(rpc, true);
    await run('Compile local fixtures', 'npm', ['--prefix', 'contracts', 'run', 'compile']);
    await run('Initialize owned chain', process.execPath, ['--import', 'tsx', 'scripts/devnet.ts']);
    await run('Prepare MOCK liquidity', process.execPath, ['prepare-local-demo.mjs']);
  }
  async function startApps() {
    start('Swissquote', 'pnpm', ['--filter', '@sq/swissquote', 'dev'], { service: true });
    start('Partner', 'pnpm', ['--filter', '@sq/partner', 'dev'], { service: true });
    // Exec bypasses the package dev commands' hardcoded ports; strictPort prevents fallback.
    start('Wallet', 'pnpm', ['--filter', '@sq/wallet', 'exec', 'vite', '--host', '127.0.0.1', '--port', String(ports.wallet), '--strictPort'], { service: true });
    start('Recovery tool', 'pnpm', ['--filter', '@sq/recovery-tool', 'exec', 'vite', '--host', '127.0.0.1', '--port', String(ports.tool), '--strictPort'], { service: true });
    await Promise.all([
      waitReady(`http://127.0.0.1:${ports.swissquote}/health`), waitReady(`http://127.0.0.1:${ports.partner}/health`),
      waitReady(`http://127.0.0.1:${ports.wallet}`), waitReady(`http://127.0.0.1:${ports.tool}`),
    ]);
  }
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => fatal(new Error(`Isolated runtime interrupted by ${name}`)));
  return { env, runDir, run, stop, stopped, startChain, startApps };
}
export async function launchLocal() {
  const runtime = await createRuntime();
  try {
    await runtime.startChain();
    await runtime.startApps();
    console.log(`Isolated local MOCK demo ready: http://localhost:${ports.wallet}; run data: ${runtime.runDir}`);
    throw await runtime.stopped;
  } finally { await runtime.stop(); }
}
