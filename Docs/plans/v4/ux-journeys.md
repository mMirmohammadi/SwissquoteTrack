# V4 UX journeys — plain-language wallet for Swissquote clients

**Goal:** a Swissquote client who knows only "chains exist" and "a wallet holds crypto" can set up, pay, recover and leave without ever meeting a technical term on a main screen. Every safety truth stays, said once, at the moment it matters. Source of current behavior: [feature-walkthrough.md](feature-walkthrough.md).

## 1. What the user must understand (5 concepts)

1. **Your phone pays.** This device holds the key that approves payments. Nobody else, including Swissquote, can pay from your wallet.
2. **Your Recovery Card replaces a lost phone.** 12 words on paper, made in the separate Recovery Desk. With one trusted helper it lets you move the wallet to a new phone.
3. **Recovery has a waiting period you can stop.** Replacing a phone takes 3 minutes (partner, demo) or 3 days (Swissquote). If it wasn't you, your current phone can stop it.
4. **Your Emergency Kit lets you leave without Swissquote.** An encrypted file plus a separate kit code. Together they can spend your money — store them apart.
5. **Swissquote helps but can't take.** Swissquote can help with recovery and pays network fees, but can never move your money alone.

### Stable vocabulary (use only these words, everywhere)

| Say | Means (internal) | Never say on main screens |
|---|---|---|
| wallet | Safe smart account | Safe, smart account, contract |
| your phone / this device | owner key | owner, signer, EOA, private key |
| Recovery Card | guardian key from 12 words | guardian, seed, mnemonic |
| trusted helper (partner or Swissquote) | recovery module co-approver | guardian, module, relayer |
| waiting period | recovery delay / timelock | timelock, delay, nonce, block |
| stop recovery | owner-signed cancel | cancel tx, revoke |
| Emergency Kit + kit code | encrypted owner-seed export | keystore, JSON, seed export |
| Recovery Desk | apps/recovery-tool | independent tool, offline signer |
| device passphrase | local key encryption password | unlock code, keystore password |
| card address | guardian public address | 0x…, guardian address |
| network fee (paid by Swissquote) | gas, sponsored by relayer | gas, relayer, paymaster |
| wallet check | setup-code + card + rules verification | rules check, module config |

**Move to "Details" (collapsed per screen):** full 0x addresses, transaction hash, block number, nonce, module/guardian names, RPC/node checks, gas/ETH balance, `GS026`, Safe/Etherscan links, setup code internals, chain ID. Show addresses on main screens as `0x12…ab34` with a copy button; full grouped address only where the user must compare it (recovery approval).

## 2. Journeys (one primary action per screen)

Format: **Headline** — body. *[Primary button]*

### (a) First-time setup

**Implemented simplification:** after login, one setup form replaces the numbered onboarding wizard. Identity confirmation, Recovery Card preparation/address, and device passphrase are visible together; there are no extra Continue or Next buttons. The single final action is **Create my wallet**. This reduces navigation, not the security requirements.

- **Confirm it’s you:** explicit MOCK identity confirmation remains required.
- **Make your Recovery Card:** open the separate Recovery Desk, write the words on paper, and paste only its public address into the wallet. Card words never belong in the wallet.
- **Protect this device:** choose a separate device passphrase before creating the wallet. Login credentials are not reused silently.

Before a wallet exists, show neither the protection checklist nor empty recent activity. After creation, lead with balance and funding; retain the independent wallet check before funding and the Emergency Kit export. Passkey approval remains required for higher-value sponsored payments. The checklist records acknowledgements, not automated security attestations.

**Verification:** the local browser clickflow passed registration, wallet deployment/ownership, independent card checks, kit download/offline opening, funding, and small/large payments with virtual WebAuthn. This is local MOCK-service evidence, not a new Sepolia or hardware-passkey run. The full gate has not passed again after the redesign; its earlier recovery-wait failure remains unresolved.

### (b) Add money from Swissquote

1. **Add money** — Move USDC from your Swissquote account (MOCK) to your wallet. Amount field; shows "Available: 20 USDC". *[Move to wallet]*
2. **Money on its way** → **Added 15 USDC** — It's now in your wallet; you can send it anytime. *[Done]*

### (c) Send money

1. **How much?** — Amount + "≈ CHF" + balance. *[Next]*
2. **Who to?** — Paste an address, pick a saved contact, or "My Swissquote account". *[Review]*
3. **Check before you send** — Rabby-style preview: "You send 1 USDC · They receive 1 USDC · Fee paid by Swissquote · Your balance 14 → 13 USDC". For a new recipient: **First time sending here** — type the last 4 characters to confirm you copied it right. Details: full address, hash, fee note. *[Send]*
4. **Confirm** — Over 5 USDC: passkey prompt ("Confirm with passkey"); otherwise device passphrase if locked. *[Confirm]*
5. **Sent** — 1 USDC sent to `0x00f3…9E42`. *[Done]*

### (d) "I lost my phone" (new device)

1. **Lost your phone?** — Move your wallet to this device with your Recovery Card and a trusted helper. *[Start]*
2. **Choose your helper** — Partner (3 minutes, demo) or Swissquote video check (3 days). *[Continue]*
3. **Protect this new device** — Choose a new device passphrase. *[Prepare this device]*
4. **Approve with your card** — Copy this request into the Recovery Desk and enter your card words there, not here. *[Copy request]*
5. **Compare the new address** — It must match the Desk exactly, group by group (full address shown here only). *[Paste approval code]*
6. **Helper check** — Partner face check (MOCK) / Swissquote video ID (MOCK). *[Ask helper]*
7. **Waiting period: 2:47 left** — Your old phone, if someone has it, can stop this. Meanwhile, save a new Emergency Kit. *[Save new kit]*
8. **Finish** (enabled at 0:00) — *[Move wallet to this device]*
9. **Done — same wallet, new phone** — Your address didn't change. Old Emergency Kits no longer work; keep the new one. *[Go to wallet]*

### (e) "Someone is recovering your wallet — was it you?"

1. Full-width red banner on every screen: **Someone is moving your wallet to a new phone** — It completes in 2 days 23 h unless you stop it. *[Stop it — this wasn't me]* · secondary: *It was me*
2. **Stop recovery?** — Your phone will cancel it; your money stays where it is. *[Stop recovery]*
3. **Recovery stopped** — Consider making a new Recovery Card if you think it was copied. *[Done]*

### (f) Swissquote is gone: open your Emergency Kit

1. (Recovery Desk) **Open your Emergency Kit** — Works without Swissquote; it runs on your computer. *[Choose kit file]*
2. **Enter your kit code** — *[Open kit]*
3. **Your kit is open** — Keep this screen private: these words control your wallet. Shows "Still current: yes/no". *[Check it's still current]*
4. **Next step** — Use these words in any compatible wallet app to move your money; you'll need a little ETH for fees. *[Clear everything]*

### (g) Everyday home

1. **Your wallet** — Balance in USDC with ≈ CHF; "Protected: Recovery Card + helper". Primary *[Send]*, secondary *[Add money]*. Recent activity below.

## 3. Home screen spec

Order, top to bottom:
1. Alerts only if any (pending recovery banner, device locked bar).
2. Balance (USDC, ≈ CHF), Send / Add money.
3. **Finish setting up · N of 4** (hidden at 4 of 4): Recovery Card linked ✓ (done at creation) · Save Emergency Kit · Check wallet in Desk · Add passkey. Each row = one tap to its screen.
4. Recent activity (plain: "Sent 1 USDC to 0x00f3…", "Added 15 USDC").
5. Protection summary, one line: "Only your phone can pay. Lost it? Recovery Card + helper, after a waiting period."
6. **Details / Proof** (collapsed): wallet & owner addresses, setup code, ETH balance, helper rules, pending-recovery read from two nodes, registration status, Safe link, "What Swissquote stores about you".

## 4. Navigation

Everyday (max 4): **Home · Send · Activity · Settings** (Settings: passkey, Emergency Kit, replace device key, sign out; "Lost phone? Recover" sits on the login screen and in Settings).

Separate **Proof & demo** area (footer link or toggle, labelled for judges): Demo lab · DeFi · Trust check · Protection details · Audit log.

## 5. Borrowed patterns

| Pattern | Source | Where it applies |
|---|---|---|
| Plain-language preview with balance change ("You send / receive / balance after") | Rabby transaction simulation | Send step 3; bank return; DeFi |
| Risk flags inline, not modals ("First time sending to this address") | Rabby security engine | Send step 3 new-recipient check |
| Setup stepper with numbered steps and review | Safe{Wallet} create-account flow | Setup (a) 1–6 and Finish-setup checklist |
| Queue of pending actions with countdown and who can act | Safe{Wallet} transaction queue | Recovery waiting period (d7) and alert (e) |
| Human-readable decode with raw data in an expandable panel | Safe{Wallet} tx details / Rabby | Every "Details" disclosure |

Safety truths, each said once: never type card words into the wallet (a3, d4); kit + code can spend (a7 kit item); the old phone can stop recovery (d7, e1).
