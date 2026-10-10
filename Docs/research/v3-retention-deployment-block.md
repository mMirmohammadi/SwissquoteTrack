# Retention accepts bounded deployment metadata

The source mismatch is fixed: the live retention guard now permits `deploymentBlock` as optional public metadata, without permitting arbitrary device fields or weakening encrypted-envelope checks.

## Cause and evidence boundary

The parent supplied the current live audit result: the allowed `/wallets` request confirms that registration succeeded, and the Compound deployment mined, but retention returned false afterward. No funding or supply transaction occurred. This task did not inspect live state or private files and did not repeat that audit.

Source inspection explains the retention failure. The accepted registration lifecycle uses `DeviceRecord.deploymentBlock` as a deployment-height hint; its [validation](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/swissquote-wallet/apps/wallet/src/lifecycle.ts#L17-L29>) requires an optional canonical unsigned 64-bit decimal string. Before this fix, the retention guard's explicit device-field allowlist omitted `deploymentBlock`, so the new public field caused validation to throw even after successful registration. Registration success and retention failure are distinct outcomes; this mismatch is not evidence of a registration failure.

## Change

The [retention guard](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/swissquote-wallet/tests/browser/live-retention.mjs#L12-L12>) adds only `deploymentBlock` to its bounded allowlist. Its [validation](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/swissquote-wallet/tests/browser/live-retention.mjs#L85-L98>) accepts absent or undefined metadata, including exact Playwright `valueEncoded` undefined. Any defined value must be a string matching `^(0|[1-9][0-9]{0,19})$` and be at most `18446744073709551615` (`2^64 - 1`). The match must cover the entire string, rejecting even a trailing newline that JavaScript's `$` anchor otherwise tolerates.

Unknown fields and plaintext owner-key fields remain rejected. The envelope's exact fields, PBKDF2 parameters, byte lengths, representation exclusivity, bounded decoder, owner/wallet checks, failure latch, and private-file safeguards are unchanged. Decoding remains validation-only: snapshots retain the original storage export, not a normalized or reconstructed device.

## Offline acceptance

One new [top-level table-driven test](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/swissquote-wallet/tests/browser/live-retention.test.mjs#L169-L212>) runs twenty internal cases in both plain and exact Playwright encoded representations. It covers absent/undefined compatibility, zero, an ordinary block and the uint64 maximum; it rejects leading zeros, negatives, numbers, oversize strings, overflow, empty/null/boolean/decimal/whitespace/newline values, unknown fields, plaintext owner-key fields, and altered envelopes. It also checks the exact encoded undefined shape and byte-for-byte raw snapshot persistence for both representations.

From the worktree's `swissquote-wallet` directory, verification ran:

`node --check tests/browser/live-retention.mjs && node --check tests/browser/live-retention.test.mjs && node --test tests/browser/live-retention.test.mjs`

Both syntax checks succeeded. The scoped test result was exactly **15 tests: 15 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**: the existing fourteen plus one new top-level test.

Only the retention guard, its test, and this note were edited. The test runner created exclusively owned synthetic offline fixtures under the worktree's ignored `AgentsLocal` directory. No application, storage, or API code was edited. No Git commands, runtime launch, browser execution, live-app access, network requests, real private-file inspection, or new transactions were performed.

## Remaining live claim

This establishes the source fix and offline retention behavior only. It does not establish that the current runtime contains the fix, that a new live retention attempt succeeded, or that Compound/DeFi passed. The supplied live outcome remains: registration and deployment succeeded, retention failed from the public-metadata mismatch, and no funding or supply occurred.
