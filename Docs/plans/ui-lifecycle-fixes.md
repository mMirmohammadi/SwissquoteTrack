# UI lifecycle fixes

Owner: delegated UI lifecycle agent. Scope: wallet and independent recovery-tool apps only. No shared protocol/service/reviewer edits, installs, commits, live transactions, chain resets, servers, or duplicate browser clickflow.

## Result

Recovery and rotation now retain the original creation setup and re-register the replacement owner with a fresh ownership proof. Independent checking accepts a user-supplied current-owner expectation without rewriting the creation owner or trusting a node's owner response as the expectation.

## Changes

- [Device storage](<../../swissquote-wallet/apps/wallet/src/storage.ts>) preserves the existing wallet's original setup code and card guardian during promotion. A fresh device keeps that metadata from its saved pending record. Promotion rejects another wallet and identical record IDs; transaction aborts produce a retry message.
- [Ownership registration](<../../swissquote-wallet/apps/wallet/src/lifecycle.ts>) validates the unlocked seed against the device owner and the setup against wallet/chain, fetches a fresh wallet-bound challenge for every attempt, and sends the unchanged setup plus `expectedCurrentOwner` and an EIP-1271 ownership proof. The response must verify that same owner.
- [Wallet lifecycle](<../../swissquote-wallet/apps/wallet/src/App.tsx>) shares completion across finalization, rotation and interrupted-install retry: save a fresh kit; cancel remaining requests using the new seed; preserve creation metadata; promote the encrypted key; renew service registration. Funding acknowledgement and payment review reset when the owner changes. Chain checks require the expected sole owner, not merely membership in a larger owner list. A registration failure leaves the promoted encrypted key and original metadata available for retry.
- Fresh-device preparation obtains only public original metadata from authenticated `GET /wallets/:address` and saves it with the encrypted replacement before producing a recovery request. Missing metadata fails closed, leaving the encrypted replacement saved.
- [Independent checker](<../../swissquote-wallet/apps/recovery-tool/src/core.ts>) retains immutable `setup.owner`. Its optional current-owner argument is passed separately to protocol verification. The [tool screen](<../../swissquote-wallet/apps/recovery-tool/index.html>) instructs users to use their independently confirmed replacement request or fresh kit, never automatically copy `getOwners`. Changed input invalidates displayed status; an in-flight result cannot apply to changed owner input.

## Verification

The scoped command sequence is:

`pnpm --filter @sq/wallet test && pnpm --filter @sq/wallet typecheck && pnpm --filter @sq/recovery-tool typecheck && pnpm --filter @sq/wallet build && pnpm --filter @sq/recovery-tool build && pnpm --filter @sq/recovery-tool test`

Passed: wallet 10 tests; recovery tool 16 tests; both typechecks and production builds. The wallet's optional transaction-bearing local integration test remains skipped, intentionally: no duplicate browser flow or chain mutation was requested. The tool production output is one self-contained HTML page, and its portable-output test passes.

New [wallet regressions](<../../swissquote-wallet/apps/wallet/test/lifecycle.test.ts>) execute fresh challenge/proof registration through a mocked HTTP adapter and real cryptographic signing, metadata restoration, and storage promotion through an asynchronous IndexedDB double. New [tool regressions](<../../swissquote-wallet/apps/recovery-tool/test/lifecycle.test.ts>) use pinned contract-byte fixtures and two RPC doubles: replacement fails with no independent expectation, succeeds with the correct expectation and unchanged CREATE2 address, and fails on a wrong expectation, malformed address, or disagreeing node. These are bounded unit evidence, not proof of a new browser end-to-end run.

An existing [wallet receipt test](<../../swissquote-wallet/apps/wallet/test/wallet.test.ts>) incorrectly encoded the indexed Safe execution hash in event data. Its fixture now matches the installed Safe contract ABI: hash in topics, payment in data. Successful inner execution and inner failure decoding both pass.

Build warnings are nonblocking: the existing large wallet bundle and a dependency's Rollup pure-comment annotation.

## Integration requirement and stopping condition

The service owner must expose public `setupCode` and `cardGuardian` on authenticated `GET /wallets/:address`, with `owner` meaning the separately proven current owner. The setup code must retain the creation owner. Those fields are necessary for a fresh device without local creation metadata; neither field is secret, and this app never ingests card words.

Service support for `POST /wallets` with `expectedCurrentOwner`, a fresh one-use challenge, EIP-1271 proof, and subsequent funding validation is owned by the separate service fixer. UI code does not replace that server-side security check.

Stop after scoped tests/types/build and this handoff. Existing listeners remain untouched. Browser end-to-end acceptance remains with its exclusive reviewer.
