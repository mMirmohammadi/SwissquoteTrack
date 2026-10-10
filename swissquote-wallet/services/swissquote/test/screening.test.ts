import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, encodeFunctionResult, parseAbi, type Hex } from 'viem';
import { liveScreeningSources, screenAddresses } from '../src/screening.ts';
import type { Address } from '../src/types.ts';

const USDC: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const EURC: Address = '0x08210f9170f89ab7658f0b5e3ff39b0e03e477bd';
const wallet: Address = '0xa1fFBa9b87CD2253108fC67252E4fc2985088CFa';
const recipient: Address = '0x3333333333333333333333333333333333333333';
const router: Address = '0x4444444444444444444444444444444444444444';
const compound: Address = '0x5555555555555555555555555555555555555555';
const redstone: Address = '0x574Ad490fE8087B580DB227a8Ca7EfB7C19Dc8C4';
const chainalysis: Address = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';
const abi = parseAbi([
  'function isSanctioned(address) view returns (bool)',
  'function getLastUpdateBlockTimestamp() view returns (uint256)',
  'function isBlacklisted(address) view returns (bool)',
]);
const lower = (address: Address) => address.toLowerCase();
const subjects: readonly Address[] = [wallet, recipient, USDC, EURC, router, compound];
interface Call { target: string; method: string; subject?: string }
interface FixtureOptions {
  positive?: (call: Call) => boolean;
  unavailable?: readonly Address[];
  updatedAt?: number;
}

/** Stub the transport, not the adapter: inspect and answer its real eth_call payloads. */
function fixture(t: TestContext, options: FixtureOptions = {}) {
  const now = Date.now();
  const calls: Call[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.text() : undefined;
    assert.ok(body, 'adapter must send a JSON-RPC body');
    const request = JSON.parse(body) as { id: number; method: string; params: [{ to: Address; data: Hex }] };
    assert.equal(request.method, 'eth_call', 'screening must remain read-only');
    const { to, data } = request.params[0];
    const decoded = decodeFunctionData({ abi, data });
    const call: Call = { target: lower(to), method: decoded.functionName,
      ...('args' in decoded && decoded.args ? { subject: lower(decoded.args[0] as Address) } : {}) };
    calls.push(call);
    if (options.unavailable?.some(address => lower(address) === call.target)) throw new Error('Offline fixture source unavailable');
    const result = decoded.functionName === 'getLastUpdateBlockTimestamp'
      ? encodeFunctionResult({ abi, functionName: decoded.functionName, result: BigInt(Math.floor((options.updatedAt ?? now) / 1000)) })
      : encodeFunctionResult({ abi, functionName: decoded.functionName, result: options.positive?.(call) ?? false });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const sources = liveScreeningSources(['https://sanctions.invalid'], ['https://issuer.invalid'], [USDC, EURC]);
  return { now, calls, sources, screen: () => screenAddresses(subjects, sources, [], now) };
}

function checkedSubjects(calls: readonly Call[], target: Address, method: string) {
  return calls.filter(call => call.target === lower(target) && call.method === method).map(call => call.subject).sort();
}

test('explicit server-derived account subjects narrow only freeze requests, not sanctions', async t => {
  const f = fixture(t, { positive: call => call.method === 'isBlacklisted' && call.target === call.subject });
  const accounts = [wallet, recipient, router, compound];
  const result = await screenAddresses(subjects, f.sources, [], f.now, accounts);
  assert.equal(result.ok, true, 'token call-target roles are not transfer account subjects');
  assert.deepEqual(result.hits, []);
  for (const oracle of [redstone, chainalysis]) {
    assert.deepEqual(checkedSubjects(f.calls, oracle, 'isSanctioned'), subjects.map(lower).sort());
  }
  for (const issuer of [USDC, EURC]) {
    assert.deepEqual(checkedSubjects(f.calls, issuer, 'isBlacklisted'), accounts.map(lower).sort());
  }
});

test('direct adapter preserves issuer-token subjects and returns original supplied account hits', async t => {
  const f = fixture(t, { positive: call => call.method === 'isBlacklisted' && call.subject === lower(wallet) });
  const supplied: readonly Address[] = [USDC.toLowerCase() as Address, USDC, wallet, router];
  const result = await f.sources[2].check(supplied);
  assert.deepEqual(result.hits, [wallet], 'the adapter must preserve supplied account addresses');
  assert.deepEqual(checkedSubjects(f.calls, USDC, 'isBlacklisted'), supplied.map(lower).sort());
});

for (const [name, account] of [['recipient', recipient], ['wallet', wallet], ['router contract', router], ['Compound contract', compound], ['other asset contract', EURC]] as const) {
  test(`positive ${name} remains an issuer-freeze blocking hit`, async t => {
    const f = fixture(t, { positive: call => call.target === lower(USDC) && call.method === 'isBlacklisted' && call.subject === lower(account) });
    const result = await f.screen();
    assert.equal(result.ok, false);
    assert.deepEqual(result.hits, [lower(account)]);
    assert.ok(f.calls.some(call => call.target === lower(USDC) && call.subject === lower(account)));
  });
}

test('USDC address remains blocking when another issuer freezes it', async t => {
  const f = fixture(t, { positive: call => call.target === lower(EURC) && call.method === 'isBlacklisted' && call.subject === lower(USDC) });
  const result = await f.screen();
  assert.equal(result.ok, false);
  assert.deepEqual(result.hits, [lower(USDC)]);
  assert.ok(f.calls.some(call => call.target === lower(EURC) && call.subject === lower(USDC)));
});

for (const [name, oracle] of [['RedStone', redstone], ['Chainalysis', chainalysis]] as const) {
  test(`${name} positive on the issuer-token address still blocks`, async t => {
    const f = fixture(t, { positive: call => call.target === lower(oracle) && call.method === 'isSanctioned' && call.subject === lower(USDC) });
    const result = await f.screen();
    assert.equal(result.ok, false);
    assert.deepEqual(result.hits, [lower(USDC)]);
  });
}

for (const [name, unavailable] of [['RedStone', redstone], ['USDC issuer', USDC], ['EURC issuer', EURC]] as const) {
  test(`${name} outage still fails closed with no invented hits`, async t => {
    const f = fixture(t, { unavailable: [unavailable] });
    const result = await f.screen();
    assert.equal(result.ok, false);
    assert.deepEqual(result.hits, []);
    assert.ok(result.sources.some(label => label.endsWith(': unavailable')));
    assert.ok(result.warnings.some(warning => warning.endsWith(': required source unavailable.')));
  });
}

test('explicit issuer-token recipient stays frozen, and direct screening defaults to all subjects', async t => {
  const f = fixture(t, { positive: call => call.target === lower(USDC) && call.subject === lower(USDC) });
  for (const accounts of [undefined, [wallet, USDC]]) {
    const result = await screenAddresses(subjects, f.sources, [], f.now, accounts);
    assert.equal(result.ok, false); assert.deepEqual(result.hits, [lower(USDC)]);
  }
});

test('out-of-queried-subset issuer hits fail closed and MOCK positives never narrow', async t => {
  const now = Date.now();
  const result = await screenAddresses([wallet, USDC], [{ label: 'issuer', required: true, mock: true, kind: 'freeze', check: async () => ({ hits: [USDC] }) }], [], now, [wallet]);
  assert.equal(result.ok, false); assert.ok(result.sources.includes('MOCK issuer: unavailable'));
  await assert.rejects(() => screenAddresses([wallet], [], [], now, [USDC]), /Freeze subjects must belong to screened addresses/);
  const mockResult = await screenAddresses([wallet, USDC], [{ label: 'issuer', required: true, mock: true, kind: 'freeze', check: async () => ({ hits: [] }) }], [USDC], now, [wallet]);
  assert.equal(mockResult.ok, false); assert.deepEqual(mockResult.hits, [lower(USDC)]);
});

test('stale required sanctions evidence remains unavailable; positives still count', async t => {
  const now = Date.now();
  const f = fixture(t, {
    updatedAt: now - 31 * 86400_000,
    positive: call => call.target === lower(USDC) && call.method === 'isBlacklisted' && call.subject === lower(recipient),
  });
  const result = await f.screen();
  assert.equal(result.ok, false);
  assert.deepEqual(result.hits, [lower(recipient)]);
  assert.ok(result.sources.some(label => label.includes('unavailable (stale)')));
  assert.ok(result.warnings.some(warning => warning.includes('list older than 30 days')));
});
