import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverTypedDataAddress, type PublicClient } from 'viem';
import { ADDRESSES, decodeApprovalCode, hashRecovery, recoveryTypedData } from '@sq/protocol';
import { createPartnerService, type RecoverySnapshot } from '../src/service.ts';
import { MemoryPartnerStore } from '../src/storage.ts';
import { createViemChainReader, partnerCrypto } from '../src/runtime.ts';

const wallet = '0x1111111111111111111111111111111111111111';
const newOwner = '0x2222222222222222222222222222222222222222';
const card = '0x4444444444444444444444444444444444444444';
test('real EIP-712 approval recovers the enrolled guardian and decodes through protocol', async () => {
  const store = new MemoryPartnerStore();
  const service = createPartnerService({ store, crypto: partnerCrypto, moduleA: ADDRESSES.moduleA, chainId: 31337, chainReader: {
    async readRecovery(input): Promise<RecoverySnapshot> {
      return { chainId: 31337, nonce: 4n, guardians: [input.guardian, card], threshold: 2n, recoveryHash: hashRecovery({ ...input, nonce: 4n }) };
    },
  } });
  const enrollment = service.enroll({ userRef: 'real-crypto-test', mockFace: 'MOCK face' });
  const approval = await service.approve({ userRef: enrollment.userRef, mockFace: 'MOCK face', wallet, newOwner, nonce: '4' });
  const recovered = await recoverTypedDataAddress({ ...recoveryTypedData({ ...approval.request, nonce: 4n }), signature: approval.signature });
  assert.equal(recovered, enrollment.guardian);
  const code = decodeApprovalCode(approval.approvalCode);
  assert.equal(code.signer, enrollment.guardian);
  assert.equal(code.signature, approval.signature);
  assert.equal(code.chainId, 31337);
  assert.equal('privateKey' in approval, false);
});
test('chain reader refuses wrong chain before state reads', async () => {
  const reader = createViemChainReader({ getChainId: async () => 11155111 } as unknown as PublicClient);
  await assert.rejects(reader.readRecovery({ wallet, newOwner, guardian: card, module: ADDRESSES.moduleA, chainId: 31337 }), /RPC chain mismatch/);
});
test('chain reader refuses absent wallet, disabled module and unpinned module code', async () => {
  for (const change of [{ walletCode: '0x' }, { enabled: false }, { moduleCode: '0x6000' }]) {
    const values = { walletCode: '0x6001', moduleCode: '0x6000', enabled: true, ...change };
    const client = {
      getChainId: async () => 31337,
      getBlockNumber: async () => 77n,
      getCode: async ({ address }: { address: string }) => address === wallet ? values.walletCode : values.moduleCode,
      readContract: async ({ functionName, blockNumber }: { functionName: string; blockNumber: bigint }) => {
        assert.equal(blockNumber, 77n);
        if (functionName === 'isModuleEnabled') return values.enabled;
        if (functionName === 'nonce') return 4n;
        if (functionName === 'getGuardians') return [card, newOwner];
        if (functionName === 'threshold') return 2n;
        throw new Error('Hash must not be read for unsafe code');
      },
    } as unknown as PublicClient;
    await assert.rejects(createViemChainReader(client).readRecovery({ wallet, newOwner, guardian: card, module: ADDRESSES.moduleA, chainId: 31337 }));
  }
});
