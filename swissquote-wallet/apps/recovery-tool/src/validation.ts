export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}
export function parseJson(text: string): Record<string, unknown> {
  if (text.length > 100_000) throw new Error('File is too large.');
  try { return object(JSON.parse(text)); } catch { throw new Error('Invalid JSON kit file.'); }
}
export function validateCodeInput(value: string): string {
  const code = value.trim();
  if (!code || code.length > 16_000 || !/^[A-Za-z0-9_-]+$/.test(code)) throw new Error('Paste a valid copy-paste code, not a link or JSON.');
  return code;
}
export function normalizeWords(value: string): string {
  const words = value.normalize('NFKD').trim().toLowerCase().split(/\s+/);
  if (words.length !== 12 || words.some(word => !/^[a-z]+$/.test(word))) throw new Error('Enter the 12 recovery-card words. Do not enter your wallet seed.');
  return words.join(' ');
}
export function pinnedRpcUrls(chainId: number, configured: string | undefined, publicUrls: readonly string[]): string[] {
  if (chainId === 11155111) return [...publicUrls.slice(0, 2)];
  if (chainId !== 31337) throw new Error('Unsupported chain.');
  const urls = (configured ?? 'http://127.0.0.1:8545,http://localhost:8545').split(',').map(value => value.trim());
  if (urls.length !== 2 || new Set(urls).size !== 2) throw new Error('Configure two distinct local RPC URLs.');
  for (const value of urls) {
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Local RPCs must be loopback HTTP URLs without credentials.');
  }
  return urls;
}
export function sameAddress(a: string, b: string): boolean { return a.toLowerCase() === b.toLowerCase(); }
