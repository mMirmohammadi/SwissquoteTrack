# Historical V4 slide specification — superseded

**Use the built, claim-reviewed [offline deck](<../../pitch/v4/deck.html>) and [presenter notes](<../../pitch/v4/presenter-notes.html>), not this old specification.** The historical forecast and assumed recordings below were corrected or removed in the actual deliverables. Current proof is in [acceptance](<acceptance.md>).


What this is: the content of every slide (title, words, visual), not the build. The spoken words are in [pitch-script.md](pitch-script.md).

**Build note**
- Build the deck as one HTML file and export it to PDF with Playwright; this machine has no PowerPoint tools.
- Take fonts and colours from the wallet: Swissquote orange only for the one thing to look at, dark green for titles and for "real" boxes.
- Never put Recovery Card words, kit codes or full hashes on a slide; short transaction IDs (0xbc661bfd…) are fine.

## Main deck: 5 minutes, 8 slides

Every title is a full sentence the audience can repeat. Slide 4 appears only if the live Safe{Wallet} tab fails, or in the 3-minute cut. Times follow the default path in [pitch-script.md](pitch-script.md).

### 1. Hook (opening, 0:00)
- **Title:** Today, a client who wants her own keys has to leave Swissquote.
- **On the slide:** one visual, no bullets.
- **Visual:** on the left, a Swissquote account card with an orange edge, holding "Claire's crypto". A grey arrow labelled "withdraw" leads to a plain "Wallet elsewhere" card. Two captions under the arrow: "Swissquote loses a client." and "She loses her safety net." Claire is a simple avatar labelled "Claire, client for six years".

### 2. Three things (opening, 0:10)
- **Title:** Swissquote can help you recover your wallet, but it can never move your money without you.
- **On the slide:** three object cards, one per click: **Phone**, to pay · **Recovery Card** (printed), to get back in · **Emergency Kit** (a file plus a separate code), to leave, even if Swissquote is gone.
- **Visual:** three equal cards in a row with line icons; no caption.
- **Next click:** the 15-second sign-up clip, full screen, captioned "Recorded this morning · public test network".

### 2b. Approved apps (after the first payment, 1:38)
- **Title:** Approved apps work the same way: explained, screened, and the fee paid by Swissquote.
- **Click 1, visual:** a screenshot of the app's plain-words preview of a 1-USDC loan to Compound. Capture it in the 06:00 walk-through on its wallet: open the approved apps, prepare the loan, stop at the preview, take the screenshot, press Back. Never sign it. If the preview fails, use click 2 alone.
- **Click 2, visual:** the Etherscan page of transaction 0xa44904bd…, with an orange box around the sender, labelled "fee paid by Swissquote".
- **Small print:** "One loan of 1 USDC to a test version of Compound, 11 Oct 2026, 01:12. No withdrawal or swap yet."

### 3. Who can move the money? (Act 2, 1:50)
- **Eyebrow:** Who can move the money?
- **Title:** Only her key pays, and each recovery lock needs her Recovery Card.
- **Visual, left two-thirds:** two padlocks.
  - Lock 1: Recovery Card + the partner → new phone after a wait (3 minutes in this demo).
  - Lock 2: Recovery Card + Swissquote → new phone after 3 days.
  - Under both: "Swissquote and the partner never share a lock."
- **Visual, right third:** the recorded result card (still S6). Title "Even both helpers together are refused". Body "Swissquote signed · the partner signed · the wallet refused: Recovery Card missing". Small print "Checked on the public Ethereum test network, nothing sent, 10 Oct 2026".

### 4. Fallback for Act 4 (only if the live tab fails, 3:40)
- **Title:** Without Swissquote, Safe's own app still shows her wallet and every payment.
- **Visual:** a screenshot of the Safe{Wallet} history for wallet 0xad9c…. Source: `AgentsLocal/770ad2e6/wf/wildcard/safe-history.png`; copy it into the deck folder. One orange box around "Sent −3 USDC", labelled "Her exit with the Emergency Kit, without Swissquote · 10 Oct 2026 · 0xbc661bfd…". Small grey labels on the two "swapOwner" rows: "key change".

### 5. Legal (4:05)
- **Title:** Every path that moves money needs the client's phone or Recovery Card.
- **Subtitle:** So this is software, not custody, and the client is the sender.
- **Lines:** "Swissquote pays the network fee; it can't change who gets paid." · "At the bank door, her wallet proves it is hers by signing a one-time Swissquote challenge."
- **Footer:** "Our reading; FINMA confirmation is launch step one. Sources: Federal Council DLT report (2018), pp. 66–67 and 137 · FINMA Guidance 02/2019 · FINMA Guidance 08/2023, §2.2."
- **Visual:** text only; the dark-green title carries the slide.

### 6. Business (4:21)
- **Title:** Clients keep their keys — and Swissquote keeps the client.
- **Headline number:** about CHF 640,000 a year, from 10,000 clients who stay, each trading CHF 10,000 a year, at 2025 rates.
- **Lines:** "Upside: Recovery Assistance subscription at CHF 4.90 a month, not in the headline." · "Cost: about 2 US cents per sponsored payment, capped per client."
- **Footnote:** "In a year as quiet as H1 2026: about CHF 0.2–0.3 m. Basis: CHF 85.7 m net crypto income ÷ CHF 13.4 bn crypto volume = 0.64 % (Swissquote 2025 results). 10,000 clients = 1.4 % of 690,828 trading accounts. Fees priced at 0.0655 gwei and ETH USD 2,506 on 10 Oct 2026."
- **Visual:** the headline number large; the two lines small, side by side.

### 7. Close (4:33)
- **Title:** Claire keeps her keys, and Swissquote keeps Claire.
- **Subtitle:** the promise, line 1.
- **Visual:** one QR code, captioned "Check her wallet's history in Safe's own app". Team names underneath.
- **QR target:** if gate G1 passes, `https://app.safe.global/transactions/history?safe=sep:<wallet recovered in the browser>`; otherwise `https://app.safe.global/transactions/history?safe=sep:0xad9c2831beeF85Df126BE1f80a443d26e2122dA9`.

## Backup deck for Q&A: 7 slides

Plain label first; the technical name follows in small grey type, for engineers' questions. This is the only place where technical names appear. Code paths are in `.worktrees/v3/swissquote-wallet/`.

### B1. Architecture (topics 1 and 2)
- **Title:** Everything that moves money is real; only the back office is simulated and marked MOCK.
- **Visual:** boxes. A solid border means real and running; a dashed border with a "MOCK" tag means simulated.
  - **Client phone or browser**, running the wallet app: makes and locks her key, signs payments. Solid.
  - **Independent Recovery Desk**, one saved web page that works offline: makes the Recovery Card, signs card approvals, opens the Emergency Kit. Solid. Its "separate publisher" tag is dashed: the same team publishes it today.
  - **Swissquote services:** account and ID check (dashed, MOCK) · fee payer on the public test network (solid; small print "relayer") · sanctions screening (solid: the public on-chain sanctions list and the USDC freeze list; dashed: a MOCK demo list) · helper-key vault (dashed, MOCK).
  - **Partner service**, a separate process: face check (dashed, MOCK) · helper-key vault (dashed, MOCK).
  - **Public Ethereum test network** (solid; small print "Sepolia"): her wallet (small print "Safe v1.4.1"), two recovery locks (small print "Candide SocialRecoveryModule × 2"), USDC.
  - **Safe{Wallet}**, Safe's own app, not ours (solid, grey): reads the same wallet.
- **Arrows:** phone → fee payer → network (signed payment) · desk ⇢ phone (approval code, copied by hand) · each helper key → its own lock only · Safe{Wallet} → network (read only).
- **Footer:** "`<N>` automated tests pass" (N from the freeze gate). Small print: `packages/protocol/src/wallet.ts:40`; waits 180 s and 259,200 s (`packages/protocol/src/constants.ts:19`).

### B2. Threat model (topic 1, and topic 5's stolen phone and email)
- **Title:** Only her key can pay; every takeover needs her Recovery Card, and her phone can stop it during the wait.

| Who | Move money now? | Take over the wallet? | Lock her out? |
|---|---|---|---|
| Thief with her phone and email | No: her key stays locked behind her unlock code | No: no Recovery Card | No: card + one helper bring her back |
| Swissquote alone | No | No | No: she pays her own fee, or uses her kit |
| Swissquote + the partner together | No | No: the wallet refuses without the card (slide 3) | They can refuse to help; her kit still works |
| Stolen card + one fooled helper | No | Only after the wait, and her phone can stop it | Only if she misses the whole wait |
| Swissquote gone for good | — | — | No: her kit and Safe's own app (slide 4) |

- **Honest limits, under the table:** "A thief with her phone and her unlock code can pay, like cash in a stolen wallet; she starts recovery at once." · "A malicious app update could steal, as with any wallet app; that is why the desk should come from a separate publisher."

### B3. Creation and authentication (topics 3 and 4)
- **Title:** Her phone makes her key; for large payments, Swissquote also asks for her fingerprint.
- **Left, creation in order:** (1) the desk makes the Recovery Card: 12 words, printed; the wallet gets only its public address. (2) Sign-up with an ID check (MOCK). (3) Her phone creates her key and locks it with her unlock code (small print: BIP-39, `packages/protocol/src/constants.ts:6`). (4) Swissquote creates the wallet and pays its fee, one wallet per account. (5) Her wallet signs Swissquote's one-time challenge → "Verified as yours". (6) She saves her Emergency Kit: a locked copy of her key, opened only with its separate code.
- **Right, authentication:** up to 5 USDC (our demo limit), her phone's key signs and nothing else is asked. Above it, Swissquote also asks for her fingerprint, tied to that exact payment (small print "single-use passkey approval of the payment's hash"). A password alone cannot approve a large payment; a password reset ends every session and pending approval.
- **Footer (line S9):** "The fingerprint check is Swissquote's rule for its own service; the wallet obeys only Claire's key, which is why it still works when Swissquote is gone."
- **Small print:** `packages/protocol/src/constants.ts:37` (`USDC_LIMIT = 5_000_000n`) · `services/swissquote/src/app.ts:181` · `services/swissquote/IMPLEMENTATION.md:32`, `:36`.

### B4. Fees with no ether (gasless bonus)
- **Title:** Swissquote pays her network fees, about two US cents a payment, within hard limits.
- **Cost:** about USD 0.02 per payment (0.0655 gwei, ETH USD 2,506, 10 Oct 2026); about USD 1.23 per client in the first year.
- **Limits:** verified accounts only, 50 a day per account and 1,000 a day overall · every payment test-run first, with a 20 % margin on the fee estimate and a gas cap of 15,000,000 · one wallet creation per account · large payments need her fingerprint. Source: `services/swissquote/IMPLEMENTATION.md:30`, `:32`.
- **Her way out:** these are Swissquote's sponsorship rules, not limits on her wallet; she can always pay her own fee.
- **Small print, counsel risk:** FINMA could treat a bank-run fee payer as a payment service (Art. 2(3)(b) AMLA). Fallback: sponsor only payments to verified recipients.

### B5. DeFi guard rails (compliant-dApp bonus)
- **Title:** Swissquote checks DeFi before she signs, and one loan has run on the public test network.
- **Lines:** approved apps only; unlisted spenders are refused · sanctions screening against the public on-chain sanctions list and the USDC freeze list, plus a MOCK demo list · a preview in plain words; unknown actions count as large and need her fingerprint.
- **Done once:** 1 USDC lent to a third-party test deployment of Compound III, fee paid by Swissquote, approval reset to zero in the same signed batch (transaction 0xa44904bd…, wallet 0x9C26…). **Not done:** withdrawal, swap, the official Compound market.
- **Small print:** `services/swissquote/src/app.ts:36-37` · `services/swissquote/src/policy.ts:90-108` · `services/swissquote/IMPLEMENTATION.md:34` · `evidence/sepolia/browser-compound-2026-10-11.json`.

### B6. Evidence on the public test network
- **Title:** Every claim on stage has a public transaction or a recorded read-only check behind it.

| What it shows | Transaction | Record |
|---|---|---|
| Wallet created | 0xa98a4f5f… | `evidence/sepolia/full-2026-10-10T19-28-59Z.json` |
| Payment with zero ether in the wallet | 0xe3188195… | `evidence/sepolia/browser-service-2026-10-11.json` lines 102–110 |
| Both helpers refused without the card | read-only check, nothing sent | `full-…json` lines 175–200 |
| Recovery finished after the real 3-minute wait | 0x1231c281… | `full-…json` lines 229–241 |
| Old key refused | read-only check, nothing sent | `full-…json` lines 243–250 |
| Exit with the Emergency Kit, without Swissquote | 0xbc661bfd… | `full-…json` lines 270–283 |
| Loan of 1 USDC to a test version of Compound, fee paid by Swissquote | 0xa44904bd… | `evidence/sepolia/browser-compound-2026-10-11.json` |
| Recovery finished inside the app (gate G1) | `<fill if G1 passes>` | `evidence/sepolia/browser-recovery-2026-10-11.json` |

### B7. AI tools we used (required by the track brief)
- **Title:** `<team fills: which AI tools we used, and for what>`
- **Table:** Tool · Used for · Checked by, one row per tool. `<fill>` × 3.
- **Footer:** `<fill: what humans decided and verified>`.
