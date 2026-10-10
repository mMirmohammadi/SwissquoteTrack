# Swissquote Wallet: build plan v2

Status: revised after four independent reviews; waiting for the user's go-ahead. Author: agent
46257332. Written Sat 10 Oct 2026, 17:05 CEST. Plan v1 is kept at
`AgentsLocal/46257332/plan-review/plan-v1.md`. The reviews are in `AgentsLocal/46257332/plan-review/`:
`01-security.md`, `02-feasibility.md`, `03-brief-fit-ux.md`, `04-technical.md`. The brief text is in
`AgentsLocal/46257332/plan-review/brief.txt`.

## 0. What changed from v1, and why

| Change | Reason (review) |
|---|---|
| The wallet and its recovery rules are created in **one transaction**, so the rules become part of the wallet's address | v1's guardian call had the wrong arguments and would have failed. One transaction is also cheaper, and an address check now verifies the rules (04) |
| Module B is **Candide's existing 3-day instance**, not our own 5-minute copy | Since Sepolia's 6 October upgrade, deploying our copy costs 21.4M gas, more than the per-transaction limit (02) |
| The recovery tool gets an **independent publisher**, is opened from a bookmark, and runs **"Check my wallet"** before the first deposit | Otherwise Swissquote's app could swap the card or the rules unnoticed, and "Swissquote + partner cannot replace your key" would rest on trusting Swissquote's code (01) |
| The **emergency kit is core** and ends the demo. The kit code stays separate from the card | The brief requires showing that funds come back if Swissquote is gone. v1 put the kit in the part to cut first (01, 02, 03) |
| **Small / large / admin** payment classes. Large and admin need a passkey; the relayer enforces it | Brief line 15. v1's 0.01 ETH check ran only in the app and missed zero-value admin calls (01) |
| The old device reads **both modules** from public nodes, and **Cancel clears every pending request** | Alerts and cancel must work without Swissquote, and the last request to finish wins (01, test T8e) |
| The **thief with phone and email** is scripted in the demo | Brief line 16 bonus (01, 03) |
| **Ownership proof, a MOCK Swissquote account transfer, and Travel Rule wording** | Legal is 15 points. Brief lines 4–5, 14, 46 (03) |
| **USDC from a wallet with 0 ETH** and a **"Check before you sign" screen**. WalletConnect becomes a stretch goal | These are the brief's two bonus topics. WalletConnect costs about 3 h and a Reown account (02, 03) |
| **Script first**, with go/no-go gates and interfaces frozen before work splits into lanes | v1 had no spare time and built recovery overnight (02) |
| **Key rotation** added | User request (m00460) |
| Headline claims reworded, and the app-publisher trust stated openly | v1 overclaimed (01) |
| Cut: our own module deployment, the bytecode comparison step, abstractionkit and Safe protocol-kit, signed guardian statements, the Swissquote watcher; seed import becomes a stretch goal | Not needed, or replaced by something above (02, 04, self-critique) |

## 1. Goal, promise and deadline

We build a web wallet for Swissquote clients on Ethereum's Sepolia test network.

**Promise, exact pitch wording:** "Day to day, only your key moves money. Replacing your key needs your
recovery card plus either the partner or Swissquote, and a waiting time your old device can cancel.
Swissquote and the partner together cannot replace it: the contract refuses them, and an independent
tool lets you check that your wallet is set up this way."

**Remaining trust, stated openly:** Swissquote publishes the wallet app. A malicious app version could
copy the key on the device. The product answer is a native app with reproducible builds, or the client's
own hardware wallet as owner (roadmap).

**Demo story:** create → fund from the Swissquote account → pay → lose the device → recover → the thief
and the colluding helpers are refused → Swissquote is gone, and the kit still reaches the funds.

**Deadline:** hacking ends Sunday 11 October, 10:00 CEST. All times below are CEST.

## 2. Fixed decisions

- **Chain:** Sepolia (chain id 11155111), live. For development: a local Hardhat chain with the real
  Sepolia contract code placed at the Sepolia addresses (`hardhat_setCode`; tested in review 02).
- **Wallet:** Safe v1.4.1 (SafeL2), one owner = the user's key, threshold 1, created through
  SafeProxyFactory `createProxyWithNonce`.
- **Recovery:** two Candide Social Recovery Module v0.0.1 instances already deployed on Sepolia:
  - **A** (3-minute wait): guardians {card R, partner P}, threshold 2;
  - **B** (3-day wait): guardians {card R, Swissquote SQ}, threshold 2.
  The demo completes recovery through A. B shows card + Swissquote as the slower path. Production
  waits: A 3 days, B 7 days (Candide has deployed both on Sepolia).
- **Creation:** one transaction (§6). Guardians and thresholds become part of the wallet address.
- **No contract or cryptography of our own.** Libraries: viem (chain access, ABI, EIP-712, signing),
  @scure/bip39 and @scure/bip32, WebCrypto (PBKDF2, AES-GCM), @simplewebauthn/server and
  @simplewebauthn/browser v14, React + Vite, `node:sqlite`. No abstractionkit (its default module
  address is the 3-day instance) and no Safe protocol-kit: viem plus small ABIs is enough (04).
- **Fees:** a Swissquote relayer key pays all gas. It submits only transactions the user's key signed,
  or guardian approvals. It cannot change them. It can delay or refuse them, and anyone can bypass a
  refusal by paying the gas themselves.
- **Login:** passkey, with a password fallback for login only. Large and admin actions need a passkey
  whose challenge is the Safe transaction hash; the relayer checks it (§8).
- **Demo money:** Circle's USDC on Sepolia. The wallet holds 0 ETH, so every payment is gasless.
- **Keys:**
  - owner key: a new 24-word seed (never imported in the core build), path `m/44'/60'/0'/0/0`,
    encrypted on the device with a passphrase of at least 12 characters (PBKDF2-SHA256, 600,000
    iterations → AES-GCM);
  - card R: 12 BIP-39 words made in the recovery tool, same path;
  - kit code: 32 base32 characters (160 bits) with a checksum.

## 3. The parts and what each one stores

| Part | Runs as | Stores | Never sees |
|---|---|---|---|
| Wallet app (Swissquote) | React + Vite, `http://localhost:5173` | Encrypted seed (IndexedDB) | Card words, partner and Swissquote guardian keys |
| Recovery tool (independent publisher, MOCK) | One static HTML page, `http://localhost:5174`; also works from a saved file | Nothing | Partner and Swissquote keys; the seed only when the user opens the kit |
| Swissquote service | Node, `:4001`, own data directory | Accounts, passkeys, MOCK KYC flag, MOCK mailbox, one SQ guardian key per user (MOCK HSM), relayer key, MOCK Swissquote-account key, verified wallets | Seed, card |
| Partner service (MOCK) | Node, `:4002`, separate process, own data directory | MOCK face template, userRef, one P guardian key per user (MOCK HSM) | Seed, card, Swissquote account data |
| Sepolia | public chain | Wallet, module state | Secrets |

Everything mocked says **MOCK** in the UI, the README and the diagram (brief line 9). In production the
recovery tool is open source, published by neither Swissquote nor the partner, and served from a
content-addressed location printed on the card.

## 4. Repository layout

```text
swissquote-wallet/
  apps/wallet/            React app (Swissquote)
  apps/recovery-tool/     static page: make card, check wallet, approve recovery, open kit
  services/swissquote/    Node service: auth, MOCK KYC, relayer, SQ guardian, MOCK account, MOCK mailbox
  services/partner/       Node service: MOCK face check, P guardian
  packages/protocol/      shared TypeScript: constants, ABIs, wallet template, signing, codes, checks, types
  scripts/                devnet setup, full story, kit sweep
  contracts/              own npm project, NOT in the pnpm workspace: copy of AgentsLocal/46257332/verify
  pnpm-workspace.yaml, package.json, .env.example
Docs/submission/          submission documents
```

Add `.pnpm-store/` and `swissquote-wallet/**/data/` to `.gitignore` (`.env` is already ignored).

## 5. Constants (in `packages/protocol`)

| Item | Value |
|---|---|
| SafeL2 v1.4.1 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` |
| SafeProxyFactory v1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| CompatibilityFallbackHandler v1.4.1 | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |
| MultiSend v1.4.1 (creation only) | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` |
| MultiSendCallOnly v1.4.1 (all later batches) | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| SafeModuleSetup v0.3.0 | `0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47` |
| Module A, 3-minute wait (180 s) | `0x949d01d424bE050D09C16025dd007CB59b3A8c66`, code hash `0x1a5e700fbb0533685dc9f9b28fc89bb496d480990e6c292f2abdd3e97485d245` |
| Module B, 3-day wait (259,200 s) | `0x38275826E1933303E508433dD5f289315Da2541c`, code hash `0xdbebd5942589cb48bc55fd0d804e2a825ae485fa4eb771ec030e0ec4c330ae03` |
| USDC (Circle, 6 decimals) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Safe guard storage slot (must read zero) | `0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8` |

- The module has no getter for its wait time, so the wait values live here.
- Lane A also pins the code hashes of the Safe contracts and the factory's `proxyCreationCode()`.
- Module EIP-712 domain: name "Social Recovery Module", version "0.0.1", chainId, verifyingContract =
  module. Type: `ExecuteRecovery(address wallet,address[] newOwners,uint256 newThreshold,uint256 nonce)`.
- Local chain: the devnet script places the same code at the same addresses, and deploys a test ERC-20
  in place of USDC.

## 6. The wallet template (one transaction)

```text
initializer = Safe.setup(
  owners = [O], threshold = 1,
  to = MultiSend,
  data = multiSend([
    delegatecall SafeModuleSetup.enableModules([A, B]),
    call A.addGuardianWithThreshold(R, 1),
    call A.addGuardianWithThreshold(P, 2),
    call B.addGuardianWithThreshold(R, 1),
    call B.addGuardianWithThreshold(SQ, 2) ]),
  fallbackHandler = CompatibilityFallbackHandler,
  paymentToken = 0, payment = 0, paymentReceiver = 0)

wallet = CREATE2(factory, salt = keccak256(keccak256(initializer) ‖ saltNonce),
                 initCode = proxyCreationCode ‖ uint256(SafeL2))
```

- Creation uses MultiSend, not MultiSendCallOnly, because `enableModules` needs a delegatecall.
- In v0.0.1, `addGuardianWithThreshold(guardian, threshold)` takes the wallet from `msg.sender`, and
  the threshold argument is the threshold after the add.
- Rules: O, R, P and SQ must all differ. A guardian cannot be the owner (GuardianStorage.sol:47).
- Reference implementation: the test "Extra: one-transaction creation with guardians inside setup" in
  `AgentsLocal/46257332/verify/test/plan-sepolia-copy.test.js`. Local gas was 590,261. Sepolia gas is
  several times higher, so gas is never hardcoded.

## 7. Message formats

- **Recovery approval:** EIP-712 `signTypedData` over `ExecuteRecovery(wallet, [newOwner], 1,
  module.nonce(wallet))`. Each signer first checks that its hash equals the module's on-chain
  `getRecoveryHash`. `personal_sign` is rejected ("SM: Invalid guardian signature"). Submission:
  `multiConfirmRecovery(wallet, [newOwner], 1, [{signer, signature}], true)` with the signatures
  sorted by `BigInt(signer)`, ascending. The module nonce is separate from the Safe nonce.
- **Safe transaction:** EIP-712 SafeTx, domain {chainId, verifyingContract = wallet}; safeTxGas,
  baseGas and gasPrice 0; gasToken and refundReceiver zero. The relayer runs `eth_call` first and then
  submits `execTransaction`.
- **Ownership proof:** the text "Swissquote client {clientId} controls wallet {address} on Sepolia
  (chain 11155111). This does not authorise any transfer. Nonce {nonce}." The owner key signs it as a
  Safe message (EIP-1271 through the fallback handler). Swissquote checks `isValidSignature(hash, sig)
  == 0x1626ba7e` through a public node.
- **Copy-paste codes between the app and the tool** (base64url JSON with `v` and `chainId`):
  - Setup code `{wallet, owner, partnerGuardian, sqGuardian, saltNonce}` → tool, "Check my wallet";
  - Request code `{wallet, module, newOwner, nonce}` → tool, "Approve recovery";
  - Approval code `{signer, signature}` → back to the app.
- **Kit file:** JSON `{v, chainId, wallet, owner, modules, path, kdf, salt, iv, ciphertext,
  instructions}`. The kit code decrypts it (PBKDF2 → AES-GCM).

## 8. Transaction classes

Shared code in `packages/protocol` classifies each Safe transaction. The app shows the class, and the
relayer enforces it. The first matching row applies. A MultiSendCallOnly batch is decoded: it is
Protective only if every inner call is `cancelRecovery()`; otherwise it takes the strictest class of
its inner calls.

| Class | What | Requirement |
|---|---|---|
| Protective | `cancelRecovery` on A and/or B in one batch | Always relayed, no step-up, outside any budget |
| Admin | Target is the wallet itself, A or B (owners, guardians, thresholds, modules, guard), or any delegatecall except to MultiSendCallOnly | Only from Settings, never from a dApp request; passkey bound to the Safe transaction hash. The relayer refuses delegatecalls to anything else |
| Large | Value or token amount above the limit; any approval above the limit or unlimited; Permit and other approval messages (app-enforced only, because messages are not relayed) | Passkey bound to the Safe transaction hash. No password fallback |
| Small | Everything else | No step-up |

Demo limit: 5 USDC, shown in CHF at a fixed MOCK rate (production example: CHF 1,000). This rule is a
condition of Swissquote paying the fee, not co-signing: Swissquote never signs, and a user who pays
their own gas can bypass it. A real on-chain spending limit stays on the roadmap.

## 9. Flows

### 9.1 Create

1. Register and log in to Swissquote (passkey; password fallback). Press "MOCK KYC: verified".
2. The app creates a 24-word seed (owner O), asks for a device passphrase (12+ characters), and stores
   the seed encrypted.
3. The app tells the user to open the recovery tool from the bookmark or the printed address. It shows
   the address as text, not as a link. The tool makes the card: 12 words shown once, a printable sheet
   with a separate tear-off stub for the kit code, and R's address with a Copy button.
4. The user pastes R's address into the app.
5. The app enrolls with the partner (`userRef`, MOCK face) and with Swissquote, and gets back P and SQ,
   fresh guardian addresses for this user.
6. The app builds the initializer (§6), picks a random `saltNonce`, computes the wallet address, and
   asks the relayer to deploy. The relayer deploys only an initializer that matches the template.
7. The app confirms the wallet through a public node and registers it with Swissquote (Setup code
   plus R's address, and the ownership proof, §7). R's address is not secret: guardian lists are
   public on-chain. Swissquote recomputes the address and checks the proof. The app shows "Verified
   as yours". The tool never takes R's address from the app; it derives R from the card words.
8. The app creates the kit: it shows the kit code once (the user writes it on the stub) and offers the
   kit file for download, with "save it to your own cloud or email".
9. **"Check my wallet"** in the tool (§9.2). The app says: "Do not deposit until the recovery tool
   shows green."

### 9.2 Check my wallet (recovery tool)

1. The user pastes the Setup code and types the card words. This also proves the card was copied
   correctly.
2. The tool derives R, rebuilds the initializer from its own copy of the template, and recomputes the
   address. A match proves that R is required on both modules, with threshold 2, and that no hidden
   owner or module was planted at creation.
3. Through two public nodes pinned in the tool, it checks: code exists at the wallet; module code
   hashes match; no recovery is pending; Safe nonce 0.
4. If the nonce is above 0 (a later re-check), the tool reads the current guardians, thresholds,
   owners, modules and guard slot instead. It also checks that no executed transaction used a
   delegatecall except to MultiSendCallOnly (SafeL2 logs every transaction).
5. Result: green, or red with the reason. Demo: a script makes a tampered wallet (B threshold 1), and
   the tool turns red.

### 9.3 Identity link and funding (Travel Rule)

1. The Swissquote account card in the app (MOCK balance, held by the MOCK account key) has "Move to my
   wallet". Swissquote sends real Sepolia USDC without manual review, because the wallet is a verified
   wallet of the same client (ownership proof).
2. Sending from the Swissquote account to any other address shows "Blocked until Swissquote verifies
   who owns it (Travel Rule)".
3. Payments from the wallet show: "You are the sender. Swissquote cannot move or stop this payment; it
   only pays the network fee." Our reading is that Swissquote is not the sending institution for
   wallet-to-third-party payments. This needs counsel, and we say so.

### 9.4 Pay

1. Enter recipient and amount (USDC; CHF shown).
2. "Check before you sign" (§9.10 adds the dApp checks): plain-language summary, recipient checked
   against the MOCK sanctions list (including decoded token recipients), class from §8, "Fee paid by
   Swissquote · 0 ETH in your wallet".
3. Large: passkey prompt bound to the Safe transaction hash.
4. The app signs with the owner key, and the relayer checks and submits. The app shows the Etherscan
   link.

### 9.5 Recovery on a new device

1. The new device (second browser profile) logs in with the password, or with a synced passkey.
2. The app creates a new seed (new owner N) and a passphrase, and shows a 4-word fingerprint of N. The
   fingerprint only catches a tampered link, not a malicious app.
3. The app shows a Request code for module A. The user opens the tool from the bookmark and pastes it.
   The tool reads the chain itself: is the card's key a guardian, is the nonce current. It shows
   "Replace the owner of wallet 0x… with 0x… (fingerprint …)". The user types the card words and
   confirms, and the tool shows an Approval code. The user pastes it into the app.
4. The partner approves after the MOCK face check, signing the same request.
5. The relayer sorts both signatures, runs `eth_call`, and submits `multiConfirmRecovery`. The
   3-minute wait starts, and the app shows a countdown.
6. After the wait, `finalizeRecovery(wallet)` (relayer; anyone may submit). If a request is pending on
   B, the new owner cancels it immediately, because the last request to finish wins (T8e).
7. The app creates a new kit; the old kit no longer works.
8. Shown: a transaction signed with the old key is refused (`GS026`, shown as "Blocked: this old
   device no longer controls the wallet").

If the partner is unavailable, use module B: card + Swissquote, with a 3-day wait in the demo.

### 9.6 Alert and cancel (old device)

- On every open and every 15 s, the app reads `getRecoveryRequest` on A and B from two public nodes. A
  pending request shows: "Your wallet is moving to a new device. Not you? Cancel."
- Cancel signs one MultiSendCallOnly batch with `cancelRecovery()` on each module that has a pending
  request (only those: a module without one reverts with "SM: no ongoing recovery").
- The relayer always relays cancel. If it refuses, the user can submit it themselves with any funded
  account (kit path).
- Only `cancelRecovery` clears a request. Disabling the module or bumping the nonce does not (T10).

### 9.7 Thief with the phone and the email (demo)

The old-device profile plays the stolen phone; a MOCK mailbox page plays the email.

1. The thief resets the Swissquote password through the MOCK mailbox and logs in on the phone. The seed
   stays locked by the device passphrase.
2. He tries to recover the wallet to his own key. Swissquote refuses: "Password reset 2 minutes ago.
   Recovery approval needs a passkey login, or a 72-hour hold plus video ID (MOCK)." The partner
   refuses: face mismatch (MOCK).
3. DEMO switch "Suppose Swissquote and the partner were fooled": both sign, and the app runs
   `multiConfirmRecovery` as `eth_call` on A and B. The contract refuses ("SM: confirmed signatures
   less than threshold" or "SM: Signer not a guardian"), shown as "Refused by the contract: recovery
   card missing". This beat also covers partner + Swissquote collusion.
4. Known limit, stated: a thief who also knows the device passphrase can spend before the client
   recovers.

### 9.8 Swissquote gone (kit)

1. Stop the app and both services.
2. Open the recovery tool from a saved file. "Open kit" takes the kit file and the kit code and shows
   the seed words and the owner address.
3. `scripts/kit-sweep.ts` uses only the kit and a public node: the owner key signs a Safe transaction
   that moves the USDC to a new address, and any account with a little ETH submits it. In practice the
   client imports the seed into any standard wallet and uses Safe{Wallet} on Sepolia.
4. The kit is also the cancel key if the phone is lost.

### 9.9 Rotate key (user request)

Settings → "Replace my key" (admin class, passkey):

1. Cancel any pending request.
2. Create a new seed N on this device.
3. Old key O signs `swapOwner(0x…01, O, N)`, and the relayer submits it.
4. Store N, delete O, and create a new kit; the old kit no longer works.
5. Check: a transaction signed with O is refused (`GS026`).

Limit: if a thief already has the seed, this is a race.

### 9.10 Bonus and stretch

- **Gasless (bonus):** comes from §9.4 with a 0-ETH wallet. Show one request the relayer refuses (over
  budget, or a forbidden delegatecall). Slide: who pays, the abuse limits, and that Safe can repay the
  relayer in USDC (gasToken refund) in production.
- **Check before you sign (bonus):** three sample dApp requests in a MOCK dApp panel:
  - a payment to an approved dApp;
  - an unlimited USDC approval to an unlisted spender (blocked);
  - a transfer to a sanctioned address (blocked).
  Each request shows decoded effects, `eth_call` simulation, list checks and the class.
- **Stretch, only after G4:**
  - replace card (tool makes R2; batch per module: `addGuardianWithThreshold(R2, 2)`, then
    `revokeGuardianWithThreshold(prev, R, 2)`; cancel pending requests first; re-check in the tool);
  - "use my own wallet as owner" (MetaMask signs; 1.5–2 h);
  - WalletConnect (Reown WalletKit into the same check screen; allowlist matched against Reown
    Verify's verified origin; needs a Reown project ID);
  - seed import, with the warning that funds at the seed's own address are not protected.

## 10. Service APIs

**Swissquote service (`:4001`)**

| Group | Endpoints |
|---|---|
| Auth | Passkey register/login options + verify; password register/login; `POST /auth/password/reset-request` (link to MOCK mailbox); `POST /auth/password/reset` |
| MOCK | `POST /kyc/mock-verify`; `GET /mock/mailbox`; `POST /demo/fooled` (switch) |
| Guardian | `POST /guardian/enroll` → this user's SQ guardian address |
| Wallets | `POST /wallets` (Setup code + ownership proof; recompute address; verify EIP-1271); `GET /wallets/:address` |
| Account (MOCK) | `GET /account`; `POST /account/withdraw {to, amount}` (only to a verified wallet of the same client) |
| Relay | `POST /relay/deploy`, `/relay/safe-tx`, `/relay/recovery`, `/relay/finalize` |
| Recovery | `POST /recovery/approve` → SQ approval for module B, subject to the policy in §9.7 |

Relayer rules:

- Deploy only initializers that match the template.
- Run `eth_call` first and refuse anything that would revert.
- Cap gas per transaction.
- Budget per KYC'd account in transactions per day, plus a global daily cap; one wallet per account.
- The session must own the wallet, except for cancel and finalize.
- Enforce §8.
- On retry, accept only the same Safe nonce.

**Partner service (`:4002`)**

| Endpoint | Behaviour |
|---|---|
| `POST /enroll {userRef, mockFace}` | Store the MOCK template, create this user's P key, return P's address |
| `POST /recovery/approve {userRef, wallet, newOwner, mockFace}` | MOCK face match, then an EIP-712 approval for module A (check hash on chain first). Obeys the demo "fooled" switch |

## 11. Build order, gates and lanes

### Priorities

- **P0, never cut:**
  - creation on Sepolia (one transaction, address check) with the card made in the tool;
  - "Check my wallet";
  - owner-signed payments through the relayer, with the small/large rule;
  - card + partner recovery with the real wait, and the old key refused;
  - cancel (by script if the UI is late);
  - the contract refusing anyone without the card;
  - kit create and open, and the kit sweep script;
  - two separate MOCK services with their own storage;
  - MOCK labels.
- **P1:**
  - ownership proof, the MOCK Swissquote account and the Travel Rule wording;
  - the full thief story with the mailbox;
  - key rotation;
  - alerts with the both-module cancel in the UI;
  - submission documents.
- **P2 (bonus):** gasless refusal demo, "Check before you sign" with the MOCK dApp panel.
- **P3 (stretch):** §9.10 stretch items, Playwright UI tests.

### Gates (assuming work starts 17:45; if later, shift G0–G2 by the delay, keep G3 onward)

| Gate | Must be true | If not |
|---|---|---|
| G0 18:45 | Workspace builds. `contracts/` tests pass in the new folder. Interfaces frozen (below). The devnet script creates a wallet from the template on the local chain. Relayer and MOCK-account addresses printed for the faucets | Do not split into lanes until fixed |
| G1 21:00 | `scripts/story.ts` runs the whole story on the local chain: create, ownership proof, fund, small and large payments, recover via A after the wait, `GS026`, cancel on both modules, refusal without the card, kit encrypt/decrypt and sweep | Cut passkeys and QR; move people onto the scripts |
| G2 22:30 | The same story passes once on Sepolia (real 3-minute wait). The user has tried a passkey on the demo laptop | Lane A works only on Sepolia issues; passkey → Chrome's virtual authenticator, or password-only plus a slide |
| G3 01:00 | Through the screens, on Sepolia: create, card, check, fund, pay | Stop all P2 work |
| G4 04:00 | Whole story through the screens once on Sepolia, kit included | Stop features; show missing parts by script |
| 06:00 | Feature freeze; record the backup video | — |
| 08:00 / 09:00 | Rehearsal 1 with the submission draft complete / rehearsal 2 | — |
| 09:30 | Code freeze; submit by 09:45 | — |

P2 work runs only after G4 passes, between 04:00 and 06:00. The docs lane runs from the start. A
suggestion from review 02: the presenter sleeps from about 04:00 to 07:00; judging is 10:30–13:00.

### Lanes (one owner per folder)

| Lane | Writes only | By G0 | Then |
|---|---|---|---|
| Lead (agent 46257332) | `Docs/plans/`, root config (`package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`), integration | Freeze review | Gates, integration, user contact |
| A Protocol and scripts | `packages/protocol/`, `scripts/`, `contracts/` | Constants, ABIs, template, codes, types, devnet script | `story.ts` local (G1) and Sepolia (G2), `kit-sweep.ts`, tamper script |
| B Services | `services/swissquote/`, `services/partner/` | Endpoints returning stub data with the frozen types | Relayer rules, approvals, policy, MOCK account and mailbox |
| C Wallet app | `apps/wallet/` | Screen skeleton against the stub endpoints | Create, pay, recovery, alerts, rotate, demo switches |
| D Recovery tool | `apps/recovery-tool/` | Page skeleton | Card, check, approve, open kit (works from a file) |
| E Submission | `Docs/submission/` | Outline | Threat model (who can steal, who can lock out), diagram (real vs MOCK), custody and Travel Rule note, business case, bonus write-ups, AI-tools list, README |

**Frozen at G0** (lane A owns the first two, lane B the third, the lead the fourth):

1. the `packages/protocol` exports;
2. the copy-paste code formats and the kit file format;
3. the service request/response types (`packages/protocol/src/api.ts`);
4. ports and `.env` names: `CHAIN`, `RPC_URLS`, `RELAYER_PRIVATE_KEY`, `SQ_ACCOUNT_PRIVATE_KEY`,
   `FUNDER_PRIVATE_KEY` (kit sweep).

### Rules for every lane

- Read `Docs/agents/HUMAN_FACING_COMMUNICATION.md` in full and follow it.
- Never hardcode gas: local gas is 5–7× lower than Sepolia gas. Always estimate on the target chain.
- Use two public RPCs with viem's fallback transport.
- Secrets live only in `.env`. Print addresses, never keys. Keep keys out of prompts and logs.
- Write only inside your own lane's folder. Shared files belong to the lead.
- Sepolia transactions only from keys in `.env`, and only for this demo.
- No commit or push without the user's permission.
- npm needs `--cache /tmp/npmcache` on this machine. Keep the pnpm store out of the repository.
- Agents have no browser, so a human click-tests at G3 and G4. Optional: Playwright with Chrome's
  virtual authenticator, if the browser download is allowed.

### Cut order when behind

1. Stretch items.
2. P2 bonus screens.
3. QR receive and polish.
4. Passkey → password plus a slide.
5. Rotation UI → script.
6. Cancel UI → script.
7. "Open kit" screen → script.

Never cut P0.

## 12. Demo script (5 minutes; to be finalised at rehearsal)

Prepared before going on stage: the passkey and MOCK KYC done, the card printed, both services and the
relayer funded. A backup wallet with a recovery started 3 minutes before. A backup recording.

1. 0:00–0:20 [slide] Clients who want their own keys leave Swissquote today. Here only their key moves
   money, and Swissquote and the partner together cannot take it.
2. 0:20–1:00 Create: passkey → card from the independent tool → "Wallet ready · verified as yours ·
   you paid 0 ETH" → tool check green.
3. 1:00–1:20 Fund: "Move 15 USDC to my wallet" from the Swissquote account card. It is approved
   automatically: same verified client (Travel Rule).
4. 1:20–1:50 Pay 2 USDC (small, no prompt) and 8 USDC (passkey). A sanctioned address is blocked.
   "Fee paid by Swissquote · 0 ETH in your wallet."
5. 1:50–2:30 Lose: the phone goes into a drawer. On the new laptop: "I lost my device" → card in the
   tool → partner face check (MOCK) → the 3-minute countdown starts. The old phone shows "Not you?
   Cancel."
6. 2:30–3:10 Thief with phone and email: password reset via the mailbox → Swissquote refuses → the
   partner refuses → "suppose both were fooled" → the contract refuses: recovery card missing.
7. 3:10–3:40 [slide] Who can do what: one table, plus who could lock the client out.
8. 3:40–4:10 Finalise on the backup wallet whose wait has passed (or the live one if time allows):
   same address, new device in control, and the old phone's payment is "Blocked".
9. 4:10–4:50 Swissquote gone: stop the services → open the kit page from a file → kit code → the key
   appears → the sweep script moves the funds through a public node.
10. 4:50–5:00 Close: business line and the multi-chain roadmap (Bitcoin design tested on regtest).

## 13. Submission documents (lane E)

| Document | Notes |
|---|---|
| README | How to run; what is real and what is MOCK |
| Custody and threat model | Rows for who can steal, who can lock the client out, Swissquote alone, Swissquote + partner, and the app-publisher trust |
| Architecture diagram | Real versus MOCK parts |
| Custody and Travel Rule note | Links `Docs/research/stolen-wallet-seed-swiss-legal-considerations.md` and `Docs/research/swiss-custody-wallet-verification.md` |
| Business case | Draft in `AgentsLocal/46257332/plan-review/03-brief-fit-ux.md`; every figure re-checked against its source before use |
| Bonus write-ups | Gasless; compliant dApp interaction |
| Multi-chain slide | EVM live; Bitcoin design tested on regtest (`Docs/research/bitcoin-taproot-candidate-b.md`); Solana plan |
| AI tools used | — |
| Claims we do not make | List below |

**Claims we do not make:**

- "Mathematically impossible for Swissquote to cheat."
- "Formally verified."
- "HSMs make it trustless."
- "Your face is your key."
- "Signatures prove the client did it."
- "Swissquote is not a custodian" as a technical fact. It is a legal question.

## 14. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| No Sepolia ETH | Nothing deploys on Sepolia | Ask at G0. One claim of about 0.05 ETH is enough at today's 0.001 gwei. The whole story still runs on the local chain with the real contract code |
| Sepolia gas price rises | Relayer runs dry | Budget in transactions per day; check the balance at each gate; a second claim |
| Public RPC limits | Flaky demo | Two RPCs with fallback; poll no faster than every 15 s |
| No USDC from the faucet | No token demo | Circle gives 20 USDC per address every 2 hours; fall back to ETH amounts |
| Passkey fails on the demo laptop | No step-up | Chrome's virtual authenticator; password for login only |
| 3-minute wait on stage | Dead air | Thief and slide beats during the wait; pre-started backup wallet |
| Agents cannot click-test | UI bugs found late | Human tests at G3 and G4; optional Playwright |
| Integration slips | Incomplete demo | Gates, cut order, and the scripts as a fallback demo |
| Malicious app version | Could copy the key | Stated openly; tool check; roadmap: native app or own hardware wallet |

## 15. What we need from the user

1. Approval of this plan, and the staffing: agents in the lanes above (Agent Teams, one teammate per
   lane, the lead integrating), or name who builds which lane.
2. Permission for agents to send Sepolia test transactions from keys in `.env`, and to commit locally
   at each gate. Pushing waits for the user's explicit go.
3. At G0: one Sepolia ETH faucet claim (about 0.05 ETH) to the printed relayer address, and 20 USDC from
   Circle's faucet (https://faucet.circle.com/) to the printed MOCK-account address.
4. The demo laptop's operating system and browser, and one passkey test on it by G2.
5. Defaults we will use unless the user objects:
   - the kit code stays separate from the card (one extra paper item, no instant takeover);
   - the app-publisher trust is stated openly;
   - module B is the 3-day instance;
   - WalletConnect and seed import are stretch goals.
