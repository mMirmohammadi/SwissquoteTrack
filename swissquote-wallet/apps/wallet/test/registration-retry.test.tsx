import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as protocol from '@sq/protocol';
import type { DeviceRecord } from '../src/storage';

// Small DOM host for react-dom/client. React performs real reconciliation/effects;
// user actions invoke the handlers installed on the rendered host elements.
class Host {
  nodeType = 1; nodeName: string; tagName: string; namespaceURI = 'http://www.w3.org/1999/xhtml';
  parentNode: Host | null = null; childNodes: Host[] = []; attrs: Record<string, string> = {};
  style = {}; value = ''; checked = false; disabled = false; text = '';
  ownerDocument: any; constructor(name: string, doc?: any) { this.nodeName = this.tagName = name.toUpperCase(); this.ownerDocument = doc; }
  appendChild(n: Host) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n: Host, before: Host) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(before), 0, n); return n; }
  removeChild(n: Host) { this.childNodes.splice(this.childNodes.indexOf(n), 1); n.parentNode = null; return n; }
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); if (k === 'disabled') this.disabled = true; }
  removeAttribute(k: string) { delete this.attrs[k]; if (k === 'disabled') this.disabled = false; }
  getAttribute(k: string) { return this.attrs[k] ?? null; }
  addEventListener() {} removeEventListener() {}
  get textContent(): string { return this.text + this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v: string) { this.text = String(v); this.childNodes = []; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild(): Host | null { return this.childNodes.at(-1) ?? null; }
  get nextSibling(): Host | null { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null; }
  contains(n: Host): boolean { return n === this || this.childNodes.some(c => c.contains(n)); }
  focus() {}
}
const doc: any = new Host('document'); doc.nodeType = 9; doc.ownerDocument = doc;
doc.createElement = (name: string) => new Host(name, doc);
doc.createElementNS = (_ns: string, name: string) => new Host(name, doc);
doc.createTextNode = (text: string) => { const n = new Host('#text', doc); n.nodeType = 3; n.text = text; return n; };
doc.documentElement = new Host('html', doc); doc.body = new Host('body', doc); doc.activeElement = doc.body;
const win: any = { document: doc, HTMLElement: Host, HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} };
doc.defaultView = win;
Object.assign(globalThis, { document: doc, window: win, IS_REACT_ACT_ENVIRONMENT: true });
const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const owner = protocol.mnemonicToAddress(seed);
const wallet = '0x1111111111111111111111111111111111111111' as const;
const guardian = '0x3333333333333333333333333333333333333333' as const;
const hash = `0x${'ab'.repeat(32)}`;
let saved: DeviceRecord | undefined;
let deploys = 0; let registrations: any[] = []; let refuse = true;
let lookup: { reject: (error: Error) => void } | undefined;
let lookups: { reject: (error: Error) => void }[] = [];
let registrationFinish: (() => void) | undefined; let holdRegistration = false;
let challengeFinish: (() => void) | undefined; let holdChallenge = false; let signings = 0;
let pendingFinish: (() => void) | undefined; let holdPending = false;
let unlockFinish: (() => void) | undefined; let holdUnlock = false;
let replacementSaved: DeviceRecord | undefined;
const baseRecord = (): DeviceRecord => ({ id: 'client', owner, createdAt: 'now', envelope: { ciphertext: 'encrypted-only' } as DeviceRecord['envelope'] });
const setupCode = protocol.encodeCode({ v: 1, kind: 'setup', chainId: 31337, wallet, owner, partnerGuardian: guardian, sqGuardian: guardian, saltNonce: '9' });
await mock.module('../src/chain.ts', { namedExports: {
  chainId: 31337, client: { readContract: async (args: any) => args.functionName === 'proxyCreationCode' ? '0x00' : 0n, getBalance: async () => 0n },
  validatedAddress: (v: string) => v, usdcAmount: () => 1n, paymentTx: async () => ({}), nonce: async () => 0n, owners: async () => [owner], readPending: async () => { if (holdPending) await new Promise<void>(resolve => { pendingFinish = resolve; }); return []; }, confirmed: async () => 123n, countdown: () => '', PendingTransactionError: class extends Error {},
} });
await mock.module('../src/storage.ts', { namedExports: {
  loadDevice: async (id: string) => id === 'client' ? saved : replacementSaved,
  saveDevice: async () => { saved = baseRecord(); return saved; },
  bindWallet: async (record: DeviceRecord, target: any, code: string, card: any, block?: string) => { saved = { ...record, wallet: target, setupCode: code, cardGuardian: card, deploymentBlock: block }; return saved; },
  promoteDevice: async () => { saved = { ...replacementSaved!, id: 'client' }; replacementSaved = undefined; return saved; }, unlockDevice: async (_record: DeviceRecord, pass: string) => { if (pass !== 'device-passphrase') throw new Error('Could not unlock this device.'); if (holdUnlock) await new Promise<void>(resolve => { unlockFinish = resolve; }); return seed; },
} });
await mock.module('@sq/protocol', { namedExports: { ...protocol, signOwnershipProof: async (...args: Parameters<typeof protocol.signOwnershipProof>) => { signings++; return protocol.signOwnershipProof(...args); }, generateOwnerSeed: () => seed, computeWalletAddress: () => wallet, buildWalletInitializer: () => '0x00', generateKitCode: async () => 'kit-code', createKit: async () => ({ ciphertext: 'encrypted-kit' }) } });
await mock.module('../src/features/index.ts', { namedExports: { FEATURE_REGISTRY: [], featureEnabled: () => false, RecoveryAlert: () => null } });
const { App } = await import('../src/App');
function all(n: Host): Host[] { return [n, ...n.childNodes.flatMap(all)]; }
function props(n: Host): any { const key = Object.keys(n).find(k => k.startsWith('__reactProps')); return key ? (n as any)[key] : {}; }
function button(root: Host, label: string) { const result = all(root).find(n => n.tagName === 'BUTTON' && n.textContent.includes(label)); assert(result, `Missing button: ${label}`); return result; }
async function click(n: Host) { assert.equal(n.disabled, false); await act(async () => { props(n).onClick?.({ preventDefault() {} }); }); }
async function field(root: Host, label: string, value: string) { const input = all(root).find(n => n.tagName === 'INPUT' && (n.attrs['aria-label'] === label || n.parentNode?.textContent.includes(label))); assert(input, `Missing input: ${label}; rendered: ${root.textContent}`); await act(async () => { props(input).onChange({ target: { value } }); }); }
async function flush() { await act(async () => { await new Promise(resolve => setImmediate(resolve)); }); }
async function login(root: Host) { await field(root, 'Email address', 'client@example.test'); await field(root, 'Login password', 'login-password'); const form = all(root).find(n => n.tagName === 'FORM'); assert(form); await act(async () => { props(form).onSubmit({ preventDefault() {} }); }); await flush(); }
function installFetch() {
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url)).pathname;
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (path.startsWith('/auth/password/')) return Response.json({ token: 'session', clientId: 'client', kycVerified: true });
    if (path === '/account') return Response.json({ balance: '1000000' });
    if (path === '/guardian/enroll' || path === '/enroll') return Response.json({ guardian });
    if (path === '/relay/deploy') { deploys++; return Response.json({ wallet, transactionHash: hash }); }
    if (path === '/wallets/challenge') { if (holdChallenge) await new Promise<void>(resolve => { challengeFinish = resolve; }); return Response.json({ nonce: `fresh-${registrations.length}` }); }
    if (path === '/wallets') {
      registrations.push(body);
      if (holdRegistration) await new Promise<void>(resolve => { registrationFinish = resolve; });
      return refuse ? Response.json({ error: 'Wallet rules refused' }, { status: 403 }) : Response.json({ wallet, owner, verified: true });
    }
    if (path.startsWith('/wallets/')) return new Promise((_resolve, reject) => { lookup = { reject }; lookups.push(lookup); });
    throw new Error(`Unexpected request ${path}`);
  };
}
async function mount() { const container = new Host('div', doc); const root = createRoot(container as unknown as Element); await act(async () => root.render(<App/>)); return { container, root }; }
function reset() { saved = undefined; deploys = 0; registrations = []; refuse = true; lookup = undefined; lookups = []; holdRegistration = false; registrationFinish = undefined; holdChallenge = false; challengeFinish = undefined; signings = 0; holdPending = false; pendingFinish = undefined; holdUnlock = false; unlockFinish = undefined; replacementSaved = undefined; installFetch(); }

test('confirmed creation refusal publishes bound wallet, preserves key/unlock, and explicit retry succeeds without redeployment or stale GET overwrite', async () => {
  reset(); const { container, root } = await mount();
  try {
    await login(container);
    await field(container, 'Recovery card public address', guardian);
    await field(container, 'Create a device passphrase', 'device-passphrase');
    await click(button(container, 'Create my wallet')); await flush();
    assert.equal(deploys, 1); assert.equal(saved?.wallet, wallet); assert.equal(saved?.deploymentBlock, '123'); assert.equal(saved?.envelope.ciphertext, 'encrypted-only');
    assert.match(container.textContent, /Wallet rules refused/); assert.match(container.textContent, /Ownership not verified/); assert.match(container.textContent, /Wallet deployed, ownership registration incomplete/);
    assert.equal(button(container, 'Move to my wallet').disabled, true); assert.equal(registrations[0].minimumBlockNumber, '123');
    await click(button(container, 'Security & kit')); assert.match(container.textContent, /Unlocked in memory/);
    await click(button(container, 'Lock device now')); assert.match(container.textContent, /Device key locked/);
    await click(button(container, 'Retry registration')); assert.equal(registrations.length, 1); assert.match(container.textContent, /Could not unlock/);
    await field(container, 'Device passphrase', 'device-passphrase'); await click(button(container, 'Unlock device'));
    await click(button(container, 'Overview')); refuse = false;
    await click(button(container, 'Retry registration')); await flush();
    assert.equal(deploys, 1); assert.equal(registrations.length, 2); assert.equal(registrations[1].minimumBlockNumber, '123'); assert.match(container.textContent, /Verified as yours/);
    assert.equal(all(container).some(n => n.tagName === 'BUTTON' && n.textContent === 'Retry registration'), false);
    await act(async () => { lookup?.reject(new Error('Delayed old lookup failure')); }); await flush();
    assert.match(container.textContent, /Verified as yours/); assert.equal(button(container, 'Move to my wallet').disabled, true);
  } finally { await act(async () => { root.unmount(); lookups.forEach(item => item.reject(new Error('Test cleanup'))); }); }
});

test('registration completing after current device owner changes cannot verify the replacement owner', async () => {
  reset(); saved = { ...baseRecord(), wallet, setupCode, cardGuardian: guardian, deploymentBlock: '123' };
  const { container, root } = await mount();
  try {
    await login(container); await field(container, 'Device passphrase', 'device-passphrase'); await click(button(container, 'Unlock device'));
    refuse = false; holdRegistration = true; await click(button(container, 'Retry registration')); await flush();
    assert(registrationFinish); saved = { ...saved!, owner: guardian };
    await click(button(container, 'Refresh chain status')); await flush();
    await act(async () => registrationFinish?.()); await flush();
    assert.match(container.textContent, /Ownership not verified/); assert.match(container.textContent, /Device key locked/);
    assert.doesNotMatch(container.textContent, /Ownership registration complete|Verified as yours/);
    assert.equal(button(container, 'Move to my wallet').disabled, true);
  } finally { await act(async () => { root.unmount(); lookups.forEach(item => item.reject(new Error('Test cleanup'))); }); }
});

for (const invalidation of ['lock', 'logout'] as const) {
  test(`actual helper challenge delayed through ${invalidation} never signs, posts, or publishes verification`, async () => {
    reset(); saved = { ...baseRecord(), wallet, setupCode, cardGuardian: guardian };
    const { container, root } = await mount();
    try {
      await login(container); await field(container, 'Device passphrase', 'device-passphrase'); await click(button(container, 'Unlock device'));
      refuse = false; holdChallenge = true;
      await click(button(container, 'Retry registration')); await flush(); assert(challengeFinish);
      if (invalidation === 'lock') { await click(button(container, 'Security & kit')); await click(button(container, 'Lock device now')); }
      else await click(button(container, 'Sign out'));
      await act(async () => challengeFinish?.()); await flush();
      assert.equal(signings, 0); assert.equal(registrations.length, 0);
      assert.doesNotMatch(container.textContent, /Verified as yours|Ownership registration complete|Save your emergency kit now/);
    } finally { await act(async () => { root.unmount(); lookups.forEach(item => item.reject(new Error('Test cleanup'))); }); }
  });
}
for (const stage of ['unlock', 'pending'] as const) {
  test(`registration invalidated during delayed ${stage} cannot recapture the lock generation`, async () => {
    reset(); saved = { ...baseRecord(), wallet, setupCode, cardGuardian: guardian };
    const { container, root } = await mount();
    try {
      await login(container); await field(container, 'Device passphrase', 'device-passphrase');
      if (stage === 'pending') await click(button(container, 'Unlock device'));
      holdUnlock = stage === 'unlock'; holdPending = stage === 'pending';
      await click(button(container, 'Retry registration')); await flush();
      assert(stage === 'unlock' ? unlockFinish : pendingFinish);
      await click(button(container, 'Security & kit')); await click(button(container, 'Lock device now'));
      await act(async () => { (stage === 'unlock' ? unlockFinish : pendingFinish)?.(); }); await flush();
      assert.equal(signings, 0); assert.equal(registrations.length, 0); assert.match(container.textContent, /Locked/);
      assert.doesNotMatch(container.textContent, /Ownership registration complete|Unlocked in memory/);
    } finally { await act(async () => { root.unmount(); lookups.forEach(item => item.reject(new Error('Test cleanup'))); }); }
  });
}
for (const logoutDuringPost of [false, true]) {
  test(`fresh replacement promotion ${logoutDuringPost ? 'fences late POST after logout' : 'registers and ignores stale owner GET'}`, async () => {
    reset(); saved = { ...baseRecord(), owner: guardian, wallet, setupCode, cardGuardian: guardian };
    replacementSaved = { ...baseRecord(), id: 'client:replacement', wallet, setupCode, cardGuardian: guardian };
    const { container, root } = await mount();
    try {
      await login(container); await field(container, 'Replacement device passphrase', 'device-passphrase');
      refuse = false; holdRegistration = logoutDuringPost;
      await click(button(container, 'Check chain and install replacement')); await flush();
      if (logoutDuringPost) {
        assert(registrationFinish); await click(button(container, 'Sign out')); await act(async () => registrationFinish?.()); await flush();
        assert.match(container.textContent, /Sign in to Swissquote/); assert.doesNotMatch(container.textContent, /freshly verified|Verified as yours|Save your emergency kit now/);
      } else {
        assert.equal(registrations.length, 1); assert.match(container.textContent, /Verified as yours|freshly verified/);
        await act(async () => { lookups.forEach(item => item.reject(new Error('Delayed old owner lookup'))); }); await flush();
        assert.match(container.textContent, /Verified as yours/);
      }
    } finally { await act(async () => { root.unmount(); lookups.forEach(item => item.reject(new Error('Test cleanup'))); }); }
  });
}

test('registration completing after sign out cannot promote another session', async () => {
  reset(); saved = { ...baseRecord(), wallet, setupCode, cardGuardian: guardian, deploymentBlock: '123' };
  const { container, root } = await mount();
  try {
    await login(container); await field(container, 'Device passphrase', 'device-passphrase'); await click(button(container, 'Unlock device'));
    refuse = false; holdRegistration = true; await click(button(container, 'Retry registration')); await flush();
    assert(registrationFinish); await click(button(container, 'Sign out'));
    await act(async () => registrationFinish?.()); await flush();
    assert.match(container.textContent, /Sign in to Swissquote/); assert.doesNotMatch(container.textContent, /Ownership registration complete|Verified as yours|Save your emergency kit now/);
  } finally { await act(async () => { root.unmount(); lookups.forEach(item => item.reject(new Error('Test cleanup'))); }); }
});
