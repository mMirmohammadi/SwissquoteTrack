// Sepolia demo launcher. REAL Sepolia testnet transactions: network fees are paid by the RELAYER key,
// MOCK account transfers by the SQ_ACCOUNT key, both read from .env.sepolia at runtime. Values are never printed.
// Identity checks, the bank account and guardian storage stay MOCKS. Mirrors local-demo.mjs.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const cwd = path.dirname(fileURLToPath(import.meta.url));
function refuse(message) { console.error(`Sepolia demo not started: ${message}`); process.exit(1); }

// 0. A fooled partner would sign real recovery approvals with its Sepolia guardian key; anyone holding the card
// could reuse such a signature to take over or lock a real wallet. Show tricked guardians only on throwaway
// wallets (scripts/story-sepolia.ts), never through the services.
if (process.env.PARTNER_DEMO_FOOLED === 'true') refuse('PARTNER_DEMO_FOOLED=true is not allowed on Sepolia. Unset it; the tricked-guardian demo runs on a throwaway wallet in scripts/story-sepolia.ts.');

// 1. Refuse to start while anything (for example the local demo) already serves one of our ports.
const ports = [[5173, 'wallet'], [5174, 'recovery tool'], [4001, 'Swissquote service'], [4002, 'partner service']];
const listening = (port, host) => new Promise(resolve => {
  const socket = net.connect({ port, host });
  const finish = inUse => { socket.destroy(); resolve(inUse); };
  socket.setTimeout(1500, () => finish(false));
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
});
const busy = [];
for (const [port, label] of ports) if (await listening(port, '127.0.0.1') || await listening(port, '::1')) busy.push(`${port} (${label})`);
if (busy.length) refuse(`${busy.length > 1 ? 'ports' : 'port'} ${busy.join(', ')} ${busy.length > 1 ? 'are' : 'is'} already in use. The local demo is probably still running: stop it first, then run pnpm demo:sepolia again.`);

// 2. Load only the two service keys from .env.sepolia. Never print values.
const envFile = path.join(cwd, '.env.sepolia');
if (!existsSync(envFile)) refuse('swissquote-wallet/.env.sepolia is missing. Create it with node scripts/sepolia-keys.mjs and fund it first.');
const fileEnv = parseEnv(readFileSync(envFile, 'utf8'));
const keys = {};
for (const name of ['RELAYER_PRIVATE_KEY', 'SQ_ACCOUNT_PRIVATE_KEY']) {
  const value = fileEnv[name]?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) refuse(`${name} in .env.sepolia is missing or not a 32-byte hex key (value not shown).`);
  keys[name] = value;
}

// 3. Fresh Sepolia data, separate from the local demo (git-ignored via swissquote-wallet/**/data/). Kept across restarts.
const dataDir = path.join(cwd, 'data', 'sepolia');
const sqDataDir = path.join(dataDir, 'swissquote');
const partnerDataDir = path.join(dataDir, 'partner');
for (const dir of [sqDataDir, partnerDataDir]) mkdirSync(dir, { recursive: true, mode: 0o700 });

// Both services use one viem fallback list for sending and reading. publicnode comes first because it answers
// sends promptly (ethpandaops' proxy retried an invalid raw transaction for 18 s before answering). It keeps
// logs for only ~10,000 blocks; for older log ranges it returns error 4444, and the fallback moves on to the
// full-history nodes. Wallet verification reads logs from the first Sepolia deployment onwards.
const SERVICE_RPC_URLS = 'https://ethereum-sepolia-rpc.publicnode.com,https://sepolia.gateway.tenderly.co,https://rpc.sepolia.ethpandaops.io';
// Browser wallet: publicnode for receipts and current reads; ethpandaops as the independent second node.
const WALLET_RPC_URLS = 'https://ethereum-sepolia-rpc.publicnode.com,https://rpc.sepolia.ethpandaops.io';
const env = {
  ...process.env,
  CHAIN: 'sepolia',
  ALLOW_SEPOLIA_WRITES: 'true',
  RPC_URLS: SERVICE_RPC_URLS,
  ...keys,
  SQ_DATA_DIR: sqDataDir,
  PARTNER_DATA_DIR: partnerDataDir,
  ENABLE_MOCK: 'true',
  PARTNER_DEMO_FOOLED: 'false',
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_ORIGINS: 'http://localhost:5173',
  PARTNER_ALLOWED_ORIGINS: 'http://localhost:5173',
  VITE_CHAIN: 'sepolia',
  VITE_RPC_URLS: WALLET_RPC_URLS,
  VITE_SQ_URL: 'http://localhost:4001',
  VITE_PARTNER_URL: 'http://localhost:4002',
};
// The port check above assumes the default ports, so ignore inherited overrides.
for (const name of ['PORT', 'PARTNER_PORT', 'PARTNER_HOST']) delete env[name];

console.log('SEPOLIA DEMO: real Sepolia testnet transactions, network fees paid by the relayer key in .env.sepolia. Identity checks, bank account and guardian storage are MOCKS.');
console.log(`Open http://localhost:5173 (passkeys are bound to "localhost"; 127.0.0.1 will not work). Service data: ${path.relative(cwd, dataDir)}/`);
const child = spawn(process.execPath, ['dev.mjs'], { cwd, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
