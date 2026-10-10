import { AsyncLocalStorage } from 'node:async_hooks';
import { HttpRequestError, TimeoutError, type PublicClient } from 'viem';
import { ApiError } from './policy.ts';

export const REGISTRATION_DEADLINE_MS = 25_000;
export const REGISTRATION_BARRIER_MS = 20_000;
export const REGISTRATION_POLL_MS = 500;
export const REGISTRATION_MAX_AHEAD = 64n;
export interface RegistrationClock { now(): number; sleep(ms: number): Promise<void> }
const defaultClock: RegistrationClock = { now: () => performance.now(), sleep: ms => new Promise(resolve => setTimeout(resolve, ms)) };
interface ReadContext { clock: RegistrationClock; deadline: number; controller: AbortController; closed: boolean; transportFailure: boolean; recheck?: () => Promise<void> }
const contexts = new AsyncLocalStorage<ReadContext>();
export class RegistrationError extends ApiError {
  constructor(status: number, message: string, public registrationCode: string) { super(status, message); }
}
export function registrationUnavailable(code = 'registration_rpc_unavailable'): RegistrationError {
  return new RegistrationError(503, 'Wallet registration temporarily unavailable; retry with a fresh challenge', code);
}
export function parseMinimumBlock(value: unknown): bigint | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 20 || !/^(0|[1-9][0-9]*)$/.test(value)) throw new ApiError(400, 'Invalid minimumBlockNumber');
  const minimum = BigInt(value);
  if (minimum > (1n << 64n) - 1n) throw new ApiError(400, 'Invalid minimumBlockNumber');
  return minimum;
}
export function registrationContext() { return contexts.getStore(); }
export function assertRegistrationActive(): void {
  const context = contexts.getStore();
  if (!context) return;
  if (context.closed || context.clock.now() >= context.deadline) {
    context.closed = true; context.controller.abort(); throw registrationUnavailable('registration_deadline');
  }
}
export async function withRegistrationReads<T>(fn: () => Promise<T>, clock: RegistrationClock = defaultClock): Promise<T> {
  const context: ReadContext = { clock, deadline: clock.now() + REGISTRATION_DEADLINE_MS, controller: new AbortController(), closed: false, transportFailure: false };
  return contexts.run(context, async () => {
    try { return await fn(); } finally { context.closed = true; context.controller.abort(); }
  });
}
/** Race read stages only. The caller must fence its synchronous store transaction. */
export async function registrationRead<T>(fn: () => Promise<T>, readDeadline?: number): Promise<T> {
  assertRegistrationActive();
  const context = contexts.getStore();
  if (!context) return fn();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([Promise.resolve().then(fn), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { context.closed = true; context.controller.abort(); reject(registrationUnavailable('registration_deadline')); }, Math.max(0, Math.min(context.deadline, readDeadline ?? context.deadline) - context.clock.now()));
    })]);
    assertRegistrationActive(); return result;
  } finally { if (timer) clearTimeout(timer); }
}
function demonstrableTransportFailure(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error instanceof Error && !seen.has(error)) {
    if (error instanceof HttpRequestError || error instanceof TimeoutError) return true;
    seen.add(error); error = error.cause;
  }
  return false;
}
/** Request-local terminal-action observer; never publishes provider error messages. */
export function registrationClient(client: PublicClient): PublicClient {
  return new Proxy(client, { get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => registrationRead(async () => {
      try { return await value.apply(target, args); } catch (error) {
        const context = contexts.getStore();
        if (context && demonstrableTransportFailure(error)) context.transportFailure = true;
        throw error;
      }
    });
  } });
}
export async function classifiedRegistrationRead<T>(fn: () => Promise<T>): Promise<T> {
  const context = contexts.getStore();
  if (context) context.transportFailure = false;
  const result = await registrationRead(fn);
  if (context?.transportFailure) throw registrationUnavailable();
  return result;
}
export function setRegistrationRecheck(fn: () => Promise<void>): void {
  const context = contexts.getStore();
  if (context) context.recheck = fn;
}
export async function recheckRegistrationBlock(): Promise<void> {
  await registrationRead(async () => { await contexts.getStore()?.recheck?.(); });
  assertRegistrationActive();
}
/** Endpoint-local queues shared by both read roles. Actual attempts, including retries, are paced. */
export function pacedFetch(fetchFn: typeof fetch, clock: RegistrationClock = defaultClock): typeof fetch {
  let tail: Promise<void> = Promise.resolve(); let lastStart = -Infinity;
  return (input, init) => {
    const context = contexts.getStore();
    const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = context ? AbortSignal.any([context.controller.signal, ...(originalSignal ? [originalSignal] : [])]) : originalSignal;
    const request = tail.then(async () => {
      signal?.throwIfAborted(); assertRegistrationActive();
      let remaining = 150 - (clock.now() - lastStart);
      while (remaining > 0) { await clock.sleep(remaining); signal?.throwIfAborted(); assertRegistrationActive(); remaining = 150 - (clock.now() - lastStart); }
      lastStart = clock.now();
      return fetchFn(input, { ...init, signal });
    });
    tail = request.then(() => undefined, () => undefined);
    // Abort a waiter immediately; still observe its queued promise when the tail settles.
    if (!signal) return request;
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason ?? new Error('Read aborted'));
      if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
    });
    return Promise.race([request, aborted]).finally(() => { if (onAbort) signal.removeEventListener('abort', onAbort); });
  };
}
