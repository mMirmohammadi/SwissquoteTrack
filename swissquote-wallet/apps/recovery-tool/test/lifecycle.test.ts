import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toHex, type Address, type Hex, type PublicClient } from 'viem';
import { ADDRESSES, GUARD_STORAGE_SLOT, FALLBACK_STORAGE_SLOT, mnemonicToAddress, computeWalletAddress, encodeCode } from '@sq/protocol';
import { checkWallet } from '../src/core.js';
const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const setup = { owner: '0x1111111111111111111111111111111111111111' as Address, cardGuardian: mnemonicToAddress(words), partnerGuardian: '0x2222222222222222222222222222222222222222' as Address, sqGuardian: '0x3333333333333333333333333333333333333333' as Address, saltNonce: 5n, chainId: 31337 };
const artifact = JSON.parse(readFileSync(new URL('../../../contracts/node_modules/@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('../../../contracts/contracts/plan/sepolia-code.json', import.meta.url), 'utf8'));
const moduleB = JSON.parse(readFileSync(new URL('../../../contracts/contracts/plan/sepolia-module-b.json', import.meta.url), 'utf8'));
const codes = new Map<string, Hex>(Object.values(fixture.contracts).map((value) => { const item = value as { address: string; code: Hex }; return [item.address.toLowerCase(), item.code]; }));
codes.set(moduleB.address.toLowerCase(), moduleB.code);
const wallet = computeWalletAddress(setup, artifact.bytecode);
const currentOwner = '0x4444444444444444444444444444444444444444' as Address;
const code = encodeCode({ v: 1, kind: 'setup', chainId: 31337, wallet, owner: setup.owner, partnerGuardian: setup.partnerGuardian, sqGuardian: setup.sqGuardian, saltNonce: '5' });
function client(owner: Address): PublicClient {
  return {
    getChainId: async () => 31337,
    getCode: async ({ address }: { address: Address }) => address.toLowerCase() === wallet.toLowerCase() ? artifact.deployedBytecode : codes.get(address.toLowerCase()),
    getStorageAt: async ({ slot }: { slot: Hex }) => toHex(slot === GUARD_STORAGE_SLOT ? 0n : slot === FALLBACK_STORAGE_SLOT ? BigInt(ADDRESSES.fallbackHandler) : BigInt(ADDRESSES.safeL2), { size: 32 }),
    getBlockNumber: async () => 20n,
    getLogs: async () => [],
    readContract: async ({ functionName, address }: { functionName: string; address: Address }) => {
      switch (functionName) {
        case 'proxyCreationCode': return artifact.bytecode;
        case 'nonce': return 0n;
        case 'getOwners': return [owner];
        case 'getThreshold': return 1n;
        case 'getModulesPaginated': return [[ADDRESSES.moduleA, ADDRESSES.moduleB], '0x0000000000000000000000000000000000000001'];
        case 'getGuardians': return [setup.cardGuardian, address.toLowerCase() === ADDRESSES.moduleA.toLowerCase() ? setup.partnerGuardian : setup.sqGuardian];
        case 'threshold': return 2n;
        case 'guardiansCount': return 2n;
        case 'getRecoveryRequest': return { executeAfter: 0n };
        default: throw new Error(`Unexpected read ${functionName}`);
      }
    },
  } as unknown as PublicClient;
}
test('independent check requires an explicit current-owner expectation after replacement, preserving original CREATE2', async () => {
  const clients = [client(currentOwner), client(currentOwner)];
  assert.equal((await checkWallet(code, words, { chainId: 31337 }, clients)).ok, false, 'RPC owner must never become its own expected value');
  const result = await checkWallet(code, words, { chainId: 31337 }, clients, currentOwner);
  assert.equal(result.ok, true, result.reasons.join('; ')); assert.equal(result.wallet.toLowerCase(), wallet.toLowerCase());
  assert.equal((await checkWallet(code, words, { chainId: 31337 }, clients, setup.owner)).ok, false);
  assert.equal((await checkWallet(code, words, { chainId: 31337 }, [client(currentOwner), client(setup.owner)], currentOwner)).ok, false);
  await assert.rejects(checkWallet(code, words, { chainId: 31337 }, clients, '0x1234'), /independently confirmed/);
});
