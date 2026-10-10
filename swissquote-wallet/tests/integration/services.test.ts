import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, parseAbi, zeroAddress, type Address, type Hex } from 'viem';
import * as p from '../../packages/protocol/src/index.ts';
import { createApp } from '../../services/swissquote/src/app.ts';
import type { ChainAdapter, ChainOperation, WebAuthnAdapter } from '../../services/swissquote/src/types.ts';

// HTTP/service orchestration checks use an explicit injected chain adapter. These do
// NOT prove actual EVM execution; local-chain.test.ts owns that evidence separately.
const ownerKey = generatePrivateKey();
const owner = privateKeyToAccount(ownerKey).address;
const card = privateKeyToAccount(generatePrivateKey()).address;
const partner = privateKeyToAccount(generatePrivateKey()).address;
const wallet = '0x1111111111111111111111111111111111111111' as Address;
const outsiderWallet = '0x2222222222222222222222222222222222222222' as Address;
const A = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as Address;
const B = '0x38275826E1933303E508433dD5f289315Da2541c' as Address;
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
const erc20 = parseAbi(['function transfer(address to,uint256 amount)']);
const calls: ChainOperation[] = [];
const stages: string[] = [];
let rejectProof = false;
let nonce = 0n;
let hashDisagrees = false;
let now = 1_800_000_000_000;
const chain: ChainAdapter = {
  chainId: 31337,
  // Fixed in-memory local head; a future minimum must fail, not invent chain state.
  async registrationBlock(minimumBlockNumber) { if ((minimumBlockNumber ?? 0n) > 0n) throw new Error('Fixture registration head 0 is below requested minimum'); return 0n; },
  async computeWallet() { return wallet; },
  async verifyWallet() { return true; },
  async verifyOwnership(_wallet, message, signature) {
    if (rejectProof) return false;
    // The test driver still must submit the signature for the exact issued text.
    const proof = await p.signOwnershipProof(ownerKey, currentClientId, wallet, currentProofNonce, 31337);
    return message === proof.message && signature.toLowerCase() === proof.signature.toLowerCase();
  },
  async safeTxHash(address, tx) { return p.hashSafeTx(address, p.safeTxFromWire(tx as p.SafeTxWire), 31337); },
  async verifyOwnerSignature(address, tx, signature) { return signature === await p.signSafeTx(ownerKey, address, p.safeTxFromWire(tx as p.SafeTxWire), 31337); },
  async safeNonce() { return nonce.toString(); },
  async recoveryHash(req) { return hashDisagrees ? `0x${'ff'.repeat(32)}` as Hex : p.hashRecovery({ ...req, nonce: BigInt(req.nonce), chainId: 31337 }); },
  async isGuardian() { return true; },
  async signRecovery(req, key) {
    if (hashDisagrees) throw new Error('independent test: recovery hash mismatch');
    return (await p.signRecovery(key, { ...req, nonce: BigInt(req.nonce), chainId: 31337 })).signature;
  },
  async simulate(operation) { stages.push(`simulate:${operation.kind}`); },
  async estimateGas(operation) { stages.push(`estimate:${operation.kind}`); return 100000n; },
  async send(operation) { stages.push(`send:${operation.kind}`); calls.push(operation); if (operation.kind === 'safe-tx') nonce++; return `0x${'ab'.repeat(32)}` as Hex; },
};
let lastAuthChallenge = '';
const webauthn: WebAuthnAdapter = {
  async registrationOptions() { return { challenge: 'integration-registration-challenge' }; },
  async authenticationOptions(_credentials, challenge) { lastAuthChallenge = challenge ?? 'integration-login-challenge'; return { challenge: lastAuthChallenge }; },
  async verifyRegistration(_response, challenge) { assert.equal(challenge, 'integration-registration-challenge'); return { id: 'independent-credential', publicKey: 'MOCK_TEST_KEY', counter: 0 }; },
  async verifyAuthentication(response, challenge) {
    assert.deepEqual(response, { challenge }, 'test authenticator must receive the exact transaction-bound challenge');
    return { id: 'independent-credential', counter: 1 };
  },
};
let currentClientId = '';
let currentProofNonce = '';

test('independent Swissquote HTTP orchestration with explicit chain/WebAuthn test doubles', async t => {
  const app = createApp({ databasePath: ':memory:', chain, webauthn, now: () => now, allowMock: true, accountDailyLimit: 3, globalDailyLimit: 100, initialMockBalance: '20000000' });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const address = app.server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  async function http(path: string, body: unknown = undefined, token?: string) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }
  const ok = (result: { status: number; body: Record<string, any> }) => assert.ok(result.status >= 200 && result.status < 300, `${result.status}: ${JSON.stringify(result.body)}`);
  const refused = (result: { status: number; body: Record<string, any> }, pattern: RegExp) => {
    assert.ok(result.status >= 400 && result.status < 500, `expected policy refusal, got ${result.status}`);
    assert.match(result.body.error, pattern);
  };
  const registered = await http('/auth/password/register', { email: 'independent@example.test', password: 'Independent-test-password!' });
  ok(registered);
  let session = registered.body.token as string;
  currentClientId = registered.body.clientId as string;
  assert.ok(session && currentClientId);
  let sq: Address;
  let stepToken: string;
  const makePayment = (amount: bigint) => p.makeSafeTx({ to: USDC, nonce, data: encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [owner, amount] }) });
  async function relay(tx: p.SafeTx, token = session, extra: Record<string, unknown> = {}) {
    return http('/relay/safe-tx', { wallet, tx: p.safeTxToWire(tx), signature: await p.signSafeTx(ownerKey, wallet, tx, 31337), source: 'payment', chainId: 31337, ...extra }, token);
  }

  await t.test('KYC gates enrollment; enrollment is stable; funding requires verified ownership', async () => {
    refused(await http('/guardian/enroll', {}, session), /KYC|verif/i);
    ok(await http('/kyc/mock-verify', {}, session));
    const enrollment = await http('/guardian/enroll', {}, session); ok(enrollment); sq = enrollment.body.guardian;
    assert.match(sq, /^0x[0-9a-fA-F]{40}$/);
    assert.equal((await http('/guardian/enroll', {}, session)).body.guardian, sq);
    refused(await http('/account/withdraw', { to: wallet, amount: '1000000' }, session), /verif|own|Travel/i);
    assert.equal(calls.length, 0, 'unverified funding must never reach send');
  });

  await t.test('frozen RegisterWalletRequest accepts a valid issued ownership proof and refuses a failed proof', async () => {
    const challenge = await http('/wallets/challenge', { wallet }, session); ok(challenge); currentProofNonce = challenge.body.nonce;
    const proof = await p.signOwnershipProof(ownerKey, currentClientId, wallet, currentProofNonce, 31337);
    assert.equal(challenge.body.message, proof.message);
    const setupCode = p.encodeCode({ v: 1, kind: 'setup', chainId: 31337, wallet, owner, partnerGuardian: partner, sqGuardian: sq, saltNonce: '123' });
    const payload: p.RegisterWalletRequest = { setupCode, cardGuardian: card, ownershipProof: { ...proof, nonce: currentProofNonce } };
    rejectProof = true;
    refused(await http('/wallets', payload, session), /proof|signature|own/i);
    rejectProof = false;
    // Failed proof verification may consume its challenge. Obtain a fresh one.
    const fresh = await http('/wallets/challenge', { wallet }, session); ok(fresh); currentProofNonce = fresh.body.nonce;
    const freshProof = await p.signOwnershipProof(ownerKey, currentClientId, wallet, currentProofNonce, 31337);
    const accepted = await http('/wallets', { ...payload, ownershipProof: { ...freshProof, nonce: currentProofNonce } }, session); ok(accepted); assert.equal(accepted.body.verified, true);
    const before = calls.length;
    refused(await http('/account/withdraw', { to: outsiderWallet, amount: '1000000' }, session), /verif|own|Travel/i);
    assert.equal(calls.length, before);
    ok(await http('/account/withdraw', { to: wallet, amount: '1000000' }, session));
    assert.deepEqual(calls.at(-1), { kind: 'withdraw', to: wallet, amount: '1000000' });
    assert.deepEqual(stages.slice(-3), ['simulate:withdraw', 'estimate:withdraw', 'send:withdraw']);
  });

  await t.test('small USDC succeeds without passkey; large refuses password and unbound step-up', async () => {
    ok(await relay(makePayment(2_000_000n)));
    const before = calls.length;
    refused(await relay(makePayment(8_000_000n)), /passkey|step.up/i);
    assert.equal(calls.length, before);
    const regOptions = await http('/auth/passkey/register/options', { email: 'independent@example.test' }, session); ok(regOptions);
    ok(await http('/auth/passkey/register/verify', { email: 'independent@example.test', challengeId: regOptions.body.challengeId, response: {} }, session));
    const target = makePayment(8_000_000n);
    const hash = p.hashSafeTx(wallet, target, 31337);
    const options = await http('/auth/passkey/step-up/options', { email: 'independent@example.test', safeTxHash: hash }, session); ok(options);
    assert.equal(lastAuthChallenge, Buffer.from(hash.slice(2), 'hex').toString('base64url'), 'WebAuthn challenge is exactly SafeTx hash, not a generic login challenge');
    const verified = await http('/auth/passkey/step-up/verify', { safeTxHash: hash, challengeId: options.body.challengeId, response: { challenge: lastAuthChallenge } }, session); ok(verified);
    assert.equal(verified.body.safeTxHash, hash); stepToken = verified.body.stepUpToken;
    refused(await relay(makePayment(9_000_000n), session, { stepUpToken: stepToken }), /hash|step.up|passkey|bound/i);
    ok(await relay(target, session, { stepUpToken: stepToken }));
  });

  await t.test('protective BOTH-module cancellation bypasses exhausted account budget and password step-up', async () => {
    const tx = p.buildCancelRecoveryTx(wallet, nonce, [A, B]);
    ok(await relay(tx));
    assert.equal(calls.at(-1)?.kind, 'safe-tx');
    const before = calls.length;
    const broken = { ...tx, nonce };
    const result = await http('/relay/safe-tx', { wallet, tx: p.safeTxToWire(broken), signature: `0x${'00'.repeat(65)}` }, session);
    refused(result, /signature|owner/i);
    assert.equal(calls.length, before, 'protective exemption does not bypass owner signature');
  });

  await t.test('mailbox reset + stolen session cannot bypass recovery hold or hash check', async () => {
    ok(await http('/auth/password/reset-request', { email: 'independent@example.test' }));
    const mailbox = await http('/mock/mailbox', undefined, session); ok(mailbox);
    const reset = mailbox.body.messages.find((m: Record<string, unknown>) => m.email === 'independent@example.test');
    assert.ok(reset?.resetToken, 'frozen mailbox contract exposes resetToken only in MOCK mailbox');
    ok(await http('/auth/password/reset', { token: reset.resetToken, password: 'Stolen-email-reset-password!' }));
    const login = await http('/auth/password/login', { email: 'independent@example.test', password: 'Stolen-email-reset-password!' }); ok(login); session = login.body.token;
    const req = { wallet, module: B, newOwner: outsiderWallet, nonce: '0', chainId: 31337 };
    refused(await http('/recovery/approve', req, session), /passkey|72|hold|reset/i);
    now += 72 * 60 * 60 * 1000 + 1;
    const afterHold = await http('/auth/password/login', { email: 'independent@example.test', password: 'Stolen-email-reset-password!' }); ok(afterHold); session = afterHold.body.token;
    refused(await http('/recovery/approve', req, session), /video|identity|ID/i);
    hashDisagrees = true;
    const mismatch = await http('/recovery/approve', { ...req, mockVideoId: true }, session);
    assert.ok(mismatch.status >= 400, 'hash mismatch must not emit an approval');
    assert.equal(mismatch.body.signature, undefined);
  });
});
