import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const names = ['README.md', 'INTERFACES.md', 'claims.md', 'SUBMISSION.md', 'terms-sheet.md', 'threat-model.md', 'custody-travel-rule.md', 'business-case.md', 'bonus.md', 'ai-tools.md', 'demo-script.md', 'architecture.md', 'IMPLEMENTATION.md'];
let localLinks = 0;
for (const name of names) {
  const file = resolve(import.meta.dirname, name);
  const text = readFileSync(file, 'utf8');
  assert(text.startsWith('# '), `Missing document heading: ${name}`);
  for (const match of text.matchAll(/\]\(<([^>]+)>\)/g)) {
    const destination = match[1].split('#')[0];
    if (!destination || /^https?:/.test(destination)) continue;
    assert(existsSync(resolve(dirname(file), destination)), `Broken link in ${name}: ${destination}`);
    localLinks++;
  }
}
const business = readFileSync(resolve(import.meta.dirname, 'business-case.md'), 'utf8');
assert(business.includes('every input is an assumption except the cited account base'));
assert.equal(Math.round(4.90 * 12 * 100), 5880);
for (const [adoption, revenue] of [[0.005, 203103], [0.01, 406207], [0.02, 812414]]) {
  assert.equal(Math.round(690828 * adoption * 58.8), revenue);
  assert(business.includes(revenue.toLocaleString('en-US')));
}
const paymentCost = 101381 * 0.0655 * 1e-9 * 2506;
assert.equal(paymentCost.toFixed(4), '0.0166');
assert.equal((paymentCost * 24).toFixed(2), '0.40');
assert.equal(Math.round(101381 * 20 * 1e-9 * 2506 * 24), 122);
for (const name of ['README.md', 'SUBMISSION.md', 'claims.md']) {
  const text = readFileSync(resolve(import.meta.dirname, name), 'utf8');
  assert(/not confirmed|not observed|no confirmed|no observed/i.test(text), `Missing checkpoint caveat: ${name}`);
}
console.log(`PASS: ${names.length} documents; ${localLinks} existing local-link targets; subscription scenarios and labelled gas arithmetic.`);
console.log('Read-only documentation validation. Does not validate link anchors, external sources, legal conclusions, secrets, browser behavior, current gates or chain receipts.');
