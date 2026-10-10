import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeEventTopics, type Address, type Hex } from 'viem';
import { ADDRESSES, DAPP_ADDRESSES, decodeDappBatch, decodeMultiSendCall, safeAbi, type DappEntry } from '@sq/protocol';
import { buildDappTx, checkedPreview, checkedRegistry, confirmedPermission, parseAmount, verifySafeReceipt } from './helpers';

const wallet = '0x1111111111111111111111111111111111111111' as Address;
const spender = '0x2222222222222222222222222222222222222222' as Address;
const hash = `0x${'a'.repeat(64)}` as Hex;
const entry: DappEntry = { id: 'compound-test', name: 'Compound test', address: spender, chainId: 11155111, warning: 'Third-party test deployment' };
const preview = { dappId: entry.id, summary: ['Service simulation: supply USDC.'], warnings: [], blockNumber: '12', effectsHash: hash };

test('amounts are exact six-decimal integers, never rounded or unlimited', () => {
  assert.equal(parseAmount('2.000001'), 2000001n);
  for (const invalid of ['0', '-1', '1e2', '.5', '01', '1.0000001', 'Infinity', ' 1 ', (2n ** 256n).toString()]) {
    assert.throws(() => parseAmount(invalid));
  }
});

test('preview fails closed on missing simulation, malformed hash, or another dApp', () => {
  assert.deepEqual(checkedPreview(preview, entry.id), preview);
  for (const invalid of [undefined, {}, { ...preview, summary: [] }, { ...preview, summary: [''] },
    { ...preview, dappId: 'other' }, { ...preview, effectsHash: '0x' }, { ...preview, blockNumber: '-1' },
    { ...preview, warnings: undefined }]) {
    assert.throws(() => checkedPreview(invalid, entry.id));
  }
});

test('registry requires the local pinned id, address, and chain', () => {
  assert.deepEqual(checkedRegistry([entry], [entry], 11155111), [entry]);
  assert.deepEqual(checkedRegistry({ dapps: [entry] }, [entry], 11155111), [entry]);
  assert.deepEqual(checkedRegistry([{ ...entry, address: wallet }], [entry], 11155111), []);
  assert.deepEqual(checkedRegistry([{ ...entry, id: 'unlisted' }], [entry], 11155111), []);
  assert.deepEqual(checkedRegistry([entry], [entry], 31337), []);
  assert.throws(() => checkedRegistry({}, [entry], 11155111));
});

test('an HTTP transaction hash or successful outer receipt does not prove Safe success', () => {
  const receipt = { status: 'success', logs: [] };
  assert.throws(() => verifySafeReceipt(receipt, wallet));
  const event = { address: wallet, topics: encodeEventTopics({ abi: safeAbi, eventName: 'ExecutionSuccess', args: { txHash: hash } }) as Hex[], data: `0x${'0'.repeat(64)}` as Hex };
  verifySafeReceipt({ ...receipt, logs: [event] }, wallet);
  assert.throws(() => verifySafeReceipt({ status: 'reverted', logs: [event] }, wallet));
  assert.throws(() => verifySafeReceipt({ ...receipt, logs: [{ ...event, address: spender }] }, wallet));
  const failed = { ...event, topics: encodeEventTopics({ abi: safeAbi, eventName: 'ExecutionFailure', args: { txHash: hash } }) as Hex[] };
  assert.throws(() => verifySafeReceipt({ ...receipt, logs: [event, failed] }, wallet));
});

test('supply and swap encode exact approval/action/revoke0 through protocol', () => {
  for (const operation of ['supply', 'swap'] as const) {
    const tx = buildDappTx(wallet, operation, 1000001n, 7n, operation === 'swap' ? 900001n : undefined);
    assert.equal(tx.to, ADDRESSES.multiSendCallOnly);
    assert.equal(tx.operation, 1);
    assert.equal(tx.nonce, 7n);
    const calls = decodeMultiSendCall(tx.data);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].to.toLowerCase(), DAPP_ADDRESSES.usdc.toLowerCase());
    const decoded = decodeDappBatch(wallet, calls);
    assert.equal(decoded.action, operation);
    assert.equal(decoded.amount, 1000001n);
    if (operation === 'swap') assert.equal(decoded.minimumOutput, 891001n);
  }
});

test('withdraw is a lone protocol action, not an unnecessary spending approval', () => {
  const tx = buildDappTx(wallet, 'withdraw', 2000000n, 8n);
  const calls = decodeMultiSendCall(tx.data);
  assert.equal(calls.length, 1);
  assert.equal(decodeDappBatch(wallet, calls).action, 'withdraw');
});

test('builders refuse stale/missing or out-of-range quote and demo-limit violations', () => {
  for (const quote of [undefined, 799999n, 1000001n]) assert.throws(() => buildDappTx(wallet, 'swap', 1000000n, 1n, quote));
  for (const amount of [0n, -1n, 5000001n]) assert.throws(() => buildDappTx(wallet, 'supply', amount, 1n));
});

test('permission verification reads at the receipt block, not latest state', async () => {
  let observed: unknown;
  const client = { readContract: async (args: unknown) => { observed = args; return 0n; } };
  const permission = await confirmedPermission(client as Parameters<typeof confirmedPermission>[0], wallet, wallet, spender, 42n);
  assert.equal(permission, 0n);
  assert.equal((observed as { blockNumber: bigint }).blockNumber, 42n);
});
