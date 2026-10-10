import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGwei, type Address, type Hash } from 'viem';
import {
  CIRCLE_USDC, GAS_BOUNDS, MAX_FEE_CAP, MIN_PRIORITY_FEE, USDC_FUNDING, assertNoSecrets, computeFees, createEvidence,
  createStoryNonceManager, estimateNeeds, etherscanTx, evidenceFile, main, parseArgs, parseEnv, redact, rpcUrlsFrom,
  runStateFile, shortfalls, utcStamp, writeEvidence, writeRunState,
} from '../story-sepolia.js';

const SECRET = `0x${'ab'.repeat(32)}`;
const HASH = `0x${'12'.repeat(32)}` as Hash;
const tempDir = () => mkdtempSync(join(tmpdir(), 'story-sepolia-test-'));

test('mode parsing: default full, positional, --mode forms, --dry-run, errors', () => {
  assert.deepEqual(parseArgs([]), { mode: 'full', dryRun: false });
  assert.deepEqual(parseArgs(['--dry-run']), { mode: 'full', dryRun: true });
  assert.deepEqual(parseArgs(['b-pending']), { mode: 'b-pending', dryRun: false });
  assert.deepEqual(parseArgs(['--', '--mode', 'b-pending', '--dry-run']), { mode: 'b-pending', dryRun: true });
  assert.deepEqual(parseArgs(['--mode=full']), { mode: 'full', dryRun: false });
  assert.deepEqual(parseArgs(['full', '--mode=full']), { mode: 'full', dryRun: false });
  assert.throws(() => parseArgs(['b']), /Unknown mode b/);
  assert.throws(() => parseArgs(['--mode']), /Unknown mode \(missing\)/);
  assert.throws(() => parseArgs(['--send']), /Unknown option --send/);
  assert.throws(() => parseArgs(['full', 'b-pending']), /single mode/);
});

test('fee rule: tip at least 0.01 gwei, max fee = 2 x base + tip, refuse above 20 gwei', () => {
  assert.equal(MIN_PRIORITY_FEE, 10_000_000n);
  assert.equal(MAX_FEE_CAP, 20_000_000_000n);
  // Sepolia today: base fee ~15 wei and an RPC tip of 0.001 gwei -> the 0.01 gwei floor applies.
  assert.deepEqual(computeFees(15n, parseGwei('0.001')), { maxPriorityFeePerGas: MIN_PRIORITY_FEE, maxFeePerGas: 30n + MIN_PRIORITY_FEE });
  assert.deepEqual(computeFees(0n), { maxPriorityFeePerGas: MIN_PRIORITY_FEE, maxFeePerGas: MIN_PRIORITY_FEE });
  // A higher RPC suggestion wins over the floor.
  assert.deepEqual(computeFees(parseGwei('1'), parseGwei('2')), { maxPriorityFeePerGas: parseGwei('2'), maxFeePerGas: parseGwei('4') });
  // Exactly at the cap is allowed; one wei above is refused.
  const atCapBase = (MAX_FEE_CAP - MIN_PRIORITY_FEE) / 2n;
  assert.equal(computeFees(atCapBase).maxFeePerGas, MAX_FEE_CAP);
  assert.throws(() => computeFees(atCapBase, MIN_PRIORITY_FEE + 1n), /above the 20 gwei cap; refusing to send/);
  assert.throws(() => computeFees(parseGwei('15')), /refusing to send/);
  assert.throws(() => computeFees(-1n), /non-negative/);
});

test('needs per mode and shortfalls', () => {
  const full = estimateNeeds('full', 1n);
  assert.equal(full.treasuryGas, GAS_BOUNDS.deploy + GAS_BOUNDS.usdcTransfer + 2n * GAS_BOUNDS.safePayment + 3n * GAS_BOUNDS.recoveryStart + GAS_BOUNDS.cancelBatch + GAS_BOUNDS.finalize + GAS_BOUNDS.rotation);
  assert.equal(full.treasuryGas, 8_690_000n);
  assert.equal(full.funderGas, 150_000n);
  assert.equal(full.treasuryUsdc, USDC_FUNDING.full);
  const pending = estimateNeeds('b-pending', parseGwei('1'));
  assert.equal(pending.treasuryGas, 4_800_000n);
  assert.equal(pending.funderGas, 0n);
  assert.equal(pending.treasuryWei, 4_800_000n * parseGwei('1'));
  assert.equal(pending.treasuryUsdc, 1_000_000n);
  assert.deepEqual(shortfalls(pending, { treasuryEth: pending.treasuryWei, treasuryUsdc: 1_000_000n, funderEth: 0n }), []);
  const missing = shortfalls(full, { treasuryEth: 0n, treasuryUsdc: 0n, funderEth: 0n });
  assert.equal(missing.length, 3);
  assert.match(missing.join('\n'), /TREASURY ETH: has 0, needs/);
  assert.match(missing.join('\n'), /TREASURY USDC: has 0, needs 10/);
  assert.match(missing.join('\n'), /FUNDER ETH/);
});

test('file names, UTC stamps and Etherscan links', () => {
  const stamp = utcStamp(new Date('2025-10-10T17:34:05.123Z'));
  assert.equal(stamp, '2025-10-10T17-34-05Z');
  assert.equal(evidenceFile('/e', 'b-pending', stamp), '/e/b-pending-2025-10-10T17-34-05Z.json');
  assert.equal(runStateFile('/r', 'full', stamp), '/r/2025-10-10T17-34-05Z-full.json');
  assert.equal(etherscanTx(HASH), `https://sepolia.etherscan.io/tx/${HASH}`);
  assert.equal(CIRCLE_USDC, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238');
});

test('evidence writer: commit-safe JSON with bigint values, refuses secrets in any form', () => {
  const dir = tempDir();
  try {
    const evidence = createEvidence('full', 'run-1', new Date('2025-10-10T17:34:05Z'));
    evidence.steps.push({ name: 'deploy-wallet', status: 'success', txHash: HASH, etherscan: etherscanTx(HASH), blockNumber: '42', values: { executeAfter: 1_760_000_000n, owners: ['0x0000000000000000000000000000000000000001'] } });
    const path = join(dir, 'nested', 'full-run-1.json');
    writeEvidence(path, evidence, [SECRET]);
    const written = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(written.kind, 'swissquote-wallet-sepolia-story');
    assert.equal(written.chainId, 11155111);
    assert.equal(written.steps[0].values.executeAfter, '1760000000');
    assert.equal(written.steps[0].etherscan, `https://sepolia.etherscan.io/tx/${HASH}`);

    const leaky = createEvidence('full', 'run-2');
    leaky.note = `key ${SECRET.slice(2).toUpperCase()}`;
    const leakyPath = join(dir, 'leaky.json');
    assert.throws(() => writeEvidence(leakyPath, leaky, [SECRET]), /secret material/);
    assert.equal(existsSync(leakyPath), false);
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    leaky.note = `seed ${mnemonic}`;
    assert.throws(() => writeEvidence(leakyPath, leaky, [mnemonic]), /secret material/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('secret helpers ignore short values and redact every form', () => {
  assert.doesNotThrow(() => assertNoSecrets('nothing here', [SECRET, '', 'short']));
  assert.throws(() => assertNoSecrets(`x${SECRET}x`, [SECRET]), /secret material/);
  assert.equal(redact(`a ${SECRET} b ${SECRET.slice(2).toUpperCase()}`, [SECRET]), 'a [redacted] b [redacted]');
});

test('run-state file is created with mode 600, refuses to clobber, stays 600 on update', () => {
  const dir = tempDir();
  try {
    const path = join(dir, 'runs', '2025-10-10T17-34-05Z-full.json');
    writeRunState(path, { keys: { owner: { privateKey: SECRET } }, saltNonce: 7n }, { create: true });
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(join(dir, 'runs')).mode & 0o777, 0o700);
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).saltNonce, '7');
    assert.throws(() => writeRunState(path, {}, { create: true }), /EEXIST/);
    writeRunState(path, { step: 'deploy-wallet' });
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).step, 'deploy-wallet');
    assert.equal(existsSync(`${path}.tmp`), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('env and RPC parsing', () => {
  const env = parseEnv('# comment\nTREASURY_ADDRESS=0xB2F61CfeA95A87017FcdF539A0556158ed1b6B71\n\nQUOTED="a=b"\nlower=ignored\n  SPACED = no\nEMPTY=\n');
  assert.equal(env.TREASURY_ADDRESS, '0xB2F61CfeA95A87017FcdF539A0556158ed1b6B71');
  assert.equal(env.QUOTED, 'a=b');
  assert.equal(env.EMPTY, '');
  assert.equal('lower' in env, false);
  assert.equal('SPACED' in env, false);
  assert.deepEqual(rpcUrlsFrom(undefined), ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.ethpandaops.io']);
  assert.deepEqual(rpcUrlsFrom(' https://a.example , https://b.example '), ['https://a.example', 'https://b.example']);
  assert.throws(() => rpcUrlsFrom('file:///etc/passwd'), /HTTP\(S\)/);
});

test('nonce manager never hands out a nonce below the last confirmed one', async () => {
  const address = '0x00000000000000000000000000000000000000aa' as Address;
  let pending = 0;
  const client = { request: async ({ method }: { method: string }) => { assert.equal(method, 'eth_getTransactionCount'); return `0x${pending.toString(16)}`; } };
  const { nonceManager, confirm } = createStoryNonceManager();
  const consume = () => nonceManager.consume({ address, chainId: 11155111, client: client as never });
  assert.equal(await consume(), 0);
  confirm(address, 11155111, 0);
  // A stale back end still reports 0 pending transactions after the first receipt.
  assert.equal(await consume(), 1);
  confirm(address, 11155111, 1);
  nonceManager.reset({ address, chainId: 11155111 });
  assert.equal(await consume(), 2);
  pending = 9;
  nonceManager.reset({ address, chainId: 11155111 });
  assert.equal(await consume(), 9);
});

test('main refuses to send without ALLOW_SEPOLIA_STORY=yes before reading keys or the network', async () => {
  const previous = process.env.ALLOW_SEPOLIA_STORY;
  const errors: string[] = [];
  const original = console.error;
  console.error = (...items: unknown[]) => { errors.push(items.join(' ')); };
  try {
    delete process.env.ALLOW_SEPOLIA_STORY;
    assert.equal(await main(['full']), 1);
    process.env.ALLOW_SEPOLIA_STORY = 'true';
    assert.equal(await main(['b-pending']), 1);
  } finally {
    console.error = original;
    if (previous === undefined) delete process.env.ALLOW_SEPOLIA_STORY; else process.env.ALLOW_SEPOLIA_STORY = previous;
  }
  assert.equal(errors.length, 2);
  assert.match(errors[0]!, /set ALLOW_SEPOLIA_STORY=yes/);
});
