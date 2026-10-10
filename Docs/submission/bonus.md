# Bonus topics: conditional implementation claims

**Two bonus topics are targeted; neither is claimed complete by this lane.** The [brief](<../desc.md#L109-L115>) conditions bonus credit on a working create → sign → recover story. Documentation and source inspection do not meet that execution gate.

## Sponsored gas

The owner signs a Safe transaction; a separately funded Swissquote relayer submits `execTransaction` and pays native-chain gas. This is Safe relay sponsorship, **not an ERC-4337 paymaster or bundler**. A wallet can hold zero ETH while sending USDC. Locally the token is DemoUSDC, not Circle-issued USDC.

Intended abuse controls are preflight simulation, template/transaction validation, account and global budgets, gas caps and passkey step-up for large/admin calls. Cancellation must be protective and outside spend budgets. Sponsor refusal does not prevent an owner from using an independent funded submitter. A successful simulation is not a guarantee against later state changes or all malicious effects.

Evidence needed: on-chain token movement with wallet ETH balance zero before/after, receipt and funded submitter balance, and at least one real relay refusal. [Story source](<../../swissquote-wallet/scripts/story.ts>) exercises protocol-level owner signing and classification; it explicitly does not establish service passkey enforcement.

## Check before you sign / compliant dApp interaction

Targeted controls: decode transfer/approval recipients and amounts, display effects in ordinary language, screen against **MOCK** sanctions/approved-dApp lists, simulate, block unlisted unlimited approvals, and request a transaction-hash-bound passkey for large/admin sponsored actions. The demo threshold is 5 USDC; CHF conversion is **MOCK**, not a market rate or legal threshold.

This is risk assistance, not blanket compliance. List coverage, identity/ownership relationships, contract code, simulation correctness and changing chain state all limit screening. Direct owner submissions bypass app/relay policy. A production sanctions decision needs applicable regimes and legal review; see [existing research](<../research/stolen-wallet-seed-swiss-legal-considerations.md#L35-L59>).

Evidence needed: exact displayed decoded effects and simulation result; allowed request; refusal of a sanctioned decoded recipient and unlisted unlimited spender; passkey challenge bound to the same transaction; no password downgrade for large/admin. WalletConnect is a stretch integration and is not claimed live.

## Recovery-attacker beat

Also target the phone-and-email attacker from the required recovery topic: account reset and face checks are **MOCK**; helper-only contract refusal on both recovery modules is the stronger intended evidence. State the limit: an attacker with the unlocked owner key can spend now, irrespective of recovery checks. See [demo script](<demo-script.md>).
