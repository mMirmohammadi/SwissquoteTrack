// Full verification must own its chain. No live-demo attachment or silent skips.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntime, root } from './v3-local.mjs';

export function nodeSummary(output) {
  const values = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...output.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`Missing or ambiguous Node test summary: ${key}`);
    values[key] = Number(matches[0][1]);
  }
  if (values.fail || values.cancelled || values.skipped || values.todo || values.tests !== values.pass) {
    throw new Error(`Tests not fully passed: ${JSON.stringify(values)}`);
  }
  return values;
}
export function contractSummary(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const matches = [...clean.matchAll(/^\s*(\d+) passing(?:\s|$)/gm)];
  if (matches.length !== 1) throw new Error('Missing or ambiguous contract test summary');
  if (/^\s*\d+ (?:pending|failing)(?:\s|$)/m.test(clean)) throw new Error('Contract tests report pending/skipped or failing cases');
  return { pass: Number(matches[0][1]), skipped: 0 };
}
async function testFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry.name)) result.push(...await testFiles(target));
    else if (/\.test\.(?:tsx?|mjs|js)$/.test(entry.name)) result.push(target);
  }
  return result.sort();
}
async function workspaceSuites() {
  const directories = ['scripts'];
  for (const group of ['apps', 'services', 'packages']) {
    for (const entry of await readdir(path.join(root, group), { withFileTypes: true })) {
      if (entry.isDirectory()) directories.push(path.join(group, entry.name));
    }
  }
  const suites = [];
  for (const directory of directories) {
    const manifest = JSON.parse(await readFile(path.join(root, directory, 'package.json'), 'utf8'));
    if (!manifest.scripts?.test) continue;
    const files = await testFiles(path.join(root, directory, 'test'));
    if (directory === 'apps/wallet') files.push(...await testFiles(path.join(root, directory, 'src/features')));
    if (!files.length) throw new Error(`No tests found for declared suite ${directory}`);
    suites.push({ label: directory, files });
  }
  // Explicitly include every browser test, even files missing from its package command.
  for (const directory of ['tests/browser', 'tests/protocol', 'tests/security', 'tests/integration']) {
    const files = await testFiles(path.join(root, directory));
    if (!files.length) throw new Error(`No tests found for required suite ${directory}`);
    suites.push({ label: directory, files });
  }
  return suites;
}
export async function gate() {
  // Independent source inventories: Docs/plans/v3/current-test-inventory.md and registration-test-inventory.md.
  // Verified baseline 480 + 38 source-counted registration/transport/activity regressions.
  const expected = Number(process.env.GATE_EXPECTED_TESTS ?? '519');
  if (!Number.isSafeInteger(expected) || expected < 519) throw new Error('GATE_EXPECTED_TESTS must be an approved integer >= 519');
  const started = Date.now();
  let runtime;
  let total = 0;
  try {
    runtime = await createRuntime();
    console.log(`Gate owns isolated ports 5273/5274/4101/4102/8645; retained run data: ${runtime.runDir}`);
    await runtime.run('Typecheck', 'pnpm', ['typecheck']);
    await runtime.run('Build', 'pnpm', ['build']);
    await runtime.startChain();
    await runtime.startApps();
    for (const suite of await workspaceSuites()) {
      console.log(`Gate suite: ${suite.label}`);
      const result = await runtime.run(suite.label, process.execPath, ['--import', 'tsx', '--test', ...(suite.label === 'apps/wallet' ? ['--experimental-test-module-mocks'] : []), ...(suite.label === 'tests/browser' ? ['--test-concurrency=1'] : []), '--test-reporter=tap', ...suite.files], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...runtime.env, SQ_FEATURES: '' } });
      const summary = nodeSummary(result.output);
      total += summary.pass;
      console.log(`Gate verified ${suite.label}: passed=${summary.pass}, skipped=${summary.skipped}`);
    }
    // Contract tests use Hardhat's separate in-process local chain (no public networks configured).
    // Natural interval mining belongs only to the owned browser RPC node.
    // Mocha creates a separate in-process chain and tests exact timestamp boundaries.
    const contractEnv = { ...runtime.env };
    delete contractEnv.V3_LOCAL_OWNED_RUN;
    const contracts = await runtime.run('Contract tests', 'npm', ['--prefix', 'contracts', 'test'], { stdio: ['ignore', 'pipe', 'pipe'], env: contractEnv });
    const summary = contractSummary(contracts.output);
    total += summary.pass;
    console.log(`Gate verified contracts: passed=${summary.pass}, skipped=${summary.skipped}`);
    if (total !== expected) throw new Error(`Gate test count mismatch: passed=${total}, approved expected=${expected}; update the approved count explicitly, never infer it from this run`);
    console.log(`GATE PASS: passed=${total}, skipped=0, duration=${((Date.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    if (runtime) await runtime.stop();
    console.log(`Gate stopped owned processes; verified passes before stopping=${total}; duration=${((Date.now() - started) / 1000).toFixed(1)}s. Incomplete suites are NOT zero-skips evidence.`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error('Gate accepts no CLI arguments; approved count uses GATE_EXPECTED_TESTS');
  try { await gate(); } catch (error) { console.error(`GATE FAIL: ${error.message}`); process.exitCode = 1; }
}
