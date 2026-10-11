# Historical browser validation — superseded checkpoint

**FINAL V4 acceptance:** `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. This includes the seven added MOCK bank-return shortcut regressions (567 Node/browser + 42 contracts). It supersedes the earlier 602-test baseline below. G1 public-browser recovery separately passed across retained sessions, not one uninterrupted take. No production audit, hardware proof or publication is implied.

**CURRENT V4 acceptance:** [the isolated uncommitted candidate](<../../../../Docs/plans/v4/acceptance.md>) passed `bash-1996`, exit 0, **602 tests, zero skips, 417.0 seconds**, typecheck/build passed; 34 browser tests include local recovery with a real 180-second wait. This is lead-recorded acceptance, not this historical reviewer's rerun or a production audit. Frozen v3 stays clean at `cb7297a`. **G1 public-browser recovery PASSED (`bash-2054`, exit 0):** deployment, funding, first payment, card+partner start, actual chain wait, finalization and replacement-owner payment on the same wallet across encrypted retained browser sessions after timeouts. Finalization/new payment used one visible page with normal unlock, no reload/authentication injection. Chromium virtual WebAuthn and MOCK identity remain explicit. [Exact G1 run](<claims.md#g1-public-browser-recovery--completed-across-retained-sessions>). The C1 shortcut is included in the final 609-test gate above.

**This is an earlier verifier's failure chronology, not current V4 acceptance.** The later [591-test zero-skip gate](<../plans/v3/compound-acceptance.md>) and [complete local browser recovery](<claims.md#bounded-local-browser-recovery-acceptance>) supersede the old incomplete clickflow status. Separate public [payment](<../research/v3-live-payment-evidence.md>) and [supply](<../research/v3-live-compound-evidence.md>) records establish only their bounded paths. G1 now confirms bounded public-browser module-A recovery; it does not promote this older reviewer’s tests to public evidence. Original agent-local logs are not published judge evidence; labels below retain provenance without dead links.

**Mandatory five browser tests passed with no skips while the managed stack was live; latest rerun was blocked by servers becoming unavailable.** The separate real-server customer clickflow passed through wallet creation, actual SQ virtual-passkey registration, independent chain checks, downloaded-kit offline opening and funding. Latest completed run passed the small owner-signed payment and stopped at large-payment WebAuthn challenge binding. This is partial clickflow acceptance, not a full create → pay → recover browser pass.

## Observed mandatory results

Command from the wallet workspace: `PLAYWRIGHT_BROWSERS_PATH=/tmp/sq-playwright pnpm --filter @sq/browser-verification test:e2e`, with the unprivileged library/writable-home environment below. Exit **0**, **5 passed / 0 failed / 0 skipped**. Exact pass log (historical agent-local record; not published judge evidence). A later current-artifact recheck exited **1**, **2 passed / 3 failed / 0 skipped**, because managed wallet5173/tool5174 were unavailable. Offline card and kit tests still passed. Unavailable-server rerun (historical agent-local record; not published judge evidence). This does not erase the earlier executed pass, but current-stack final acceptance needs a rerun after the lead restores the existing services.

[Actual wallet storage test](<../../swissquote-wallet/tests/browser/browser.test.mjs>) exercised encrypted IndexedDB storage using PBKDF2-SHA256 600,000 iterations and AES-GCM, short/wrong passphrase rejection, reload and absence of plaintext persisted seed. This imports the actual wallet storage module in Chromium; it is not just a standalone cryptography unit test.

The mandatory WebAuthn test created/asserted a resident verified virtual credential in Chromium. This test alone proves browser capability, not SQ integration; the additional clickflow supplied real SQ registration evidence.

The portable HTML created a 12-word card while browser networking was offline, made no HTTP requests and did not persist card words across storage/reload. Malformed setup/recovery-request inputs failed in the actual tool UI before POST/RPC. [Portable kit test](<../../swissquote-wallet/tests/browser/offline-kit.test.mjs>) opened an actual protocol-encrypted kit offline, rejected the wrong code, matched the seed/owner, cleared secrets on reset/reload and found no secret persistence or HTTP requests.

## Real-server clickflow

`node --test swissquote-wallet/tests/browser/clickflow.test.mjs` from the repository root, same environment. Initial execution exit **1**, with these stages actually passed before the blocker:

- Separate portable-tool offline card creation; only the public guardian address entered into the wallet.
- Fresh customer registration through wallet UI and real SQ password/register plus passkey/register/verify. Virtual CTAP2 resident, user-verified authenticator; no request/API credential mocks.
- MOCK KYC, actual Safe deployment with both recovery modules, real owner proof and wallet registration.
- Independent tool green wallet/card check through both local RPC endpoints; acknowledgement before first deposit.
- Real encrypted-kit browser download, upload of those exact downloaded bytes into the offline portable tool, successful opening of the 24-word owner backup, and no raw seed/card/code in inspected wallet/tool persistence.

Initial funding failed with **`Chain preflight refused transaction; nothing broadcast`** from real SQ: initial log (historical agent-local record; not published judge evidence). In the stricter rerun, funding **passed**, with actual chain receipt and activity entry, after runtime changes outside this verifier's work. Exact card-phrase inspection found no card words sent in wallet/SQ/partner requests. The next stage initially failed receipt decoding with **`The receipt does not prove successful Safe execution. Inspect chain state before retrying.`** Protocol builder corrected the missing indexed transaction-hash ABI; after that, **small owner-signed send passed with chain confirmation and zero step-up calls**. Large 6 USDC send reached real SQ step-up/options but failed with **`WebAuthn challenge must bind transaction hash`** before credential verification. After-ABI log (historical agent-local record; not published judge evidence). Stricter rerun log (historical agent-local record; not published judge evidence), [repeatable test](<../../swissquote-wallet/tests/browser/clickflow.test.mjs>), [actionable findings](<../plans/browser-final-findings.md>).

## Unprivileged browser repair

No privileged host install was used. Ubuntu noble shared-library packages were downloaded with `apt download`, then extracted with `dpkg-deb -x` under `/tmp/sq-browser-libs`. The initial missing libatk dependency and subsequent transitive dependencies were resolved there. Libraries included ATK/AT-SPI, cups, ALSA, GBM, Cairo, Pango, X extension libraries, Avahi, Pixman, Thai/Datri, Harfbuzz and Graphite.

Chromium then initially exited with Crashpad **`chrome_crashpad_handler: --database is required`**. A writable browser HOME/XDG config directory fixed launch, without replacing binaries, servers or bypassing sandbox denials. Validated environment:

`LD_LIBRARY_PATH=/tmp/sq-browser-libs/usr/lib/x86_64-linux-gnu`

`PLAYWRIGHT_BROWSERS_PATH=/tmp/sq-playwright`

`HOME=/home/dev/Hackaton/SwissquoteTrack/AgentsLocal/6b19e47a/browser-home`

`XDG_CONFIG_HOME=/home/dev/Hackaton/SwissquoteTrack/AgentsLocal/6b19e47a/browser-home`

Chromium: Google Chrome for Testing **156.0.8078.4**, installed Playwright browser revision1248. Neither workspace packages nor privileged system packages were installed by this verifier.

## Import/selector diagnosis

The prior generic portable-kit import error was not an unavailable artifact: native Node v26.4.0 source import failed **`ERR_MODULE_NOT_FOUND`** on protocol `types.js` because the TypeScript source uses NodeNext `.js` specifiers. The [owned kit test](<../../swissquote-wallet/tests/browser/offline-kit.test.mjs>) now uses the protocol package's already-installed `tsx/esm/api` loader, loading source rather than potentially stale dist, and preserves exact future import errors. A broad card-generation button selector matched the tab and action; it now targets the actual `#generate` button. Both are test-only fixes, not implementation fixes or masked failures.

## Acceptance boundaries and next action

Existing managed wallet5173/tool5174/SQ4001/partner4002/Hardhat8545 were reused. No replacement server, chain reset, implementation edit, package installation, commit, push, publication or external launch occurred. The integration owner should ensure SQ runs the current WebAuthn challenge-byte adapter, diagnose exact transaction-hash challenge equality, then rerun the clickflow. Initial funding refusal and receipt ABI defect were repaired outside the verifier's implementation scope and no longer reproduced. Do not weaken receipt or hash-binding verification to satisfy acceptance.

No live Sepolia execution or hardware authenticator proof. Identity, face checks, account balance and independent publisher are MOCK. Both local RPC endpoints reach one local node, not independent operators. Browser tampered setup/stale request/wrong guardian, recovery waiting/finalization, cancellation and owner rotation were not executed by this verifier and are not claimed from source review or other integration work. No seed, private key, card words or kit code is disclosed here.
