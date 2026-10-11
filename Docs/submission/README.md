# Swissquote Wallet — judge guide

**FINAL V4 acceptance:** `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. This includes the seven added MOCK bank-return shortcut regressions (567 Node/browser + 42 contracts). It supersedes the earlier 602-test baseline below. G1 public-browser recovery separately passed across retained sessions, not one uninterrupted take. No production audit, hardware proof or publication is implied.

**Your key pays; your Recovery Card plus one helper can bring you back.** Swissquote holds no ordinary spending key. The unlocked owner key can spend immediately, and the app publisher remains trusted.

## CURRENT V4 acceptance

The isolated, **uncommitted V4 candidate** passed `bash-1996`, exit 0: **602 passed, zero skipped, 417.0 seconds**, typecheck/build passed. Inventory: 560 Node/browser + 42 contracts (historical frozen 591 + 8 launcher + 3 UI); browser 34 includes local real-180-second recovery. [Durable acceptance](<../plans/v4/acceptance.md>). Frozen v3 remains clean at `cb7297a`. No production audit or acceptance of further proposed UI is implied. **G1 public-browser recovery PASSED:** the same wallet completed creation, payment, card+partner recovery and replacement-owner payment across encrypted retained browser sessions after timeouts—not one uninterrupted take. Finalization/new payment used normal unlock on one page; virtual WebAuthn and MOCK identity remain limits. See [completed evidence](<claims.md#g1-public-browser-recovery--completed-across-retained-sessions>).

## Start with the bounded proof

| Claim | Evidence | Boundary |
| --- | --- | --- |
| Zero-ETH 1-USDC payment, Swissquote service pays gas | [Public browser/service payment](<../research/v3-live-payment-evidence.md>) | Virtual WebAuthn; MOCK bank/KYC, not physical biometric evidence |
| One 1-USDC Compound III supply, approval reset to zero | [Public browser/service supply](<../research/v3-live-compound-evidence.md>) | Second wallet, third-party test deployment; no withdrawal/swap |
| Card+partner recovery at same address, old key refused | [Completed public G1](<claims.md#g1-public-browser-recovery--completed-across-retained-sessions>); [local browser recovery](<claims.md#bounded-local-browser-recovery-acceptance>) | G1 public browser recovery completed across retained sessions; old-key refusal read-only; older scripted/local evidence remains separate |
| Both helpers without card cannot recover | [Initializer](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>); [scripted no-card checks](<claims.md>) | Two separate modules, card+partner and card+Swissquote; expected configuration and recorded read-only checks, not arbitrary-wallet assurance |
| Kit can exit without helper-service calls | [Scripted RPC-only 3-USDC sweep](<claims.md>) | FUNDER paid gas. Desk exports/checks key, not the sweep broadcaster; no service-shutdown drill or all-token exit |
| Current isolated V4 candidate passes its gate | [V4 acceptance](<../plans/v4/acceptance.md>) | **602 tests, zero skips**, typecheck/build passed; uncommitted candidate, not a production audit. [Historical v3: 591](<../plans/v3/compound-acceptance.md>) remains separate |

The script artifact has 23 successful records including 11 mined transactions, not 23 transactions. TREASURY paid its ordinary transactions, not the service RELAYER. [Exact ledger](<claims.md>) preserves receipt values and historical/local distinctions. Full three-day public module-B completion, public-browser large/admin step-up and broader DeFi execution are not confirmed.

## Real, MOCK and proposed

The Safe/Candide contract checks, browser key encryption, WebAuthn service verification, live public sanctions-oracle/USDC blacklist reads and linked public transactions are real. Bank account/KYC/funding provenance, face/video checks, mailbox, demo sanctions entries and SQLite helper vaults are MOCK. Local DemoUSDC is a fixture. Independent publisher governance, production HSMs, legal approval, inheritance, integrated Bitcoin/Solana and production delays are proposals or out of scope.

[Architecture](<architecture.md>) separates components from evidence. [Threat model](<threat-model.md>) explains unlocked-key theft, publisher compromise, card+fooled-helper takeover, cancellation races and lockout. [Legal position](<custody-travel-rule.md>) states an argument plus regulatory risks, not approval; [business case](<business-case.md>) labels unconfirmed retention inputs as hypothetical.

## Run and review

Use the [prototype run guide](<../../swissquote-wallet/README.md>) and [root overview](<../../README.md>). Commands and launcher defaults were read, not clean-clone rehearsed by this docs lane. Do not run against a shared chain or public network without the execution owner's approval. The [implementation handoff](<IMPLEMENTATION.md>) lists exact checks and pending inputs.

The [submission text](<SUBMISSION.md>), [bonus details](<bonus.md>), [draft terms](<terms-sheet.md>) and [AI disclosure](<ai-tools.md>) are review-ready patches. Human names/tools, video, screenshots, public URLs and repository visibility remain pending. Historical review reports are not current sign-off; no publish/upload/submit/commit/push occurred here.
