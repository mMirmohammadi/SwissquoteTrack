// Explicit launcher only: importing configuration helpers never reads keys or starts processes.
// Default: fresh isolated run. Opt in to restart persistence with
// DEMO_RUN_ID=rehearsal-11 node sepolia-demo.mjs (same local stores, no reset).
// Treat the ID as a public label, never as a password or token.
import { spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';

const cwd = path.dirname(fileURLToPath(import.meta.url));
export const SEPOLIA_PORTS = [[5273, 'wallet'], [5274, 'recovery tool'], [4101, 'Swissquote service'], [4102, 'partner service']];
export function assertSafeSepoliaEnv(env) {
  if (env.PARTNER_DEMO_FOOLED?.trim().toLowerCase() === 'true') {
    throw new Error('PARTNER_DEMO_FOOLED=true is not allowed on Sepolia; use a throwaway-wallet replay instead.');
  }
}
// Deliberate allowlists: unknown inherited variables (including VITE_* secrets and
// NODE_OPTIONS) must not reach a browser builder or the partner process.
const runtimeKeys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'TZ', 'TMPDIR', 'TMP', 'TEMP'];
const serviceKeys = ['SQ_FEATURES', 'MOCK_ACCOUNT_START_USDC', 'MOCK_ACCOUNT_PAYOUT_CAP_USDC', 'MAINNET_RPC_URLS', 'SIMULATION_RPC_URLS'];
const pickEnv = (env, names) => Object.fromEntries(names.filter(name => typeof env[name] === 'string').map(name => [name, env[name]]));
export function sepoliaLaunchConfig(inherited = {}, root = cwd, runId = inherited.DEMO_RUN_ID ?? randomUUID()) {
  assertSafeSepoliaEnv(inherited);
  // No whitespace, separators, dots, Unicode or unbounded path components. Do
  // not echo a rejected value: an accidental secret must stay out of logs.
  if (typeof runId !== 'string' || runId.length > 64 || !/^[a-zA-Z0-9]/.test(runId) || /[^a-zA-Z0-9_-]/.test(runId)) throw new Error('Invalid Sepolia run ID');
  const dataDir = path.join(path.resolve(root), '.sepolia-runs', runId);
  const flags = new Set((inherited.SQ_FEATURES ?? '').split(',').map(value => value.trim()).filter(Boolean));
  flags.add('strictSponsorship');
  const env = {
    ...pickEnv(inherited, [...runtimeKeys, ...serviceKeys]),
    CHAIN: 'sepolia', ALLOW_SEPOLIA_WRITES: 'true',
    RPC_URLS: 'https://ethereum-sepolia-rpc.publicnode.com,https://rpc.sepolia.ethpandaops.io,https://sepolia.gateway.tenderly.co',
    SQ_DATA_DIR: path.join(dataDir, 'swissquote'), PARTNER_DATA_DIR: path.join(dataDir, 'partner'),
    SQ_FEATURES: [...flags].join(','), ENABLE_MOCK: 'true', PARTNER_DEMO_FOOLED: 'false',
    WEBAUTHN_RP_ID: 'localhost', WEBAUTHN_ORIGINS: 'http://localhost:5273',
    PARTNER_ALLOWED_ORIGINS: 'http://localhost:5273',
    VITE_CHAIN: 'sepolia',
    VITE_FEATURES: 'recoveryWizard,dapps,audit,protection,payPreview,strictSponsorship,partnerPrivacy',
    VITE_RPC_URLS: 'https://ethereum-sepolia-rpc.publicnode.com,https://rpc.sepolia.ethpandaops.io',
    VITE_SQ_URL: 'http://localhost:4101', VITE_PARTNER_URL: 'http://localhost:4102',
    PORT: '4101', SQ_PORT: '4101', PARTNER_PORT: '4102', PARTNER_HOST: '127.0.0.1',
  };
  // Only the two sending keys explicitly loaded below may reach the children.
  for (const key of Object.keys(env)) if (key.endsWith('_PRIVATE_KEY')) delete env[key];
  const commands = [
    ['Swissquote', ['--filter', '@sq/swissquote', 'dev']],
    ['Partner', ['--filter', '@sq/partner', 'dev']],
    ['Wallet', ['--filter', '@sq/wallet', 'exec', 'vite', '--host', '127.0.0.1', '--port', '5273', '--strictPort']],
    ['Recovery tool', ['--filter', '@sq/recovery-tool', 'exec', 'vite', '--host', '127.0.0.1', '--port', '5274', '--strictPort']],
  ];
  return { env, dataDir, commands };
}
export function sepoliaChildEnv(label, env, keys = {}) {
  if (label === 'Swissquote') return { ...env, ...pickEnv(keys, ['RELAYER_PRIVATE_KEY', 'SQ_ACCOUNT_PRIVATE_KEY']) };
  if (label === 'Partner') return pickEnv(env, [...runtimeKeys, 'CHAIN', 'RPC_URLS', 'PARTNER_DATA_DIR', 'PARTNER_ALLOWED_ORIGINS', 'PARTNER_PORT', 'PARTNER_HOST']);
  if (label === 'Wallet' || label === 'Recovery tool') return pickEnv(env, [...runtimeKeys, 'VITE_CHAIN', 'VITE_FEATURES', 'VITE_RPC_URLS', 'VITE_SQ_URL', 'VITE_PARTNER_URL']);
  throw new Error('Unknown Sepolia child process');
}
export function prepareSepoliaData(config, root = cwd) {
  const base = path.join(path.resolve(root), '.sepolia-runs');
  // Recheck containment independently of the configuration helper. Never follow
  // a persisted run/subdirectory symlink and never delete or reset run data.
  const id = path.basename(config.dataDir);
  const expected = sepoliaLaunchConfig({}, root, id);
  if (config.dataDir !== expected.dataDir || config.env.SQ_DATA_DIR !== expected.env.SQ_DATA_DIR || config.env.PARTNER_DATA_DIR !== expected.env.PARTNER_DATA_DIR) throw new Error('Invalid Sepolia data directories');
  for (const dir of [base, config.dataDir, config.env.SQ_DATA_DIR, config.env.PARTNER_DATA_DIR]) {
    try { mkdirSync(dir, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Sepolia data path must be a directory, not a symlink');
  }
}
const listening = (port, host) => new Promise(resolve => {
  const socket = net.connect({ port, host });
  const finish = inUse => { socket.destroy(); resolve(inUse); };
  socket.setTimeout(1500, () => finish(false));
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
});
export async function launchSepolia() {
  const config = sepoliaLaunchConfig(process.env);
  const busy = [];
  for (const [port, label] of SEPOLIA_PORTS) {
    if (await listening(port, '127.0.0.1') || await listening(port, '::1')) busy.push(`${port} (${label})`);
  }
  if (busy.length) throw new Error(`V3 ports already in use: ${busy.join(', ')}. Leave the live v2 demo running.`);
  const envFile = path.join(cwd, '.env.sepolia');
  if (!existsSync(envFile)) throw new Error('.env.sepolia is missing; ask the run owner to provision service keys.');
  const fileEnv = parseEnv(readFileSync(envFile, 'utf8'));
  assertSafeSepoliaEnv(fileEnv);
  const keys = {};
  for (const name of ['RELAYER_PRIVATE_KEY', 'SQ_ACCOUNT_PRIVATE_KEY']) {
    const value = fileEnv[name]?.trim();
    if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} is missing or invalid (value not shown).`);
    keys[name] = value;
  }
  const { env, dataDir, commands } = config;
  prepareSepoliaData(config);
  console.log('SEPOLIA: real testnet transactions; identity checks, bank account and guardian storage are MOCKS.');
  console.log(`Open http://localhost:5273. Isolated service data: ${path.relative(cwd, dataDir)}/`);
  const children = [];
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true; process.exitCode = code;
    for (const child of children) child.kill('SIGTERM');
  };
  for (const [label, args] of commands) {
    // Do not expose sending keys to browsers or the partner process.
    const childEnv = sepoliaChildEnv(label, env, keys);
    const child = spawn('pnpm', args, { cwd, env: childEnv, stdio: 'inherit' });
    children.push(child);
    child.on('error', () => { console.error(`${label} failed to start.`); stop(1); });
    child.on('exit', code => { if (!stopping) { console.error(`${label} stopped; stopping remaining v3 processes.`); stop(code || 1); } });
  }
  process.once('SIGTERM', () => stop()); process.once('SIGINT', () => stop());
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await launchSepolia().catch(error => { console.error(`Sepolia demo not started: ${error.message}`); process.exitCode = 1; });
}
