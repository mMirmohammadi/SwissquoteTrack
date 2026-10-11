# Historical V4 planning script — superseded for execution

**Do not read the script below verbatim to judges.** It is retained as planning history: it assumes recordings and public-browser recovery not yet accepted, includes an unverified CHF 640,000 business forecast, and overstates what a stolen unlocked phone cannot do. Use the corrected [presenter notes](<../../pitch/v4/presenter-notes.html>) and [offline deck](<../../pitch/v4/deck.html>), with the current [acceptance](<acceptance.md>) and [execution status](<execution-status.md>) determining what may be claimed.


What this is: the words and clicks for judging on Sun 11 Oct 2026. Slide content: [slides.md](slides.md); staging and failures: [demo-runbook.md](demo-runbook.md).
Promise: "Swissquote can help you recover your wallet, but it can never move your money without you."
Roles: the Presenter speaks; the Driver clicks; nobody reloads a page.

## Before the slot: script-specific checks

The runbook covers staging, tabs, hardware and failures. These checks decide which optional rows below stay in:

- **Recipient:** wallet L has paid the test recipient once before the slot, so the stage payments skip the first-time check. The new phone may still ask for "the address’s last 4 characters"; keep them on a sticky note.
- **Fingerprint row:** keep it only if this laptop has Touch ID and the 6-USDC payment ran once on the public test network before the slot. It has not run there yet; staging needs `MOCK_ACCOUNT_START_USDC` ≥ 6.
- **Old-key row:** show it as a still from gate G1. "Try the old key · read-only" works only where the old key is unlocked in the same tab (`features/recovery/index.tsx:66`); on wallet S1's new-phone window it says "The old key is not available here". Run it live only if a rehearsal proves it on the stage windows.
- **Approved-apps row:** a still of the in-app Compound preview plus its mined transaction (`0xa44904bd…`, wallet `0x9C26…`). Never run a DeFi trade on stage: it was one supply to a test deployment, and every live transaction shares one global sender lock.
- **Unused tabs:** never open them on stage. Without the polish lane's demo profile, they stay visible.

Code paths are in `.worktrees/v3/swissquote-wallet/apps/wallet/src/` unless a path says otherwise.
⟨polish⟩ marks a screen detail that exists only if the UI polish lane merges; the "today" text is what the current UI shows. The Presenter's words never depend on it. If the polish lane merges, re-check every quoted label on screen: its copy pass may reword some.

## 5-minute stage script

▸ = the Driver's click cue. Topic numbers follow the track brief: 1 custody and threat model · 2 architecture · 3 creation · 4 authentication · 5 recovery · 6 business.
Times are for the default path, without the optional fingerprint row; it ends at 4:43. If the fingerprint row runs (+25 s), drop the old-key still and item 9 of the 3-minute list to stay under 5:00.

<!-- spoken:start -->
| Time | Presenter says (exact words) | Driver does / screen shows | Proves | Fallback if it stalls |
|---|---|---|---|---|
| 0:00 Hook | "Today, a Swissquote client who wants her own keys must withdraw her crypto and leave: Swissquote loses a client, and she loses her safety net. ▸ Meet Claire, a client for six years. Our promise: Swissquote can help you recover your wallet, but it can never move your money without you. ▸ Claire keeps three things: her phone, to pay; a printed Recovery Card, to get back in; and an Emergency Kit, to leave, even if Swissquote is gone." | Slide 1 → ▸ slide 2 (promise) → ▸ the three objects appear. | The problem and the promise. | Projector fails: say it anyway; nothing later depends on these slides. |
| 0:35 Act 1, creation | "Here is her sign-up, recorded this morning: her phone creates her key and keeps it locked there. ▸ From here on, it's live. Every transaction here is real, on the public Ethereum test network; only the back office — bank account, ID checks, mailbox, helper-key vaults and a demo sanctions list — is simulated and marked MOCK." | Play the 15-s clip (video chapter "Create"). ▸ Bring the wallet L window forward. ⟨polish: the footer lists every MOCK part. Today it omits the sanctions list and helper-key vaults (`App.tsx:525`); the spoken line covers them.⟩ | 3: the key is made on her phone. | Clip won't play: say the first sentence over slide 2 and go on. |
| 1:00 | "This badge means her wallet proved to Swissquote that it's hers, so her Swissquote account can pay into it." | Home: point at "Verified as yours", then at the ETH line "… ETH · network fees sponsored", which reads 0. | 3: the wallet is linked to her Swissquote identity. | Sign-in screen or blank page: switch line, chapter "Pay 1 USDC". |
| 1:08 | "She pays a friend one dollar. ▸ Claire never buys ether: her wallet holds zero, and Swissquote pays her network fees, up to a daily limit per client." | "↗ Send money" → paste the recipient, amount 1 → "Review payment" → point at "Fee: paid by Swissquote if sponsorship is approved." ⟨polish: point at "Network fee CHF 0.00, paid by Swissquote"⟩ → ▸ "Sign & send" → "Payment confirmed on chain." | Demo story: signed on her phone, sent to the public test network, no ether (gasless bonus). | No progress for 45 s, or an error dialog: switch line, chapter "Pay 1 USDC". |
| 1:38 Optional (+0:25 to every later time) | "Now six dollars. ▸ Small payments need only her phone; above five dollars, our demo limit, Swissquote also asks for her fingerprint, tied to that exact payment." | Same steps, amount 6. The preview says "Your passkey confirms this exact payment." → ▸ "Confirm with passkey & send" → Touch ID → "Payment confirmed on chain." | 4: a large payment needs a second check, tied to that payment. | Windows Hello: say "her face" or "her PIN". Prompt fails: "Edit payment" and go on; never retry. |
| 1:38 Approved apps | "Approved apps work the same way: Swissquote explains the trade in plain words, screens it, and pays the fee. ▸ Last night Claire lent one dollar to a test version of Compound, a lending app." | ▸ Slide 2b: the in-app preview of that loan → ▸ its transaction on Etherscan (`0xa44904bd…`), sent by Swissquote's relayer. | Compliant-dApp bonus: plain-words preview, screening, fee paid by Swissquote. | Slide missing: say the line over slide 2. |
| 1:50 Act 2, thief | "Now a thief steals her phone and takes over her email. ▸ Her phone and email get a thief into her account, but not her wallet: without her Recovery Card, the wallet refuses even Swissquote and the partner together. We checked this against the real wallet contract last night." | ▸ Slide 3: two locks and the recorded result "Swissquote signed · the partner signed · the wallet refused: Recovery Card missing". Never run the in-app attack test: it stops at the partner's MOCK face check and never reaches the wallet. | 1 and 5: even Swissquote and the partner together can't take over. A stolen phone and email are refused. | Slide fails: say the line. The record is `evidence/sepolia/full-2026-10-10T19-28-59Z.json` lines 175–200. |
| 2:10 Act 3, new phone | "Claire gets a new phone; for this demo, it's this same laptop. ▸ A recovery has a wait, so we started this one before we came on stage, with her card and the partner. Its wait is over. Before it takes over, the new phone saves a fresh Emergency Kit. Phone and card protect each other: lose the phone, and the card brings her back; lose the card, and her phone can stop the takeover during the wait. ▸ Her Recovery Card and one helper move the same wallet to a new phone after a wait: three minutes on stage, three days when Swissquote is the helper." | ▸ Wallet S1's new-phone window: "Waiting period complete on the last checked block" ⟨polish: a big countdown at zero and the step timeline⟩. The runbook's live finish sequence: unlock code → "Create new encrypted kit" → "Download new encrypted kit" → tick → unlock code → ▸ "Check block time, finalize and install saved key" → "Done — same address". | 5: same wallet, new key, after the wait. | No progress for 45 s: switch line, chapter "Wait over, finish". G1 failed: say S4 and play the recording instead. |
| 3:10 Old key (still) | "Her old key is now refused." | ▸ Still from gate G1: "The wallet contract refused the old key …" (live only if rehearsed; see the checks above). Don't read out the rest. | 5: the old key can no longer move money. | No G1 still: skip the sentence. |
| 3:15 | "And her new phone pays: same wallet, same money, new key." | "↗ Send money", amount 1, same recipient (type the last 4 characters if asked) → "Review payment" → ▸ "Sign & send" → "Payment confirmed on chain." | Demo story: the recovered wallet pays with the new key. | The app asks to reload or unlock: don't reload; switch line, chapter "New key pays". |
| 3:40 Act 4, Swissquote gone | "If Swissquote disappears, her Emergency Kit unlocks her key on her own computer, and standard tools move her money; she just pays the network fee herself. ▸ This is Safe's own app, which we didn't build, and it still shows her wallet and every payment. This row is her exit last night, with only her kit." | ▸ The pre-opened Safe{Wallet} history of wallet 0xad9c… (last night's full run). Cursor on "Sent −3 USDC" (tx 0xbc661bfd…). If asked, the two "swapOwner" rows are her key changes. ⟨polish: open it from "Open in Safe{Wallet} ↗"; today: the pre-opened tab⟩ | 5: with Swissquote gone, she still moves her money; no lock-in. | Tab won't load: slide 4, a screenshot of the same history. |
| 4:05 Legal | "The client's phone or Recovery Card is in every path that moves money, so we argue this is software, not custody, and Claire, not Swissquote, is the sender. That is our reading; FINMA confirmation is launch step one." | ▸ Slide 5. | 1: legal position on custody and on who sends. | — |
| 4:21 Business | "Ten thousand clients who stay instead of leaving, each trading ten thousand francs a year at Swissquote, bring in about 640,000 francs a year at 2025 rates." | ▸ Slide 6. | 6: business case. | — |
| 4:33 Close | "Claire keeps her keys, and Swissquote keeps Claire. Swissquote can help you recover your wallet, but it can never move your money without you. Thank you." | ▸ Slide 7 (one QR code). | — | — |
<!-- spoken:end -->

Spoken words: **527** on the default path and 553 with the fingerprint row (limit 600), counted from the Presenter column. That is about 3:30 of speech at 150 words a minute; clicks and confirmations take the rest. The default path ends at 4:43; with the fingerprint row and the two cuts named above, at about 4:59.
Q&A: the Presenter answers client, legal and business questions. The Driver answers architecture, security, fees and evidence, using backup slides B1–B7.

## 3-minute cut: drop in this order

1. The old-key still, and the fingerprint row if it was in (−5 s; −30 s with it).
2. The new-key payment row; "Done — same address" already proves the recovery (−25 s).
3. The creation clip. Say instead: "At sign-up, her phone created her key and keeps it locked there." (−12 s)
4. The badge sentence; point at "Verified as yours" in silence during the payment (−8 s).
5. "Meet Claire, a client for six years." and "Now a thief steals her phone and takes over her email." (−7 s)
6. Shorten the MOCK line to "Every transaction here is real; only the back office is simulated and marked MOCK." (−6 s)
7. Line 1 at the close; it was said at the start (−6 s).
8. The live Safe{Wallet} tab: say line 7 over slide 4, the screenshot of the same history, whose title carries S8; drop the two sentences after line 7 (−15 s).
9. "We checked this against the real wallet contract last night." Slide 3's small print carries the date (−4 s).
10. Shorten the approved-apps row to: "Approved apps work the same way: explained in plain words, screened, and the fee paid by Swissquote." (−7 s)

Result: about 371 spoken words, about 2:30 of speech at 150 words a minute and about 3:07 with the payment and recovery waits (our estimate). If the slot is strictly 3:00, drop the approved-apps sentence too; the submission carries that bonus. Act 3 still takes about 60 s, because the Driver's finish sequence sets its length. "Phone and card protect each other…" fills that time and costs nothing. Never cut the thief, the recovery, the legal caveat or the business line.

## 10-minute table: wallet F fully live

What changes: wallet F is created and recovered live; S1 is the safety net. The real 3-minute wait carries the explanations. Judge 1 holds the printed Recovery Card, and judge 2 plays the thief.
Props: a phone, the printed Recovery Card for wallet F in an envelope (made in the Independent Recovery Desk before the table; its words never reach the projector), and the Emergency Kit envelope.

Quoted labels exist in v3 today; the polish lane may rename the desk's header and tabs, so re-check them after its merge. The click order is an assumption until the table rehearsal.

| Time | Screen and clicks | Talk |
|---|---|---|
| 0:00–0:45 | Slides 1–2; the three objects on the table. | Hook rows of the 5-minute script. |
| 0:45–2:30 | Sign-up: "Email address", "Login password", "Recovery card public address" → "Create my wallet ↗". Swissquote creates the wallet and pays the fee → "Verified as yours" → "Save your emergency kit now." → "Download encrypted kit ↓" → "I saved it · hide code" → "Add a passkey". | "Her phone creates her key. The wallet needs only the Recovery Card's public address, never its words." Then the MOCK line. |
| 2:30–3:30 | Desk: "Check before you deposit" → "Check my wallet". Wallet: "Move to my wallet ↗" (MOCK account) → pay 1, then 6 with the fingerprint. | Line 8, then line 4. |
| 3:30–4:30 | Judge 2, as the thief, takes wallet L's window as her stolen phone. Not F's: a password reset ends every session of that account (`services/swissquote/IMPLEMENTATION.md:36`), which could stall F's live recovery and its last payment. "Forgot password?" → "Request reset · MOCK" → "Open MOCK mailbox" → "Use this local reset token" → "Reset login password · MOCK" → signs in. The key stays locked behind "Unlock device"; the recovery screen says "A password reset cannot unlock your wallet." Then slide 3. | "He's in her account, not her wallet." Then line 6 over slide 3. |
| 4:30–5:30 | New phone: "Prepare new phone" → "Copy public request". Judge 1 types the 12 card words into the desk, on a laptop turned away from the projector: "Approve a new device" → "Verify with my card" → "Sign this recovery approval" → "Copy approval code". Wallet: paste it, tick the address check, "Partner face check — MOCK" = "Enrolled demo client face" → "Ask helper and start recovery". | "Her card plus one helper starts the wait. The partner's face check is simulated." |
| 5:30–8:45 | The real wait: 3 minutes plus a 15-second safety margin; the status counts down "… (includes 15-second safety margin)". The old phone shows "Someone is replacing your wallet key." and "Stop it — this wasn’t me": point at it, never click it. If rehearsed, wallet B shows its 3-day countdown. | Use the wait: threat model (slide B2, 45 s) → architecture (B1, 30 s) → legal (slide 5 plus the bank-door line, 30 s) → business (slide 6, 40 s) → Safe{Wallet} (Act 4 lines, 30 s) → approved apps (slide 2b, 20 s) → "Ask us anything while the clock runs." |
| 8:45–9:45 | The runbook's finish sequence. The new kit code shows on screen; judge 1 writes it on the kit envelope. Then "Done — same address" → the new key pays 1. The desk, still turned away, runs "Open emergency kit" → "Decrypt locally" → "Check if this kit is current · contacts two nodes" → "Both nodes confirm this kit owner at the same block." | Line 5 and S2; read the desk result aloud. |
| 9:45–10:00 | Slide 7. | Line 12, line 1. |

If wallet F's creation shows no progress after 60 s, continue the story on wallets L and S1 with the 5-minute rows. Each table recovery uses up one staged wallet; re-stage between tables (about 10 minutes each).

## Fallback lines

- **Switch to video:** a live step shows no progress for 45 s, an error dialog appears, the tunnel drops, or the session is lost. The Presenter says: "Here is the same flow, recorded this morning on the public test network." The Driver plays the matching chapter. Return to live only for the next beat, and only if it is already on screen and working.
- **S4, if gate G1 failed** and the stage recovery is the local-chain recording: say it once, before the recording plays: "This recovery is a recording on a local test chain; the same contracts ran it by script on the public chain." Line 5 then says "three minutes in our demo" instead of "three minutes on stage".

## Never say

| Never say | Say instead |
|---|---|
| "Swissquote never holds keys" or "never co-signs" | "Swissquote holds no key that can move money alone, and never co-signs payments." |
| "The wallet requires a fingerprint (passkey) for large payments." | "Swissquote asks for her fingerprint above five dollars." In Q&A, S9: it is Swissquote's rule; the wallet obeys only Claire's key. |
| "It can never take it." | Line 1: "…it can never move your money without you." |
| "Regulated recovery helper" | "The partner", a separate recovery company. |
| "FINMA-compliant" | "That is our reading; FINMA confirmation is launch step one." |
| "Travel Rule solved" | "At the bank door, her wallet proves to Swissquote that it is hers." |
| "SECO-screened" | "Sanctions screening against a public on-chain list, plus a MOCK demo list." |
| "First in Switzerland" | Nothing: Sygnum launched Safe-based recovery in October 2024. |
| "Audited", any test count other than the freeze gate's | "`<N>` automated tests pass", with N from the freeze gate. |
| "DeFi is fully supported", "the official Compound market" | "One loan of one dollar to a test version of Compound, through our app; no withdrawal or swap yet." |
| "Her key never leaves the phone." | "Her Emergency Kit is a locked copy, opened only with its separate code." |
| "The wallet refuses him" over a helper or app refusal | "The partner refuses him." Say "the wallet refuses" only over the contract result. |
| Sepolia, guardian, relayer, module A/B, GS026, eth_call, EIP-1271, swapOwner, Candide, RPC, mined, unhackable | Public Ethereum test network · helper · Swissquote pays the fee · lock · the wallet refuses · confirmed on chain. |

## Settled questions (planner, 01:50)

1. **Switch line:** "the public test network", not "Sepolia": the audience hears no jargon.
2. **S3:** the new line ("A recovery has a wait, so we started this one before we came on stage…") replaces "…started ten minutes ago", which had no antecedent and breaks when staging slips. The runbook follows it.
3. **After finishing**, the screen says "Reload and unlock it if the wallet still shows the previous key." (`features/recovery/index.tsx:166`). Gate G1 now checks that the new key pays without a reload ([lead-message.md](lead-message.md)). If it needs a reload, "new key pays" becomes a video chapter.
4. **DeFi:** a Compound supply was mined through the app at 01:12 (one dollar, test deployment), so the approved-apps row replaces "no DeFi trade has reached the chain yet".
