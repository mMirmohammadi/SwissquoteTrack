#!/usr/bin/env node
// Read-only upstream; a fork is opt-in and its child stays attached to this process.
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPublicClient, http } from 'viem';

const args = new Set(process.argv.slice(2));
const start = args.has('--start');
if ([...args].some(arg => !['--start', '--check', '--confirm-free-8645'].includes(arg))) throw new Error('Usage: node scripts/fork-sepolia.mjs --check | --start --confirm-free-8645');
if (start && !args.has('--confirm-free-8645')) throw new Error('Starting a fork requires explicit --confirm-free-8645; no existing listener is stopped.');
const upstream = new URL(process.env.FORK_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com');
if (upstream.protocol !== 'https:' || upstream.port === '8545' || upstream.username || upstream.password || upstream.search || !['ethereum-sepolia-rpc.publicnode.com', 'sepolia.drpc.org'].includes(upstream.hostname)) throw new Error('Use a read-only, credential-free public Sepolia endpoint. Never port 8545.');
const client = createPublicClient({ transport: http(upstream.toString(), { timeout: 10_000, retryCount: 0 }) });
if (await client.getChainId() !== 11155111) throw new Error('Upstream is not Sepolia.');
const block = await client.getBlockNumber({ cacheTime: 0 });
const code = await client.getCode({ address: '0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e', blockNumber: block });
if (!code || code === '0x') throw new Error('Compound fork state is unavailable.');
console.log(`Read-only Sepolia fork source checked at block ${block}. No transactions sent.`);
if (start) {
  await new Promise((accept, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error('Port 8645 is occupied; refusing to replace any listener.')));
    probe.listen(8645, '127.0.0.1', () => probe.close(error => error ? reject(error) : accept()));
  });
  const root = fileURLToPath(new URL('../', import.meta.url));
  const child = spawn(process.execPath, [resolve(root, 'contracts/node_modules/hardhat/internal/cli/cli.js'), 'node', '--hostname', '127.0.0.1', '--port', '8645', '--fork', upstream.toString(), '--fork-block-number', String(block)], { cwd: resolve(root, 'contracts'), stdio: ['ignore', 'pipe', 'pipe'] });
  // Hardhat prints deterministic test private keys at startup; never forward them.
  for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    let pending = '';
    stream.on('data', chunk => {
      pending += chunk.toString();
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) output.write(`${line.replace(/0x[0-9a-fA-F]{64}/g, '[redacted 32-byte value]')}\n`);
    });
    stream.on('end', () => { if (pending) output.write(pending.replace(/0x[0-9a-fA-F]{64}/g, '[redacted 32-byte value]')); });
  }
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; child.kill(signal); });
  process.on('exit', () => { if (child.exitCode === null) child.kill('SIGTERM'); });
  child.once('error', error => { console.error(`Fork process failed: ${error.message}`); process.exitCode = 1; });
  child.once('exit', (code, signal) => { if (!stopping && signal) console.error(`Fork terminated with ${signal}`); process.exitCode = code ?? (stopping ? 0 : 1); });
  console.log('Owned fork child attached at http://127.0.0.1:8645. Stop this process to stop the fork. Chain ID is 31337; unsigned protocol simulation still requires Sepolia RPC.');
}
