import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionResult, hashMessage, HttpRequestError, type Address, type Hex, type PublicClient } from 'viem';
import { HISTORY_RPC_URLS, fallbackHandlerAbi, safeAbi, verifyOwnershipProof } from '@sq/protocol';
import { createViemChain } from '../src/chain.ts';
import { classifiedRegistrationRead, registrationClient, registrationContext, withRegistrationReads } from '../src/registration-reads.ts';

// Same owned synthetic key fixture as registration-transports.test.ts; never broadcast.
const key = `0x${'01'.repeat(32)}` as Hex;
const wallet = '0x1111111111111111111111111111111111111111' as Address;
const blockHash = hashMessage('block');
function clock() {
  let time = 0;
  return { now: () => time, sleep: async (ms: number) => { time += ms; } };
}
function result(method: string): unknown {
  switch (method) {
    case 'eth_chainId': return '0xaa36a7';
    case 'eth_blockNumber': return '0x64';
    case 'eth_getBlockByNumber': return { hash: blockHash, number: '0x64', transactions: [], timestamp: '0x1', gasLimit: '0x1', gasUsed: '0x0', difficulty: '0x0', totalDifficulty: '0x0', size: '0x0', baseFeePerGas: '0x0' };
    case 'eth_call': return encodeFunctionResult({ abi: safeAbi, functionName: 'nonce', result: 7n });
    default: throw new Error(`Unexpected RPC method: ${method}`);
  }
}
function response(id: unknown, value: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: value }), { headers: { 'content-type': 'application/json' } });
}

test('real adapter safeNonce reads bypass registration pacing and its completed abort scope', async t => {
  const c = clock();
  const starts: { url: string; at: number; method: string; signal: AbortSignal | null | undefined }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(init!.body as string);
    const url = input instanceof Request ? input.url : String(input);
    assert.ok(HISTORY_RPC_URLS.some(endpoint => new URL(endpoint).href === new URL(url).href));
    init?.signal?.throwIfAborted();
    starts.push({ url: new URL(url).href, at: c.now(), method: request.method, signal: init?.signal });
    if (request.method === 'eth_call') {
      assert.equal(request.params[0].to.toLowerCase(), wallet.toLowerCase());
      assert.equal(request.params[0].data, '0xaffed0e0'); // nonce()
    }
    return response(request.id, result(request.method));
  });
  const adapter = createViemChain({ chainId: 11155111, rpcUrls: HISTORY_RPC_URLS, relayerPrivateKey: key, registrationClock: c });
  assert.equal(await adapter.registrationBlock(), 100n);
  assert.equal(registrationContext(), undefined);
  const registration = starts.slice();
  assert.deepEqual(registration.map(x => x.method), ['eth_chainId', 'eth_chainId', 'eth_blockNumber', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByNumber']);
  assert.deepEqual(registration.map(x => x.at), [0, 150, 300, 450, 600, 750]);
  assert.ok(registration.every(x => x.url === new URL(HISTORY_RPC_URLS[0]).href));
  assert.ok(registration.every(x => x.signal?.aborted), 'completed registration closes all its request signals');
  const before = c.now();
  assert.deepEqual(await Promise.all([adapter.safeNonce(wallet), adapter.safeNonce(wallet)]), ['7', '7']);
  const outside = starts.slice(registration.length);
  assert.deepEqual(outside.map(x => x.method), ['eth_chainId', 'eth_call', 'eth_call']); // viem deduplicates concurrent chain-ID reads.
  assert.ok(outside.every(x => x.at === before), 'outside requests start without registration spacing');
  assert.ok(outside.every(x => x.url === new URL(HISTORY_RPC_URLS[0]).href), 'source selection is unchanged');
  assert.ok(outside.every(x => !registration.some(r => r.signal === x.signal)), 'outside requests do not reuse registration abort signals');
  assert.equal(c.now(), before, 'outside reads never advance the registration clock');
  assert.deepEqual(starts.slice(0, registration.length), registration, 'outside reads do not change registration counts or order');
});

test('recovered real HTTP 429 keeps registration proof true; only terminal action failure is observed', async t => {
  const c = clock();
  const methods: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(init!.body as string);
    const url = input instanceof Request ? input.url : String(input);
    assert.equal(new URL(url).href, new URL(HISTORY_RPC_URLS[0]).href);
    init?.signal?.throwIfAborted();
    methods.push(request.method);
    if (methods.length === 1) return new Response('rate limited', { status: 429 });
    if (request.method === 'eth_call') {
      assert.equal(request.params[0].to.toLowerCase(), wallet.toLowerCase());
      return response(request.id, encodeFunctionResult({ abi: fallbackHandlerAbi, functionName: 'isValidSignature', result: '0x1626ba7e' }));
    }
    assert.equal(request.method, 'eth_chainId');
    return response(request.id, result(request.method));
  });
  const adapter = createViemChain({ chainId: 11155111, rpcUrls: HISTORY_RPC_URLS, relayerPrivateKey: key, registrationClock: c });
  await withRegistrationReads(async () => {
    assert.equal(await classifiedRegistrationRead(() => adapter.verifyOwnership(wallet, 'owned test proof', '0x11', { blockNumber: 100n })), true);
    assert.deepEqual(methods, ['eth_chainId', 'eth_chainId', 'eth_call']);
    assert.equal(registrationContext()?.transportFailure, false, 'a recovered transport attempt is not a terminal action failure');
  }, c);

  let fail = true;
  const observed = registrationClient({ readContract: async () => {
    if (fail) throw new HttpRequestError({ url: HISTORY_RPC_URLS[0], cause: new Error('synthetic terminal failure') });
    return '0x1626ba7e';
  } } as unknown as PublicClient);
  await withRegistrationReads(async () => {
    await assert.rejects(classifiedRegistrationRead(() => verifyOwnershipProof(observed, wallet, '0x11', '0x11')), (error: unknown) => {
      return error instanceof Error && 'registrationCode' in error && error.registrationCode === 'registration_rpc_unavailable';
    });
    assert.equal(registrationContext()?.transportFailure, true);
    fail = false;
    assert.equal(await classifiedRegistrationRead(() => verifyOwnershipProof(observed, wallet, '0x11', '0x11')), true);
    assert.equal(registrationContext()?.transportFailure, false, 'the next classified action clears the previous terminal failure');
    fail = true;
    await assert.rejects(classifiedRegistrationRead(() => verifyOwnershipProof(observed, wallet, '0x11', '0x11')));
    assert.equal(registrationContext()?.transportFailure, true, 'leave a failed scope to test isolation of its failure state');
  }, c);
  fail = false;
  await withRegistrationReads(async () => {
    assert.equal(registrationContext()?.transportFailure, false, 'a new registration scope cannot inherit a prior terminal failure');
    assert.equal(await classifiedRegistrationRead(() => verifyOwnershipProof(observed, wallet, '0x11', '0x11')), true);
  }, c);
  assert.equal(registrationContext(), undefined);
});
