import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_CASES, DEMO_SAFETY_NOTICE } from './model.ts';

test('helper-only and combined helpers never claim a completed recovery', () => {
  assert.match(DEMO_CASES[0].outcome, /Card approval missing/);
  assert.match(DEMO_CASES[1].outcome, /Card approval still missing/);
  assert.match(DEMO_CASES[2].outcome, /not a completed recovery/);
  assert.match(DEMO_CASES[2].explanation, /wallet, chain, module, replacement owner and nonce/);
});
test('read-only illustration explicitly separates explanation from contract evidence', () => {
  assert.match(DEMO_SAFETY_NOTICE, /no keys loaded/);
  assert.match(DEMO_SAFETY_NOTICE, /not evidence of a contract rejection/);
  const component = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /\b(fetch|signRecovery|privateKey|mnemonicToPrivateKey|relay|setDemoFooled)\s*\(/);
  assert.doesNotMatch(component, /context\.(mnemonic|device|session|clients|relay)/);
  assert.match(component, /replay has not been run/);
});
