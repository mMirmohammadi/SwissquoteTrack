# Compound preview timeout: read-only diagnosis

## Decision

**Fix the harness Action selector before considering another funded run.** The exact label lookup at line 398 does not match the UI's nested-select label in an isolated Chromium reproduction. The preview button's fail-closed gates should remain intact. This explains a timeout before any preview POST without requiring a registry or funding problem, but the existing artifact does not record the exact failed line, so this is not proof of the historical live-run cause.

No existing service was restarted, stopped, reset, or reconfigured. No code, tests, or Git state was changed. This report is the only durable project file created. No authentication, registration, enrollment, deployment, funding, preview request, signing, RPC request, or private retention-file access was performed.

## What the existing artifact proves

The public [attempt artifact](<../../AgentsLocal/46257332/v3/sepolia-compound-5.json#L13-L103>) records successful deployment and MOCK-account funding receipts, wallet `0xb0675EBB42F9513c3187B46223cc376BE202185a`, a before-supply balance of `1000000` USDC base units, zero position/borrow/allowance/nonce, successful independent-tool checks, and saved encrypted retention. Its blocker is `existing DeFi UI exact supply preview`, category `bounded_browser_timeout`.

The artifact records only `/relay/deploy: 1` and `/account/withdraw: 1` in `broadcastRequests`. This counter covers write paths, not preview requests: see [counter definition and increment](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L27-L29>) and [increment logic](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L153-L157>). Consequently the artifact alone does **not** establish that no preview request occurred. The parent supplied the additional observation that no preview POST or Safe relay was observed; this investigation did not read private logs to corroborate it.

The stage begins before navigation and remains unchanged through the preview response. It spans navigation click, panel wait, action selection, amount entry, notice assertions, and preview click/response: [exact harness sequence](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L394-L409>). `bounded_browser_timeout` identifies a Playwright TimeoutError but not the particular operation: [redacted classification](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L465-L473>).

## Proved current observations

Anonymous GETs against the existing stack returned:

- `http://localhost:4101/health`: HTTP 200, `ok: true`, chain `11155111`, `mock: true`, `strictSponsorship: true`, service features `["strictSponsorship"]`.
- `http://localhost:4102/health`: HTTP 200, partner MOCK status `ok`.
- `http://localhost:4101/dapps`: HTTP 200 with Uniswap and Compound. Compound id `compound`, chain `11155111`, address `0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e` exactly match the local pinned [registry](<../../swissquote-wallet/packages/protocol/src/dapps.ts#L10-L22>).
- Served wallet assets at `http://localhost:5273/src/features/context.ts`, `/src/api.ts`, `/src/App.tsx`, and `/src/chain.ts` contain `VITE_CHAIN: "sepolia"`, `VITE_FEATURES: "recoveryWizard,dapps,audit,protection,payPreview,strictSponsorship,partnerPrivacy"`, SQ URL `http://localhost:4101`, partner URL `http://localhost:4102`, and the intended PublicNode/EthPandaOps RPC URL pair.

Service health flags are not the UI feature-toggle source. UI enablement reads the served `VITE_FEATURES` string: [featureEnabled](<../../swissquote-wallet/apps/wallet/src/features/context.ts#L14-L16>). DeFi maps to `dapps`: [feature registration](<../../swissquote-wallet/apps/wallet/src/features/index.ts#L14-L22>). The service GET registry is public and does not require a dapps flag: [GET route](<../../swissquote-wallet/services/swissquote/src/app.ts#L110-L126>).

A new anonymous Chromium context, with service workers blocked and network restricted to GETs on existing wallet/service origins, found one Wallet-navigation DeFi button and clicked it. The DeFi panel did not render before a bounded panel timeout. This is expected for an anonymous user: [App rendering](<../../swissquote-wallet/apps/wallet/src/App.tsx#L504-L505>) puts the feature under the session branch. It is **not** evidence that the funded authenticated run had a navigation/panel failure. No actual private IndexedDB/auth was restored.

## Reproduced selector defect

The UI contains a wrapping label with a nested select and its options: [Action markup](<../../swissquote-wallet/apps/wallet/src/features/dapps/index.tsx#L148-L153>). The harness uses [line 398](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L398>) `panel.getByLabel('Action', { exact: true }).selectOption('supply')`.

An isolated page containing that source markup was checked with the approved Chromium binary and the existing Playwright-core 1.64.0 dependency. All network access was blocked. Results:

- `getByLabel('Action', { exact: true }).count()` returned **0**.
- `getByLabel('Action').count()` returned **1**.
- Exact Amount label lookup returned **1**.
- The select accessibility snapshot identified a **combobox named "Action"**.

This distinction occurs because Playwright label-text matching includes descendant option text for the wrapping label, while the select's accessible name is "Action". Therefore a role-based combobox selector is the precise bounded fix. This reproduction used source markup, not a mounted authenticated React feature; it demonstrates the selector failure mechanism, not the exact past stopping line.

## Disabled-preview alternatives and uncertainty

The [preview gate](<../../swissquote-wallet/apps/wallet/src/features/dapps/index.tsx#L24-L45>) requires Sepolia, a wallet, a session, a public client, an intersected registry entry, no shell busy state, no feature work, and no unresolved prior submission. [Registry intersection](<../../swissquote-wallet/apps/wallet/src/features/dapps/helpers.ts#L51-L58>) requires matching id, chain and case-insensitive address; the current anonymous registry and served configuration satisfy the static network/registry expectations.

The UI's client list is supplied by the shell, not by health flags: [feature context](<../../swissquote-wallet/apps/wallet/src/App.tsx#L490-L495>). Busy state is cleared in the shell action finally block: [run](<../../swissquote-wallet/apps/wallet/src/App.tsx#L112-L122>). Private historical session/wallet/busy/registry-loading state was not observed, so a disabled button cannot be ruled out for that historical run.

Even a successful click can fail before a preview POST: [preview function](<../../swissquote-wallet/apps/wallet/src/features/dapps/index.tsx#L49-L78>) reads block number and Safe nonce first, then builds the batch. The feature uses the first client rather than shell fallback. Thus no preview POST is not, by itself, proof of a disabled button. None of those RPC operations was attempted in this investigation.

## Next bounded fix and stopping condition

The next authorized change should be harness-only: replace line 398 with `panel.getByRole('combobox', { name: 'Action', exact: true }).selectOption('supply')`. First validate that selector against the same isolated source markup, without creating users or wallets.

Also narrow the harness stage immediately before each operation from navigation through preview, and capture only allow-listed boolean diagnostics (panel visible, selector count, preview enabled, registry warning present, shell busy indicator present). Do not persist arbitrary UI errors, auth responses, payloads, seeds, or private storage. This would distinguish a selector timeout from a disabled button and from pre-POST RPC reads.

Stop before any funded retry until the selector probe passes and any remaining preview blocker is identified. A future live continuation should use the existing retained funded wallet only under explicit authorization for private local restoration and the relevant action; this investigation grants neither. Preserve the running 5273/5274/4101/4102 processes. Do not bypass registry checks or forcibly enable the button.

## Investigation implementation notes

Approved Chromium path: `/tmp/sq-playwright/chromium-1248/chrome-linux64/chrome`; library path `/tmp/sq-browser-libs/usr/lib/x86_64-linux-gnu`. A fresh exclusively created browser HOME is under [owned attempt directory](<../../AgentsLocal/a43e1cb7/>). Browser processes launched by this investigation were closed; existing stack processes were untouched. Initial probe setup exposed an incorrect temporary-directory relative path and unavailable top-level `playwright` import; the probe used the already installed Playwright-core dependency instead. No dependency was installed.
