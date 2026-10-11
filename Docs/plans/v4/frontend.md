# V4 front end — keep our app, polish the judges' path, prove the exit in Safe{Wallet}

Status: historical design brief; implementation approved and underway in isolated `v4-ui`.
**Current source of truth:** [execution status](execution-status.md). Overnight deadlines and old restart/test-count claims below are superseded. V4 restart reuse is opt-in; Safe public visibility is not independent signing or exit proof. The integrated baseline passed 591 frozen tests plus 8 launcher and 3 UI tests (602 total). Optional C1 adds seven regression tests; its final 609-test gate is pending. M1–M3, explicit protective cancellation and privacy-preserving kit masking are implemented; M4 deliberately retains `audit` and `dapps` for evidence/bonus access rather than hiding the only independent check entry. S1 is a separately saved Desk with visibly MOCK publisher governance, not independent production distribution. S2 preserves pinned labels and uses plain-language explanations around them; S3 labels local/public screening accurately rather than calling all sanctions checks mocked. C2 screening already occurs before signing and is labelled in the payment preview. The public browser same-wallet recovery story now passed across retained browser sessions; it is not a single uninterrupted recording.
Planner update 01:45 CEST: the Compound supply was mined in the app (tx `0xa449…94af`), so the demo
profile keeps `dapps`; S1 staging is decided (same laptop); M1 now also blurs the new kit code.
Code facts were checked read-only in `.worktrees/v3/swissquote-wallet` at v3 tip `cb7297a`; no app file has changed since `e379afe`.
Design source: `AgentsLocal/770ad2e6/wf/fe-ux/REPORT.md` and `mockups.html` (rendered: `mockups.png`). Options: `wf/fe-fork/REPORT.md`.

## 1. Result

- **Keep our wallet app and the Independent Recovery Desk.** Our app already has email login, the fingerprint step, free network fees, the Recovery Card and the Emergency Kit. A fork costs 25–40 h and has none of these.
- **Polish only the screens judges see:** the recovery countdown, "Who can move my money?" on Home, and the payment check. They carry the required story and our custody claim, but today they read like test logs.
- **Show the exit in Safe{Wallet}, read-only.** Safe's own app, which we didn't build, shows the same wallet, its owner and every payment. Judges can see that the wallet works without Swissquote.
- **Cost:** 3.0 helper-hours (M1–M3) plus about 10 lead-minutes (M4, the flag settings). The lead merges only if the full test gate passes; if it fails, we demo today's screens.

## 2. Options compared

| Option | Hours | Risk | Effect on score | Verdict |
|---|---|---|---|---|
| Fork Safe{Wallet} | 25–40 | Very high: GPL-3.0; needs Safe's backend; no login, fingerprint step, fee sponsor (relayer), card or kit | Technical and UX fall | No |
| Fork Rabby | 30+ | Very high: browser extension, reserved brand | Falls | No |
| Keep and polish our app | 3 (helper) | Low–medium; protected by the gate | UX rises; keeps Technical, Security and the gasless bonus | **Yes (must)** |
| Hybrid: add the Safe{Wallet} exit proof | 0.5, read-only | Low | Makes "Swissquote gone" visible (Security); no lock-in (Business) | **Yes, read-only** |
| New front end built on Safe's protocol kit | 8–15 | High | None: the app already uses viem | No |
| Candide "Safe Cover" as a second recovery app | 0.5–1 | Low; not run live | Supports Security | Backup slide only |
| Watch the wallet in Rabby | 0.5–1 | Medium, untested; shows amounts only; needs an install | Small | No |

## 3. The judges' path

Windows are separate browser profiles, set up before the slot. Never reload a wallet tab: the login does not survive a reload.
- **Old phone:** wallet L. Create and fund it after the last relaunch, because each relaunch starts with empty service data (`sepolia-demo.mjs:17`, `:71`).
- **New phone:** wallet S1. Today's code runs the old-key test only in the browser profile that holds S1's old, unlocked key (`features/recovery/index.tsx:66`, `:167–168`). It also clears that key, and the new-kit tick, as soon as the tab is hidden (`:41`). So run S1's whole recovery in S1's own profile, in one tab that is never hidden or minimised. Say on stage: "the old phone and the new phone are the same laptop here." Decided: on stage the old-key refusal is a still from the G1 evidence, unless rehearsal proves the S1 tab stayed visible since "Prepare new phone".
- **Desk:** the Independent Recovery Desk (`http://localhost:5274`) plus the Safe{Wallet} tabs.
- **Optional:** Thief (a logged-out window) and B phone (wallet B with its 3-day request).

1. **Old phone · Home.** The judge sees the balance, "Verified as yours", and a new card, "Who can move my money?". It says: you can send; Swissquote can't move your money; neither can the partner; no helper can replace your key without your Recovery Card. *Proves* self-custody (Security & custody). *Change:* M2.
2. **Old phone · pay 6 USDC to a new address.** The judge sees four rows: You send −6.00 USDC · Recipient gets +6.00 USDC · Network fee CHF 0.00, paid by Swissquote · Balance after. An amber "Check carefully" badge says it is the first payment to this address and that, above 5 USDC, Swissquote asks for her fingerprint. She types the last 4 characters, clicks "Confirm with passkey & send" and gives her fingerprint. The screen shows "Payment confirmed on chain." with an Etherscan link. *Proves* log in & sign, and the gasless bonus. *Change:* M3.
2b. **Approved app · still, never live.** A screenshot of the in-app Compound preview, then the mined supply (Etherscan `0xa44904bd…94af`, or Safe{Wallet} history of `0x9C26a4432f7E34f158560efB842c5EF9b2677B51`). Say: "Approved apps work the same way: Swissquote explains the trade in plain words, screens it, and pays the fee." *Proves* the compliant-dApp bonus. *Change:* none.
3. **Thief · "◇ MOCK demo lab" (logged out).** "Request reset · MOCK" → "Open MOCK mailbox" → a new password → the login works, but this device has no wallet key ("A login is not an owner key."). Then show slide S6: the contract refusal from the evidence file. It is not an app screen. *Proves* the attacker bonus. Logged out, the demo tab always shows this screen (`App.tsx:523`), whatever the flags. **Caution:** completing a reset deletes all of that user's sessions (`services/swissquote/src/app.ts:150`). Use wallet L's email only after L's last live screen, or use a spare account.
4. **New phone · Recover access.** The judge sees the five-step timeline at "Waiting — your old phone can still stop this", with a big countdown taken from the blockchain clock. Above it is the red alert, "Someone is replacing your wallet key." (do not press Stop). Then: "Waiting period complete on the last checked block" → "Finish recovery" → "Done — same address". *Proves* lose → recover, using the card plus one helper and a wait (Technical, Security). *Change:* M1.
5. **New phone · "Try the old key".** The screen shows "Refused ✓" and "The wallet contract refused the old key (GS026). Read-only eth_call; no transaction sent." *Proves* the old key no longer works. *Change:* M1.
6. **New phone · pay 1 USDC with the new key.** Same screen as step 2. *Proves* Claire controls the same wallet again. *Change:* M3.
7. **B phone (only if rehearsed) · alert.** A big countdown in days ("2d 23h") and "Stop it — this wasn't me". *Proves* that the 3-day Swissquote route can be stopped. *Change:* M1.
8. **Desk · Independent Recovery Desk.** The judge sees the header "Independent Recovery Desk · works without Swissquote". The Home link "Check it yourself in the Independent Recovery Desk ↗" opens "Public rules check" with wallet L filled in (`main.ts:42-46`; no secrets needed); press the check button. Never open the kit on the projector: the kit tab shows the seed words (`#seed`). For "Swissquote gone", say line 7 and point at the kit-exit transaction 0xbc661bfd…. *Change:* S1.
9. **Desk · Safe{Wallet}, with no wallet connected.** Use `0xad9c2831beeF85Df126BE1f80a443d26e2122dA9`, which we have verified there. Use wallet L only if it loaded there during rehearsal.
   - `https://app.safe.global/home?safe=sep:<address>`: "1/1" and the address.
   - `https://app.safe.global/transactions/history?safe=sep:<address>`: the payments and the "swapOwner" step (the recovery).
   - `https://app.safe.global/settings/modules?safe=sep:<address>`: two "SocialRecoveryModule".
   - `https://app.safe.global/settings/setup?safe=sep:<address>`: "1 out of 1 signer".
   Close the cookie sheet first (necessary cookies only). Leave the "New version is available: 1.5.0" banner. If asked: "Safe offers an optional upgrade of its base contract; we stay on 1.4.1, the version this wallet was built and tested on." Say line S8. *Proves* the wallet does not depend on us (Security; Business: no lock-in). *Change:* M2 (the link).

## 4. Change list

Rules for every item: never edit `App.tsx` (the lead owns it); keep every string in section 5; new elements never use `role="status"`; put new CSS in one new file, `features/polish.css`, reusing colours already in `styles.css` (no restyle).

### Must — helper 3.0 h, lead about 10 min

**M1 · Recovery timeline, big countdown, Stop on the old phone — 1.25 h**
- Files: `apps/wallet/src/features/recovery/core.ts`, `recovery/index.tsx`, `alert/index.tsx`; new `recovery/Countdown.tsx` and `features/polish.css`.
- `core.ts`: add `secondsLeft(deadline: bigint, timestamp: bigint): bigint`, using the same arithmetic as `remaining()` (`deadline + SAFETY_MARGIN − timestamp`, minimum 0; `core.ts:14-18`). Add `clock(seconds)`, which returns "2:41" or "2d 23h 59m". Leave `remaining()` unchanged.
- New phone (`index.tsx:146-168`): above the controls, add a 5-step list:
  1. New phone ready (`replacement`).
  2. Recovery Card approved.
  3. Helper confirmed on the blockchain. Steps 2 and 3 complete together once the chain shows the request, because both approvals run inside `start()` (`:69-90`).
  4. Waiting — your old phone can still stop this. Shows the big countdown and a bar; total = `MODULE_WAITS[A|B] + 15`.
  5. Back in — same wallet address (`done`).
- Keep the `role="status"` line at `:161` as it is. The finish button (`:165`) may become "Finish recovery", with the small text "We check the blockchain clock first". It **must stay enabled under today's conditions**, because the gate clicks it early on purpose (`tests/browser/recovery-complete.test.mjs:266-276`).
- After the old-key check, show a big "Refused ✓" above the unchanged sentence (set at `:142`, shown at `:168`).
- The finish screen projects the new kit code (`:164`). Blur it until a "Show code" button is pressed: a CSS class (`filter: blur(6px)`) on the existing `<strong>`, removed by the button. Keep the `<p>` text and the `<strong>` content unchanged — three tests read the code with `innerText` (`feature-flow.test.mjs:133`, `recovery-complete.test.mjs:234`, `finalize-diagnostic.mjs:237`).
- Old phone (`alert/index.tsx:37-47`): under the unchanged heading, show for each pending request a big "{clock} until the new key takes over" and the helper's name, from `pending.module` (`:41`) and the labels in `core.ts:4-7`. Keep both buttons and their test ids.
- Data already in code: `pollRecovery` (`core.ts:20-44`) returns `snapshot.timestamp` (block time) and `pending.executeAfter`, and runs every 15 s (`core.ts:8`). `MODULE_WAITS = { A: 180, B: 259200 }` is in `packages/protocol/src/constants.ts:19`. No local timer: the number changes on each poll, captioned "updated every 15 s from the blockchain clock".

**M2 · Home card "Who can move my money?" with "Open in Safe{Wallet} ↗" — 0.75 h**
- Files: `apps/wallet/src/features/protection/index.tsx` (render the card first) and a new `protection/WhoCanMove.tsx`. Home already mounts Protection (`App.tsx:508`), so `App.tsx` stays untouched.
- Show the card only when `facts.verified` is true, `facts.ownerThreshold === '1'`, and `facts.owners` (a comma-separated list) equals `context.device.owner`, compared in lower case. Rows:
  - "You — can send money. Only the key on this phone signs payments."
  - "Swissquote — can't move your money. It is a helper: with your Recovery Card it can help replace a lost phone, after 3 days."
  - "The partner — can't move your money. Also a helper: with your Recovery Card, after 3 minutes in this demo."
  - "Without your Recovery Card, no helper — not even both together — can replace your key. You can stop any replacement while it waits." (Source: the audit answer "no", `audit.ts:84`.)
  - Under the rows: small text "Read live from the public Ethereum test network at block {facts.blockNumber}.", then "If Swissquote disappears, your Emergency Kit still opens your wallet without any Swissquote server."
  - Links (`target="_blank" rel="noreferrer"`): "Open in Safe{Wallet} ↗" to `https://app.safe.global/home?safe=sep:${wallet}`, only when `context.chainId === 11155111`; "Check it yourself in the Independent Recovery Desk ↗" to the same URL as `features/audit/index.tsx:22` (`http://localhost:5274/#check=…`, read by `apps/recovery-tool/src/main.ts:42`), so step 8 is one click.
- If the condition fails, show one amber line instead: "Couldn't confirm that only this phone's key controls this wallet — don't assume protection."
- Data already in code: `auditWallet(context.clients, wallet)` (`packages/protocol/src/audit.ts:19`), called the same way in `features/audit/index.tsx:14`. Facts are at `audit.ts:60` (owners, ownerThreshold, blockNumber) and `:81` (verified); answers at `:84-87`. Call it once per Home visit (it reads two public nodes), inside the card's own try/catch — not through `context.run` or `context.notify` — so a failed check never adds a page-level error that the gate's `.status.error` checks could pick up.
- Keep the existing checklist **visible** under the card, not inside a closed "Details". The gate waits for its rows to be visible (`feature-flow.test.mjs:79-83`).

**M3 · Payment review rows and risk badge — 1.0 h**
- Files: `apps/wallet/src/features/pay/index.tsx` (all the review markup is on `:18`); optionally a new `pay/Review.tsx`.
- Replace the review paragraph with four rows:
  - You send: "−{amount} USDC".
  - Recipient gets: "+{amount} USDC" and the short address.
  - Network fee: "CHF 0.00, paid by Swissquote" when `relayAllowed`. Otherwise, in red: "Swissquote won't pay the fee for this payment, so it can't be sent here."
  - Balance after: "{balance − amount} USDC", or "—" if the balance read fails.
- Badge: red "Blocked" for a look-alike address or when `relayAllowed` is false; amber "Check carefully" for a first-time recipient or when `requiresPasskey`; otherwise green "Looks normal". Under it, show the reasons that apply: "First payment to this address — type its last 4 characters." · "Above 5 USDC, Swissquote asks for your fingerprint for this exact payment." · "Looks like an address you paid before — check every character."
- Then show: "Swissquote checks the sanctions list (MOCK) again when you confirm. Payments can't be reversed."
- A closed "Technical details" section holds the exact payment hash, "Sponsorship limits are not on-chain spending limits." and "This preview is not an approval or a receipt."
- Data already in code: `firstTime` (`:15`), `lookalike` (`:16`), `classifyTransaction` → `requiresPasskey` and `relayAllowed` (`:17`), `hashSafeTx` (`:18`). The 5 USDC limit is `USDC_LIMIT = 5_000_000n` (`packages/protocol/src/constants.ts:37`).
- Balance: call `context.clients[0].readContract({ address: ADDRESSES.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [context.wallet] })`, the same call as `App.tsx:139`. `FeatureContext` has no balance field (`context.ts:4-12`).
- No sanctions check before signing: `POST /screen` exists (`app.ts:118`) but the wallet does not call it, and wiring it needs the lead.

**M4 · Demo feature-flag profile — lead, 10 min plus a relaunch**
- In `swissquote-wallet/sepolia-demo.mjs:32` (lead-owned; this line overrides any inherited value), set: `VITE_FEATURES: 'recoveryWizard,dapps,protection,payPreview,strictSponsorship,partnerPrivacy',`
- Effects: without `audit`, the "◎ Trust check" tab disappears (`features/index.ts:17`; M2 replaces it on Home), and the logged-in "Demo lab" illustration (`index.ts:21`) gives way to App's built-in "◇ MOCK demo lab" reset and mailbox screen (`App.tsx:521`, `:528`). `dapps` stays: the Compound supply was mined through this tab at `cb7297a`, and the pitch shows it as a still. The wallet build does not read `strictSponsorship` or `partnerPrivacy`, so they are harmless.
- If the patch is dropped, keep `audit`: `recoveryWizard,dapps,audit,protection,payPreview,strictSponsorship,partnerPrivacy`.
- No test pins this line; `tests/protocol/v3-sepolia-plumbing.test.ts:15-22` checks only `SQ_FEATURES`. The gate runs with all flags on (`scripts/v3-local.mjs:38`), so it never tests this profile. Check the changed screens on Sepolia after the relaunch.

### Should — only after M1–M3 pass the helper's checks

**S1 · Desk header, tab names and messages — helper, 0.5 h.** Files: `apps/recovery-tool/index.html`, `src/main.ts`, `tool-fingerprint.sha256`, `V3-L8-EVIDENCE.md:24`.
- Change the h1 to "Independent Recovery Desk · works without Swissquote". Start the side note with "MOCK" and add "In real life an independent firm publishes this desk. Open it from your own bookmark." Keep its "not audited" sentence.
- Rename the tabs: Make my card · Public rules check · Check my wallet · Approve a new phone · Swissquote gone? Open my kit. Change text only: keep every `data-tab` value and every element id.
- Rename the label "Fingerprint" in the approval review to "4 check words". In the pitch, "fingerprint" means her finger.
- `main.ts:62` may start with "Verified ✓ This wallet is yours and set up as promised…", but it must keep "Both RPC checks passed".
- `:72` → "Request checked on the blockchain. Make sure the 4 words below match your new phone."
- `:82` → "Approved with your card. Paste the code below into your new phone."
- The Desk's content policy (`index.html:2`: `default-src 'none'`, `img-src 'none'`; network access only to the RPC nodes) rules out web fonts, images and new requests.
- Then rebuild, run `sha256sum dist/index.html > tool-fingerprint.sha256`, update the hash at `V3-L8-EVIDENCE.md:24`, and check that `node scripts/verify-tool.mjs` passes. No test reads the fingerprint file.

**S2 · Wallet wording on the judges' path — helper, 0.5 h.** Change unpinned strings only:
- `recovery/core.ts:5`: "3 minutes in this demo" → "3-minute wait (shortened for this demo)". `recovery/index.tsx:158` → "Paste the approval code from the Recovery Desk — never your 12 words"; `:167` → "Try the old phone's key (safe test)".
- `alert/index.tsx:42` → "A new phone asked to take over this wallet. If it wasn't you, stop it now." plus the small text "Swissquote pays the fee to stop it."; `:44` → "No one is trying to replace your key ✓ — checked at block {n}."
- `pay/index.tsx:18`, small text → "Swissquote pays the network fee. Your key stays on this phone."

**S3 · Full MOCK footer — lead, 5 min (`App.tsx:525`).** New text: "Every transaction is real, on the public Ethereum test network. MOCK in this demo: bank account and funding, ID checks, mailbox, sanctions list, helper-key vaults."

### Could
- **C1 · "Move back to my Swissquote account · MOCK" — 0.5 h, in its own file `features/pay/MoveBack.tsx`.** It fills the payment recipient with the MOCK account address from `GET /account` (`app.ts:261`), and only appears if that address is not zero. Small print: "MOCK: in real life Swissquote credits your account; this demo doesn't update the account balance." There is no deposit route: the only account routes are `GET /account` and `POST /account/withdraw` (`app.ts:261-262`). Build it only if M1–M3 are done by 02:15.
- **C2 · Sanctions badge before signing, via `POST /screen` (`app.ts:118`).** Needs the lead.

## 5. Test-pinned strings — do not change

The tests are in `tests/browser/`. Text that is not listed here is free to change.
- **Pay:** test id `pay-preview` (clickflow.test.mjs:171) · labels "Recipient wallet address" (:168; sepolia-service.mjs:286), "Amount in USDC" (:169; exact at :48, :154), "Recipient last four characters", exact (:173) · button "Review payment" (:170) · button names exactly "Confirm with passkey & send" / "Sign & send" (:176, :181; sepolia-service.mjs:290). The approve button stays disabled until the 4 characters are typed (:177) · "Payment confirmed on chain." (:184).
- **Recovery:** test ids `recovery-wizard`, `-prepare`, `-new-owner`, `-start`, `-finalize`, `-card-approval` (feature-flow.test.mjs:93-103), `recovery-helper` (recovery-complete.test.mjs:144, option values), `recovery-wallet` (:305), `recovery-old-key` (:308).
- **Recovery labels:** "New app unlock code · at least 12 characters" (feature-flow:95), "Public recovery request code" (:97), "Unlock saved replacement · app unlock code" (:123; recovery-complete:222), /I compared every group/ (:105), /I saved the new kit file/ (:135), "Create new encrypted kit" and "Download new encrypted kit" (:130-131), "New kit code — store separately" (:133).
- **Recovery behaviour and status text:** finish disabled until the kit is acknowledged (recovery-complete:232); an early finish click must produce the error /waiting period.*15-second safety margin/ (:266-276); status "Waiting period complete on the last checked block" (:287); heading "Done — same address" (:299); "New owner confirmed by both nodes and registered" (:300); "The wallet contract refused the old key (GS026). Read-only eth_call; no transaction sent." (:315). The tests find :287 and :315 as `getByRole('status')` filtered by text, so a second status element with the same text breaks them.
- **Alert:** test id `recovery-alert` (recovery-complete:208), heading "Someone is replacing your wallet key." (:209), test id `recovery-stop` (:211).
- **Home:** test id `protection-panel`, "Card + one helper required on each path", "No pending request on either checked node", /not an automated|Not acknowledged/ (feature-flow:79-83). In App (lead): "Verified as yours" (clickflow:53, :89, :156), "I personally saw a green result in the independent tool." (:52, :102), /Move to my wallet/ (:49, :158), "Account transfer" (:163).
- **Navigation:** the allowed label set (clickflow:38) and the patterns at clickflow:37, :151, :167 and feature-flow:85, :92, :169. So the labels in `features/index.ts` stay as they are.
- **Desk:** every element id and `data-tab` value (clickflow:96-141, offline-kit:43-67, browser:106-129, recovery-complete:162-169, :247-259, :336-339) · /Both RPC checks passed/ (clickflow:101) · /Recorded owner is current at block/ (recovery-complete:337) · error text matching /invalid|valid.*code|paste/i (browser:129) · the saved page must contain `data-tab="verify"` and `check-current-owner` (sepolia-service.mjs:104).

## 6. Merge protocol and kill switch

- **Worktree.** The helper creates a new worktree from the committed v3 tip; the planner did not create it. Command, run in the main checkout `/home/dev/Hackaton/SwissquoteTrack` (branch `main`; `v3` lives in `.worktrees/v3`): `git worktree add -b v4-ui .worktrees/v4-ui v3`. `.worktrees/` is git-ignored (`.gitignore:3`) and no `v4-ui` branch exists yet. The lead's uncommitted files (Docs, protocol, gate, tests) do not overlap the helper's files (checked 01:22 CEST). Install packages with `pnpm install --frozen-lockfile --offline` in `.worktrees/v4-ui/swissquote-wallet` (assumption: the local pnpm store is complete).
- **Allowed files:** listed in section 8. Everything else is off-limits, including all test files.
- **Checks the helper can run without the live ports:**
  - `pnpm --filter @sq/wallet typecheck`, `pnpm --filter @sq/wallet test` (the local integration test skips without `RUN_LOCAL_WALLET_INTEGRATION=1`, `apps/wallet/test/local.integration.test.ts:9`), the feature tests under `apps/wallet/src/features/**`, and `pnpm --filter @sq/wallet build`.
  - For S1 only: `pnpm --filter @sq/recovery-tool typecheck`, `test`, `build`, then `node scripts/verify-tool.mjs`.
- **Checks only the lead's full gate can run:** every `tests/browser/*.test.mjs` (clickflow, feature-flow, recovery-complete, browser, offline-kit and the rest), plus the protocol, security and integration suites. The gate starts its own test chain and apps on 5273/5274/4101/4102/8645 (`scripts/gate.mjs:70`, `scripts/v3-local.mjs:12`).
- **No new tests:** the gate requires exactly 591 passing tests (`scripts/gate.mjs:63`). If the helper adds any, the lead must run the gate with `GATE_EXPECTED_TESTS=<591+N>`.
- **Deliverable, by 03:30 CEST (hard stop 03:45):** one commit on branch `v4-ui`, a `git format-patch -1` file in the helper's `AgentsLocal/<id>/`, and a short note: files, checks that passed, what was skipped.
- **Lead, 03:45–04:30, after G1 and the launcher and doc steps:** (1) stop the live Sepolia launcher — the gate needs the same ports, and Vite reloads edited files into open tabs, so nobody edits the v3 worktree during a live run; (2) `git cherry-pick` the commit, then make the M4 and S3 edits; (3) run `node scripts/gate.mjs` (about 7 minutes; 433 s last time); (4) if it passes: commit, relaunch, check the M1–M3 screens on Sepolia (10 min), then stop the stack; wallets are staged only after the 05:30 launch ([demo-runbook.md](demo-runbook.md)), because every launch starts with empty data.
- **Kill switch.** Drop the patch and demo today's UI, with M4's fallback flags, if: no patch by 03:45 · a conflict outside the allowed files · the gate fails · the Sepolia check shows a broken screen · it is 04:30.

## 7. Not doing

- **Fork Safe{Wallet} or Rabby:** 25–40 h, GPL-3.0, and we would lose login, fingerprint step, free fees, card and kit.
- **Restyle:** gains no points at this hour, and the gate cannot catch visual regressions.
- **Split `App.tsx`:** the lead owns this 554-line file and changed it in `e379afe`, so a split would cause merge conflicts.
- **Phone frame in an iframe:** fingerprint sign-in (passkeys) only works on `http://localhost:5273` (`sepolia-demo.mjs:29`). For a phone view, use `wf/fe-ux/shots/wallet-v2-mobile-390.png`.
- **Switching Swissquote off live on stage:** stopping the services ends sessions, a relaunch wipes service data (`sepolia-demo.mjs:17`), and a reload loses the login. Show the kit-exit transaction and Safe{Wallet} instead.
- **Anything in `packages/protocol` or `services`:** outside this lane, and it changes behaviour the gate tests.
- **DeFi tab polish:** not on the judges' path (brief decision 5).

## 8. UI helper brief (paste-ready)

```text
You are the UI helper for the Swissquote Wallet hackathon team (V4). Deadline: one commit by 03:30 CEST.
First read fully: /home/dev/Hackaton/SwissquoteTrack/Docs/agents/HUMAN_FACING_COMMUNICATION.md
(every section; follow it). Then read /home/dev/Hackaton/SwissquoteTrack/Docs/plans/v4/frontend.md;
sections 3–6 are your spec.

Objective: build must items M1–M3 from frontend.md section 4: the recovery countdown and timeline,
the Home card "Who can move my money?" with "Open in Safe{Wallet} ↗", and the payment review rows
with a risk badge. Do S1, then S2, only if M1–M3 pass the checks before 02:15. Nothing else.

Setup. Never touch .worktrees/v3: the lead's live demo runs from it, and Vite reloads edits into open tabs.
  cd /home/dev/Hackaton/SwissquoteTrack
  git worktree add -b v4-ui .worktrees/v4-ui v3
  cd .worktrees/v4-ui/swissquote-wallet && pnpm install --frozen-lockfile --offline
  (drop --offline only if the store is missing a package). Scratch files: a new AgentsLocal/<8-hex>/ (plain mkdir).

Allowed files (under swissquote-wallet/):
  apps/wallet/src/features/recovery/core.ts, recovery/index.tsx, new recovery/Countdown.tsx
  apps/wallet/src/features/alert/index.tsx
  apps/wallet/src/features/protection/index.tsx, new protection/WhoCanMove.tsx
  apps/wallet/src/features/pay/index.tsx, new pay/Review.tsx
  new apps/wallet/src/features/polish.css (import it from your new components)
  S1 only: apps/recovery-tool/index.html, src/main.ts, tool-fingerprint.sha256, V3-L8-EVIDENCE.md
Forbidden: App.tsx, styles.css, features/index.ts, features/context.ts, sepolia-demo.mjs, packages/**,
  services/**, tests/**, every test file. Add no tests: the gate expects exactly 591.

Design: /home/dev/Hackaton/SwissquoteTrack/AgentsLocal/770ad2e6/wf/fe-ux/mockups.png (and mockups.html).
Where the mockup and frontend.md section 4 differ, the wording in section 4 wins.

Hard rules:
- Keep every string, label, test id and data-tab listed in frontend.md section 5 exactly as it is. Never add
  an element whose accessible name contains a pinned label.
- New elements never use role="status". Never repeat "Waiting period complete on the last checked block" or
  the GS026 sentence. Never add a second heading "Done — same address".
- The finish button stays enabled under today's conditions; the gate clicks it early on purpose.
- The countdown uses block time only: add secondsLeft() with the same arithmetic as remaining(). No local
  timer. Leave remaining() unchanged.
- The protection checklist stays visible, not inside a closed <details>.
- No new network calls except auditWallet (M2) and the USDC balanceOf read (M3). Show the Safe{Wallet}
  link only when chainId is 11155111.
- Wording: plain words and these names: Recovery Card, helper, the partner, Emergency Kit, wait,
  network fee, MOCK. Never write "never holds keys", "never co-signs", "can never take it", "audited",
  "FINMA", "regulated", "SECO" or "simulate".

Checks (no ports needed), run from .worktrees/v4-ui/swissquote-wallet:
  pnpm --filter @sq/wallet typecheck
  pnpm --filter @sq/wallet test
  (cd apps/wallet && node --experimental-test-module-mocks --import tsx --test src/features/demoLab/model.test.ts src/features/dapps/helpers.test.ts src/features/dapps/component.test.tsx)
  pnpm --filter @sq/wallet build
  S1 only: pnpm --filter @sq/recovery-tool typecheck && pnpm --filter @sq/recovery-tool test &&
    pnpm --filter @sq/recovery-tool build; then, in apps/recovery-tool:
    sha256sum dist/index.html > tool-fingerprint.sha256, update the hash at V3-L8-EVIDENCE.md:24,
    node scripts/verify-tool.mjs
Never run browser tests, scripts/gate.mjs or dev servers, and never use ports 5173 5174 5273 5274 4001
4002 4101 4102 8545 8645. The lead runs the full gate.

Deliverable by 03:30 CEST: one commit on branch v4-ui ("V4 UI: M1–M3 [+S1/S2]"), plus
  git -C /home/dev/Hackaton/SwissquoteTrack/.worktrees/v4-ui format-patch -1 -o /home/dev/Hackaton/SwissquoteTrack/AgentsLocal/<your-id>/
Reply with: commit hash, patch path, files changed, the exact checks that passed, what you skipped,
and anything a judge could misread. Do not push or commit anywhere else. If not all of M1–M3 pass
by 03:25, commit only the items that pass and say which.
```

## Open questions

1. **Old-key test — decided 01:45.** "Same laptop" staging for S1; G1 (lead message, rewritten) runs in the old phone's own page and captures the refusal; on stage it is a still unless rehearsal proves the tab stayed visible. On macOS, a fully covered window may count as hidden; untested.
2. **Thief beat.** I did not re-check what the thief sees after logging in with the reset password on a fresh profile; final-lines says the key stays locked. Rehearse it.
3. **Wallet L in Safe{Wallet}.** Only `0xad9c…`, `0x4386…` (and, per the lead's evidence, `0x9C26…`) are known to exist there. Check L once after it is created.
4. **DeFi tab — decided 01:45.** Keep `dapps`: the supply was mined.
