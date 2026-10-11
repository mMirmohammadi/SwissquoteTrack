# Judge Q&A cards — v4

- **Who answers.** Presenter (P): client, business, legal. Engineer, who also drives (E): architecture, security, fees, evidence; on P cards the Engineer opens the proof only if asked. Hand-off: "<Name> built that part. <Name>?"
- **The rule.** Answer first in one sentence, give one proof, stop at about 20 seconds. Say the "If pushed" line only when pushed.
- **Bridges.** "That's a real limit. Today we… In production we'd…" · "Our position is X, because Y. It's the first question for counsel." · "We chose not to build that in 24 hours, because…"
- **Pointers.** Bare code paths are under `.worktrees/v3/swissquote-wallet/` (read 11 Oct, 01:30 CEST); "evidence JSON" = `evidence/sepolia/full-2026-10-10T19-28-59Z.json` there; full tx links are in [README › Evidence links](README.md#evidence-links-public-sepolia). ⚠ = update at the freeze.

## Security & custody (20 points)

**1 (P) Can Swissquote move Claire's money — alone, or together with the partner?**
- **A:** No. Only Claire's key can pay, and even Swissquote and our recovery partner together can't take over her wallet: without her Recovery Card, the wallet refuses them.
- **Proof:** the wallet's rules: one owner, and two locks that each need the card plus one helper — `packages/protocol/src/wallet.ts:40-44`.
- **If pushed:** Her card plus Swissquote could move the wallet to a new key after three days, so Swissquote approves only after her fingerprint login or a video ID check (MOCK), and her old phone can stop it.

**2 (E) A thief steals her phone and gets into her email. Can he take her money?**
- **A:** Her phone and email get a thief into her account, but not her wallet: without her Recovery Card, the wallet refuses even Swissquote and the partner together. The key on her phone has its own passphrase, and a password reset logs out every session and holds Swissquote's recovery help for 72 hours plus a video ID check (MOCK).
- **Proof:** `services/swissquote/src/app.ts:276` — "recovery needs a passkey login, or a 72-hour hold plus video ID (MOCK)".
- **If pushed:** If he also knows her phone's passphrase, he holds her key and can spend at once, as with cash or any wallet where you hold the key; the app states this limit itself (`apps/wallet/src/App.tsx:553`).

**3 (P) What if Claire loses the card too — or loses her phone and her card?**
- **A:** Her Emergency Kit: with its separate code, it unlocks her key on her own computer, so she still controls her wallet, no helper needed. Lose only the card, and her phone still pays and can stop any takeover; lose phone, card and kit, and the money is gone.
- **Proof:** evidence JSON lines 261–268 — the kit opens with its code (roundTrip true) and refuses a wrong code.
- **If pushed:** No one, us included, can rescue a wallet when phone, card and kit are all gone — that's the price of holding your own keys, so the app tells her to keep the kit code apart from the card (`apps/wallet/src/App.tsx:524`).

**4 (E) Why make her wait — three days with Swissquote, three minutes on stage — and can her old phone stop it?**
- **A:** The wait is her window to stop a takeover she didn't start: her old phone shows "Someone is replacing your wallet key", and "Stop it — this wasn't me" cancels it. The partner's lock waits three minutes, a demo setting that fits our slot; Swissquote's lock waits three days, so no one inside Swissquote can rush a takeover.
- **Proof:** evidence JSON lines 131–173 — on the public test network, recoveries with a 180-second and a 259,200-second (3-day) wait were started, then her key stopped both in one transaction, 0x4bbd…0681.
- **If pushed:** Whoever can unlock her key can also press Stop, so a thief who knows her phone's passphrase can block her recovery — the limit of any wallet where you hold the key.

**5 (E) Is "the wallet refused both helpers" real, or a demo trick?**
- **A:** It's real, but it's a recorded test, not a transaction: we asked both of the wallet's locks on the public Ethereum test network to accept Swissquote's and the partner's signatures without the card, and both refused. Nothing was sent, so there is no transaction hash, only the recorded answer from 10 October.
- **Proof:** evidence JSON lines 175–200 — signers "partner" and "swissquote", readOnly true, "Signer not a guardian" on both locks (each lock lists only the card and one helper).
- **If pushed:** The attack button in our app is stopped earlier, by the partner's MOCK face check (`services/partner/src/service.ts:80`), so for that one we say "the partner refuses him", never "the wallet refuses".

**6 (E) Is the fingerprint enforced by the contract?**
- **A:** No. The fingerprint check is Swissquote's rule for its own service; the wallet obeys only Claire's key, which is why it still works when Swissquote is gone.
- **Proof:** `services/swissquote/src/app.ts:181` — no fingerprint approval of that exact payment, no fee paid ("Transaction-bound passkey required"). ⚠ So far shown only on the local test chain ([README](README.md) line 42).
- **If pushed:** A thief with her unlocked key who pays his own fee skips the fingerprint: it guards Swissquote's service, while her phone's passphrase guards the key.

**7 (P) What if Swissquote disappears?**
- **A:** If Swissquote disappears, her Emergency Kit unlocks her key on her own computer, and standard tools move her money; she just pays the network fee herself. Safe's own app, which we didn't build, still shows her wallet and every payment.
- **Proof:** tx 0xbc66…110c — the kit's key moved 3 USDC with "services: none (RPC only)" (evidence JSON lines 270–284).
- **If pushed:** That exit ran by script, not as a live shutdown drill, and a separate test account paid the fee in place of Claire's own ether.

**8 (E) What stops Swissquote shipping an app update that copies her key?**
- **A:** Nothing inside the wallet — that's a real limit of every wallet app, ours included. In production we'd publish reproducible builds that outsiders can check, and have an independent party publish the Recovery Desk, so she can always leave with her kit.
- **Proof:** the Independent Recovery Desk is a separate app that opens her kit from a saved page with no network connection (`apps/recovery-tool/index.html:8`).
- **If pushed:** Today we built both apps ourselves and don't claim reproducible builds yet; what holds now is that her phone creates her key, and Swissquote never holds it.

## Legal (15 points)

**9 (P) Is this custody? And is Swissquote the sending institution?**
- **A:** The client's phone or Recovery Card is in every path that moves money, so we argue this is software, not custody, and Claire, not Swissquote, is the sender. That is our reading; FINMA confirmation is launch step one.
- **Proof:** Federal Council DLT report (2018), pp. 66–67 and 137; FINMA Guidance 08/2023, §2.2 (keys under the client's exclusive control: no custody).
- **If pushed:** The hard case is card plus Swissquote replacing her key after three days, so Swissquote's approval would be an ID-checked mandate; and if FINMA sees paying her fee as sending, we'd sponsor only payments to verified recipients.

**10 (P) How do you meet the Travel Rule? How does Swissquote know the wallet is hers?**
- **A:** At the bank door: Swissquote sends money from her account only to a wallet she has proven is hers. Her phone signs a one-time Swissquote challenge, and Swissquote checks that signature against the wallet itself on the chain (the EIP-1271 standard), so the proof can't be replayed.
- **Proof:** evidence JSON lines 62–71 — "ownership-proof-eip1271", verified true on the public test network.
- **If pushed:** The signature proves control and her ID check (KYC) proves who she is; whether Swissquote accepts this proof for a contract wallet is the first question for counsel, and after a recovery she proves it again with her new key.

**11 (P) Do you screen for sanctions?**
- **A:** Yes: before Swissquote pays any fee, it screens the addresses and refuses on a hit, or when a list is missing or out of date. Only the entries on our demo sanctions list are MOCK; the same check also reads a live public sanctions list on the chain and USDC's own freeze list. In production we'd add SECO's list for client names and a commercial address-screening service for wallets.
- **Proof:** `services/swissquote/src/app.ts:36` — "Screening positive hit: sponsorship blocked"; "Required screening unavailable or stale". Live lists: `services/swissquote/src/screening.ts:36-39` (named at `:45` "RedStone OFAC/EU/UN-derived sanctions oracle" and `:54` "Circle issuer freeze list").
- **If pushed:** It only decides what Swissquote pays for — someone paying his own fee isn't stopped by it — so the checks at the bank door stay in place.

**12 (P) What does the recovery partner learn about Claire?**
- **A:** Only what its own lock needs: her face record (MOCK) and, when she asks for help, which wallet to approve. It never receives her card words, her key, her kit code or her Swissquote client number.
- **Proof:** `apps/wallet/src/features/recovery/index.tsx:79` — "Only public request fields and MOCK check input go to helpers. Never card/owner words or kit code."
- **If pushed:** The chain is public, so once it knows the wallet it can see the balance like anyone else; production needs a data-processing contract and a real ID check in place of the MOCK face match.

## Technical (35 points)

**13 (E) Why Safe and not MPC? And what about other chains?**
- **A:** Because Safe's rules live in public contracts anyone can check, and they keep working without us; with MPC — one key split between her and the provider — the rules sit in the provider's servers, so you trust the provider. It also meant we invented no cryptography: Safe's contracts and an existing recovery module do the hard part.
- **Proof:** Safe's own app (app.safe.global) shows wallet 0xad9c…dA9 with "1 out of 1 signer" and two "SocialRecoveryModule" modules (checked 11 Oct, 00:12 CEST).
- **If pushed:** The price is Ethereum-family networks only: each network's wallet recovers separately, and Bitcoin is research only.

**14 (E) Is it audited?**
- **A:** Our own code is not audited. We build on [Safe's v1.4.1 contracts](https://github.com/safe-global/safe-smart-account), which Ackee Blockchain audited for Safe, and on the Candide recovery module v0.0.1, for which Safe's repository lists an Ackee audit; we haven't checked that the deployed module matches that audited version.
- **Proof:** `.worktrees/v3/Docs/submission/architecture.md:30` — "An audit of Safe/Candide dependencies does not audit our composition."
- **If pushed:** Before launch we'd commission an independent audit of our setup and services; today we have ⚠ `<N>` automated tests passing at the freeze gate — tests, not an audit.

**15 (E) What in the demo is real, and what is MOCK?**
- **A:** Every transaction shown is real, on the public Ethereum test network; only the back office — bank account and funding, ID checks (KYC, face check), mailbox, sanctions list, helper-key vaults — is simulated and marked MOCK. The recovery you saw was started before our slot so its wait was over, and nothing on the public network yet covers a full three-day Swissquote recovery, or a DeFi withdrawal or swap.
- **Proof:** every transaction link: [README › Evidence links](README.md#evidence-links-public-sepolia). The old key's refusal is a still from the G1 recording, or the scripted Sepolia refusal (evidence JSON lines 242–250, "old-key-rejected-gs026", read-only), unless rehearsal proved the live check.
- **If pushed:** ⚠ If gate G1 failed, sentence 2 becomes "This recovery is a recording on a local test chain; the same contracts ran it by script on the public chain", and sentence 1 says "every transaction shown live".

**16 (E) Which AI tools did you use?**
- **A:** AI coding agents helped throughout — code, tests, research and documents — and our submission lists each tool and what it did.
- **Proof:** `.worktrees/v3/Docs/submission/ai-tools.md`. ⚠ The full team list is still pending there (line 10); the integration owner merges it.
- **If pushed:** No AI runs inside the product, and every claim we make on stage is checked against tests or public transactions, not against an agent's word.

## Business (15 points)

**17 (P) What is this worth to Swissquote?**
- **A:** Ten thousand clients who stay instead of leaving, each trading ten thousand francs a year at Swissquote, bring in about 640,000 francs a year at 2025 rates. At this year's weaker first-half rates it's about CHF 0.2–0.3 million, which is why we show a range.
- **Proof:** 0.638% = Swissquote's 2025 net crypto income (CHF 85.7 m) ÷ crypto trading volume (CHF 13.4 bn); H1 2026 crypto income CHF 14.6 m, down 66% (business report, `AgentsLocal/770ad2e6/wf/business/REPORT.md`; not re-checked here).
- **If pushed:** 10,000 is 1.4% of Swissquote's 690,828 trading accounts, and nothing is measured yet — the pilot compares who stays against a matched group of clients.

**18 (P) Doesn't a wallet with an exit kit just make leaving easier?**
- **A:** No — clients can already leave today: they withdraw to an outside wallet for 10–15 dollars, and they're gone. With our wallet her coins stay in the Swissquote app, one step from her account, so her next trade can still happen at Swissquote.
- **Proof:** Swissquote's pricing — withdrawal USD 15 (USDC) or USD 10 (BTC, ETH); custody CHF 20 a quarter up to CHF 50,000 (`.worktrees/v3/Docs/submission/business-case.md:15-16`).
- **If pushed:** Yes, the Emergency Kit lets her leave for good — that promise is why she can trust it — and custody income mostly stays, because the fee is flat up to CHF 50,000.

**19 (P) Would anyone pay CHF 4.90 a month for recovery help?**
- **A:** We don't know yet, so the 640,000 francs doesn't count on it. It's upside: if 20% of 10,000 clients paid, that's about CHF 117,600 a year, and Ledger charges USD 9.99 a month for its recovery service.
- **Proof:** 2,000 clients × CHF 4.90 × 12 months = CHF 117,600; Ledger's price is in the business report (`AgentsLocal/770ad2e6/wf/business/REPORT.md`).
- **If pushed:** The pilot measures exactly that: paid take-up against a matched group of clients.

## UX & pitch (15 points)

**20 (P) Isn't this too complicated for a normal client?**
- **A:** No: day to day she uses only her phone, and she never buys ether, because Swissquote pays the network fee. The Recovery Card and the Emergency Kit sit in a drawer until something goes wrong, and each has one job: get back in, or leave.
- **Proof:** the payment review screen — "Network fee: Paid by Swissquote" (`apps/wallet/src/App.tsx:514`).
- **If pushed:** We haven't tested it with real clients; the pilot would measure whether clients actually store the card and the kit.

## Bonus (gasless 10, compliant DeFi 10)

**21 (E) Who pays the network fee, what would it cost on mainnet, and how do you stop abuse?**
- **A:** Swissquote pays — about 2 US cents per payment at 10 October mainnet prices — so Claire's wallet holds zero ether. It pays only for verified clients' own signed payments, after a test run, within caps: 50 a day per client, 1,000 a day overall, a size limit per transaction and one new wallet per account.
- **Proof:** two transactions made in our app, both sent by Swissquote's relayer while the wallet and its owner held 0 ETH: the [payment 0xe318…c77e](https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e) and the DeFi [supply 0xa449…94af](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af).
- **If pushed:** The caps are in `services/swissquote/src/app.ts:76-85`, but on a busy-network day a payment could cost about 5 dollars, so production needs a monthly fee budget per client and a ceiling on fee prices, which we haven't built.

**22 (E) Did you do DeFi?**
- **A:** Yes — one approved-app trade ran through our app on the public test network: a wallet made in our app lent 1 USDC to Compound, a lending app, and Swissquote paid the fee. Before signing, the app explained the trade in plain words, checked that Compound is on the approved list, and screened it against live sanctions and USDC freeze lists.
- **Proof:** [tx 0xa449…94af](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af), block 11887754, wallet [0x9C26…7B51 in Safe{Wallet}](https://app.safe.global/transactions/history?safe=sep:0x9C26a4432f7E34f158560efB842c5EF9b2677B51): one signed batch, approve 1 USDC → supply → approve 0, so the app's allowance is back to zero (`.worktrees/v3/Docs/research/v3-live-compound-evidence.md`).
- **If pushed:** It's a third-party Compound III test deployment, not an official Compound market, and it credited 999,998 of 1,000,000 base units because of Compound's rounding and interest accrual — our own preview check had refused an earlier attempt on exactly that rounding, so we pinned the maths and re-tested it. We have not run a withdrawal or a swap.

## Never say → say instead

| Never say | Say instead |
|---|---|
| "Swissquote never holds keys / never co-signs" · "it can never take it" | "Swissquote holds no key that can move money alone, and never co-signs payments." · "Without her Recovery Card, the wallet refuses even Swissquote and the partner together." |
| "The wallet requires a fingerprint for large payments" | "Swissquote asks for her fingerprint, tied to that exact payment." |
| "Regulated recovery helper" · "FINMA-compliant" | "We argue this is software, not custody. That is our reading; FINMA confirmation is launch step one." |
| "Travel Rule solved" · "SECO-screened" | "Swissquote sends only to a wallet she has proven is hers." · "Screened before Swissquote pays the fee; the demo list is MOCK." |
| "Audited" (about us) | "Built on Safe's contracts, audited for Safe; our own code isn't audited." |
| "Official Compound market" · "DeFi is fully supported" · "withdrawals work" · any other DeFi claim without a receipt | "One approved-app trade ran on the public test network: 1 USDC lent on a Compound test deployment. No withdrawal or swap yet." |
| "First in Switzerland" | Nothing about firsts: Sygnum launched Safe-based wallet recovery in October 2024. |
| "The key never leaves the phone" · "any standard wallet can move her money" | "Her phone creates her key, and Swissquote never holds it." · "Standard tools move her money." |
| "The wallet refused him" (in-app attack test) | "The partner refuses him." Keep "the wallet refuses" for the recorded contract answer. |
| A test count from any older gate | ⚠ "`<N>` automated tests pass" — the freeze gate's number only. |

## Open questions / objections

1. ⚠ Cards 4, 6, 14, 15 and the last table row depend on gate G1, the public fingerprint run and the freeze gate's test count; the Engineer updates them at the freeze.
2. The v3 submission still contradicts these cards: `.worktrees/v3/Docs/submission/SUBMISSION.md:23` says "regulated recovery helper"; `SUBMISSION.md:29` and `business-case.md` lead with a CHF 406,207 subscription scenario, not the 640,000 headline; `custody-travel-rule.md:7` cites FINMA 01/2026. Fix before submitting.
3. Sanctions wording: card 11 now says only the demo list's entries are MOCK, while the fixed one-line MOCK summary (card 15, judge card) still lists "sanctions list". Safe, but it undersells; the planner decides whether to say "demo sanctions list" there.
4. The planned screens ("Who can move my money?", "Open in Safe{Wallet} ↗", "CHF 0.00") are not in the v3 code, so cards 1 and 20 point to code and the current screen; repoint them if the screens ship.
5. Card 17's inputs (0.638%, 690,828 accounts, CHF 14.6 m) come from the business report and v3 docs; nobody re-checked them against Swissquote's reports tonight.
