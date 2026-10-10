// No public-chain actions. All deterministic keys below are unsafe public fixtures.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { keccak256, stringToHex } from 'viem';
const cwd = path.dirname(fileURLToPath(import.meta.url));
const env = {
  ...process.env,
  CHAIN: 'local',
  RPC_URLS: 'http://127.0.0.1:8545,http://localhost:8545',
  RELAYER_PRIVATE_KEY: keccak256(stringToHex('sq-local-only/relayer')),
  SQ_ACCOUNT_PRIVATE_KEY: keccak256(stringToHex('sq-local-only/account')),
  ENABLE_MOCK: 'true',
  PARTNER_DEMO_FOOLED: 'true',
  ALLOW_SEPOLIA_WRITES: 'false',
  VITE_CHAIN: 'local',
  VITE_RPC_URLS: 'http://127.0.0.1:8545,http://localhost:8545',
  VITE_SQ_URL: 'http://localhost:4001',
  VITE_PARTNER_URL: 'http://localhost:4002',
};
console.log('LOCAL DEMO ONLY: chain must already be initialized with pnpm devnet. Software guardian storage, identity checks and account balance are MOCKS.');
const preparation = spawn(process.execPath, ['prepare-local-demo.mjs'], { cwd, env, stdio: 'inherit' });
const ready = await new Promise((resolve, reject) => { preparation.on('error', reject); preparation.on('exit', code => resolve(code === 0)); });
if (!ready) throw new Error('Local demo liquidity preparation failed; run pnpm devnet first.');
const child = spawn(process.execPath, ['dev.mjs'], { cwd, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
