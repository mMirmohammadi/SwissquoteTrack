import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getAddress, type Address, type Hex, type PublicClient } from 'viem';
import * as p from '../../packages/protocol/src/index.ts';
import { addressGroups, assertReady, cardApproval, helperApproval, pollRecovery, remaining, POLL_MS } from '../../apps/wallet/src/features/recovery/core.ts';
import { createApp } from '../../services/swissquote/src/app.ts';
import { createPartnerService } from '../../services/partner/src/service.ts';
import { createPartnerServer } from '../../services/partner/src/server.ts';
import { MemoryPartnerStore } from '../../services/partner/src/storage.ts';
import type { ChainAdapter, ChainOperation } from '../../services/swissquote/src/types.ts';

const wallet = '0x1111111111111111111111111111111111111111' as Address;
const ownerKey = generatePrivateKey();
const owner = privateKeyToAccount(ownerKey).address;
const newOwner = privateKeyToAccount(generatePrivateKey()).address;
const request: p.RecoveryRequest = { wallet, module: p.ADDRESSES.moduleA, newOwner, nonce: 7n, chainId: 31337 };
const empty = { executeAfter: 0n, newOwners: [] as Address[], newThreshold: 0n };
function fakeClient(options: { head?: bigint; timestamp?: bigint; pending?: typeof empty; fail?: boolean; chainId?: number; seen?: bigint[] } = {}): PublicClient {
  return {
    async getChainId() { if (options.fail) throw new Error('Offline node'); return options.chainId ?? 31337; },
    async getBlockNumber() { return options.head ?? 100n; },
    async getBlock({ blockNumber }: { blockNumber: bigint }) { options.seen?.push(blockNumber); return { timestamp: options.timestamp ?? 215n }; },
    async readContract({ address, blockNumber }: { address: Address; blockNumber: bigint }) { options.seen?.push(blockNumber); return address.toLowerCase() === p.ADDRESSES.moduleA.toLowerCase() ? options.pending ?? empty : empty; },
  } as unknown as PublicClient;
}
const pending = { executeAfter: 200n, newOwners: [newOwner], newThreshold: 1n };

test('v3 recovery polling pins both modules and both nodes to the lower common block', async () => {
  const seen: bigint[] = [];
  const snapshot = await pollRecovery([fakeClient({ head: 110n, pending, seen }), fakeClient({ head: 100n, pending, seen })], wallet, 31337);
  assert.equal(snapshot.certain, true); assert.equal(snapshot.pending.length, 1);
  assert.ok(seen.length === 6 && seen.every(block => block === 100n));
  assertReady(snapshot, request); assert.equal(POLL_MS, 15000);
});
test('v3 disagreement preserves a positive request but cannot declare ready/clear', async () => {
  const snapshot = await pollRecovery([fakeClient({ pending }), fakeClient()], wallet, 31337);
  assert.equal(snapshot.certain, false); assert.equal(snapshot.pending.length, 1);
  assert.throws(() => assertReady(snapshot, request), /disagree|polling fails/);
});
test('v3 one-node outage still shows positive recovery; both failing is unknown', async () => {
  const snapshot = await pollRecovery([fakeClient({ pending }), fakeClient({ fail: true })], wallet, 31337);
  assert.equal(snapshot.pending.length, 1); assert.equal(snapshot.certain, false);
  await assert.rejects(pollRecovery([fakeClient({ fail: true }), fakeClient({ fail: true })], wallet, 31337), /unknown/);
  await assert.rejects(pollRecovery([fakeClient()], wallet, 31337), /two independent/);
});
test('v3 wrong-chain node never participates in a clear-status confirmation', async () => {
  const snapshot = await pollRecovery([fakeClient(), fakeClient({ chainId: 11155111 })], wallet, 31337);
  assert.equal(snapshot.certain, false); assert.match(snapshot.warning, /uncertain/);
});
test('v3 finalization uses block timestamp plus margin, not device wall clock', async () => {
  const tooEarly = await pollRecovery([fakeClient({ pending, timestamp: 214n }), fakeClient({ pending, timestamp: 214n })], wallet, 31337);
  assert.throws(() => assertReady(tooEarly, request), /15-second safety margin/);
  assert.match(remaining(200n, 214n), /1s/);
  assert.match(remaining(200n, 215n), /complete/);
  assert.throws(() => assertReady({ ...tooEarly, timestamp: 999n, pending: [{ ...tooEarly.pending[0], newOwners: [owner] }] }, request), /does not match/);
  assert.throws(() => assertReady({ ...tooEarly, timestamp: 999n, pending: [{ ...tooEarly.pending[0], newThreshold: 2n }] }, request), /does not match/);
});
test('v3 owner groups contain the entire checksummed address, not a short fingerprint', () => {
  assert.equal(addressGroups(newOwner).replaceAll(' ', ''), getAddress(newOwner));
  assert.equal(addressGroups(newOwner).split(' ').length, 10);
});
test('v3 card approval binds every request field and expected card signer', async () => {
  const cardKey = generatePrivateKey(); const card = privateKeyToAccount(cardKey).address;
  const approval = await p.signRecovery(cardKey, request);
  const code = p.encodeCode({ v: 1, kind: 'approval', chainId: 31337, ...approval });
  assert.deepEqual(await cardApproval(request, code, card), approval);
  for (const altered of [{ ...request, newOwner: owner }, { ...request, wallet: owner }, { ...request, module: p.ADDRESSES.moduleB }, { ...request, nonce: 8n }, { ...request, chainId: 11155111 }]) {
    await assert.rejects(cardApproval(altered, code, card), /another chain|exact wallet/);
  }
  await assert.rejects(cardApproval(request, code, owner), /required guardian/);
  await assert.rejects(cardApproval(request, 'words are not an approval code', card));
});
test('v3 helper response binds exact public request and verifies its actual signature', async () => {
  const key = generatePrivateKey(); const guardian = privateKeyToAccount(key).address;
  const approval = await p.signRecovery(key, request);
  const response: p.RecoveryApproveResponse = { ...approval, request: { ...request, nonce: '7' }, approvalCode: p.encodeCode({ v: 1, kind: 'approval', chainId: 31337, ...approval }) };
  assert.deepEqual(await helperApproval(request, response, guardian), approval);
  await assert.rejects(helperApproval(request, { ...response, request: { ...response.request, newOwner: owner } }, guardian), /different recovery/);
  await assert.rejects(helperApproval(request, { ...response, signature: (await p.signRecovery(key, { ...request, nonce: 8n })).signature }, guardian), /exact wallet/);
});

// Real HTTP servers + real EIP-712 signatures, with explicit in-memory chain adapters.
// No EVM, RPC, actual wall-clock advancement, live sending, or public-network claim.
// Password-reset hold uses only the injected service clock, never blockchain time.
test('v3 both helper service approvals pass through Swissquote recovery and finalize HTTP orchestration (mock chain)', async t => {
  const cardKey = generatePrivateKey(); const card = privateKeyToAccount(cardKey).address;
  const partnerKey = generatePrivateKey(); const partner = privateKeyToAccount(partnerKey).address;
  const operations: ChainOperation[] = []; const stages: string[] = [];
  const chain: ChainAdapter = {
    chainId: 31337,
    async computeWallet() { return wallet; }, async verifyWallet() { return true; },
    async verifyOwnership(address, message, signature) { const { hashMessage, verifyTypedData } = await import('viem'); return verifyTypedData({ ...p.safeMessageTypedData(address, hashMessage(message), 31337), address: owner, signature }); },
    async safeTxHash(address, tx) { return p.hashSafeTx(address, p.safeTxFromWire(tx as p.SafeTxWire), 31337); },
    async verifyOwnerSignature(address, tx, signature) { return (await import('viem')).verifyTypedData({ ...p.safeTxTypedData(address, p.safeTxFromWire(tx as p.SafeTxWire), 31337), address: owner, signature }); }, async safeNonce() { return '0'; },
    async recoveryHash(req) { return p.hashRecovery({ ...req, nonce: BigInt(req.nonce), chainId: 31337 }); },
    async isGuardian() { return true; },
    async signRecovery(req, key) { return (await p.signRecovery(key, { ...req, nonce: BigInt(req.nonce), chainId: 31337 })).signature; },
    async simulate(op) {
      stages.push(`simulate:${op.kind}`);
      if (op.kind === 'recovery') {
        const bound = { ...op.request, nonce: BigInt(op.request.nonce), chainId: 31337 };
        const approvals = op.request.approvals || [];
        assert.equal(approvals.length, 2);
        const { verifyTypedData } = await import('viem');
        for (const approval of approvals) assert.ok(await verifyTypedData({ ...p.recoveryTypedData(bound), address: approval.signer, signature: approval.signature }));
        assert.ok(approvals.some(a => a.signer.toLowerCase() === card.toLowerCase()));
      }
    },
    async estimateGas(op) { stages.push(`estimate:${op.kind}`); return 100000n; },
    async send(op) { stages.push(`send:${op.kind}`); operations.push(op); return `0x${'ab'.repeat(32)}` as Hex; },
  };
  let serviceNow = Date.now();
  const sq = createApp({ databasePath: ':memory:', chain, allowMock: true, now: () => serviceNow });
  sq.server.listen(0, '127.0.0.1'); await once(sq.server, 'listening'); t.after(() => sq.close());
  const sqAddress = sq.server.address(); assert.ok(sqAddress && typeof sqAddress === 'object');
  const store = new MemoryPartnerStore();
  const service = createPartnerService({ store, chainId: 31337, moduleA: p.ADDRESSES.moduleA,
    chainReader: { async readRecovery(req) { return { chainId: 31337, nonce: 7n, guardians: [card, partner], threshold: 2n, recoveryHash: p.hashRecovery({ ...req, nonce: 7n }) }; } },
    crypto: { generateGuardian: () => ({ privateKey: partnerKey, address: partner }), hashRecovery: p.hashRecovery, signRecovery: p.signRecovery, encodeApproval: (approval, chainId) => p.encodeCode({ v: 1, kind: 'approval', chainId, ...approval }) },
  });
  const ps = createPartnerServer({ service }); ps.listen(0, '127.0.0.1'); await once(ps, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => ps.close(error => error ? reject(error) : resolve())));
  const partnerAddress = ps.address(); assert.ok(partnerAddress && typeof partnerAddress === 'object');
  let token = '';
  async function http(port: number, path: string, body: unknown, authenticated = true) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated && token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }
  const account = await http(sqAddress.port, '/auth/password/register', { email: 'v3-recovery@example.test', password: 'MOCK-local-test-password' });
  assert.equal(account.status, 200); token = String(account.body.token);
  assert.equal((await http(sqAddress.port, '/kyc/mock-verify', {})).status, 200);
  const enrollment = await http(sqAddress.port, '/guardian/enroll', {}); assert.equal(enrollment.status, 200);
  const sqGuardian = enrollment.body.guardian as Address;
  const setupCode = p.encodeCode({ v: 1, kind: 'setup', chainId: 31337, wallet, owner, partnerGuardian: partner, sqGuardian, saltNonce: '123' });
  const challenge = await http(sqAddress.port, '/wallets/challenge', { wallet });
  const message = String(challenge.body.message); const hash = (await import('viem')).hashMessage(message);
  const proof = { message, hash, signature: await privateKeyToAccount(ownerKey).signTypedData(p.safeMessageTypedData(wallet, hash, 31337)) };
  const registration = await http(sqAddress.port, '/wallets', { setupCode, cardGuardian: card, ownershipProof: { ...proof, nonce: challenge.body.nonce } });
  assert.equal(registration.status, 200, String(registration.body.error));
  // v3 partner gets no Swissquote identity, userRef, card words, or owner seed.
  assert.equal((await http(partnerAddress.port, '/enroll', { mockFace: 'client-demo' }, false)).status, 200);
  const wire = { ...request, nonce: '7' };
  const thief = await http(partnerAddress.port, '/recovery/approve', { ...wire, mockFace: 'thief-face' }, false);
  assert.equal(thief.status, 403); assert.equal(thief.body.signature, undefined);
  const partnerResult = await http(partnerAddress.port, '/recovery/approve', { ...wire, mockFace: 'client-demo' }, false);
  assert.equal(partnerResult.status, 200);
  const partnerApproval = await helperApproval(request, partnerResult.body as unknown as p.RecoveryApproveResponse, partner);
  const cardSigned = await p.signRecovery(cardKey, request);
  const relay = await http(sqAddress.port, '/relay/recovery', { ...wire, approvals: [cardSigned, partnerApproval] }); assert.equal(relay.status, 200);
  assert.deepEqual(stages.slice(-3), ['simulate:recovery', 'estimate:recovery', 'send:recovery']);
  const finalized = await http(sqAddress.port, '/relay/finalize', { wallet, module: request.module }); assert.equal(finalized.status, 200);
  assert.deepEqual(stages.slice(-3), ['simulate:finalize', 'estimate:finalize', 'send:finalize']);
  const sqRequest = { ...request, module: p.ADDRESSES.moduleB }; const sqWire = { ...sqRequest, nonce: '7' };
  const sqRefused = await http(sqAddress.port, '/recovery/approve', { ...sqWire, mockVideoId: true });
  assert.equal(sqRefused.status, 403); assert.equal(sqRefused.body.signature, undefined);
  assert.equal((await http(sqAddress.port, '/demo/fooled', { enabled: true })).status, 403);
  assert.equal((await http(sqAddress.port, '/auth/password/reset-request', { email: 'v3-recovery@example.test' })).status, 200);
  const mailboxResponse = await fetch(`http://127.0.0.1:${sqAddress.port}/mock/mailbox`);
  const mailbox = await mailboxResponse.json() as { messages: Array<{ resetToken?: string; token?: string }> };
  const resetToken = mailbox.messages.at(-1)?.resetToken ?? mailbox.messages.at(-1)?.token;
  assert.ok(resetToken);
  assert.equal((await http(sqAddress.port, '/auth/password/reset', { token: resetToken, password: 'MOCK-replacement-password' })).status, 200);
  serviceNow += 72 * 3600_000 + 1;
  const relogin = await http(sqAddress.port, '/auth/password/login', { email: 'v3-recovery@example.test', password: 'MOCK-replacement-password' });
  assert.equal(relogin.status, 200); token = String(relogin.body.token);
  const sqResult = await http(sqAddress.port, '/recovery/approve', { ...sqWire, mockVideoId: true }); assert.equal(sqResult.status, 200, String(sqResult.body.error));
  const sqSigned = await helperApproval(sqRequest, sqResult.body as unknown as p.RecoveryApproveResponse, sqGuardian);
  assert.equal((await http(sqAddress.port, '/relay/recovery', { ...sqWire, approvals: [await p.signRecovery(cardKey, sqRequest), sqSigned] })).status, 200);
  assert.equal(operations.filter(op => op.kind === 'recovery').length, 2);
  const protective = p.buildCancelRecoveryTx(wallet, 0n, [p.ADDRESSES.moduleA, p.ADDRESSES.moduleB]);
  const protectiveWire = { wallet, chainId: 31337, tx: p.safeTxToWire(protective), signature: await p.signSafeTx(ownerKey, wallet, protective, 31337), source: 'recovery' };
  const stopped = await http(sqAddress.port, '/relay/safe-tx', protectiveWire, false);
  assert.equal(stopped.status, 200, String(stopped.body.error));
  assert.equal(stopped.body.classification, 'Protective');
  const bad = await http(sqAddress.port, '/relay/safe-tx', { ...protectiveWire, signature: await p.signSafeTx(generatePrivateKey(), wallet, protective, 31337) }, false);
  assert.equal(bad.status, 403); assert.match(String(bad.body.error), /owner signature/);
});
