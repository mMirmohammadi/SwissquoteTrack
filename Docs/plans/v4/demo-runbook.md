# V4 demo runbook — historical schedule, superseded

**Use [current execution status](<execution-status.md>) and [acceptance](<acceptance.md>) for actual readiness.** The overnight times, G1 deadline and launch/freeze assertions below are historical recommendations, not current instructions. No public submission/upload was authorized. Only use a recorded chapter after its file exists, is secret-safe and is rehearsed; the text below does not prove that media exists. Do not restart the existing demo or repeat any retained transaction to follow this obsolete schedule.

## Historical live public-test-network demo: 05:30 launch to judging

Draft by the demo-operations planner (agent e806d368), Sun 11 Oct 2026, about 01:30 CEST. Code facts below were read in `.worktrees/v3/swissquote-wallet` (read-only); anything not read there is marked **assumption** or **reported** (taken from another agent's report). Times are CEST. Revised by a helper agent after the planner's 01:30 update (DeFi mined, lead idle, recovery-page limits, funding).

## 1. Result

- The demo runs on the presenter's laptop: Chrome opens `http://localhost:5273` (wallet) and `http://localhost:5274` (Recovery Desk) through an SSH tunnel to the demo stack on the VM. Every transaction is live on the public Ethereum test network (Sepolia); the recorded walk-through is one click away.
- **Switch rule:** a live step with no progress for 45 s, an error dialog, a tunnel drop or a lost session → the Presenter says **"Here is the same flow, recorded this morning on the public test network."** and the Driver plays that act's video chapter. No retries on stage.
- **State at 01:30:** the lead agent is idle and the v3 stack is stopped; the user will be asked to restart it for gate G1 (one full recovery in the app on Sepolia, due 02:45). G1 runs in the old phone's own page, in one tab that is never hidden from "Prepare new phone" to "Try the old key": any hide clears the old key and the new-kit tick (`apps/wallet/src/features/recovery/index.tsx:41`, `:66`, `:167-168`).
- The stack is launched once, at 05:30. After 08:30 nobody edits, restarts or sends anything outside the staging steps below.

## 2. Roles

| Role | Does | Never does |
|---|---|---|
| **Presenter** `<name>` | Speaks; calls the switch; holds the props | Touches the VM; submits on DoraHacks |
| **Driver** `<name>` | Operates the laptop; types app unlock codes; gives the fingerprint (their finger must be enrolled on the laptop) | Opens DevTools, reloads, clears data |
| **Ops** `<name>` | Owns the VM, tmux, balances, gas, the freeze (named enforcer); runs read-only status scripts | **Sends any transaction during a slot.** The Swissquote service has one sender lock for all wallets (`services/swissquote/src/app.ts:40` `const senderKey='11155111:global';`); a second submission gets 409 "Previous submission is pending; sender blocked until receipt" (`app.ts:70`) and the live act dies |
| **Submitter** `<name>` (not the Presenter) | DoraHacks submission 09:15–09:30, confirmation screenshot | Edits code after 08:30 |

During a slot, only the Driver's laptop sends, and nobody else (person or agent) uses the stack.

## 3. Hardware, network, browsers

**Laptop:** macOS with Touch ID, or Windows with Windows Hello, running Chrome, so the fingerprint prompt is real. Linux has no built-in authenticator; the virtual one needs DevTools open, so never on stage. Default: the laptop that already ran v2 passkey payments (human choice). With Windows Hello, say "her face" or "her PIN", not "fingerprint".

**Network:** a phone hotspot is primary (venue Wi-Fi may block SSH; it is the backup). The laptop needs SSH to the VM plus direct HTTPS to `ethereum-sepolia-rpc.publicnode.com` and `rpc.sepolia.ethpandaops.io` (the page reads the chain itself: `sepolia-demo.mjs:33`), `app.safe.global` and `sepolia.etherscan.io`.

**Tunnel** (laptop, own terminal window, left open; rerun the same command after a drop). `<user>@<vm-host>` is for the team to fill in; that the VM is reachable from the hotspot is an **assumption** to test at 05:45.

```
ssh -N -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes \
  -L 5273:127.0.0.1:5273 -L 5274:127.0.0.1:5274 -L 4101:127.0.0.1:4101 -L 4102:127.0.0.1:4102 \
  <user>@<vm-host>
```

- All four forwards are needed: the page calls the Swissquote service on 4101 and the partner on 4102 directly (`sepolia-demo.mjs:34`).
- Open exactly `http://localhost:5273` and `http://localhost:5274`. `127.0.0.1` breaks fingerprints and partner calls: the launcher sets the passkey domain to `localhost` and allows only the origin `http://localhost:5273` (`sepolia-demo.mjs:29-30`).

**Chrome profiles** (one window each, wallets as tabs):

| Profile | Tabs | Used for |
|---|---|---|
| Old phone | L, B | Live payments; B's countdown and Stop button |
| New phone | S1, S2, Recovery Desk | Finishing a recovery live |
| Table | F | Live creation, 10-min table only |
| Evidence (default profile) | Section 6 tabs, video, deck | Proof and fallback |

- The demo flag profile keeps the `dapps` tab (labelled "DeFi", `apps/wallet/src/features/index.ts:16`) so judges can see it at the table; nothing is sent from it on stage.
- Never clear site data, never use a private or guest window, never reload. Keys and fingerprints live in the profile; the sign-in lives only in the open page (**reported**), so a reload signs that wallet out.
- Hidden pages forget things. The recovery page wipes its typed unlock code, kit code and "kit saved" tick the moment its tab is hidden (`apps/wallet/src/features/recovery/index.tsx:41`). Any wallet tab hidden for 2 minutes forgets its unlocked key and typed codes (`apps/wallet/src/App.tsx:196-204`). So the Driver brings the act's window forward about 15 s before the act and unlocks it.
- Settings in every profile: bookmarks bar, extensions, notifications, translation and password prompts off; "Ask where to save each file" off (the finish step downloads a kit file, `index.tsx:102`). OS: do-not-disturb on, sleep off.
- Projector: mirror the display, 1280×720, Chrome zoom 125% on wallet tabs (**reported**, test at 06:00 on any external screen).

## 4. Wallet staging

| Wallet | Purpose | Created | Funded (test USDC) | State at slot time |
|---|---|---|---|---|
| L | Live payments: 1 USDC phone-only, 6 USDC with fingerprint | 08:30–09:15, Old phone (or keep the 06:00 walk-through wallet if it holds ≥7) | 8 | Signed in, "Verified as yours", ≥7 USDC, nothing pending |
| S1 | Recovery finished live; new key pays 1 USDC | 08:30–09:15, created in Old phone, then New phone signs in and prepares | 2 | New phone: recovery started 09:30–09:55, wait over, not finished |
| S2 | Spare for S1 (or a second slot) | Same as S1, each step after S1's | 2 | Same as S1 |
| B | Swissquote route: 3-day countdown and Stop button (only if rehearsed) | 08:30–09:00 | 1 | Recovery started about 09:00; countdown visible in Old phone; nobody presses Stop |
| F | Creation live | Live, Table profile, 10-min table only | 8 (live) | Not created before the slot |

- `MOCK_ACCOUNT_START_USDC=8` sets each new client's MOCK bank balance (`services/swissquote/src/main.ts:16`, used at `:20`; the launcher passes it through, `sepolia-demo.mjs:24`). The default on Sepolia is 1, which makes the >5 USDC fingerprint step impossible. Funding moves real test USDC from SQ_ACCOUNT (**assumption**: whether "Fund" moves the full 8 or a chosen amount; check at 06:00 and size SQ_ACCOUNT accordingly).
- **Recovery requests do not expire:** `finalizeRecovery` checks only `block.timestamp >= request.executeAfter`, with no upper limit (`contracts/contracts/candide/modules/social_recovery/SocialRecoveryModule.sol:226-228`). S1 can be started at 09:30 for any slot up to 13:00. The finish button also needs the latest block 15 s past the deadline (**reported**), so 3 min 15 s minimum.
- **One sponsored transaction at a time** (the global sender lock): wait for each receipt before the next click, across all profiles and people.
- Never sign in as S1 or S2 on the Old phone at slot time: that tab would show the Stop button for their recovery.

## 5. Timeline from 05:30 to the slot

1. **05:30 Ops, launch on the VM:**
   ```
   tmux new -s sq-demo                      # reattach later: tmux attach -t sq-demo
   cd /home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/swissquote-wallet
   ss -ltn | grep -E ':(5273|5274|4101|4102) '       # must print nothing
   ls -l .env.sepolia                                # must exist, -rw-------; never print its content
   node scripts/sepolia-balances.mjs                 # read-only ETH/USDC per role
   node scripts/sepolia-relayer-status.mjs 0x6fc61dce369786cfbf43536478c4cd521b4336f7   # "latest" must equal "pending"
   MOCK_ACCOUNT_START_USDC=8 pnpm demo:sepolia
   ```
   Expect "SEPOLIA: real testnet transactions; …" and "Open http://localhost:5273. Isolated service data: .sepolia-runs/<id>/" (`sepolia-demo.mjs:73-74`). Write `<id>` on the ops sheet; detach with Ctrl-b then d. Never Ctrl-C the launcher: if any of its four processes exits, it stops all of them (`sepolia-demo.mjs:88`). If ports are busy ("V3 ports already in use", `:60`), the lead decides whether to adopt that run or stop it.
   Gas price (read-only; **not run in this review**):
   ```
   node -e 'fetch("https://ethereum-sepolia-rpc.publicnode.com",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_gasPrice",params:[]})}).then(r=>r.json()).then(j=>console.log(Number(BigInt(j.result))/1e9,"gwei"))'
   ```
2. **05:30–06:00 Ops, balances.** **Ops task, deadline 08:00:** SQ_ACCOUNT holds about 40 test USDC (18 at 00:12; five wallets at 8 USDC need about 40), from TREASURY plus the Circle faucet. Targets by 08:30: RELAYER ≥0.03 ETH; SQ_ACCOUNT ≥0.005 ETH; gas below 1 gwei (above 5 gwei: no live creation; one creation is about 2.65 M gas, 0.0265 ETH at 10 gwei; **reported**). Last reading (00:12, reported): RELAYER 0.0249 ETH, SQ_ACCOUNT 18 USDC, TREASURY 0.0169 ETH and 21 USDC. Top-up from TREASURY: dry run first; `--send` only after a human says yes; before 08:30 (later only between slots, with the lead's yes); never during a slot:
   ```
   node scripts/sepolia-distribute.mjs --eth RELAYER=0.03,SQ_ACCOUNT=0.005 --usdc SQ_ACCOUNT=20
   node scripts/sepolia-distribute.mjs --eth RELAYER=0.03,SQ_ACCOUNT=0.005 --usdc SQ_ACCOUNT=20 --send
   ```
   Faucets need a human (login or captcha): test USDC from https://faucet.circle.com/ (Ethereum Sepolia) to SQ_ACCOUNT `0xe3c71e2a0ba81377a5e2a3c1d67279e36f75090e`; ETH from a faucet the team can log into.
3. **05:40–06:00 agent (optional):** Playwright backup recording on the VM (section 10). It sends transactions, so humans send nothing meanwhile.
4. **06:00–07:00 Driver + Presenter:** human walk-through on the presenter laptop over the hotspot, screen-recorded: real fingerprints, create, "Verified as yours", fund, pay 1 and 6 USDC, full recovery on Sepolia (gate G1's second chance if G1 failed), new kit opens in the Desk, Safe{Wallet}. Stage rehearsal wallets RS1, RS2 (recovery started) at the end. Test the projector or an external screen.
5. **07:00 lead:** decide live or recorded per act (section 7).
6. **07:00–08:30:** rehearsals and drills (section 9); Ops cuts video chapters.
7. **08:30 environment freeze (Ops enforces):** no edits, pulls, merges or installs under `apps/`, `packages/`, `services/` of the demo worktree. Vite dev servers reload the page on save and a reload signs everyone out; service edits need a relaunch.
8. **08:30–09:15 Driver, Ops watching:** stage L, S1, S2 and B, one transaction at a time; screenshot each "Verified as yours" screen with its balance; pre-open the section 6 tabs. B's recovery starts about 09:00.
9. **09:15–09:30 Submitter:** DoraHacks; confirmation screenshot. Hard deadline 10:00.
10. **09:30–09:55 Driver:** start S1's recovery, then S2's after S1's receipt.
11. **10:00–10:15 Ops health check:** relayer status ("latest" = "pending"), balances, gas, tmux alive, tunnel alive, every tab open, video plays on all three devices.
12. **10:15–10:25 Presenter prep:** do-not-disturb, sleep off, zoom, charger in, hotspot charged, phone timer.
13. **10:25 lead + Presenter:** confirm live or recorded per act; Ops notes it on the ops sheet.
14. **Slot:** Ops is in the room with tmux open and sends nothing; an agreed hand sign means "stack is down, switch".

**Relaunch, two cases.** Keeping the run folder on relaunch (`DEMO_RUN_ID=<existing folder>`) is a **proposed lead change, not implemented** at 01:10: the launcher always makes a new random folder (`sepolia-demo.mjs:17` defaults `runId = randomUUID()`; `:71` passes none).

- *If the lead implements it* (test first: launch, create account, stop, relaunch with the ID, sign in): relaunch with `DEMO_RUN_ID=<id> MOCK_ACCOUNT_START_USDC=8 pnpm demo:sepolia` only when relayer status shows "latest" = "pending" and nobody is mid-transaction. Every open wallet tab then reloads and must sign in again (about 45 s each).
- *If not:* a relaunch starts an empty run; staged wallets stay on chain but cannot be used in the app, and re-staging takes about 40 min. **No relaunch after 08:30**; if the stack dies later, the live acts become video.

## 6. Pre-opened tabs (Evidence profile)

Open each by hand by 10:00 and keep it; Etherscan shows a Cloudflare check to scripts, so never reload these.

- Payment where the client owned no ether: https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e
- Recovery finished after the real 180-second wait: https://sepolia.etherscan.io/tx/0x1231c281bbb949ea3c64917618b4f626cc70a77a0621b7a2d763ae95de3c743e
- Money moved with only the Emergency Kit: https://sepolia.etherscan.io/tx/0xbc661bfd7f78d65385f7f7bcb4bcc6231205312e6a3e510401b34b8268e9110c
- Story wallet created / 6-USDC payment / both recoveries cancelled: https://sepolia.etherscan.io/tx/0xa98a4f5f8932987d76de852c969c80cf3461a12045b18dddee72995aef735b85 · https://sepolia.etherscan.io/tx/0xdada558819ace01b66d6d8e3dd69832a7d1c8e427335ac6caf4599d10f4cd8b7 · https://sepolia.etherscan.io/tx/0x4bbdd6bd0b25a2981e7f7f6fa4dc2b9c9fe75b6b5252e543f930fe1838980681
- DeFi, shown as a still and never run live: the 1-USDC Compound supply https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af and that wallet's history in Safe{Wallet} https://app.safe.global/transactions/history?safe=sep:0x9C26a4432f7E34f158560efB842c5EF9b2677B51, plus a screenshot of the in-app preview in the screenshot PDF (**to-do**, helper by 08:00: take it from the lead's run-8 artifacts if one exists, else capture the preview in the 06:00 walk-through and stop before signing; that the preview can be left unsigned is an **assumption**).
- Safe{Wallet} for `<W>` = the browser-recovered wallet if gate G1 passed, else `0xad9c2831beeF85Df126BE1f80a443d26e2122dA9`: `https://app.safe.global/home?safe=sep:<W>` (URL pattern **assumed**), `https://app.safe.global/transactions/history?safe=sep:<W>`, `https://app.safe.global/settings/modules?safe=sep:<W>` (history and modules pages checked for 0xad9c… by the wildcard agent). Legend if asked: "swapOwner" means the owner key was replaced.
- Deck `<path>`, the video player paused at chapter 1 `<path>`, the screenshot PDF `<path>`, and the "both helpers refused" still (line S6).

## 7. Live or recorded, per act

Decided at 07:00 after the walk-through, confirmed at 10:25. When an act switches, the Presenter says the switch line unless the table gives another.

| Act | Live only if | Otherwise | Line at the switch |
|---|---|---|---|
| Create | 10-min table, F, gas <5 gwei, R4 clean | 15-s clip (always in 3/5-min) | Switch line (table only; the planned clip needs none) |
| Pay 1 USDC, then 6 USDC with fingerprint (L) | Walk-through and R1 clean; relayer idle | Video chapter + Etherscan 0xe318… tab | Switch line |
| Thief refused | Never live as a contract refusal: the app's test stops at the partner's MOCK face check (`services/partner/src/service.ts:80`). MOCK mailbox reset live only if the walk-through confirmed it | Still S6 | Line 6, over the still |
| Recover (S1): finish (about 40 s), old key refused, new key pays | G1 or the 06:00 run passed on Sepolia; S1 shows the wait over at 10:25. Old key refused: live only if rehearsal proved the S1 tab stayed visible | Sepolia video chapter; old key refused = still from the G1 recording, or the scripted Sepolia refusal; if G1 failed twice: local-chain recording + Etherscan 0x1231c281… | Switch line; for the local recording, line S4: "This recovery is a recording on a local test chain; the same contracts ran it by script on the public chain." |
| B countdown and Stop | Rehearsed clean; show only, press Stop only at the table (it sends a transaction) | Cut (first in the cut order) | S2: "Phone and card protect each other: lose the phone, and the card brings her back; lose the card, and her phone can stop the takeover during the wait." |
| Swissquote gone | Always the Safe{Wallet} tab + kit-exit tab; never stop services on stage | Screenshot PDF pages of the same tabs | Lines 7 and S8 |
| DeFi | Never live; one supply is mined (0xa449…94af) | Still of the in-app preview, then the section 6 Etherscan and Safe{Wallet} tabs | ≤15 s after the Act-1 payment: "Approved apps work the same way: Swissquote explains the trade in plain words, screens it, and pays the fee. Last night Claire lent one dollar to a test version of Compound, a lending app." |

Live finish on S1, about 40 s, with the unlock code typed twice because the kit step clears it (button labels from `index.tsx:152-165`; clearing at `:97`): type the app unlock code → "Create new encrypted kit" → "Download new encrypted kit" → tick "I saved the new kit file…" → type the unlock code again → "Check block time, finalize and install saved key". The screen then shows the new kit code (`index.tsx:164`): if the UI lane ships its "Show code" mask, leave it closed; otherwise the Driver accepts showing a throwaway testnet code on screen. Old key refused: a still from the G1 recording, or the scripted Sepolia refusal (evidence JSON `evidence/sepolia/full-2026-10-10T19-28-59Z.json` lines 242–250), unless rehearsal proved the S1 tab stayed visible; on the New phone the app says "The old key is not available here" (`:168`). Then the new key pays 1 USDC live, only if gate G1 showed it works without a page reload; otherwise play the video chapter "New key pays". The Presenter covers the finish with the Act 3 words in [pitch-script.md](pitch-script.md): "Claire gets a new phone; for this demo, it's this same laptop." and S3: "A recovery has a wait, so we started this one before we came on stage, with her card and the partner. Its wait is over."

## 8. Failures

| Symptom | Action | Presenter says |
|---|---|---|
| Spinner >45 s, "both nodes have not confirmed", or "Countdown unavailable" (recovery needs both public nodes to agree, `index.tsx:64`, `:88`, `:125`, `:161`) | Driver: video chapter. Ops: nothing | Switch line |
| 409 "Previous submission is pending…" or "…uncertain…" (`app.ts:70`, `:90`, `:175`) | No more live sends this slot; video. After the slot Ops runs `node scripts/sepolia-relayer-status.mjs 0x6fc61dce369786cfbf43536478c4cd521b4336f7 <last tx hash>`; "uncertain" needs a manual chain check by the lead | Switch line |
| Tunnel drop (ssh exits, "Failed to fetch") | Video at once; rerun the tunnel after the act. When the page reconnects it reloads itself and signs out (**reported**, Vite client) | Switch line |
| Lost session (sign-in screen) | Video. After the act: sign in (email, password, unlock code); a started recovery resumes from "Resume saved replacement" (`index.tsx:153`) | Switch line |
| No fingerprint prompt | Check the address bar says `localhost:5273`; one retry inside 45 s (macOS "Use Password" in the prompt also works, **assumption**); then video | Switch line |
| Recovery tab was hidden: kit fields empty | Redo: unlock code → "Create new encrypted kit" → download → tick | "Before it takes over, the new phone saves a fresh Emergency Kit." |
| tmux shows "… stopped; stopping remaining v3 processes." | Video for every remaining live act; relaunch only per section 5 | Switch line |
| No projector picture or wrong size | Mirror on, 1280×720; else play the video on the second device facing the judges | "One moment while we switch screens." Then hand out judge cards |
| Etherscan tab shows a check page | Use the screenshot PDF page | — |

## 9. Rehearsals, 07:00–08:30

Four timed runs, live on the stack, only the Driver sends. Recovery finishes use RS1 (R1) and RS2 (R4); R2 and R3 switch to the video for recovery, which doubles as the switch drill.

1. **R1 07:00–07:15, 5-min stage.** Pass: ≤5:00; every live act finishes inside its 45-s budget; no reload.
2. **R2 07:15–07:30, 5-min stage.** Pass: ≤4:50 with R1's fixes; the 12 lines said as written.
3. **R3 07:30–07:40, 3-min cut.** Pass: ≤3:00 with the cut order (thief → one sentence; B cut; S1's new-key payment cut; recovery never cut).
4. **R4 07:40–07:55, 10-min table with F.** Pass: ≤10:00; creation completes; three likely judge questions answered.

Drills, 07:55–08:20:

- **Reload and sign in again:** pass if back on Home in under 45 s, three times in a row.
- **Tunnel kill:** Ops stops the laptop's ssh mid-act. Pass if the video is playing within 10 s and the laptop is ready again within 2 min.
- **Switch to video from any act:** pass if the right chapter plays within 10 s, three of three.
- **Hidden recovery tab:** pass if the kit steps are redone within 30 s.
- **Hallway test, 08:20:** a non-crypto person watches the 3-min cut, then answers: "What three things does Claire keep?", "Who can move her money?", "What happens if Swissquote disappears?". Pass: three of three in their own words; any word they ask about gets fixed in the slides or script (no code after 08:30).

## 10. Backup video and stills

- **Primary, human, 06:00–07:00:** the walk-through on the presenter laptop with a real fingerprint, OS screen recorder, 1080p, microphone off. Cuts: full, 5-min, 3-min. Chapters: Create · Pay 1 USDC · Pay 6 USDC with fingerprint · Thief refused (still S6) · Recovery started · Wait over, finish · Old key refused · New key pays · New kit opens in the Desk · Safe{Wallet} history. Replace the 3-min wait with an on-screen "3 minutes later" card. Caption on every chapter: "Ethereum Sepolia testnet, recorded 11 Oct, hh:mm".
- **Second, agent, 05:40–06:00:** a Playwright `.webm` against `http://localhost:5273` on the VM, labelled "automated run, virtual fingerprint". To-do (lead or helper): adapt `tests/browser/recovery-complete.test.mjs`, which today targets a local chain.
- **Stills:** a screenshot PDF with one page per act and the transaction hash plus its Etherscan link under each picture, including the in-app DeFi preview (tx 0xa449…94af) and the old-key refusal.
- **Stored** on the laptop desktop, a USB stick and a second device; each copy tested offline at 10:00. Upload only if the team approves (default: no).

## 11. Kit checklist

- [ ] Presenter laptop and charger; HDMI and USB-C adapters; a spare HDMI cable
- [ ] Hotspot phone, its charger and a power bank; second device with the video; USB stick with video and PDF
- [ ] Props: one phone (Claire's old phone); printed Recovery Card marked **DEMO** with no real card words; sealed Emergency Kit envelope marked **DEMO** (the app generates kit codes, so it can only hold a pre-made kit or nothing)
- [ ] Printed judge cards (15), printed ops sheet (run ID, URLs, switch rule, cut order), printed 12 lines for the Presenter
- [ ] Phone timer

## 12. Judge card

Card text, under 120 words:

> **Front**
> **Swissquote Wallet**
> Swissquote can help you recover your wallet, but it can never move your money without you.
> Claire keeps three things:
> her phone, to pay;
> a printed Recovery Card, to get back in, with one helper;
> an Emergency Kit, to leave, even if Swissquote is gone.
>
> **Back**
> Check it yourself:
> [QR 1] Claire's recovered wallet in Safe{Wallet}. Phone: tap "Save settings", then "Got it".
> [QR 2] A payment where Claire owned no ether: Swissquote paid the network fee; her key signed.
> Every transaction shown is real, on the public Ethereum test network; only the back office (bank account and funding, ID checks, mailbox, sanctions list, helper-key vaults) is simulated and marked MOCK.
> Code: `<repo link>` · Team: `<names>`

- QR 1: `https://app.safe.global/transactions/history?safe=sep:<W>`, where `<W>` is the browser-recovered wallet if G1 passed, else `0xad9c2831beeF85Df126BE1f80a443d26e2122dA9`.
- QR 2: https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e
- The repo is private until the team decides; leave the placeholder until then.
- **To-do (helper, by 08:00):** no QR library is installed. Run `pnpm dlx qrcode -o qr1.png "<url>"` in the helper's own `AgentsLocal/<id>/` folder, or draw the codes with a small node script. Scan each code with two phones before printing.

## Open questions / objections

1. **Humans:** who are the Presenter, Driver, Ops and Submitter; which laptop (Touch ID or Windows Hello); `<user>@<vm-host>`; the slot time, format and projector connector (ask the organisers at breakfast).
2. **Lead (idle; the user restarts it), before 05:30:** implement `DEMO_RUN_ID` or accept "no relaunch after 08:30".
3. **Old key refused, live:** the still is the default (section 7). A live check needs S1 prepared in the page that holds its old key (`index.tsx:66`, `:138`) and never hidden until the check, but section 4 prepares S1 in the New phone profile; keep the still unless G1 shows a staging path. **Assumption** to test: Chrome may count a window fully covered by another window as hidden.
4. **Wallet B:** starting the Swissquote route reportedly needs a fingerprint sign-in, or a password reset at least 72 hours old plus the MOCK video ID (`services/swissquote/IMPLEMENTATION.md:36`, reported). A fresh New phone profile has neither, so start B from a profile holding B's passkey, or cut B.
5. **Switch-line wording:** this runbook uses the 01:30 line ("…on the public test network"); README.md (line 135) and pitch-script.md (line 81) still say "on Sepolia".
6. **Funding before 08:00:** the 40-USDC target covers the five staged wallets only; G1, the 05:40 agent recording, the 06:00 walk-through and RS1/RS2 also draw on SQ_ACCOUNT earlier, so a top-up before 05:30 is safer. Whether "Fund" moves the full MOCK balance is still unchecked.
