# Five-minute judge pitch — keep the relationship, not the payment key

**Your key pays. Your card and one helper recover the same address. Your current emergency kit provides an independent exit.** Present the measured Sepolia script first; do not turn it into a claim that the browser, bank services or DeFi ran publicly.

## Evidence lock and stage choice

The [public story record](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) reports chain 11155111, success across 23 steps, mined payments, module-A recovery after the real chain delay, cancellation of both modules and a 3-USDC RPC-only kit sweep. L11 inspected this local artifact; it did not independently query Etherscan. Ordinary story submissions use TREASURY, not the service RELAYER; FUNDER pays the kit sweep. Read-only refusals are not mined attacker transactions. The [claim ledger](<claims.md>) is the shared claim index and now reconciles all 23 records and 11 mined transactions with this artifact. Do not promote its other pending rows.

Default delivery: recorded evidence walkthrough, with optional **rehearsed local** screens clearly labelled. No local asset generation, public hosting, upload or external action is needed. This is a script/storyboard, not an existing video or rendered slide deck. Use the [seven-slide storyboard](<../pitch/storyboard.md>) and [judge answers](<../pitch/judge-questions.md>).

If the lead later approves a live run and confirms browser/service acceptance, use two named wallets: **L, live**, and **S, staged**. Say when switching. S's real wait must already have elapsed; never imply L recovered early. A single-wallet live run needs a longer slot. This document authorizes no transactions.

## Timed narration

### 0:00–0:30 — The promise

“Clients who want self-custody should not have to lose their Swissquote relationship. We kept the bank useful without giving it the ordinary payment key. The distinction is simple: your key pays; your card plus one helper recovers; your emergency kit lets you leave.”

Show slide 1. Say “prototype”, not “launch-ready”. The opportunity comes from the [supplied challenge](<../desc.md#L74-L97>), not measured retention.

### 0:30–1:15 — Create and pay, with a checkable address

“This is our recorded public Sepolia run, not a live browser session. We created this wallet, proved control of it, funded it with test USDC and signed payments. The address stays our reference throughout.”

Show [wallet address](https://sepolia.etherscan.io/address/0xad9c2831beeF85Df126BE1f80a443d26e2122dA9), [deployment](https://sepolia.etherscan.io/tx/0xa98a4f5f8932987d76de852c969c80cf3461a12045b18dddee72995aef735b85), then [6-USDC payment](https://sepolia.etherscan.io/tx/0xdada558819ace01b66d6d8e3dd69832a7d1c8e427335ac6caf4599d10f4cd8b7).

“The script's treasury paid the outer transaction fee; this is not proof of Swissquote service sponsorship. The browser's passkey is intended to confirm larger sponsored payments. The on-chain owner is still the device key, not the passkey.”

Do not narrate a completed passkey prompt from the script's `requiresPasskey` classification. An ownership signature proves key control, not bank-approved legal ownership or real KYC.

### 1:15–2:05 — Lose the phone, not the address

“Keep three things: your phone, your independent 12-word Recovery Card, and your Emergency Kit file with its code stored separately. The advanced 24 words recreate the payment owner. They are not the card, and they can spend immediately. The card cannot pay by itself.”

“On a replacement phone, the new key needs the card and one helper. The partner path waits 180 seconds in this demo; the Swissquote path waits three days. Production waits are undecided. We verify the full new-owner address, not a short matching code. Card words belong only in a trusted saved recovery tool, never the wallet app or a linked website.”

Show the two separate routes on slide 3. These are **card + partner OR card + Swissquote**, not any two of three. Tool independence is a governance requirement; two localhost pages alone do not prove independent publishers.

### 2:05–2:50 — Ask the contract who can take over

“The two institutions together, without the card, were refused on both modules. Those are read-only calls to the real contract, not mined theft attempts. Card plus one helper can replace the owner after the wait, and that replacement owner can then spend. So our precise promise is that a user-held credential is necessary under these configured rules—not that every valid signature proves the human consented.”

Show `no-card-refused-a/b` in the [record](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L175-L200>): “Signer not a guardian”. Do not call this throwaway-wallet or independent service-authorization evidence.

“If a thief has the unlocked payment key or its 24 words, they can spend immediately and cancel your legitimate recovery. You also trust the app version you run: a malicious publisher could copy that key. We have not solved those risks.”

### 2:50–3:20 — Cancellation and the optional DeFi beat

“The owner cancelled both pending routes in one mined batch. That proves contract cancellation—not that an alert reached a user or a service always pays for it. Protective sponsorship is intended to have separate reserves and limits; availability, sanctions exceptions and fee caps still matter.”

Show [both-module cancel](https://sepolia.etherscan.io/tx/0x4bbdd6bd0b25a2981e7f7f6fa4dc2b9c9fe75b6b5252e543f930fe1838980681).

Optional, within this same slot: “For DeFi, real read-only Sepolia simulations exist. Swap and supply execution are pending: no mined DeFi result is claimed. Our fee-sponsorship design previews effects and refuses unlisted actions; it does not stop an owner paying their own gas. A supply position is not a bank deposit, not depositor-protected, and not investment advice.” See [simulation source record in the plan](<../plans/v3/build-plan.md#L246-L254>) and [bonus evidence gates](<bonus.md>). If no verified preview screen is available, omit the screen; keep the pending label on slide 5.

### 3:20–4:15 — Recovery completes; the old key fails; the kit exits

“We restarted the partner route. The chain refused completion before maturity, then accepted it after the real 180-second wait. This is the same wallet address with a new owner.”

Show [finalization](https://sepolia.etherscan.io/tx/0x1231c281bbb949ea3c64917618b4f626cc70a77a0621b7a2d763ae95de3c743e) and the [delay/old-key checks](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L216-L259>).

“The contract refused the old key: GS026, in a read-only call. The old kit no longer controls the wallet. Save a new kit after every owner change. With the current kit, this script swept the remaining 3 USDC using RPC only and a separately funded submitter—no bank or partner service calls. You still need the kit code, trustworthy software, a working chain and gas. This is not an offline payment or proof that every asset can be swept.”

Show [kit sweep](https://sepolia.etherscan.io/tx/0xbc661bfd7f78d65385f7f7bcb4bcc6231205312e6a3e510401b34b8268e9110c). The record says “none (RPC only)”; do not describe a browser/service shutdown experiment it does not document. Module B was started and cancelled, not completed after three days.

### 4:15–5:00 — Why Swissquote; what must happen next

“Swissquote's proposed role is recovery assistance and bounded fee sponsorship, not an ordinary spending key. Whether that full service—including conditional recovery control and sponsored third-party transfers—is legally non-custodial needs counsel. Our bank association, KYC, face check and mailbox are MOCKs, not a production compliance integration.”

“Our assumed price is CHF 4.90 a month: CHF 58.80 gross per year, before gas, support, partner checks, compliance and audits. That tests a paid relationship rather than depending only on trading volume. We have not measured demand or profit.” See [business arithmetic](<business-case.md#L18-L38>) and [proposed terms](<terms-sheet.md>).

“Today the public contract story is checkable. Browser/service public proof and mined DeFi remain pending. The next step is a capped pilot only after independent security and legal review. Keep the relationship; keep the client's payment key.”

## Reversible fallback and stopping condition

If DeFi does not complete, remove only the optional preview beat. Spend its time on the contract refusal and cancellation; retain “DeFi: simulated, execution pending” on slide 5. Do not replace missing execution with a fabricated receipt or a mock presented as real. A later promotion needs matching service-sent receipts, preview bounds, revalidation and allowance-zero readback, reconciled in the [ledger](<claims.md>).

If the browser, network or a staged wallet fails, return to the already-inspected public record and stored receipt URLs; label it recorded. If all screens fail, deliver slides/story narration from this document. Do not start new services, use the live v2 chain, enter secrets on the projector or create a public demo to rescue the pitch. No video is assumed to exist or be approved.

Ready when the speaker can finish within the assumed five-minute slot, every shown behavior has its evidence label, the lead/L13 reconciles the final ledger, and no pending bonus or browser result is narrated as complete. Timed rehearsal and final evidence promotion belong to the run/integration owners, not this documentation lane.
