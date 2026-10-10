# Earlier demo script — historical local fallback

**This is the earlier local/v2 plan, not the approved v3 running order.** L11 owns the current pitch; use the [claim ledger](<claims.md>) for its evidence boundaries. v3 public-chain transactions are separately authorised for their run owners, not for this documentation lane. Do not apply the local-only instruction at the bottom to the whole team.

**Present only rehearsed behavior.** This is a planned five-minute structure, not a record of a completed demo. Slot length is assumed. If only local execution is verified, say “local chain with pinned contract code and MOCK token”; do not say “live Sepolia.” Use the [run guide](<../../swissquote-wallet/README.md>) for setup and [evidence checklist](<IMPLEMENTATION.md>) for readiness.

## Before the stage

Use an isolated local chain, two browser profiles, a printed recovery card, a separately stored kit code, a saved kit and saved-file tool. Provision the MOCK user, partner enrollment and service keys; confirm account/token and relayer gas balances. Check passkeys on the exact demo browser/origin. Keep a backup wallet whose **actual** recovery wait already elapsed and a recording clearly labeled as recorded. Never show real secrets on the projector.

## Stage beats

| Time | Action | Say / evidence boundary |
| --- | --- | --- |
| 0:00–0:20 | State the model | “Your key signs payments. Changing it needs your card plus one helper. The two helpers together are not enough.” Qualify with verified wallet rules and app-publisher risk. |
| 0:20–1:00 | Create, make card in separate tool, check wallet | “Do not deposit until the independently obtained tool verifies these rules.” Tool independence is MOCK governance; separate localhost pages alone are not independent publishers. |
| 1:00–1:25 | MOCK account → wallet funding | “This demonstrates proposed client association and transfer policy, not bank-approved ownership or AML clearance.” Show token movement, not just a balance label. |
| 1:25–1:55 | Pay 2 USDC, then 8 USDC | Show recipient/effects and zero wallet ETH; passkey for the larger sponsored action if actually working. Without verified passkeys, label the gap; never describe password-only as the same protection. |
| 1:55–2:30 | New device; card + partner starts recovery | Show real contract countdown. Module A is 180 seconds, not the older draft's 90 seconds. Old device reads both pending modules and can cancel. |
| 2:30–3:10 | Thief with phone/email; suppose helpers fooled | Label reset/face checks MOCK. Show actual contract refusal for helper-only approvals on both modules. An `eth_call` refusal needs no public transaction; do not invent a receipt. |
| 3:10–3:40 | Explain threat model during wait | “An unlocked owner key or kit plus code can spend immediately. Helpers can refuse help; the independent kit is the escape.” |
| 3:40–4:10 | Finalize on pre-started backup wallet if needed | Say when switching wallets. Show unchanged wallet address, new owner and old-key refusal. Cancel any second pending recovery and replace the kit. |
| 4:10–4:50 | Stop wallet, Swissquote and partner; keep RPC running | Open saved-file tool, decrypt current kit privately, and run a funded, RPC-only sweep. Observe receipt and destination balance. “Services gone” is not “chain offline.” |
| 4:50–5:00 | Close | “Keep self-custody clients connected through recovery support and sponsored gas; production eligibility, security and legal review come next.” |

## Honest fallback

If screens fail, show the **actually executed** local CLI story and its command outcome; say it does not test browser/service enforcement. The CLI advances local EVM time to test delay boundaries. Do not use it as proof of three wall-clock minutes, live Sepolia, real biometrics or end-to-end passkey enforcement. If the outage sweep was not exercised with services stopped, mark that beat unverified rather than narrating success.

No live transactions or public submission are authorized by this lane. Use local fixtures only during integration.
