import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashMessage } from 'viem';
import { DAPP_ADDRESSES } from '@sq/protocol';
import { createApp } from '../src/app.ts';
import { configureScreening } from '../src/local-screening.ts';
import { MOCK_LISTED, screenAddresses } from '../src/screening.ts';
import type { Address, AppOptions, ChainAdapter } from '../src/types.ts';

const wallet: Address = '0x1111111111111111111111111111111111111111';
const settings = {
  chainId: 31337, allowMock: true,
  mainnetUrls: ['https://mainnet.invalid'], simulationUrls: ['https://sepolia.invalid'],
  tokens: [DAPP_ADDRESSES.usdc, DAPP_ADDRESSES.eurc],
};

test('local MOCK adapters are required, labelled, and screen without any network', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in local screening'); });
  const config = configureScreening(settings);
  assert.match(config.screeningMode, /MOCK.*not live compliance/);
  assert.deepEqual(config.simulationClients, []);
  assert.equal(config.screeningSources?.length, 3);
  assert.ok(config.screeningSources?.every(source => source.required && source.mock));
  assert.deepEqual(config.screeningSources?.map(source => source.kind), ['sanctions', 'freeze', 'freeze']);
  const clear = await screenAddresses([wallet], config.screeningSources!, [], Date.now());
  assert.equal(clear.ok, true);
  assert.equal(clear.mock, true);
  assert.ok(clear.sources.every(label => label.startsWith('MOCK ')));
  assert.ok(clear.warnings.every(warning => warning.includes('no live sanctions or issuer-freeze coverage')));
  assert.ok(clear.warnings.length > 0);
  const listed = await screenAddresses([MOCK_LISTED, wallet], config.screeningSources!, [wallet], Date.now());
  assert.equal(listed.ok, false);
  assert.deepEqual(new Set(listed.hits), new Set([MOCK_LISTED, wallet]));
});

test('local MOCK-disabled configuration stays unavailable without public RPC fallback', async () => {
  const config = configureScreening({ ...settings, allowMock: false });
  assert.deepEqual(config.screeningSources, []);
  assert.deepEqual(config.simulationClients, []);
  assert.match(config.screeningMode, /unavailable/);
  assert.equal((await screenAddresses([wallet], config.screeningSources!, [], Date.now())).ok, false);
});

test('Sepolia keeps live sanctions/freeze sources and simulation endpoints even with MOCK enabled', () => {
  for (const allowMock of [false, true]) {
    const config = configureScreening({ ...settings, chainId: 11155111, allowMock });
    assert.match(config.screeningMode, /^live /);
    assert.equal(config.screeningSources?.length, 4);
    assert.ok(config.screeningSources?.every(source => !source.mock));
    assert.deepEqual(config.screeningSources?.map(source => source.required), [true, false, true, true]);
    assert.deepEqual(config.screeningSources?.map(source => source.kind), ['sanctions', 'sanctions', 'freeze', 'freeze']);
    assert.equal(config.simulationClients?.length, 1);
    assert.equal(config.simulationClients?.[0].transport.url, settings.simulationUrls[0]);
  }
});

async function fixture(options: AppOptions = {}, linkedWallet = wallet) {
  const events: string[] = [];
  const chain: ChainAdapter = {
    chainId: 31337, registrationBlock: async () => 1n, computeWallet: async () => linkedWallet, verifyWallet: async () => true,
    verifyOwnership: async () => true, safeTxHash: async () => hashMessage('tx'),
    verifyOwnerSignature: async () => true, safeNonce: async () => '0',
    recoveryHash: async () => hashMessage('recovery'), isGuardian: async () => true,
    signRecovery: async () => '0x11', simulate: async () => { events.push('simulate'); },
    estimateGas: async () => 100n, send: async () => { events.push('send'); return hashMessage('sent'); },
  };
  const { screeningMode: _, ...screening } = configureScreening(settings);
  const app = createApp({ databasePath: ':memory:', chain, allowMock: true, features: ['strictSponsorship'], ...screening, ...options });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  async function post(path: string, body: unknown, token?: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const registered = await post('/auth/password/register', { email: 'local-screening@example.com', password: 'correct-horse-123' });
  const token = registered.body.token as string;
  await post('/kyc/mock-verify', {}, token);
  app.store.put('wallet', linkedWallet, {
    clientId: registered.body.clientId, verified: true,
    setup: { wallet: linkedWallet, owner: wallet, cardGuardian: wallet, partnerGuardian: wallet, sqGuardian: wallet, saltNonce: '1' },
  });
  return { app, events, withdraw: () => post('/account/withdraw', { to: linkedWallet, amount: '1' }, token) };
}

test('strict local sponsorship accepts clear fixture screening but preserves MOCK_LISTED refusal', async () => {
  for (const [address, expectedCode] of [[wallet, undefined], [MOCK_LISTED, 'SANCTIONS_BLOCK']] as const) {
    const f = await fixture({}, address);
    try {
      const result = await f.withdraw();
      assert.equal(result.status, expectedCode ? 403 : 200);
      assert.equal(result.body.code, expectedCode);
      assert.deepEqual(f.events, expectedCode ? [] : ['simulate', 'send']);
    } finally { await f.app.close(); }
  }
});

test('strict local sponsorship still refuses missing, throwing, and stale required adapters before sending', async () => {
  const sources = configureScreening(settings).screeningSources!;
  for (const screeningSources of [
    [],
    [{ ...sources[0], check: async () => { throw new Error('MOCK adapter unavailable'); } }],
    [{ ...sources[0], check: async () => ({ hits: [], updatedAt: Date.now() - 31 * 86400_000 }) }],
  ]) {
    const f = await fixture({ screeningSources });
    try {
      const result = await f.withdraw();
      assert.equal(result.status, 403);
      assert.equal(result.body.code, 'SCREENING_UNAVAILABLE');
      assert.deepEqual(f.events, []);
    } finally { await f.app.close(); }
  }
});
