# Swissquote service final fixes

## Result

The bounded service fixes are implemented. The final verification command and observed outcome appear below. Original CREATE2 setup evidence remains immutable; the separately authenticated current owner is persisted only after exact wallet-rule verification and a fresh issued ownership proof. No server restart, reset, browser pass, live transaction, dependency install, reviewer-test edit, shared API edit, or commit was performed.

## WebAuthn correction

[The production adapter](<../../swissquote-wallet/services/swissquote/src/webauthn.ts#L18>) now passes decoded transaction-hash bytes to SimpleWebAuthn 14.0.3 rather than the base64url text. The library therefore returns the exact intended challenge instead of encoding it again. Ordinary login authentication still lets the library generate random challenges. The service's exact transaction-hash challenge guard, issued-challenge expiry/consumption, credential-counter checks, and one-use step-up token remain unchanged.

[Verification error classification](<../../swissquote-wallet/services/swissquote/src/webauthn.ts#L8-L13>) applies only around passkey verification calls. Known assertion-validation errors become HTTP 403 with a fresh-challenge instruction. Existing ApiError status codes and unknown operational/configuration errors retain their original handling. This is not a blanket conversion of RPC or configuration failures into authentication refusals.

## Owner lifecycle and request integration

[POST /wallets](<../../swissquote-wallet/services/swissquote/src/app.ts#L138-L156>) accepts optional top-level `expectedCurrentOwner`. Keep the original setup code, initializer, original owner, guardians, salt, and deterministic wallet address unchanged after recovery or owner-authorized rotation. Obtain a new `/wallets/challenge` and submit the new current owner's valid EIP-1271 ownership proof with the explicit current-owner expectation. Missing the option defaults to a previously authenticated stored owner, or the original owner for a legacy/first link; it never discovers a replacement from RPC or login.

The exact verifier receives the immutable original setup plus `expectedCurrentOwner`, then the fresh issued proof is checked against the current wallet owner. Only after both checks pass does a SQLite transaction preserve the original setup and store `currentOwner`. A stale concurrent link update is refused rather than silently overwriting authenticated state. GET wallet responses report the stored authenticated current owner; [withdrawal rechecks](<../../swissquote-wallet/services/swissquote/src/app.ts#L159-L166>) independently pass that owner while preserving original setup evidence. Legacy rows fall back to their original owner.

[ChainAdapter.verifyWallet](<../../swissquote-wallet/services/swissquote/src/types.ts#L11-L15>) now takes optional shared `VerificationOptions`; [the production chain adapter](<../../swissquote-wallet/services/swissquote/src/chain.ts#L30>) forwards them into the actual protocol verifier while pinning `expectedWallet` to the setup's wallet.

The shared `RegisterWalletRequest` type was deliberately not edited because it belongs to the integration owner. That owner should add optional `expectedCurrentOwner?: Address` to the shared request type and have recovery/rotation callers supply it with a fresh new-owner proof. The service already accepts the field; existing callers remain compatible. This is a caller/type integration handoff, not evidence that the frontend already supplies it.

## Race protection retained

Deployment reservation still precedes the asynchronous relay and limits duplicate/concurrent broadcasts. Withdrawal still reserves balance atomically, restores definite preflight or budget refusals, and retains the debit after uncertain broadcast outcomes. Shared serialized account/global relay budgets and recovery-chain validation are unchanged. Reviewer concurrency, budget, definite-failure, uncertain-send, and chain-mismatch cases exercise these controls.

## Verification

Run from the wallet workspace:

`node --import tsx --test services/swissquote/test/*.test.ts tests/integration/owner-lifecycle.test.ts tests/security/service-adversarial.test.ts tests/integration/services.test.ts tests/integration/http-contract.test.ts && pnpm --filter @sq/swissquote typecheck`

Final command outcome: exit 0; 63 tests passed, 0 failed, 0 skipped, 0 cancelled. Test duration: 3697.694776 ms. Service typecheck (`tsc --noEmit`) passed in the same command. Coverage comprises 15 own service tests, 15 owner-lifecycle reviewer cases, 22 adversarial reviewer cases, and 11 HTTP-contract/orchestration cases (including their parent tests). An earlier run exposed a syntax typo in the newly added owned test; that typo was fixed, the focused test/typecheck passed, and the complete final command above was rerun successfully.

[Added owned regression tests](<../../swissquote-wallet/services/swissquote/test/final-fixes.test.ts>) exercise actual-library challenge byte preservation, ordinary-login randomness, refusal-versus-operational error classification, and actual production ChainAdapter option forwarding into the protocol verifier using saved pinned code bytes and a labelled RPC double.

The owner-lifecycle reviewer cases use actual HTTP/SQLite and real ownership-signing/verification helpers with labelled RPC state doubles. Positive recovery/rotation states therefore demonstrate service/protocol acceptance under injected chain state, not a live Sepolia recovery. The real WebAuthn reviewer case demonstrates actual-library options and malformed-assertion refusal, not a new hardware-passkey/browser success. No live broadcast or duplicate browser workflow was needed or claimed.

## Files changed by this final-fix task

Implementation lives in [app.ts](<../../swissquote-wallet/services/swissquote/src/app.ts>), [chain.ts](<../../swissquote-wallet/services/swissquote/src/chain.ts>), [types.ts](<../../swissquote-wallet/services/swissquote/src/types.ts>), and [webauthn.ts](<../../swissquote-wallet/services/swissquote/src/webauthn.ts>). Regression coverage is in [final-fixes.test.ts](<../../swissquote-wallet/services/swissquote/test/final-fixes.test.ts>). This report is the only documentation file owned by the task. Existing race fixes in those service files were preserved; the repository is an untracked shared build tree, so a tracked Git diff is not available as an attribution record.
