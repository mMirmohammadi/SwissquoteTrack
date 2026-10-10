# Browser verification handoff

## v3 isolated support — current L12 handoff

Current discovery: **18 top-level tests** across six test files: harness 6,
validation 4, browser 4, offline-kit 1, clickflow 1, feature-flow 2. The nested
required-browser regression runs one intentionally failing child test; it is not
an additional discovered gate test. Package scripts still enumerate the older
subset; the lead-owned gate discovers every test file. No manifests changed here.

`BROWSER_REQUIRED=1` or `V3_LOCAL_OWNED_RUN` selects approved defaults:
`BROWSER_WALLET_URL=http://localhost:5273`,
`BROWSER_TOOL_URL=http://localhost:5274`,
`BROWSER_SQ_URL=http://localhost:4101`,
`BROWSER_PARTNER_URL=http://localhost:4102`,
`BROWSER_RPC_URL=http://127.0.0.1:8645`. Explicit loopback values are honored;
required/owned acceptance refuses each legacy or mismatched service port.
Browser request routing blocks external HTTP and unselected loopback ports.
Tests never start services or mutate the chain clock.

Offline validation from `swissquote-wallet/`:

- `for file in tests/browser/*.mjs; do node --check "$file" || exit; done` passed.
- `node --test tests/browser/harness.test.mjs tests/browser/validation.test.mjs`
  passed 10 tests, zero skips.
- With owned writable HOME/XDG_CONFIG_HOME, the installed Chromium and library
  paths below, `BROWSER_REQUIRED=1 node --test tests/browser/harness.test.mjs tests/browser/validation.test.mjs tests/browser/offline-kit.test.mjs`
  passed 11 tests, zero skips. The offline kit check rejects wrong codes and
  altered owner metadata before opening the genuine kit; verifies reset,
  reload, encrypted-only persistence and zero HTTP requests.
- With the same environment,
  `node --test --test-name-pattern='portable recovery HTML creates a card' tests/browser/browser.test.mjs`
  passed the one selected card browser test, zero skips. The other three tests
  were not selected; this is not a full browser suite pass.

Lead-only acceptance after gate starts its isolated stack:
`BROWSER_REQUIRED=1 node --test tests/browser/*.test.mjs`.
`node preflight.mjs` probes services, so do not run it without lead authorization.
It fails required acceptance when browser, HTTP services or portable artifact
are unavailable; it does not make RPC calls or prove a browser launch succeeds.

New feature-flow coverage uses the actual UI/services for recovery preparation,
malformed card-approval refusal before helper/relay submission, reauthentication
and stable replacement after reload, downloaded replacement-kit bytes and
independent offline opening. It also checks protection status and local-network
DeFi signing refusal. The audit test requires the `trust-check` testid rather
than silently accepting a placeholder. At the final reread, audit markup still
lacks that required testid (reported to lead; outside L12 ownership). Feature
flags and landed audit/tool UI are lead-owned prerequisites. These live-stack flows have **not been run** by
L12; no recovery finalization, old-key refusal, Sepolia action or hardware-passkey
evidence is claimed.

Initial offline Chromium launch failed `chrome_crashpad_handler: --database is required`
with inherited HOME; retry with exclusively owned writable browser HOME and
XDG_CONFIG_HOME passed. Scratch directory for this attempt:
[owned scratch](<../../../AgentsLocal/a8c4b197/>). No installs or service launches.

## Earlier local-stack evidence (historical, not v3 acceptance)

Final validation ran against the existing managed local stack. Mandatory five browser tests passed without skips. The additional real-server clickflow passed onboarding, actual SQ virtual-passkey verification, independent wallet checks and downloaded-kit opening, and funding, and small payment, then exposed a large-payment WebAuthn challenge-binding refusal (initial funding/receipt defects no longer reproduced). See [final evidence](<../../../Docs/submission/review-browser.md>) and [actionable findings](<../../../Docs/plans/browser-final-findings.md>). Tests never start servers, reset the chain or install workspace dependencies.

## Lead-coordinated commands

From the workspace root, the lead installs dependencies once after collecting all package manifests. `tests/browser` declares Playwright. If Chromium is already installed, supply `BROWSER_EXECUTABLE=/absolute/path/to/chromium`. Otherwise the lead decides whether to install the Playwright Chromium browser. No browser download was requested by this verifier.

From the wallet workspace, the lead starts exactly one managed instance of each required local service using root `dev:wallet`, `dev:tool`, `dev:swissquote`, `dev:partner`, and `dev:chain` scripts. Use `VITE_CHAIN=local`, approved local `VITE_RPC_URLS`, and loopback URLs. Do not run the browser suite against Sepolia. Tool builder publishes the portable artifact with `pnpm --filter @sq/recovery-tool build`. Offline tests load that artifact directly and disable HTTP network access; they do not stop shared servers.

From this package:

- `node preflight.mjs`: reports browser, wallet/tool server, portable artifact availability. Missing browser exits 1.
- `node --test harness.test.mjs validation.test.mjs browser.test.mjs offline-kit.test.mjs`: fast checks plus browser tests; reports explicit skips when prerequisites are missing.
- `BROWSER_REQUIRED=1 node --test browser.test.mjs offline-kit.test.mjs`: acceptance run; missing prerequisites fail, never skip.

Node 26 can strip TypeScript for the validation test. For environments that require tsx after lead installation, use `node --import tsx --test validation.test.mjs`. Browser runtime checks use Playwright from this package. No tracing or screenshots containing keys are written.

## Current coverage and limits

Implemented runtime checks cover actual wallet IndexedDB storage and passphrase rejection, offline portable card creation/no storage, malformed setup/request UI rejection, and virtual WebAuthn availability. The storage test imports the actual Vite storage module; it is a browser integration check, not an onboarding click-through. The passkey test verifies browser support only, not service registration or hash-bound payment enforcement.

The offline-kit test executed successfully: real protocol kit, wrong-code rejection, seed/owner matching, reset, reload, no storage and no HTTP requests. Source imports use the protocol package's existing `tsx/esm/api` loader; native Node TS stripping cannot resolve its NodeNext `.js` source specifiers.

[Additional clickflow](<clickflow.test.mjs>) is separate from mandatory5. Run `node --test clickflow.test.mjs` with the same browser environment and existing managed deployed stack. It uses fresh customer/context state, an offline separate card page, actual SQ WebAuthn registration/step-up endpoints, real chain operations and downloaded encrypted-kit bytes. No raw-credential API mock. It stops at the first failed stage and does not log secret values. Remaining unproved browser acceptance: funding/payments until preflight is fixed, recovery/cancel/rotation, tampered setup/stale nonce/wrong guardian rejection. No live Sepolia or hardware authenticator proof.

On this host launch requires `LD_LIBRARY_PATH=/tmp/sq-browser-libs/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/sq-playwright` plus writable `HOME` and `XDG_CONFIG_HOME` (validated using the verifier's scratch browser-home directory). Libraries were downloaded with `apt download` and extracted with `dpkg-deb -x` under `/tmp/sq-browser-libs`, not installed on the host. The full Chrome executable works with writable HOME; the original crash was Crashpad `--database is required`, not a wallet defect.

Tool selectors are matched to published UI IDs: `#words li`, `#setup`, `#check-words`, `#check-button`, `#request`, `#approve-words`, `#review-button`, `#status`. If builders change IDs, update only this package after reading the new implementation.
