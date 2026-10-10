# Owner lifecycle: service re-registration is not implemented yet

**Observed result:** the actual Swissquote service still verifies the original creation owner after recovery or rotation. Fresh proof by the replacement owner cannot re-register the original wallet, and withdrawal does not use a separately stored current owner. The service builder must implement the explicit current-owner API; the reviewer made no implementation edits.

## Acceptance evidence

Command, from the wallet workspace: `node --import tsx --test tests/integration/owner-lifecycle.test.ts`.

Two scoped runs, including the final assertion refinements: **15 tests, 11 passed, 4 failed, no skips; exit 1** in both. The failed controls deliberately remain regression failures, not skipped or weakened expectations.

The owned [owner-lifecycle.test.ts](../../swissquote-wallet/tests/integration/owner-lifecycle.test.ts) calls the actual `createApp` over an ephemeral localhost HTTP listener with an in-memory SQLite database. Chain state and CREATE2 prediction are explicitly labelled test doubles. The ownership-proof path uses the actual protocol [verifyOwnershipProof helper](../../swissquote-wallet/packages/protocol/src/signing.ts#L60-L61); its mocked `isValidSignature` endpoint recovers a real SafeMessage EIP-712 signature and returns the EIP-1271 magic value only for the supplied wallet/hash/chain and current owner. This is not evidence of actual recovery execution, live EVM deployment, or browser storage behavior.

### Blocking findings

**LIFE-03, recovery and rotation controls fail:** original setup owner O is preserved, but the verification adapter receives no `expectedCurrentOwner: N`. Re-registration is refused with HTTP 403, `Wallet rules do not match template`, before N's EIP-1271 proof is evaluated. The option assertion exposes the missing propagation rather than allowing an unconditional `verifyWallet: true` mock to hide it. See [registration gate](../../swissquote-wallet/services/swissquote/src/app.ts#L121-L140).

**LIFE-04, isolated withdrawal control fails:** a labelled seeded persistence fixture stores `{ setup: originalSetupO, currentOwner: N }` to isolate the withdrawal path from registration. The actual endpoint supplies no N expectation and refuses HTTP 403, `Wallet rules changed; verification required`. This fixture is not a claim that the service actually authenticated or stored N. See [withdrawal gate](../../swissquote-wallet/services/swissquote/src/app.ts#L144-L151).

**LIFE-06, mismatch rejection fails:** while O still owns the mocked chain, a genuine fresh O proof plus `expectedCurrentOwner: N` returns HTTP 200. The service silently ignores the unsupported field and continues to store/report O. This is an API-validation gap, **not demonstrated acceptance or takeover by N**. Once the option is supported, a valid O proof must not bless an arbitrary N expectation.

### Passing controls and their limits

The existing first-setup `RegisterWalletRequest` works without any added field; its original O proof calls the EIP-1271 helper and permits a withdrawal. The EIP-1271 control independently accepts N only after the labelled chain owner changes to N, and rejects old O and wrong-chain signatures.

Replacement attempts with missing proof, fabricated nonce, replayed proof, expired challenge, challenge for another wallet, forged signature, or mismatching message/hash all fail with 4xx. Password login does not mutate the wallet record or enable withdrawal. Old O proof after replacement and rewriting the original setup owner to N also fail. **Several proof-negative controls presently stop at the original-owner template gate before reaching EIP-1271.** They must be rerun against the implemented option; today's green result alone does not establish that the future current-owner registration path is safe.

## Exact API contract required — builder work, not reviewer changes

Keep the immutable creation record and the mutable authenticated owner separate. Original setup code remains unchanged across recovery and rotation.

1. Extend the existing registration request backwards-compatibly to `RegisterWalletRequest { setupCode: string; cardGuardian: Address; ownershipProof: OwnershipProofWire; expectedCurrentOwner?: Address }`. Missing expectation continues to mean `decodeSetupCode(setupCode).owner`; do not discover or approve a replacement solely from RPC `getOwners`, login, or a recovery request's `newOwner`.
2. Extend the service adapter to `verifyWallet(setup: Setup & { wallet: Address }, options?: { expectedCurrentOwner?: Address }): Promise<boolean>`. The actual viem adapter must forward `expectedCurrentOwner` to protocol `verifyWallet`, alongside its existing `expectedWallet: input.wallet`; passing the HTTP field into a test adapter only is not an implementation. See the current [adapter interface](../../swissquote-wallet/services/swissquote/src/types.ts#L9-L13) and [viem forwarding](../../swissquote-wallet/services/swissquote/src/chain.ts#L29-L31).
3. Registration must validate the optional address, retain the decoded original setup and predicted address, enforce the existing client/guardian/wallet binding, and require a fresh unexpired one-use ownership challenge for that client and wallet with exact message/hash. Require both exact current single-owner/threshold verification against the explicit expectation and a valid current Safe EIP-1271 proof. Only after both succeed may it persist `{ clientId, setup: originalSetup, currentOwner: authenticatedExpectation, verified: true }`. A failed challenge, proof, or expectation must not replace a prior verified record. No login-only shortcut or auto-approved `newOwner` field.
4. Withdrawal must use `linked.currentOwner ?? linked.setup.owner` as its current-owner expectation while passing the original setup unchanged. The fallback supports existing persisted first-setup records. Re-registration must precede funding after a legitimate owner change; current RPC owner data alone must not rewrite the stored expectation.
5. Publish response semantics explicitly. Recommended backwards-compatible shape: keep `owner` as the original setup owner and add `currentOwner` for the authenticated owner (optional in the type while migrating callers). `GET /wallets/:address` must return the stored authenticated expectation, never a newly trusted RPC owner. The browser must submit its independently unlocked replacement device owner as `expectedCurrentOwner` when re-registering; its immutable setup code still contains O. The current [protocol API](../../swissquote-wallet/packages/protocol/src/api.ts#L18-L20) has neither field.

The protocol already supports this separation: [VerificationOptions and owner check](../../swissquote-wallet/packages/protocol/src/verification.ts#L7-L10) retain `setup.owner` for CREATE2 and use `options.expectedCurrentOwner ?? setup.owner` for current owner verification. The service currently does not carry it through.

## Browser storage observation — note only

The wallet [promoteDevice](../../swissquote-wallet/apps/wallet/src/storage.ts#L43-L54) currently constructs `const next = { ...pending, id: currentId, wallet };` without inheriting the original record's `setupCode` or `cardGuardian`. Replacement records created by [recovery preparation](../../swissquote-wallet/apps/wallet/src/App.tsx#L273-L280) and [rotation](../../swissquote-wallet/apps/wallet/src/App.tsx#L327-L341) do not supply that metadata. The later [registration retry](../../swissquote-wallet/apps/wallet/src/App.tsx#L244-L249) requires both, so promotion can leave the replacement key installed but remove the original creation record needed for re-registration. Browser owner owns storage tests and fixes; this reviewer did not edit or test IndexedDB.

## Ownership and stopping condition

Reviewer owns only [owner-lifecycle.test.ts](../../swissquote-wallet/tests/integration/owner-lifecycle.test.ts) and this report. No implementation edits, shared installs, commits, live transactions, or shared-node resets were performed. Builders monitor [integration status](swarm-integration-status.md); this report is the lifecycle handoff, not a broad implementation proposal. Acceptance requires the same scoped tests to pass with explicit N option propagation, immutable O persistence, valid fresh N proof, withdrawal against stored N, and all strong negatives still rejecting without mutation or broadcast.
