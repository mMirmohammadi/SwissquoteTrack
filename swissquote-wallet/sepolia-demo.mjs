// Explicit launcher only: importing configuration helpers never reads keys or starts processes.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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
export function sepoliaLaunchConfig(inherited = {}, root = cwd, runId = randomUUID()) {
  assertSafeSepoliaEnv(inherited);
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('Invalid Sepolia run ID');
  const dataDir = path.join(root, '.sepolia-runs', runId);
  const flags = new Set((inherited.SQ_FEATURES ?? '').split(',').map(value => value.trim()).filter(Boolean));
  flags.add('strictSponsorship');
  const env = {
    ...inherited,
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
const listening = (port, host) => new Promise(resolve => {
  const socket = net.connect({ port, host });
  const finish = inUse => { socket.destroy(); resolve(inUse); };
  socket.setTimeout(1500, () => finish(false));
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
});
export async function launchSepolia() {
  assertSafeSepoliaEnv(process.env);
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
  const { env, dataDir, commands } = sepoliaLaunchConfig(process.env);
  for (const dir of [env.SQ_DATA_DIR, env.PARTNER_DATA_DIR]) mkdirSync(dir, { recursive: true, mode: 0o700 });
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
    const childEnv = label === 'Swissquote' ? { ...env, ...keys } : env;
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
