import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const [file = 'dist/index.html', expectedFile = 'tool-fingerprint.sha256'] = process.argv.slice(2);
const expected = (await readFile(resolve(expectedFile), 'utf8')).trim().split(/\s+/)[0];
if (!/^[a-f0-9]{64}$/.test(expected ?? '')) throw new Error('Expected fingerprint must be a SHA-256 hash.');
const actual = createHash('sha256').update(await readFile(resolve(file))).digest('hex');
if (actual !== expected) throw new Error(`Tool fingerprint mismatch: expected ${expected}, got ${actual}`);
console.log(`SHA-256 ${actual} matches the supplied reference. This is byte equality, not publisher authenticity or a security audit.`);
