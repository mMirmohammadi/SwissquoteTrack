# Recovery tool handoff — lane D

## Result

The independent recovery tool builds and its automated checks pass. It generates and prints recovery cards, verifies wallet setup through two RPCs, checks and signs recovery requests, and decrypts emergency kits offline. The portable build is a single HTML page with executable code and styles inline.

This is a MOCK independent publisher, not an audited production security boundary. Browser click/print/download testing and a full deployed-chain demonstration remain unverified.

## Files and integration

Package: `@sq/recovery-tool`; run from the workspace with `pnpm --filter @sq/recovery-tool dev` or `preview` (localhost port 5174). Build with `pnpm --filter @sq/recovery-tool build`. Portable output: [index.html](swissquote-wallet/apps/recovery-tool/dist/index.html).

- [Core flows](swissquote-wallet/apps/recovery-tool/src/core.ts): `createCard`, `makeClients`, `checkWallet`, `reviewRecovery`, `approveRecovery`, `openEmergencyKit`; types `ToolConfig`, `RecoveryReview`.
- [Protocol adapter](swissquote-wallet/apps/recovery-tool/src/protocol.ts): consumes documented [protocol exports](swissquote-wallet/packages/protocol/EXPORTS.md), without duplicating cryptographic implementations.
- [Browser behavior](swissquote-wallet/apps/recovery-tool/src/main.ts) and [page](swissquote-wallet/apps/recovery-tool/index.html): four tools, explicit confirmation, print card with separate kit-code stub, sanitized portable download, reset clearing page secrets and invalidating pending results.
- [Portable build script](swissquote-wallet/apps/recovery-tool/scripts/inline.mjs) and [Vite configuration](swissquote-wallet/apps/recovery-tool/vite.config.ts): inline assets and HTTP anti-framing header.
- [Early integration handoff](swissquote-wallet/apps/recovery-tool/INTERFACES.md): package and integration boundary.

`ToolConfig` accepts `chainId` and optional `rpcUrls`. Defaults pin Sepolia chain 11155111 and the two protocol public RPC URLs. Production ignores custom RPC URLs. `VITE_CHAIN=local` selects chain 31337; `VITE_RPC_URLS` may name two distinct credential-free loopback HTTP endpoints. The local defaults reach one node under two URLs and are explicitly labelled as not independently operated.

No backend, helper keys, transaction sender, persistence or telemetry is included. The tool receives only the user's recovery-card words, public setup/request codes, encrypted kit and separate kit code. Card and kit operations do not make RPC calls.

## Security checks implemented

Wallet verification derives the guardian from the entered 12 words, rebuilds CREATE2 from pinned protocol components, and requires both protocol checks to succeed. The protocol checks owners, modules, guardian sets, thresholds, guard, pending recovery, bytecode and nonce-matched transaction history from block zero. Missing RPC/history evidence blocks verification; this can reduce availability on public providers with log-range limits.

Recovery review requires two distinct client objects, correct chain, pinned module code, deployed wallet, matching on-chain recovery hash, current nonce and card-guardian membership. Confirmation repeats these checks before EIP-712 signing and rejects a changed review. The page displays the wallet, replacement owner, module and four-word owner fingerprint. An approval is a code only; no transaction is sent.

Kit opening delegates authenticated ciphertext, metadata, KDF/checksum and owner binding checks to the protocol. It distinguishes the imported owner address from the fund-holding Safe, warns that obsolete kits cannot control a rotated owner, and explains the need for a funded gas payer. Offline opening cannot establish current on-chain ownership.

The HTTP dev/preview header is `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. The page meta CSP limits connections to pinned public/loopback RPCs and disables remote assets. `frame-ancestors` is intentionally not claimed for saved-file meta CSP: browsers require an HTTP header for that directive. A production static publisher must emit the header too.

Reset removes secrets from page state and invalidates in-flight results. JavaScript cannot guarantee physical memory erasure; clipboard history, print spoolers, browser extensions and compromised publisher/browser environments are outside this demo's guarantees. Portable download clears input/output secrets in its cloned DOM and resets navigation/buttons before serialization.

## Evidence

Final commands passed:

- `pnpm --filter @sq/recovery-tool typecheck`
- `pnpm --filter @sq/recovery-tool build`
- `pnpm --filter @sq/recovery-tool test` — 15 tests passed, zero failures.

Tests cover valid card derivation; malformed and oversized codes/JSON; wrong card word count and invalid BIP39; ciphertext and authenticated kit metadata tampering; wrong kit code and weakened KDF; RPC injection/credentials/duplicates; single-client/wrong-chain/unpinned-module rejection; recovery hash/nonce/guardian and confirmation tampering; exact CREATE2 setup reconstruction; tampered wallet/salt/guardian and disagreeing RPC state; portable inline code/styles and absence of persistence.

Test files: [validation](swissquote-wallet/apps/recovery-tool/test/validation.test.ts), [core](swissquote-wallet/apps/recovery-tool/test/core.test.ts), [approval](swissquote-wallet/apps/recovery-tool/test/approval.test.ts), [wallet](swissquote-wallet/apps/recovery-tool/test/wallet.test.ts), [portable](swissquote-wallet/apps/recovery-tool/test/portable.test.ts). Approval/wallet tests use the shared checked-in deployed bytecode fixture and mocked read-only clients; they are not a deployed-chain end-to-end test.

HTTP preview was started temporarily; a HEAD request to `http://127.0.0.1:5174/` returned 200 and the required anti-framing CSP header. The preview job was stopped and collected; the lead owns demo server lifecycle. Build emitted only a harmless Rollup annotation warning from `@scure/base`.

Browser automation could not launch: Playwright's Chromium executable was absent, and no system browser was found. No browser downloads or workspace dependency installs were attempted. A real browser should verify printing, sanitized download reopened offline, reset during async work, review/confirm interaction and the full lead-integrated local chain demo before declaring UI acceptance.

## Scope respected

All writes stayed under `swissquote-wallet/apps/recovery-tool/**`. No workspace install, lockfile/root configuration change, commit, push or live Sepolia transaction was performed. Shared protocol files were read only. No implementation blocker remains; outstanding acceptance is browser and deployed-chain integration evidence.
