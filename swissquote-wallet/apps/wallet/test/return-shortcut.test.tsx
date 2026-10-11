import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ADDRESSES } from '@sq/protocol';
import type { Address } from 'viem';
import type { FeatureContext } from '../src/features/context';
import { MoveBack } from '../src/features/pay/MoveBack';
import Pay from '../src/features/pay/index';

// Minimal DOM host: real React reconciliation/effects, handlers invoked on host nodes.
class Host {
  nodeType = 1; nodeName: string; tagName: string; namespaceURI = 'http://www.w3.org/1999/xhtml';
  parentNode: Host | null = null; childNodes: Host[] = []; attrs: Record<string, string> = {};
  style = {}; value = ''; disabled = false; text = ''; ownerDocument: any;
  constructor(name: string, doc?: any) { this.nodeName = this.tagName = name.toUpperCase(); this.ownerDocument = doc; }
  appendChild(n: Host) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n: Host, before: Host) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(before), 0, n); return n; }
  removeChild(n: Host) { this.childNodes.splice(this.childNodes.indexOf(n), 1); n.parentNode = null; return n; }
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); if (k === 'disabled') this.disabled = true; }
  removeAttribute(k: string) { delete this.attrs[k]; if (k === 'disabled') this.disabled = false; }
  getAttribute(k: string) { return this.attrs[k] ?? null; }
  addEventListener() {} removeEventListener() {} focus() {}
  get textContent(): string { return this.text + this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v: string) { this.text = String(v); this.childNodes = []; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild(): Host | null { return this.childNodes.at(-1) ?? null; }
  get nextSibling(): Host | null { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null; }
  contains(n: Host): boolean { return n === this || this.childNodes.some(c => c.contains(n)); }
}
const doc: any = new Host('document'); doc.nodeType = 9; doc.ownerDocument = doc;
doc.createElement = (name: string) => new Host(name, doc);
doc.createElementNS = (_ns: string, name: string) => new Host(name, doc);
doc.createTextNode = (text: string) => { const n = new Host('#text', doc); n.nodeType = 3; n.text = text; return n; };
doc.documentElement = new Host('html', doc); doc.body = new Host('body', doc); doc.activeElement = doc.body;
const win: any = { document: doc, HTMLElement: Host, HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} };
doc.defaultView = win;
Object.assign(globalThis, { document: doc, window: win, IS_REACT_ACT_ENVIRONMENT: true });
const wallet = '0x1111111111111111111111111111111111111111' as Address;
const owner = '0x2222222222222222222222222222222222222222' as Address;
const accountAddress = '0x3333333333333333333333333333333333333333' as Address;
const context = (): FeatureContext => ({ chainId: 31337, wallet, session: { token: 'test-session', clientId: 'client', userRef: 'client', kycVerified: true }, device: { id: 'client', wallet, owner, createdAt: 'now', envelope: {} as any }, clients: [], setupCode: '', mnemonic: '', busy: false, run: async (_label, action) => action(), refresh: async () => {}, notify: () => {}, recordTransaction: () => {}, relay: async () => { throw new Error('Shortcut must never relay'); } });
const account = () => ({ address: accountAddress, clientId: 'client', verifiedWallets: [wallet], token: ADDRESSES.usdc, balance: '0', decimals: 6, mock: true });
const linked = () => ({ wallet, owner, clientId: 'client', chainId: 31337, verified: true });
function all(n: Host): Host[] { return [n, ...n.childNodes.flatMap(all)]; }
function props(n: Host): any { const key = Object.keys(n).find(k => k.startsWith('__reactProps')); return key ? (n as any)[key] : {}; }
async function flush() { await act(async () => { await new Promise(resolve => setImmediate(resolve)); }); }
async function fixture(c = context(), a: unknown = account(), l: unknown = linked(), pay = false) {
  const requests: string[] = []; const chosen: Address[] = [];
  const original = globalThis.fetch;
  let held: (() => void) | undefined; let hold = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.method, 'GET'); assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-session');
    const path = new URL(String(url)).pathname; requests.push(path);
    if (hold) await new Promise<void>(resolve => { held = resolve; });
    if (path === '/account') { if (a instanceof Error) throw a; return Response.json(a); }
    assert.equal(path, `/wallets/${wallet}`); return Response.json(l);
  };
  const container = new Host('div', doc); const root = createRoot(container as unknown as Element);
  const render = async (next = c) => { await act(async () => root.render(pay ? <Pay context={next}/> : <MoveBack context={next} onRecipient={value => chosen.push(value)}/>)); await flush(); };
  await render();
  return { container, requests, chosen, render, hold: () => { hold = true; }, release: () => held?.(), click: async () => {
    const button = all(container).find(n => n.tagName === 'BUTTON' && n.textContent.includes('Move back')); assert(button); assert.equal(button.disabled, false);
    await act(async () => { props(button).onClick(); }); await flush();
  }, close: async () => { await act(async () => root.unmount()); globalThis.fetch = original; } };
}

test('verified same-account shortcut has exact honest copy; selection rechecks and only prefills', async () => {
  const f = await fixture(); try {
    assert(f.container.textContent.includes('Move back to my Swissquote account · MOCK'));
    assert(f.container.textContent.includes('Test-token transfer only. This demo does not credit a bank balance.'));
    assert(!f.container.textContent.includes(accountAddress));
    await f.click(); assert.deepEqual(f.chosen, [accountAddress]); assert.equal(f.requests.length, 4);
  } finally { await f.close(); }
});
test('Pay integration fills recipient but leaves amount and review/signing flow untouched', async () => {
  const f = await fixture(context(), account(), linked(), true); try {
    await f.click(); const inputs = all(f.container).filter(n => n.tagName === 'INPUT');
    assert.equal(inputs[0].value, accountAddress); assert.equal(inputs[1].value, '2');
    assert(f.container.textContent.includes('Review payment')); assert(!f.container.textContent.includes('Sign & send'));
    assert.equal(f.requests.length, 4);
  } finally { await f.close(); }
});
test('zero, missing, malformed, unsupported token/account response hide without leaking address', async () => {
  for (const a of [{ ...account(), address: '0x' + '0'.repeat(40) }, { ...account(), address: undefined }, { ...account(), address: 'bad' }, { ...account(), clientId: 'other' }, { ...account(), verifiedWallets: undefined }, { ...account(), token: owner }, null]) {
    const f = await fixture(context(), a); try { assert.equal(f.container.textContent, ''); } finally { await f.close(); }
  }
});
test('unverified, foreign account, network and stale owner linkage hide', async () => {
  for (const l of [{ ...linked(), verified: false }, { ...linked(), clientId: 'other' }, { ...linked(), chainId: 1 }, { ...linked(), owner: accountAddress }]) {
    const f = await fixture(context(), account(), l); try { assert.equal(f.container.textContent, ''); } finally { await f.close(); }
  }
});
test('missing session/device and unsupported or differently configured network do not request account', async () => {
  for (const c of [{ ...context(), session: undefined }, { ...context(), device: undefined }, { ...context(), chainId: 1 }, { ...context(), chainId: 11155111 }, { ...context(), session: { ...context().session!, kycVerified: false } }]) {
    const f = await fixture(c); try { assert.equal(f.container.textContent, ''); assert.deepEqual(f.requests, []); } finally { await f.close(); }
  }
});
test('network failure hides shortcut and never notifies or signs', async () => {
  const f = await fixture(context(), new Error('offline')); try { assert.equal(f.container.textContent, ''); assert.deepEqual(f.chosen, []); } finally { await f.close(); }
});
test('session change immediately hides cached destination and ignores late selection response', async () => {
  const f = await fixture(); try {
    // Both pending reads are released after switching account/session.
    const original = globalThis.fetch; const releases: (() => void)[] = [];
    globalThis.fetch = async (...args) => { await new Promise<void>(resolve => releases.push(resolve)); return original(...args); };
    await f.click(); await f.render({ ...context(), session: undefined });
    assert.equal(f.container.textContent, ''); releases.forEach(resolve => resolve()); await flush();
    assert.deepEqual(f.chosen, []);
  } finally { await f.close(); }
});
