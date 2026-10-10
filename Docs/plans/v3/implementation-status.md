# Swissquote wallet: what is built and what is missing

**Snapshot of the working tree at about 19:20 CEST (17:24 UTC), taken before the v3 build started at about 18:00 UTC.** Line numbers refer to that snapshot; files edited since then may have moved (section 8 lists them). Revised at about 20:55 CEST after the status-honesty critique: the revision corrects claims and adds section 8, which was checked by reading at 18:25 UTC. Commit: <hash, added when the lead commits>.

Paths are relative to `swissquote-wallet/` unless they start with `Docs/`. This document describes the state only, not plans; the plan is [build-plan.md](build-plan.md).

## 1. Summary

**The full story works, but only on a private test chain on this computer, and its recovery half has run only in a script that bypasses both services.** On the local chain (a Hardhat test blockchain, chain id 31337), one automated script creates a wallet, makes payments, starts and cancels a recovery, recovers with the recovery card plus the partner's key, shows that the old key is refused, moves the funds with the emergency kit, and replaces the key (`scripts/story.ts`). The script signs with local test keys and sends directly to the chain; it does not use the partner or Swissquote services. In the browser, the user completed the first half on their own laptop with a real passkey: recovery card, login, MOCK identity check, wallet creation, wallet check in the recovery tool, funding with 20 MOCK USDC, and payments of 1 and 6 USDC (the 6 USDC payment needed a passkey confirmation).

The biggest missing pieces, in order of impact:

1. **No transaction on a public blockchain yet.** The brief's minimum is a signed transaction sent to a blockchain; a testnet is fine (Docs/desc.md:97). All contracts the wallet uses exist on Sepolia (the public Ethereum test network) and the code has a Sepolia mode, but it has never run there.
2. **Recovery through the services and the browser is built but unverified.** Recovery on a new device, cancelling a recovery, and key replacement exist in the wallet app, but no person or browser test has completed them. The services' recovery path (partner approval → Swissquote `/relay/recovery` → `/relay/finalize`) has not run against the contracts either, even locally; its tests use a fake chain. Module B (card + Swissquote, 3-day wait) has never completed a recovery, even locally. Bonus points count only if create → sign → recover works end to end (Docs/desc.md:111).
3. **The compliant-dApp bonus is not built.** Only unused server hooks exist, and the MOCK sanctions list is empty.
4. **No slides or video.**

This check also found three problems (details in section 6):

- The wallet app's default Sepolia node list included `rpc.sepolia.org`, which returned HTTP 404. This has since been changed in the working tree, but not tested (section 8).
- The demo-lab "helper-only recovery" button reaches the contract only if both "fooled" switches are on, and the partner forgets its switch when it restarts.
- The emergency-kit sweep moves USDC only, runs only from the command line, and needs a separate funded key to pay the network fee.

## 2. How to read the status

| Label | Meaning |
|---|---|
| Verified locally | An automated test or script passed on the local chain. Results come from the recorded run in `Docs/plans/swarm-final-verification.md:11-17`, except the full lifecycle story, which is recorded in `Docs/plans/swarm-acceptance.md:10`. I confirmed each test exists in code but did not re-run it, because this task forbids running test suites. Waiting periods were skipped by moving the chain clock forward. |
| Verified by the user | The user did it in the browser with a real passkey. Source: the lead's report; there is no log file. |
| Implemented, not verified | The code exists, but no test or person has run it end to end. |
| MOCK | A simulated stand-in, labelled MOCK in the app. The row says what a real version would need. |
| Missing | No code exists. |

Terms used below:

- **Recovery card**: 12 words the user writes down. Its key must approve every recovery.
- **Module A and module B**: two recovery contracts attached to each wallet. Module A needs the card plus the partner and waits 180 seconds in the demo. Module B needs the card plus Swissquote and waits 3 days.
- **Guardian**: a key that may approve a recovery.
- **Relayer**: Swissquote's service that submits transactions and pays network fees.
- **Step-up**: a passkey confirmation tied to one exact transaction.
- **Emergency kit**: an encrypted file holding the 24-word wallet seed, opened with a separate 32-character kit code.
- **GS026**: the error the wallet contract (Safe) returns when a key that is no longer the owner signs.
- **Fake chain** (a "chain double"): a stand-in object used in unit tests instead of a real blockchain.

## 3. Table A: requirements from the brief

| # | Requirement (Docs/desc.md line) | Status | Evidence | Limits |
|---|---|---|---|---|
| A1 | Create a wallet; say where keys live (:88, :92) | Verified by the user; verified locally | Browser click-through `tests/browser/clickflow.test.mjs:66`; `scripts/story.ts:32-36` (wallet passes all rule checks, holds 0 ETH, ownership proof valid) | Local chain only. The seed is created in the browser and stored encrypted on the device (`packages/protocol/src/crypto.ts:10`, `:52`). |
| A2 | Log in with passkeys (:88, :93) | Verified by the user; verified locally | `tests/browser/clickflow.test.mjs:56` (virtual passkey checked by the MOCK Swissquote service) | Passkey domain defaults to `localhost` (`services/swissquote/src/main.ts:11`). |
| A3 | Sign a transaction; high-value differs from small (:88, :93) | Verified by the user (1 and 6 USDC); verified locally | `services/swissquote/test/app.test.ts:29`; `tests/security/service-adversarial.test.ts:93-160` (cases SEC-S03 to SEC-S13: no passkey, forged, wrong transaction, expired, reused) | Limit is 5 USDC (`packages/protocol/src/constants.ts:37`). Only the app and relayer enforce it: whoever holds the owner key can pay the fee and skip the passkey (`README.md:64`). |
| A4 | Transaction sent to a blockchain (:97) | Missing on a public network; verified locally | Sepolia mode exists: `services/swissquote/src/main.ts:6`, `apps/wallet/src/chain.ts:4`. Sepolia sends are blocked unless `ALLOW_SEPOLIA_WRITES` is set (`services/swissquote/src/chain.ts:50` in the snapshot, `:76` now), tested by `services/swissquote/test/chain.test.ts:19` ("Sepolia adapter refuses broadcast without explicit authorization") | Pinned contracts exist on Sepolia (lead's read-only check). Default node problem: section 6, item 1. |
| A5 | Lose the keys, then recover access (:88, :94) | Contracts verified locally by script, without the services; service and browser path implemented, not verified | `scripts/story.ts:56-84` (request, wait, finalize, owner replaced, old key fails with GS026). The script signs the helper approvals with local test keys (`:57`, `:61-62`) and sends straight to the chain (`:23`). The service tests use a fake chain (`services/swissquote/test/app.test.ts:37`, `:42`; `tests/integration/partner.test.ts:60-84`) or test refusals only (`tests/integration/services.test.ts:160-165`). UI: `apps/wallet/src/App.tsx:295-348` | No real wait was observed; the chain clock was moved. |
| A6 | Who helps, how long, what stops an attacker (:94) | Verified locally for module A; for module B, start, cancel and helper refusal only | Card + partner: `scripts/story.ts:56-84` (finalized with the clock moved). Card + Swissquote: request started and cancelled only (`scripts/story.ts:61-67`; 3-day wait checked at `:64`); a full card + Swissquote recovery ran only on a 120-second test copy of the module (`contracts/test/t8-two-instances.test.js:118-136`). Owner cancels: `scripts/story.ts:66-67`. Helpers without the card refused by the contract: `scripts/story.ts:72`. Finalize before the wait refused: `scripts/story.ts:79-81`. Configuration: `packages/protocol/src/wallet.ts:37-45` | Demo waits only (180 s and 3 days, `packages/protocol/src/constants.ts:19`). |
| A7 | Funds back if Swissquote's services are gone (:94) | Verified locally, USDC only | Kit opens offline in the tool: `tests/browser/offline-kit.test.mjs`. Sweep: `scripts/kit-sweep.ts:9-27`, exercised in `scripts/story.ts:87-91` | Command line only. Moves the USDC balance only (`scripts/kit-sweep.ts:18`). Needs a funded fee-payer key (`FUNDER_PRIVATE_KEY`) and, on Sepolia, `ALLOW_SEPOLIA_SWEEP=yes`. Never run with the services actually stopped (`Docs/plans/swarm-acceptance.md:13`). |
| A8 | Bonus: refuse a thief with phone and email (:94) | Service checks verified locally; demo button partial | Swissquote refuses recovery after a recent password reset unless the user has a passkey, or waits 72 hours and passes a MOCK video ID (`services/swissquote/src/app.ts:172`; test `services/swissquote/test/app.test.ts:44`). Partner refuses a wrong MOCK face (`services/partner/src/service.ts:76`; test `services/partner/test/partner.test.ts:98`). Contract refuses helpers without the card (`scripts/story.ts:72`) | The demo-lab button stops at the partner unless both "fooled" switches are on (`apps/wallet/src/App.tsx:399-422`). A thief who also knows the device passphrase can spend before recovery. |
| A9 | Custody model and threat model (:90) | Document exists | `Docs/submission/threat-model.md`, `Docs/submission/custody-travel-rule.md` | Content not reviewed in this check. |
| A10 | Architecture diagram, real versus mocked (:91) | Document exists | `Docs/submission/architecture.md`, `Docs/submission/architecture.html` | Content not reviewed. |
| A11 | Mocks labelled; mocked helper runs separately (:84) | Verified in code and by a test | Partner is its own process with its own database (`services/partner/src/storage.ts:29`). Helper keys are created on the services, never in the app (`services/swissquote/src/app.ts:120`). The app's footer reads "Real signatures & chain checks. Bank account, KYC, face checks and mailbox: MOCK." (`apps/wallet/src/App.tsx`, line 395 when read at 18:05 UTC), tested by `apps/wallet/test/wallet.test.ts:51`; also `README.md:54-58` | Helper keys are stored unencrypted ("MOCK HSM"). A real version needs a hardware security module. |
| A12 | Gasless bonus: who pays, abuse prevention (:113) | Verified locally; refusal not shown in the app | Relayer pays; the wallet holds 0 ETH (`scripts/story.ts:33`, `:52`). Simulation before sending, gas cap 15,000,000, per-account and global daily budgets (`services/swissquote/src/app.ts:31-46`; tests `services/swissquote/test/app.test.ts:37`, `:42`; SEC-S10) | No screen shows a refused request. Not run on Sepolia. |
| A13 | Compliant-dApp bonus (:115) | Missing | Only unused hooks: `sanctions` and `approvedSpenders` options (`services/swissquote/src/types.ts:39`, `services/swissquote/src/policy.ts:27-38`) | `services/swissquote/src/main.ts:11` passes neither, so the sanctions list is empty and every token approval is refused. No approved-dApp list, no dApp screen, no plain-language preview of effects. |
| A14 | Travel Rule: verify who owns an external wallet (:123, :131) | MOCK, verified locally | Withdrawals go only to the client's verified wallet; otherwise "Blocked until Swissquote verifies who owns it (Travel Rule)" (`services/swissquote/src/app.ts:158-166`; test `services/swissquote/test/app.test.ts:43`; UI `apps/wallet/src/App.tsx:379`). Ownership proof by contract signature (EIP-1271), `scripts/story.ts:36` | MOCK bank account. Whether Swissquote is the sender when the client pays a third party is answered only in documents. |
| A15 | Business case; AI tools used (:95, :132, :134) | Documents exist | `Docs/submission/business-case.md`, `Docs/submission/ai-tools.md` | Content not reviewed. |
| A16 | Pitch and demo story (:146) | Demo script exists; slides and video missing | `Docs/submission/demo-script.md`. No `.pptx`, `.pdf`, `.key`, `.mp4`, `.mov` or `.webm` file anywhere under `Docs/` | |
| A17 | No homemade cryptography (:82) | Verified in code | Safe and Candide contracts, viem, @scure libraries, browser WebCrypto (`packages/protocol/src/crypto.ts`). No contracts of our own are deployed | A test token (`DemoUSDC`) exists on the local chain only (`scripts/devnet.ts:26`). |

## 4. Table B: the user's original wants

| # | Want | Status | What exists | Gap |
|---|---|---|---|---|
| B1 | Only the user can transact; Swissquote helps recover but never transacts | Met on chain; verified locally | The wallet has one owner, the device key, with threshold 1 (`packages/protocol/src/wallet.ts:37-45`), checked by `packages/protocol/src/verification.ts` (snapshot lines 44-46; they have since moved) and tested by `tests/protocol/wallet-verification.test.ts:54` (rejects hidden owners or modules). Swissquote is only a guardian on module B, which also needs the card | Swissquote publishes the app: a malicious update could steal the unlocked key (`README.md:64`). |
| B2 | Recover funds or disable a stolen phrase (e.g. 2-of-3 between institution, trusted party and user) | Met in changed form; verified locally | Card + (partner or Swissquote). The owner can cancel a recovery. Replacing the key disables a stolen seed (`scripts/story.ts:93-94`) | Not a symmetric 2-of-3: the card is always required. A thief with the unlocked key can spend or cancel recoveries first. Browser flows unverified. |
| B3 | Minimal data on Swissquote's side | Partly met | Swissquote never sees the seed, card words or kit code. It stores the login, passkeys, the MOCK identity flag, the wallet link, the setup code and the card's guardian address (`services/swissquote/src/app.ts:156`), and its own guardian key (`services/swissquote/src/store.ts:9`) | No data-minimisation review. The stored card address links the user to their card key. |
| B4 | Same address after recovery | Verified locally | Owner replaced on the same wallet (`scripts/story.ts:83`); old key refused (`scripts/story.ts:84`) | Browser unverified. |
| B5 | Emergency kit that moves all funds | Partly met | The kit opens offline in the tool; `scripts/kit-sweep.ts` moves the USDC balance | USDC only, command line only, needs a fee payer. |
| B6 | One approach for all chains, without relying on Ethereum standards (EIPs) | Missing | Ethereum-compatible chains only; built on Safe and Candide contracts and EIP-712 and EIP-1271 signatures. A Bitcoin Taproot version of the recovery rule passed 54 checks on a private Bitcoin test network (regtest) in a research harness (`Docs/research/bitcoin-taproot-candidate-b.md:5`, `:41`) | The Bitcoin harness is not in the wallet and does not reproduce the full recovery flow. |
| B7 | Nobody, even all other parties together, can recover without the user | Met against partner + Swissquote; verified locally | Both modules need the card and a threshold of 2; helpers alone are refused (`scripts/story.ts:72` on the local deployment; `contracts/test/t8-two-instances.test.js:86-101` on test copies of both modules) | "The user" means whoever holds the card: a stolen card plus one fooled helper succeeds after the wait unless the owner cancels. A full card + Swissquote recovery ran only on a 120-second test copy of module B. |

## 5. Table C: plan v2 features

Plan: `Docs/plans/swissquote-wallet-build-plan.md` (priorities in section 11, lines 372-391).

| Feature (plan section) | Priority | Status | Evidence or gap |
|---|---|---|---|
| One-transaction wallet creation on Sepolia (§6, §11) | P0 | Verified locally; Sepolia missing | `scripts/story.ts:32`; relayer deploy `services/swissquote/src/app.ts:122-155` |
| "Check my wallet" in the independent tool (§9.2) | P0 | Verified locally and by the user | `apps/recovery-tool/src/core.ts:24`; `tests/protocol/wallet-verification.test.ts:54` (rejects weak module B, missing card, hidden owners or modules, pending recovery), `:122` (two nodes must agree). Locally both node addresses reach the same node, and the tool says so (`apps/recovery-tool/src/main.ts:94`) |
| Small and large payments (§8, §9.4) | P0 | Verified locally and by the user | Table A, row A3 |
| Card + partner recovery, real wait, old key refused (§9.5) | P0 | Contracts verified locally by script, with the clock moved and without the services; service and browser path not verified | `scripts/story.ts:56-84`; Table A, row A5; UI `apps/wallet/src/App.tsx:295-348` |
| Cancel a pending recovery on both modules (§9.6) | P0 | Verified locally; UI not verified | `scripts/story.ts:66-67`; UI `apps/wallet/src/App.tsx:287-294`, `:375` |
| Contract refuses recovery without the card (§9.7) | P0 | Verified locally | `scripts/story.ts:72`; contract suite |
| Emergency kit and sweep (§9.8) | P0 | Verified locally (USDC) | Table A, row A7 |
| Two MOCK services as separate processes (§3) | P0 | Implemented and tested | `services/swissquote` (15 tests), `services/partner` (12 tests) |
| MOCK labels everywhere (§3) | P0 | Implemented and tested | MOCK footer in `apps/wallet/src/App.tsx` (line 395 when read at 18:05 UTC), test `apps/wallet/test/wallet.test.ts:51`; `README.md:54-58` |
| Ownership proof, MOCK account, Travel Rule wording (§9.3) | P1 | Verified locally and by the user (funding) | Table A, row A14 |
| Thief story with MOCK mailbox (§9.7) | P1 | Service checks verified; demo button partial | Table A, row A8 |
| "Replace my key" (§9.9) | P1 | Verified locally; UI not verified | `scripts/story.ts:93-95`; UI `apps/wallet/src/App.tsx:349-366`, `:387` |
| Recovery alerts every 15 seconds and "Not you? Cancel" (§9.6) | P1 | Implemented, not verified | `apps/wallet/src/App.tsx:84-104`, `:375` |
| Submission documents (§13) | P1 | Written | `Docs/submission/*.md`; content not reviewed here |
| Gasless refusal shown in the app (§9.10) | P2 | Missing in the app | Server rules are tested (row A12) |
| "Check before you sign" MOCK dApp panel with three requests (§9.10) | P2 | Missing | Only the payment review screen exists (`apps/wallet/src/App.tsx:384`) |
| Pay screen: CHF at a fixed MOCK rate, "Swissquote pays the fee", Etherscan link (§9.4) | — | Implemented | `apps/wallet/src/App.tsx:382` (link shown on Sepolia only), `:384` |
| MOCK sanctions screening, including decoded token recipients (§9.4) | — | Implemented; list empty | `services/swissquote/src/policy.ts:30`, `:37`; `services/swissquote/src/main.ts:11` |
| Production waits of 3 and 7 days (§2) | — | Not implemented | Demo values only (`packages/protocol/src/constants.ts:19`) |
| Auto-lock when the tab is hidden | — | Implemented | `apps/wallet/src/App.tsx:135-146` |
| Browser automation with Playwright (§11) | P3 | Verified locally | 11 tests plus an 8-stage click-through (section 7) |
| Stretch: replace the card, own wallet as owner, WalletConnect, seed import (§9.10) | P3 | Missing | |
| QR code for receiving (cut list, §11) | — | Missing | No QR code in `apps/wallet/src/App.tsx` |

## 6. Known defects and risks

**Could break the Sepolia demo**

1. **Dead default node (changed in the working tree since the snapshot; see section 8).** `apps/wallet/src/chain.ts:5` defaulted to `https://ethereum-sepolia-rpc.publicnode.com` and `https://rpc.sepolia.org`. Probe today, about 17:20 UTC: `rpc.sepolia.org` returned an HTTP 404 page; publicnode and `https://sepolia.drpc.org` both returned chain id `0xaa36a7` (11155111). `readPending` (`apps/wallet/src/chain.ts:38-50`) queries the first two nodes and throws if either fails. It runs in the 15-second status refresh (`apps/wallet/src/App.tsx:89`) and in recovery, cancel, finalize and key replacement (`App.tsx:249`, `:261`, `:290`, `:337`, `:353`). Inference, not run: these screens would fail on Sepolia unless `VITE_RPC_URLS` is set. At the snapshot, the recovery tool used the working pair (`packages/protocol/src/constants.ts:39`). Since 18:06 UTC, `apps/wallet/src/chain.ts:5-6` lists publicnode and `rpc.sepolia.ethpandaops.io` instead; the new test `apps/wallet/test/sepolia-receipt.test.ts:45-47` has not been run.
2. **Nothing has run on a public network.** The relayer, faucet-funded balances, fees and real waiting times are untested outside the local chain. The services' recovery path has not run against the contracts even locally (row A5).
3. **The sweep command hides errors.** `scripts/kit-sweep.ts:33` prints a generic failure message without the cause.

**Demo-lab and wording**

4. **Helper-only test stops before the contract.** `apps/wallet/src/App.tsx:399-422` asks Swissquote and the partner to sign first. With the switches off, the partner refuses ("MOCK face mismatch", `services/partner/src/service.ts:76`) and the button reports "Helper policy refused the attacker before the contract test". The partner keeps its switch in memory (`services/partner/src/service.ts:48`), lost on restart, and accepts it only if `PARTNER_DEMO_FOOLED=true` (`services/partner/src/runtime.ts:50`; set by `local-demo.mjs`, not by `pnpm dev:all`). Swissquote stores its switch in its database (`services/swissquote/src/app.ts:119`). The app's own switch is screen state, lost on reload. The three can disagree.
5. **Refusal label is the app's interpretation.** The button prints "refused by contract — recovery card missing" for any module error mentioning guardian, threshold or signature (`apps/wallet/src/App.tsx:418-421`). The contract's own reasons are known. Swissquote and partner signatures together are refused with "SM: Signer not a guardian" (expected by `contracts/test/t8-two-instances.test.js:88`, `:100`, on test copies of the module; module source `contracts/contracts/candide/modules/social_recovery/SocialRecoveryModule.sol:115`). A single helper's signature is refused with "SM: confirmed signatures less than threshold" (same file, `:185`). Which one the button would show depends on how it submits; not run. The claim is true in substance but is not the contract's message.
6. **Wrong chain in the ownership-proof text.** It always says "on Sepolia (chain 11155111)", even on the local chain (`packages/protocol/src/signing.ts:47-50`).
7. **Two transaction rule sets.** The app classifies with `packages/protocol/src/classifier.ts`; the relayer with `services/swissquote/src/policy.ts:23-47`. They already differ: the relayer refuses any token approval to an unlisted spender (`policy.ts:38`), while the app labels it Large.
8. **Config mismatch.** `.env.example` sets `SQ_PORT`, but the service reads `PORT` (`services/swissquote/src/main.ts:12`).

**Security limits by design** (stated in `README.md:64-66` and `Docs/plans/swarm-final-verification.md:35`)

9. A thief with the unlocked owner key (seed and passphrase) can drain the wallet or cancel the user's recovery before the wait ends.
10. The passkey rule is service policy, not on chain: the owner key can pay its own fee and skip the step-up.
11. Swissquote publishes the app; a malicious update could steal the unlocked key.
12. Losing both the card and the owner key (including the kit) cannot be recovered; helpers cannot help.
13. The partner service has no login: anyone who knows a user reference and the MOCK face string can request a signature (`services/partner/src/server.ts:38-43`). The contract still requires the card.
14. Guardian private keys are stored unencrypted in SQLite (`services/swissquote/src/store.ts:9`, `services/partner/src/storage.ts:29`), labelled MOCK HSM.

**Code quality and usability** (judged under "clean, sensible code", Docs/desc.md:142, and "a non-technical client could use it", Docs/desc.md:146)

15. `apps/wallet/src/App.tsx` has 424 lines but 54 KB. Line 379 is 4,508 characters; lines 376, 386, 387 and 398 each exceed 2,400.
16. The user handles seven look-alike secrets: login password, passkey, device passphrase, 12-word card, 24-word seed, kit code and setup code.
17. `services/partner/test-artifacts/` holds 7 leftover test database folders; I could not check whether Git ignores them (Git commands are not allowed in this task).
18. Browser tests depend on libraries under `/tmp` (`Docs/plans/swarm-final-verification.md:20`); assumption: a reboot removes them.
19. **The new emergency kit is not enforced.** After a recovery or a key replacement, the old kit's key is no longer the owner, so the old kit stops working. The browser flows already export a new kit (`apps/wallet/src/App.tsx:254`, `:261` in the working tree, read at 18:25 UTC), but nothing stops the user from finishing without saving it, and neither flow has run.

## 7. Evidence index

Results are the recorded runs in `Docs/plans/swarm-final-verification.md:11-17` (not re-run), except the full lifecycle story, which is recorded in `Docs/plans/swarm-acceptance.md:10`. Run commands from `swissquote-wallet/`.

| Suite | Recorded result | Command | Limits |
|---|---|---|---|
| Type check and build | exit 0 | `pnpm typecheck && pnpm build` | Compiles only |
| Protocol package | 13 pass | `pnpm --filter @sq/protocol test` | Unit tests |
| Wallet app | 11 pass | `pnpm --filter @sq/wallet test`; the local-chain test needs `RUN_LOCAL_WALLET_INTEGRATION=1` and `INTEGRATION_RPC_URL` | Mostly test doubles, not a browser |
| Recovery tool | 16 pass | `pnpm --filter @sq/recovery-tool test` | Node doubles |
| Swissquote service | 15 pass | `pnpm --filter @sq/swissquote test` | In-memory database, fake chain |
| Partner service | 12 pass | `pnpm --filter @sq/partner test` | |
| Scripts | 2 pass | `pnpm --filter @sq/scripts test` | Runtime guards (`scripts/test/runtime.test.ts:6`, `:11`), not the story |
| Browser | 11 pass | `pnpm --filter @sq/browser-verification test`; the 5 real-browser tests alone: `test:e2e` | Needs the `/tmp` browser libraries and environment variables (`swarm-final-verification.md:20`). Without `BROWSER_REQUIRED=1`, the browser tests skip themselves when no browser is found (reported by the feasibility critique) |
| Browser click-through | 8 stages pass | `node --test tests/browser/clickflow.test.mjs` (in no package script) | Create to large payment, virtual passkey; no recovery |
| Adversarial and integration | 148 pass | `INTEGRATION_RPC_URL=http://127.0.0.1:8545 pnpm test:adversarial` | Mix of real local contracts and labelled doubles; not an audit. Do not point it at the live demo chain: an integration test moves chain time forward (`tests/integration/local-chain.test.ts:157-158`, reported by the feasibility critique) |
| Contracts | 42 pass | `pnpm test:contracts` | Hardhat only |
| Contract-level story | pass (`swarm-final-verification.md:13`) | `npm --prefix contracts run story` | Clock moved |
| Full lifecycle story | 9 checks pass (`Docs/plans/swarm-acceptance.md:10`; not part of the final verification run) | `pnpm devnet && pnpm story` | Local chain only (`scripts/story.ts:20`), clock moved; signs helper approvals with test keys and bypasses both services |
| Everything | 0 failures, 0 skips | `pnpm test` with the variables above (`swarm-final-verification.md:17`) | |

Cross-check: counting test declarations in the files gives the same numbers for the wallet app, recovery tool, both services, scripts and browser suites. The protocol package declares 12 tests against 13 recorded; the adversarial suites (116 declarations, 148 results) and contracts (36 declarations, 42 results) create extra cases in loops.

## 8. Changes in the working tree since the snapshot

Checked by reading at 18:25 UTC; not tested, not rebuilt. Between 18:00 and 18:12 UTC, the v3 Sepolia work (lane L1 of the plan) edited these files in this checkout. This is the same folder that serves the live demo, whose wallet and tool pages reload saved files; the running services do not reload, so they still run the old code. Whether these edits are committed is unknown, because Git commands were not allowed in this check.

| File | Modified (UTC) | What changed |
|---|---|---|
| `packages/protocol/src/constants.ts` | 18:00 | `SEPOLIA_HISTORY_START = 11_886_000n` (`:43`); `LOG_CHUNK_BLOCKS = 10_000n` (`:45`); history nodes tenderly and ethpandaops (`:50`); the public node list is publicnode plus the history nodes (`:55`) |
| `packages/protocol/src/verification.ts` | 18:00 | History reads start at the Sepolia start block instead of block 0 (`:22`, `:77`) |
| `services/swissquote/src/chain.ts` | 18:04 | Sepolia fee limits: tip of at least 0.01 gwei (`:9`), fee cap 20 gwei (`:10`), refusal "network fee too high" (`:15`); viem's nonce manager on Sepolia (`:23-24`); viem itself resets it when a send fails (lead check, see the update below) |
| `apps/wallet/src/chain.ts` | 18:06 | Default nodes are publicnode and `rpc.sepolia.ethpandaops.io` (`:5-6`); `rpc.sepolia.org` removed (section 6, item 1) |
| `apps/wallet/src/App.tsx` | 18:06 | Edited; content not reviewed in this check |
| `apps/recovery-tool/index.html` | 18:06 | The Content Security Policy now allows tenderly and ethpandaops (`:2`); drpc and mainnet nodes are not allowed |
| `apps/recovery-tool/src/core.ts` | 18:11 | No longer reads history from block 0; uses the history nodes |

Lines cited from these files in sections 3-6 may have moved. Known moves: row A4's `services/swissquote/src/chain.ts:50` is now `:76`; row B1's `packages/protocol/src/verification.ts:44-46` now holds the code-hash check; `packages/protocol/src/constants.ts:39` is now a comment.

Still to do for these edits: run the tests, rebuild the single-file recovery tool, and check a real Sepolia wallet read-only.

**Lead update (L0, 19:05 UTC).** After this snapshot, the lead ran the checks and added files:

- Run at about 18:30 UTC, without the live chain: typecheck and build passed; protocol 26/26, partner 12/12, scripts 12/12, wallet 14 passed and 1 skipped, recovery tool 16/16, Swissquote 21/21, adversarial 140 passed and 1 skipped (141). With browser libraries: browser end-to-end 5/5. Not run: the two chain-integration suites, because they move the clock of the live demo chain on port 8545.
- The single-file recovery tool was rebuilt (`dist/index.html`, 387,432 bytes; its policy allows the tenderly and ethpandaops nodes).
- New files: `scripts/story-sepolia.ts` (the scripted Sepolia story; its `--dry-run` passed read-only checks of the 8 pinned code hashes, and a simulation of all 11 transactions succeeded, but nothing was sent); `scripts/sepolia-keys.mjs`, `sepolia-balances.mjs`, `sepolia-distribute.mjs`; `sepolia-demo.mjs` (Sepolia launcher, never started; it refuses `PARTNER_DEMO_FOOLED=true`).
- `packages/protocol/src/abis.ts:20` now marks `proxy` as indexed in `ProxyCreation`, as Safe 1.4.1 does; nothing decodes this event today.
- `apps/wallet/src/App.tsx` shows a yellow "Transaction pending — check Etherscan" banner when a receipt takes longer than the wait.
- viem 2.57.4 resets the nonce manager whenever `sendTransaction` fails (node_modules/.pnpm/viem@2.57.4_typescript@5.9.3/node_modules/viem/_esm/actions/wallet/sendTransaction.js:239-243), so a failed send does not block later relayer sends.
- Still unverified: every Sepolia write. The four service addresses held 0 ETH and 0 USDC at 18:50 UTC.

## Open questions

- Were the "fooled" switches on when the user tried the helper-only button? This cannot be checked without querying the running services, which this task forbids.
- The submission documents' content was not reviewed in this check.
- Do the edits listed in section 8 still pass the recorded suites? Answered by the lead update in section 8: the offline suites pass; the chain-integration suites were not run.
