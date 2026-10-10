# Retention serialization fix: offline acceptance passed

The exact pre-deployment `wallet: undefined` record now passes the encrypted-owner deployment guard, while wallet-bound writes still fail until a matching wallet is present. All prior tests plus the new serialization tests pass, and the actual external Chromium offline reproduction now passes guard, snapshot and cleanup snapshot. No live deployment was attempted.

## Current fix and acceptance

Only [retention helper](<live-retention.mjs>), [retention tests](<live-retention.test.mjs>) and this report were changed. Application storage was not changed to omit undefined values or hide the mismatch.

The installed Playwright 1.64.0 storageScript was extracted as a parsed string without evaluating it. It emits `{o:[{k,v},...],id:number}`, `{a:[...],id:number}`, raw strings/numbers/booleans, and `{v:'undefined'|'null'}` for the supported subset. In this installed format `{s,id}` means Set; `{s}`, `{n}` and `{b}` are not primitive encodings. The helper accepts only that observed subset, not a guessed alternative schema. See [extracted source](<../../../AgentsLocal/ea749b36/storageScript-source.txt#L213-L239>) and [object/array serialization and export selection](<../../../AgentsLocal/ea749b36/storageScript-source.txt#L297-L405>).

The decoder runs only when `value` is absent and `valueEncoded` is present. Both fields—even an explicitly undefined or null `value`—or neither field fail closed. Decoded values are used only for encrypted-device validation; original browser state, including encoded undefined markers and serialization IDs, is persisted unchanged for restoration. Existing device-field allowlist, exact envelope/KDF checks (PBKDF2-SHA256 600000 iterations), salt/IV/ciphertext bounds and owner/wallet checks remain unchanged. No key or owner seed is decrypted or read.

The decoder rejects references, cycles/reused nodes, duplicate object keys or serialization IDs, non-positive/non-integer IDs, dangerous `__proto__`/`prototype`/`constructor` keys, getters, custom prototypes, symbol/extra fields, sparse arrays, dates, buffers, Sets/Maps and unsupported tags. Bounds are 256 decoded nodes/entries, depth 8, 64 entries per object/array, 8192 characters per string and 32768 aggregate characters (including keys). Arrays are accepted only as top-level `pastRecipients` lists of strings. Generic failure messages do not disclose payloads.

`node --test tests/browser/live-retention.test.mjs` passed all 14 tests (9 existing plus 5 new; 137.318 ms). New coverage includes exact installed encoding, undefined-wallet owner predeploy acceptance versus wallet-binding rejection, bound-wallet guard acceptance, raw snapshot equality, cleanup retry after a latched failure, ambiguous representations, unknown plaintext fields, malformed and unsupported values, duplicate keys/IDs, cycles, dangerous keys, all size bounds and unchanged envelope/address checks. See [unit output](<../../../AgentsLocal/ea749b36/unit-tests.txt>).

The actual-browser regression is an owned-scratch derivative of the [original mismatch diagnostic](<retention-shape-diagnostic.mjs>), with post-fix assertions and absolute dependency imports. The original diagnostic remains unchanged as historical failure evidence and still asserts the old mismatch; do not invoke it expecting post-fix success. The derivative uses exactly `/tmp/sq-playwright/chromium-1248/chrome-linux64/chrome`, its approved external library directory and an owned HOME. All URL requests are fulfilled in-process; service workers are blocked. Synthetic envelope encryption is not owner-seed encryption/decryption. See [post-fix diagnostic](<../../../AgentsLocal/ea749b36/postfix-diagnostic.mjs>).

The post-fix real export has `valueEncoded` only for explicit undefined wallet, and plain `value` for absent/bound wallet. All three cases report `directVerdict: present`, `snapshotVerdict: present`, `guardVerdict: allowed` and `cleanupSnapshotVerdict: present`. The undefined case remains structurally encoded, proving the decoder—not omitted app data—fixes the mismatch. See [redacted structural evidence](<../../../AgentsLocal/ea749b36/verified-result.json>). Combined fresh unit tests plus actual Chromium diagnostic completed in **1.030 seconds**, below the 40-second acceptance limit.

One initial owned-scratch diagnostic attempt failed generically because its relocated `require('playwright/package.json')` could not resolve from scratch. The derivative now uses the installed package's absolute path; two corrected actual-browser runs passed. No failed/live run was opened, no actual credentials/state or private owner keys were accessed, and no app/service/RPC/runtime/Git/environment-file operations occurred. Fixture and browser outputs remain synthetic under the exclusively created [owned scratch directory](<../../../AgentsLocal/ea749b36/>).

**Stopping condition met:** offline serialization regression and safety coverage pass. This verifies local retention format handling, not live deployment, chain state or an end-to-end recovery ceremony. The parent retains sole authority over any separately approved live run.

## Earlier retention integration record (historical)

The sections below describe the pre-existing harness integration and its original acceptance before the serialization regression was identified. Their 9-test count and statement that no browser ran are historical, superseded by the current evidence above.

Both Sepolia harnesses block deployment, funding and owner-signed writes unless private local retention succeeds.

## Changes

- [Helper](<live-retention.mjs>) requires explicit `ALLOW_SEPOLIA_LOCAL_RETENTION=yes`, the fixed wallet working directory for harness use, and the exact existing ignore entry in [root ignore configuration](<../../../.gitignore#L24-L25>). Optional `SEPOLIA_RUN_ID` accepts only `[A-Za-z0-9][A-Za-z0-9_-]{0,79}`; omitted values generate a UUID. An existing run is rejected, never reused. Root/run directories must be owned, real directories with mode `0700`.
- Exclusive `O_EXCL|O_NOFOLLOW` files use mode `0600` and their original open handles. Identity, owner, mode, single-link count and non-symlink checks run before/after writes. File contents and directory entries are synced. One private file holds only the generated device passphrase and offline-generated 12 Recovery Card words; no plaintext owner seed is exported. Two alternating browser snapshots preserve the previous completed snapshot if a later write fails. Browser state includes authentication credentials as well as encrypted IndexedDB and is secret, not evidence.
- [Compound harness](<sepolia-compound.mjs>) and [service harness](<sepolia-service.mjs>) save credentials before wallet creation, export pre-click state, require a matching encrypted owner export in deployment interception, and export again immediately after deployment response and after wallet-created UI/setup binding. Every funding/payment/supply interception requires fresh retained encrypted state matching owner and wallet. Retention errors permanently block later writes; `finally` still attempts a fresh snapshot before closing the browser. Timeout cleanup does not immediately destroy browser state: writes stop at the existing deadline, cleanup has a bounded grace, and paused writes recheck abort/deadline before release.

## Evidence and limits

`node --test tests/browser/live-retention.test.mjs` passed all 9 synthetic tests in approximately 0.12 seconds. Syntax checks passed for the helper, test and both harnesses. [Synthetic tests](<live-retention.test.mjs>) cover consent, unsafe IDs/cwd, ignore opt-outs, exclusive creation, directory/file modes, exact private persistence, authentication/IndexedDB snapshots, owner/wallet matching, unexpected plaintext device fields, malformed envelopes, missing credentials, permanent failure guards, finally retries, chmod/hardlink/symlink/path-swap rejection, and harness integration source checks. Fixtures contain synthetic values only in agent-owned ignored `AgentsLocal/` directories; no actual seed was generated.

Current [wallet creation implementation](<../../apps/wallet/src/App.tsx#L252-L282>) saves the encrypted device before its deployment request and binds wallet/setup after mining. The helper verifies this actual exported envelope (PBKDF2-SHA256 600000, expected salt/IV/ciphertext shape), rather than claiming the pre-click snapshot already contains an encrypted device. No decryption is attempted. A future app that only creates encrypted state after deployment will fail closed at deployment interception; this is deliberate.

Storage export is bounded to 3 seconds. The write deadline remains 300 seconds; retention/browser cleanup has up to 8 additional seconds. A hung export, OS write failure, killed process or machine loss cannot guarantee a fresh final snapshot; earlier completed private snapshots remain, and no later write is permitted after a retention failure. This is local recovery retention, not a tested recovery ceremony or Emergency Kit export. The combined passphrase/card file is a deliberately approved local recovery convenience; anyone who steals the private run directory can gain access. Never publish, attach or print its files.

Selectors were preserved. The service harness already scopes the network label to `.sidebar-bottom`; Compound's existing exact text selector remains for the lead's separately owned correction. No application/tool changes were made.

## Updated approved invocation (do not execute as part of this review)

Run from `.worktrees/v3/swissquote-wallet` with the already approved isolated stack. Add `ALLOW_SEPOLIA_LOCAL_RETENTION=yes` to the existing lead-only invocation. `SEPOLIA_RUN_ID` is optional; use a new safe ASCII value or allow automatic UUID generation. Do not supply an arbitrary directory or reuse a prior ID.

Compound command: `ALLOW_SEPOLIA_LOCAL_RETENTION=yes ALLOW_SEPOLIA_COMPOUND=yes SEPOLIA_BROWSER_CHAIN_ID=11155111 ALLOW_SEPOLIA_BROWSER_FUND=yes SEPOLIA_EXPECTED_RELAYER=<approved-public-address> node --import tsx tests/browser/sepolia-compound.mjs`.

P0 command: `ALLOW_SEPOLIA_LOCAL_RETENTION=yes ALLOW_SEPOLIA_BROWSER=yes SEPOLIA_BROWSER_CHAIN_ID=11155111 ALLOW_SEPOLIA_BROWSER_FUND=yes SEPOLIA_RECIPIENT=<approved-public-address> node --import tsx tests/browser/sepolia-service.mjs`.

Public evidence includes only retention status and the safe run ID; private files stay under the ignored wallet `.sepolia-runs/<id>/`. Inspect submitted public hashes before any retry. Offline test command: `node --test tests/browser/live-retention.test.mjs`.
