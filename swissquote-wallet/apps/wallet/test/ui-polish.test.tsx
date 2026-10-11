import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADDRESSES, encodeCode, type SafeTx, type WalletAudit } from '@sq/protocol';
import type { FeatureContext } from '../src/features/context';
import type { DeviceRecord } from '../src/storage';
import { Countdown } from '../src/features/recovery/Countdown';
import { clock, secondsLeft, type Pending, type Snapshot } from '../src/features/recovery/core';
import { Review, displayUsdc } from '../src/features/pay/Review';
import { custodyConfirmed } from '../src/features/protection/WhoCanMove';

const wallet = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const card = '0x3333333333333333333333333333333333333333';
const partner = '0x4444444444444444444444444444444444444444';
const sq = '0x5555555555555555555555555555555555555555';
const context: FeatureContext = { wallet, chainId: 31337, clients: [], setupCode: encodeCode({ v: 1, kind: 'setup', chainId: 31337, wallet, owner, partnerGuardian: partner, sqGuardian: sq, saltNonce: '0' }), mnemonic: '', busy: false,
  device: { id: 'test', wallet, owner, cardGuardian: card, envelope: {} as DeviceRecord['envelope'], createdAt: '2026-10-11' },
  run: async (_label, action) => action(), refresh: async () => {}, notify: () => {}, recordTransaction: () => {}, relay: async () => { throw new Error('UI test must not relay'); } };

test('recovery countdown uses pinned block time and margin, never negative or automatic finalization', () => {
  const pending: Pending = { module: ADDRESSES.moduleA, newOwners: [owner], newThreshold: 1n, executeAfter: 180n };
  const snapshot: Snapshot = { pending: [pending], timestamp: 0n, blockNumber: 40n, certain: true, warning: '' };
  assert.equal(secondsLeft(180n, 0n), 195n);
  assert.equal(secondsLeft(180n, 999n), 0n);
  assert.equal(clock(195n), '3:15');
  const html = renderToStaticMarkup(createElement(Countdown, { pending, snapshot }));
  assert.match(html, /3:15/); assert.match(html, /block 40/); assert.match(html, /not an automatic key change/); assert.doesNotMatch(html, /role="status"/);
  const unavailable = renderToStaticMarkup(createElement(Countdown, { pending, snapshot: { ...snapshot, certain: false } }));
  assert.match(unavailable, /Countdown unavailable/); assert.doesNotMatch(unavailable, /<progress/);
  const finished = renderToStaticMarkup(createElement(Countdown, { pending, snapshot: { ...snapshot, timestamp: 999n } }));
  assert.match(finished, /fresh chain check/);
});

test('USDC review has four honest rows, exact decimals, unknown balance and real screening distinctions', () => {
  const tx: SafeTx = { to: ADDRESSES.usdc, value: 0n, data: '0x', operation: 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: ADDRESSES.usdc, refundReceiver: wallet, nonce: 0n };
  assert.equal(displayUsdc(1n), '0.000001'); assert.equal(displayUsdc(5_000_000n), '5.00');
  const html = renderToStaticMarkup(createElement(Review, { context, review: { tx, recipient: partner, amount: '5' }, firstTime: true, lookalike: false, relayAllowed: true, requiresPasskey: true }));
  for (const label of ['You send', 'Recipient gets', 'Network fee', 'Balance after']) assert.ok(html.includes(`<dt>${label}</dt>`));
  assert.match(html, /Sponsored by Swissquote/); assert.match(html, /no network fee if approved/); assert.match(html, /No ETH needed/); assert.doesNotMatch(html, /CHF 0\.00/);
  assert.match(html, /<dd>—<small>/); assert.match(html, /if this USDC transfer succeeds/); assert.match(html, /live public sanctions list, USDC freeze status and MOCK demo entries/); assert.match(html, /This preview has not cleared/); assert.match(html, /Check carefully/);
  const blocked = renderToStaticMarkup(createElement(Review, { context, review: { tx, recipient: partner, amount: '5' }, firstTime: false, lookalike: false, relayAllowed: false, requiresPasskey: false }));
  assert.match(blocked, /Not sponsored/); assert.match(blocked, /can’t be sent here/); assert.doesNotMatch(blocked, /CHF 0\.00/);
});

test('custody copy requires recognised rules, current sole owner, expected card/helpers and no pending request', () => {
  const audit: WalletAudit = { facts: { verified: true, chainId: '31337', ownerThreshold: '1', owners: owner, sharedGuardian: card, moduleAGuardians: `${card}, ${partner}`, moduleBGuardians: `${card}, ${sq}`, moduleAExecuteAfter: '0', moduleBExecuteAfter: '0' }, answers: [], warnings: [] };
  assert.equal(custodyConfirmed(context, audit), true);
  const failures: WalletAudit['facts'][] = [{ verified: false }, { owners: partner }, { sharedGuardian: partner }, { moduleAGuardians: `${sq}, ${partner}` }, { moduleBExecuteAfter: '123' }, { chainId: '11155111' }];
  for (const facts of failures) assert.equal(custodyConfirmed(context, { ...audit, facts: { ...audit.facts, ...facts } }), false);
  assert.equal(custodyConfirmed({ ...context, setupCode: '' }, audit), false);
  assert.equal(custodyConfirmed({ ...context, device: undefined }, audit), false);
  assert.equal(custodyConfirmed({ ...context, device: { ...context.device!, wallet: partner } }, audit), false);
});
