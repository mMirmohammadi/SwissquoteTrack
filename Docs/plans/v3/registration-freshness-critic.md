# Registration freshness critic — bounded review

## Decision

Approve the persisted-but-unregistered UI correction and a fail-closed service freshness barrier in principle, **not the plan unchanged**. Freshness is a demonstrated conditional defect, not the diagnosed cause of the Compound refusal. Add small, safe failure classification and bounded RPC pacing; do not expand contracts, ownership proofs, sender controls, or RPC source lists.

This review inspected public source and the supplied audit document only. No commands, tests, runtime, network, private files, chain writes, or Git changes were performed. Only this new document was written; existing source and RPC-source counts remain unchanged. The user's bounded 1 USDC Compound approval does not authorize new EIP/contract control or execution by this review.

## What the evidence establishes

The [audit follow-up](<../../research/v3-compound-registration-audit-followup.md#L5-L7>) records a `/wallets` rules-verification refusal and a later strict verification result of `ok: true`, `reasons: []`, `nonce: 0`. That proves current rules passed when reconstructed from public deployment calldata. It does not prove transport failure, rate limiting, or stale heads caused the earlier refusal.

The [service adapter](<../../../swissquote-wallet/services/swissquote/src/chain.ts#L32-L35>) creates a public fallback client and, on production Sepolia, a separate history fallback client. These are **two client roles**, not two independently verified nodes. One fallback client can change endpoint between head and state/log reads. The [adapter](<../../../swissquote-wallet/services/swissquote/src/chain.ts#L64-L65>) discards verifier reasons and verifies EIP-1271 separately at an unpinned head. The [handler](<../../../swissquote-wallet/services/swissquote/src/app.ts#L238-L245>) therefore cannot distinguish a rule mismatch from an RPC refusal.

The [core verifier](<../../../swissquote-wallet/packages/protocol/src/verification.ts#L80-L107>) requires code absence at the selected history start when that start is positive; an archive `getCode` failure refuses verification. The default Sepolia start is fixed at 11,886,000, with genesis used below that head or on another chain. Ordinary advancing heads do not move that Sepolia start. A chain crossing the threshold changes the default from genesis to the fixed start, and any wallet already present at that start is intentionally refused. A deployment receipt must **not** become `fromBlock`: choosing creation itself fails the absence check, and choosing a later start loses lifetime coverage. Current strict success does not justify weakening this invariant.

Even nonce zero scans module execution history. The [chunk reader](<../../../swissquote-wallet/packages/protocol/src/verification.ts#L26-L33>) sends consecutive requests with no pacing. Service HTTP transports have timeouts/retries but no pacing. In contrast, the [recovery tool](<../../../swissquote-wallet/apps/recovery-tool/src/core.ts#L12-L47>) already spaces actual per-endpoint HTTP attempts by 150 ms, includes retry attempts, and checks aborts before starting queued work. A freshness barrier does not repair this traffic difference; fast history scans can still encounter provider limits.

## Exact risks and minimum corrections

### Receipt minimum is an untrusted lower bound

Keep the optional decimal `minimumBlockNumber` and strict validation proposed in the [plan](<registration-freshness-fix-plan.md#L13-L30>). Read it from the original top-level body even when decoded setup replaces `input`. It must only require `selectedBlock >= minimum`; it must not choose an old snapshot, prove deployment, authorize ownership, truncate history, or relax template checks. Validate before bigint conversion and before RPC work. Keep the proposed 64-block ahead bound explicitly an implementation bound requiring approval, not a safety theorem or diagnosed node lag. Absent minimum still needs an uncached service-selected head; receipt evidence is not retained across reload/retry in this scope.

### Common number is not necessarily a common block

Select the lower uncached head of the two client roles, check their returned chain IDs, and require both to reach the minimum. Do not call this independent consensus. Preserve the same-client path and production endpoint lists; add only a test injection for the history role.

At the selected number, compare non-null block hashes from both roles before verification and recheck that number after verification, before persistence. Disagreement, a missing hash, or an observed hash change must refuse with a safe retryable error. Keep all current-state checks and EIP-1271 at that number; historical absence remains at the history start and logs cover the unchanged lifetime range.

Pre/post hash checks detect observable disagreement and reorgs, but number-pinned reads through a switching fallback cannot provide cryptographic snapshot consistency against every between-read switch or ABA reorg. State this residual limit; do not claim EIP-1898 hash-pinning or new independent-node verification exists. A full hash-addressed verifier redesign is outside this patch.

### Deadline must fence persistence, not merely the response

The proposed 25-second deadline needs to start before registration RPC work, including deterministic address computation, not only at freshness polling. One absolute monotonic deadline covers compute, heads, polling, hash checks, rules, proof, and final store check. If the barrier consumes 20 seconds, only five remain for all verification: this may safely refuse valid wallets and must not be advertised as a reliable success budget without mocked coverage of the normal full scan.

Do not race a promise containing `store.put` against a timer: that can return 503 and later write `verified:true`. Race read stages only; after every await and immediately before the synchronous transaction, assert the request is still active and within deadline. Expiry permanently closes that request. Preserve the existing concurrent-store owner/setup check. Observe late rejections, stop polling and queued fetch starts, and bound underlying HTTP attempts/retry/fallback traversal. A finite HTTP timeout alone does not bound an entire serial fallback chain. No timeout may clear sender reservations, infer non-broadcast, bypass proof/rules, or trigger cancellation. User device unlock remains explicit and unchanged.

### Classify the failure without exposing RPC text

The existing protocol reasons can contain arbitrary provider messages; do not publish or log them. Smallest useful change: a request-local read wrapper records the operation/stage of **terminal thrown RPC actions** before the verifier converts them to `false`; classify a false result with such a terminal read failure as `registration_rpc_unavailable` (503). A false result without an observed terminal RPC failure remains `registration_rules_refused` (403); unclassified cases must remain explicitly unknown, not inferred as rate limits. Use the same safe treatment for EIP-1271 transport failure versus invalid magic value/signature. Freshness/hash/deadline failures get fixed allowlisted categories. Do not classify by substring-matching uncontrolled error text, log proofs, or use mutable adapter-global last-error state across concurrent requests. A typed optional observer is an alternative only if integration approves that tiny interface change; a new diagnostic subsystem is unnecessary.

### Reuse bounded pacing, not a new retry architecture

Port/reuse the existing small `pacedFetch` algorithm at the service's existing Sepolia read HTTP transports without depending on a recovery-tool application package. Space actual endpoint fetch attempts, including viem retries; use the existing 150 ms behavior as the candidate baseline. Preserve local no-delay behavior, existing source lists/order, and finite retry counts. Deduplicate queues by endpoint when the public/history roles share a URL; otherwise simultaneous role queues can burst the same provider. Queue state may be endpoint-local, but classification and request deadline must remain request-local. Queued expired work must never start; a hanging earlier request must remain transport-bounded. Do not pace or modify wallet send/simulation/gas paths as part of this registration correction. No extra provider, retry-until-success loop, shortened history, or verification bypass is needed.

### Publish deployment before fallible registration

The [creation flow](<../../../swissquote-wallet/apps/wallet/src/App.tsx#L279-L286>) already persists `bound` before registration, but publishes the current device/wallet only afterward. Move current-state publication directly after successful `bindWallet`, before requesting registration. Keep encrypted owner material and setup, mark ownership and independent checks false, clear stale review, and retain the existing retry UI on refusal. Never redeploy on retry or set verified from a receipt. The [ownership GET effect](<../../../swissquote-wallet/apps/wallet/src/App.tsx#L145-L156>) can finish after explicit registration success and overwrite it; invalidate only stale lookup generations, with wallet/session/owner matching intact. Do not remove independent public checks or alter Protection ordering. Existing retry can perform an explicit owner-signed protective cancellation when requests are pending; this fact must not be obscured by calling the complete retry action read-only, nor should a new cancellation be added to creation.

### Compatibility is behavioral, not a fixture bypass

An optional request field and optional proof-read options preserve old call sites. A required `ChainAdapter.registrationBlock` does not preserve adapter fixture compatibility: update every affected typed registration double, including security tests outside the service directory. A missing capability must yield a controlled fail-closed response, never default silently to latest or block zero. Existing non-registration verification callers must retain their behavior. Receipt success fixtures need real nonnegative bigint blocks; do not weaken receipt checks to accommodate undefined fixtures.

## Minimum acceptance tests after implementation approval

- Freshness: separate roles return public heads 101/103 and history heads 99/102 with minimum 100; no rules/proof reads before catch-up, then state and EIP-1271 at 102. Exercise same-client/no-minimum paths, uncached heads, chain mismatch, malformed minimum, decoded-setup forwarding, and ahead-bound boundaries. Verify earlier supplied minimum never forces an earlier snapshot.
- Hash/reorg: equal selected-height hashes pass; initial disagreement, absent hash, and post-verification changed hash refuse before storage. Assert these tests do not claim adversarial fallback snapshot guarantees.
- Deadline: controlled clock, stuck head/RPC, serial fallback/retries, pacing-queue expiry, late successful verification, and late rejection. Expiry from compute through final persistence cannot restart the budget or later write verified state/respond success. Observe zero chain writes, simulations, estimates, sender unlocks, and automatic cancellations.
- Classification/pacing: terminal archive read failure versus invalid owners/code/history versus invalid EIP-1271 magic and proof RPC failure produce fixed correct categories; injected arbitrary RPC text/proof remains absent from output/logs. Concurrency has no diagnostic leakage. Actual fetch starts, retry spacing, shared-URL roles, queue rejection recovery, abort while waiting, finite attempts, and local no-delay behavior are observed with fake fetch/clock rather than real RPC.
- History: preserve current absence-at-start, wallet-existing-at-start rejection, archive-error rejection, all chunk boundaries, nonce-zero module scans, incomplete transaction history, and forbidden operation tests. A later head does not narrow lifetime coverage; never pass receipt minimum as `fromBlock`.
- UI: confirmed creation followed by refused registration leaves both persisted/current wallet bound, verified/deposit disabled, encrypted unlock usable, and retry visible without deployment. Include locked retry, successful retry, a late pre-registration GET failure after success, wallet/session change, and existing Protection/public-check ordering. Use a component behavior test, not source-order matching alone.
- Compatibility: update all affected service/security mocks, retain unpinned proof callers, and verify existing receipt-validation fixtures. Check endpoint lists/order and source counts unchanged; no dependencies or contract/EIP/control changes.

Stop at this bounded correction and approved local evidence. The original refusal cause remains unknown until safely classified evidence exists; no funding or Compound execution is authorized by this document.
