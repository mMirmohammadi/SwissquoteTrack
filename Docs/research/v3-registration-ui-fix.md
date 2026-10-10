# Registration UI correction — scoped evidence

## Result

Confirmed creation now publishes the persisted wallet before fallible ownership registration. A registration refusal leaves the current wallet, original setup, encrypted device key, and explicit retry/unlock controls available. The receipt does not mark ownership verified. The original Compound refusal cause remains unknown; no live browser or chain acceptance was performed.

## Changes

- [Receipt handling](<../../swissquote-wallet/apps/wallet/src/chain.ts>): `confirmedOn` and `confirmed` return the confirmed bigint block after existing revert/Safe execution checks. Missing or negative receipt blocks refuse. Existing callback/module-local confirmed-block tracking remains.
- [Device storage](<../../swissquote-wallet/apps/wallet/src/storage.ts>): optional public `deploymentBlock?: string` is saved through an optional fifth `bindWallet` argument. No new secret is stored.
- [Registration lifecycle](<../../swissquote-wallet/apps/wallet/src/lifecycle.ts>): frozen optional bigint minimum is serialized as canonical decimal only when supplied explicitly or retained in the device record. Saved minima reject malformed strings and values above unsigned 64-bit range before challenge/API work. Original setup and fresh proof behavior remain unchanged.
- [Wallet UI](<../../swissquote-wallet/apps/wallet/src/App.tsx>): creation captures the receipt block, persists binding, then publishes device/wallet/setup/card with ownership and independent checks false and review cleared. Explicit retry uses persisted receipt metadata without redeployment. All registration callers, including replacement installation, use the same helper activity guard before challenge, after challenge before signing, after signing before POST, and after POST. Creation captures the signing generation before save/unlock/enrollment; retry and replacement entry points capture it before unlock/pending reads. Fresh creation/promotion waits for the queued React identity publication after challenge rather than rejecting a legitimate newly bound wallet or newly promoted owner. Registration success invalidates older ownership GET generations and checks current session/wallet/owner plus signing generation before promoting verified state. Registration-related kit exports check activity before work and after async stages; replacement still prepares its emergency kit before optional service registration, preserving recovery ordering.

Existing explicit protective cancellation in retry is preserved. No new creation cancellation or automatic registration retry was added. Protection feature registration/public-check handling, recovery wizard, dApps, API/protocol/service files, authentication persistence, RPC sources, and real virtual-passkey fixtures were not changed.

## Exact scoped checks

Executed from `swissquote-wallet/apps/wallet` in this worktree:

```sh
pnpm exec tsc --noEmit
node --import tsx --test test/lifecycle.test.ts test/sepolia-receipt.test.ts test/wallet.test.ts
node --experimental-test-module-mocks --import tsx --test test/registration-retry.test.tsx test/registration-activity.test.ts
```

Wallet TypeScript check passed. **29 tests passed, zero failed:** 15 lifecycle/receipt/wallet tests, nine actual `react-dom/client` rendered component tests, and five new actual-helper activity tests. This inventory addresses the independent review's UI findings; it does not establish or fix the original live Compound refusal cause.

[Rendered regressions](<../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx>) exercise:

- Creation receipt followed by HTTP 403: persisted/current bound wallet and encrypted envelope retained, ownership unverified, deposits disabled, retry visible, key still unlocked. Locking then retrying without a passphrase makes no registration; explicit unlock permits successful retry with the same receipt minimum, fresh proof, and exactly one deployment total.
- Delayed pre-registration ownership GET failure after retry success cannot replace the verified result. Independent-check acknowledgement remains false, so deposits remain disabled even after ownership succeeds.
- Saved current owner changing during registration locks the key and prevents stale success from verifying the replacement owner.
- Sign-out during registration prevents late success from restoring verified state or publishing an emergency kit/registration-success notice.
- Actual helper challenge held through explicit lock or logout: the module-mocked signing function records zero signatures and fetch records zero registration POSTs; no verified/success/kit publication follows.
- Delayed device unlock and pending-request reads held through lock: no signing or POST and no unlocked seed republished.
- Fresh replacement promotion succeeds without a false old-owner identity rejection, invalidates late ownership GET failure, and refuses post-logout POST success publication.

[Activity-boundary regressions](<../../swissquote-wallet/apps/wallet/test/registration-activity.test.ts>) exercise all four helper guard boundaries with the actual helper and tracked proof signing, plus an async-compatible guard and frozen receipt minimum. The proof tuple and no-seed-in-body assertions remain.

[Lifecycle regressions](<../../swissquote-wallet/apps/wallet/test/lifecycle.test.ts>) execute real request serialization/proof signing and storage binding with an asynchronous IndexedDB double. [Receipt tests](<../../swissquote-wallet/apps/wallet/test/sepolia-receipt.test.ts>) verify returned block/callback and invalid-block refusal without weakening existing strict receipt checks. Wallet receipt success fixture now contains a real bigint block.

## Limitations and integration action

The new rendered test uses a minimal in-test DOM host and mocked chain/storage/features with real React reconciliation and effects; it is not a browser/WebAuthn/IndexedDB integration test. It invokes handlers on rendered host elements, rather than browser-native event dispatch. Owner-change and sign-out are exercised; a separate mid-registration wallet-address-switch scenario is not directly exercised, though success checks the current wallet address. Protection/public-check ordering is preserved in source but its feature behavior was not re-executed here.

Node's module mocking is experimental. This test requires its explicit command above: the existing package test script includes only `*.test.ts`, not the new `*.test.tsx`; package ownership was outside this delegation. Parent must decide how to include the explicit test invocation in acceptance. No new dependency or package script was added. No full suite, local-chain integration, browser, public RPC, key inspection, funding, or Compound action was run. Parent/service owner must integrate the frozen optional protocol minimum separately. No assertion is made that the original refusal cause is fixed until safe live-browser acceptance exists.
