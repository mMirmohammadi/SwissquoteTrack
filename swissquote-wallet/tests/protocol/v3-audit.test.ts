import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeAbiParameters, type Address, type Hex, type PublicClient } from 'viem';
import { auditWallet, ADDRESSES, CHAIN_ID, FALLBACK_STORAGE_SLOT, GUARD_STORAGE_SLOT, MODULES, SENTINEL_ADDRESS } from '../../packages/protocol/src/index.js';
const wallet = '0x1111111111111111111111111111111111111111' as Address;
const owner = '0x2222222222222222222222222222222222222222' as Address;
const card = '0x3333333333333333333333333333333333333333' as Address;
const partner = '0x4444444444444444444444444444444444444444' as Address;
const sq = '0x5555555555555555555555555555555555555555' as Address;
const fixture = JSON.parse(readFileSync(new URL('../../packages/protocol/test/fixtures/contracts.json', import.meta.url), 'utf8')) as { contracts: { address: Address; code: Hex }[]; proxyRuntimeCode: Hex };
const codes = new Map(fixture.contracts.map(c => [c.address.toLowerCase(), c.code]));
type Options = { head?: bigint; extraOwner?: boolean; extraModule?: boolean; guard?: boolean; badCode?: boolean; fail?: boolean; hash?: Hex; pending?: boolean; threshold?: bigint; missingModule?: boolean; cardless?: boolean; fallback?: boolean };
function client(options: Options = {}, reads: bigint[] = []): PublicClient {
  const pin = ({ blockNumber }: { blockNumber: bigint }) => { reads.push(blockNumber); if (options.fail) throw new Error('RPC unavailable'); };
  return {
    getChainId: async () => CHAIN_ID,
    getBlockNumber: async () => options.head ?? 110n,
    getBlock: async (args: { blockNumber: bigint }) => { pin(args); return { number: args.blockNumber, hash: options.hash ?? '0x' + '1'.repeat(64), timestamp: 1000n }; },
    getCode: async (args: { address: Address; blockNumber: bigint }) => { pin(args); return options.badCode ? '0x01' : args.address === wallet ? fixture.proxyRuntimeCode : codes.get(args.address.toLowerCase()); },
    getStorageAt: async (args: { slot: Hex; blockNumber: bigint }) => { pin(args); return encodeAbiParameters([{ type: 'uint256' }], [args.slot === GUARD_STORAGE_SLOT ? (options.guard ? 1n : 0n) : BigInt(args.slot === FALLBACK_STORAGE_SLOT ? (options.fallback ? owner : ADDRESSES.fallbackHandler) : ADDRESSES.safeL2)]); },
    readContract: async (args: { address: Address; functionName: string; blockNumber: bigint }) => {
      pin(args);
      switch (args.functionName) {
        case 'getOwners': return options.extraOwner ? [owner, sq] : [owner];
        case 'getThreshold': return 1n;
        case 'getModulesPaginated': return [options.extraModule ? [...MODULES, owner] : options.missingModule ? [MODULES[0]] : MODULES, SENTINEL_ADDRESS];
        case 'getGuardians': return [options.cardless && args.address === MODULES[1] ? owner : card, args.address === MODULES[0] ? partner : sq];
        case 'threshold': return options.threshold ?? 2n;
        case 'guardiansCount': return 2n;
        case 'getRecoveryRequest': return { guardiansApprovalCount: options.pending ? 2n : 0n, newThreshold: 1n, executeAfter: options.pending ? 1500n : 0n, newOwners: options.pending ? [sq] : [] };
        default: throw new Error('Unexpected read');
      }
    },
  } as unknown as PublicClient;
}
test('audit pins every read to minimum shared head and reports qualified identities/owner-key risk', async () => {
  const reads: bigint[] = [];
  const report = await auditWallet([client({ head: 100n }, reads), client({}, reads)], wallet);
  assert.equal(report.facts.verified, true);
  assert.equal(report.facts.blockNumber, '100');
  assert(reads.length > 10 && reads.every(x => x === 100n));
  assert.equal(report.answers[0]!.answer, 'unknown');
  assert(report.answers.some(a => a.answer === 'yes' && /thief/.test(a.question)));
  assert(report.warnings.some(w => /malicious app version/.test(w)));
});
test('extra owner/module, missing module, hidden guard/fallback, threshold and cardless paths cannot pass', async () => {
  for (const change of [{ extraOwner: true }, { extraModule: true }, { missingModule: true }, { guard: true }, { fallback: true }, { threshold: 1n }, { cardless: true }]) {
    const report = await auditWallet([client(change), client(change)], wallet);
    assert.equal(report.facts.verified, false, JSON.stringify(change, (_, v) => typeof v === 'bigint' ? String(v) : v));
    assert(!report.answers.some(a => a.answer === 'no'));
  }
});
test('RPC failure/disagreement/missing bytecode never confirms rules', async () => {
  for (const change of [{ fail: true }, { badCode: true }, { extraOwner: true }, { hash: ('0x' + '2'.repeat(64)) as Hex }]) assert.equal((await auditWallet([client(), client(change)], wallet)).facts.verified, false);
  const single = client(); assert.equal((await auditWallet([single, single], wallet)).facts.verified, false);
});
test('pending recovery remains prominent with new owner and exact deadline', async () => {
  const report = await auditWallet([client({ pending: true }), client({ pending: true })], wallet);
  assert.equal(report.facts.verified, true);
  assert(report.warnings.some(w => w.includes(sq) && w.includes('1500') && w.includes('cancel')));
});
