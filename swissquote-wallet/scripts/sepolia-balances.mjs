#!/usr/bin/env node
// Read-only: prints Sepolia ETH and USDC balances for the public *_ADDRESS lines in .env.sepolia.
// Never reads or prints private keys. Sends no transactions.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RPCS = (process.env.SEPOLIA_RPC_URLS ?? 'https://ethereum-sepolia-rpc.publicnode.com,https://sepolia.drpc.org')
  .split(',').map(value => value.trim()).filter(Boolean);
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const file = fileURLToPath(new URL('../.env.sepolia', import.meta.url));

const addresses = readFileSync(file, 'utf8').split('\n')
  .map(line => line.match(/^([A-Z_]+)_ADDRESS=(0x[0-9a-fA-F]{40})$/))
  .filter(Boolean)
  .map(match => ({ role: match[1], address: match[2] }));

async function rpc(method, params) {
  let lastError;
  for (const url of RPCS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json();
      if (body.error) throw new Error(body.error.message);
      return body.result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const chainId = await rpc('eth_chainId', []);
if (chainId !== '0xaa36a7') throw new Error(`Unexpected chain ${chainId}; expected Sepolia (0xaa36a7).`);

for (const { role, address } of addresses) {
  const wei = BigInt(await rpc('eth_getBalance', [address, 'latest']));
  const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;
  const units = BigInt(await rpc('eth_call', [{ to: USDC, data }, 'latest']));
  const eth = (Number(wei / 10n ** 12n) / 1e6).toFixed(6);
  const usdc = (Number(units) / 1e6).toFixed(2);
  console.log(`${role} ${address} eth=${eth} usdc=${usdc}`);
}
