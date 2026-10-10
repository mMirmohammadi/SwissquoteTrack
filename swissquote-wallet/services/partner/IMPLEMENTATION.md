# Partner service — completed local checkpoint

Independent Node service for MOCK face enrollment and genuine EIP-712 module-A recovery approvals. Implementation writes stayed within `swissquote-wallet/services/partner/`. No commits, pushes, deployments, or live chain transactions.

## Integration contract

Uses the frozen `@sq/protocol` HTTP types and cryptography exports.

- `POST /enroll {userRef, mockFace}` → `{userRef, guardian}` (`GuardianEnrollResponse`). Securely generates a fresh partner key. Existing enrollment is idempotent only with the same MOCK face; never silently rotates the guardian.
- `POST /recovery/approve {userRef, wallet, newOwner, mockFace, nonce?, chainId?, module?}` → `{signer, signature, approvalCode, request:{wallet,module,newOwner,nonce,chainId}}` (`RecoveryApproveResponse`). Nonce is decimal text; module A only. Supplied nonce must equal the chain nonce.
- `POST /demo/fooled {enabled:boolean}` → `{enabled,mock:true}`. Disabled unless `PARTNER_DEMO_FOOLED=true`; bypasses only recovery face matching, not enrollment protection or chain verification.
- `GET /health` → `{service:'partner',mock:true,status:'ok'}`. This is liveness, not an RPC readiness claim.
- Errors → `{error:string}` with 400/403/404/409/413/415/503 as appropriate. Unexpected failures and RPC/provider details are sanitized.

## Exports and dependency injection

Entry: `src/index.ts`, exposed by package `@sq/partner`.

- `createPartnerServer(options: PartnerServerOptions): Server`: does not listen, open storage, read environment, or call RPC. Options are `{service, allowedOrigins?, bodyLimit?}`. Defaults: wallet localhost origins, 16 KiB body limit; JSON only; no-store responses. Browser origins not on the allowlist are refused.
- `createPartnerService(options: PartnerServiceOptions)`: returns `{enroll, approve, setDemoFooled, getDemoFooled}`. Inject `{store, chainReader, crypto, chainId, moduleA, allowDemoFooled?}`. Exports related interfaces and `PartnerError`.
- `createViemChainReader(client: PublicClient): PartnerChainReader`: checks chain id, reads one block snapshot, confirms deployed wallet and enabled module, pins module code, reads exact guardian set/threshold/nonce and on-chain hash.
- `partnerCrypto`: uses secure viem key generation and shared `hashRecovery`, `signRecovery`, and approval-code encoding. No custom signature scheme.
- `MemoryPartnerStore` and `SqlitePartnerStore`: injectable separate storage. SQLite insert-if-absent protects concurrent enrollment, parameterized statements, bounded busy timeout. File mode 0600; new directories 0700.
- `createPartnerRuntime(options?: PartnerRuntimeOptions)`: returns `{server,service,store,chainId,close}`. Inject `{env?,client?,dataFile?}`; `dataFile:':memory:'` is useful for tests.

Runtime reads `CHAIN=local|sepolia`, `RPC_URLS` (at least two HTTP(S) endpoints; viem fallback), `PARTNER_DATA_DIR`, `PARTNER_DEMO_FOOLED`, and `PARTNER_ALLOWED_ORIGINS`. CLI additionally reads `PARTNER_PORT` (4002) and `PARTNER_HOST` (127.0.0.1). Default chain is local. Default SQLite database is `services/partner/data/partner.sqlite`; no shared Swissquote database. CLI logs only MOCK label, port and chain id.

Package scripts: `dev`/`start` use tsx; `build` and `typecheck` use tsc; `test` uses Node's test runner with tsx. The protocol uses `.js` imports pointing at TS sources, so runtime needs tsx rather than bare Node type stripping for shared imports.

## Signing protections and limits

Approval requires the enrolled partner guardian in an exact two-distinct-guardian, threshold-two module A. New owner must differ from wallet and both guardians. Wrong chain/module, stale nonce, unsafe module code, unavailable chain, disabled module, hash mismatch and face mismatch all fail closed. Chain state is read at one block; a later chain change can invalidate an approval, and the contract must recheck its nonce during relay. Nothing here submits transactions.

Store contains only opaque userRef, a MOCK face SHA-256 digest, partner guardian address and partner private key. Requests reject extra fields to prevent accidental owner/card/SQ secrets or bank account records. Keys are plain local database values: explicitly **MOCK HSM**, not production key protection. MOCK faces are exact string matching, not biometric authentication, liveness, or identity proof. The enrollment and opt-in fooled endpoint are local demonstration features, not an authenticated production identity service. CORS is not server-side authentication. The partner cannot prove the second guardian is the user's intended recovery card from enrollment alone; the independent tool verifies that wallet rule.

## Verification actually run

- `node --test test/partner.test.ts`: nine tests passed at the first runnable checkpoint, before shared runtime dependencies were available.
- `pnpm typecheck && pnpm build && pnpm test`: typecheck/build passed; twelve tests passed after protocol entry and workspace dependencies appeared.
- `node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`: direct compiler verification passed.
- Direct tsx runtime smoke with injected in-memory SQLite: constructed full runtime, listened on an ephemeral loopback port, fetched `/health`, obtained `{service:'partner',mock:true,status:'ok'}`, and closed storage/server. No RPC or chain write.

Tests cover enrollment idempotency and secret-field refusal; frozen approval response; missing/incorrect face; stale nonce; wrong chain, guardian, threshold, duplicate guardian and hash; malformed fields; opt-in fooled restrictions; sanitized RPC failures; persistence, distinct stores, file permissions and absence of raw face; HTTP/CORS/body bounds; genuine EIP-712 signer recovery and shared approval-code decoding; adapter refusal for wrong chain, absent wallet, disabled module and unpinned code.

No real local-chain or Sepolia RPC approval was exercised. Lead-owned end-to-end story should supply the deployed real-code local wallet and enrolled guardian, then verify the returned approval in `multiConfirmRecovery` with the card signature.

## Integration caveat

No install command was requested or manually run by this lane. However, invoking `pnpm typecheck` after adding the local tsx devDependency unexpectedly triggered pnpm 12's automatic workspace dependency synchronization (output: `Scope: all 8 workspace projects`, `devDependencies: + tsx 4.23.15`). This may have touched the lead-owned lockfile despite the no-install intention. Lead should review that shared diff; this lane did not attempt to undo concurrent root changes. Later compiler/runtime verification used direct Node commands to avoid that behavior.

## Completion state

Local partner implementation, build, typecheck, tests and smoke checkpoint complete. Remaining integration verification: real-code local-chain recovery through lead's story. No blocker for consuming the exported server/service API.
