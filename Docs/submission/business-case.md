# Business case: keep self-custody clients connected

**Offer clients their own payment key without forcing them to abandon their Swissquote relationship.** The [challenge brief](<../desc.md#L72-L95>) frames this retention opportunity. The wallet keeps a proposed verified path between the client's bank account and wallet, while providing assisted recovery and a service-independent exit kit. Production bank acceptance of the wallet/proof is unconfirmed; retention is a hypothesis, not measured impact.

Swissquote could earn incremental trading revenue when clients return to buy/sell, and optionally charge for recovery support. Approved-dApp distribution is a later option, not shipped revenue. Value to clients is gas sponsorship and assisted recovery without giving the two helpers a card-free takeover path. The kit also reduces dependence on Swissquote; it is an honest exit, not a lock-in mechanism.

## Illustrative annual economics — every input is an assumption

No reported customer-count, pricing or crypto-income figures are reused from the review draft. Avoiding those figures avoids implying they have been freshly verified.

| Assumed input | Illustration |
| --- | --- |
| Active adopters | 10,000 |
| Incremental annual trading per adopter | CHF 2,000 |
| Illustrative effective revenue rate, not Swissquote's tariff | 0.5% |
| Paid support adoption and price | 20% at CHF 3/month |
| Sponsored transactions | 24 per adopter/year at CHF 0.10 each |

This produces CHF 100,000 illustrative trading revenue and CHF 72,000 support revenue, minus CHF 24,000 sponsored gas: **CHF 148,000 before every other cost**. This is arithmetic, not a forecast or profit estimate. It excludes partner verification, engineering, audits, operations, support, compliance, legal advice, loss/fraud provision, insurance and acquisition costs. Gas cost is volatile; no token/fiat rate is forecast.

## Pilot decision

Start with a capped opt-in EVM pilot only after legal and security gates. Compare retention and incremental net trading against a matched baseline, and track recovery completion, false approvals, support cost, sponsor spend, and kit backup success. Set per-client/global sponsor budgets without blocking protective cancellation. The offer works only if incremental benefit exceeds fully loaded cost; fewer withdrawals alone is not enough.

No claim is made that client-key control eliminates segregation, insurance, capital or bank-service liability. See [custody note](<custody-travel-rule.md>) and [threat model](<threat-model.md>). Bitcoin and Solana are roadmap work, not current product adoption assumptions.
