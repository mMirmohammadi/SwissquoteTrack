# Compound deployment completion review

## Result

The second Compound attempt passed the deployment event and sponsor assertions. Its recorded failure is the UI error-count assertion immediately afterward, not strict event decoding. The public artifact does not identify which UI operation produced the error. Static source inspection proves a missing receipt-to-registration freshness barrier and a separate missing UI recovery state after registration failure; neither is proven to be this run's underlying error.

Scope: source/public JSON only; no execution, network, browser, keys, private retention files, runtime inspection, or Git. No assertions were changed. This review is bounded to deployment completion, not Compound acceptance.

## Exact failure localization

The [second public result](<../../AgentsLocal/46257332/v3/sepolia-compound-2.json#L19-L33>) records a successful deploy receipt. More decisively, it contains [`relayer`](<../../AgentsLocal/46257332/v3/sepolia-compound-2.json#L58>). That field is assigned only at [Compound harness:268](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L263-L269>), after strict ProxyCreation proxy/singleton checks, owner/wallet sender exclusion, and expected RELAYER equality. Thus all those checks completed under the inspected harness.

The next statement invokes `idle()` then waits for “Verified as yours.” [idle:219](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L219-L220>) waits for `.status.info` to disappear and asserts `.status.error` count equals zero. The public blocker is `contract_or_configuration_assertion`, which the [catch:444](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L440-L445>) emits for `ERR_ASSERTION`; a Playwright timeout would instead produce `bounded_browser_timeout`. Therefore the failing assertion is the error count in `idle()`, assuming no code/artifact version skew. The assertion category does not mean the application error itself was a contract assertion: the harness converts any visible application error into its own assertion failure.

P0 does **not** have a weaker idle check: [P0:177](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L177-L178>) also asserts zero `.status.error` elements. Its deployment flow uses the same ProxyCreation checks and post-deploy idle/verified wait at [P0:221–226](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L221-L226>).

## Proven source defects, with limits

### Registration is not bounded by the mined deployment block

[App:279–282](<../../swissquote-wallet/apps/wallet/src/App.tsx#L279-L282>) confirms the deployment, persists the wallet binding, then calls ownership registration. [App:192–197](<../../swissquote-wallet/apps/wallet/src/App.tsx#L192-L197>) uses the browser chain receipt. [browser chain:34–37](<../../swissquote-wallet/apps/wallet/src/chain.ts#L34-L37>) stores its block only in the browser module's `confirmedBlock`.

That minimum never reaches the service registration API. [lifecycle:22–24](<../../swissquote-wallet/apps/wallet/src/lifecycle.ts#L22-L24>) sends a challenge and ownership proof without a receipt hash/block. [service adapter:35,64–65](<../../swissquote-wallet/services/swissquote/src/chain.ts#L35-L65>) verifies wallet rules through a separate history RPC fallback and EIP-1271 through the ordinary public RPC fallback; neither waits for deployment block or shares a pinned head between the two checks.

[wallet verification:42–55](<../../swissquote-wallet/packages/protocol/src/verification.ts#L42-L55>) independently selects `options.blockNumber ?? await client.getBlockNumber()` and rejects when proxy code is absent at that head. It catches errors into a negative verification result at [107–108](<../../swissquote-wallet/packages/protocol/src/verification.ts#L107-L108>). [service app:239–240](<../../swissquote-wallet/services/swissquote/src/app.ts#L239-L240>) maps that result to “Wallet rules do not match template”; [ownership verification:62–63](<../../swissquote-wallet/packages/protocol/src/signing.ts#L62-L63>) likewise turns an RPC read failure into false.

**Established defect:** a genuine deployment confirmed in the browser can be checked by a service history node at a pre-deployment head and be rejected as a template mismatch. The service has no receipt-derived lower bound/common-head barrier. **Not established for this attempt:** that a service node actually lagged, which verification failed, or whether a transport/history/API timeout instead caused the UI error.

The service sender queue does not fix this: [service app:40–50,62–69](<../../swissquote-wallet/services/swissquote/src/app.ts#L40-L69>) serializes broadcasts and settles the sender latch on a receipt. Registration at [239–240](<../../swissquote-wallet/services/swissquote/src/app.ts#L239-L240>) does not run through that queue or consume its receipt block. Existing browser recovery checks do explicitly wait for confirmedBlock and choose a shared minimum at [chain:70–80](<../../swissquote-wallet/apps/wallet/src/chain.ts#L70-L80>), but those are not the service registration checks.

### Failed registration does not publish the already-deployed wallet to current UI state

[App:281–286](<../../swissquote-wallet/apps/wallet/src/App.tsx#L281-L286>) calls `bindWallet` before ownership registration, but sets React device/wallet/setup state only **after** registration succeeds. [storage:51–52](<../../swissquote-wallet/apps/wallet/src/storage.ts#L51-L52>) proves the binding is persisted first. If registration throws, the action exits through [run:80–89](<../../swissquote-wallet/apps/wallet/src/App.tsx#L80-L89>), producing `.status.error`, without executing `setWallet(predicted)`.

For a fresh wallet, `wallet` remains unset; [refresh:93–94](<../../swissquote-wallet/apps/wallet/src/App.tsx#L92-L105>) returns early. The intended “Wallet deployed, ownership registration incomplete” retry panel requires `wallet && device?.setupCode && !verified` at [App:447](<../../swissquote-wallet/apps/wallet/src/App.tsx#L447>), so that recovery panel is not available in the current fresh-wallet render. Persisted state can be loaded on a later session effect, but that does not repair the immediate failure presentation. This is a proven conditional UI defect, not proof that registration threw during this run.

## Other paths are not equivalent explanations

Background chain refresh catches into `pollError`, rendered as `.status.warning`, not `.status.error`: [App:123–125,429](<../../swissquote-wallet/apps/wallet/src/App.tsx#L123-L125>) and [render:429](<../../swissquote-wallet/apps/wallet/src/App.tsx#L429>). The ownership lookup effect only changes `verified` on failure at [145–155](<../../swissquote-wallet/apps/wallet/src/App.tsx#L145-L155>); a lookup race alone can explain a missing verified badge, not this error-count assertion. Session initialization errors can set `.status.error` at [133–142](<../../swissquote-wallet/apps/wallet/src/App.tsx#L133-L142>), so the artifact cannot identify registration as the only producer.

Registration does not invoke USDC freeze screening: [service app:214–246](<../../swissquote-wallet/services/swissquote/src/app.ts#L214-L246>). Deployment screening occurs before broadcast at [77–82](<../../swissquote-wallet/services/swissquote/src/app.ts#L77-L82>). No source-backed reason connects a legitimate token freeze to this post-deployment error. The general API has a fixed 30-second timeout at [api:6,22](<../../swissquote-wallet/apps/wallet/src/api.ts#L6-L22>), which can also become `.status.error`; whether it fired is unknown.

## Safe diagnostic recommendation

Do not deploy again or relax idle/event/sponsor assertions. Before any future authorized run, split local stages before creation-event assertion, sponsor assertion, UI idle, verified-badge wait, and retention binding. Immediately before idle's error-count assertion, classify the local UI error using a fixed allowlist of known application literals (for example `wallet_rules_verification_refused`, `ownership_proof_refused`, `service_timeout`, `other_ui_error`) and record only the locally defined label/count. Never publish raw UI messages, RPC/service bodies, proofs, storage, or credentials. A timeout label alone must not imply a new deployment is safe: this wallet is already mined.

Any later repair should preserve fail-closed validation while adding receipt-derived freshness for registration and exposing the persisted deployed/unregistered wallet in the UI before fallible registration. This review proposes those changes; it does not implement or execute them.
