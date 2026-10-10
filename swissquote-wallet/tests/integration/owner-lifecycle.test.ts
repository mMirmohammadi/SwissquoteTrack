import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { type TestContext } from 'node:test';
import { hashMessage, recoverTypedDataAddress, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeCode, safeMessageTypedData, signOwnershipProof, verifyOwnershipProof, type RegisterWalletRequest } from '../../packages/protocol/src/index.ts';
import { createApp } from '../../services/swissquote/src/app.ts';
import type { ChainAdapter, ChainOperation, Setup } from '../../services/swissquote/src/types.ts';

// ACTUAL createApp HTTP + in-memory SQLite; LABELLED CHAIN/RPC TEST DOUBLES.
// No chain transactions, shared node reset, live RPC, or browser storage claims.
// The EIP-1271 double runs the actual protocol verifyOwnershipProof helper and
// recovers a real SafeMessage typed-data signature before returning its magic value.
const O_KEY = `0x${'11'.repeat(32)}` as Hex;
const N_KEY = `0x${'22'.repeat(32)}` as Hex;
const O = privateKeyToAccount(O_KEY).address.toLowerCase() as Address;
const N = privateKeyToAccount(N_KEY).address.toLowerCase() as Address;
const CARD = '0x3333333333333333333333333333333333333333' as Address;
const PARTNER = '0x4444444444444444444444444444444444444444' as Address;
const WALLET = '0x5555555555555555555555555555555555555555' as Address;
const OTHER = '0x6666666666666666666666666666666666666666' as Address;
const CHAIN_ID = 31337;
type VerificationExpectation = { expectedCurrentOwner?: Address; expectedWallet?: Address };
type LinkedRecord = { clientId: string; setup: Setup & { wallet: Address }; verified: boolean; currentOwner?: Address };
type Result = { status: number; body: Record<string, unknown> };
const ok = (r: Result, why = 'request must succeed') => assert.equal(r.status, 200, `${why}: ${r.status} ${JSON.stringify(r.body)}`);
const refused = (r: Result) => assert.ok(r.status >= 400 && r.status < 500, `must fail closed with 4xx: ${r.status} ${JSON.stringify(r.body)}`);

async function fixture(t: TestContext) {
  let clock = 1_800_000_000_000;
  let onChainOwner: Address = O;
  const verifications: Array<{ setup: Setup; options?: VerificationExpectation }> = [];
  const proofs: Array<{ wallet: Address; hash: Hex; signature: Hex }> = [];
  const broadcasts: ChainOperation[] = [];
  // This is a test Safe/EIP-1271 endpoint, NOT a deployed contract. Invalid owner,
  // wrong EIP-712 chain/wallet/message, and malformed signatures return non-magic.
  const proofRpc = {
    async readContract(input: { address: Address; functionName: string; args: readonly [Hex, Hex] }) {
      assert.equal(input.address.toLowerCase(), WALLET);
      assert.equal(input.functionName, 'isValidSignature');
      const [hash, signature] = input.args;
      proofs.push({ wallet: input.address, hash, signature });
      try {
        const signer = await recoverTypedDataAddress({ ...safeMessageTypedData(WALLET, hash, CHAIN_ID), signature });
        return signer.toLowerCase() === onChainOwner ? '0x1626ba7e' : '0xffffffff';
      } catch { return '0xffffffff'; }
    },
  } as unknown as PublicClient;
  const chain: ChainAdapter = {
    chainId: CHAIN_ID,
    // LABELLED deterministic-address stand-in: rewriting original setup owner
    // changes its predicted address. No assertion of real CREATE2 execution here.
    async computeWallet(setup) { return setup.owner.toLowerCase() === O ? WALLET : OTHER; },
    async verifyWallet(setup, options?: VerificationExpectation) {
      verifications.push({ setup: structuredClone(setup), options: options && structuredClone(options) });
      return setup.owner.toLowerCase() === O && setup.wallet?.toLowerCase() === WALLET
        && (options?.expectedCurrentOwner ?? setup.owner).toLowerCase() === onChainOwner;
    },
    async verifyOwnership(wallet, message, signature) { return verifyOwnershipProof(proofRpc, wallet, hashMessage(message), signature); },
    async safeTxHash() { throw new Error('Lifecycle test does not relay Safe transactions'); },
    async verifyOwnerSignature() { throw new Error('Lifecycle test does not relay Safe transactions'); },
    async safeNonce() { return '0'; },
    async recoveryHash() { throw new Error('Recovery execution is owned by chain tests'); },
    async isGuardian() { return true; },
    async signRecovery() { throw new Error('Recovery execution is owned by chain tests'); },
    async simulate() {},
    async estimateGas() { return 100_000n; },
    async send(operation) { broadcasts.push(operation); return `0x${'ab'.repeat(32)}` as Hex; },
  };
  const app = createApp({ databasePath: ':memory:', chain, allowMock: true, now: () => clock });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const bound = app.server.address();
  assert.ok(bound && typeof bound === 'object');
  const base = `http://127.0.0.1:${bound.port}`;
  async function http(path: string, body: unknown = undefined, token?: string): Promise<Result> {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }
  const registration = await http('/auth/password/register', { email: 'lifecycle@example.test', password: 'Lifecycle-test-password!' });
  ok(registration);
  const token = registration.body.token as string;
  const clientId = registration.body.clientId as string;
  ok(await http('/kyc/mock-verify', {}, token));
  const enrollment = await http('/guardian/enroll', {}, token); ok(enrollment);
  const sqGuardian = enrollment.body.guardian as Address;
  const setup: Setup & { wallet: Address } = { wallet: WALLET, owner: O, cardGuardian: CARD, partnerGuardian: PARTNER, sqGuardian, saltNonce: '123' };
  const setupCode = encodeCode({ v: 1, kind: 'setup', chainId: CHAIN_ID, wallet: WALLET, owner: O, partnerGuardian: PARTNER, sqGuardian, saltNonce: '123' });
  async function payload(key = O_KEY, challengeWallet: Address = WALLET): Promise<RegisterWalletRequest> {
    const challenge = await http('/wallets/challenge', { wallet: challengeWallet }, token); ok(challenge);
    const nonce = challenge.body.nonce as string;
    const proof = await signOwnershipProof(key, clientId, challengeWallet, nonce, CHAIN_ID);
    assert.equal(challenge.body.message, proof.message);
    return { setupCode, cardGuardian: CARD, ownershipProof: { ...proof, nonce } };
  }
  const initial = await payload(); ok(await http('/wallets', initial, token), 'existing first-setup schema stays compatible');
  const record = () => app.store.get<LinkedRecord>('wallet', WALLET)!;
  return {
    app, http, token, clientId, setup, setupCode, payload, record, verifications, proofs, broadcasts, initial,
    replaceOnChain: () => { onChainOwner = N; },
    expireChallenge: () => { clock += 300_001; },
    proofRpc,
  };
}

// Optional extension is deliberately local until the service/protocol API builder
// publishes it. The existing RegisterWalletRequest remains a valid first setup.
function replacement(payload: RegisterWalletRequest) { return { ...payload, expectedCurrentOwner: N }; }

test('LIFE-01 actual service: existing first-setup schema verifies and withdraws', async t => {
  const f = await fixture(t);
  assert.equal(f.record().setup.owner, O);
  assert.equal(f.proofs.length, 1, 'first setup must call actual EIP-1271 helper');
  ok(await f.http('/account/withdraw', { to: WALLET, amount: '1000000' }, f.token));
  assert.equal(f.broadcasts.length, 1);
});

test('LIFE-02 labelled EIP-1271 RPC control: current N proof succeeds; old O and wrong chain fail', async t => {
  const f = await fixture(t); f.replaceOnChain();
  const fresh = await f.payload(N_KEY);
  assert.equal(await verifyOwnershipProof(f.proofRpc, WALLET, fresh.ownershipProof.hash, fresh.ownershipProof.signature), true);
  const old = await signOwnershipProof(O_KEY, f.clientId, WALLET, fresh.ownershipProof.nonce, CHAIN_ID);
  assert.equal(await verifyOwnershipProof(f.proofRpc, WALLET, old.hash, old.signature), false);
  const wrongChain = await signOwnershipProof(N_KEY, f.clientId, WALLET, fresh.ownershipProof.nonce, 11155111);
  assert.equal(await verifyOwnershipProof(f.proofRpc, WALLET, wrongChain.hash, wrongChain.signature), false);
});

for (const transition of ['completed guardian recovery', 'completed owner-authorized rotation']) {
  test(`LIFE-03 actual service + labelled ${transition}: original setup plus fresh N proof re-registers`, async t => {
    const f = await fixture(t); f.replaceOnChain();
    const result = await f.http('/wallets', replacement(await f.payload(N_KEY)), f.token);
    const supplied = f.verifications.at(-1)!;
    assert.equal(supplied.setup.owner, O, 'original CREATE2 owner must never be replaced with N');
    assert.equal(supplied.options?.expectedCurrentOwner?.toLowerCase(), N, `service must explicitly forward authenticated N; default O is wrong after replacement (HTTP ${result.status}: ${JSON.stringify(result.body)})`);
    ok(result, 'legitimate replacement must re-register');
    assert.equal(f.proofs.length, 2, 'N must prove ownership through the EIP-1271 helper');
    assert.deepEqual(f.record().setup, f.setup, 'all original setup fields remain immutable');
    const metadata = await f.http(`/wallets/${WALLET}`, undefined, f.token); ok(metadata);
    assert.equal(metadata.body.setupCode, f.setupCode, 'fresh device receives immutable original setup code, not replacement owner setup');
    assert.equal(metadata.body.cardGuardian, CARD, 'fresh device receives public card address only');
    assert.equal(metadata.body.owner, N, 'public response distinguishes proven current owner from creation owner');
    const unauthorized = await f.http(`/wallets/${WALLET}`); refused(unauthorized);
    assert.equal(f.record().currentOwner?.toLowerCase(), N, 'persist currentOwner separately from immutable setup');
    ok(await f.http('/account/withdraw', { to: WALLET, amount: '1000000' }, f.token));
    assert.equal(f.verifications.at(-1)?.options?.expectedCurrentOwner?.toLowerCase(), N);
  });
}

test('LIFE-04 actual withdrawal: persisted authenticated N is supplied independently of setup O', async t => {
  const f = await fixture(t); f.replaceOnChain();
  // LABELLED persistence fixture isolates withdrawal from the registration bug.
  // This does NOT claim the actual registration path has authenticated/stored N.
  f.app.store.put('wallet', WALLET, { ...f.record(), currentOwner: N });
  const result = await f.http('/account/withdraw', { to: WALLET, amount: '1000000' }, f.token);
  assert.equal(f.verifications.at(-1)?.setup.owner, O);
  assert.equal(f.verifications.at(-1)?.options?.expectedCurrentOwner?.toLowerCase(), N, 'withdrawal must recheck stored N, never default old O');
  ok(result);
  assert.equal(f.broadcasts.length, 1);
});

for (const attack of ['missing proof', 'fabricated nonce', 'replayed proof', 'expired challenge', 'wrong wallet challenge', 'forged signature', 'wrong message hash']) {
  test(`LIFE-05 actual service refuses replacement with ${attack}; login never authenticates newOwner`, async t => {
    const f = await fixture(t); f.replaceOnChain();
    const before = structuredClone(f.record());
    const login = await f.http('/auth/password/login', { email: 'lifecycle@example.test', password: 'Lifecycle-test-password!' }); ok(login);
    let request: Record<string, unknown> = replacement(await f.payload(N_KEY));
    if (attack === 'missing proof') delete request.ownershipProof;
    if (attack === 'fabricated nonce') request.ownershipProof = { ...(request.ownershipProof as object), nonce: 'attacker-nonce' };
    if (attack === 'replayed proof') request = replacement(f.initial);
    if (attack === 'expired challenge') f.expireChallenge();
    if (attack === 'wrong wallet challenge') request = replacement(await f.payload(N_KEY, OTHER));
    if (attack === 'forged signature') request.ownershipProof = { ...(request.ownershipProof as object), signature: `0x${'00'.repeat(65)}` };
    if (attack === 'wrong message hash') request.ownershipProof = { ...(request.ownershipProof as object), hash: `0x${'00'.repeat(32)}` };
    refused(await f.http('/wallets', request, login.body.token as string));
    assert.deepEqual(f.record(), before, 'refusal must not mutate linked wallet or promote N');
    refused(await f.http('/account/withdraw', { to: WALLET, amount: '1000000' }, login.body.token as string));
    assert.equal(f.broadcasts.length, 0, 'login and failed replacement must not enable withdrawal');
  });
}

test('LIFE-06 actual service refuses N expectation authorized only by still-current O proof', async t => {
  const f = await fixture(t);
  const before = structuredClone(f.record());
  // O still controls the chain: its genuine proof cannot bless arbitrary N.
  refused(await f.http('/wallets', replacement(await f.payload(O_KEY)), f.token));
  assert.deepEqual(f.record(), before);
});

test('LIFE-07 actual service refuses old O proof after on-chain N replacement', async t => {
  const f = await fixture(t); f.replaceOnChain();
  const before = structuredClone(f.record());
  refused(await f.http('/wallets', replacement(await f.payload(O_KEY)), f.token));
  assert.deepEqual(f.record(), before);
});

test('LIFE-08 actual service refuses rewriting the original setup owner to N', async t => {
  const f = await fixture(t); f.replaceOnChain();
  const before = structuredClone(f.record());
  const rewritten = encodeCode({ v: 1, kind: 'setup', chainId: CHAIN_ID, wallet: WALLET, owner: N, partnerGuardian: PARTNER, sqGuardian: f.setup.sqGuardian, saltNonce: '123' });
  const request = replacement(await f.payload(N_KEY));
  refused(await f.http('/wallets', { ...request, setupCode: rewritten }, f.token));
  assert.deepEqual(f.record(), before);
});
