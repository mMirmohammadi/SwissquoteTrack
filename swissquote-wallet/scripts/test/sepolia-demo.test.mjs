import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sepoliaLaunchConfig, sepoliaChildEnv, prepareSepoliaData } from '../../sepolia-demo.mjs';

// No servers, RPCs, funded keys or deletion. Fixtures use exclusive directories.
const scratch = () => mkdtempSync(path.join(tmpdir(), 'sq-launcher-test-'));
const launcher = fileURLToPath(new URL('../../sepolia-demo.mjs', import.meta.url));

test('default launches remain fresh; deliberate DEMO_RUN_ID restarts reuse paths', () => {
  const first = sepoliaLaunchConfig({}, '/isolated');
  const second = sepoliaLaunchConfig({}, '/isolated');
  assert.notEqual(first.dataDir, second.dataDir);
  assert.match(path.basename(first.dataDir), /^[a-f0-9-]{36}$/);
  const inherited = { DEMO_RUN_ID: 'rehearsal-11_A', MOCK_ACCOUNT_START_USDC: '8' };
  const a = sepoliaLaunchConfig(inherited, '/isolated');
  const b = sepoliaLaunchConfig(inherited, '/isolated');
  assert.equal(a.dataDir, '/isolated/.sepolia-runs/rehearsal-11_A');
  assert.equal(a.dataDir, b.dataDir);
  assert.equal(a.env.SQ_DATA_DIR, b.env.SQ_DATA_DIR);
  assert.equal(a.env.PARTNER_DATA_DIR, b.env.PARTNER_DATA_DIR);
  assert.equal(a.env.MOCK_ACCOUNT_START_USDC, '8');
  assert.equal(a.env.DEMO_RUN_ID, undefined);
  assert.equal(path.basename(sepoliaLaunchConfig(inherited, '/isolated', 'explicit').dataDir), 'explicit');
});

test('run IDs are strictly bounded path components and rejected values are not logged', () => {
  for (const id of ['', '.', '..', '../outside', '/outside', 'a/b', 'a\\b', ' run', 'run ', 'a.b', 'a\n', 'a\0', 'é', '-run', '_run', 'a'.repeat(65), 1, null]) {
    assert.throws(() => sepoliaLaunchConfig({ DEMO_RUN_ID: id }, '/isolated', id), { message: 'Invalid Sepolia run ID' });
  }
  assert.equal(path.basename(sepoliaLaunchConfig({ DEMO_RUN_ID: 'a'.repeat(64) }, '/isolated').dataDir).length, 64);
});

test('unknown inherited secrets, VITE variables and execution hooks never reach children', () => {
  const { env } = sepoliaLaunchConfig({
    PATH: '/usr/bin', HOME: '/home/test', SQ_FEATURES: 'audit', MOCK_ACCOUNT_START_USDC: '8',
    RELAYER_PRIVATE_KEY: 'TEST DOUBLE', EXTRA_PRIVATE_KEY: 'TEST DOUBLE',
    VITE_API_TOKEN: 'TEST DOUBLE', VITE_RELAYER_PRIVATE_KEY: 'TEST DOUBLE',
    API_TOKEN: 'TEST DOUBLE', AWS_SECRET_ACCESS_KEY: 'TEST DOUBLE', NODE_OPTIONS: '--require unsafe',
    MAINNET_RPC_URLS: 'https://example.invalid/?token=TEST_DOUBLE', SIMULATION_RPC_URLS: 'https://simulation.invalid/',
  }, '/isolated', 'safe-run');
  for (const name of ['RELAYER_PRIVATE_KEY', 'EXTRA_PRIVATE_KEY', 'VITE_API_TOKEN', 'VITE_RELAYER_PRIVATE_KEY', 'API_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'NODE_OPTIONS']) assert.equal(env[name], undefined);
  for (const label of ['Partner', 'Wallet', 'Recovery tool']) {
    const child = sepoliaChildEnv(label, env, { RELAYER_PRIVATE_KEY: 'TEST DOUBLE', SQ_ACCOUNT_PRIVATE_KEY: 'TEST DOUBLE' });
    assert.equal(child.PATH, '/usr/bin');
    assert.equal(child.RELAYER_PRIVATE_KEY, undefined);
    assert.equal(child.SQ_ACCOUNT_PRIVATE_KEY, undefined);
    assert.equal(child.MAINNET_RPC_URLS, undefined);
    assert.equal(child.SIMULATION_RPC_URLS, undefined);
    assert.equal(child.MOCK_ACCOUNT_START_USDC, undefined);
  }
  const sq = sepoliaChildEnv('Swissquote', env, { RELAYER_PRIVATE_KEY: 'TEST DOUBLE', SQ_ACCOUNT_PRIVATE_KEY: 'TEST DOUBLE', OTHER_TOKEN: 'TEST DOUBLE' });
  assert.equal(sq.RELAYER_PRIVATE_KEY, 'TEST DOUBLE');
  assert.equal(sq.SQ_ACCOUNT_PRIVATE_KEY, 'TEST DOUBLE');
  assert.equal(sq.OTHER_TOKEN, undefined);
  assert.equal(sq.MOCK_ACCOUNT_START_USDC, '8');
  assert.equal(sq.MAINNET_RPC_URLS, 'https://example.invalid/?token=TEST_DOUBLE');
  assert.throws(() => sepoliaChildEnv('Unknown', env), /Unknown/);
});

test('child allowlists retain fixed public Vite settings and partner-only settings', () => {
  const { env } = sepoliaLaunchConfig({ VITE_SQ_URL: 'https://unsafe.invalid', VITE_FEATURES: 'none' }, '/isolated', 'unit-run');
  const wallet = sepoliaChildEnv('Wallet', env);
  const desk = sepoliaChildEnv('Recovery tool', env);
  assert.deepEqual(wallet, desk);
  assert.equal(wallet.VITE_SQ_URL, 'http://localhost:4101');
  assert.equal(wallet.VITE_CHAIN, 'sepolia');
  assert.match(wallet.VITE_FEATURES, /dapps,audit/);
  const partner = sepoliaChildEnv('Partner', env);
  assert.equal(partner.PARTNER_PORT, '4102');
  assert.equal(partner.PARTNER_DATA_DIR, '/isolated/.sepolia-runs/unit-run/partner');
  assert.equal(partner.RPC_URLS, env.RPC_URLS);
  assert.equal(partner.VITE_CHAIN, undefined);
  assert.equal(partner.SQ_DATA_DIR, undefined);
});

test('restart directory preparation preserves both service stores and creates private folders', () => {
  const root = scratch();
  const config = sepoliaLaunchConfig({ DEMO_RUN_ID: 'persisted' }, root);
  prepareSepoliaData(config, root);
  for (const dir of [config.dataDir, config.env.SQ_DATA_DIR, config.env.PARTNER_DATA_DIR]) assert.equal(statSync(dir).mode & 0o777, 0o700);
  for (const dir of [config.env.SQ_DATA_DIR, config.env.PARTNER_DATA_DIR]) writeFileSync(path.join(dir, 'store-marker'), 'existing service data');
  prepareSepoliaData(sepoliaLaunchConfig({ DEMO_RUN_ID: 'persisted' }, root), root);
  for (const dir of [config.env.SQ_DATA_DIR, config.env.PARTNER_DATA_DIR]) assert.equal(readFileSync(path.join(dir, 'store-marker'), 'utf8'), 'existing service data');
});

test('persisted base, run and service symlinks fail closed without writes to targets', () => {
  for (const component of ['base', 'run', 'swissquote', 'partner']) {
    const root = scratch(), target = scratch();
    const config = sepoliaLaunchConfig({}, root, 'run');
    const base = path.join(root, '.sepolia-runs');
    if (component !== 'base') mkdirSync(base);
    if (component === 'swissquote' || component === 'partner') mkdirSync(config.dataDir);
    const link = component === 'base' ? base : component === 'run' ? config.dataDir : config.env[component === 'swissquote' ? 'SQ_DATA_DIR' : 'PARTNER_DATA_DIR'];
    symlinkSync(target, link, 'dir');
    assert.throws(() => prepareSepoliaData(config, root), /not a symlink/);
    assert.deepEqual(readdirSync(target), []);
  }
});

test('tampered data paths and regular-file directories are rejected without deleting files', () => {
  const root = scratch();
  const config = sepoliaLaunchConfig({}, root, 'run');
  assert.throws(() => prepareSepoliaData({ ...config, dataDir: path.join(root, 'outside') }, root), /Invalid Sepolia data/);
  assert.deepEqual(readdirSync(root), []);
  const base = path.join(root, '.sepolia-runs');
  writeFileSync(base, 'keep me');
  assert.throws(() => prepareSepoliaData(config, root), /directory/);
  assert.equal(readFileSync(base, 'utf8'), 'keep me');
});

test('import is inert even with invalid launcher configuration and missing keys', () => {
  const root = scratch();
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../../sepolia-demo.mjs', import.meta.url).href)}); console.log('import-safe');`], {
    cwd: root, encoding: 'utf8', timeout: 5000,
    env: { PATH: process.env.PATH, DEMO_RUN_ID: '../invalid', PARTNER_DEMO_FOOLED: 'true' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'import-safe');
  assert.equal(result.stderr, '');
  assert.deepEqual(readdirSync(root), []);
  assert.ok(path.isAbsolute(launcher));
});
