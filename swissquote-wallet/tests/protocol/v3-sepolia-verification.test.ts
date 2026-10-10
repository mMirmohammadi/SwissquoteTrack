import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keccak256, toHex, type Address, type Hex, type PublicClient } from 'viem';
import { ADDRESSES, FALLBACK_STORAGE_SLOT, GUARD_STORAGE_SLOT, PROXY_CREATION_CODE_HASH, PROXY_RUNTIME_CODE_HASH } from '../../packages/protocol/src/constants.ts';
import { computeWalletAddress } from '../../packages/protocol/src/wallet.ts';
import { verifyWallet, verifyWalletIndependent } from '../../packages/protocol/src/verification.ts';
const fixture = JSON.parse(readFileSync(new URL('../../contracts/contracts/plan/sepolia-code.json', import.meta.url), 'utf8'));
const moduleB = JSON.parse(readFileSync(new URL('../../contracts/contracts/plan/sepolia-module-b.json', import.meta.url), 'utf8'));
const codes = new Map<string, Hex>(Object.values(fixture.contracts).map((item: any) => [item.address.toLowerCase(), item.code]));
codes.set(moduleB.address.toLowerCase(), moduleB.code);
// Extract public embedded proxy bytecode from the saved factory, matching the pinned
// hashes rather than relying on missing contract node_modules artifacts.
function embedded(bytes: Hex, hash: Hex): Hex {
  const hex = bytes.slice(2);
  for (let start = 0; start < hex.length; start += 2) {
    if (!hex.slice(start).startsWith('6080604052')) continue;
    for (let length = 10; start + length <= hex.length; length += 2) {
      const code = `0x${hex.slice(start, start + length)}` as Hex;
      if (keccak256(code) === hash) return code;
    }
  }
  throw new Error('Pinned public proxy code not found in saved factory fixture');
}
const factory = codes.get(ADDRESSES.factory.toLowerCase())!;
const creation = embedded(factory, PROXY_CREATION_CODE_HASH);
const runtime = embedded(creation, PROXY_RUNTIME_CODE_HASH);
const setup = { owner: '0x1111111111111111111111111111111111111111' as Address, cardGuardian: '0x2222222222222222222222222222222222222222' as Address, partnerGuardian: '0x3333333333333333333333333333333333333333' as Address, sqGuardian: '0x4444444444444444444444444444444444444444' as Address, saltNonce: 12n, chainId: 11155111 };
const wallet = computeWalletAddress(setup, creation);
function rpc(head: bigint, historyCode: Hex = '0x', failHistory = false) {
  const reads: any[] = [];
  const client = {
    getChainId: async () => 11155111, getBlockNumber: async () => head,
    getCode: async (args: any) => { reads.push(args); return args.address.toLowerCase() === wallet.toLowerCase() ? args.blockNumber === 10n ? historyCode : runtime : codes.get(args.address.toLowerCase()); },
    getStorageAt: async (args: any) => { reads.push(args); return toHex(args.slot === GUARD_STORAGE_SLOT ? 0n : args.slot === FALLBACK_STORAGE_SLOT ? BigInt(ADDRESSES.fallbackHandler) : BigInt(ADDRESSES.safeL2), { size: 32 }); },
    getLogs: async (args: any) => { reads.push(args); if (failHistory) throw new Error('fixture history unavailable'); return []; },
    readContract: async (args: any) => {
      reads.push(args);
      const b = args.address.toLowerCase() === ADDRESSES.moduleB.toLowerCase();
      switch (args.functionName) {
        case 'proxyCreationCode': return creation;
        case 'getOwners': return [setup.owner]; case 'getThreshold': return 1n;
        case 'nonce': return 0n;
        case 'getModulesPaginated': return [[ADDRESSES.moduleA, ADDRESSES.moduleB], '0x0000000000000000000000000000000000000001'];
        case 'getGuardians': return [setup.cardGuardian, b ? setup.sqGuardian : setup.partnerGuardian];
        case 'threshold': case 'guardiansCount': return 2n;
        case 'getRecoveryRequest': return { executeAfter: 0n };
        default: throw new Error(`unexpected fixture read ${args.functionName}`);
      }
    },
  } as unknown as PublicClient;
  return { client, reads };
}
test('TEST DOUBLE: independent verification pins every read and log to one shared public head', async () => {
  const one = rpc(100n), two = rpc(102n);
  const result = await verifyWalletIndependent([one.client, two.client], setup, { expectedWallet: wallet });
  assert.equal(result.ok, true, result.reasons.join('; '));
  for (const args of [...one.reads, ...two.reads]) assert.equal(args.blockNumber ?? args.toBlock, 100n);
});
test('TEST DOUBLE: bounded history only verifies if proxy did not exist at the start, never skips nonce-zero module history', async () => {
  assert.equal((await verifyWallet(rpc(100n).client, setup, { fromBlock: 10n })).ok, true);
  const truncated = await verifyWallet(rpc(100n, runtime).client, setup, { fromBlock: 10n });
  assert.equal(truncated.ok, false); assert.match(truncated.reasons.join('; '), /already existed/);
  assert.equal((await verifyWallet(rpc(100n, '0x', true).client, setup, { fromBlock: 10n })).ok, false);
  assert.equal((await verifyWallet(rpc(100n).client, setup, { fromBlock: -1n })).ok, false);
});
test('TEST DOUBLE: a large-range-refusing node receives only complete 10000-block chunks', async () => {
  const one = rpc(20100n);
  const requests: any[] = [];
  one.client.getLogs = async (args: any) => {
    requests.push(args);
    if (args.toBlock - args.fromBlock + 1n > 10000n) throw new Error('fixture range too large');
    return [];
  };
  const result = await verifyWallet(one.client, setup, { fromBlock: 10n });
  assert.equal(result.ok, true, result.reasons.join('; '));
  for (const event of ['SafeModuleTransaction']) {
    const ranges = requests.filter(args => args.event.name === event);
    assert.deepEqual(ranges.map(args => [args.fromBlock, args.toBlock]), [[10n, 10009n], [10010n, 20009n], [20010n, 20100n]]);
  }
});
test('TEST DOUBLE: unreadable independent head fails closed', async () => {
  const one = rpc(100n), two = rpc(102n);
  two.client.getBlockNumber = async () => { throw new Error('fixture head unavailable'); };
  const result = await verifyWalletIndependent([one.client, two.client], setup);
  assert.equal(result.ok, false); assert.match(result.reasons.join('; '), /head unavailable/);
});
