# Swissquote service handoff

## Result

Runnable TypeScript ESM Node service with independent `node:sqlite` storage. Service typecheck and all 12 service tests passed. No commits, pushes, workspace installs, root/lockfile changes, or live Sepolia transactions were performed by this lane.

## Entry points and files

- [app.ts](<src/app.ts>): `createApp(options: AppOptions = {})`, returns `{server, handler, store, close}`. HTTP app is testable without a running chain.
- [types.ts](<src/types.ts>): exact `AppOptions`, `ChainAdapter`, `WebAuthnAdapter`, wire transaction and operation interfaces.
- [chain.ts](<src/chain.ts>): `createViemChain(options: ViemChainOptions): ChainAdapter`; exported through app entry. viem fallback transport, shared protocol template/signing/verification helpers, real owner EIP-712 signature verification and Safe simulation return-value check.
- [webauthn.ts](<src/webauthn.ts>): `createWebAuthn(options: {rpID:string; origin:string|string[]; rpName?:string}): WebAuthnAdapter`; exported through app entry. SimpleWebAuthn registration/authentication with required user verification, configured origin/RP and signature counters.
- [policy.ts](<src/policy.ts>): server-derived classification, strict canonical MultiSendCallOnly decoding, token recipient/spender checks, forbidden delegatecall rejection.
- [store.ts](<src/store.ts>): SQLite record storage and atomic transactions; password scrypt with random salt; opaque bearer/reset token digests; database mode 0600. Guardian keys are software secrets in this MOCK database, not a real HSM.
- [main.ts](<src/main.ts>): localhost HTTP startup and environment adapter construction.
- [INTERFACE.md](<INTERFACE.md>): early integration checkpoint. Shared protocol `src/api.ts` now takes precedence; compatibility aliases retained.

## HTTP contract

Auth: password register/login/reset-request/reset; passkey register and login options/verify; transaction-bound passkey step-up options/verify. Options return `{challengeId, options}` plus flat compatibility fields. Register/login return shared session fields plus `authMethod`. Step-up accepts `safeTxHash` (alias `hash`) and returns `stepUpToken,safeTxHash` (alias `hash`). Registration needs an existing authenticated account; first account is bootstrapped with password.

MOCK: POST `/kyc/mock-verify`; GET `/mock/mailbox`; POST `/demo/fooled`. Guardian: POST `/guardian/enroll`. Wallet: POST `/wallets/challenge {wallet}` returns nonce/message; POST `/wallets` accepts shared `{setupCode, cardGuardian, ownershipProof}` or flat setup/proof fields; GET `/wallets/:address` returns shared response.

Account: GET `/account`; POST `/account/withdraw {to,amount}`. Amount is integer USDC base units. Destination must be a verified wallet belonging to the same KYC account, and current wallet rules must still verify; arbitrary addresses receive explicit Travel Rule refusal.

Relay: POST `/relay/deploy`, `/relay/safe-tx`, `/relay/recovery`, `/relay/finalize`. Replies include shared `transactionHash` plus compatibility `txHash`, gas and flow-specific fields. POST `/recovery/approve` returns SQ module-B typed approval, request and approval code.

## Enforced safeguards

Deploy reconstructs the exact shared template, rejects a supplied mismatching initializer/address, binds Swissquote guardian to the client, and reserves one deployment per account before asynchronous broadcast. Linking consumes a wallet-bound ownership challenge, recomputes CREATE2 address, verifies wallet rules, checks proof message/hash and verifies EIP-1271. Guardian enrollment stores a different secure-random per-client key server-side.

Every relay simulates, estimates target-chain gas, adds 20% margin and enforces gas cap before broadcast. Global daily cap defaults to 1000 attempts; KYC-account daily cap defaults to 50. Gas cap defaults to 15,000,000. Budgets and broadcasts are serialized. Cancel/finalize bypass account identity/budget but retain gas/global operational safety caps. Cancellation still requires current owner signature and Safe nonce. Large/admin need a single-use passkey approval bound to the exact 32-byte Safe EIP-712 hash; admin requires `source:settings`. Refund/gas fields must be zero. Nonce reservations reject conflicting requests and do not automatically retry uncertain sends.

USDC over 5 units is Large; unlimited approvals are Large but unlisted spenders are refused altogether. Native transfer over 0.01 ETH is Large. Unknown contract calls are conservatively Large; unknown USDC methods are refused rather than misclassified. Sanctions/spender arrays are injectable MOCK policy lists. Default spender allowlist is empty. Delegatecall is allowed only to MultiSendCallOnly, whose inner calls must all be calls, never delegatecalls. All-cancel batches are Protective.

Recovery approvals require passkey login, or a password-reset age of at least 72 hours plus `mockVideoId:true`. Password reset invalidates all prior sessions, outstanding reset links, passkey/ownership challenges and step-up tokens; new passkey enrollment is held after reset unless an existing passkey authenticates. MOCK fooled mode bypasses bank identity checks only: it never changes contract thresholds/card requirements. The adapter checks on-chain recovery nonce/hash before guardian signing or submission.

Definite preflight refusals restore reserved MOCK account balances. Uncertain broadcasts retain balance/nonce/deployment reservations to avoid double sends; operator must reconcile with chain manually.

## Run and configure

From workspace `swissquote-wallet`, after the lead installs dependencies:

`pnpm --filter @sq/swissquote dev`

Set `ENABLE_MOCK=true` for KYC/mailbox/account/face-demo behavior. `CHAIN=local|sepolia`; `RPC_URLS` comma-separated, at least two; `RELAYER_PRIVATE_KEY`; `SQ_ACCOUNT_PRIVATE_KEY`; optional `SQ_DATA_DIR`, `PORT`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS`. Defaults bind localhost:4001, RP localhost and wallet localhost:5173. Use localhost consistently for passkey tests; RP localhost cannot accept 127.0.0.1 as its RP domain. Main default database is inside this service's `data/` folder. `createApp` callers should inject `databasePath:':memory:'` or their own independent `dataDir`.

Sepolia writes are disabled unless `ALLOW_SEPOLIA_WRITES=true` is explicitly configured after user authorization. Without relayer key, health/auth remain runnable but chain routes fail closed (503).

## Evidence actually run

From `swissquote-wallet`:

`node_modules/.bin/tsc --noEmit -p services/swissquote/tsconfig.json`

`node --import tsx --test services/swissquote/test/*.test.ts`

Passed: 12 tests, zero failures. Coverage: owner-signed small relay preflight order; exact-hash single-use step-up; cancel/finalize bypass and owner-signature retention; gas/simulation no-send guards; Travel Rule gate/balance; reset/session invalidation/72-hour hold; strict batch/token/delegatecall/sanctions classification; production-adapter EIP-712 owner checks and wrong-chain rejection; Sepolia authorization guard; shared setup/proof wire contract; concurrent global-cap enforcement/CORS; independent SQLite and rollback/password hashing.

## Remaining integration checks and limits

No live/local deployed-contract story or browser WebAuthn ceremony was executed here. Chain tests inject RPC responses; app tests inject chain/WebAuthn adapters. Lead must run real local-chain creation/payment/recovery/finalize/old-key/card-refusal story and browser passkey checks. The backend's public-node wallet verification uses the protocol package; availability/history strictness depends on that implementation. Ownership proof wording remains the frozen protocol Sepolia text even on the local chain; signatures themselves use the configured chain domain.

MOCK mailbox is intentionally publicly readable only when MOCK is explicitly enabled; this is the thief-story demo, not a production mailbox. MOCK data and software guardian keys must never be exposed externally. No real sanctions provider, face/video identity check, bank ledger, HSM or transactional chain/SQL reconciliation exists. KYC is explicitly MOCK. Global operational caps can still stop protective sponsorship; independent funded submitters remain able to bypass this bank service.
