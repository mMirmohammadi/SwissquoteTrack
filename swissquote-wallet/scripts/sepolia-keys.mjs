#!/usr/bin/env node
// Creates fresh Sepolia service keys in swissquote-wallet/.env.sepolia.
// The file is git-ignored (.env.*), created with mode 600, and never overwritten.
// Only public addresses are printed. Testnet use only.
import { closeSync, constants, openSync, writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const target = fileURLToPath(new URL('../.env.sepolia', import.meta.url));
const roles = [
  ['TREASURY', 'Receives faucet ETH and USDC; operators distribute from here (MOCK Swissquote treasury)'],
  ['RELAYER', 'Pays network fees for sponsored wallet transactions (Swissquote gas sponsor)'],
  ['SQ_ACCOUNT', 'MOCK Swissquote client account that funds wallets with test USDC'],
  ['FUNDER', 'MOCK user-owned ETH, used only by the emergency-kit sweep with our services stopped'],
];

const lines = [
  '# Sepolia service keys. Testnet only. Never commit, print, or paste these values.',
  `# Created ${new Date().toISOString()} by scripts/sepolia-keys.mjs`,
];
const publicInfo = [];
for (const [role, purpose] of roles) {
  const key = generatePrivateKey();
  const { address } = privateKeyToAccount(key);
  lines.push(`# ${purpose}`, `${role}_PRIVATE_KEY=${key}`, `${role}_ADDRESS=${address}`);
  publicInfo.push({ role, address, purpose });
}

let fd;
try {
  fd = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error(`${target} already exists; refusing to overwrite it.`);
    process.exit(1);
  }
  throw error;
}
writeSync(fd, `${lines.join('\n')}\n`);
closeSync(fd);
console.log(JSON.stringify(publicInfo, null, 2));
