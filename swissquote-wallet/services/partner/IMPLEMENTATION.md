# Partner v3 privacy checkpoint

## Result and boundaries

Partner enrollment and recovery no longer accept or return `userRef`. Approval locates the single enrolled partner guardian in the configured module-A on-chain guardian set. Face mismatch is always refused: `enabled:true` cannot turn on signing bypass, even with the legacy option. No service was started, no live RPC integration was run, no operational helper keys were accessed, and no transaction was submitted in this lane.

## Integration contract

- `POST /enroll {mockFace}` → `{guardian}` (`PartnerEnrollResponse`). Exact same MOCK face reuses its guardian. A different face gets a fresh guardian rather than replacing another record. MOCK face digests are not real biometric identity or liveness proof.
- `POST /recovery/approve {wallet,newOwner,mockFace,nonce?,chainId?,module?}` → unchanged `RecoveryApproveResponse`, including decimal nonce and exact public request. Identity/account/key fields, including `userRef`, are rejected. Wallet chain metadata selects the guardian; the caller cannot supply a key selector.
- `POST /demo/fooled {enabled:false}` remains a safe reset acknowledgement. `enabled:true` always returns 403. `PARTNER_DEMO_FOOLED` is no longer consumed; legacy `allowDemoFooled` has no effect.
- Health and HTTP body/CORS/error handling are unchanged. Health is liveness, not RPC readiness. CORS is not authentication.

Pinned chain/module checks still require enabled module A, two distinct guardians, threshold two, exactly one locally enrolled partner guardian, a different replacement owner, matching chain/nonce and exact EIP-712 hash before signing. Hash binding includes wallet, chain, module, replacement owner and nonce. This service neither supplies a card approval nor submits recovery.

`PartnerChainReader.readRecovery` now receives `{wallet,module,newOwner,chainId}`; no guardian hint is needed. Existing viem adapter reads all metadata at one block. L3's helper consumer already verifies response request fields and the exact typed-data signature. Shared API owner added `PartnerEnrollResponse`; the wallet enrollment consumer must use it and send only `{mockFace}`.

## Storage and migration boundary

Records contain only guardian address, MOCK face SHA-256 digest and partner private key. Memory and SQLite look up guardians case-insensitively. SQLite's separate `partner_guardians_v3` table has unique guardian and face digest fields and no identity column. Old identity-bearing tables are not read or automatically migrated: use a fresh v3 isolated data directory and enroll a new throwaway wallet. This implementation does **not** erase identity data from an existing legacy database. File permissions remain 0600 and new directories 0700. Plain database keys are MOCK custody, not an HSM or production key protection. A predictable face string/digest is not anonymous authentication; public wallet metadata remains linkable.

## Safe DemoLab

The feature under `apps/wallet/src/features/demoLab/` is a local, read-only explanation against frozen `FeatureProps`. It does not consume context keys, sessions, clients or relay operations. It explains helper-only failure, why two helpers from different routes do not replace the card, and why card-plus-helper is a required pair rather than proof of completed recovery. It explicitly says no contract rejection was exercised. Face mismatch stays refused; no switch or signing calls are exposed.

Remaining evidence: lead-gated throwaway local contract replay must independently demonstrate helper-only and helper-collusion rejection, then card-plus-helper acceptance, without operational helper keys. Browser rendering/clickflow and v3 enrollment/recovery integration remain lead-owned. No general security or production biometrics claim is made.

## Offline verification

Run from `swissquote-wallet/services/partner`:

`node --import tsx --test test/*.test.ts`

`node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`

Partner tests: 14 passed, zero failures/skips. Tests include identity-field rejection, guardian metadata matching, ambiguous helper-only configuration refusal, permanent mismatch refusal despite legacy opt-in, storage persistence/privacy shape, HTTP handling on an ephemeral injected loopback server, throwaway EIP-712 signer recovery and altered wallet/chain/module/owner/nonce signature rejection. All chain clients are injected offline. The first run caught a stale identity-indexed persistence assertion (11/12 passed); it was corrected to assert guardian/digest uniqueness and rerun successfully.

Run from `swissquote-wallet/apps/wallet`:

`node --import tsx --test src/features/demoLab/model.test.ts`

`node ../../node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --allowImportingTsExtensions --types vite/client,node src/features/demoLab/index.tsx src/features/demoLab/model.ts src/features/demoLab/model.test.ts`

DemoLab tests: 2 passed, zero failures/skips; scoped typecheck passed. Source safety checks are limited regression guards, not a sandbox or security proof. No package-manager command, Git command, install, public write, main-demo action or live chain test was performed.
