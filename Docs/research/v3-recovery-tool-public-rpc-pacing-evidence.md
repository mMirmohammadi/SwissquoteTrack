# Public recovery tool: bounded Sepolia RPC pacing

The recovery tool now serializes HTTP fetch attempts per client and keeps their start times at least 150 ms apart on Sepolia. Both pinned RPC clients still run independently. Local-chain clients, including port 8645, have no pacing delay.

## Scope and mechanism

Only [core.ts](<../../swissquote-wallet/apps/recovery-tool/src/core.ts>) and the new [public-rpc-pacing.test.ts](<../../swissquote-wallet/apps/recovery-tool/test/public-rpc-pacing.test.ts>) were changed as source/test files. This document records the evidence. The requested production build regenerated the recovery tool's build output.

`pacedFetch(fetchFn: typeof fetch, clock): typeof fetch` wraps viem HTTP's `fetchFn`, not a higher-level viem action. Every actual HTTP attempt, including the single permitted retry, passes through that client's queue. The queue waits for the preceding fetch to settle and enforces a minimum start gap using a monotonic clock. A rejection settles the queue tail without hiding the rejection from the caller.

The existing `timeout: 12_000` and `retryCount: 1` remain. Viem's HTTP timeout includes time waiting in the fetch queue; the wrapper checks the attempt's abort signal before starting and after pacing sleep, so an expired queued attempt does not later send a request. JSON-RPC batching is explicitly disabled. There is no shared global queue or unlimited retry loop.

No verifier rules changed: the tool still requires two distinct pinned endpoints and preserves chain checks, bytecode pins, common-head/history validation, and independently supplied current-owner checks. No package configuration, protocol source, runtime process, Git state, keys, or live blockchain state were modified by this attempt. No service was started or stopped and no live RPC verification was run.

## Prior live evidence supplied by parent

Parent reported child `c610a84b` observed direct, unpaced `verifyWalletIndependent(HISTORY)` fail with Tenderly HTTP 429. The same exact pinned verification with 150 ms spacing per action passed in 5.516 s with nonce 0. This attempt did not independently reproduce that live result. That finding motivates the transport-level fix; it does not prove the new build's live behavior.

## Observed local acceptance

Run from the v3 wallet workspace:

- `pnpm --filter @sq/recovery-tool typecheck` passed with `tsc --noEmit`.
- `pnpm --filter @sq/recovery-tool build` passed, including the inline portable build. Vite reported a non-fatal existing `@scure/base` annotation warning.
- From the recovery-tool directory, `node --import tsx --test test/*.test.ts` passed all 26 tests, with no failures/cancellations/skips, in 1.915 s.
- `node --import tsx --test test/public-rpc-pacing.test.ts` passed all 8 pacing tests in 0.737 s. The tests use injected clock/sleep or Node fake timers; there are no real network calls or pacing waits.

The new tests establish serialization, endpoint independence, a 150 ms minimum actual start gap, no unnecessary delay after idle time, rejection propagation with queue continuation, expired-attempt suppression (including abort during sleep), actual viem HTTP retry pacing, persistent HTTP 429 failure after exactly one retry, unchanged timeout/retry settings and pinned endpoint selection, disabled batch request bodies, and undelayed local port 8645 requests. Existing wallet/approval/lifecycle tests still exercise pinned code, independent nodes, original CREATE2 identity, stale nonce, guardian checks, and current-owner refusal.

An initial test assumption incorrectly compared viem-normalized HTTP URLs with unnormalized URLs; another incorrectly expected all three public candidates rather than the selected pinned pair. Both assertions were corrected without changing production behavior.

## Remaining acceptance

The parent owns the live Sepolia stack and should repeat the exact pinned verification with the rebuilt public tool. This attempt intentionally leaves browser/live-chain acceptance to that owner; passing local tests is not a claim that rate limiting is eliminated at every provider.
