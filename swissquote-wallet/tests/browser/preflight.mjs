import { access } from 'node:fs/promises';
import { browserAvailability, probeUrl, toolHtml, walletUrl, toolUrl } from './harness.mjs';
const browser = await browserAvailability();
console.log(JSON.stringify({ browser: { ok: browser.ok, reason: browser.reason, executable: browser.executable } }));
for (const url of [walletUrl, toolUrl]) console.log(JSON.stringify({ url, ...await probeUrl(url) }));
try { await access(toolHtml); console.log(JSON.stringify({ portableHtml: toolHtml, available: true })); }
catch { console.log(JSON.stringify({ portableHtml: toolHtml, available: false })); }
if (!browser.ok) process.exitCode = 1;
