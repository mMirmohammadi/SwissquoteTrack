# V4 plan — show the product, live, telling one story

**V4 is implemented and verified in an isolated candidate: 609 tests passed with zero skips, and public browser recovery is proved.** The final complete local gate includes the added bank-return shortcut. Existing v2/v3 are preserved; nothing has been committed, published or submitted.

**Start here:** [implementation handoff](<implementation-handoff.md>), [acceptance and public receipts](<acceptance.md>), [offline deck](<../../pitch/v4/deck.html>) and [judge card](<../../pitch/v4/judge-card.pdf>).

**Recommended pitch:** “Your phone pays. Your Recovery Card plus a helper restores access. Your Emergency Kit lets you leave.” Keep the custom Swissquote app; use Safe only as read-only interoperability evidence. G1 proves creation → payment → recovery → replacement-owner payment at the same address across retained browser sessions, not one uninterrupted take. Never promise protection from an already-unlocked owner key. Hardware, projector/QR and human presentation rehearsal remain pending.

## Historical planning record — superseded below
The overnight deadlines, score estimates, and proposed claims below are historical planning inputs, not current evidence or instructions. Current runtime checks and evidence override them. No repository publication, video upload, or submission is authorized.
Hacking ends 10:00 CEST; judging 10:30–13:00 according to the repository brief; confirm the actual slot with organizers. Frozen v3 remains untouched (`cb7297a`).

## The result in one minute

- **Pitch.** A five-minute story about Claire, a Swissquote client, shown in our own app on the
  public Ethereum test network (Sepolia). She pays without owning any ether. A thief with her phone
  and email is refused. She gets the same wallet back on a new phone. If Swissquote disappears, she
  can still leave. One promise carries it: *"Swissquote can help you recover your wallet, but it can
  never move your money without you."*
- **Front end.** Keep our Swissquote wallet app and the Independent Recovery Desk. Do not fork
  Safe{Wallet} or Rabby. Instead, open the same wallet in Safe{Wallet}, Safe's own public app, as
  live proof that the wallet does not depend on us. Polish only the screens judges see.
- **One gate decides how much of the demo is live:** a full recovery inside our app on Sepolia by
  02:45 (gate G1). It has never run there; every other step of the story has, including — since
  01:12 — a DeFi trade through the app with the fee paid by Swissquote (see "Where we stand").
- **Expected effect** (estimates by simulated judges and a scoring agent, not measurements): about
  66/120 for the v3 judge pack → about 85–95 with V4. The two biggest gains are switching from an
  evidence walkthrough to a live product demo (about +5) and proving the recovery in the product
  (about +4.5, which also protects the bonus points).

## Decide now

| # | Decision | Recommendation | If no answer |
|---|---|---|---|
| 1 | Restart the lead agent on gate G1 | **Yes, now** — paste [lead-message.md](lead-message.md) into its session. It finished Compound and is idle; G1 needs about 75 minutes, and product code freezes at 04:30. | G1 moves to the 06:00 human walk-through; the recovery act becomes a recording if that fails too. |
| 2 | Who presents, who drives, which laptop | Presenter speaks, Driver clicks. Laptop: macOS or Windows with a fingerprint reader (real fingerprint on stage). | Nothing else can be staged; this blocks 05:30. |
| 3 | Start the helper lanes | **Yes** — on your word the planner starts three lanes: the UI "must" items in a separate worktree (patch by 03:30, merged only if the full test gate passes, [frontend.md](frontend.md)); doc-fix patches for the lead; the deck and judge card. | Ship today's UI; the pitch uses fallback wording; humans fix the docs and build the deck. |
| 4 | Judging format | Ask the organisers now. Prepare the 5-minute version first; 3- and 10-minute versions are deltas. | Rehearse 5 minutes. |
| 5 | Repository visibility and video | Make the repository public at ~08:30 after a secret scan. Today it is private, so every code and evidence link in the submission returns 404 for judges. Keep the video offline on three devices; upload only if you say so. | Repository stays private; the submission links only to public Sepolia pages and Safe{Wallet}. |
| 6 | Legal position and business headline | Accept both as worded below, after one person checks the business inputs (revenue per franc traded, 0.64%; 690,828 accounts) against Swissquote's reports. | Pitch keeps them; Q&A cards carry the caveats. |
| 7 | AI tools used | Each team member lists theirs by 03:00 (the brief requires it). | Submission ships with a gap. |

## Where we stand (evidence, 01:30 CEST)

| Story step | Public Sepolia, through our app | Public Sepolia, by script | Local test chain, through our app |
|---|---|---|---|
| Create wallet | Yes — 0x4386…C219 | Yes — 0xad9c…2dA9 | Yes |
| Pay with no ether (Swissquote pays the fee) | Yes — wallet and owner hold 0 ETH | Yes (fee paid by a test treasury) | Yes |
| Fingerprint above 5 USDC | Not yet | — | Yes (virtual authenticator) |
| Swissquote + partner without the card are refused | — | Yes, recorded read-only call ("Signer not a guardian") | — |
| Same wallet back on a new phone after a real wait | **Not yet — gate G1** | Yes, after a real 180 s wait | Yes |
| Old key refused afterwards | **Not yet — gate G1** | Yes (read-only call) | Yes |
| Emergency Kit opens without Swissquote | **Not yet — gate G1** | Kit key moved 3 USDC with standard tools | Yes (desk opens it offline) |
| Wallet opens in Safe{Wallet} | Yes (0x4386…) | Yes (0xad9c…) | — |
| Approved DeFi app: lend 1 USDC to Compound | Yes — plain-words preview, screening, fee paid by Swissquote (a Compound test deployment) | — | — |

The latest full gate on the v3 branch passed 591 automated tests with none skipped (commit 1863acf);
the submission will quote only the freeze gate's number. Links to every transaction are under
"Evidence links" at the end.

## The pitch

**Mental model the judges should leave with.** Claire keeps three things: her **phone**, to pay; a
printed **Recovery Card**, to get back in together with one helper; an **Emergency Kit**, to leave
even if Swissquote is gone. Behind the card are two locks. Each opens only with the card plus one
helper: the card plus our recovery partner (3-minute wait on stage), or the card plus Swissquote
(3-day wait). Swissquote and the partner are never on the same lock, so even together they cannot
open either. During any wait, Claire's old phone can stop the takeover.

**Five-minute flow** (exact words in [pitch-script.md](pitch-script.md); slides in [slides.md](slides.md)):

| Time | Act | Shown live | Proves |
|---|---|---|---|
| 0:00 | Hook: today a client who wants her own keys must withdraw and leave | Slide | Business problem |
| 0:35 | Her wallet: created on her phone (15-s recorded clip), then a payment | Wallet L live: review → sign → confirmed; Etherscan shows Swissquote's relayer paid | Creation, authentication, gasless bonus |
| 1:38 | Approved apps work the same way | Still: the in-app Compound preview and its mined transaction | Compliant-dApp bonus |
| 1:50 | A thief with her phone and email | Slide: "Even both helpers together are refused" (recorded on Sepolia) | Custody, threat model, stolen-phone bonus |
| 2:10 | New phone, same wallet | Wallet S1 live: recovery started before the slot, wait over → finish (about 40 s) → old key refused (a still from G1, or the scripted refusal) → new key pays | Recovery, end-to-end story |
| 3:40 | Swissquote is gone | Safe{Wallet} shows the same wallet and history; kit exit transaction | Exit, no lock-in |
| 4:05 | Why it can legally exist | Slide (16 s) | Legal |
| 4:21 | Why Swissquote should build it | Slide (12 s) | Business |
| 4:33 | Close: "Claire keeps her keys, and Swissquote keeps Claire." + QR | Slide; ends at 4:43 | Story |

The optional fingerprint payment (6 USDC) adds 25 s after the first payment; it stays out until it
has run once on the public network from the stage laptop.

**Why this order.** It is the brief's required story (create → sign → lose → recover) told as one
person's week, with each act carrying one judging criterion. Architecture, the full threat model and
authentication rules live in the backup slides and the Q&A ([qa-cards.md](qa-cards.md)) — five minutes
cannot hold them, and judges ask.

**The two positions we state plainly** (wording fixed in [pitch-script.md](pitch-script.md)):

- *Legal:* "The client's phone or Recovery Card is in every path that moves money, so we argue this is
  software, not custody, and Claire, not Swissquote, is the sender. That is our reading; FINMA
  confirmation is launch step one." The Travel Rule check sits where money crosses between the
  Swissquote account and the wallet; the wallet proves it belongs to the client by signing a one-time
  challenge that the contract checks.
- *Business:* "Ten thousand clients who stay instead of leaving, each trading ten thousand francs a
  year at Swissquote, bring in about 640,000 francs a year at 2025 rates." (At H1 2026 rates, about
  CHF 0.2–0.3 million; the CHF 4.90/month recovery subscription is upside, not the headline.)

**Words we never use**, because a judge can disprove them: "Swissquote never holds keys" (it holds a
recovery-helper key — say "holds no key that can move money alone, and never co-signs payments");
"the wallet requires a fingerprint" (Swissquote's service asks for it); "it can never take it";
"FINMA-compliant"; "audited"; "first in Switzerland"; "official Compound market"; "DeFi is fully
supported" (one supply ran; no withdrawal or swap).

## The front end

**Decision: our app is the product; Safe{Wallet} is the proof of independence.** Forking Safe{Wallet}
or Rabby would take 25–40 hours, bring a GPL-3.0 question, and hand judges a tool built for
crypto-native users — the UX criterion asks whether a non-technical client could use it. Safe{Wallet}
already shows our wallets, owner and recovery modules with no code from us
(details and the full options table in [frontend.md](frontend.md)).

**Must (UI helpers on separate files, one worktree, patch by 03:30, hard stop 03:45; ≈3 helper-hours):**

1. Recovery screen: a step timeline with a big countdown, and "Stop it — this wasn't me" on the old
   phone. This is the stage clock.
2. Home: a "Who can move my money?" card from the existing on-chain check, plus "Open in Safe{Wallet} ↗".
3. Payment review as four rows — You send · Recipient gets · Network fee CHF 0.00, paid by Swissquote ·
   Balance after — with a risk badge; hashes move into "Technical details".
4. Plain words on the judges' path, a complete MOCK footer, and a demo flag profile that hides the
   tabs we do not show.

**Should / could:** Recovery Desk header "Independent Recovery Desk · works without Swissquote";
a MOCK-labelled "Move back to my Swissquote account" button (retention made visible).
**Not doing:** forks, restyle, splitting App.tsx, anything in protocol or services code.

**What judges click** (the golden path, also the backup-video script): sign-up and creation clip →
Home with "Verified as yours" and who-can-move card → send 1 USDC, review rows, sign, confirmed →
(optional) 6 USDC with fingerprint → approved apps: the loan preview, then Back → new phone: timeline,
"Check block time, finalize and install saved key" → old key refused → new phone pays → Safe{Wallet}
history → at the table: Recovery Desk opens the Emergency Kit offline.

## The demo: live, with a recording one click away

- Runs from the team laptop over an SSH tunnel to the demo stack; every transaction is on public
  Sepolia ([demo-runbook.md](demo-runbook.md)).
- **Wallets:** L (pre-created, funded, live payments) · S1 and S2 (recoveries started 10+ minutes
  before the slot; S2 is the spare) · B (recovery through Swissquote, 3-day countdown, only if
  rehearsed) · F (created live at a 10-minute table).
- **Switch rule:** a live step with no progress for 45 seconds, an error dialog, a tunnel drop or a lost
  session → "Here is the same flow, recorded this morning on the public test network" → play the
  video at that act.
- **Live or recorded per act** is decided at 07:00: an act goes live only if it passed in the walk-through
  and the last three rehearsals.
- **Props:** a phone, a printed Recovery Card marked DEMO, a sealed Emergency Kit envelope.

## Schedule and owners (CEST)

| Time | What | Owner | Gate / output |
|---|---|---|---|
| On reading | Decisions 1–7; paste the lead message | User | — |
| Now–02:45 (hard stop 03:00) | A full recovery in the app on Sepolia, per [lead-message.md](lead-message.md) | Lead agent | **G1** evidence file with hashes |
| Before G1, then by 05:30 | Check the MOCK bank account's test USDC (18 at 00:12); top it up to about 40 | Ops (human) | every staged wallet draws up to 8 |
| Now–03:30 (hard stop 03:45) | UI must items M1–M3 in `.worktrees/v4-ui`, on separate files | UI helpers, run by the planner | patch; typecheck, unit tests, build pass |
| Now–03:15 | Doc-fix patches, root README, architecture diagram ([submission-plan.md](submission-plan.md)) | Docs helper, run by the planner | ready patch files |
| Now–04:30 | Deck (HTML → PDF), judge card with QR codes | Deck helper, run by the planner | **G4** user reviews deck 04:30 |
| 03:00–03:45 | Launcher reuse option, flag profile, apply doc patches, commit, push | Lead agent | **G3** docs in repo |
| 03:45–04:30 | Merge the UI patch, full gate, Sepolia screen check, commit, push, tag | Lead agent | **G2** product code freeze 04:30 |
| 05:30 | Launch the demo stack once (8 USDC start balance); check balances and gas | Ops | stack up |
| 05:40–06:00 | Optional agent backup recording on that stack; humans send nothing meanwhile | Helper | backup v1 |
| 06:00–07:00 | Human walk-through on the presenter laptop, real fingerprint, screen-recorded | Presenter + Driver | **G5** live/recorded per act; backup v2 |
| 07:00–08:30 | Three timed rehearsals, switch drills, one hallway test with a non-crypto person | Team | **G6** under time, switch < 10 s |
| 08:30 | Environment freeze: no edits, no relaunch, no reloads | All | — |
| 08:30–09:15 | Stage wallets L, B, S1, S2, one transaction at a time | Ops | staging table green |
| 09:15–09:30 | Paste the DoraHacks submission; open every link from a private window | Submitter | **G7** submitted |
| 09:30–09:55 | Start S1's recovery, then S2's after S1's receipt | Driver | — |
| 10:00–10:15 | Health check: relayer idle, balances, gas, tunnel, tabs, video on three devices | Ops | — |
| 10:25 | Final live-or-video call | Presenter | — |

The relayer sends one sponsored transaction at a time for everyone, so live Sepolia work never
overlaps: the lead's G1 run, the video recording, the walk-through, staging and the slot each own it
alone.

## If things fail

- **G1 fails:** retry in the 06:00 walk-through (no code change needed). If that fails too, Act 3 is the
  recording, labelled "local test chain", plus the scripted Sepolia recovery tx 0x1231…, with the line
  "This recovery is a recording on a local test chain; the same contracts ran it by script on the
  public chain."
- **UI patch fails the gate:** drop it; the pitch uses today's screens and the fallback lines marked in
  [pitch-script.md](pitch-script.md).
- **Stack dies after 08:30:** no relaunch; run the slot from video, slides and the pre-opened Etherscan
  and Safe{Wallet} tabs.
- **Worst case:** video on three devices, a screenshot PDF, slides and the QR card.

## Done when

1. G1 has a result (pass, or a classified failure) and the 04:30 freeze commit is pushed and tagged.
2. The deck, script, Q&A cards and judge card match each other and contain no banned claim.
3. Three rehearsals finished within time; the switch-to-video drill takes under 10 seconds.
4. Wallets are staged and both backup videos play offline on three devices.
5. The submission is pasted by 09:30 and every link opens from a private window.

Then stop building and only rehearse.

## Files in this plan

| File | What it is | Status |
|---|---|---|
| [lead-message.md](lead-message.md) | Paste-ready message that restarts the lead agent on gate G1 | Ready |
| [pitch-script.md](pitch-script.md) | Exact words and clicks: 5-minute script (527 spoken words, ends 4:43), 3- and 10-minute versions, switch lines | Ready; re-check screen labels if the UI patch merges |
| [slides.md](slides.md) | Content of 8 main and 7 backup slides | Ready to build (HTML → PDF) |
| [frontend.md](frontend.md) | Front-end options, change list, test-pinned strings, merge protocol, paste-ready UI helper brief | Ready |
| [demo-runbook.md](demo-runbook.md) | Roles, staging, commands, funding, failure table, rehearsals, judge card | Ready |
| [qa-cards.md](qa-cards.md) | 22 answer-first judge Q&A cards and a never-say table | Ready |
| [submission-plan.md](submission-plan.md) | DoraHacks text, root README, diagram spec, doc fix list, pre-submit checklist | Ready; the text is 894 words without link addresses (985 raw) — trim if DoraHacks counts raw words |

## Evidence links (public Sepolia)

- Wallet created and paid through our app, fee paid by Swissquote's relayer (wallet and owner hold
  0 ETH): [payment 0xe318…](https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e)
  on wallet [0x4386…C219](https://app.safe.global/transactions/history?safe=sep:0x4386810dc7185d4cE2a313645f9D9504d386C219)
- Scripted full story on wallet [0xad9c…2dA9](https://app.safe.global/transactions/history?safe=sep:0xad9c2831beeF85Df126BE1f80a443d26e2122dA9):
  [create](https://sepolia.etherscan.io/tx/0xa98a4f5f8932987d76de852c969c80cf3461a12045b18dddee72995aef735b85) ·
  [pay 6 USDC](https://sepolia.etherscan.io/tx/0xdada558819ace01b66d6d8e3dd69832a7d1c8e427335ac6caf4599d10f4cd8b7) ·
  [cancel both recoveries](https://sepolia.etherscan.io/tx/0x4bbdd6bd0b25a2981e7f7f6fa4dc2b9c9fe75b6b5252e543f930fe1838980681) ·
  [recovery finished after 180 s](https://sepolia.etherscan.io/tx/0x1231c281bbb949ea3c64917618b4f626cc70a77a0621b7a2d763ae95de3c743e) ·
  [Emergency Kit exit, 3 USDC](https://sepolia.etherscan.io/tx/0xbc661bfd7f78d65385f7f7bcb4bcc6231205312e6a3e510401b34b8268e9110c)
- Approved DeFi app through our app, fee paid by Swissquote's relayer (a second test wallet, not
  Claire's): [lend 1 USDC to a Compound test deployment, 0xa449…](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af)
  on wallet [0x9C26…7B51](https://app.safe.global/transactions/history?safe=sep:0x9C26a4432f7E34f158560efB842c5EF9b2677B51)
- Refusal of Swissquote + partner without the card: read-only calls recorded in
  `swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json` lines 175–200 (v3 branch).

Sources: twelve-agent review (nine explorers, three critics) in the git-ignored scratch folder
`AgentsLocal/770ad2e6/wf/` (local only). Safe{Wallet} rendering checked on 11 Oct 00:12 CEST,
read-only; Sepolia transactions re-checked on a public node 00:30–00:36 CEST.
