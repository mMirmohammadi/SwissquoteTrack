import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FeatureContext } from '../context';
import { TEST_IDS } from '../test-ids';
import Feature from './index';

function context(chainId: number): FeatureContext {
  return { chainId, clients: [], setupCode: '', mnemonic: '', busy: false,
    run: async (_label, action) => action(), refresh: async () => {}, notify: () => {}, recordTransaction: () => {},
    relay: async () => { throw new Error('This test must not sign or relay.'); } };
}

test('local chain renders a fail-closed feature with shared test IDs and no execute control', () => {
  const html = renderToStaticMarkup(createElement(Feature, { context: context(31337) }));
  assert.ok(html.includes(`data-testid="${TEST_IDS.dapps}"`));
  assert.ok(html.includes(`data-testid="${TEST_IDS.dappPreview}" disabled=""`));
  assert.ok(!html.includes(`data-testid="${TEST_IDS.dappExecute}"`));
  assert.ok(html.includes('DeFi signing is unavailable on this network'));
});

test('disconnected Sepolia renders honest testnet and third-party risk without simulated outcomes', () => {
  const html = renderToStaticMarkup(createElement(Feature, { context: context(11155111) }));
  assert.ok(html.includes('third-party test deployment'));
  assert.ok(html.includes('Test tokens have no cash value'));
  assert.ok(html.includes('not investment advice'));
  assert.ok(html.includes('Nothing can be signed'));
  assert.ok(!html.includes('Permission now 0'));
  assert.ok(!html.includes('Execution confirmed'));
});
