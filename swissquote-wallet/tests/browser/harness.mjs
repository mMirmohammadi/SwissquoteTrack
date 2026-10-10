import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const toolHtml = process.env.BROWSER_TOOL_HTML || `${root}apps/recovery-tool/dist/index.html`;
export const walletUrl = process.env.BROWSER_WALLET_URL || 'http://localhost:5173';
export const toolUrl = process.env.BROWSER_TOOL_URL || 'http://localhost:5174';
export function assertLocalUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Browser verification accepts loopback HTTP servers only');
  }
  return url;
}
export async function probeUrl(value) {
  assertLocalUrl(value);
  try {
    const response = await fetch(value, { signal: AbortSignal.timeout(1500), redirect: 'error' });
    return { ok: response.ok, status: response.status };
  } catch { return { ok: false, status: null }; }
}
export async function browserAvailability() {
  let playwright;
  try { playwright = await import('playwright'); }
  catch { return { ok: false, reason: 'playwright is not installed in the browser test package; root owner must install workspace dependencies' }; }
  const executable = process.env.BROWSER_EXECUTABLE || playwright.chromium.executablePath();
  try { await access(executable, constants.X_OK); }
  catch { return { ok: false, reason: 'Chromium executable is unavailable; lead must supply an installed BROWSER_EXECUTABLE or browser installation', executable }; }
  return { ok: true, playwright, executable };
}
export async function persistenceSnapshot(page) {
  return page.evaluate(async () => {
    const databases = [];
    for (const descriptor of await indexedDB.databases()) {
      if (!descriptor.name) continue;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(descriptor.name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const stores = [];
        for (const name of db.objectStoreNames) {
          const values = await new Promise((resolve, reject) => {
            const request = db.transaction(name, 'readonly').objectStore(name).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          stores.push({ name, values });
        }
        databases.push({ name: descriptor.name, stores });
      } finally { db.close(); }
    }
    return {
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
      databases,
      caches: typeof caches === 'undefined' ? [] : await caches.keys(),
    };
  });
}
export function containsSecret(snapshot, secrets) {
  const encoded = JSON.stringify(snapshot).toLowerCase();
  return secrets.some(secret => secret && encoded.includes(secret.toLowerCase()));
}
export async function virtualAuthenticator(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}
