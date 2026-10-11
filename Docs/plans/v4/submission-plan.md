# Submission plan v4: DoraHacks text, README, doc fixes

Historical planning draft, not the final submission. Execution approval does not authorize publication or submission. Use [current execution status](execution-status.md) and the verified V4 submission pack when handed off; old deadlines, unbounded custody claims, business figures and separate-chain launch instructions below are superseded.
Written 01:20 CEST, revised 01:40 CEST, Sun 11 Oct 2026, by the submission editor. Every v3 fact below was read (not run) in `.worktrees/v3` at commit `cb7297a` (pushed, clean).

## 1. Result

- **Before the 09:30 CEST paste,** the lead agent applies the "must" fixes (section 4), adds the root README (section 3) and exports the diagram as a PNG (section 5) on branch `v3`, runs a secret scan, then pastes section 2 with the placeholders filled.
- **Humans** fill the AI-tools table, publish and link the video, and decide whether the repository becomes public.
- **Blocker:** https://github.com/mMirmohammadi/SwissquoteTrack is private, so judges get a 404 on every repository link. Either the user publishes the repository, or the team gives judges another route (for example, a public copy of branch `v3` without `AgentsLocal/` and `.env*`).

## 2. DoraHacks text (paste-ready)

Placeholders: `<REF>` = published branch or commit · `<N>` = freeze-gate test count · `<VIDEO_URL>` · `<ARCH_PNG_URL>` · `<G1>` = in-app recovery gate on Sepolia (due 02:45), two variants: **passed** → row 4 reads "Public Sepolia, via the app" with the new transaction link, and the `<G1>` item leaves "Not done yet"; **not passed** → row 4 reads "Sepolia by script" with the current link, and the item becomes "recovery through the app on the public chain". The form fields (name, vision, Markdown details, links) are an assumption: the DoraHacks page was behind a CAPTCHA (`Docs/desc.md:9`).

**Project name:** Swissquote Wallet

**Vision (24 words):** Clients keep their own keys; Swissquote helps them recover access without holding any key that can move money alone, and keeps them as clients.

**Details (Markdown):**

**Swissquote Wallet puts the client's crypto keys in her hands, inside the Swissquote app: her phone pays, a Recovery Card plus one helper bring her back, and an Emergency Kit lets her leave without Swissquote.**

### Demo story

Claire is a fictional client; Sepolia is the public Ethereum test network. Video: <VIDEO_URL>

| Step | Where it ran | Proof |
|---|---|---|
| 1. Create the wallet; the app proves it is hers | Public Sepolia, via the app | [wallet](https://sepolia.etherscan.io/address/0x4386810dc7185d4cE2a313645f9D9504d386C219) |
| 2. Pay 1 USDC holding zero ether; Swissquote pays the fee | Public Sepolia, via the app | [payment](https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e) |
| 3. Above 5 USDC, Swissquote also asks for her fingerprint | Local test chain | [tests](https://github.com/mMirmohammadi/SwissquoteTrack/tree/<REF>/swissquote-wallet/tests/browser) |
| 4. Phone lost: card + partner, real 3-minute wait, new key; old key refused | Sepolia by script `<G1>` | [recovery](https://sepolia.etherscan.io/tx/0x1231c281bbb949ea3c64917618b4f626cc70a77a0621b7a2d763ae95de3c743e) |
| 5. Her old phone stops a takeover | Sepolia by script | [stop](https://sepolia.etherscan.io/tx/0x4bbdd6bd0b25a2981e7f7f6fa4dc2b9c9fe75b6b5252e543f930fe1838980681) |
| 6. Without her card, both helpers together are refused | Sepolia by script, read-only | [record](https://github.com/mMirmohammadi/SwissquoteTrack/blob/<REF>/swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L176-L198) |
| 7. Swissquote gone: Emergency Kit + plain Ethereum node move 3 USDC | Sepolia by script | [exit](https://sepolia.etherscan.io/tx/0xbc661bfd7f78d65385f7f7bcb4bcc6231205312e6a3e510401b34b8268e9110c) |
| 8. No lock-in: the standard Safe{Wallet} app shows her wallet | Public Sepolia, read-only | [Safe{Wallet}](https://app.safe.global/home?safe=sep:0x4386810dc7185d4cE2a313645f9D9504d386C219) |

`<N>` automated tests pass.

### Custody and threat model

**Could Swissquote, alone or with the partner, move Claire's money? No.** Her wallet (a Safe smart account) has one owner: her phone's key. Swissquote holds no key that can move money alone, and never co-signs payments. Recovery needs her Recovery Card plus one helper; the helpers sit on separate locks (card + partner, card + Swissquote), so even together they cannot replace her key (step 6).

- **Who could steal:** someone with her unlocked phone key, her Emergency Kit and its code, or her card plus a fooled helper, unless her phone stops it.
- **Who could lock her out:** only losing her phone, Emergency Kit and card together. Swissquote cannot freeze the wallet; if it stops paying fees, she pays her own.
- **Trade-off:** no Swissquote key to steal, but an unlocked phone spends at once.

### Architecture

Architecture image placeholder: `ARCH_PNG_URL` (historical draft; use the current packaged architecture for delivery).

Every transaction shown is real, on the public Ethereum test network; only the back office — bank account and funding, ID checks (KYC, face check), mailbox, helper-key vaults, demo sanctions-list entries — is simulated and marked MOCK. Swissquote's service also checks a live public on-chain sanctions list and USDC's freeze list.

### Wallet and identity

Her browser creates her key and keeps it encrypted on her device. The separate Recovery Desk page prints her 12-word Recovery Card; Swissquote sees only a public code. Swissquote's service creates the wallet; each helper's key sits in its own service. **Ownership proof:** the wallet signs a one-time Swissquote challenge, checked on the chain (EIP-1271): "Verified as yours". Her Emergency Kit is her key, encrypted under a separate code.

### Authentication

Login (password or fingerprint) opens her account, not her wallet. Up to 5 USDC (demo limit), her phone's key signs. Above that, and for key changes, Swissquote also asks for her fingerprint for that exact transaction (a Swissquote fee rule, not a contract rule).

### Recovery

- **Phone lost or stolen:** card + one helper, after a wait (3 minutes with the partner on stage, 3 days with Swissquote); the helper checks her ID (MOCK); her old phone can stop a takeover.
- **Swissquote gone:** her Emergency Kit opens on her computer; standard tools move her money; she pays the network fee (step 7).
- **Thief with her phone and email:** the email reset opens her login, not her wallet; without the card, both helpers are refused (step 6).

### Legal

The client's phone or Recovery Card is in every path that moves money, so we argue this is software, not custody, and Claire, not Swissquote, is the sender. That is our reading; FINMA confirmation is launch step one.

- **Basis:** Federal Council DLT report (2018), pp. 66–67, 137; FINMA 08/2023 §2.2.
- **Travel Rule:** Swissquote pays out to or accepts from her wallet only after the ownership proof (FINMA 02/2019).
- **Risk:** FINMA may see the fee service as a payment service; fallback: fees only for payments to verified recipients.

### Business

Ten thousand clients who stay instead of leaving, each trading ten thousand francs a year at Swissquote, bring in about 640,000 francs a year at 2025 rates.

10,000 is 1.4% of 690,828 trading accounts; at H1 2026 rates, about CHF 0.2–0.3 m. Each sponsored payment costs about 2 US cents; Recovery Assistance (CHF 4.90 a month) is upside.

### Bonuses

- **Gasless, proven live twice:** Swissquote's fee account sent the signed payment (step 2) and the DeFi supply below; in both, the wallet and its key held 0 ETH. Limits: login, ID check, daily caps per client and overall, sanctions screening.
- **Compliant DeFi, in our app, on the public test network:** after a plain-words preview, the approved-apps check and live sanctions checks, a second test wallet supplied 1 USDC in one signed batch that resets its approval to zero ([supply](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af)). Limits: a third-party Compound III test deployment, not an official market; no withdrawal or swap.

### What is simulated and what is not done yet

> **Simulated (MOCK):** the back office listed above; helper-key vaults are a database.
> **Not done yet:** finishing the 3-day Swissquote recovery and the fingerprint step on the public chain; the Emergency Kit exit through the Recovery Desk page; `<G1>`; FINMA confirmation; a security review.

### AI tools used

| Team member | Tools | Used for |
|---|---|---|
| `<name>` | `<tools>` | `<use>` |
| `<name>` | `<tools>` | `<use>` |
| Team-run AI agents | DeepSeek Harness (claude-opus-5-5, gpt-6.1-sol), Archify, AWS AgentCore web search | `<confirm>` |

### Links

Code: https://github.com/mMirmohammadi/SwissquoteTrack/tree/<REF> · [Submission](https://github.com/mMirmohammadi/SwissquoteTrack/blob/<REF>/Docs/submission/SUBMISSION.md) · [Threat model](https://github.com/mMirmohammadi/SwissquoteTrack/blob/<REF>/Docs/submission/threat-model.md) · [Legal](https://github.com/mMirmohammadi/SwissquoteTrack/blob/<REF>/Docs/submission/custody-travel-rule.md) · [Business](https://github.com/mMirmohammadi/SwissquoteTrack/blob/<REF>/Docs/submission/business-case.md) · [Evidence](https://github.com/mMirmohammadi/SwissquoteTrack/tree/<REF>/swissquote-wallet/evidence/sepolia)

## 3. Root README, first screen (new file `README.md` at the repository root)

```markdown
# Swissquote Wallet

**Clients keep their own crypto keys in the Swissquote app; Swissquote helps them recover access but holds no key that can move money alone.**

Payment image placeholder: `SCREENSHOT_PATH` (historical draft; do not publish an unresolved placeholder).

Proof on the public Ethereum test network (Sepolia):
[Payment with zero ether, fee paid by Swissquote](https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e) ·
[DeFi: 1 USDC supplied in the app to a third-party Compound III test deployment, fee paid by Swissquote](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af) ·
[Recovery after a real 3-minute wait](https://sepolia.etherscan.io/tx/0x1231c281bbb949ea3c64917618b4f626cc70a77a0621b7a2d763ae95de3c743e) ·
[Old phone stops both recoveries](https://sepolia.etherscan.io/tx/0x4bbdd6bd0b25a2981e7f7f6fa4dc2b9c9fe75b6b5252e543f930fe1838980681) ·
[Exit with the Emergency Kit, no Swissquote server](https://sepolia.etherscan.io/tx/0xbc661bfd7f78d65385f7f7bcb4bcc6231205312e6a3e510401b34b8268e9110c)

Every transaction shown is real, on the public Ethereum test network; only the back office — bank account and funding, ID checks (KYC, face check), mailbox, helper-key vaults, demo sanctions-list entries — is simulated and marked MOCK. Swissquote's service also checks a live public on-chain sanctions list and USDC's freeze list.

## Run it (Node 26, pnpm 12)

    cd swissquote-wallet
    pnpm install
    npm --prefix contracts install && npm --prefix contracts run compile
    npm --prefix contracts run node   # local test chain; leave it running
    pnpm devnet                       # second terminal: put the contracts on the local chain
    pnpm demo:local                   # wallet app, Recovery Desk and both helper services
    pnpm test && pnpm test:contracts  # unit and contract tests; full gate: <N> automated tests pass

Code to read first: `packages/protocol/src/crypto.ts` (key handling) · `services/swissquote/src/policy.ts` (fee rules) · `tests/browser/recovery-complete.test.mjs` (full recovery in the browser).

[Submission](<../../submission/SUBMISSION.md>) · [Architecture](<../../submission/architecture.md>) · [Threat model](<../../submission/threat-model.md>) · [Legal](<../../submission/custody-travel-rule.md>) · [Business](<../../submission/business-case.md>) · [Evidence](<../../../swissquote-wallet/evidence/sepolia>) · [AI tools](<../../submission/ai-tools.md>)

`Docs/plans/` and `.agents/` are working notes of the team's AI agents.
```

Run-it lines copy `swissquote-wallet/README.md:9-25` and the `package.json` scripts (`demo:local` = `node local-demo.mjs`, `test`, `test:contracts`, `packageManager pnpm@12.6.0`). They were read, not run; the chain/devnet order is the old README's. The lead runs them once from a clean clone before 09:00 and removes any step that is wrong.

## 4. Fix list for v3 docs (re-checked 01:31–01:34 CEST at `cb7297a`)

"must" = judge-facing and wrong or contradictory; "should" = weaker or internal. Paths are relative to the v3 worktree. `cb7297a` changed only `implementation-status.md`, `claims.md`, `compound-acceptance.md` and the new Compound evidence (`Docs/research/v3-live-compound-evidence.md`, `swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json`); every other quoted line is unchanged.

| # | File:line | Change | Priority | Checked |
|---|---|---|---|---|
| 1 | `Docs/submission/SUBMISSION.md:33` | Gasless reads as missing ("Public proof must show RELAYER…; treasury-scripted setup is not that proof") → "Proven live twice: Swissquote's fee account sent a 1-USDC payment and a 1-USDC DeFi supply; in both, the wallet and its key held 0 ETH" + tx `0xe318…` and `0xa449…` links | must | re-checked 01:31–34 |
| 2 | `Docs/submission/SUBMISSION.md:43` | "the new browser recovery test is underway" → result: full in-app recovery passes in the automated browser test on the local test chain (`tests/browser/recovery-complete.test.mjs`) + `<G1>` outcome; drop the internal status list (its DeFi clause: row 20) | must | re-checked 01:31–34 |
| 3 | `SUBMISSION.md:7` (27 tests), `Docs/submission/README.md:5`, `:36` (228 + 42, "two L13 regressions"), `threat-model.md:49` ("two regressions under repair"), `bonus.md:3` and `IMPLEMENTATION.md:23` (433) | One count only: `<N> automated tests pass` from the freeze gate. Latest passing gate: 591 tests, zero skips (`bash-1746`, commit `1863acf`); the freeze gate replaces it. `claims.md` is done: 591 is current there, 433 is labelled history | must | re-checked 01:31–34 |
| 4 | `Docs/plans/v3/implementation-status.md:49` | Dropped: fixed at `cb7297a` (the 591-test gate and the live supply are now "accepted evidence") | — | re-checked 01:31–34 |
| 5 | `Docs/submission/SUBMISSION.md:23` | "regulated recovery helper" (banned) → "Swissquote, a regulated bank, is one of two recovery helpers and pays network fees; it holds no key that can move money alone" | must | re-checked 01:31–34 |
| 6 | `Docs/submission/SUBMISSION.md:17` | "passkey for login and large/admin sponsored transactions" → login is email and password, passkey optional (`apps/wallet/src/App.tsx:504`); a passkey is asked for payments above 5 USDC (`:514-515`) and key changes (`:517`) | must | re-checked 01:31–34 |
| 7 | `Docs/plans/v3/build-plan.md:359`, `:685` | Cites FINMA Guidance 01/2026 for "not custody" (wrong source; it covers bank custody rules) → cite FINMA 08/2023 §2.2 and the Federal Council DLT report pp. 66–67, 137 | must; also add this basis to `custody-travel-rule.md:7`, which cites only 01/2026 | re-checked 01:31–34 |
| 8 | `Docs/submission/custody-travel-rule.md:1` | Caveat-first title ("proposed regulated helper, not approved custody classification") → "Swiss legal position: software, not custody; Claire is the sender" | must | re-checked 01:31–34 |
| 9 | `custody-travel-rule.md:21`, `SUBMISSION.md:25` | "is open" / "remains open" (relay as sending institution) → position (Claire is the sender; the relay cannot change payee or amount) + risk (FINMA may see a payment service) + fallback (fees only to verified recipients) | must | re-checked 01:31–34 |
| 10 | `custody-travel-rule.md:23`; `Docs/pitch/judge-questions.md:55`; `Docs/pitch/storyboard.md:59`; `Docs/submission/pitch-script.md:67` | "for counsel" / "need counsel" / "remain counsel questions" / caveat-first → same position + risk + fallback pattern | should | re-checked 01:31–34 |
| 11 | `custody-travel-rule.md:27` | "Planned address screening uses OFAC/EU/UN-derived on-chain sources, issuer freeze checks and explicitly MOCK SECO client-name/list checks" → "Addresses are checked live against a public on-chain sanctions list and USDC's freeze list; only the demo entries on the sanctions list are MOCK; production adds the SECO list" (source: `swissquote-wallet/services/swissquote/src/screening.ts:36-59`) | must (contradicts the DoraHacks MOCK line) | re-checked 01:31–34 |
| 12 | `custody-travel-rule.md:15` | Add: payments to third-party wallets are Claire's own transfers; the ownership proof applies at the bank door only | should | re-checked 01:31–34 |
| 13 | `SUBMISSION.md:7`; `IMPLEMENTATION.md:23`; `bonus.md:23`; `claims.md:14,16,20,23,28,34`; `review-browser.md:7,25,37,39` (all `Docs/submission/`) | Links into git-ignored `AgentsLocal/` (dead for judges) → copy the needed excerpt into tracked `swissquote-wallet/evidence/` after a secret scan, or delete the link | must | re-checked 01:31–34 |
| 14 | `Docs/plans/v3/implementation-status.md:5,7,33,37,41` | Same `AgentsLocal/` links | should | re-checked 01:31–34 |
| 15 | `swissquote-wallet/README.md:5` | "Complete browser recovery/rotation and live Sepolia remain unverified" + links to v2 docs → current state in one line + link to the root README | must | re-checked 01:31–34 |
| 16 | `swissquote-wallet/README.md:32`, `:52`, `:70` | Local ports 5173/5174/4001/4002/8545 not found in `dev.mjs`/`local-demo.mjs` (unverified) → check at the clean-clone run; remove lane boilerplate at `:52` and `:70` ("No commits… by this lane") | should | README lines re-checked 01:31–34; ports in `dev.mjs` not re-checked |
| 17 | `Docs/submission/architecture.candidate.json:11` and `architecture.html:5113-5121` | "Local 31337; no live proof here" → regenerate from section 5 (Sepolia is live) and export `architecture.png` for the DoraHacks image | must | re-checked 01:31–34 |
| 18 | `Docs/submission/SUBMISSION.md:29`; `Docs/pitch/judge-questions.md:59`; `Docs/pitch/storyboard.md:57` | CHF 406,207 subscription / CHF 4.90 headline → retention headline first (section 2, Business); CHF 4.90 as upside | must for `SUBMISSION.md`, should for pitch | re-checked 01:31–34 |
| 19 | `Docs/submission/SUBMISSION.md:39`; `Docs/submission/ai-tools.md:10` | One model listed; "Disclosure pending integration-owner confirmation" → the per-member table, filled by humans | must | re-checked 01:31–34 |
| 20 | `Docs/submission/bonus.md:3`; `SUBMISSION.md:35`, `:43`; `IMPLEMENTATION.md:23`; `Docs/submission/README.md:5`; `Docs/submission/pitch-script.md:53`, `:71` | Say DeFi never reached the chain ("Compound INCOMPLETE… before any funding or supply POST", "no Compound funding or supply occurred", "mined DeFi are not confirmed", "no mined DeFi result is claimed") → one 1-USDC supply in our app on Sepolia (tx `0xa449…`; link `Docs/research/v3-live-compound-evidence.md`): a third-party Compound III test deployment, not an official market; no withdrawal or swap. Recovery: proven on Sepolia by script (and `<G1>`) | must | re-checked 01:31–34 |
| 21 | `Docs/submission/pitch-script.md:27` | "The script's treasury paid the outer transaction fee; this is not proof of Swissquote service sponsorship" → now proven live twice by Swissquote's fee account (tx `0xe318…`, `0xa449…`) | should | re-checked 01:31–34 |
| 22 | `Docs/submission/README.md:1`, `:3` | "judge tour" title; opening negation "not MPC, ERC-4337 or a guarded-wallet design" → position-first sentence as in the root README | should | re-checked 01:31–34 |
| 23 | `Docs/submission/threat-model.md:38` | Add the production line: helper key in a hardware vault (HSM) under dual control; identity check before every co-signature | should | re-checked 01:31–34 |
| 24 | `apps/wallet/src/App.tsx:525`, `:553` (code) | Footer "Bank account, KYC, face checks and mailbox: MOCK." lacks helper-key vaults and the demo sanctions entries; button label "Test helper-only recovery · eth_call only" is jargon → only inside the 02:45–03:30 merge window, through the full gate | should | re-checked 01:31–34 |

## 5. Architecture diagram spec (for the archify skill)

- Title: "Swissquote Wallet: what is real and what is MOCK". Legend: solid border = real and running; dashed border = MOCK.
- Real boxes: **Claire's phone: wallet app** (her key, encrypted on the device) · **Independent Recovery Desk** (separate page: Recovery Card, Emergency Kit) · **Swissquote service** (login, fee payer, fee rules, ownership check) · **Partner service** (second helper) · **Public Ethereum test network (Sepolia)** containing **Claire's wallet (Safe)**, **Lock A: card + partner, 3-minute demo wait**, **Lock B: card + Swissquote, 3-day wait**, **USDC**, **Compound III test market (third-party)** · **Live checks: public on-chain sanctions list, USDC freeze list** (attached to the Swissquote service) · **Safe{Wallet} or any Ethereum node** (exit without Swissquote).
- MOCK boxes (dashed): **Bank account and funding**, **ID checks (KYC)**, **Mailbox**, **Demo sanctions-list entries** → attached to the Swissquote service; **Face check** → partner service; **Helper-key vault** → one under each helper service.
- Arrows (solid): phone → Swissquote service "signed payment or DeFi batch" → wallet "sends it and pays the fee"; wallet → test market "supply 1 USDC"; phone → Swissquote service "proves the wallet is hers" → wallet "checked on the chain"; Recovery Desk → partner and Swissquote "card approval code (never the card words)"; each helper → its lock "approves recovery after the wait"; phone → locks "stops a recovery during the wait"; Recovery Desk → Safe{Wallet}/node → wallet "Emergency Kit exit; she pays the fee".
- Never draw an arrow from Swissquote and the partner to the same lock.
- Output: tracked `Docs/submission/architecture.png` + `.html`, replacing fix 17.

## 6. Final pre-submit checklist (09:00–09:30 CEST)

1. Re-check on a public block explorer: wallet `0x4386810dc7185d4cE2a313645f9D9504d386C219` and owner key `0x529Cfe31F83fe0d490a088A0e8f2F6ec20886e48` still hold 0 ETH; tx `0xe318…` and supply tx `0xa449…` (wallet `0x9C26a4432f7E34f158560efB842c5EF9b2677B51`, also 0 ETH) show success from fee account `0x6fc61dce369786cfbf43536478c4cd521b4336f7`.
2. Take `<N>` from the final freeze-gate log only (zero skipped); grep the text, the README and `Docs/submission/` for any other count (`433|518|519|591|228|27 tests`).
3. Secret scan on the exact branch to publish: no `.env*`, keys, Recovery Card words or Emergency Kit codes; `git ls-files` lists no `AgentsLocal/` or `swissquote-wallet/.sepolia-runs/`.
4. The user decides repository visibility; after publication, open every link in the text and the README from a private browser window.
5. Every human has filled their AI-tools row; no `<name>`, `<tools>`, `<use>` or `<confirm>` left.
6. Banned-claim grep returns nothing: `grep -niE "never holds|can never take|requires a (passkey|fingerprint)|regulated recovery helper|FINMA[- ]compliant|Travel Rule solved|SECO[- ]screened|first in Switzerland|audited|official Compound market|DeFi is fully supported|withdrawals work"`; for `never co-sign` the only allowed hit is "holds no key that can move money alone, and never co-signs payments".
7. The DeFi bullet keeps its limits (third-party Compound III test deployment, not an official market; no withdrawal or swap) and says a second test wallet, not Claire's story wallet, made the supply.
8. Set row 4 of the story table and the "Not done yet" box from the G1 outcome.
9. The video plays from a private window; any local-test-chain part is labelled as such on screen.
10. `<ARCH_PNG_URL>` shows the regenerated diagram, with MOCK boxes dashed.
11. No placeholder left: grep for `<REF>`, `<N>`, `<VIDEO_URL>`, `<ARCH_PNG_URL>`, `<G1`, `<SCREENSHOT_PATH>`.
12. Preview the DoraHacks Markdown: tables render, details stay at or under 900 words.

## Open questions / objections

- **Repository visibility (user):** publish `mMirmohammadi/SwissquoteTrack`, or provide another route? Without one, every code and evidence link is dead; the Etherscan and Safe{Wallet} links still work.
- **AI tools (each human):** which tools did each member use, and for what? The agent row lists only what agents recorded.
- **Business rate (business owner):** confirm that 0.64% (CHF 85.7 m ÷ CHF 13.4 bn, 2025) is Swissquote's revenue per franc traded, as the 640,000-franc line assumes; the text cites only the result.
- **Video (humans):** where is it hosted, and does it show the local-test-chain fallback label if G1 fails?
