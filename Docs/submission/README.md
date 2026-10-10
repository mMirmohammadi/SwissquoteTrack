# Swissquote Wallet submission

**Client-controlled payments, card-required recovery, and an independent exit kit.** The prototype proposes a Safe with one owner and two recovery routes: card + partner, or card + Swissquote. Neither helper alone, nor the two helpers together without the card, should replace the owner under the verified rules.

The lead's [final integrated verification](<../plans/swarm-final-verification.md>) records passing real local-contract stories, all integrated tests, and actual browser create/fund/small/large-payment flows. It does **not** attest to live Sepolia execution, a complete browser recovery/rotation journey, or a human demo-laptop rehearsal. [Implementation evidence](<IMPLEMENTATION.md>) separates checks performed by this lane from checks the lead must supply.

## Judge-facing material

- [Run guide](<../../swissquote-wallet/README.md>) — commands, prerequisite gaps, real/MOCK boundaries.
- [Authority and threat model](<threat-model.md>) — who can spend, recover, steal, or lock the client out.
- [Architecture and evidence map](<architecture.md>) — component relationships and real/MOCK status; [interactive diagram](<architecture.html>) is a design view, not a runtime attestation.
- [Custody and Travel Rule](<custody-travel-rule.md>) — narrow technical proof, separate legal/policy decisions.
- [Business case](<business-case.md>) — retention hypothesis and explicitly assumed unit economics.
- [Bonus topics](<bonus.md>) — sponsored gas and check-before-signing controls; credit conditional on core execution.
- [Demo script](<demo-script.md>) — honest local fallback and outage beat.
- [AI tools](<ai-tools.md>) — verified tool use and limits.

## Evidence still needed for a final submission

The integration owner must record exact command outcomes and chain/network: create → sign/send → recover, genuine recovery delay, old-key refusal, both-module cancellation, no-card refusal, and kit sweep with wallet/bank/partner services stopped. Independently check saved-file tool behavior and the demo laptop's passkey flow. If Sepolia was not run, present local execution as local; never label it live testnet.

Existing independent reports are owned by their reviewers: [security](<review-security.md>), [browser](<review-browser.md>), [integration](<review-integration.md>). They may be revised concurrently; the lead must reconcile their latest findings before declaring readiness.

## Claims deliberately excluded

No claim of mathematical impossibility, formal verification, production HSM protection, real biometric identity verification, bank-approved contract-wallet eligibility, legal ownership from a signature, blanket sanctions prevention, or legal non-custody classification. The app-publisher risk and independent gas bypass remain explicit.
