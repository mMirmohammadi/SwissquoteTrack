import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reviewRecovery, approveRecovery } from '../src/core.js';
import { encodeCode, decodeApprovalCode, hashRecovery, mnemonicToAddress, ADDRESSES, LOCAL_CHAIN_ID } from '@sq/protocol';
import type { PublicClient } from 'viem';
const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const wallet = '0x1111111111111111111111111111111111111111' as const;
const newOwner = '0x2222222222222222222222222222222222222222' as const;
const request = { wallet, newOwner, module: ADDRESSES.moduleA, nonce: 0n, chainId: LOCAL_CHAIN_ID };
const code = encodeCode({ ...request, nonce: '0', v: 1, kind: 'request' });
const config = { chainId: LOCAL_CHAIN_ID };
async function clients(change: { nonce?: bigint; guardian?: boolean; hash?: string } = {}) {
  const fixture = JSON.parse(await readFile(new URL('../../../packages/protocol/test/fixtures/contracts.json', import.meta.url), 'utf8')) as { contracts: { address: string; code: `0x${string}` }[] };
  const moduleCode = fixture.contracts.find(contract => contract.address === request.module)?.code;
  assert(moduleCode, 'Shared deployed module fixture is required.');
  const make = () => ({ getChainId: async () => LOCAL_CHAIN_ID,
    getCode: async ({ address }: { address: string }) => address === request.module ? moduleCode : '0x01',
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getRecoveryHash') return change.hash ?? hashRecovery(request);
      if (functionName === 'nonce') return change.nonce ?? 0n;
      if (functionName === 'isGuardian') return change.guardian ?? true;
      throw new Error('Unexpected call');
    },
  }) as unknown as PublicClient;
  return [make(), make()];
}
test('review verifies both nodes and approval signs matching typed request without a transaction', async () => {
  const nodes = await clients(); const review = await reviewRecovery(code, words, config, nodes);
  assert.equal(review.signer, mnemonicToAddress(words)); assert.equal(review.fingerprint.split(' ').length, 4);
  const approval = decodeApprovalCode(await approveRecovery(code, words, config, review, nodes));
  assert.equal(approval.signer, mnemonicToAddress(words)); assert.equal(approval.signature.length, 132);
});
test('tampered on-chain hash, stale nonce, non-guardian and changed confirmation fail closed', async () => {
  for (const change of [{ hash: '0x' + '00'.repeat(32) }, { nonce: 1n }, { guardian: false }]) await assert.rejects(reviewRecovery(code, words, config, await clients(change)));
  const nodes = await clients(); const review = await reviewRecovery(code, words, config, nodes);
  await assert.rejects(approveRecovery(code, words, config, { ...review, fingerprint: 'tampered fingerprint' }, nodes), /Request changed/);
});
