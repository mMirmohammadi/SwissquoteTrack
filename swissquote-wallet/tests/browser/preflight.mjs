import { access } from 'node:fs/promises';
import { browserAvailability, probeUrl, toolHtml, walletUrl, toolUrl, sqUrl, partnerUrl } from './harness.mjs';
const browser = await browserAvailability();
console.log(JSON.stringify({ browser: { ok: browser.ok, reason: browser.reason, executable: browser.executable } }));
let ready = browser.ok;
for (const url of [walletUrl, toolUrl, new URL('/health', sqUrl).href, new URL('/health', partnerUrl).href]) {
  const result = await probeUrl(url);
  console.log(JSON.stringify({ url, ...result }));
  ready &&= result.ok;
}
try { await access(toolHtml); console.log(JSON.stringify({ portableHtml: toolHtml, available: true })); }
catch { ready = false; console.log(JSON.stringify({ portableHtml: toolHtml, available: false })); }
if (!browser.ok || (process.env.BROWSER_REQUIRED === '1' && !ready)) process.exitCode = 1;
