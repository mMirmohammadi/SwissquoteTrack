#!/usr/bin/env node
// Moves Sepolia test ETH and USDC from TREASURY to the service roles in .env.sepolia.
// Dry run by default; broadcasts only with --send. Never prints private keys.
// Usage:
//   node scripts/sepolia-distribute.mjs --eth RELAYER=0.03,SQ_ACCOUNT=0.005,FUNDER=0.005 --usdc SQ_ACCOUNT=20 [--send]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient, createWalletClient, erc20Abi, fallback, formatEther, formatUnits, http, parseEther, parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const GAS_RESERVE = parseEther('0.002');
const RPCS = (process.env.SEPOLIA_RPC_URLS ?? 'https://ethereum-sepolia-rpc.publicnode.com,https://sepolia.drpc.org')
  .split(',').map(value => value.trim()).filter(Boolean);

const envFile = fileURLToPath(new URL('../.env.sepolia', import.meta.url));
const env = Object.fromEntries(readFileSync(envFile, 'utf8').split('\n')
  .filter(line => /^[A-Z_]+=/.test(line))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]));

function parsePlan(flag, parse) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return [];
  return (process.argv[index + 1] ?? '').split(',').filter(Boolean).map(part => {
    const [role, amount] = part.split('=');
    const to = env[`${role}_ADDRESS`];
    if (!to || role === 'TREASURY') throw new Error(`Unknown or invalid target role: ${role}`);
    const value = parse(amount);
    if (value <= 0n) throw new Error(`Amount must be positive: ${part}`);
    return { role, to, amount, value };
  });
}

const ethPlan = parsePlan('--eth', amount => parseEther(amount));
const usdcPlan = parsePlan('--usdc', amount => parseUnits(amount, 6));
const send = process.argv.includes('--send');
if (ethPlan.length + usdcPlan.length === 0) throw new Error('Nothing to do: pass --eth and/or --usdc.');

const account = privateKeyToAccount(env.TREASURY_PRIVATE_KEY);
if (account.address !== env.TREASURY_ADDRESS) throw new Error('TREASURY key and address do not match.');
const transport = fallback(RPCS.map(url => http(url, { timeout: 15_000 })));
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ account, chain: sepolia, transport });

const chainId = await publicClient.getChainId();
if (chainId !== sepolia.id) throw new Error(`Unexpected chain ${chainId}; expected Sepolia ${sepolia.id}.`);

const ethBalance = await publicClient.getBalance({ address: account.address });
const usdcBalance = await publicClient.readContract({
  address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address],
});
const ethNeeded = ethPlan.reduce((sum, item) => sum + item.value, 0n) + GAS_RESERVE;
const usdcNeeded = usdcPlan.reduce((sum, item) => sum + item.value, 0n);

console.log(`TREASURY ${account.address}: ${formatEther(ethBalance)} ETH, ${formatUnits(usdcBalance, 6)} USDC`);
for (const item of ethPlan) console.log(`plan: ${item.amount} ETH -> ${item.role} ${item.to}`);
for (const item of usdcPlan) console.log(`plan: ${item.amount} USDC -> ${item.role} ${item.to}`);
if (ethBalance < ethNeeded) throw new Error(`Not enough ETH: need ${formatEther(ethNeeded)} including a gas reserve.`);
if (usdcBalance < usdcNeeded) throw new Error(`Not enough USDC: need ${formatUnits(usdcNeeded, 6)}.`);
if (!send) {
  console.log('Dry run only. Add --send to broadcast.');
  process.exit(0);
}

async function confirm(label, hash) {
  console.log(`${label}: https://sepolia.etherscan.io/tx/${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== 'success') throw new Error(`${label} failed in block ${receipt.blockNumber}.`);
  console.log(`${label}: confirmed in block ${receipt.blockNumber}`);
}

for (const item of ethPlan) {
  const hash = await walletClient.sendTransaction({ to: item.to, value: item.value });
  await confirm(`${item.amount} ETH -> ${item.role}`, hash);
}
for (const item of usdcPlan) {
  const hash = await walletClient.writeContract({
    address: USDC, abi: erc20Abi, functionName: 'transfer', args: [item.to, item.value],
  });
  await confirm(`${item.amount} USDC -> ${item.role}`, hash);
}
console.log('Distribution complete.');
