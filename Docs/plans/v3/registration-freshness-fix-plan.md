# Registration freshness fix — approval gate

## Decision

Recommend forwarding the confirmed browser deployment block to registration, then making the service select one fresh common block for wallet-rule verification and EIP-1271. Publish the persisted deployed wallet to the UI before fallible registration, without marking it verified. This is a plan only: no implementation, execution, network, Git, keys, or private-file inspection occurred.

The source proves conditional freshness and UI-recovery defects. It does **not** prove why the recorded Compound attempt failed. Evidence: [completion review](<../../research/v3-compound-deployment-completion-review.md#L17-L35>).

## Proposed frozen interfaces — parent approval required

Paths below are relative to `swissquote-wallet/` in this worktree. These are proposed changes, not approved contracts.

- `packages/protocol/src/api.ts`: extend `RegisterWalletRequest` with `minimumBlockNumber?: string`. It is a freshness hint, not proof of deployment, ownership, or authorization. Keep the proof message and immutable setup unchanged.
- `services/swissquote/src/types.ts`: add required `registrationBlock(minimumBlockNumber?: bigint): Promise<bigint>` to `ChainAdapter`; extend `verifyOwnership(wallet: Address, message: string, signature: Hex, options?: { blockNumber?: bigint }): Promise<boolean>`. Required barrier capability must fail closed if absent; update every registration test double instead of silently bypassing it.
- `packages/protocol/src/signing.ts`: extend `verifyOwnershipProof(client: PublicClient, wallet: Address, hash: Hex, signature: Hex, options: { blockNumber?: bigint } = {}): Promise<boolean>`, forwarding the block to `readContract`. Existing callers retain default behavior.
- `apps/wallet/src/chain.ts`: make `confirmedOn(...)` and `confirmed(...)` return `Promise<bigint>` after their existing strict receipt checks; retain the confirmed-block callback and module-local tracking.
- `apps/wallet/src/App.tsx`: make `confirmedAction(...)` return the confirmed block; creation captures that return, not a service-submitted status or a guessed head.
- `apps/wallet/src/lifecycle.ts`: append `minimumBlockNumber?: bigint` to `registerDeviceOwnership(...)`; serialize only a supplied nonnegative block as decimal text in the registration body. No seed or additional secret crosses the API.

`VerificationOptions.blockNumber` already exists and pins wallet state, dependencies, and history. Do not redesign wallet verification or alter history coverage.

## Service behavior and security bounds

`services/swissquote/src/app.ts` validates an optional minimum before conversion: string only; canonical unsigned decimal (`0` or nonzero digit followed by digits); at most 20 digits; at most `2^64 - 1`. Reject numbers, signs, whitespace, exponent/hex forms, leading zeros, negatives, and oversized strings with HTTP 400. Validation also applies to setup-code registration: spreading decoded setup must not accidentally drop the top-level minimum.

`services/swissquote/src/chain.ts` obtains uncached heads (`getBlockNumber({ cacheTime: 0 })`) from the public and history clients, verifies both clients' configured chain IDs, and selects `min(publicHead, historyHead)`. If both are the same injected client, one head read is sufficient; this is a freshness barrier, not a new independent-consensus claim. Separate-client tests need a small `historyClient?: PublicClient` injection in `ViemChainOptions`, with production defaults unchanged.

Proposed maximum-ahead bound: reject a requested minimum more than **64 blocks above the initially observed common head**, with HTTP 400 and no polling. This limits arbitrary far-future requests; it does not promise that a legitimate node lag of 64 blocks will resolve. Parent owns approval of this exact number.

For a permissible minimum, poll both heads at most every 500 ms until the common head is at least the minimum. Without a supplied minimum, select a fresh common head immediately; never pin to a caller's older minimum. Pass the returned block to **both** `verifyWallet(originalSetup, { expectedCurrentOwner, blockNumber })` and `verifyOwnership(..., { blockNumber })`. Keep proof challenge, owner expectation, immutable setup, history validation, and concurrent-store recheck unchanged.

Proposed time bounds: freshness polling has a 20-second limit, with an absolute 25-second service registration deadline covering barrier plus both verification reads; this leaves margin under the existing 30-second browser HTTP timeout. Each RPC invocation must be bounded by the remaining deadline, including transport retries/fallback traversal. A loop-time check alone is insufficient because an awaited RPC can hang beyond it. A timeout wrapper must prohibit subsequent verification/store writes; late promise completion cannot persist `verified:true`. Bound underlying transport retries/timeouts as well so abandoned requests cannot accumulate indefinitely. Use HTTP 503 with a fixed safe retry message on head/RPC/deadline failure; no raw RPC response or proof logging. No test should use real 20-second sleeps.

Registration and freshness must invoke **zero chain writes**, zero relay/simulation/gas-estimation calls, and no sender-queue changes. Existing explicit protective cancellation in `registerExistingWallet` is outside registration itself; do not describe that existing UI action as read-only or add a cancellation to creation.

## UI ordering and existing race protection

After a successful confirmed deployment receipt, build setup code and await `bindWallet`. Immediately publish `setDevice(bound)`, `setWallet(predicted)`, `setSetupCode(code)`, and the known card guardian; reset `verified`, independent-check state, and stale review state. Only then call registration with the receipt block. On failure, retain the bound wallet and encrypted key so the existing retry/unlock UI works without another deployment. Set `verified:true` only from validated registration success. Funding/deposit eligibility continues to require true ownership verification and existing independent checks.

Keep creation-state publication **before** registration. Do not move publication back afterward to avoid a lookup race: that recreates the demonstrated recovery defect and the earlier Protection ordering problem. The ownership GET effect at `App.tsx:145–156` can also finish after explicit registration; a component regression must exercise delayed pre-registration GET failure after registration succeeds. If that proves a stale-result overwrite, parent must approve a minimal request-generation invalidation at registration success, not a new state architecture. Preserve Protection's current registration-error handling and service-independent public checks; do not make those checks depend on successful registration.

The proposed optional minimum fixes the automatic fresh creation request. A reload/retry without it still selects a fresh common service head but does not retain receipt-derived lower-bound evidence across sessions. Persisting new device fields or finding deployment transactions for all restored wallets is intentionally excluded from this smallest patch; if durable receipt-minimum recovery is required, parent must separately freeze that requirement.

## Concrete ownership

Parent owns interface approval, integration, and this gate. No contributor edits shared interfaces before approval.

| Owner after approval | Files |
| --- | --- |
| Parent / integration | `packages/protocol/src/api.ts`, `services/swissquote/src/types.ts`, `packages/protocol/src/signing.ts`; freeze shared signatures and deadline/error contract first |
| Service implementer | `services/swissquote/src/chain.ts`, `services/swissquote/src/app.ts`, `services/swissquote/test/chain.test.ts`, `services/swissquote/test/interface.test.ts`; update affected service registration doubles |
| Wallet implementer | `apps/wallet/src/chain.ts`, `apps/wallet/src/lifecycle.ts`, `apps/wallet/src/App.tsx`, `apps/wallet/test/sepolia-receipt.test.ts`, `apps/wallet/test/lifecycle.test.ts`; minimal component regression adjacent to existing wallet tests |
| Parent / acceptance | Review diff and authorize local tests later; no browser launch, network, or chain transaction authorized by this plan |

## Meaningful acceptance evidence after approval

- Chain mock: public heads 101 then 103, history heads 99 then 102, requested minimum 100. No wallet/EIP-1271 read before both catch up; selected common block 102; every verification/state/history read and EIP-1271 read is pinned to 102. Capture calls and `cacheTime:0`, not source regexes. Also test same-client path and no-minimum path.
- Deadline tests with controlled clock/scheduler: permanently lagging head, slow/hanging RPC, chain mismatch, max-ahead boundary and boundary+1, transport failure, and verification completion after deadline. No verified record or later success response; no send/simulate/estimate calls. Ensure total deadline is not restarted between stages.
- HTTP tests with real handler and fake chain: canonical string parsing; malformed/oversized minimum rejected; same returned block passed to both methods; missing barrier fails closed; wallet-rule failure, invalid ownership proof, barrier failure, replayed challenge, immutable setup, and owner-change race still refuse. Withdrawal remains blocked after failed first registration.
- Protocol mock: EIP-1271 gets the selected block; wrong magic value and RPC failure still return false; existing unpinned callers remain compatible.
- Wallet receipt/lifecycle tests: receipt block returned only after success checks; exact decimal minimum reaches `/wallets`; no private material appears in request; fresh challenge on retry. Update success fixtures to include valid `blockNumber` rather than accepting an undefined block.
- Wallet component test: confirmed creation then rejected registration leaves current/persisted wallet bound, retry available, unlock usable, verified badge/deposit disabled; retry does not redeploy. Exercise locked retry, successful retry, delayed ownership GET failure, and Protection/public-check ordering. Do not accept a source-order assertion as sole behavioral evidence.

Stop after this bounded patch and authorized local tests pass. Do not relax browser idle/event/sponsor assertions, add automatic deployment retries, introduce chain writes, or assert that the original failure cause has been diagnosed.
