// v3 local defaults must never attach Node integration tests to the running v2 services.
export const SQ_URL = import.meta.env?.VITE_SQ_URL || 'http://localhost:4101';
export const PARTNER_URL = import.meta.env?.VITE_PARTNER_URL || 'http://localhost:4102';
export class ServiceError extends Error { constructor(message: string, public status: number) { super(message); this.name = 'ServiceError'; } }
export async function call<T>(path: string, options: { body?: unknown; token?: string; partner?: boolean; method?: string } = {}): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${options.partner ? PARTNER_URL : SQ_URL}${path}`, {
      method: options.method || (options.body === undefined ? 'GET' : 'POST'),
      headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal,
    });
    const text = await response.text(); let data: unknown;
    try { data = text ? JSON.parse(text) : {}; } catch { throw new ServiceError('The service returned an unreadable response.', response.status); }
    if (!response.ok) {
      const error = data && typeof data === 'object' && 'error' in data ? String(data.error) : `Service request failed (${response.status}).`;
      throw new ServiceError(error, response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The service timed out. The transaction may still be pending; refresh chain status before retrying.');
    throw new Error('Cannot reach the service. Check that the local Swissquote and partner services are running.');
  } finally { clearTimeout(timeout); }
}
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'The action failed. No successful transaction was confirmed.';
  if (message.includes('GS026')) return 'Blocked: this old device no longer controls the wallet (GS026).';
  if (message.includes('NotAllowedError')) return 'Passkey confirmation was cancelled or timed out. Nothing was signed.';
  return message;
}
