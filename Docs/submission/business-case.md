# Business case — retain the relationship, not custody of the key

**FINAL V4 acceptance:** `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. This includes the seven added MOCK bank-return shortcut regressions (567 Node/browser + 42 contracts). It supersedes the earlier 602-test baseline below. G1 public-browser recovery separately passed across retained sessions, not one uninterrupted take. No production audit, hardware proof or publication is implied.

**Offer opt-in recovery assistance and sponsored payments to clients who want their own key, while keeping an easy route back to Swissquote trading.** Retention is the [brief's opportunity](<../desc.md#L74-L95>), not a measured result. A subscription could diversify volume-dependent income; the emergency kit deliberately permits exit rather than locking clients in. Production bank acceptance and willingness to pay remain untested.

## Company context: sourced, not freshly verified by L10

The [v3 plan's corrected source extraction](<../plans/v3/build-plan.md#L362-L368>) supplies the following numbers. L10 reused that extraction and citations; it did not independently retrieve or validate the financial PDFs. Recheck the original reports before treating these figures as final pitch evidence.

| Figure / source | Interpretation |
| --- | --- |
| 690,828 Swissquote trading accounts; [H1 2026 release](https://www.swissquote.com/en/api/internal/media/get-media?filename=press-releases/ad%20hoc_EN_Media_Release_H1_2026.pdf) | Accounts, **not unique clients**; planning base, not demonstrated addressable wallet demand |
| 1,220,818 total accounts, including 423,409 Yuh accounts; same release | Group total is not Swissquote trading clients; Yuh is excluded from base economics |
| H1 2026 net crypto income CHF 14.6m, down 66.2%; same release | Context for testing subscription income, not evidence of product demand |
| FY2025 net crypto income CHF 85.7m | Plan attributes this to FY2025 results, not H1 release; exact original report citation still required before using on a slide |
| Swiss custody charge CHF 20/quarter up to CHF 50,000, crypto included; [Swiss pricing](https://www.swissquote.com/en-ch/private/trade/pricing/cryptocurrencies) | Do not calculate lost crypto custody fees as a percentage of all assets. Moving crypto does not automatically remove the flat fee; client mix/fee-band transitions remain unknown |
| Withdrawal fees USD 15 USDC/EURC; USD 10 BTC/ETH; same pricing | Own-wallet fee waiver is an open product choice and cost, not approved or assumed revenue |

## Hypothetical retention scenario — inputs unconfirmed, not a forecast

Retention is the intended benefit, not a demonstrated outcome. Assume 10,000 clients retained because of this product, each adding CHF 10,000 annual trading volume, and an unconfirmed 0.64% income/volume ratio: CHF 100m × 0.0064 = **CHF 640,000 annual income before product costs**. No retained client, incremental volume or marginal yield has been measured. The proposed ratio comes from CHF 85.7m FY2025 crypto income ÷ CHF 13.4bn volume ≈ 0.6396%; neither original input was freshly verified by this lane, and an aggregate income/volume ratio is not a marginal commission rate. Do not call this guaranteed revenue, profit or a forecast. The plan's H1-based CHF 0.2–0.3m alternative also needs verified volume/rate inputs before use.

10,000 ÷ 690,828 ≈ 1.45% of trading accounts, not unique clients or proved wallet demand. The account base itself is a reused, unconfirmed source extraction pending original-report review. Recovery Assistance at CHF 4.90/month is hypothetical upside: 2,000 subscribers would produce CHF 117,600 gross/year before all costs; no approved tariff or paid take-up exists.

## Transparent subscription scenario — every input is an assumption except the cited account base

The heading describes the earlier arithmetic's cited base, **not fresh verification**: all financial inputs remain unconfirmed for submission until the business owner checks the original sources.

Price CHF 4.90/month implies **CHF 58.80 gross per paying account per year**. No additional trading revenue is counted. Each adopted account is assumed to be one paid subscription; duplicate-client accounts and unpaid adopters would reduce conversion. This is arithmetic, not a forecast, net revenue or profit.

| Assumed adoption of 690,828 accounts | Paid accounts, rounded | Gross subscription revenue/year, rounded |
| --- | --- | --- |
| 0.5% | 3,454 | CHF 203,103 |
| 1% | 6,908 | CHF 406,207 |
| 2% | 13,817 | CHF 812,414 |

Revenue is calculated from the unrounded account base × adoption × CHF 58.80. The plan's CHF 74.40 “net/user/year” and CHF 0.51m illustration are **not reused**: CHF 74.40 exceeds the CHF 58.80 subscription gross and needs a separately evidenced revenue bridge. Do not silently convert it into net subscription income.

## Sponsored gas: simulated illustration, not measured mainnet cost

The separate browser/service payment and supply records include effective gas prices: payment 187,685 gas × 10,000,015 wei = 1,876,852,815,275 wei; supply 371,682 gas × 10,000,015 wei = 3,716,825,575,230 wei, paid by RELAYER. These are **test-ETH fees**, not measured mainnet CHF cost. [Payment evidence](<../research/v3-live-payment-evidence.md>); [supply evidence](<../research/v3-live-compound-evidence.md>).

The older **scripted** [Sepolia receipt map](<claims.md>) records actual gas used: 1-USDC payment 199,289; 6-USDC payment 101,369; deployment 2,650,279; first A recovery start 934,747; B start 934,735; A restart 836,827; both-module cancel 162,274; A finalize 197,620; 3-USDC kit sweep 89,765; rotation 186,268. The artifact omits `effectiveGasPrice`, so actual test-ETH fees cannot be computed from it. Its preflight max fee is a cap, not paid gas price. TREASURY/FUNDER, not service RELAYER, paid these script fees.

The retained **simulated illustration** from [Plan P0.6](<../plans/v3/build-plan.md#L325-L340>) uses payment gas 101,381 and the dated market read 0.0655 gwei / ETH USD 2,506; L10 did not refresh that price. Mainnet extrapolation is neither a Sepolia fee nor a forecast. Using the actual 101,369-gas large payment at that same snapshot also rounds to USD 0.0166; the calculation below retains the plan baseline explicitly.

At that snapshot, a 101,381-gas payment is about USD 0.0166. With **assumed** 24 payments/month, payment gas is about USD 0.40/account/month. At **assumed** stress gas 20 gwei and the same ETH price, the same volume costs about USD 122/month. No USD/CHF conversion is assumed. Deployment, recovery, approvals and first-payment differences add costs; sponsorship budgets and fee caps are essential. Protective cancellation has a separate reserve/policy rather than competing with ordinary spend budgets.

Formula: receipt gas used × gas price in gwei × 0.000000001 × ETH/USD = USD cost. Receipt `gasUsed × effectiveGasPrice` is actual test-ETH spend; market-price extrapolation must be separately dated and labelled.

Fully loaded contribution must subtract gas, partner verification, support, compliance, audits, engineering/operations, acquisition, insurance/loss provision and any waived withdrawal fees. No margin, retention lift, deposit retention, capital relief or savings has been measured. A daily **request count** cap is not a CHF gas budget.

## Pilot decision

Run a capped opt-in EVM pilot only after security and counsel sign-off. Measure paid conversion and retention against a matched baseline, incremental net trading, recovery completion/false approvals, support load, kit-backup success and sponsor spend under gas stress. Proceed only if fully loaded benefit exceeds cost; “fewer withdrawals” alone does not prove profit. See [legal position](<custody-travel-rule.md>) and [draft terms](<terms-sheet.md>).
