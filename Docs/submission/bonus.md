# Bonuses — two bounded live sponsorship paths

**FINAL V4 acceptance:** `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. This includes the seven added MOCK bank-return shortcut regressions (567 Node/browser + 42 contracts). It supersedes the earlier 602-test baseline below. G1 public-browser recovery separately passed across retained sessions, not one uninterrupted take. No production audit, hardware proof or publication is implied.

**The Swissquote service paid gas for a browser 1-USDC payment and one browser 1-USDC supply on Sepolia.** Wallet and owner ETH were zero in both recorded runs. G1 now completes public browser recovery across retained sessions; older cancellation and kit-sweep receipts remain separate SCRIPTED runs. No withdrawal, swap, full three-day recovery or public-browser large/admin step-up is confirmed. The [brief](<../desc.md#L109-L115>) makes bonus credit conditional on the core story; these records do not independently decide judging credit.

## Gasless: real service sender, not a paymaster

The owner signs the Safe transaction; the funded service RELAYER submits and pays native gas. This is Safe sponsorship, not ERC-4337.

| Run | Receipt | Measured gas cost |
| --- | --- | --- |
| Small payment, 1 USDC | [0xe318…c77e](https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e) | 187,685 gas; 1,876,852,815,275 wei |
| Compound III supply, 1 USDC | [0xa449…94af](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af) | 371,682 gas; 3,716,825,575,230 wei |

Both report RELAYER `0x6fc61dce369786cfbf43536478c4cd521b4336f7`, exact Safe execution/Transfer checks and zero owner/wallet ETH. [Payment record](<../../swissquote-wallet/evidence/sepolia/browser-service-2026-10-11.json>); [supply record](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json>). These are inspected artifacts, not new RPC queries by this lane. The older scripted story used TREASURY/FUNDER and is not service sponsorship proof.

Policy includes session/account eligibility, pinned wallet checks, pre-send simulation, request/fee caps, strict call eligibility, zero refund fields and exact-hash passkey for large/admin calls. Protective cancellation has separate policy/caps; positive hits, uncertainty, insufficient funds, congestion and outages still limit it. Owner-funded sends bypass these fee rules. [Gas arithmetic and stress](<business-case.md>).

## DeFi: one third-party test supply, not investment approval

The second wallet `0x9C26a4432f7E34f158560efB842c5EF9b2677B51` executed approve 1,000,000 base units → supply → approve zero in one signed batch. Receipt-block allowance and borrow were zero; position was **999,998**, the verified two-unit rounding credit, not exactly one nominal USDC. [Exact public evidence](<../research/v3-live-compound-evidence.md>).

The market is a **third-party Compound III Sepolia test deployment**, not an official Compound market. Preview, strict screening, code/proxy/config pins and fresh simulation were exercised in this bounded run. No withdrawal or Uniswap swap was mined. Earlier `EFFECTS_MISMATCH` refusals are history, not the current supply status. Code consistency checks are not a deployed-source/build audit or a mining-time guarantee.

Live RedStone OFAC/EU/UN-derived oracle and Circle issuer-blacklist reads are real; secondary Chainalysis is known-old with a warning. Demo sanctions entries and SECO client-name checks are MOCK. Clear reads do not establish legal clearance or complete coverage. “Allow-listed” means technical fee eligibility, not suitability, investment advice or protocol endorsement. **Not a bank deposit. Not covered by depositor protection. Smart-contract risk: you can lose this amount. Swissquote does not advise on this.** [Legal position](<custody-travel-rule.md>).

## Recovery attacker and gate boundary

[Scripted Sepolia checks](<claims.md>) refused partner+Swissquote without card by read-only calls on both separate modules; card+helper starts were mined positive controls. A MOCK face-check refusal in the app is not a contract refusal. An unlocked owner key still spends immediately, and card+fooled helper can take over after the wait.

**CURRENT V4 acceptance:** the uncommitted isolated candidate passed `bash-1996`, exit 0, **602 tests, zero skips, 417.0 seconds**, typecheck/build passed: [durable acceptance](<../plans/v4/acceptance.md>). Its 34 browser tests include local real-180-second recovery. The [historical frozen-v3 591-test gate](<../plans/v3/compound-acceptance.md>) remains separate; v3 is clean at `cb7297a`. No production security audit or acceptance of further proposed UI is asserted. **G1 public-browser recovery PASSED:** the same wallet completed creation, payment, card+partner recovery and replacement-owner payment across encrypted retained browser sessions after timeouts—not one uninterrupted take. Finalization/new payment used normal unlock on one page; virtual WebAuthn and MOCK identity remain limits. See [completed evidence](<claims.md#g1-public-browser-recovery--completed-across-retained-sessions>). [Threats and remaining gates](<threat-model.md>).
