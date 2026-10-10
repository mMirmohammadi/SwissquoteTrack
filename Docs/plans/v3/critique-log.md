# v3 critique log

**Result: 85 findings from five critics; 70 accepted, 15 accepted with a modified fix, 0 rejected.** All 6 blockers and all 41 majors are resolved in the plan. Five items need your decision (D1–D5 in [build-plan.md §9](build-plan.md#9-decisions-needed-from-you)), and one needs your action now (D0: faucet requests).

Reviser pass: Saturday 10 Oct 2026, 20:25–21:00 CEST (18:25–19:00 UTC).
Critiques: `AgentsLocal/46257332/v3/critique/{security, feasibility, judge-fit, legal-business, status-honesty}.md` (all five present and read in full).

## What changed in the plan because of the critiques

1. **The collusion demo no longer touches Swissquote's or the partner's real keys.** The planned `/demo/collude` endpoint would have given a card thief a helper signature that locks any wallet (SEC-B1, F13, LB-M5). The refusal is now shown on a throwaway wallet whose helper keys a script creates.
2. **v3 is built in a separate Git worktree on its own ports.** The live demo folder is never edited, and gate runs never touch the live chain (F01, F02, F04).
3. **The user's "Stop it" cancel is always paid for.** A screening outage or a used-up budget can no longer block it (LB-B1, J3, SEC-M3).
4. **Moved up to P0:** a minimum trust check ("Can Swissquote move my money?") and the copy-only fix for look-alike secrets (J2, J4).
5. **Dropped:** the guarded-wallet prototype (D2 now recommended "no"), the inheritance flow, the recovery fire drill, and the multichain warning inside the wallet (SEC-M8, SEC-M9, LB-M7, J9).
6. **Schedule:** the Sepolia story runs right after G1 (about 23:00), Sepolia runs end at 02:30, and the code freeze moves from 04:00 to 03:00 (F11, F15).
7. **Corrected claims:** "It never signs", "same audited contracts", the trust-check "No", the business base (Yuh accounts), DeFi "savings/interest", and the status document's recovery and module-B evidence (SEC-B2, LB-M1–M4, SH-1–SH-5).

## How the reviser checked

- **Verified by the reviser** (read-only, 18:24–18:30 UTC): `ps` shows the live demo served from this checkout (Vite dev servers on 5173/5174 with hot reload, Hardhat on 8545 since 15:19 local, services without file watching); the root `.gitignore` ignores service data only under `swissquote-wallet/**/data/` (`:17`) and `swissquote-wallet/.sepolia-runs/` (`:25`); module revert strings in `contracts/contracts/candide/modules/social_recovery/SocialRecoveryModule.sol:115, :140, :185, :293, :305`; `services/swissquote/src/policy.ts:23-47`; `services/swissquote/src/app.ts:34, :89, :120, :173`; `services/swissquote/src/chain.ts:9-24`; `services/partner/src/service.ts:48`; `apps/wallet/src/App.tsx:249-261`; `contracts/test/t8-two-instances.test.js:86-101`; `Docs/research/bitcoin-taproot-candidate-b.md:5, :41`; Sepolia balances of the four service addresses (all still 0 ETH, 0 USDC, nonce 0 at block 11,886,313, 18:25 UTC, and again at block 11,886,436, 18:50 UTC).
- **Not re-verified by the reviser** (taken from the critic, labelled Sourced in the plan): the Swissquote H1 2026 PDF figures (the PDF could not be fetched as text; the critic's numbers are internally consistent: 797,409 + 423,409 = 1,220,818), the RedStone and Chainalysis oracle reads, the Compound repository listing, the viem nonce-manager source lines.

## Decision table

Severity: **B** blocker, **M** major, **m** minor. Decision: **Accepted** (fix applied as proposed), **Modified** (finding accepted, different fix; reason given), **Rejected** (reason given). "Plan" means `build-plan.md`; "Status" means `implementation-status.md`.

### Security critic (security.md)

| ID | Sev | Finding | Decision | Where applied |
|---|---|---|---|---|
| SEC-B1 | B | `/demo/collude` makes real helper keys sign a recovery to a discarded owner; a card thief can reuse that signature and lock the wallet (module accepts any caller's signatures until the nonce changes) | Accepted. Endpoint deleted; collusion shown only on a throwaway wallet with script-generated helper keys; positive control; browser replays the recorded attempt via eth_call. Verified: `multiConfirmRecovery` accepts any caller (:154-187) | Plan P0.4, §2, §5 interfaces |
| SEC-B2 | B | Claims overstate evidence: "It never signs", "Card + partner: move funds No", "Swissquote alone: No", "same audited contracts", relayer "can only relay" | Accepted; wording replaced as proposed | Plan §1, P0.6, P0.9, §4 table, §8 phrasing |
| SEC-M1 | M | 32-bit device code can be brute-forced after a request swap | Modified: full checksummed address shown in groups of 4 on both screens, plus a test that any byte change alters it; no word list, because 8 words would add another look-alike word list next to the 12-word card and 24-word seed | Plan P0.3 |
| SEC-M2 | M | Links that open the card tool train users to type card words into an attacker's page | Accepted: links carry only public codes; card approval only in the user's own saved tool copy; `#request=` links dropped; drill dropped | Plan P0.3, P1.5, Not in v3 |
| SEC-M3 | M | Cancel depends on the relayer, an open app, the 20 gwei cap and the global budget | Modified: P0 = cancel exempt from screening outages, the global budget and the normal fee cap (own 100 gwei cap, per-wallet limit); P1.10 second relay path via the partner; P1.9 alerts; "days in production" stated. Second path and watcher are new service work, hence P1. Verified: `app.ts:34` keeps a global cap for protective sends | Plan P0.3, §4, P1.9, P1.10 |
| SEC-M4 | M | Owner signature on a USDC permit bypasses every relayer rule; plan invites using other wallet software | Accepted: line removed; screening/step-up described as fee rules; wallet signs no message except its own ownership proof (test); new threat-model entry | Plan P0.5, §4 |
| SEC-M5 | M | Client-sent preview hash proves only honest mistakes | Modified: relayer returns its own effects summary, which the wallet shows (P0.5); wording "Swissquote re-checks the effects before paying"; binding the passkey challenge to that summary stays P2.5, because it changes the step-up format that the 148 adversarial tests cover | Plan P0.5, P2.5 |
| SEC-M6 | M | Strict sponsorship is behind a flag; v2 default pays for any contract call | Modified: flag forced on by the Sepolia launcher, flags logged, refusal tests added. Correction: the relayer already screens the decoded recipient of USDC transfer/approve (Verified `policy.ts:37`); only unknown-contract call data is unscreened | Plan P0.5, §7 |
| SEC-M7 | M | Recovery and key replacement silently invalidate the kit | Modified: v2 already exports a new kit after recovery and replacement (Verified `App.tsx:254`, `:261`; not run); v3 adds a blocking "new kit saved" step, an old-kit warning in the tool check, and tests | Plan P0.3, P1.7; Status §6 |
| SEC-M8 | M | Inheritance conflicts with goal G6 and bypasses Swissquote's checks | Accepted: inheritance flow removed; Q&A answer only (opt-in, joint heirs) | Plan P1.8, Not in v3 |
| SEC-M9 | M | P2.2 guard is new unaudited code, can lock the wallet, does not close the gap | Accepted: not built; D2 recommendation changed to "no" | Plan Not in v3, §9 D2 |
| SEC-M10 | M | Partner "fooled" switch is global; endpoints have no login | Modified: Sepolia launcher refuses to start the partner with `PARTNER_DEMO_FOOLED`; the "both fooled" beat uses the throwaway wallet, so no per-wallet switch is needed. Verified `service.ts:48` | Plan P0.4, §7 |
| SEC-M11 | M | Sepolia helper keys could be committed and pushed | Modified: data dirs under `.sepolia-runs/<run-id>/` (accepted); pre-push scan compares staged files with the actual secret values without printing them, not a generic 64-hex pattern, because every transaction hash in the evidence files is also 64 hex characters | Plan §2, §7 |
| SEC-m1 | m | Gasless evidence needs relayer-sent transactions; module B "pending"; GS026 from a real eth_call | Accepted | Plan P0.2, P0.3, P0.6 |
| SEC-m2 | m | Code-hash pinning of proxies pins only the proxy | Accepted: pin implementation and admin slots too | Plan P0.5 rule 1 |
| SEC-m3 | m | Thin Uniswap pool; quote from the same pool | Accepted: swaps capped at 5 USDC; quote must lie in 0.80–1.00 EURC per USDC | Plan P0.5 rule 2 |
| SEC-m4 | m | Screening wording; fail-closed timeout can break the demo | Accepted: wording, cache warm-up, three mainnet nodes | Plan P0.5 screening |
| SEC-m5 | m | Address on other chains | Accepted: wallet shows Sepolia only; MOCK withdrawals only on the wallet's own chain | Plan P1.6 |
| SEC-m6 | m | Drill: card words only offline | Accepted: drill dropped | Plan Not in v3 |
| SEC-m7 | m | Sweep fee key sits next to Swissquote's keys | Accepted: separate git-ignored file under `.sepolia-runs/` or a hidden prompt | Plan P0.2, §7 |
| SEC-m8 | m | MOCK accounts pay real Sepolia USDC | Accepted: 127.0.0.1 only, 1 USDC start, payout cap | Plan §7 |
| SEC-T | — | Nine missing L13 tests | Modified: tests 1–7 adopted; test 8 becomes "launcher refuses `PARTNER_DEMO_FOOLED`"; test 9 uses exact secret values (see SEC-M11) | Plan §5 L13 |

### Feasibility critic (feasibility.md)

| ID | Sev | Finding | Decision | Where applied |
|---|---|---|---|---|
| F01 | B | v3 edits land in the live demo's folder (Vite hot reload); moving the demo would wipe its state | Accepted: move the work, not the demo. Verified with `ps` at 18:24 UTC | Plan §2, §5, D1 |
| F02 | B | Gate command ages the live chain; skipped tests still exit green | Accepted: gate script on its own chain and ports, `BROWSER_REQUIRED=1`, zero skips, port 8545 forbidden | Plan §2, §5 |
| F03 | B | No Sepolia funds; first faucet slot is now | Accepted. Verified still 0 at 18:50 UTC | Plan §6, §7, D0 |
| F04 | M | Ports are hard-coded; no lane owns the change | Accepted: L0 owns it in wave 0 | Plan §5 |
| F05 | M | One-lane-at-a-time integration is meaningless in one folder; gate time unknown | Accepted: one worktree per merge batch, 4–5 batches, gate timed at G0 | Plan §5 |
| F06 | M | G0 overloaded; freeze misses `FeatureContext` and test IDs | Accepted | Plan §5 interfaces |
| F07 | M | Four write-scope overlaps | Accepted | Plan §5 lanes table |
| F08 | M | Tool check fails on Sepolia (`fromBlock: 0n`, CSP) | Accepted. Partly applied in the working tree (Verified at 18:25 UTC: no `fromBlock` in `apps/recovery-tool/src/core.ts`; CSP lists tenderly and ethpandaops); rebuild, CSP test and G1 check still needed | Plan P0.1; Status §8 |
| F09 | M | Nonce manager skips a number after a failed send | Accepted: reset on error, queue closed until receipt, status script. Verified no `reset` in `services/swissquote/src/chain.ts` | Plan P0.1, §7 |
| F10 | M | Load-balanced nodes cause false alarms | Modified: read at the receipt block with retry and compare nodes at the same block (accepted); the pending-recovery alert fires if any node reports a recovery, because hiding a real takeover is worse than a flicker | Plan P0.1, P0.3 |
| F11 | M | Sepolia window too short and late | Accepted: story right after G1; separate slots; one sender owner (L2) with a run log | Plan §6 |
| F12 | M | P0 items depend on P1 items | Accepted: P0.3 uses v2 copy-paste codes; P0.4 no longer needs the partner lookup | Plan P0.3, P0.4 |
| F13 | M | `/demo/collude` publishes a real partner signature | Accepted; fixed by SEC-B1's design, which is stricter than "return only the revert" (an eth_call through a public node still shows the signature to that node) | Plan P0.4 |
| F14 | M | DeFi has no local test bed; "EQUAL" impossible for swaps; proxy pinning; one simulating node | Modified: fork test bed, bounds, implementation pin, simulation node list accepted; the swap stays the stage beat if the fork test passes (it is the only officially sourced deployment, J8); Compound only if it fails | Plan P0.5, §6 |
| F15 | M | Human gets the pitch too late; no time for fixes | Accepted: freeze 03:00; storyline check 00:30; bug-fix hour 06:00–07:00 | Plan §6, D4 |
| F16 | m | Finalize uses the laptop clock | Accepted | Plan P0.3 |
| F17 | m | Formatter must run first in the worktree or not at all | Accepted | Plan P0.7 |
| F18 | m | Gasless evidence must come from relayer-sent transactions | Accepted | Plan P0.6 |
| F19 | m | Test users drain SQ_ACCOUNT | Accepted | Plan §7 |
| F20 | m | Fee cap vs gas spikes | Modified: keep 20 gwei for ordinary sends (our ETH supply is one 0.05 ETH drip); cancels get a 100 gwei cap; "network busy" message replaces the 502 | Plan P0.1, P0.3, §4 |
| F21 | m | Chunk size 25,000 vs 10,000 | Accepted. Verified `constants.ts:45` | Plan P0.1 |
| F22 | m | Claims check after the last doc edit | Accepted: second check at 08:30 | Plan §6 |

### Judge-fit critic (judge-fit.md)

| ID | Sev | Finding | Decision | Where applied |
|---|---|---|---|---|
| J1 | M | No locked storyline; one wallet's story does not fit 5 minutes | Accepted: two named wallets (L live, S staged), running order adopted as L11's draft, user approves at 00:30 | Plan P0.8, §6 staging |
| J2 | M | The standout trust check can be cut | Accepted: new P0.9 (minimum), rest stays P1.1 | Plan §1, P0.9 |
| J3 | M | Fail-closed screening blocks the cancel; mainnet node on the payment path | Accepted (with LB-B1, SEC-M3) | Plan P0.3, P0.5, §4 |
| J4 | M | Cut lines drop cheap UX copy; recovery fallback never ran in a browser | Accepted: new P0.10; L12 runs v2 recovery screens in wave 1 | Plan P0.10, §6 |
| J5 | M | No owner for the submission form; silent video | Modified: SUBMISSION.md, doc rewrites, narrated video accepted; uploading the video is publishing, so it needs your OK (D5) | Plan P0.8, D5 |
| J6 | M | Gasless story lacks the cost | Accepted: dated mainnet estimate on the receipt; formulas on the business slide | Plan P0.6, P0.8 |
| J7 | m | "Approved" and "Earn" read as advice | Accepted (with LB-M2) | Plan P0.5 |
| J8 | m | Lead with Uniswap; Compound not in Compound's repository | Modified: Uniswap leads when the fork test passes (F14); Compound labelled "third-party test deployment". Sourced: critic's GitHub API check | Plan P0.5 |
| J9 | m | Multichain warning in the UI; fire drill teaches phishing | Accepted | Plan P1.6, Not in v3 |
| J10 | m | Invisible features need a README claim → evidence table | Accepted | Plan P0.8 |
| J-Bold1 | — | Judges run the trust check themselves | Modified: offline-tool trust check (P1.1) and the built file attached to the submission; hosting it on GitHub Pages not recommended, because that hosted page would also accept card words (SEC-M2) | Plan P1.1, D5 |
| J-Bold2 | — | One address, whole story (QR, prove ownership again) | Accepted as P1.11 | Plan P1.11 |
| J-Bold3 | — | Swissquote rings the alarm (MOCK mailbox) | Accepted as P1.9 | Plan P1.9 |

### Legal and business critic (legal-business.md)

| ID | Sev | Finding | Decision | Where applied |
|---|---|---|---|---|
| LB-B1 | B | Relayer can refuse the protective cancel; the wallet holds 0 ETH | Accepted: cancel always sponsored; only a positive sanctions hit on the wallet itself blocks it; test | Plan P0.3, P0.5, §4 |
| LB-M1 | M | Base counts 423,409 Yuh accounts; H1 2026 crypto income fell 66.2% to CHF 14.6 m | Accepted: base 690,828 Swissquote trading accounts; about CHF 0.51 m/year at 1% (Assumption); slump used as the subscription argument. Sourced (critic's PDF extraction) | Plan P0.8 |
| LB-M2 | M | DeFi sold as interest/savings, no risk notice | Accepted | Plan P0.5 |
| LB-M3 | M | "It never signs" is false | Accepted | Plan P0.6, §8 |
| LB-M4 | M | Trust-check "No" omits the web-app path | Accepted | Plan P0.9 |
| LB-M5 | M | Collusion endpoint hands out real signatures | Accepted via SEC-B1 | Plan P0.4 |
| LB-M6 | M | Sanctions sources stale and US-only; no client name screening | Modified: RedStone primary, Chainalysis second, Circle as "issuer freeze list", MOCK SECO name check accepted; a list older than 30 days counts as unavailable (blocks payments, never cancels); RedStone marked a vendor source | Plan P0.5 |
| LB-M7 | M | D2 hides a conflict with goal G1 | Accepted | Plan §9 D2 |
| LB-m1 | m | Aave as the refusal example; Swissquote sells AAVE | Accepted: shown as "unlisted contract" without a brand | Plan P0.5 |
| LB-m2 | m | Custody-fee loss based on a non-Swiss price | Accepted; fee waiver kept as an open question | Plan P0.8, open questions |
| LB-m3 | m | FY2025 figure cited to the wrong document | Accepted | Plan P0.8 |
| LB-m4 | m | "Designed against FINMA 01/2026" overstates it | Accepted | Plan §8 |
| LB-m5 | m | Addresses leak to public nodes; audit log is stored data | Accepted | Plan §4, P1.2 |
| LB-m6 | m | Inheritance needs all heirs | Accepted (Q&A wording; flow removed) | Plan P1.8 |
| LB-m7 | m | "Users still get out" needs a fee caveat | Accepted | Plan §8 |
| LB-m8 | m | Weak or vendor sources | Accepted | Plan P0.8 |

### Status-honesty critic (status-honesty.md)

| ID | Sev | Finding | Decision | Where applied |
|---|---|---|---|---|
| SH-1 | M | "Recovery verified locally" skips both services; the service recovery path never ran against contracts | Accepted. Verified `scripts/story.ts:23`, `:61-62`, `:71`; plan adds a local service-recovery test before Sepolia | Status §1, A5, C; Plan P0.3 |
| SH-2 | M | Module B never completed, even locally | Accepted; L2 adds a local module-B finalize step | Status A6, B7; Plan P0.2, §8 |
| SH-3 | M | "It never signs" is false | Accepted. Verified `app.ts:120`, `:173` | Plan P0.6 |
| SH-4 | M | Planned approval rule listed as an existing limit | Accepted. Verified `policy.ts:35-38` | Plan §4 |
| SH-5 | M | Status is an unmarked snapshot; lines moved | Accepted: snapshot marker and a "changes since the snapshot" section | Status header, §8 |
| SH-6 | m | Wrong source for the story result | Accepted | Status §2, §7 |
| SH-7 | m | Impossible timestamps | Accepted | Status header, §6 |
| SH-8 | m | Helper-only refusal message is known | Accepted. Verified `t8-two-instances.test.js:88`, `:100`; module `:115` | Status §6 |
| SH-9 | m | Bitcoin over- and understated | Accepted. Verified research file `:5`, `:41` | Status B6; Plan P1.6, §8 |
| SH-10 | m | Cite tests where they exist | Accepted | Status A4, A11, B1 |
| SH-11 | m | "Improved" list reads as done | Accepted | Plan §4 |
| SH-12 | m | Unsourced claims | Accepted: lane file paths added | Plan P0.1, P1.6 |

## Counts

| Critic | Findings | Accepted | Modified | Rejected |
|---|---|---|---|---|
| Security | 22 | 14 | 8 | 0 |
| Feasibility | 22 | 19 | 3 | 0 |
| Judge-fit | 13 | 10 | 3 | 0 |
| Legal and business | 16 | 15 | 1 | 0 |
| Status honesty | 12 | 12 | 0 | 0 |
| **Total** | **85** | **70** | **15** | **0** |

Blockers: 6 (SEC-B1, SEC-B2, F01, F02, F03, LB-B1), all resolved; F03 needs your faucet action (D0). Majors: 41, all resolved in the plan; three touch your decisions (F01 → D1, LB-M7/SEC-M9 → D2, J5 → D5).
