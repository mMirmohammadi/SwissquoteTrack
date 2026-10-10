# Swissquote wallet — v3 build plan

**Status: plan, revision 2, awaiting your go-ahead.** Revised Saturday 10 Oct 2026 at about 20:55 CEST, after five critiques (security, feasibility, judge fit, legal and business, status honesty). Every finding and what we did with it is in [critique-log.md](critique-log.md). Nothing in this plan is built yet, except a few Sepolia plumbing edits that are untested (listed in [implementation-status.md §8](implementation-status.md#8-changes-in-the-working-tree-since-the-snapshot)). We submit by 09:30 CEST at the latest; the deadline is Sunday 11 Oct, 10:00 CEST.

**What you need to do now:** request the faucet funds (D0), then answer D1–D5 in [§9](#9-decisions-needed-from-you). Building starts when you approve D1.

Evidence labels: **Verified** (we checked it, and say how), **Sourced** (a cited document says so), **Assumption** (our judgement, not checked). All test evidence so far comes from a local test chain; nothing has run on a public network yet.

## 1. Result

By 09:30 CEST, v3 aims to turn today's local-only demo into a public, checkable one and to earn both bonuses:

1. **The required story on a public chain.** The story is: create a wallet, pay, lose the phone, recover the same address. It runs on Sepolia, Ethereum's public test network, with an Etherscan link for every step. It runs once from a script that writes an evidence file, and once in the browser, automated with a virtual passkey. Your own walk-through is a third run if you have time.
2. **Recovery in the browser from a "new phone".** It is guided step by step. The old phone shows an alert with a "Stop it" button, and Swissquote always pays the fee for that cancel, even when its screening or budgets would refuse anything else.
3. **A trust check: "Can Swissquote move my money?"** One panel reads the wallet's rules from the chain and answers in plain words, including the limit: Swissquote publishes the app, so you trust the app version you run. Inside it, the contract refuses a Swissquote + partner recovery attempt, live. That attempt runs on a separate throwaway wallet, so no real helper key ever signs for it.
4. **Compliant DeFi (bonus, up to 10 points).** DeFi means decentralised-finance apps. From inside the wallet the user can swap USDC to EURC on Uniswap and supply USDC to a Compound test market. Before signing, the wallet shows Swissquote's own plain-language summary of what will happen, with a risk notice. Every address is screened against sanctions lists, and Swissquote pays the network fee only when every check passes.
5. **Gasless, proven on chain (bonus, up to 10 points).** "Gasless" means the user pays no network fee. Etherscan shows Swissquote's relayer as the sender and the wallet holding 0 ETH; the relayer is Swissquote's server that submits transactions and pays their fees. Each receipt also says what the same transaction would cost on Ethereum mainnet at today's prices (about one US cent for a payment; P0.6).
6. **A judge pack.** It contains a README tour built as a "claim → evidence" table, the threat model, our legal positions, a business case on corrected Swissquote figures, a paste-ready submission text, 6-8 slides, a timed 5-minute script, a question-and-answer sheet and a narrated backup video.

**What stays the same:** the on-chain custody design. v3 uses the same contracts as v2: Safe v1.4.1 (audited) and two existing instances of the Candide recovery module v0.0.1. Safe lists an Ackee Blockchain audit of v0.0.1 (Sourced: https://github.com/5afe/CandideWalletContracts); we have not checked that the deployed bytecode matches the audited commit. The wallet template and the on-chain rules are unchanged. v3 adds evidence, user interface and stricter relayer rules.

**Main changes after the critiques:**

- The planned `/demo/collude` endpoint is gone. It would have handed a card thief a real helper signature that can lock a wallet forever.
- v3 is built in a separate copy of the repository (a Git worktree) on its own ports, so your live v2 demo is never touched.
- The trust check and the "three things to keep" wording fixes moved up to must-have. The guarded-wallet prototype, the inheritance flow and the recovery "fire drill" were dropped.
- The code freeze moves from 04:00 to 03:00, and the Sepolia story runs right after the first gate, at about 23:00.

### Expected score

Assumption: this is our reading of the rubric in Docs/desc.md:136-147; the judges' actual scale is unknown. The bonuses count only if create → sign → recover works end to end (Docs/desc.md:111), which is why public-chain recovery comes first.

| Criterion (maximum) | Today | After P0 | After P0 + P1 | What moves it |
|---|---|---|---|---|
| Technical implementation (35) | 22-27 | 30-33 | 31-34 | Public-chain transaction links; recovery in the browser; readable code |
| Security & custody (20) | 15-17 | 17-18 | 18-19 | Trust check with the contract's live refusal; a cancel that is always paid; honest threat model |
| Legal feasibility (15) | 9-11 | 11-13 | 12-14 | Clear custody and Travel Rule positions; screening that actually blocks; DeFi risk wording |
| Business case (15) | 7-9 | 11-13 | 12-14 | Corrected Swissquote figures; cost of sponsored fees; price and adoption labelled as assumptions |
| User experience & pitch (15) | 7-9 | 10-12 | 11-14 | Guided recovery; three things to keep; locked storyline; narrated video |
| Bonus: gasless (10) | 4-6 | 8-10 | 8-10 | Relayer-sent Sepolia transactions; cost per payment; abuse limits shown |
| Bonus: compliant dApp (10) | 1-3 | 6-9 | 7-9 | Live, screened, previewed Uniswap and Compound transactions |
| **Total (120)** | **65-82** | **93-108** | **99-114** | |

Points within one criterion are capped, so feature gains do not simply add up.

### Cut lines

- **Fallback at all times:** the v2 demo keeps running, untouched, from this checkout on its usual ports (5173, 5174, 4001, 4002, 8545); the Git tag `v2-local-verified` (commit e827ee0, already pushed) marks its code. If v3 is not green at a gate, we demo v2 plus whatever v3 evidence passed.
- **23:00 (G1):** if the Sepolia plumbing does not work, drop all P2 work and P1.6, and put every free lane on Sepolia.
- **00:30 (G2):** if browser recovery does not pass locally, keep v2's recovery screens (L12 will have tested them by then) and drop P1.2 and P1.3; the P0.10 wording fixes still ship. If the local copy of Sepolia used to test DeFi (the fork, P0.5) does not work, cut the swap and keep Compound only.
- **02:00:** if DeFi is not live on Sepolia, keep Compound only. If it still fails at 02:30, show the preview, the screening and the refusal, labelled "not executed".
- **02:30:** evidence runs on Sepolia end. Later Sepolia use is limited to demo staging, your walk-through and rehearsals.
- **03:00:** code freeze; anything not merged by then is cut.

## 2. Principles

1. **v2 keeps working at every step.** At every gate, one gate script runs all 270 tests on its own chain and ports, with zero skipped tests (§5). The 270 are 228 in the workspace (protocol 13, browser 11, scripts 2, recovery tool 16, wallet 11, partner 12, Swissquote 15, adversarial 148) plus 42 contract tests. A v2 test whose expected result must change is changed in its own commit, which states the old and new expectation and is approved by the verification lane (L13). New behaviour sits behind feature flags (`VITE_FEATURES` in the wallet, `SQ_FEATURES` in the services). Turning a flag off restores v2 behaviour for that area, except that the Sepolia launcher forces `strictSponsorship` on.
2. **The live demo is never touched.** Your v2 demo runs from this checkout, and its wallet and tool pages reload any file saved there (Verified with `ps` at 18:24 UTC: Vite dev servers with hot reload on 5173 and 5174, Hardhat on 8545). All v3 work therefore happens in separate worktrees on other ports. Nothing connects to port 8545 or to the live service ports.
3. **Safety and security first.**
   - No change to the on-chain custody design on the demo path, and no new Solidity (P2.2 is not planned; decision D2).
   - Real helper keys sign only inside the real recovery flow, after their checks: an owner login for Swissquote, the face check for the partner. No demo route makes them sign.
   - On Sepolia, scripts send only from TREASURY and FUNDER (the fee payer for the kit sweep); the services send only from RELAYER and SQ_ACCOUNT. No two processes share a sending key, which prevents nonce collisions (the nonce is a sending account's transaction counter).
   - No secrets in prompts, logs, links or reports. Keys are loaded only by the launcher, from `swissquote-wallet/.env.sepolia`. Service data folders live under the Git-ignored `swissquote-wallet/.sepolia-runs/`, and a scan before every push checks the staged files for the actual secret values (§7).
4. **No homemade cryptography or custody code.** We reuse the deployed Safe contracts and Candide recovery modules, viem, @scure and the browser's WebCrypto.
5. **MOCKs are labelled** in the user interface, the docs and the architecture diagram: KYC, the SECO name check, the face check, the bank account, the mailbox, the guardian key storage (a stand-in for a hardware security module) and the MOCK sanctions list.
6. **Never overclaim.** L13 checks every claim in the docs and slides against evidence twice: at 04:00, and again at 08:30 after the last edit. The phrasing rules in §8 apply.

## 3. Feature portfolio

P0 = must ship, P1 = should ship, P2 = stretch. "Risk" means the chance that a feature breaks the demo or leads us to overclaim. The ranking uses a risk-adjusted return per hour, taking the middle of each points range:

```text
score per hour = expected points x (1 - risk) / (agent-hours x (1 + 2 x risk))
```

All point, hour and risk figures are assumptions.

| Feature | Tier | Expected points | Agent-hours | Risk | Score per hour |
|---|---|---|---|---|---|
| P0.7 Readability pass (formatter) | P0 | 1-2.5 | 0.5 | 0.05 | 3.0 |
| P0.6 Gasless proven on Sepolia, with its cost | P0 | 2-4 | 1 | 0.05 | 2.6 |
| P0.10 Wording fixes: "three things to keep" | P0 | 1-2 | 0.75 | 0.05 | 1.7 |
| P0.9 Trust check (minimum) | P0 | 1.5-3 | 1.5 | 0.05 | 1.3 |
| P0.8 Judge pack | P0 | 6-12 | 7 | 0.02 | 1.2 |
| P0.4 Collusion and thief tests reach the contract | P0 | 1-3 | 1.5 | 0.05 | 1.15 |
| P0.1 + P0.2 Sepolia plumbing and story with links | P0 | 4-12 | 5 | 0.15 | 1.05 |
| P0.3 Browser recovery from a new phone | P0 | 3-8 | 4.5 | 0.20 | 0.7 |
| P0.5 Compliant DeFi | P0 | 5-8 | 7.5 | 0.15 | 0.57 |
| P1.6 Same address on three more test networks (script and docs) | P1 | 0.5-1 | 0.5 | 0.02 | 1.4 |
| P1.8 Terms sheet (docs) | P1 | 0.5-1 | 0.75 | 0 | 1.0 |
| P1.5 Verifiable recovery tool | P1 | 0.5-1.5 | 1 | 0.05 | 0.86 |
| P1.4 Partner never learns your Swissquote identity | P1 | 0.5-1.5 | 1 | 0.10 | 0.75 |
| P1.7 Key replacement in the browser | P1 | 0.5-1.5 | 1 | 0.10 | 0.75 |
| P1.9 Swissquote rings the alarm (MOCK mailbox) | P1 | 0.5-1.5 | 1.25 | 0.10 | 0.6 |
| P1.11 One address, whole story | P1 | 0.5-1.5 | 1.25 | 0.10 | 0.6 |
| P1.10 Second path for the cancel | P1 | 0.5-1 | 1 | 0.10 | 0.56 |
| P1.2 Protection card and "what Swissquote stores" panel | P1 | 0.5-1 | 1.25 | 0.10 | 0.45 |
| P1.1 Trust check (full) | P1 | 0.5-1.5 | 2 | 0.10 | 0.38 |
| P1.3 Plain-language payment preview and look-alike warning | P1 | 0.5-1.5 | 2 | 0.10 | 0.38 |
| P2.5 Passkey bound to Swissquote's effects summary | P2 | 0.5-1 | 1.5 | 0.20 | 0.29 |
| P2.1 "Move all funds" inside the offline tool | P2 | 0.5-1.5 | 2.5 | 0.20 | 0.2 |
| P2.4 Second live test network (Base Sepolia) | P2 | 0.5-1.5 | 2 | 0.30 | 0.2 |

P0.5 has the lowest ratio of the P0 items but stays P0 for two reasons: you asked for it (G8), and it is the largest block of points we do not yet have. P0.3 stays P0 because the bonus gate needs recovery to work end to end. P1 items are built in score order.

### P0.1 Sepolia plumbing (enabler for everything public)

**Problem:**

- Wallet checks used to read the wallet's history from block 0. Public nodes cannot serve such ranges: publicnode keeps only about the last 10,000 blocks of logs, and the free drpc plan answers only about 100-block ranges (Sourced: AgentsLocal/46257332/v3/explore/sepolia.md). Registration, the Travel Rule withdrawal and the recovery tool's check would all fail on Sepolia.
- `rpc.sepolia.org`, then a default node of the wallet, returned HTTP 404 (Verified by the status check, about 17:20 UTC).
- The relayer had no fee or nonce handling for a public chain.

**Already in the working tree, untested (Verified by reading at 18:25 UTC):**

- History reads start at `SEPOLIA_HISTORY_START = 11_886_000n`, in chunks of `LOG_CHUNK_BLOCKS = 10_000n` (packages/protocol/src/constants.ts:43, :45; packages/protocol/src/verification.ts:77). The history nodes are tenderly and ethpandaops (constants.ts:50).
- The wallet's default nodes are publicnode and ethpandaops (apps/wallet/src/chain.ts:5-6).
- The recovery tool no longer reads from block 0 (apps/recovery-tool/src/core.ts). Its Content Security Policy, the browser's allow-list of addresses a page may contact, now allows the history nodes (apps/recovery-tool/index.html:2).
- The relayer has Sepolia fee caps and viem's nonce manager (services/swissquote/src/chain.ts:9-24).

These edits sit in the live folder; L1 carries them into the v3 worktree.

**Still to do:**

- **Start-block safety.** Every wallet we create is younger than block 11,886,000: all four service keys still had nonce 0 at block 11,886,313 (Verified, 18:25 UTC). The check also requires the wallet to have no code at the start block, read once on an archive node.
- **Node roles.** Archive nodes (ethpandaops, then tenderly) serve history. Publicnode serves sends and latest-block reads. Publicnode and drpc serve simulations: `eth_simulateV1` works on both, while ethpandaops refuses it and tenderly rate-limits it (Verified by the feasibility critic). Two independent nodes are compared for pending recoveries.
- **Consistent reads.** Public nodes are load-balanced, so a read just after a receipt can land on a server that is behind. After a transaction, read at the receipt's block or later, retrying for up to 30 s, and compare two nodes only at the same block.
- **Recovery tool.** Rebuild the single file (`vite build && node scripts/inline.mjs`), and add a test that every default node appears in its Content Security Policy.
- **Relayer fees.** A tip of at least 0.01 gwei and a maximum fee of 2 × base fee + tip. The cap is 20 gwei for ordinary sends and 100 gwei for protective cancels. Above the cap, the wallet shows "Network busy — try again in a few minutes".
- **Relayer nonces.** A failed send does not leave the counter stuck: viem 2.57.4 calls the nonce manager's `reset` itself whenever `sendTransaction` throws, and the next send re-reads the pending count (Verified by L0 in the installed source, node_modules/.pnpm/viem@2.57.4_typescript@5.9.3/node_modules/viem/_esm/actions/wallet/sendTransaction.js:239-243; this corrects the feasibility critic's finding). The remaining risk is a send whose outcome is uncertain, for example a timeout after a node accepted it. The relayer already locks itself in that case ("Previous submission is uncertain"). On Sepolia, keep the send queue closed until the receipt arrives. Add `scripts/sepolia-relayer-status.mjs`, which prints the latest and pending nonce and the last transaction hash.
- **Receipt wait.** The wallet waits up to 180 s (today 90 s), then shows "Pending — see Etherscan" with the link instead of an error.
- **Launcher.** A new `swissquote-wallet/sepolia-demo.mjs`:
  - loads `.env.sepolia` without printing it;
  - puts `SQ_DATA_DIR` and `PARTNER_DATA_DIR` under `.sepolia-runs/<run-id>/`;
  - uses the v3 ports and the passkey origin `http://localhost:5273`;
  - turns `strictSponsorship` on;
  - refuses to start if `PARTNER_DEMO_FOOLED=true`.
- **Small fixes.** The service reads `PORT`, while `.env.example` says `SQ_PORT` (services/swissquote/src/main.ts:12): read both. The ownership-proof text always says "Sepolia" (packages/protocol/src/signing.ts:47-50): name the actual chain.

**Done when:** unit tests pass for chunking, the start-block rule, a node that refuses large ranges, the policy covering every default node, and the nonce reset with a failing connection. A read-only check of a real Sepolia wallet passes. At G1, one wallet deploy and one payment succeed on Sepolia through the services, sent by RELAYER.

**Effort, risk and fallback:** about 2.5 agent-hours; medium risk, because registration, withdrawals and the tool all depend on it. Fallback: history reads from tenderly only. It has no range limit but starts refusing after a few heavy calls, so wallet checks get slower.

### P0.2 Sepolia story with transaction links

**What you see:** Docs/submission/evidence/story-sepolia.md, a table with one Etherscan link per step, and a machine-readable `story-sepolia.json`.

**Why it scores:** the brief says "the transaction in that story must be signed and sent to a blockchain (a testnet is fine)" (Docs/desc.md:97). This is the largest Technical gap, and the bonus gate depends on it.

**Design:** a new `scripts/story-sepolia.ts`. It sends nothing unless `ALLOW_SEPOLIA_STORY=yes` is set. It generates the wallet's owner, card, partner and Swissquote keys itself, so no service key acts as a helper. TREASURY sends every transaction, except that FUNDER pays the kit sweep's fee. Payments go to TREASURY, so the USDC is reused. Mode `full`:

1. Deploy the wallet.
2. Check the ownership proof (EIP-1271, the standard way a contract wallet confirms a signature).
3. Fund it with 10 USDC.
4. Pay 1 USDC (small).
5. Pay 6 USDC (large).
6. Start a recovery on module A (180-second wait).
7. Start a recovery on module B (3-day wait).
8. Cancel both with the owner key, in one batch.
9. Start module A again.
10. Wait until the latest block is at least 180 s past the start, then finalize.
11. Read-only checks with eth_call (a free simulated call that writes nothing): the old key is refused with Safe error GS026, and the address is unchanged.
12. Kit sweep: move all funds with the new emergency kit.
13. Replace the owner key.
14. The collusion check from P0.4, on its own throwaway wallet.

Mode `b-pending`, run at about 23:45 CEST, starts a module-B recovery on a second wallet. Its on-chain wait is 259,200 s (3 days), so it can complete only around 23:45 CEST on Tuesday 13 Oct, after judging. We show the countdown and never claim that module B completed on Sepolia.

**Local addition:** the local story (`scripts/story.ts`) gains one step that moves the local clock 259,200 s and finalizes a module-B recovery. Today the real 3-day module B has only been started, cancelled and refused locally, never finished.

**Evidence format:** `{chainId, startedAt, wallet, steps:[{name, txHash, block, gasUsed, status, sender, label, explorerUrl}], checks:[{name, result, method, revert?}]}`. Steps sent by TREASURY carry the label "scripted setup", because they do not prove gasless use (P0.6).

**Done when:** every step shows status "success"; the recovery tool's "Check my wallet" is green for the recovered wallet; the module-B countdown is readable from two nodes; locally, module B finalizes.

**Effort, risk and fallback:** about 2.5 agent-hours plus about 15 minutes of chain time (about 13 transactions at 12 s per block). Medium risk. Fallback: the deploy → pay → recover (module A) subset alone satisfies the brief.

### P0.3 Recovery in the browser from a new phone, with alert and cancel

**What you see:**

- **On the new phone:**
  1. "I lost my phone".
  2. Choose a helper: the partner (3 minutes in this demo) or Swissquote (3 days).
  3. The new device creates its key and shows its full checksummed address in groups of four characters. The same groups appear on every approval screen. A short code would be unsafe: an attacker who swaps the request can generate keys until a 32-bit code matches, which takes seconds to minutes.
  4. Approve with the Recovery Card in the offline tool, opened from your own bookmark or saved copy, never from a link, by pasting the public request code. v2 already has this copy-paste hand-off. The wallet never asks for card words.
  5. The helper's MOCK check.
  6. A countdown, based on the latest block's time with a 15-second margin, not on the laptop clock.
  7. "Save your new emergency kit". The flow cannot finish until the new kit is saved, because the old kit stops working once its key is no longer the owner. (v2 already creates the new kit: Verified by reading apps/wallet/src/App.tsx:254; not run.)
  8. "Done — same address". A button "Try the old key" asks the contract with a real eth_call signed by the old key, and shows "The wallet contract refused the old key", with GS026 in small text.
- **On the old phone:** a red alert, checked every 15 s on two nodes and shown if either node reports a pending recovery: "Someone is replacing your wallet key with the key 0x7F3A 91C2 … (full address shown). Completes in 2:41." It offers two buttons, [Stop it — this wasn't me] and [It was me]. On stage it is introduced as "if a thief had started this".

**The cancel is always paid for.** "Stop it" sends a cancel batch signed by the owner key, which the relayer sponsors without a login (Verified: services/swissquote/src/app.ts:89). v3 adds this rule: a protective cancel is never refused because a screening source is down, a budget is used up or fees are above 20 gwei. Only a positive sanctions hit on the wallet itself blocks it, and that case is logged for a report to SECO. Cancels get their own fee cap of 100 gwei and a limit of 5 per wallet per day. Today they still count against the global daily budget (Verified: app.ts:34).

**Why it scores:** the brief requires a demo of "lose the wallet or its keys → recover access" (Docs/desc.md:88). The browser recovery screens exist (apps/wallet/src/App.tsx:287-348) but have never been run. The services' recovery path has never run against the contracts either: the local story signs with test keys and skips both services (Verified: scripts/story.ts:23, :61-62).

**Design:** move the recovery logic out of App.tsx into new files under `apps/wallet/src/features/recovery/` and `apps/wallet/src/features/alert/`; the wallet-shell lane (L4) mounts them. The protocol, the contracts and the service endpoints are unchanged, apart from the cancel rule above (L6).

**Done when:**

- A local test drives a recovery through both running services against a local chain: partner approval → Swissquote `/relay/recovery` → `/relay/finalize`. It passes before any Sepolia attempt.
- A service test: with a screening source down and the global budget used up, the cancel is still relayed.
- A local Playwright run with two browser profiles (old phone and new phone), each with a virtual passkey, passes start → countdown → new kit → finalize → old key refused → same address. A second run passes the cancel path. The test harness already drives a virtual passkey (Verified: tests/browser/harness.mjs:69-70).
- The same flow passes once, headless, on Sepolia, with its links saved to `Docs/submission/evidence/browser-sepolia.json`.

**Effort, risk and fallback:** about 4.5 agent-hours; medium-high risk, because this is the most user-interface work. Fallback: v2's recovery screens (L12 tests them in wave 1, so their state is known by 00:30), the script's Sepolia links (P0.2) and your own walk-through.

### P0.4 Collusion and thief tests reach the contract

**What you see:**

- **"Swissquote and the partner try to take this wallet without the card".** The wallet replays, live on Sepolia through eth_call, a recovery attempt that the story script recorded on a throwaway wallet. It shows the contract's own refusal text plus one plain sentence: "The contract refused: every recovery needs your card." This appears inside the trust check (P0.9) and in the MOCK demo lab.
- **The thief beat,** for the bonus credit the brief offers for refusing an attacker with the stolen phone AND email (Docs/desc.md:94):
  1. A password reset through the MOCK mailbox.
  2. Swissquote refuses: a recent reset needs a passkey login, or a 72-hour hold plus a MOCK video ID (services/swissquote/src/app.ts:172).
  3. The partner's MOCK face check fails.
  4. "Suppose both were fooled": the replay above shows the contract still refusing.

**Design (changed after the security critique):**

- **No endpoint makes a real helper key sign.** The planned `POST /demo/collude` is dropped. The recovery module accepts guardian signatures from any caller and keeps them valid until the wallet's recovery nonce changes (Verified: SocialRecoveryModule.sol:154-187, :305). A helper signature handed out for a real wallet would let anyone holding the card start a recovery to a key nobody holds. That would lock the wallet forever unless the owner cancels in time.
- **The throwaway wallet.** The story script deploys a wallet that holds no funds and whose owner, card, partner and Swissquote keys it generates itself. It records three attempts and then deletes the private keys:
  1. On each module, that module's helper signature alone → `SM: confirmed signatures less than threshold` (SocialRecoveryModule.sol:185).
  2. The partner and Swissquote signatures together → `SM: Signer not a guardian` (:115), because each helper guards only one module.
  3. Positive control: card + helper → accepted. This proves that the refusals come from the threshold rule, not from a malformed request.
- **The demo lab's label** shows the decoded revert, not the app's interpretation (today's label is at apps/wallet/src/App.tsx:418-421).
- **On Sepolia, every "fooled" switch stays off.** The launcher refuses `PARTNER_DEMO_FOOLED=true`, because that switch makes the partner approve any new owner for every enrolled wallet (Verified: services/partner/src/service.ts:48 is one global flag).

**Done when:** the three recorded attempts give the expected results locally and on Sepolia, and a test shows that no route on either service signs a recovery approval without the owner's session (Swissquote) or a passed face check (partner).

**Effort, risk and fallback:** about 1.5 agent-hours; low risk. Fallback: the recorded results from the evidence file, shown as text.

### P0.5 Compliant DeFi: the "Allow-listed by Swissquote" tab

**What you see:** a new DeFi tab, labelled "Allow-listed by Swissquote (security checks only)", with three cards:

- **Swap USDC → EURC on Uniswap.** This is the stage beat, because Uniswap's addresses come from its official deployments feed.
- **Supply USDC to Compound,** marked "third-party Compound III test deployment".
- **Unlisted contract 0x6Ae4…8951** (refused). The note reads: "Swissquote has not checked this contract and does not pay its fee."

Each listed action opens a preview first. The preview text is Swissquote's own summary from its simulation, not text the app wrote. For example: "You give 2.00 USDC to Compound. You get a Compound supply position worth about 2.00 USDC; the yield is variable and paid by the protocol. Compound's permission to spend your USDC goes back to 0. Fee: paid by Swissquote. Screening: all addresses clear." Every preview ends with: "Not a bank deposit. Not covered by depositor protection. Smart-contract risk: you can lose this amount. Swissquote does not advise on this." The user confirms, with a passkey above 5 USDC. The result shows the Etherscan link and "Permission now 0", read back from the chain.

"Allow-listed" is defined once on screen: on Swissquote's fee-sponsorship list after a technical check of the pinned address and code; not investment advice.

**Why it scores:** this is the brief's bonus idea list almost word for word: an approved dApp list, sanctions screening, a plain-language preview before signing, and extra checks above a threshold (Docs/desc.md:115). Up to 10 points.

**Listed contracts (Verified read-only by the dApp explorer and the feasibility critic, 17:30-18:15 UTC):**

- **Uniswap v3** (Sourced: the official deployments feed, https://developers.uniswap.org/deployments.json):
  - SwapRouter02 `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` and QuoterV2 `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3`.
  - The USDC/EURC pool with the 0.05% fee, `0x68adf381B8F9e9e100bb6E13d50b14094e3b6a9d`. It is shallow: 336.35 USDC and 131.31 EURC, quoting 1 USDC → 0.9865 EURC.
  - EURC (Sepolia) `0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4` (Sourced: https://developers.circle.com/stablecoins/eurc-contract-addresses).
  - A simulated approve → swap → approve-0 batch succeeded.
- **Compound v3 USDC market** `0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e`. Its base token is Circle USDC (Sepolia) `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`; supply and withdraw are not paused; a simulated approve + supply succeeded. Compound's official deployments repository has no Sepolia folder (Sourced: GitHub API listing, checked by the judge-fit critic), so we call it a third-party test deployment.
- **Proxies.** Compound's market, USDC and EURC are proxies: small contracts that forward calls to replaceable logic (Verified by the security and feasibility critics with `eth_getStorageAt`; Compound's logic contract is `0xe3e0106227181958abfba960c13d0fe52c733265`). Pinning a proxy's code hash does not pin its logic, so the registry also pins the logic and admin addresses.

**Sponsorship rules (exact).** Swissquote pays the fee for a DeFi batch only if all of these hold:

1. Every call goes to a registry contract or to Sepolia USDC/EURC, matching its pinned address, code hash and, for proxies, its logic and admin addresses.
2. Only these functions are allowed:
   - Compound: `supply(USDC, amount)` (0xf2b9fdb8) and `withdraw(USDC, amount)` (0xf3fef3a3).
   - Uniswap: `exactInputSingle` (0x04e45aaf), with these limits:
     - the tokens are USDC and EURC, and the fee tier is 500;
     - the recipient is the wallet itself;
     - at most 5 USDC, or the EURC equivalent, per swap;
     - no price limit is set;
     - the minimum output is at least a fresh quote minus 1%;
     - the quote lies in a fixed demo range: 0.80–1.00 EURC per USDC, or the inverse for EURC → USDC. The range stops a stranger who moves the shallow pool first from setting the price.
   - New: token approvals (`approve`, 0x095ea7b3) only to that registry contract and for the exact amount, and the batch must end with `approve(spender, 0)`. Today every approval is refused, because the approved list is empty.
3. The batch runs through MultiSendCallOnly `0x9641d764fc13c8B624c04430C7356C1C7C8102e2`, as today.
4. Every address involved is clear on the screening sources: targets, spenders, recipients and the wallet itself. If a required source does not answer, or its list is older than 30 days, the relayer refuses with `SCREENING_UNAVAILABLE`; it fails closed. This rule never applies to protective cancels (P0.3).
5. Just before sending, the relayer simulates the signed transaction again. The effects must stay within the preview's bounds: no more spent than shown, at least the minimum output received, and no other balance or permission changes. Otherwise it refuses with `EFFECTS_MISMATCH`.
6. Above 5 USDC, the existing passkey step-up applies, bound to the exact Safe transaction hash.
7. The existing daily budgets and the 15,000,000 gas cap apply (services/swissquote/src/app.ts:31-46).

Anything else gets `403 NOT_SPONSORED`, including Uniswap's `multicall` and Compound's `allow(manager, true)`. This replaces today's fallback, which sponsors any unknown contract call after a passkey (Verified: services/swissquote/src/policy.ts:42). The Sepolia launcher turns these strict rules on, and every audit-log entry records the active flags. The other refusal code is `SANCTIONS_BLOCK`.

**What these rules do not do.** They decide what Swissquote pays for; they are not custody controls. Whoever holds the owner key can pay the fee and send anywhere. They can also sign an off-chain USDC permit that skips the relayer entirely, because USDC on Sepolia accepts smart-account signatures (Sourced: AgentsLocal/46257332/v3/explore/security.md:71-77). The wallet therefore signs no message except its own ownership proof (tested), and the pitch says "we don't help sanctioned flows", never "we stop them".

**Screening sources.** Swissquote's service reads them, so the browser needs no mainnet access.

- **A MOCK list, labelled as such,** holding demo addresses, including the address OFAC lists, `0x7F367cC41522cE07553e823bf3be79A889DEbe1B` (OFAC is the US sanctions office). Required.
- **RedStone's sanctions oracle on Ethereum mainnet,** `0x574Ad490fE8087B580DB227a8Ca7EfB7C19Dc8C4`, `isSanctioned(address)`. Required; the primary on-chain source. It combines OFAC, EU, UK, UN and other lists through OpenSanctions, updates weekly and reports when it was last updated (Sourced: https://docs.redstone.finance/docs/stage1-market-data/sanctions-oracle/, a vendor page). It returns true for both `0x7F36…be1B` and `0x0389…e72c` (Verified by the legal critic, 18:07 UTC).
- **Chainalysis' sanctions oracle on Ethereum mainnet,** `0x40C57923924B5c5c5455c48D93317139ADDaC8fb`. Secondary. Its list was last updated on 18 Mar 2026 and misses wallets OFAC listed on 20 May 2026: it returns false for `0x038989cBB1710C72b9920Dc4Fa529158f463e72c` (Verified by the legal critic; Sourced: RedStone, a competitor). A hit blocks; an outage is shown but does not block, because the list is already known to be old.
- **Circle's `isBlacklisted(address)`** on Sepolia USDC and EURC. Required. Labelled "issuer freeze list", not a sanctions list.
- **A MOCK SECO name check** of the client at MOCK KYC. SECO is the Swiss authority whose sanctions list binds a Swiss bank.

Mainnet reads use at least three public mainnet nodes with failover, a 2-second timeout each, and a 10-minute cache that is warmed before the pitch. The receipt lists each source, for example: "RedStone: clear (updated …); Chainalysis: clear (list dated 18 Mar 2026); Circle freeze list: clear; MOCK list: clear". Payments are screened the same way. The wording is "screened against OFAC/EU/UN-derived on-chain lists plus a MOCK SECO check"; never "SECO-screened" for addresses.

Today the sanctions list is empty: services/swissquote/src/main.ts passes none (Verified).

**Endpoints:**

- `POST /screen {addresses} → {results:[{address, status: clear|listed|unavailable, sources, checkedAt}]}`.
- `GET /dapps` returns the registry.
- `POST /dapps/preview {wallet, calls} → {summary, effectsHash}`: Swissquote's simulation and plain-language summary.
- `POST /relay/safe-tx` gains `{source:'dapp', dappId, effectsHash}`.
- Every decision goes to an audit log with the Safe transaction hash, the effects hash and the active flags.

**Where the code goes:**

- Registry, decoder and plain-language sentences: a new packages/protocol/src/dapps.ts, shared by the wallet and the service.
- Simulation: `eth_simulateV1` on publicnode and drpc, in a new packages/protocol/src/simulate.ts. If no simulation node answers, the wallet blocks signing.
- Test bed: a local Hardhat copy ("fork") of Sepolia on a lane port, ready by 22:00, because Compound and Uniswap do not exist on the local chain. Assumption: publicnode serves the state a fork needs.
- The wallet shows the DeFi tab on Sepolia and on the fork only.

**Done when:**

- Protocol tests give the expected code for each rule: wrong recipient, missing reset, approval to an unlisted spender, wrong fee tier, unknown function, `multicall`, Compound `allow`, a swap over 5 USDC, minimum output too low, quote outside the range, listed address, required source down, stale list.
- Service tests cover the four refusal codes and the cancel exemption, and all 148 adversarial tests still pass.
- On Sepolia:
  - a sponsored swap of 1 USDC to EURC;
  - a sponsored Compound supply of 2 USDC, withdrawn afterwards;
  - the permission reads 0 after each;
  - a payment to the listed address is refused with no transaction (never send to it);
  - the unlisted contract is refused with `NOT_SPONSORED`.

**Effort, risk and fallback:** about 7.5 agent-hours across three lanes (L5, L6, L7); medium risk. Fallbacks: if the swap fails, Compound only; if Compound fails, the swap only; if both fail, show the preview, screening and refusal on Sepolia, labelled "not executed". On stage, the live DeFi transaction runs only if it passed three of three rehearsals; otherwise we show the staged transaction link.

### P0.6 Gasless, proven on Sepolia

**What you see:** each receipt says "Fee paid by Swissquote: 0.00000x test ETH. On Ethereum mainnet today, this payment would cost about USD 0.02." (the figure is computed per receipt; see below). The wallet's ETH balance stays 0. Etherscan shows the sender as Swissquote's relayer `0x6fc61DCE369786CFbf43536478C4CD521B4336f7`. Refusals explain why in one line: "Daily fee budget used up", "Swissquote does not pay for unlisted contracts", "Address blocked by sanctions screening", "Network busy — try again in a few minutes".

**Why it scores:** the brief asks who pays and how abuse is prevented (Docs/desc.md:113). The cost answers a bank's first question: whether free fees are sustainable.

**The cost figure** comes from each transaction's measured gas and a dated mainnet price. At 18:05 UTC, mainnet gas was 0.0655 gwei and ETH was USD 2,506 (Verified by the judge-fit critic, read-only). The story script simulated the full Sepolia story at block 11,886,330 (Verified by L2's builder with eth_simulateV1; not yet sent). At that mainnet price:

- wallet deployment: 2,650,279 gas, about USD 0.44 (once per client);
- payment: 101,381 gas, about USD 0.017; the first payment of the story used 297,221 gas, about USD 0.049;
- recovery start: 934,723 gas, about USD 0.15; cancelling both recoveries: 162,274 gas, about USD 0.027.

The live receipts in story-sepolia.json replace these simulated amounts. Gas prices move, so the business slide also shows the worst case:

```text
cost per active client per month = payments x measured gas used x gas price
worst case per client per month  = daily budget per account x 30
```

**Design:** the abuse rules exist already: deploy only the approved wallet template; simulate first; a gas cap of 15,000,000; daily limits (1,000 overall, 50 per account); one wallet per account; zero refund fields (Verified by the status critic: services/swissquote/src/app.ts:31-46, :87, :129-130). v3 adds the strict sponsorship rules (P0.5), the cancel exemption (P0.3) and a "fees paid today" line per account. The slide reads: "Swissquote pays fees as a service, inside its anti-money-laundering programme. It cannot move your money: its keys only pay fees and, together with your recovery card, approve a recovery."

**Evidence:** only transactions sent by RELAYER prove gasless use: the G1 deploy and payment, the browser runs and the DeFi transactions. The evidence file lists their hashes separately from the story's "scripted setup" steps.

**Done when:** the Sepolia links show the relayer as sender, and the wallet's ETH balance reads 0 before and after. About 1 agent-hour; low risk.

### P0.7 Readability pass (wave 0, before any lane starts)

**Why:** the Technical criterion asks for "clean, sensible code", and apps/wallet/src/App.tsx has a 4,508-character line.

**Design:** in the v3 worktree only, after L1's edits are copied in and before any lane starts, L0 runs Prettier once (`pnpm dlx prettier@3`, print width 120, no change to the lockfile) over the TypeScript in apps, services, packages and scripts. It then runs the gate and commits. The line numbers cited in this plan move as a result; lane briefs cite the new ones.

**Done when:** no line in those folders exceeds 200 characters, except strings Prettier cannot break, and the gate passes. If anything fails, revert and skip; this is a 20-minute timebox. If it is skipped, format only App.tsx at the freeze.

### P0.8 Judge pack

- **README tour (2 minutes),** built around a "claim → evidence" table: each claim gets a transaction link, a test name, or a file and line. Features that are invisible on stage, such as the readability pass, the partner privacy fix and the tool fingerprint, earn points only here. It also includes a real-versus-MOCK table, the test counts and the full list of AI tools used, with what each was used for.
- **Threat model v3.** It answers the brief's questions: who could steal, who could lock the client out, and whether Swissquote alone or with the partner could move funds (Docs/desc.md:90). It includes every item under "Still unprotected" in §4.
- **Legal positions:**
  - "Swissquote is a regulated helper, not a custodian; the fee relay runs inside its anti-money-laundering programme."
  - Withdrawals go only to the client's own wallet, verified by an ownership proof (Sourced: FINMA Guidance 02/2019).
  - Our reading: this is not custody under FINMA Guidance 01/2026, which would apply only if Swissquote held a key that can move funds.
  - When the client pays a third party from the wallet, our reasoned position is that Swissquote is not the sending institution. This is open; no FINMA guidance on sponsored relays was found.
  - The DeFi relay is execution-only and started by the client, and Swissquote never holds the funds. Whether the Financial Services Act (FinSA, the Swiss law on selling financial services) applies is open for counsel.
- **Business case** (Sourced: Swissquote's H1 2026 release and FY2025 results, as extracted by the legal critic; Swissquote's Swiss pricing page):
  - The base is 690,828 Swissquote trading accounts: accounts, not unique clients. The 1,220,818 total includes 423,409 accounts of Yuh, Swissquote's separate banking app, which we show only as upside.
  - At an assumed 1% adoption and the explore lane's net CHF 74.40 per user per year, revenue is about CHF 0.51 m per year (Assumption).
  - The argument: Swissquote's net crypto income fell 66.2% to CHF 14.6 m in H1 2026, and a subscription does not depend on trading volume. FY2025 net crypto income was CHF 85.7 m, cited to the FY2025 results, not the H1 release.
  - Swissquote's Swiss custody fee is a flat CHF 20 per quarter up to CHF 50,000 of assets, crypto included, so a client who moves crypto to the wallet costs it about CHF 0 in custody fees. Withdrawals cost USD 15 for USDC and EURC and USD 10 for BTC and ETH. Waiving that fee for transfers to the client's own wallet is a product choice (open question).
  - The cost of sponsored fees from P0.6.
  - The price (CHF 4.90 per month) and the adoption rates (0.5-2%) are labelled assumptions. Vendor sources are marked as such, and the second-hand lost-bitcoin figure is dropped.
- **Architecture diagram v3** with the MOCKs marked.
- **Pitch materials (L11):**
  - the storyline, drafted from G0 and approved by you at about 00:30 (D4);
  - 6-8 slides and a timed 5-minute script;
  - a sheet answering 15 likely judge questions, including the topics the wallet no longer shows: the address on other networks, inheritance, and "what if I don't open the app for three days?".
- **Submission text (L10, by 07:30):** Docs/submission/SUBMISSION.md, ready for you to paste into DoraHacks, with one section per item the brief asks for (Docs/desc.md:127-134) and evidence links. Once Sepolia evidence exists, L10 also rewrites the v2 hedges in Docs/submission/bonus.md and architecture.md.
- **Backup video:** a 2-3 minute cut of the Sepolia Playwright run, with captions at minimum, your voice if possible, and a short clip of your real passkey prompt. The raw recording stays as evidence. Uploading it needs your OK (D5).

**Done when:** L13's claims audits (04:00 and 08:30) find no claim without evidence or a "MOCK" or "not executed" label. About 7 agent-hours; low risk to the demo.

### P0.9 Trust check (minimum): "Can Swissquote move my money?"

**What you see:** one panel in the wallet. It reads the owners, threshold, modules and guardians from two nodes, reusing the reads in packages/protocol/src/verification.ts, and answers:

- "Can Swissquote alone move your money? **On chain: no.** Swissquote's keys are not owners of this wallet. **Off chain:** Swissquote publishes this app, so you trust the version you run; check its fingerprint, or use the offline tool."
- "Can Swissquote and the partner together replace your key? **No.** Every recovery needs your card." Below it, the live replay from P0.4 with the contract's own refusal.
- "Can your card plus the partner replace your key? **Yes, after 180 seconds in this demo** (days in production), unless you press Stop it in that time. They would then control the wallet."
- "Can a thief with your unlocked phone or your 24 words spend? **Yes.** They can also cancel your recovery. This is the main remaining risk."

Any other setup gets a neutral report: "Unknown module — cannot tell who else can move funds."

**Why it scores:** the brief's central custody question is whether Swissquote, "alone or together with a partner", could move the funds (Docs/desc.md:90). A one-click answer read from the chain serves Security and Legal at once. Assumption: it is also the clearest way for the project to stand out.

**Done when:** the local and Sepolia story wallets show the expected answers, and a local wallet with an extra owner is flagged. About 1.5 agent-hours (L8); low risk.

### P0.10 Wording fixes: "three things to keep"

Copy only, no logic change (L4, about 45 minutes). The seven look-alike secrets are the most visible weakness against "a non-technical client could use it" (Docs/desc.md:146).

- Onboarding names three things to keep: your phone, with its passkey and its app unlock code (today's "device passphrase"); your Recovery Card (12 words); your Emergency Kit (a file plus its kit code, kept apart).
- The 24 words move under "Advanced — NOT your Recovery Card words".
- The setup code is renamed "Wallet check code (public)", with a "Public, safe to share" badge.
- A plain sentence comes first and the contract code second, for example "The wallet contract refused the old key", with GS026 in small text.

### P1 — should ship

- **P1.1 Trust check (full)** (L8).
  - Tamper flags (hidden owner, extra module, guard set, unexpected fallback handler) and pending recoveries.
  - The same check inside the offline tool, prefilled with the Sepolia story wallet's address. The built tool file is attached to the repository and the submission, so judges can run the check themselves.
  - An internal `scripts/non-custody-report.ts` ("Swissquote is an owner of 0 of N wallets…"). It is never published as a list of client wallets (Assumption: client confidentiality applies).
  - Done when tampered local wallets are each flagged.
- **P1.2 Protection card and "What Swissquote stores about you"** (L4).
  - Six status rows on the Overview: ownership registered, independent check passed, kit saved, passkey for large payments, helpers ready on chain, no recovery pending.
  - The stored-data panel lists the actual stored fields (services/swissquote/src/store.ts, types.ts), including the new audit log and its legal retention period (10 years under the Anti-Money Laundering Act, per the legal explore notes; not re-checked).
  - Lock 2 minutes after the tab is hidden; a contrast-safe orange (#C93A15) for text buttons.
- **P1.3 Plain-language payment preview** (L4).
  - "You are sending 6.00 USDC to 0x…. Fee: paid by Swissquote. Your passkey confirms this exact payment. It cannot be reversed."
  - A look-alike warning appears when the first 4 and last 4 characters match a past recipient but the address differs. This defends against address poisoning, which a USENIX Security 2025 study measured at 270 million attempts and at least USD 83.8 million lost (Sourced via AgentsLocal/46257332/v3/explore/wildcards.md).
  - A first-time recipient must type the address's last 4 characters.
- **P1.4 The partner never learns your Swissquote identity** (L9).
  - Today the wallet sends the Swissquote user id (`userRef`) to the partner (Verified by grep in apps/wallet/src/App.tsx).
  - In v3 the partner stores only its own guardian key and the MOCK face record, and finds its key by reading module A's guardian list on chain. The field is accepted for v2 compatibility but ignored.
  - L9 updates its own v2 partner tests in the same change; L13 reviews them.
- **P1.5 Verifiable recovery tool** (L8).
  - Two clean builds must give the same SHA-256 hash of `dist/index.html`. The hash goes in the README and on the card, and `scripts/verify-tool.mjs` checks it.
  - The only link is `http://localhost:5274/#check=<public code>`. The data sits after `#`, which the browser never sends to a server. No link ever opens a page that asks for card words.
- **P1.6 Same address on three more test networks (script and docs only)** (L8).
  - A script checks the 8 pinned contracts' code hashes on Base, Optimism and Arbitrum Sepolia, and writes the result to `Docs/submission/evidence/multichain-codehash.json`. The multichain lane reported matching hashes at 17:20 UTC (AgentsLocal/46257332/v3/explore/multichain.md).
  - The wallet shows Sepolia only, and MOCK withdrawals go only to the wallet's own network. The warning "after a recovery, the old key still controls this address on networks where the wallet is not deployed yet" goes into the Q&A sheet, not the wallet.
  - Slide wording: "Live on Sepolia; same address reproducible on three more test networks; Bitcoin recovery rule tested on a private test network; Solana designed." It never says "multi-chain wallet".
- **P1.7 Key replacement in the browser, verified on Sepolia** (L4). Settings → "Replace my device key": an owner swap (an admin change) with a passkey, which cannot finish until the new emergency kit is saved. This is the honest answer to "disable a stolen phrase": it works while you still control the wallet and before the thief acts.
- **P1.8 Terms sheet (docs only)** (L10).
  - Recovery is best-efforts; the card is always required; the mandate survives death (Code of Obligations Art. 405); Swissquote may step down (Art. 404) while the partner path and the kit keep working.
  - Inheritance is not built. The Q&A answer: a possible future opt-in, where the owner names heirs at setup and the heirs act jointly or through the executor against a certificate of inheritance (Civil Code Art. 559 and 602; Assumption: the text of Art. 602 was not fetched).
- **P1.9 Swissquote rings the alarm** (L6). The waiting time protects you only if you learn about the recovery. When a recovery starts on a registered wallet, the Swissquote service writes a message to the MOCK mailbox (services/swissquote/src/app.ts:63-75) with the new key's address groups, the deadline and a "Stop it" link that opens the wallet. It is labelled MOCK; no real email is sent. It uses only data Swissquote already holds.
- **P1.10 Second path for the cancel** (L9). If the relayer does not get the owner-signed cancel mined within 2 blocks, the partner service submits it from its own key. This needs a fifth Sepolia key held only by the partner, which L0 creates and funds without printing it.
- **P1.11 One address, whole story** (L4, L6). Before deployment, the wallet shows its address as a QR code that links to Sepolia Etherscan (the address is known in advance). After recovery, "Prove ownership again" signs Swissquote's ownership challenge with the new key and checks it with EIP-1271 at the same address: the new key passes, and the old key fails. Open question: can the existing challenge endpoint (services/swissquote/src/app.ts:121) be re-run for a registered wallet? L6 confirms.

### P2 — stretch, only in idle lanes and only if every P0 is merged by 01:30

- **P2.1 "Move all funds" inside the offline recovery tool.** A browser version of `scripts/kit-sweep.ts`: open the kit, type the destination twice, sweep USDC and ETH. The kit key needs a little Sepolia ETH for the fee, and the tool says so. The tool goes online only behind an explicit switch.
- **P2.4 A second live network (Base Sepolia).** Deploy the same address and show that recovery must be repeated per network.
- **P2.5 Passkey bound to Swissquote's summary.** The step-up challenge becomes a hash of the Safe transaction hash and the effects hash. It changes the step-up format that the adversarial tests cover, hence P2.

### Not in v3, and why

- **The guarded-wallet prototype (formerly P2.2)**, unless you choose it in D2. It would give Swissquote a role in payments and cancels, and it does not close the gap it targets: transactions through modules and EIP-1271 messages bypass a Safe guard (Sourced: security critique, citing Safe.sol and ModuleManager.sol).
- **An inheritance flow.** Recovering without the user conflicts with your goal G6; it stays a Q&A answer (P1.8).
- **The recovery "fire drill".** Practising typing card words into an app trains the habit that phishing pages exploit.
- **Hosting the offline tool on GitHub Pages.** A hosted page that accepts card words is exactly the page an attacker would copy. The built file is attached instead (P1.1).
- **MPC, ERC-4337 or a passkey owner.** Each would change the custody core the night before judging.
- **Passkey PRF unlock.** The library puts extension results into the step-up response sent to the server (App.tsx:198), so the seed key would leak unless the code is redesigned.
- **WalletConnect.** It needs a Reown project ID, and it would let outside sites request signatures, which the wallet deliberately refuses.
- **Bitcoin or Solana builds.** We keep the research and design documents only.
- **A hosted public demo or a phone app.** Passkeys on judges' devices would need an HTTPS host.
- **French/German UI, USDC fee refunds, our own dApp contract, a card-replacement UI.**

## 4. Architecture and security changes versus v2

### What does not change (on chain)

These are the same as v2: the 8 pinned contracts; the wallet template; the CREATE2 address formula, which makes the address known before deployment; module A (180 s, guardians card + partner, threshold 2); module B (259,200 s, guardians card + Swissquote, threshold 2); and the owner key with threshold 1. The 42 contract tests therefore still describe the deployed design.

| Who | Move funds | Replace the owner key | Stop a pending replacement |
|---|---|---|---|
| Your device key (24-word seed) | Yes, any amount | Yes, directly (admin change) | Yes (cancel) |
| Card + partner | Not directly, but once they replace the key they control the wallet | Yes, after 180 s (demo; days in production), unless you cancel in time | No |
| Card + Swissquote | Not directly, as above | Yes, after 3 days, unless you cancel in time | No |
| Swissquote + partner (no card) | No | No — the contract refuses | No |
| Swissquote alone, or the relayer | No on chain; off chain, it publishes the app (threat 2 below) | No | No; it could delay your cancel by not relaying it (P1.10 adds a second path) |

### What changes (off chain; planned, not built yet)

1. **Sponsorship becomes an allow-list.** The relayer pays only for USDC transfers to screened recipients, listed DeFi batches that follow the P0.5 rules, protective cancels, and admin changes with a passkey. Everything else gets `NOT_SPONSORED`. The Sepolia launcher forces this on.
2. **Screening** covers every sponsored request and fails closed for payments and DeFi. It never blocks a protective cancel unless the wallet itself is listed. Every decision goes to the audit log.
3. **Protective cancels are always sponsored.** They are exempt from screening outages, budgets and the 20 gwei cap, with their own 100 gwei cap and a limit of 5 per wallet per day.
4. **Re-simulation within the preview's bounds** happens right before broadcast; a violation stops it.
5. **The wallet signs no message except its own ownership proof.**
6. **A new approval rule:** approvals only to listed contracts, for the exact amount, reset to 0 in the same batch (P0.5). Today every approval is refused, because the approved list is empty (services/swissquote/src/policy.ts:35-38, main.ts:11).
7. **The partner's view:** it knows only the wallet address and its own guardian key (P1.4).
8. **Sepolia operations:** nonce reset after errors, fee caps, and the rule that scripts and services never share a key.

**Unchanged limits (they exist today):** the step-up above 5 USDC or 0.01 ETH (packages/protocol/src/constants.ts:37-38); the daily limits of 1,000 overall and 50 per account; the 15,000,000 gas cap; one wallet per account; zero refund fields.

### Threat-model changes

- **New threats and our answers:**
  - Screening sources can be wrong, stale or down. Answer: fail closed for payments, never for cancels; refuse a list older than 30 days; label Chainalysis as old; show each source on the receipt.
  - Simulation nodes can lie. Answer: Swissquote simulates itself, and again before sending; production would use its own nodes.
  - The registry can be spoofed, or a listed proxy upgraded. Answer: pinned addresses, code hashes, and logic and admin addresses.
  - Leftover token permissions. Answer: reset to 0 in the same batch and read back.
  - An owner signature on an off-chain USDC permit skips every relayer rule. Answer: the wallet signs no other message, and screening is described as a fee rule only.
  - Public nodes see client addresses during screening, trust checks and alerts. Answer: production would use Swissquote's own nodes or a contracted provider (banking secrecy; Assumption: the exact Banking Act wording was not checked).
- **Improved after v3 (planned, not built yet):** the relayer will no longer pay for arbitrary contract calls; the sanctions list will no longer be empty; the partner will no longer learn the Swissquote identity; the cancel will no longer depend on screening or budgets.
- **Still unprotected after v3** (said plainly in the threat model):
  1. **A thief with your unlocked device key or your 24 words can spend everything at once and can cancel your recovery.** The owner can cancel (SocialRecoveryModule.sol:293), so it becomes a race. v3 does not change this.
  2. **A malicious version of the web app published by Swissquote could copy the key.** The offline tool and its fingerprint help; a native app and reproducible builds are on the roadmap.
  3. **Card + one fooled helper can recover, by design,** unless you cancel in time. The face check is a MOCK, and the cancel works only if you learn about the recovery (P1.9) and it gets relayed (P1.10).
  4. **Screening applies only when Swissquote pays the fee.** The key holder can pay the fee, or sign a permit, and send anywhere.
  5. **The same address on another network is not the same wallet.** The old key still controls it there.
  6. **The guardian keys sit in an unencrypted SQLite database** (a MOCK stand-in for a hardware security module: services/swissquote/src/store.ts:9, services/partner/src/storage.ts:29).
  7. **One relayer address links all clients' wallets on chain** (a privacy issue). A relayer pool is on the roadmap.
  8. **The Uniswap and Compound Sepolia deployments belong to third parties.** For the Compound one we found no official source.

## 5. Parallel build organization

**Bottlenecks:** the agents are fast. The slow parts are integration review, Sepolia confirmations (12 s per block), the real 180-second waits, the single relayer transaction counter and your time.

### Where v3 is built

- **The live checkout stays as it is.** v3 lanes edit nothing under `swissquote-wallet/` in this checkout. The Sepolia plumbing edits already there since 18:00 UTC look harmless for the local chain, which reads its own node addresses (Assumption); they stay unless they cause a problem.
- **v3 lives in a separate Git worktree** (a second checkout of the same repository in another folder), on a branch `v3` created from the `main` commit that adds these documents and the Sepolia readiness edits (L0 commits and pushes it after the secret scan; v2 itself stays at the tag `v2-local-verified`). Each merge batch gets its own worktree and branch; only L0 runs Git and merges. The write scopes do not overlap, so merges should be mechanical.
- **v3 runs on its own ports:** wallet 5273, tool 5274, Swissquote 4101, partner 4102, chain 8645. Passkeys still work there, because the passkey domain stays "localhost" for any port. The v3 service starts with an empty database, so you register a new account and passkey on v3.
- **When you no longer need v2,** for example at 06:00, the demo moves to v3. The v2 demo stays available on its ports as the fallback until submission.

### Wave 0 (L0, about 21:15-22:00)

1. Create the v3 worktree from that `main` commit (L1's Sepolia readiness edits are already in it) and install dependencies; copy `.env.sepolia` across without printing it.
2. **Ports and data folders (about 30 minutes).** Take the dev ports from environment variables; they are hard-coded today in apps/wallet/vite.config.ts:2, apps/recovery-tool/vite.config.ts:4, the `dev` scripts, apps/recovery-tool/src/validation.ts:22, prepare-local-demo.mjs:5 and tests/browser/clickflow.test.mjs:30, :52 (Verified by the feasibility critic). Generate the tool's Content Security Policy from the node list and ports. Read `PORT` and `SQ_PORT` alike. Add the v3 origin to `WEBAUTHN_ORIGINS`.
3. **One gate script, `scripts/gate.mjs`.** It starts its own chain, services and web servers on a configurable port range (never 8545 or the live ports) with temporary data folders. It runs every suite with `INTEGRATION_RPC_URL` pointing at its own chain and `BROWSER_REQUIRED=1`. It fails unless the pass count equals the expected count with zero skipped, and it prints its run time. The command recorded today would age the live chain, because an integration test moves chain time forward (tests/integration/local-chain.test.ts:157-158); and the browser tests skip themselves silently when no browser is found (tests/browser/browser.test.mjs:11-20). Both Verified by the feasibility critic.
4. The formatter (P0.7), then one timed gate run (G0).
5. The frozen interfaces (below) and 13 lane briefs. Lanes start from the stubs at about 21:45; G0 may slip 30 minutes without blocking them.

### Interfaces frozen in wave 0

1. **Wire types** in packages/protocol/src/api.ts:
   - the screening request and result;
   - `/relay/safe-tx` with `source: 'pay'|'dapp'|'settings'|'recovery'`, `dappId?` and `effectsHash?`;
   - `/dapps/preview`;
   - the refusal codes `NOT_SPONSORED | SANCTIONS_BLOCK | SCREENING_UNAVAILABLE | EFFECTS_MISMATCH`, with the rule that a protective cancel is never refused for an unavailable source or a budget.
2. **Stub modules with fixed signatures,** exported from index.ts:
   - `dapps.ts`: `DAPP_REGISTRY`, `checkDappBatch(wallet, calls) → {ok, dappId?, code?, reasons[]}`, `describeEffects(effects) → string[]`;
   - `simulate.ts`: `simulateCalls(clients, wallet, calls) → {effects, effectsHash}`;
   - `audit.ts`: `auditWallet(clients, wallet) → {facts, answers[], warnings[]}`.
3. **`FeatureContext`:** what every feature module receives from App.tsx (session, wallet, chain clients, API client).
4. **The feature registry** `apps/wallet/src/features/index.ts`, with every planned feature already listed as a flagged stub (tab id, label, component, flag), so no lane needs to edit it.
5. **The list of test IDs** (`data-testid` names) the browser tests will click.
6. **The partner API v3:** `/enroll` and `/recovery/approve` without `userRef`.
7. **The evidence JSON shape** (P0.2).
8. **Feature flags** `recoveryWizard, dapps, audit, protection, payPreview, strictSponsorship, partnerPrivacy`.

### Lanes (write scopes do not overlap)

| Lane | Writes only | Delivers | Starts after |
|---|---|---|---|
| L0 Lead / integration owner | root files (package.json, lockfile, workspace, dev.mjs, local-demo.mjs, prepare-local-demo.mjs, .env.example), scripts/gate.mjs, packages/protocol/src/{index.ts, api.ts}, apps/wallet/src/features/{index.ts, context.ts, test-ids.ts}, the wave-0 port changes (done before lanes start), Docs/plans/v3/ (except verification/) | Wave 0, merges, gate runs, commits and pushes, the secret scan before each push | — |
| L1 Sepolia plumbing | packages/protocol/src/{verification.ts, constants.ts, signing.ts}, services/swissquote/src/chain.ts, apps/wallet/src/chain.ts, sepolia-demo.mjs (new), scripts/sepolia-*.mjs, tests/protocol/v3-sepolia-*.test.ts; until G1 also the send and receipt code in services/swissquote/src/app.ts (around :29-30, :41-44, :97-101), apps/recovery-tool/src/core.ts and apps/recovery-tool/index.html | P0.1 | Wave 0 |
| L2 Sepolia story and run owner | scripts/{story-sepolia.ts (new), story.ts, kit-sweep.ts}, scripts/test/, Docs/submission/evidence/{story-*, sepolia-run-log.md} | ETH distribution, P0.2, the P0.4 throwaway wallet, the module-B pending wallet, the P0.6 evidence; schedules every Sepolia run one at a time and keeps the run log | Wave 0 for code; the Sepolia story only after L1 is merged |
| L3 Recovery screens | apps/wallet/src/features/{recovery, alert}/, tests/integration/v3-recovery-services.test.ts | P0.3, including the local service-recovery test | Wave 0 |
| L4 Wallet shell and user experience | apps/wallet/src/{App.tsx, styles.css, api.ts, storage.ts, lifecycle.ts, main.tsx}, apps/wallet/src/features/{protection, pay, settings}/ | mounts every feature; P0.10, P1.2, P1.3, P1.7; wallet side of P1.4 and P1.11 | Wave 0 |
| L5 DeFi protocol | packages/protocol/src/{dapps.ts, simulate.ts, classifier.ts}, tests/protocol/v3-dapps-*.test.ts, scripts/fork-sepolia.mjs | registry, decoder, plain sentences, simulation; the fork test bed by 22:00 | Wave 0 |
| L6 Relayer policy and screening | services/swissquote/ (except src/chain.ts, and except the send code until G1) | P0.5 service side, P0.6, screening sources, the cancel exemption, the MOCK SECO check, the MOCK start balance and payout cap, P1.9, service side of P1.11 | Wave 0 |
| L7 DeFi screens | apps/wallet/src/features/dapps/ | the DeFi tab | Wave 0 |
| L8 Trust check and recovery tool | packages/protocol/src/audit.ts, apps/wallet/src/features/audit/, apps/recovery-tool/ (after G1), scripts/{non-custody-report.ts, verify-tool.mjs, multichain-check.mjs} | P0.9, P1.1, P1.5, P1.6, P2.1 | Wave 0 |
| L9 Partner and demo lab | services/partner/, apps/wallet/src/features/demolab/ | P0.4 replay and thief beat; P1.4 with its v2 tests; P1.10 | Wave 0 |
| L10 Submission docs | Docs/submission/ (except evidence/) | P0.8 docs, SUBMISSION.md, P1.8 | Now; links filled after 02:30 |
| L11 Pitch | Docs/pitch/ (new) | storyline for your 00:30 check, slides, timed script, Q&A sheet | G0 |
| L12 Browser end-to-end and video | tests/browser/, Docs/submission/evidence/browser-* | a wave-1 pass over the v2 recovery screens; Playwright flows written against the test-ID list (local, then Sepolia); screenshots; the video cut | G0 |
| L13 Independent verification | tests/security/v3-*.test.ts, tests/integration/v3-*.test.ts (except L3's file), Docs/plans/v3/verification/ | the tests below; claims audits at 04:00 and 08:30; the clean-clone build; approval of changed v2 expectations | G1 |

Builders run only their own package's tests; full suites run only through the gate script (L0, L13). Builders do not run Git, do not touch the live demo, and touch nothing outside their scope. If they need a change elsewhere, they ask the owner. A lane L14 exists only if you choose the prototype in D2.

**Tests L13 adds** (from the security critique):

1. The throwaway-wallet collusion attempts: helpers alone are refused with the expected messages, and card + helper is accepted.
2. No route on either service signs a recovery approval without the owner's session (Swissquote) or a passed face check (partner).
3. Changing any byte of the new owner address changes what the approval screens show.
4. A protective cancel is relayed with a screening source down, the global budget used up and fees above 20 gwei.
5. Strict sponsorship refuses each of these with the documented code, and each audit-log entry records the flags:
   - an unlisted contract;
   - `multicall`;
   - Compound `allow`;
   - an approval to an unlisted spender;
   - an approval not reset to 0;
   - a swap recipient other than the wallet;
   - a fee tier other than 500;
   - a minimum output below the range.
6. The wallet refuses to sign any message other than its own ownership proof.
7. After recovery or key replacement, the old kit is reported as no longer the owner, and the flow requires a new kit.
8. The Sepolia launcher refuses to start with `PARTNER_DEMO_FOOLED=true`.
9. No tracked file contains any of the actual secret values (compared without printing them).

### Merge batches (full gate after each)

1. G1: {L1}.
2. G2: {L5, L6, L9}, then {L3, L4, L7}.
3. G3: {L8}.
4. The docs lanes (L10, L11) merge whenever ready; they do not affect the tests.
5. The Sepolia window: {L2, L12, L13}.

L0 resizes the batches once the G0 run time is known.

## 6. Schedule (CEST) and gates

Times assume your go-ahead by about 21:15. If it comes later, work before 03:00 shifts accordingly, but the cut lines keep their clock times.

| Time | Work | Gate and what to cut if late |
|---|---|---|
| Now | D0: you request faucet funds. All four service addresses still held 0 ETH and 0 USDC at 20:50 CEST (Verified, read-only). | — |
| 21:15-22:00 | Wave 0 (§5). Lanes start from the stubs at about 21:45. | **G0 about 22:00:** the gate is green with zero skips, and its run time is recorded. If the formatter breaks anything, revert it and continue. |
| 21:45-23:00 | Wave 1: lanes build. L12 tests the v2 recovery screens; L11 drafts the storyline; L5's fork test bed is ready by 22:00; L2 distributes ETH once it arrives (dry run first). Second faucet round about 2 hours after the first. | **G1 23:00:** L1 merged; one Sepolia deploy and one payment through the services, sent by RELAYER. If not: all free lanes on Sepolia; drop P2 and P1.6. |
| 23:00-00:30 | L2 runs the Sepolia story (`full`) at once, then the module-B wallet at about 23:45. Merge batch G2. Local Playwright run of the full story with recovery. | **G2 00:30:** browser recovery passes locally; DeFi and service tests are green; you approve the storyline (15 minutes). If not: v2 recovery screens; drop P1.2 and P1.3; cut the swap if the fork failed. |
| 00:30-02:30 | Sepolia slots, one at a time, run by L2: the browser recovery (headless Playwright) at about 01:00; the live DeFi transactions at about 01:30; reruns. Merge batch G3; P1 items; L13's tests. | **02:00:** DeFi not live → Compound only. **G3 02:30:** evidence JSON all "success"; evidence runs end. If not: partial Sepolia links plus local evidence, honestly labelled. |
| **03:00** | **Code freeze.** | Anything unmerged is cut. |
| 03:00-04:00 | Fixes and evidence only; real links into the docs. | **G4 04:00:** zero open P0 defects; claims audit 1. |
| 04:00-06:00 | Slides and script final; video cut from the Sepolia Playwright run; README final; demo staging (below). | **G5 06:00:** video and slides exist. If the video fails, screenshots with captions. |
| 06:00-07:00 | Your walk-through on Sepolia with your own passkey, while agents fix bugs on a branch. Faucet round for rehearsal funds. | After 07:00, only reverts. |
| 07:00-08:30 | Three timed rehearsals; a hallway test with 2-3 people; narration. L10 delivers SUBMISSION.md by 07:30. | If you are unavailable, the video replaces the walk-through. |
| 08:30-09:15 | Claims audit 2 (15 minutes); final commit and push after the secret scan; L13 builds a clean clone from the README. | — |
| **09:30 latest** | **You paste SUBMISSION.md into DoraHacks and submit.** | Deadline 10:00. |

**Demo staging (done by 06:00).** A 5-minute slot cannot show one wallet's whole story: a recovery started at about minute 1:30 can finalize only after minute 4:30. The pitch therefore uses two named wallets, and says so aloud:

1. **Wallet L (live):** a clean state for creating, funding and paying on stage. Its recovery starts at about 1:30 and finalizes during questions.
2. **Wallet S (staged):** created, funded and paid, with the links on screen. It hosts the DeFi beat. Its module-A recovery was started before the pitch, so it finalizes on stage at about 4:15.
3. **A backup wallet** already in a pending module-A state, in case Sepolia is slow.
4. **The module-B wallet,** showing its countdown to Tuesday 13 Oct.

The draft running order, which L11 writes and you approve at 00:30:

1. 0:00 — the problem: clients who want self-custody leave Swissquote (Docs/desc.md:76).
2. 0:15 — create Wallet L; its address is shown before it exists.
3. 0:45 — fund 10 USDC, with the ownership proof.
4. 1:05 — pay 6 USDC with the passkey; Etherscan link and "fee paid by Swissquote".
5. 1:30 — "phone lost": the recovery of Wallet L starts.
6. 2:00-4:15 — the trust check with the contract's refusal; the thief beat; DeFi on Wallet S; the old-phone alert ("if a thief had started this").
7. 4:15 — finalize Wallet S; the old key is refused.
8. 4:40 — business close with one sourced number.

With a slot of 7 minutes or more, everything runs on Wallet L (D3).

## 7. Sepolia runbook and funding

**State now (Verified at 18:50 UTC by read-only calls to publicnode):** block 11,886,436; gas price about 0.001 gwei (read at 18:25 UTC). TREASURY `0xB2F6…6B71`, RELAYER `0x6fc6…36f7`, SQ_ACCOUNT `0xe3C7…090e` and FUNDER `0xAD84…5d44` each hold 0 ETH and 0 USDC and have nonce 0.

**Funding need:**

- **ETH:** one faucet drip of about 0.05 ETH to TREASURY is enough. The story alone budgets 8.69 million gas (`full`) and 4.8 million (`b-pending`), measured by simulation. With browser runs, DeFi and rehearsals, expect about 30 million gas (Assumption): about 0.03 ETH at 1 gwei, and far less at tonight's price of about 0.001 gwei. If Google's faucet refuses, these faucets were listed on their own pages at about 17:20 UTC (not tried): pk910's proof-of-work faucet (no account), QuickNode (every 12 hours) and Alchemy (needs 0.001 ETH on mainnet).
  - Split it with `node scripts/sepolia-distribute.mjs --eth RELAYER=0.03,SQ_ACCOUNT=0.005,FUNDER=0.005`: dry run first, then `--send`. TREASURY keeps the rest.
  - If P1.10 is built, the partner's key gets 0.002 ETH.
- **USDC (the real constraint):** Circle's faucet gives 20 USDC per address every 2 hours (Sourced: https://faucet.circle.com/).
  - Request it for TREASURY and for SQ_ACCOUNT now, then every 2 hours while you are awake (about 22:45 and, if possible, 00:45), and at about 06:00.
  - Planned peak use, with funds swept back to TREASURY after each run: G1 smoke test 2; story wallet 10; module-B wallet 1; DeFi 3; Playwright on Sepolia 5; your walk-through 5; live demo 10; rehearsals 10.
- **MOCK bank accounts pay out real Sepolia USDC** from SQ_ACCOUNT. On Sepolia, new MOCK accounts start with 1 USDC (`MOCK_ACCOUNT_START_USDC`; 10 for the live-demo profile), and total payouts are capped per service run (L6), so retries cannot drain SQ_ACCOUNT.

**Order of operations:**

1. Check balances (`node scripts/sepolia-balances.mjs`).
2. Faucets (you).
3. Distribute ETH.
4. Merge L1 in the v3 worktree, run the gate, rebuild the tool.
5. G1 smoke test: one deploy and one payment through the services.
6. Story `full`, including the throwaway collusion wallet.
7. `b-pending` wallet.
8. Browser recovery (Playwright).
9. DeFi transactions.
10. Demo staging, your walk-through and rehearsals.
11. Evidence pack into Docs/submission/evidence/.

**Safety rules:**

- Writes need explicit opt-ins (`ALLOW_SEPOLIA_STORY=yes`, `ALLOW_SEPOLIA_WRITES=true`).
- Scripts send only from TREASURY and FUNDER; the services send only from RELAYER and SQ_ACCOUNT (and the partner from its own key, if P1.10 is built).
- The kit sweep reads the FUNDER key from its own Git-ignored file under `.sepolia-runs/`, or from a hidden prompt, never from `.env.sepolia`. The demo then shows no dependence on Swissquote's key file.
- One Sepolia run at a time, scheduled by L2 and recorded in the run log: time, run, sender, nonce range, result.
- If the relayer reports "Previous submission is uncertain", check the last transaction hash on chain with `scripts/sepolia-relayer-status.mjs` before clearing the lock.
- The service data folders hold live helper keys, so they live under `swissquote-wallet/.sepolia-runs/<run-id>/`, which Git ignores (Verified: .gitignore:25). Before every push, L0's scan compares the staged files with the actual secret values without printing them.
- Never print keys or pass them on a command line. Never send anything to the listed sanctions address.
- The services listen only on 127.0.0.1 (Verified: services/swissquote/src/main.ts:12, services/partner/src/cli.ts:5) and are reached only through the SSH tunnel. On Sepolia, `strictSponsorship` is on and `PARTNER_DEMO_FOOLED` is refused.
- Tunnel for v3: `ssh -N -L 5273:127.0.0.1:5273 -L 5274:127.0.0.1:5274 -L 4101:127.0.0.1:4101 -L 4102:127.0.0.1:4102 <vm>`. Open `http://localhost:5273` exactly, because `127.0.0.1` breaks the passkey origin.

## 8. After v3, still missing

- **A thief with the device key can still drain the wallet and win a cancel race.** The on-chain fix, for example a vault split using Safe's audited AllowanceModule, is not built.
- **The module-B 3-day recovery has never completed on a public chain.** Locally, the real 3-day module has only been started, cancelled and refused; a full card + Swissquote recovery ran only on a 120-second test copy of the module (contracts/test/t8-two-instances.test.js:118-136). P0.2 adds a local finalize with the clock moved.
- **No independent audit of our setup.** An Ackee audit of Candide v0.0.1 is listed; whether it matches the deployed bytecode is unchecked.
- **Production pieces are MOCKs:** KYC, the SECO name check, the face check, the bank account, the mailbox, the guardian-key storage, the MOCK sanctions list, and legal review.
- **A web app is trusted to hold the key.** There is no native app, no hardware-wallet owner and no reproducible-build pipeline beyond the P1.5 fingerprint.
- **EVM chains only, and recovery is per network.** For Bitcoin, only the recovery spending rule was tested, on a private test network, in a research harness that is not part of the wallet (Docs/research/bitcoin-taproot-candidate-b.md:5, :41). Solana is a design only.
- **No connection to arbitrary dApps** (no WalletConnect), no hosted demo for judges' own devices, no card-replacement flow, no relayer pool for privacy.
- **Legal positions are reasoned, not reviewed:** the sponsored relay and the Travel Rule; FINMA's view of "card + Swissquote can replace the owner"; FinSA for the DeFi relay.

Phrasing rules for slides and docs:

| Do not say | Say instead |
|---|---|
| "FINMA-compliant" | "designed against FINMA Guidance 02/2019 for the ownership proof; in our reading not custody under FINMA 01/2026, which would apply only if Swissquote held a key that can move funds; not reviewed by counsel" |
| "It never signs" | "Swissquote cannot move your money: its keys only pay fees and, together with your card, approve a recovery" |
| "Swissquote cannot move your funds" (unqualified) | "On chain, no. Off chain, you trust the app version you run; check its fingerprint" |
| "the same audited contracts" | "audited Safe contracts and the Candide recovery module v0.0.1; an Ackee audit of v0.0.1 is listed, and we have not matched it to the deployed bytecode" |
| "nobody can steal" | "a thief with your unlocked device can still spend; nobody can take over without your card" |
| "multi-chain wallet" | "live on Sepolia; same address reproducible on three more test networks" |
| "we stop sanctioned payments" | "we don't help sanctioned flows; screening applies when Swissquote pays the fee" |
| "SECO-screened" (for addresses) | "screened against OFAC/EU/UN-derived on-chain lists plus a MOCK SECO name check" |
| "savings", "interest", "approved DeFi" | "supply position, variable yield paid by the protocol"; "allow-listed for fee sponsorship after a technical check; not investment advice" |
| "what you see is what you sign" | "Swissquote re-checks the effects before paying" |
| "1.2 million Swissquote clients" | "690,828 Swissquote trading accounts (accounts, not unique clients)" |
| "if Swissquote disappears, you still get out" | "...with your emergency kit, paying a small network fee yourself" |
| "audited / production-ready" | (nothing) |
| "recovers in 3 minutes" | "180 s in the demo; days in production" |

## 9. Decisions needed from you

- **D0 — Action now: request faucet funds.** The ETH drip goes to TREASURY `0xB2F61CfeA95A87017FcdF539A0556158ed1b6B71`; Circle's 20 USDC goes to TREASURY and to SQ_ACCOUNT `0xe3C71E2a0ba81377A5E2a3C1D67279E36F75090e`. Every Sepolia step waits on this, and the next USDC round opens 2 hours after your request.
- **D1 — Approve the revised plan.** This covers three things: v3 built in a separate worktree on ports 5273/5274/4101/4102/8645, with your v2 demo untouched; real test-network transactions from the four service keys between about 23:00 and 02:30, plus staging, your walk-through and rehearsals in the morning; and a new account and passkey for v3 on `http://localhost:5273`.
  *Recommended: yes.*
- **D2 — Build the isolated guarded-wallet prototype (formerly P2.2)?** Trade-off: it gives Swissquote a co-signing role on large payments and a say in cancels, which moves toward shared control and departs from your goal that only you can transact (G1). It is also new, unaudited contract code that can lock a wallet by mistake, and transactions through modules and EIP-1271 messages bypass it, so it reduces the thief risk rather than closing it.
  *Recommended: no.* If yes: contracts test harness only; a separate demo wallet; a tested way to remove the guard; a waiting time plus a card veto as the default, with a Swissquote co-signature only speeding it up; and the wording "reduces".
- **D3 — Live demo form.** Please ask the Swissquote mentors for the judging format and the slot length.
  *Recommended:* run live on Sepolia from your laptop through the SSH tunnel, with Wallet L and Wallet S, a pending backup wallet and the video one click away. With 7 minutes or more, the whole story runs on Wallet L.
- **D4 — Your time.** Faucet requests now, every 2 hours while you are awake, and at about 06:00; a 15-minute storyline check at about 00:30; 06:00-08:30 for the walk-through, rehearsals and narration; pasting the submission by 09:30.
  *Recommended: yes.* If you miss 00:30, L11's storyline stands; if you miss the morning, the video replaces the walk-through.
- **D5 — Publishing beyond the repository.** (a) Upload the narrated video unlisted and link it from the README and the submission. *Recommended: yes.* (b) Host the offline tool on GitHub Pages. *Recommended: no;* attach the built file instead (see "Not in v3").

Open questions that do not block the start:

- the judging format and slot length (D3);
- whether the deployed Candide modules match the audited v0.0.1 commit;
- an official source for the Compound Sepolia deployment;
- whether FINMA treats a sponsored relay as a "sending institution", and whether FinSA applies to the DeFi relay;
- whether OpenSanctions, and through it RedStone, includes SECO's list;
- whether Google's faucet still pays out tonight;
- how long a full gate run takes (measured at G0);
- whether to waive the USD 15 withdrawal fee for transfers to the client's own wallet;
- whether the ownership challenge can be re-run after a recovery (P1.11).

## Sources

- **Inputs:** Docs/desc.md (the official brief text); Docs/plans/swissquote-wallet-build-plan.md (v2); Docs/plans/v3/implementation-status.md; the explore notes in AgentsLocal/46257332/v3/explore/ (judge-roi, security, dapp, sepolia, legal-business, ux, multichain, wildcards); the five critiques in AgentsLocal/46257332/v3/critique/, with their outcomes in Docs/plans/v3/critique-log.md.
- **Code checks by the reviser** (Verified by reading the working tree, 18:24-18:30 UTC):
  - packages/protocol/src/constants.ts:43-55 and packages/protocol/src/verification.ts:22, :77;
  - services/swissquote/src/policy.ts:23-47; services/swissquote/src/app.ts:34, :89, :120, :173; services/swissquote/src/chain.ts:9-24;
  - services/partner/src/service.ts:48 and services/partner/src/cli.ts:5;
  - apps/wallet/src/App.tsx:249-261 and apps/wallet/src/chain.ts:5-6; apps/recovery-tool/src/core.ts and apps/recovery-tool/index.html:2;
  - contracts/contracts/candide/modules/social_recovery/SocialRecoveryModule.sol:115, :154-187, :185, :293, :305 and contracts/test/t8-two-instances.test.js:86-101;
  - scripts/story.ts:23, :57-72; the root .gitignore:17, :25.
- **Earlier code checks by the planner** (20:00 CEST): tests/browser/harness.mjs:69-70; packages/protocol/src/abis.ts:23-34.
- **Sepolia reads** (Verified, 18:25 and 18:50 UTC, https://ethereum-sepolia-rpc.publicnode.com): eth_blockNumber, and eth_getBalance, USDC balanceOf and eth_getTransactionCount for the four service addresses.
- **External sources:**
  - Uniswap deployments https://developers.uniswap.org/deployments.json;
  - Circle EURC addresses https://developers.circle.com/stablecoins/eurc-contract-addresses and the Circle faucet https://faucet.circle.com/;
  - RedStone sanctions oracle (vendor page) https://docs.redstone.finance/docs/stage1-market-data/sanctions-oracle/;
  - Safe's Candide snapshot and audit listing https://github.com/5afe/CandideWalletContracts and https://www.npmjs.com/package/@safe-global%2Fsafe-recovery;
  - Swissquote H1 2026 release https://www.swissquote.com/en/api/internal/media/get-media?filename=press-releases/ad%20hoc_EN_Media_Release_H1_2026.pdf;
  - Swissquote Swiss crypto pricing https://www.swissquote.com/en-ch/private/trade/pricing/cryptocurrencies.
