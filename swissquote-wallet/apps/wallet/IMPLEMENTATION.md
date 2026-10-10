# Wallet lane implementation

## Result

A runnable React wallet is implemented exclusively in `swissquote-wallet/apps/wallet/`. It consumes actual protocol exports and service endpoints. No workspace install, lockfile/root-configuration edit, commit, push, or Sepolia transaction was performed. The opt-in integration test broadcasts only to chain 31337 after checking the RPC chain ID.

## Included behavior

- Responsive desktop/mobile wallet shell: Overview, Send money, Recovery, Device security, and MOCK demo lab; clear loading/error/unknown states, keyboard focus, semantic labels, reduced-motion support.
- Password login/create, browser WebAuthn passkey login/enrollment, MOCK KYC. Account password reset uses the actual MOCK mailbox and does not unlock the encrypted owner key.
- Owner seed is encrypted using protocol AES-GCM/PBKDF2-SHA256 (600,000 iterations), stored in IndexedDB. Device passphrase is separate from account password. Keys are memory-only after unlock; tab hiding and explicit locking clear unlocked seeds and exposed kit codes. Wallet accepts only the public card address and never receives card words.
- Guardian enrollment, fixed-template wallet-address prediction, actual relay deployment, receipt checking, one-use EIP-1271 ownership challenge and registration, setup-code export and independent-tool reminder. Ownership proof wallet text is lowercased to match the service canonicalization.
- MOCK account funding to verified wallets; explicit independent-tool confirmation gates deposits. Payment constructs exact USDC calldata and Safe nonce, classifies locally, requests hash-bound passkey step-up when required, signs using the owner, and relays actual calldata.
- Safe success requires a successful network receipt AND `ExecutionSuccess` without `ExecutionFailure`; mere HTTP success or a transaction hash never produces a success record.
- Both recovery modules are polled directly from two configured public RPC transports at the same pinned block. Contradictions or unavailable reads show status unknown, not clear. Alert and protective cancellation use the current owner and do not ask for passkey.
- Recovery generates and encrypts a fresh owner before requesting approvals; request code contains no seed; browser wallet imports only the tool's card approval. Helper approvals come from real service calls. Countdown follows `executeAfter`; finalize checks replacement ownership on chain and clears other pending requests.
- Owner rotation requires hash-bound passkey; replacement record is stored before chain submission and old record is replaced only after confirmed ownership. Interrupted promotion can be retried using the saved encrypted replacement record. Interrupted ownership registration can be retried without redeployment.
- Encrypted emergency kit creation/export and separate kit-code warning; tool address is intentionally plain text, not a navigation link. Fresh export after recovery/rotation.
- MOCK stolen-login/password-reset demonstration and helper-collusion attempt controls; failures are real service errors. No fabricated successful theft/recovery/payment.

## Files and exports

- `src/App.tsx`: exported `App` React component; orchestration and UI.
- `src/api.ts`: `call<T>`, `ServiceError`, `errorMessage`, `SQ_URL`, `PARTNER_URL`.
- `src/chain.ts`: `client`, `chainId`, `validatedAddress`, `usdcAmount`, `paymentTx`, `nonce`, `owners`, `confirmed`, `readPending`, `countdown`, `PendingRecovery`.
- `src/storage.ts`: `DeviceRecord`, `loadDevice`, `saveDevice`, `bindWallet`, `promoteDevice`, `unlockDevice`.
- `src/styles.css`, `src/main.tsx`, `src/vite-env.d.ts`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`.
- `test/wallet.test.ts`: focused non-network regression tests.
- `test/local.integration.test.ts`: opt-in actual services/local-chain smoke scenario.
- `INTERFACES.md`: integration/environment hints.

## Run

From `swissquote-wallet`, run `pnpm --filter @sq/wallet dev`, `pnpm --filter @sq/wallet test`, or `pnpm --filter @sq/wallet build` using existing workspace dependencies. Dev binds `127.0.0.1:5173` with strict port. This lane did not start a persistent server.

Browser configuration: `VITE_CHAIN=local|sepolia` (default local), `VITE_RPC_URLS` comma separated, `VITE_SQ_URL` default `http://localhost:4001`, `VITE_PARTNER_URL` default `http://localhost:4002`. No `.env` file or secret is written. Two local URLs are the same Hardhat node under different hosts; they are not independent providers. For Sepolia verification provide two genuinely independent URLs; live writes remain unauthorized here.

## Evidence and remaining uncertainty

Focused tests passed: exact amounts/address validation; countdown; real API shape and error surfacing; receipt fail-closed behavior; encrypted owner key rejects reset-login password; SSR shell accessibility/MOCK labels; source guardrails. Production TypeScript/Vite build passed. Rollup reports a non-blocking scure annotation warning and a main JS chunk over 500kB.

Actual local integration exercised password registration → MOCK KYC → both guardian enrollments → fixed wallet deployment → receipt → ownership challenge/registration successfully after fixing checksum/canonicalization mismatch. It then failed at actual `/account/withdraw` with HTTP 502 `Chain preflight refused transaction; nothing broadcast`. This is a service/local MOCK-account funding prerequisite blocker, not a successful deposit. Because the failed scenario stops there, actual owner payment and password-only admin denial in this scenario remain unverified. The opt-in test retains this honest failure and is disabled in ordinary test runs. Lead should fund/configure the local MOCK account and rerun `RUN_LOCAL_WALLET_INTEGRATION=1 pnpm --filter @sq/wallet test`.

No browser executable or browser automation dependency was available in this lane; WebAuthn ceremony, IndexedDB browser durability, layout screenshots, and complete recovery/rotation UI journeys need lead browser verification. Both-module alert/cancel and failed-theft paths are implemented but not fully browser-acceptance tested. Fresh login needs email discovery by the user; session tokens are intentionally not persisted to web storage.

## Stopping condition / handoff

Lane is runnable, unit/security tests and build pass, service integration checkpoint and blocker are recorded. Lead owns root integration/startup and local-account provisioning. Preserve concurrent lanes. Do not call this production-secure or live-Sepolia-verified.
