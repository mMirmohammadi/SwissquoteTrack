import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAIN_ID, LOCAL_CHAIN_ID, HISTORY_RPC_URLS, PUBLIC_RPC_URLS } from '@sq/protocol';
import { makeClients, pacedFetch } from '../src/core.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function clock() {
  let time = 0;
  const sleeps: number[] = [];
  return { now: () => time, sleep: async (ms: number) => { sleeps.push(ms); time += ms; },
    advance: (ms: number) => { time += ms; }, sleeps };
}
async function drain() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

test('endpoint queue serializes fetches and enforces minimum actual start gap', async () => {
  const time = clock();
  const starts: number[] = [];
  const first = deferred<Response>();
  const fetchFn = pacedFetch(async () => {
    starts.push(time.now());
    return starts.length === 1 ? first.promise : new Response('{}');
  }, time);
  const requests = [fetchFn('https://rpc.invalid'), fetchFn('https://rpc.invalid'), fetchFn('https://rpc.invalid')];
  await drain();
  assert.deepEqual(starts, [0]); // Waiting HTTP request must not overlap the first.
  time.advance(40);
  first.resolve(new Response('{}'));
  await Promise.all(requests);
  assert.deepEqual(starts, [0, 150, 300]);
  assert.deepEqual(time.sleeps, [110, 150]);
  time.advance(500);
  await fetchFn('https://rpc.invalid');
  assert.deepEqual(starts, [0, 150, 300, 800]); // No extra delay after a long idle period.
});

test('separate endpoint queues progress independently', async () => {
  const time = clock();
  const blocked = deferred<Response>();
  const a = pacedFetch(async () => blocked.promise, time);
  const starts: number[] = [];
  const b = pacedFetch(async () => { starts.push(time.now()); return new Response('{}'); }, time);
  const pending = a('https://a.invalid');
  await b('https://b.invalid');
  await b('https://b.invalid');
  assert.deepEqual(starts, [0, 150]);
  blocked.resolve(new Response('{}'));
  await pending;
});

test('rejections propagate unchanged and do not poison queued requests', async () => {
  const time = clock();
  const failure = new Error('HTTP 429');
  const starts: number[] = [];
  const fetchFn = pacedFetch(async () => {
    starts.push(time.now());
    if (starts.length === 1) throw failure;
    return new Response('{}');
  }, time);
  const first = fetchFn('https://rpc.invalid');
  const second = fetchFn('https://rpc.invalid');
  await assert.rejects(first, error => error === failure);
  await second;
  assert.deepEqual(starts, [0, 150]);
});

test('expired queued attempts never start; later requests still proceed', async () => {
  const time = clock();
  const first = deferred<Response>();
  const starts: number[] = [];
  const fetchFn = pacedFetch(async () => {
    starts.push(time.now());
    return starts.length === 1 ? first.promise : new Response('{}');
  }, time);
  const controller = new AbortController();
  const pending = fetchFn('https://rpc.invalid');
  const expired = fetchFn('https://rpc.invalid', { signal: controller.signal });
  const continued = fetchFn('https://rpc.invalid');
  const failure = new DOMException('Timed out', 'TimeoutError');
  controller.abort(failure);
  first.resolve(new Response('{}'));
  await assert.rejects(expired, error => error === failure);
  await Promise.all([pending, continued]);
  assert.deepEqual(starts, [0, 150]);
});

test('an abort during pacing sleep prevents an actual fetch start', async () => {
  const controller = new AbortController();
  let starts = 0;
  const failure = new DOMException('Timed out', 'TimeoutError');
  const fetchFn = pacedFetch(async () => { starts++; return new Response('{}'); }, {
    now: () => 0, sleep: async () => { controller.abort(failure); },
  });
  await fetchFn('https://rpc.invalid');
  await assert.rejects(fetchFn('https://rpc.invalid', { signal: controller.signal }), error => error === failure);
  assert.equal(starts, 1);
});

test('makeClients paces actual Sepolia HTTP attempts including one retry, independently per node', async t => {
  let time = 0;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(performance, 'now', () => time);
  const starts: { url: string; at: number; method: string }[] = [];
  const firstUrl = new URL(HISTORY_RPC_URLS[0]!).href;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string };
    assert.equal(Array.isArray(body), false);
    starts.push({ url: String(input), at: time, method: body.method });
    if (String(input) === firstUrl && starts.filter(start => start.url === String(input)).length === 1) {
      return new Response('rate limited', { status: 429 });
    }
    return Response.json({ jsonrpc: '2.0', id: body.id, result: '0xaa36a7' });
  });
  const clients = makeClients({ chainId: CHAIN_ID, rpcUrls: 'https://ignored.invalid' }, HISTORY_RPC_URLS);
  assert.deepEqual(clients.map(client => client.transport.url), HISTORY_RPC_URLS);
  assert.ok(clients.every(client => client.transport.timeout === 12_000 && client.transport.retryCount === 1));
  const a = clients[0]!.getChainId();
  const b = clients[1]!.getChainId();
  await drain();
  assert.equal(starts.length, 2);
  assert.equal(await b, CHAIN_ID);
  time = 150;
  t.mock.timers.tick(150);
  await drain();
  assert.equal(await a, CHAIN_ID);
  assert.deepEqual(starts.filter(start => start.url === firstUrl).map(start => start.at), [0, 150]);
  const next = clients[0]!.getChainId();
  await drain();
  assert.equal(starts.length, 3);
  time = 300;
  t.mock.timers.tick(150);
  await drain();
  assert.equal(await next, CHAIN_ID);
  assert.deepEqual(starts.filter(start => start.url === firstUrl).map(start => start.at), [0, 150, 300]);
  assert.deepEqual(makeClients({ chainId: CHAIN_ID }).map(client => client.transport.url), PUBLIC_RPC_URLS.slice(0, 2));
});

test('persistent HTTP 429 remains a failure after exactly one retry', async t => {
  let time = 0;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(performance, 'now', () => time);
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    attempts++;
    return new Response('rate limited', { status: 429 });
  });
  const client = makeClients({ chainId: CHAIN_ID })[0]!;
  const failed = assert.rejects(client.getChainId(), /429/);
  await drain();
  assert.equal(attempts, 1);
  time = 150;
  t.mock.timers.tick(150);
  await drain();
  await failed;
  assert.equal(attempts, 2);
  time = 12_000;
  t.mock.timers.tick(12_000);
  await drain();
  assert.equal(attempts, 2);
});

test('local 8645 clients do not acquire pacing delays', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { id: number };
    requests++;
    return Response.json({ jsonrpc: '2.0', id: body.id, result: '0x7a69' });
  });
  const clients = makeClients({ chainId: LOCAL_CHAIN_ID, rpcUrls: 'http://127.0.0.1:8645,http://localhost:8645' });
  assert.equal(await clients[0]!.getChainId(), LOCAL_CHAIN_ID);
  assert.equal(await clients[0]!.getChainId(), LOCAL_CHAIN_ID);
  assert.equal(await clients[1]!.getChainId(), LOCAL_CHAIN_ID);
  assert.equal(requests, 3); // No fake clock advancement needed.
});
