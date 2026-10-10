# Targeted protocol fixes — final handoff

**Complete:** bounded protocol fixes pass package tests, typecheck/build and the independent reviewer-owned protocol suite. No service/UI implementation or reviewer tests were edited. No installs, shared-root edits, commits, broadcasts or deployments were performed. This new handoff was created exclusively by the final-fix owner; implementation changes remain under the protocol package.

## Changes and consumer contract

- [api.ts](<../../swissquote-wallet/packages/protocol/src/api.ts>): `safeTxFromWire` requires canonical decimal strings in `[0, 2^256)` for `value`, `safeTxGas`, `baseGas`, `gasPrice`, `nonce`; validates target/gas-token/refund addresses and byte-aligned hex calldata; preserves operation 0/1 and valid existing roundtrips.
- [codes.ts](<../../swissquote-wallet/packages/protocol/src/codes.ts>): request encode/decode rejects zero wallet, zero new owner and sentinel new owner. The sentinel rejection fixes a newly published adversarial regression: Safe cannot use its owner-list sentinel as an owner.
- [crypto.ts](<../../swissquote-wallet/packages/protocol/src/crypto.ts>): `openKit` wraps AES-GCM `OperationError` as `Unable to decrypt kit: incorrect code or damaged kit`. It includes no supplied code, mnemonic, raw crypto error or nested cause. Existing checksum/path/chain/envelope checks remain; plaintext buffers are still cleared.
- [verification.ts](<../../swissquote-wallet/packages/protocol/src/verification.ts>): scans module history at every Safe nonce, including zero, and fails closed on history RPC failure. Existing owner-multisig nonce-completeness checks remain conditional on nonzero nonce.
- Exported `VerificationOptions.expectedCurrentOwner?: Address` is additive. `verifyWallet(client, setup, options?)` and `verifyWalletIndependent(clients, setup, options?)` preserve their existing call shape. `setup.owner` remains the immutable original CREATE2 owner. Current on-chain owners must exactly match `[options.expectedCurrentOwner ?? setup.owner]` with threshold 1. Expected current owners reject malformed, zero, sentinel and wallet-self addresses.

**Consumer requirement:** authenticate a replacement owner explicitly before supplying `expectedCurrentOwner`. Do not read RPC `getOwners` and treat that response as authenticated expectation. With no option, verification still rejects an unacknowledged owner replacement. Never change the setup creation owner to make recovery verification green.

The stable interface and package handoff are updated in [EXPORTS.md](<../../swissquote-wallet/packages/protocol/EXPORTS.md>) and [IMPLEMENTATION.md](<../../swissquote-wallet/packages/protocol/IMPLEMENTATION.md>). No consumer migration was performed in this lane.

## Exact acceptance evidence

Commands ran from the wallet workspace, using existing dependencies:

| Command | Final outcome |
| --- | --- |
| `pnpm --filter @sq/protocol test` | 11 passed; 0 failed; 0 skipped; exit 0 |
| `pnpm --filter @sq/protocol typecheck` | exit 0 |
| `pnpm --filter @sq/protocol build` | exit 0 |
| `node --import tsx --test tests/protocol/*.test.ts` | 59 passed; 0 failed; 0 skipped; exit 0 |

`git diff --check -- swissquote-wallet/packages/protocol` also exited 0 from the repository root. The checkout's project files are untracked, so that command alone is not evidence of a tracked patch comparison.

The first independent run finished 54 passed and 1 failed: `request code rejects sentinel replacement owner`, with `AssertionError [ERR_ASSERTION]: Missing expected exception.` The implementation was corrected; the complete final suite passed after the reviewer added further expected-owner invalid-address regressions. Reviewer files were read and run, never modified by this agent.

Independent evidence includes all five overflow fields, malformed addresses/hex, zero/sentinel request owner, wrong-code nonsensitive kit failure, nonce-zero pinned-module delegatecall and unapproved-module call rejection, nonce-zero history RPC failure, recovered/rotated owner acceptance with unchanged CREATE2 input, hidden/mismatching owner rejection and invalid expected-owner rejection.

## Limits and stop condition

The lifecycle and history regressions use injected RPC test doubles; this is not new live-chain or browser evidence. Module-only logs have no monotonic Safe nonce, so a silently omitting RPC cannot be proven complete from the module event stream alone. Default history starts at block zero; custom `fromBlock` must include creation. Consumer authentication and genuinely independent providers remain required.

Acceptance is met for this bounded protocol lane. Parent integration/review owns any consumer changes and wider gates. Future agents must read [HUMAN_FACING_COMMUNICATION.md](<../agents/HUMAN_FACING_COMMUNICATION.md>) fully and follow it before substantive human-facing output.
