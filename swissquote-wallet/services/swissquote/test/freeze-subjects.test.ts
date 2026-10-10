import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { encodeFunctionData, hashMessage, parseAbi } from 'viem';
import { DAPP_ADDRESSES as A, compoundAbi, routerAbi, dappTokenAbi } from '@sq/protocol';
import { createApp } from '../src/app.ts';
import { digest } from '../src/store.ts';
import { address, callAddresses, derivefreezeSubjects, MULTISEND, MODULES, ZERO, USDC } from '../src/policy.ts';
import { screenAddresses } from '../src/screening.ts';
import type { Address, AppOptions, ChainAdapter, SafeTx, ScreeningSource } from '../src/types.ts';

const wallet = address('0x1111111111111111111111111111111111111111');
const recipient = address('0x5555555555555555555555555555555555555555');
const token = address(USDC);
const erc20 = parseAbi(['function transfer(address to,uint256 amount)', 'function approve(address spender,uint256 amount)']);
const tx = (to: Address, data: `0x${string}` = '0x', value = '0'): SafeTx => ({ to, data, value, operation: 0, safeTxGas: '0', baseGas: '0', gasPrice: '0', gasToken: ZERO, refundReceiver: ZERO, nonce: '0' });
const accountCall = (to: Address, account: Address, method: 'transfer' | 'approve' = 'transfer', amount = 1n) => tx(to, encodeFunctionData({ abi: erc20, functionName: method, args: [account, amount] }));
const word = (value: bigint) => value.toString(16).padStart(64, '0');
function batch(calls: SafeTx[]): SafeTx {
  const packed = calls.map(c => c.operation.toString(16).padStart(2, '0') + c.to.slice(2) + word(BigInt(c.value)) + word(BigInt((c.data.length - 2) / 2)) + c.data.slice(2)).join('');
  return { ...tx(MULTISEND, ('0x8d80ff0a' + word(32n) + word(BigInt(packed.length / 2)) + packed.padEnd(Math.ceil(packed.length / 64) * 64, '0')) as `0x${string}`), operation: 1 };
}
const sorted = (values: readonly Address[]) => [...new Set(values.map(address))].sort();
function expectSubjects(transaction: SafeTx, expected: Address[], owner = wallet, options: AppOptions = {}) {
  assert.deepEqual(sorted(derivefreezeSubjects(owner, transaction, options)), sorted(expected));
}
function dappTransactions() {
  const amount = 1_000_000n;
  const approve = (input: Address, spender: Address, n: bigint) => tx(input, encodeFunctionData({ abi: dappTokenAbi, functionName: 'approve', args: [spender, n] }));
  const supply = tx(A.compound, encodeFunctionData({ abi: compoundAbi, functionName: 'supply', args: [A.usdc, amount] }));
  const withdraw = tx(A.compound, encodeFunctionData({ abi: compoundAbi, functionName: 'withdraw', args: [A.usdc, amount] }));
  const swaps = [false, true].map(reverse => {
    const input = reverse ? A.eurc : A.usdc;
    const output = reverse ? A.usdc : A.eurc;
    const action = tx(A.uniswap, encodeFunctionData({ abi: routerAbi, functionName: 'exactInputSingle', args: [{ tokenIn: input, tokenOut: output, fee: 500, recipient: wallet, amountIn: amount, amountOutMinimum: reverse ? 990_000n : 792_000n, sqrtPriceLimitX96: 0n }] }));
    return { id: 'uniswap', target: address(A.uniswap), transaction: batch([approve(input, A.uniswap, amount), action, approve(input, A.uniswap, 0n)]) };
  });
  return [{ id: 'compound', target: address(A.compound), transaction: batch([approve(A.usdc, A.compound, amount), supply, approve(A.usdc, A.compound, 0n)]) }, { id: 'compound', target: address(A.compound), transaction: withdraw }, ...swaps];
}

test('only canonical known token target roles are omitted; recipient/spender and revoke0 survive', () => {
  for (const known of [USDC, A.eurc]) expectSubjects(accountCall(known, recipient), [wallet, recipient]);
  for (const method of ['transfer', 'approve'] as const) for (const amount of [0n, 1n]) {
    expectSubjects(accountCall(USDC, USDC, method, amount), [wallet, token]);
    expectSubjects(accountCall(USDC, USDC, method, amount), [token], USDC);
  }
  const custom = address('0x6666666666666666666666666666666666666666');
  expectSubjects(accountCall(custom, recipient), [wallet, recipient], wallet, { usdc: custom });
  expectSubjects(accountCall(USDC, recipient), [wallet, recipient], wallet, { usdc: custom });
});

test('additive cross-call roles are independent of call order and retain validated wrapper', () => {
  const calls = [accountCall(USDC, recipient), accountCall(A.eurc, USDC, 'approve', 0n)];
  for (const order of [calls, [...calls].reverse()]) expectSubjects(batch(order), [wallet, MULTISEND, recipient, token]);
  assert.throws(() => derivefreezeSubjects(wallet, { ...batch(calls), to: recipient }), /Unauthorized batch/);
  assert.throws(() => derivefreezeSubjects(wallet, batch([{ ...calls[0], operation: 1 }])), /Inner delegatecall forbidden/);
});

test('native value, malformed ABI and unsupported methods fail closed on token targets', () => {
  const canonical = accountCall(USDC, recipient);
  const malformed = [canonical.data.slice(0, -2), canonical.data + '00', canonical.data.slice(0, 10) + '1' + canonical.data.slice(11), '0x12345678', '0x', canonical.data.slice(0, -1) + 'g'];
  for (const data of malformed) expectSubjects(tx(USDC, data as `0x${string}`), [wallet, token]);
  expectSubjects({ ...canonical, value: '1' }, [wallet, token]);
  expectSubjects(tx(recipient, '0x', '1'), [wallet, recipient]);
  for (const method of ['transfer', 'approve'] as const) expectSubjects(accountCall(recipient, USDC, method), [wallet, recipient, token]);
});

test('Compound supply/withdraw and both router directions retain action targets, spenders and wrapper', () => {
  for (const { transaction, target } of dappTransactions()) expectSubjects(transaction, [wallet, target, ...(transaction.operation === 1 ? [MULTISEND] : [])]);
});

function spies(frozen: readonly Address[] = [USDC, A.eurc], sanctioned: readonly Address[] = []) {
  const freeze: Address[][] = [], sanctions: Address[][] = [], unclassified: Address[][] = [];
  const source = (label: string, kind: ScreeningSource['kind'], capture: Address[][], listed: readonly Address[]): ScreeningSource => ({ label, kind, required: true, mock: true, check: async values => { capture.push([...values]); return { hits: values.filter(v => sorted(listed).includes(address(v))) }; } });
  return { freeze, sanctions, unclassified, sources: [source('issuer fixture', 'freeze', freeze, frozen), source('sanctions fixture', 'sanctions', sanctions, sanctioned), source('unclassified fixture', undefined, unclassified, [])] };
}

test('freeze-only routing leaves sanctions/mock/unclassified broad and preserves explicit token accounts', async () => {
  const s = spies();
  const ordinary = accountCall(USDC, recipient);
  const broad = callAddresses(wallet, ordinary);
  assert.equal((await screenAddresses(broad, s.sources, [], 0, derivefreezeSubjects(wallet, ordinary))).ok, true);
  assert.deepEqual(sorted(s.freeze[0]), sorted([wallet, recipient]));
  assert.deepEqual(sorted(s.sanctions[0]), sorted(broad));
  assert.deepEqual(sorted(s.unclassified[0]), sorted(broad));
  assert.equal((await screenAddresses(broad, s.sources, [USDC], 0, derivefreezeSubjects(wallet, ordinary))).ok, false);
  assert.equal((await screenAddresses(broad, spies([], [USDC]).sources, [], 0, derivefreezeSubjects(wallet, ordinary))).ok, false);
  for (const method of ['transfer', 'approve'] as const) for (const amount of [0n, 1n]) {
    const explicit = accountCall(USDC, USDC, method, amount);
    assert.deepEqual((await screenAddresses(callAddresses(wallet, explicit), s.sources, [], 0, derivefreezeSubjects(wallet, explicit))).hits, [token]);
  }
  assert.deepEqual((await screenAddresses([USDC], s.sources, [], 0)).hits, [token]);
  await assert.rejects(screenAddresses([wallet], s.sources, [], 0, [recipient]), /Freeze subjects must belong/);
  assert.equal((await screenAddresses(broad, [{ label: 'invalid hit', required: true, mock: true, kind: 'freeze', check: async () => ({ hits: [token] }) }], [], 0, [wallet, recipient])).ok, false);
  assert.equal((await screenAddresses(broad, [{ label: 'offline', required: true, mock: true, kind: 'freeze', check: async () => { throw new Error('offline fixture'); } }], [], 0, [wallet, recipient])).ok, false);
  assert.equal((await screenAddresses(broad, [{ label: 'stale', required: true, mock: true, kind: 'freeze', check: async () => ({ hits: [], updatedAt: 0 }) }], [], 31 * 86400_000, [wallet, recipient])).ok, false);
});

// Invoke the real handler in memory: no listener, API request, RPC, provider or private key.
function fixture(s: ReturnType<typeof spies>, options: AppOptions = {}) {
  const events: string[] = [];
  const chain: ChainAdapter = { chainId: 31337, computeWallet: async () => wallet, verifyWallet: async () => true, verifyOwnership: async () => true, safeTxHash: async () => hashMessage('fixture transaction'), verifyOwnerSignature: async () => { events.push('owner'); return true; }, safeNonce: async () => '0', recoveryHash: async () => hashMessage('fixture recovery'), isGuardian: async () => true, signRecovery: async () => '0x11', simulate: async () => { events.push('simulate'); }, estimateGas: async () => 100n, send: async () => { events.push('send'); return hashMessage('fixture sent'); } };
  const app = createApp({ databasePath: ':memory:', chain, allowMock: true, features: ['strictSponsorship'], screeningSources: s.sources, ...options });
  app.store.put('user', 'fixture-user', { id: 'fixture-user', email: 'fixture@example.com', password: 'unused', kyc: true, resetAt: null, balance: '1000000', guardian: recipient });
  app.store.put('session', digest('fixture-session'), { userId: 'fixture-user', method: 'password', expires: Number.MAX_SAFE_INTEGER });
  app.store.put('wallet', wallet, { clientId: 'fixture-user', verified: true, setup: { wallet, owner: recipient, cardGuardian: recipient, partnerGuardian: recipient, sqGuardian: recipient, saltNonce: '1' } });
  async function post(path: string, body: unknown) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]) as IncomingMessage;
    Object.assign(req, { method: 'POST', url: path, headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-session' }, socket: { remoteAddress: 'fixture' } });
    let output = '';
    const res = { statusCode: 0, setHeader: () => {}, end: (data: string) => { output = data; } } as unknown as ServerResponse;
    await app.handler(req, res);
    return { status: res.statusCode, body: JSON.parse(output) as { code?: string; error?: string; ok?: boolean; hits?: Address[] } };
  }
  return { app, post, events };
}

test('real strict App payment relay excludes token identity but blocks token recipient, sanctions/mock and outage', async () => {
  for (const scenario of ['ordinary', 'recipient-token', 'sanctions', 'mock', 'offline'] as const) {
    const s = spies([USDC], scenario === 'sanctions' ? [USDC] : []);
    if (scenario === 'offline') s.sources[0].check = async () => { throw new Error('offline fixture'); };
    const f = fixture(s, scenario === 'mock' ? { sanctions: [USDC] } : {});
    try {
      const result = await f.post('/relay/safe-tx', { wallet, tx: accountCall(USDC, scenario === 'recipient-token' ? USDC : recipient), signature: '0x11' });
      assert.equal(result.status, scenario === 'ordinary' ? 200 : 403);
      if (scenario !== 'ordinary') assert.equal(result.body.code, scenario === 'offline' ? 'SCREENING_UNAVAILABLE' : 'SANCTIONS_BLOCK');
      assert.deepEqual(sorted(s.freeze[0] ?? []), scenario === 'offline' ? [] : sorted([wallet, scenario === 'recipient-token' ? token : recipient]));
      assert.ok(s.sanctions[0].includes(token));
      assert.equal(f.events.includes('send'), scenario === 'ordinary');
      assert.equal(f.events[0], 'owner');
    } finally { await f.app.close(); }
  }
});

test('real App dApp preview/relay exercise routing for supply, withdrawal and both swaps before fail-closed simulation', async () => {
  for (const { id, target, transaction } of dappTransactions()) for (const route of ['/dapps/preview', '/relay/safe-tx']) for (const listed of ['token-only', 'target', 'wallet', 'sanctions', 'mock'] as const) {
    const s = spies(listed === 'target' ? [target] : listed === 'wallet' ? [wallet] : [USDC, A.eurc], listed === 'sanctions' ? [USDC] : []);
    const f = fixture(s, listed === 'mock' ? { sanctions: [USDC] } : {});
    try {
      const result = await f.post(route, { wallet, tx: transaction, dappId: id, source: 'dapp', signature: '0x11', effectsHash: hashMessage('fixture effects') });
      assert.equal(result.status, 403);
      // With token-only issuer positives, routing clears and real simulation then
      // refuses absent providers. This does not claim a successful dApp broadcast.
      assert.equal(result.body.code, listed === 'token-only' ? 'NOT_SPONSORED' : 'SANCTIONS_BLOCK');
      if (listed === 'token-only') assert.match(result.body.error ?? '', /Simulation unavailable/);
      assert.deepEqual(sorted(s.freeze[0]), sorted([wallet, target, ...(transaction.operation === 1 ? [MULTISEND] : [])]));
      for (const registered of Object.values(A)) assert.ok(s.sanctions[0].includes(address(registered)));
      assert.ok(!f.events.includes('send'));
    } finally { await f.app.close(); }
  }
});

test('App deployment screens every supplied guardian by default', async () => {
  const blockedGuardian = address('0x3333333333333333333333333333333333333333');
  const partner = address('0x4444444444444444444444444444444444444444');
  const s = spies([blockedGuardian]);
  const f = fixture(s);
  try {
    const result = await f.post('/relay/deploy', { owner: wallet, cardGuardian: blockedGuardian, partnerGuardian: partner, sqGuardian: recipient, saltNonce: '1' });
    assert.equal(result.body.code, 'SANCTIONS_BLOCK');
    assert.deepEqual(sorted(s.freeze[0]), sorted([wallet, blockedGuardian, partner, recipient]));
    assert.deepEqual(sorted(s.sanctions[0]), sorted(s.freeze[0]));
    assert.ok(!f.events.includes('send'));
  } finally { await f.app.close(); }
});

test('App direct screen ignores request subset; funding defaults to all; exact protective cancel unchanged', async () => {
  const s = spies([USDC, wallet]);
  const f = fixture(s);
  try {
    const direct = await f.post('/screen', { addresses: [USDC], freezeSubjects: [] });
    assert.deepEqual(direct.body.hits, [token]);
    assert.equal((await f.post('/account/withdraw', { to: wallet, amount: '1' })).body.code, 'SANCTIONS_BLOCK');
    assert.deepEqual(s.freeze[1], [wallet]);
    const cancel = tx(MODULES[0], encodeFunctionData({ abi: parseAbi(['function cancelRecovery()']), functionName: 'cancelRecovery' }));
    const before = s.freeze.length;
    assert.equal((await f.post('/relay/safe-tx', { wallet, tx: cancel, signature: '0x11' })).status, 200);
    assert.equal(s.freeze.length, before);
    assert.deepEqual(s.sanctions.at(-1), [wallet]);
  } finally { await f.app.close(); }
});
