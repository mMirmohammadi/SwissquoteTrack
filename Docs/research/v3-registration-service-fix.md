# Registration service fix — implemented and scoped checks passing

The service now refuses registration unless it selects a fresh common block, verifies wallet rules and ownership at that block, and observes unchanged matching block hashes before persistence. The original Compound refusal remains undiagnosed; this patch does not authorize or perform a chain transaction.

## Changes

- [API contract](<../../swissquote-wallet/packages/protocol/src/api.ts>): added optional decimal `RegisterWalletRequest.minimumBlockNumber`.
- [Service interfaces](<../../swissquote-wallet/services/swissquote/src/types.ts>): required `registrationBlock(minimumBlockNumber?: bigint): Promise<bigint>`; appended optional `{ blockNumber?: bigint }` ownership-read options; added test clock injection to app options.
- [Protocol signing](<../../swissquote-wallet/packages/protocol/src/signing.ts>): appended default-compatible ownership-read options and forwarded them to EIP-1271 `readContract`.
- [Registration reads](<../../swissquote-wallet/services/swissquote/src/registration-reads.ts>): new dependency-free request-local context with monotonic absolute 25-second deadline, read-only promise races, abort signal, terminal typed transport observation, fixed safe refusal messages, and 150 ms actual-fetch pacing. Queued aborted attempts reject immediately and never start later. Late read resolution/rejection is observed and cannot perform a store write.
- [Chain adapter](<../../swissquote-wallet/services/swissquote/src/chain.ts>): uncached public/history heads and chain-ID checks; fresh minimum common head; maximum minimum request of initial common head + 64; 500 ms polling within 20 seconds and remaining absolute budget; matching non-null selected-height hashes before verification and after proof. Added optional history-client/clock injections. Registration-only Sepolia transports use URL-normalized shared endpoint queues, 12-second finite HTTP attempts, existing finite retry counts, and unchanged source lists/order. Original sender, fee, simulation, estimate and non-registration read transports remain untouched; local registration has no Sepolia pacing.
- [HTTP handler](<../../swissquote-wallet/services/swissquote/src/app.ts>): validates original top-level minimum before RPC even with decoded setup; requires canonical unsigned decimal, at most 20 digits and uint64. Deadline starts before compute. Required missing barrier fails closed. Selected block is passed to both rules and ownership reads, never `fromBlock`. Rechecks hash and activity before synchronous persistence, retaining immutable setup/current-owner concurrent-store checks.

Fixed service result categories are `registration_rpc_unavailable`, `registration_deadline`, `registration_chain_mismatch`, `registration_block_mismatch`, `registration_block_changed`, `registration_capability_missing`, `registration_rules_refused`, and `registration_proof_refused`. Observed terminal viem `HttpRequestError`/`TimeoutError` causes classify as transport unavailability. Arbitrary error text is never inspected or exposed; a verifier false result without demonstrable transport evidence remains the existing rules/proof 403 refusal. Classification state is request-local, not mutable adapter-global state.

## Scoped evidence

Final command from the wallet workspace:

`pnpm --filter @sq/swissquote typecheck && pnpm --filter @sq/protocol typecheck && node --import tsx --test services/swissquote/test/*.test.ts packages/protocol/test/registration-signing.test.ts`

Both typechecks passed. Final test run: **85 passed, 0 failed, 0 skipped**. Added **21 tests** across [freshness/deadline tests](<../../swissquote-wallet/services/swissquote/test/registration-freshness.test.ts>), [actual transport tests](<../../swissquote-wallet/services/swissquote/test/registration-transports.test.ts>), [proof classification test](<../../swissquote-wallet/services/swissquote/test/registration-proof.test.ts>), and [signing compatibility tests](<../../swissquote-wallet/packages/protocol/test/registration-signing.test.ts>).

New coverage observes separate roles at 101/99 then 103/102; pinned real protocol state/history/proof reads at 102; uncached heads; same-client/no-minimum/older-minimum behavior; ahead boundaries; invalid uint64 inputs before RPC; chain/hash disagreement and missing/reorg hashes; stuck lag; compute/rules/proof expiry; a handler timeout followed by late successful rules completion with no write; late rejection; missing capability and withdrawal refusal; preserved concurrent-store race refusal; safe transport-versus-template/proof classification and concurrent isolation; actual shared-URL retry pacing; queue abort/no late start; local no-delay behavior.

Updated only required-capability fixtures in [app tests](<../../swissquote-wallet/services/swissquote/test/app.test.ts>), [interface tests](<../../swissquote-wallet/services/swissquote/test/interface.test.ts>), [strict tests](<../../swissquote-wallet/services/swissquote/test/strict.test.ts>), [freeze-subject tests](<../../swissquote-wallet/services/swissquote/test/freeze-subjects.test.ts>), [local-screening tests](<../../swissquote-wallet/services/swissquote/test/local-screening.test.ts>), and [sender-safety tests](<../../swissquote-wallet/services/swissquote/test/sender-safety.test.ts>). Existing assertions were not weakened.

Intermediate failures: the first typecheck identified missing required barrier fixtures; those fixtures were updated. The first new transport test compared raw fetch URLs incorrectly (fetch normalized a trailing slash), then wrongly required the unused fallback endpoint to receive calls. Assertions now compare normalized URLs, require the shared primary endpoint's actual attempts, and preserve per-endpoint pacing checks. Final failures: none.

## Limits and parent handoff

Number-pinned reads through fallback clients plus pre/post hash checks detect observed disagreement/reorgs; they do not guarantee EIP-1898 hash-addressed consistency, independence of nodes, or protection against every between-read endpoint switch/ABA reorg. A large valid history scan may safely exhaust the deadline; only a small complete mocked scan was shown to succeed, not a live Sepolia latency guarantee.

Tests mocked RPC/fetch locally. No public RPC, keys/runtime/private files, browser, wallet source, protocol verifier source, security/integration/browser tests, Git operation, broadcast, funding, or Compound action was performed. Existing browser HTTP timeout was not changed. Global sender latch, authentication, screening/policy, cancellation and history-start rules were preserved.

Parent still owns security/integration fixture updates for the required capability, broader acceptance, and UI integration. Receipt minimum persistence across reload remains outside this patch. Injected adapters own the registration-block hash-barrier contract; production viem implements it, while incomplete/missing barriers never silently fall back to latest/block zero.
