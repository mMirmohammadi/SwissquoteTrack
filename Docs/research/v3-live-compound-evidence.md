# Live Sepolia Compound supply — bounded run8 evidence

**One real browser/service-sponsored 1-USDC supply passed on Sepolia (`bash-1782`, exit 0).** The primary source is the complete, versioned [public run8 artifact](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json>). This is a **third-party Compound III test deployment, not an official Compound Sepolia market**. It supersedes the current-state claim that no live supply executed, not the historical run7 refusal or the remaining withdrawal/swap/recovery limits.

## Exact supply and sponsorship

The [supply receipt](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L56-L69>) records success at wallet `0x9C26a4432f7E34f158560efB842c5EF9b2677B51`, chain 11155111, block **11887754**. Transaction `0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af` used **371682 gas** at **10000015 wei** per gas, costing **3716825575230 wei**. The actual sender/sponsor is the expected service RELAYER `0x6fc61dce369786cfbf43536478c4cd521b4336f7`. The [explorer link](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af) is navigation, not a fresh independent query by this documentation task.

The [execution checks](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L163-L177>) record Safe ExecutionSuccess for exact Safe transaction hash `0x09716dcff90d9c5237674d3d7e3603f07b9e12eee83455b7335c90dab650d7b4`, absence of ExecutionFailure, exact Transfer, approvals `1000000` then `0`, and sponsor equality. The [canonical batch check](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L71-L80>) identifies the signed approve(1000000) → supply(1000000) → approve(0) batch, risk acknowledgement, real UI preview and strict service checks. Run8 was reported to pass fresh pre-send re-simulation; the public artifact summarizes these checks rather than preserving every internal request or simulation trace. No mining-time guarantee follows.

## Receipt-block state and rounding

All token/position values below are integer base units; USDC uses six decimals. The [before state](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L102-L114>) is at block 11887753; the [after state](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L154-L177>) was checked at the receipt block on two agreeing public nodes.

| Read | Before | After |
| --- | --- | --- |
| Wallet USDC | 1000000 | 0 |
| Compound position | 0 | 999998 |
| Borrow | 0 | 0 |
| Allowance | 0 | 0 |
| Safe nonce | 0 | 1 |
| Owner ETH | 0 | 0 |
| Wallet ETH | 0 | 0 |

**The verified position credit is 999998, not the nominal 1000000 supply.** The recorded difference is **−2 base units**. The artifact explicitly attributes actual before/receipt-block credit to Compound rounding and elapsed-block accrual; it does not assert nominal position equality. [Raw Compound logs](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L134-L153>) record supply amount `0x0f4240` (1000000) and mint/credit `0x0f423e` (999998). Exact canonical checks were retained; no normalized effects hash, tolerance increase or automatic drift retry is claimed. Historical [run7 rounding refusal](<v3-compound-rounding-refusal.md>) remains a refusal, not a failed transaction receipt or a run8 success.

## Separate deployment, funding and browser checks

These are three separate receipts, not three DeFi executions:

| Kind | Transaction | Block / gas / actual cost | Sponsor |
| --- | --- | --- | --- |
| Wallet deployment | `0x54c2afb559c83a6080b0b9c2777684fe63d5199a788f7343c5f922539058e152` | 11887751 / 2650279 / 26502829754185 wei | RELAYER `0x6fc61dce369786cfbf43536478c4cd521b4336f7` |
| MOCK-account test-token funding | `0x62c83f9d3ae760333d0d6df2eb5c9a85c72cb02e376962c3782303700226d0d5` | 11887753 / 151779 / 1517792276685 wei | MOCK account sender `0xe3c71e2a0ba81377a5e2a3c1d67279e36f75090e` |
| Compound supply | `0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af` | 11887754 / 371682 / 3716825575230 wei | Expected service RELAYER |

The [receipt source](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L27-L70>) distinguishes these senders. Funding is an actual test-token transfer, **not a real bank payout**.

The [browser checks](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L71-L96>) record separate-context offline card generation, service-verified virtual WebAuthn, deterministic wallet/initializer/current-owner/card verification by the actual independent tool, and encrypted device/passphrase/card retention before funding. The served tool SHA-256 is `acd5075dd079ec558c0ad55108cc15d3c13aafe2696d6ea1d5aafceed6c25510`; this is a recorded build fingerprint, not independent publisher certification or clean-build reproducibility. No card words or owner seed are included in the public evidence.

The [preview and screening source](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json#L115-L129>) records preview block 11887753, effects hash `0x6417d8eeae5a343b6280c0f859509eb1305b05e774d361e469cb4777084153de`, three summaries and one warning. Required live sanctions and issuer freeze checks were clear at **2026-10-10T23:14:06.835Z**; secondary Chainalysis was limited, with one warning. Identity remained MOCK. Preserve that timestamp rather than inferring execution time from the artifact filename.

## Gate, provenance and remaining limits

The parent reports the exact-math full gate **591 passed, zero skips**, typechecks/builds passed (`bash-1746`, exit 0), committed/pushed at `1863acf`; see [Compound acceptance](<../plans/v3/compound-acceptance.md>). It also reports a secret scan of **397 files, zero hits**. These are attributed parent results, not checks rerun by this documentation task. The parent owns final scan, commit and acceptance/goal completion for these documentation changes.

This proves one small live supply and executed allowance reset, not withdrawal, swap, all DeFi paths, full source/build audit, production safety or legal compliance. The two agreeing public nodes are not independent-operator certification. WebAuthn used a Chromium virtual authenticator; bank/identity are MOCK. The market has no cash value or deposit protection and retains smart-contract loss risk; this is not investment advice. Recovery and emergency kit exit were not tested in run8. Earlier [P0 live payment](<v3-live-payment-evidence.md>), the historical [23-record/11-transaction script](<../submission/claims.md#L36-L66>) and bounded local recovery remain separate evidence and must not be merged into one public browser story.

**Review boundary:** this task read the full public artifact and existing owned documents offline, then changed only this report, [implementation status](<../plans/v3/implementation-status.md>) and [claim ledger](<../submission/claims.md>). No Git, code/test execution or edits, secrets, runtime changes, network/API calls, broadcast, publishing or external action occurred.
