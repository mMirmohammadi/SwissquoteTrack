import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeEventTopics, encodeAbiParameters, WaitForTransactionReceiptTimeoutError, type Address, type Hex } from 'viem';
import { safeAbi } from '@sq/protocol';
import { confirmedOn, PendingTransactionError, DEFAULT_SEPOLIA_RPC_URLS, SEPOLIA_RECEIPT_TIMEOUT_MS } from '../src/chain';
import { errorMessage } from '../src/api';

const wallet = '0x00000000000000000000000000000000000000aa' as Address;
const hash = `0x${'ab'.repeat(32)}` as Hex;
const link = `https://sepolia.etherscan.io/tx/${hash}`;
const receipt = (status: string, event?: 'ExecutionSuccess'|'ExecutionFailure') => ({ status, blockNumber: 123n, logs: event ? [{ address: wallet, topics: encodeEventTopics({ abi: safeAbi, eventName: event, args: { txHash: hash } }), data: encodeAbiParameters([{ type: 'uint256' }], [0n]) }] : [] });
// Fake receipt reader: records the timeout it was given, then returns or throws what the test asks for.
function rpc(outcome: () => unknown) {
  const seen: { timeout?: number } = {};
  const client = { waitForTransactionReceipt: async (args: { timeout?: number }) => { seen.timeout = args.timeout; return outcome(); } } as unknown as Parameters<typeof confirmedOn>[0];
  return { client, seen };
}
const isPending = (error: unknown) => error instanceof PendingTransactionError && error.hash === hash && error.explorerUrl === link && error.message === `Transaction pending — check Etherscan: ${link}`;

test('Sepolia: no receipt within 180 s is reported as pending with the Etherscan link, not as a failure', async () => {
  assert.equal(SEPOLIA_RECEIPT_TIMEOUT_MS, 180000);
  const timeout = rpc(() => { throw new WaitForTransactionReceiptTimeoutError({ hash }); });
  await assert.rejects(confirmedOn(timeout.client, 11155111, hash, wallet), isPending);
  assert.equal(timeout.seen.timeout, 180000);
  // A public-node error while waiting also leaves the outcome unknown: pending, not failed.
  await assert.rejects(confirmedOn(rpc(() => { throw new Error('HTTP request failed'); }).client, 11155111, hash), isPending);
  assert.equal(errorMessage(new PendingTransactionError(hash)), `Transaction pending — check Etherscan: ${link}`);
});

test('Sepolia: when a receipt exists, the strict revert and ExecutionSuccess checks still apply', async () => {
  const notPending = (pattern: RegExp) => (error: unknown) => !(error instanceof PendingTransactionError) && pattern.test((error as Error).message);
  await assert.rejects(confirmedOn(rpc(() => receipt('reverted')).client, 11155111, hash, wallet), notPending(/reverted/));
  await assert.rejects(confirmedOn(rpc(() => receipt('success', 'ExecutionFailure')).client, 11155111, hash, wallet), notPending(/Safe execution failed/));
  await assert.rejects(confirmedOn(rpc(() => receipt('success')).client, 11155111, hash, wallet), notPending(/does not prove/));
  let seenBlock: bigint | undefined;
  assert.equal(await confirmedOn(rpc(() => receipt('success', 'ExecutionSuccess')).client, 11155111, hash, wallet, block => { seenBlock = block; }), 123n);
  assert.equal(seenBlock, 123n);
  await assert.rejects(confirmedOn(rpc(() => ({ ...receipt('success'), blockNumber: undefined })).client, 11155111, hash), /valid confirmed block/);
  await assert.rejects(confirmedOn(rpc(() => receipt('success')).client, 11155111, '0x123' as Hex), /valid transaction hash/);
});

test('local chain keeps the 90 s wait and still reports a timeout as an error', async () => {
  const timeout = rpc(() => { throw new WaitForTransactionReceiptTimeoutError({ hash }); });
  await assert.rejects(confirmedOn(timeout.client, 31337, hash, wallet), (error: unknown) => error instanceof WaitForTransactionReceiptTimeoutError);
  assert.equal(timeout.seen.timeout, 90000);
});

test('default Sepolia RPCs are two live public nodes, without the dead rpc.sepolia.org', () => {
  assert.deepEqual(DEFAULT_SEPOLIA_RPC_URLS.split(','), ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.ethpandaops.io']);
  assert.ok(!DEFAULT_SEPOLIA_RPC_URLS.split(',').includes('https://rpc.sepolia.org'));
});
