import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { encodeEventTopics, encodeAbiParameters, type Address, type Hex } from 'viem';
import { safeAbi, generateOwnerSeed, mnemonicToAddress, encryptSeed } from '@sq/protocol';
import { App } from '../src/App';
import { client, usdcAmount, validatedAddress, countdown, confirmed } from '../src/chain';
import { call, ServiceError, errorMessage } from '../src/api';
import { unlockDevice, saveDevice } from '../src/storage';
const wallet = '0x1111111111111111111111111111111111111111' as Address;
const hash = `0x${'12'.repeat(32)}` as Hex;

test('amounts are exact, positive USDC integers with six decimal places', () => {
  assert.equal(usdcAmount('0.000001'), 1n); assert.equal(usdcAmount('5'), 5000000n);
  for (const value of ['0', '-1', '1e3', '1.0000001', '01', '', ' 2', 'Infinity']) assert.throws(() => usdcAmount(value));
  assert.equal(validatedAddress(wallet), wallet); assert.throws(() => validatedAddress(`0x${'0'.repeat(40)}`)); assert.throws(() => validatedAddress('not-an-address'));
});
test('countdown follows executeAfter and never reports negative time', () => {
  assert.equal(countdown(180n, 0), '3m 0s'); assert.equal(countdown(259200n, 0), '3d 0m 0s'); assert.equal(countdown(1n, 2000), 'Ready to finalize');
});
test('API adapter uses actual endpoint and Bearer header, surfaces HTTP failures', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => { assert.equal(String(url), 'http://localhost:4001/relay/safe-tx'); assert.equal((options?.headers as Record<string,string>).Authorization, 'Bearer opaque-test-session'); assert.deepEqual(JSON.parse(String(options?.body)), { nonce: '3' }); return new Response('{"error":"Stale Safe nonce"}', { status: 409 }); };
    await assert.rejects(call('/relay/safe-tx', { token: 'opaque-test-session', body: { nonce: '3' } }), (error: unknown) => error instanceof ServiceError && error.status === 409 && error.message === 'Stale Safe nonce');
    globalThis.fetch = async () => new Response('not-json'); await assert.rejects(call('/account'), /unreadable/);
    globalThis.fetch = async () => { throw new Error('socket failure'); }; await assert.rejects(call('/account'), /Cannot reach/);
  } finally { globalThis.fetch = original; }
});
test('network receipt success does not fake a successful Safe transaction', async () => {
  const original = client.waitForTransactionReceipt;
  const receipt = (status: string, event?: 'ExecutionSuccess'|'ExecutionFailure') => ({ status, logs: event ? [{ address: wallet, topics: encodeEventTopics({ abi: safeAbi, eventName: event, args: { txHash: hash } }), data: encodeAbiParameters([{type:'uint256'}], [0n]) }] : [] });
  try {
    (client as unknown as {waitForTransactionReceipt: unknown}).waitForTransactionReceipt = async () => receipt('reverted'); await assert.rejects(confirmed(hash), /reverted/);
    (client as unknown as {waitForTransactionReceipt: unknown}).waitForTransactionReceipt = async () => receipt('success', 'ExecutionFailure'); await assert.rejects(confirmed(hash, wallet), /Safe execution failed/);
    (client as unknown as {waitForTransactionReceipt: unknown}).waitForTransactionReceipt = async () => receipt('success'); await assert.rejects(confirmed(hash, wallet), /does not prove/);
    (client as unknown as {waitForTransactionReceipt: unknown}).waitForTransactionReceipt = async () => receipt('success', 'ExecutionSuccess'); await confirmed(hash, wallet);
  } finally { client.waitForTransactionReceipt = original; }
  await assert.rejects(confirmed('0x123' as Hex), /valid transaction hash/);
});
test('device encryption cannot be unlocked by a reset login password', async () => {
  const seed = generateOwnerSeed(); const owner = mnemonicToAddress(seed); const envelope = await encryptSeed(seed, 'device-passphrase-example');
  const record = {id:'test-client',owner,envelope,createdAt:'2026-10-10'};
  assert.equal(await unlockDevice(record, 'device-passphrase-example'), seed);
  await assert.rejects(unlockDevice(record, 'reset-login-password'), /resetting your login password does not unlock/);
  await assert.rejects(saveDevice('test-client', seed, 'short', owner), /at least 12/);
  assert.equal(JSON.stringify(record).includes(seed), false);
});
test('runnable React shell has accessible authentication, navigation and honest MOCK labels', () => {
  const html = renderToStaticMarkup(createElement(App)); assert.match(html, /A wallet that feels like home/); assert.match(html, /Wallet navigation/); assert.match(html, /type="password"/); assert.match(html, /MOCK demo lab/); assert.match(html, /Login opens your account/);
});
test('wallet source excludes card words, requires passkey, and persists encrypted replacements first', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /generateCardSeed|cardMnemonic|cardWords|generatePrivateKey/);
  const lifecycle = await readFile(new URL('../src/lifecycle.ts', import.meta.url), 'utf8');
  assert.match(lifecycle, /wallets\/challenge/); assert.match(source, /safeTxHash: hash/); assert.match(source, /step\.safeTxHash\.toLowerCase\(\) !== hash\.toLowerCase\(\)/);
  assert.match(source, /saveDevice\(`\$\{session\.clientId\}:replacement`/); assert.match(source, /await owners\(wallet\)/);
  assert.equal(errorMessage(new Error('execution reverted GS026')), 'Blocked: this old device no longer controls the wallet (GS026).');
});
