import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeAbiParameters, type Address, type Hex, type PublicClient } from 'viem';
import { ADDRESSES, CHAIN_ID, FALLBACK_STORAGE_SLOT, GUARD_STORAGE_SLOT, MODULES, SENTINEL_ADDRESS, computeWalletAddress, mnemonicToAddress, encodeCode } from '@sq/protocol';
import { checkWallet, checkKitCurrentOwner } from '../src/core.js';
const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const fixture = JSON.parse(readFileSync(new URL('../../../packages/protocol/test/fixtures/contracts.json', import.meta.url), 'utf8')) as { contracts: { address: Address; code: Hex }[]; proxyCreationCode: Hex; proxyRuntimeCode: Hex };
const codes = new Map(fixture.contracts.map(contract => [contract.address.toLowerCase(), contract.code]));
const setup = { owner: '0x1111111111111111111111111111111111111111' as Address, cardGuardian: mnemonicToAddress(words), partnerGuardian: '0x2222222222222222222222222222222222222222' as Address, sqGuardian: '0x3333333333333333333333333333333333333333' as Address, saltNonce: 99n, chainId: CHAIN_ID };
const wallet = computeWalletAddress(setup, fixture.proxyCreationCode);
const code = (change: Record<string, unknown> = {}) => encodeCode({ v: 1, kind: 'setup', chainId: CHAIN_ID, wallet, owner: setup.owner, partnerGuardian: setup.partnerGuardian, sqGuardian: setup.sqGuardian, saltNonce: '99', ...change });
function client(hiddenOwner = false, currentOwner: Address = setup.owner): PublicClient {
  return {
    getChainId: async () => CHAIN_ID,
    getCode: async ({ address }: { address: Address }) => codes.get(address.toLowerCase()) ?? fixture.proxyRuntimeCode,
    getStorageAt: async ({ slot }: { slot: string }) => slot === GUARD_STORAGE_SLOT ? '0x' + '0'.repeat(64) : encodeAbiParameters([{ type: 'uint256' }], [BigInt(slot === FALLBACK_STORAGE_SLOT ? ADDRESSES.fallbackHandler : ADDRESSES.safeL2)]),
    readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
      switch (functionName) {
        case 'proxyCreationCode': return fixture.proxyCreationCode;
        case 'nonce': return 0n;
        case 'getOwners': return hiddenOwner ? [currentOwner, setup.partnerGuardian] : [currentOwner];
        case 'getThreshold': return 1n;
        case 'getModulesPaginated': return [MODULES, SENTINEL_ADDRESS];
        case 'getGuardians': return [setup.cardGuardian, address.toLowerCase() === ADDRESSES.moduleA.toLowerCase() ? setup.partnerGuardian : setup.sqGuardian];
        case 'threshold': return 2n;
        case 'guardiansCount': return 2n;
        case 'getRecoveryRequest': return { executeAfter: 0n };
        default: throw new Error('Unexpected test read');
      }
    },
    getBlockNumber: async () => 100n,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ number: blockNumber, hash: '0x' + '1'.repeat(64) }),
    getLogs: async () => [],
  } as unknown as PublicClient;
}
test('wallet check derives card locally and reconstructs exact CREATE2 setup using both RPCs', async () => {
  const result = await checkWallet(code(), words, { chainId: CHAIN_ID }, [client(), client()]);
  assert.equal(result.ok, true); assert.equal(result.wallet, wallet);
});
test('rotated owner needs independent current-owner input without changing original initializer', async () => {
  const replacement = '0x6666666666666666666666666666666666666666' as Address;
  assert.equal((await checkWallet(code(), words, { chainId: CHAIN_ID }, [client(false, replacement), client(false, replacement)])).ok, false);
  assert.equal((await checkWallet(code(), words, { chainId: CHAIN_ID }, [client(false, replacement), client(false, replacement)], replacement)).ok, true);
  assert.equal((await checkWallet(code({ owner: replacement }), words, { chainId: CHAIN_ID }, [client(false, replacement), client(false, replacement)], replacement)).ok, false);
});
test('current kit owner is checked at a pinned block; stale or disagreeing kit is refused', async () => {
  const kit = { wallet, owner: setup.owner, chainId: CHAIN_ID };
  assert.equal((await checkKitCurrentOwner(kit, { chainId: CHAIN_ID }, [client(), client()])).blockNumber, 100n);
  await assert.rejects(checkKitCurrentOwner(kit, { chainId: CHAIN_ID }, [client(false, setup.partnerGuardian), client(false, setup.partnerGuardian)]), /Stale or unsupported kit/);
  await assert.rejects(checkKitCurrentOwner(kit, { chainId: CHAIN_ID }, [client(), client(false, setup.partnerGuardian)]), /disagree/);
  await assert.rejects(checkKitCurrentOwner(kit, { chainId: 31337 }, [client(), client()]), /chain/);
});
test('tampered setup address/salt/guardian, wrong card and a disagreeing node cannot verify', async () => {
  for (const change of [{ wallet: setup.owner }, { saltNonce: '100' }, { partnerGuardian: '0x4444444444444444444444444444444444444444' }]) {
    assert.equal((await checkWallet(code(change), words, { chainId: CHAIN_ID }, [client(), client()])).ok, false);
  }
  const otherWords = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  assert.equal((await checkWallet(code(), otherWords, { chainId: CHAIN_ID }, [client(), client()])).ok, false);
  assert.equal((await checkWallet(code(), words, { chainId: CHAIN_ID }, [client(), client(true)])).ok, false);
});
