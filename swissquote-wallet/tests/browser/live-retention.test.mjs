// Offline synthetic fixtures only: no browser, RPC, service, real seed or secret output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, lstat, chmod, symlink, rename, link } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLiveRetention, hasEncryptedDevice } from './live-retention.mjs';

const scratchRoot = fileURLToPath(new URL('../../../AgentsLocal/', import.meta.url));
await mkdir(scratchRoot, { recursive: true });
const scratch = join(scratchRoot, randomBytes(4).toString('hex'));
await mkdir(scratch); // Own this attempt exclusively; keep only synthetic ignored fixtures.
let fixtureId = 0;
async function fixture(ignore = 'swissquote-wallet/.sepolia-runs/\n') {
  const root = join(scratch, `fixture-${fixtureId++}`);
  await mkdir(root);
  await writeFile(join(root, '.gitignore'), ignore, { flag: 'wx' });
  const cwd = join(root, 'swissquote-wallet'); await mkdir(cwd);
  return { cwd, root, opts: { walletCwd: cwd, optIn: 'yes', runId: 'synthetic-run' } };
}
const owner = `0x${'1'.repeat(40)}`, wallet = `0x${'2'.repeat(40)}`;
const credentials = { devicePassphrase: 'synthetic-device-passphrase', cardWords: Array.from({ length: 12 }, (_, i) => `synthetic-card-${i}`).join(' ') };
const device = () => ({ id: 'synthetic-user', owner, wallet, createdAt: 'synthetic-date', envelope: { v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 }, salt: Buffer.alloc(16).toString('base64url'), iv: Buffer.alloc(12).toString('base64url'), ciphertext: Buffer.alloc(32).toString('base64url') } });
const state = (record = device()) => ({ cookies: [{ name: 'synthetic-auth', value: 'synthetic-cookie' }], origins: [{ origin: 'http://localhost:5273', localStorage: [{ name: 'session', value: 'synthetic-session' }], indexedDB: [{ name: 'sq-wallet-device-v1', stores: [{ name: 'keys', records: record ? [{ key: record.id, value: record }] : [] }] }] }] });
const context = value => ({ storageState: async options => { assert.deepEqual(options, { indexedDB: true }); return value; } });
const rejectsSafe = promise => assert.rejects(promise, error => error.message === 'Secure local retention failed; further broadcasts are blocked.');

test('private modes, exclusive run, exact secret persistence and alternating fresh snapshots', async () => {
  const f = await fixture(), retention = await createLiveRetention(f.opts);
  try {
    const root = join(f.cwd, '.sepolia-runs'), run = join(root, f.opts.runId);
    assert.equal((await lstat(root)).mode & 0o777, 0o700);
    assert.equal((await lstat(run)).mode & 0o777, 0o700);
    for (const name of ['recovery-private.json', 'browser-state-0.json', 'browser-state-1.json']) assert.equal((await lstat(join(run, name))).mode & 0o777, 0o600);
    await rejectsSafe(createLiveRetention(f.opts));
    await retention.retainCredentials(credentials);
    assert.deepEqual(JSON.parse(await readFile(join(run, 'recovery-private.json'), 'utf8')), { schema: 'sepolia-local-recovery-v1', ...credentials });
    await retention.snapshot(context(state(null))); // Pre-click snapshot can contain auth only.
    await retention.guardWrite(context(state()), { owner, deploy: true });
    assert.deepEqual(JSON.parse(await readFile(join(run, 'browser-state-1.json'), 'utf8')), state());
    await retention.guardWrite(context(state()), { owner, wallet });
    assert.deepEqual(JSON.parse(await readFile(join(run, 'browser-state-0.json'), 'utf8')), state());
  } finally { await retention.close(); }
});

test('consent, unsafe ids, unexpected cwd and ignore opt-outs are rejected', async () => {
  const f = await fixture();
  for (const runId of ['../escape', '.', '', '/absolute', 'a/b', 'a.b', 'é', 'a'.repeat(81)]) await rejectsSafe(createLiveRetention({ ...f.opts, runId }));
  await rejectsSafe(createLiveRetention({ ...f.opts, optIn: undefined }));
  await rejectsSafe(createLiveRetention({ ...f.opts, walletCwd: f.root }));
  for (const ignore of ['', 'swissquote-wallet/.sepolia-runs/\n!swissquote-wallet/.sepolia-runs/**\n']) await rejectsSafe(createLiveRetention((await fixture(ignore)).opts));
});

test('permissive or symlinked retention root and existing run are rejected', async () => {
  const f = await fixture(), root = join(f.cwd, '.sepolia-runs');
  await mkdir(root, { mode: 0o755 }); await rejectsSafe(createLiveRetention(f.opts));
  const g = await fixture(); await symlink(root, join(g.cwd, '.sepolia-runs')); await rejectsSafe(createLiveRetention(g.opts));
});

test('missing or wrong encrypted owner fails closed; no wallet binding claim before deploy', async () => {
  const f = await fixture(), retention = await createLiveRetention(f.opts);
  try {
    await retention.retainCredentials(credentials);
    const unbound = device(); delete unbound.wallet;
    await retention.guardWrite(context(state(unbound)), { owner, deploy: true });
    await rejectsSafe(retention.guardWrite(context(state(unbound)), { owner, wallet }));
    await rejectsSafe(retention.guardWrite(context(state()), { owner, wallet })); // Permanent latch.
    await retention.snapshot(context(state()), { owner, requireDevice: true }); // Finally still attempts.
  } finally { await retention.close(); }
  assert.equal(hasEncryptedDevice(state(null), { owner }), false);
  assert.equal(hasEncryptedDevice(state(), { owner: wallet }), false);
});

test('unexpected plaintext fields and malformed envelopes are rejected without echoing values', async () => {
  for (const record of [{ ...device(), mnemonic: 'synthetic-not-a-seed' }, { ...device(), envelope: { ...device().envelope, ciphertext: 'bad!' } }, { ...device(), envelope: { ...device().envelope, seed: 'synthetic-not-a-seed' } }]) {
    assert.throws(() => hasEncryptedDevice(state(record)), error => error.message === 'Secure local retention failed; further broadcasts are blocked.');
  }
  const f = await fixture(), retention = await createLiveRetention(f.opts);
  try { await rejectsSafe(retention.retainCredentials({ ...credentials, ownerSeed: 'synthetic-not-a-seed' })); } finally { await retention.close(); }
});

test('broadcast guard rejects missing credentials before requesting a snapshot', async () => {
  const f = await fixture(), retention = await createLiveRetention(f.opts);
  try {
    let called = false;
    await rejectsSafe(retention.guardWrite({ storageState: async () => { called = true; return state(); } }, { owner, deploy: true }));
    assert.equal(called, false);
    await retention.retainCredentials(credentials);
    await rejectsSafe(retention.guardWrite(context(state()), { owner, deploy: true }));
  } finally { await retention.close(); }
});

test('credentials and snapshot failure block future broadcasts but permit finally retry', async () => {
  const f = await fixture(), retention = await createLiveRetention(f.opts);
  try {
    await retention.retainCredentials(credentials);
    await rejectsSafe(retention.snapshot({ storageState: async () => { throw new Error('synthetic-private-error'); } }));
    await rejectsSafe(retention.guardWrite(context(state()), { owner, wallet }));
    await retention.snapshot(context(state()), { owner, wallet, requireDevice: true });
  } finally { await retention.close(); }
});

test('file chmod, hardlink and path swaps are rejected rather than following replacements', async () => {
  for (const attack of ['chmod', 'hardlink', 'swap']) {
    const f = await fixture(), retention = await createLiveRetention(f.opts);
    try {
      await retention.retainCredentials(credentials);
      const path = join(f.cwd, '.sepolia-runs', f.opts.runId, 'browser-state-0.json');
      if (attack === 'chmod') await chmod(path, 0o644);
      if (attack === 'hardlink') await link(path, `${path}.link`);
      if (attack === 'swap') {
        const moved = `${path}.original`;
        assert.ok(path.startsWith(`${scratch}/`) && moved.startsWith(`${scratch}/`));
        await rename(path, moved); await symlink(moved, path);
      }
      await rejectsSafe(retention.snapshot(context(state())));
      await rejectsSafe(retention.guardWrite(context(state()), { owner, wallet }));
    } finally { await retention.close(); }
  }
});

// Exact installed storageScript subset: strings/numbers/booleans are NOT tagged.
function encode(value) {
  let id = 0;
  const visit = value => {
    if (value === undefined) return { v: 'undefined' };
    if (value === null) return { v: 'null' };
    if (typeof value !== 'object') return value;
    const next = ++id;
    return Array.isArray(value) ? { a: value.map(visit), id: next } : { o: Object.entries(value).map(([k, v]) => ({ k, v: visit(v) })), id: next };
  };
  return visit(value);
}
const encodedState = record => {
  const exported = state();
  exported.origins[0].indexedDB[0].stores[0].records = [{ valueEncoded: encode(record) }];
  return exported;
};
const rejectsValue = exported => assert.throws(() => hasEncryptedDevice(exported), error => error.message === 'Secure local retention failed; further broadcasts are blocked.');

test('exact Playwright encoded undefined wallet passes owner predeploy, not wallet binding; raw state survives', async () => {
  const record = { ...device(), wallet: undefined, kitSavedAt: null, pastRecipients: [wallet] };
  const exported = encodedState(record), original = JSON.stringify(exported);
  assert.deepEqual(exported.origins[0].indexedDB[0].stores[0].records[0].valueEncoded.o.find(entry => entry.k === 'wallet'), { k: 'wallet', v: { v: 'undefined' } });
  assert.equal(hasEncryptedDevice(exported, { owner }), true);
  assert.equal(hasEncryptedDevice(exported, { owner, wallet }), false);
  const f = await fixture(), retention = await createLiveRetention(f.opts);
  try {
    await retention.retainCredentials(credentials);
    await retention.guardWrite(context(exported), { owner, wallet, deploy: true });
    const saved = JSON.parse(await readFile(join(f.cwd, '.sepolia-runs', f.opts.runId, 'browser-state-0.json'), 'utf8'));
    assert.deepEqual(saved, exported);
    assert.equal(JSON.stringify(exported), original);
    await rejectsSafe(retention.guardWrite(context(exported), { owner, wallet }));
    await retention.snapshot(context(exported), { owner, requireDevice: true });
  } finally { await retention.close(); }
  const bound = encodedState({ ...record, wallet });
  const g = await fixture(), boundRetention = await createLiveRetention(g.opts);
  try {
    await boundRetention.retainCredentials(credentials);
    await boundRetention.guardWrite(context(bound), { owner, wallet });
  } finally { await boundRetention.close(); }
  const absent = device(); delete absent.wallet;
  assert.equal(hasEncryptedDevice(encodedState(absent), { owner }), true);
  assert.equal(hasEncryptedDevice(encodedState(absent), { owner, wallet }), false);
});

test('optional deploymentBlock accepts only canonical uint64 metadata in plain and exact encoded devices; snapshots stay raw', async () => {
  const cases = [
    ['absent', {}, true],
    ['undefined', { deploymentBlock: undefined }, true],
    ['zero', { deploymentBlock: '0' }, true],
    ['ordinary block', { deploymentBlock: '12345678' }, true],
    ['uint64 maximum', { deploymentBlock: '18446744073709551615' }, true],
    ['leading zero', { deploymentBlock: '01' }, false],
    ['double zero', { deploymentBlock: '00' }, false],
    ['negative', { deploymentBlock: '-1' }, false],
    ['number', { deploymentBlock: 1 }, false],
    ['oversize', { deploymentBlock: '1'.repeat(21) }, false],
    ['uint64 overflow', { deploymentBlock: '18446744073709551616' }, false],
    ['empty', { deploymentBlock: '' }, false],
    ['null', { deploymentBlock: null }, false],
    ['boolean', { deploymentBlock: true }, false],
    ['decimal', { deploymentBlock: '1.0' }, false],
    ['whitespace', { deploymentBlock: ' 1' }, false],
    ['trailing newline', { deploymentBlock: '1\n' }, false],
    ['unknown field', { deploymentBlock: '1', unexpected: undefined }, false],
    ['owner key', { deploymentBlock: '1', ownerSeed: 'synthetic-not-a-seed' }, false],
    ['bad envelope', { deploymentBlock: '1', envelope: { ...device().envelope, seed: 'synthetic-not-a-seed' } }, false],
  ];
  for (const [representation, exportState] of [['plain', state], ['encoded', encodedState]]) {
    for (const [name, fields, accepted] of cases) {
      const exported = exportState({ ...device(), ...fields });
      if (accepted) assert.equal(hasEncryptedDevice(exported, { owner, wallet }), true, `${representation}: ${name}`);
      else rejectsValue(exported);
    }
  }
  const undefinedEntry = encodedState({ ...device(), deploymentBlock: undefined }).origins[0].indexedDB[0].stores[0].records[0].valueEncoded.o.find(entry => entry.k === 'deploymentBlock');
  assert.deepEqual(undefinedEntry, { k: 'deploymentBlock', v: { v: 'undefined' } });
  const f = await fixture(), retention = await createLiveRetention(f.opts);
  try {
    await retention.retainCredentials(credentials);
    for (const [slot, exported] of [state({ ...device(), deploymentBlock: '12345678' }), encodedState({ ...device(), deploymentBlock: '18446744073709551615' })].entries()) {
      const original = JSON.stringify(exported);
      await retention.guardWrite(context(exported), { owner, wallet });
      const saved = await readFile(join(f.cwd, '.sepolia-runs', f.opts.runId, `browser-state-${slot}.json`), 'utf8');
      assert.equal(saved, original);
      assert.equal(JSON.stringify(exported), original);
    }
  } finally { await retention.close(); }
});

test('encoded unknown plaintext, ambiguous both representations and missing representations fail closed', () => {
  rejectsValue(encodedState({ ...device(), mnemonic: 'synthetic-not-a-seed' }));
  rejectsValue(encodedState({ ...device(), envelope: { ...device().envelope, seed: 'synthetic-not-a-seed' } }));
  for (const value of [device(), undefined, null]) {
    const exported = encodedState(device());
    exported.origins[0].indexedDB[0].stores[0].records[0].value = value;
    rejectsValue(exported);
  }
  const missing = state(); missing.origins[0].indexedDB[0].stores[0].records = [{}]; rejectsValue(missing);
});

test('unsupported encoded forms, malformed entries, duplicate keys/ids and dangerous keys fail closed', () => {
  const invalid = [undefined, null, [], {}, { ref: 1 }, { d: 'synthetic-date' }, { ab: { b: 'AA==' } }, { ta: { b: 'AA==', k: 'ui8' } }, { s: ['string'], id: 1 }, { s: 'string' }, { n: 1 }, { b: true }, { v: 'NaN' }, { v: 'Infinity' }, { v: '-0' }, { v: 'undefined', extra: 1 }, { bi: '1' }, { m: [], id: 1 }, { a: [], id: 1 }, Infinity, -0, { o: [], id: 0 }, { o: [], id: 1.5 }, { o: [], id: '1' }];
  for (const value of invalid) {
    const exported = encodedState(device());
    exported.origins[0].indexedDB[0].stores[0].records[0].valueEncoded.o.find(entry => entry.k === 'createdAt').v = value;
    rejectsValue(exported);
  }
  for (const key of ['owner', '__proto__', 'prototype', 'constructor']) {
    const exported = encodedState(device());
    exported.origins[0].indexedDB[0].stores[0].records[0].valueEncoded.o.push({ k: key, v: 'synthetic' });
    rejectsValue(exported);
  }
  for (const mutation of [
    root => { root.o[0].extra = 1; },
    root => { delete root.o[0].k; },
    root => { root.o[0].k = 123; },
    root => { root.o[0].v = { o: [], id: root.id }; },
    root => { root.o[0].v = root; },
    root => { root.o.push(root.o[0]); },
    root => { root.o[0].v = Object.create({ ref: 1 }); },
    root => { Object.defineProperty(root.o[0], 'v', { get() { throw new Error('must-not-invoke'); } }); },
    root => { root.o[0].v = { v: 'null', [Symbol('unsupported')]: true }; },
  ]) {
    const exported = encodedState(device()); mutation(exported.origins[0].indexedDB[0].stores[0].records[0].valueEncoded); rejectsValue(exported);
  }
});

test('encoded node, depth, entry, string and aggregate character limits fail closed', () => {
  const invalidRecords = [
    { ...device(), createdAt: 'x'.repeat(8193) },
    { ...device(), pastRecipients: Array(65).fill('synthetic') },
    { ...device(), pastRecipients: Array(5).fill('x'.repeat(8192)) },
    { ...device(), createdAt: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, 'synthetic'])) },
    { ...device(), createdAt: Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`k${i}`, { a: 'synthetic', b: 'synthetic' }])) },
    { ...device(), createdAt: Array.from({ length: 10 }).reduce(value => ({ nested: value }), 'synthetic') },
    { ...device(), pastRecipients: [123] },
  ];
  for (const record of invalidRecords) rejectsValue(encodedState(record));
  const exported = encodedState(device()), root = exported.origins[0].indexedDB[0].stores[0].records[0].valueEncoded;
  root.o.length = 65; rejectsValue(exported);
});

test('encoded envelopes preserve KDF, byte lengths and owner/wallet matching checks', () => {
  assert.equal(hasEncryptedDevice(encodedState(device()), { owner: owner.toUpperCase(), wallet: wallet.toUpperCase() }), true);
  assert.equal(hasEncryptedDevice(encodedState(device()), { owner: wallet }), false);
  for (const envelope of [
    { ...device().envelope, kdf: { ...device().envelope.kdf, iterations: 1 } },
    { ...device().envelope, kdf: { ...device().envelope.kdf, extra: true } },
    { ...device().envelope, salt: Buffer.alloc(15).toString('base64url') },
    { ...device().envelope, iv: Buffer.alloc(13).toString('base64url') },
    { ...device().envelope, ciphertext: Buffer.alloc(15).toString('base64url') },
    { ...device().envelope, ciphertext: 'bad!' },
  ]) rejectsValue(encodedState({ ...device(), envelope }));
});

test('both live harness sources retain at deploy interception, after creation, and finally before close', async () => {
  for (const name of ['sepolia-service.mjs', 'sepolia-compound.mjs']) {
    const source = await readFile(new URL(name, import.meta.url), 'utf8');
    assert.ok(source.includes("assert.equal(process.env.ALLOW_SEPOLIA_LOCAL_RETENTION, 'yes')"));
    assert.ok(source.includes('await retention.guardWrite(walletContext'));
    assert.ok(source.includes('await retention.retainCredentials({ devicePassphrase, cardWords: words })'));
    assert.ok(source.includes('wallet: evidence.wallet, requireDevice: true'));
    assert.ok(source.indexOf('await retention.snapshot(walletContext') < source.indexOf('await browser.close()'));
    assert.ok(!source.includes('void browser?.close()'));
  }
});
