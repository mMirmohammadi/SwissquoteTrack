import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const names = ['README.md','INTERFACES.md','threat-model.md','custody-travel-rule.md','business-case.md','bonus.md','ai-tools.md','demo-script.md','architecture.md','IMPLEMENTATION.md'];
const files = names.map(n => resolve(import.meta.dirname,n)).concat(resolve(root,'swissquote-wallet/README.md'));
let localLinks = 0;
for (const file of files) {
  const text = readFileSync(file,'utf8');
  assert(text.startsWith('# '), `Missing document heading: ${file}`);
  for (const match of text.matchAll(/\]\(<([^>]+)>\)/g)) {
    const destination = match[1].split('#')[0];
    if (!destination || /^https?:/.test(destination)) continue;
    assert(existsSync(resolve(dirname(file),destination)), `Broken link in ${file}: ${destination}`);
    localLinks++;
  }
}
const business = readFileSync(resolve(import.meta.dirname,'business-case.md'),'utf8');
assert(business.includes('every input is an assumption'));
assert.equal(10_000*2_000*0.005,100_000);
assert.equal(10_000*0.2*3*12,72_000);
assert.equal(10_000*24*0.10,24_000);
assert.equal(100_000+72_000-24_000,148_000);
const candidate = JSON.parse(readFileSync(resolve(import.meta.dirname,'architecture.candidate.json'),'utf8'));
const ids = new Set(candidate.components.map(n=>n.id));
for (const c of candidate.connections) assert(ids.has(c.from)&&ids.has(c.to));
const pkg = JSON.parse(readFileSync(resolve(root,'swissquote-wallet/package.json'),'utf8'));
for (const script of ['dev:all','devnet','story','typecheck','build','test','test:contracts']) assert(pkg.scripts[script], `Missing run script ${script}`);
console.log(`PASS: ${files.length} documents; ${localLinks} local links; assumed economics arithmetic; diagram endpoint integrity; documented root scripts.`);
console.log('This is a documentation check, not a wallet runtime, legal, browser, or chain test.');
