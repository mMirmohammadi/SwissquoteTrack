# Custody and Travel Rule proposal

**We demonstrate address control, not legal ownership or regulatory approval.** The design aims for client-controlled spending: Swissquote cannot sign an ordinary Safe payment, and the two helpers cannot replace the owner without the card under the verified rules. Calling that “self-custody” does not establish its legal classification.

## Custody: inspect every power

The current owner can spend independently, rotate owners and alter wallet rules. Card + one helper can acquire owner control after a delay. Swissquote also publishes the wallet application, which could expose an unlocked key if compromised. Counsel must assess the complete spending/recovery/service arrangement, not just whether the bank holds an ordinary spending key.

[FINMA's custody guidance](https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20260112-finma-aufsichtsmitteilung-01-2026.pdf?sc_lang=en) distinguishes supervision and custody protections. We do not infer that this prototype avoids banking, AML, segregation, security, liability or contractual duties. No production legal opinion was obtained.

## Proposed customer-wallet link

The client signs a narrowly worded, non-transfer challenge; the service checks the Safe's [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) signature policy on the stated chain. Bind a server-issued, one-use nonce to the authenticated client, exact wallet/network, purpose and expiry. Consume it atomically and retain verification context. These are acceptance requirements; a source-visible proof helper alone does not demonstrate complete anti-replay or customer-association enforcement.

Keep distinct outcomes: address-control proof valid; customer/beneficial-owner review complete; transfer approved. A stolen seed produces a valid signature too. A successful proof does not establish exclusive access, beneficial ownership, source of funds, sanctions eligibility, or customer consent. After owner recovery/rotation or suspicious changes, refresh association under a risk-based bank policy rather than relying forever on an old proof.

## Bank-account transfers versus independent wallet payments

[FINMA 02/2019](https://www.finma.ch/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20190826-finma-aufsichtsmitteilung-02-2019.pdf?sc_lang=en) applies payment-information duties to blockchain payments; the information need not be on the public chain. Its external-wallet rule is conditional on the institution's ability to exchange required information. It is neither a blanket ban on third parties nor proof that today's information-exchange systems do not exist.

The prototype's **MOCK Swissquote account** permits proposed own-wallet withdrawals after verification and blocks unknown destinations pending policy review. That is a demonstration policy, not a production Travel Rule integration or automatic legal clearance. [Swissquote's published policy](https://www.swissquote.com/en-ch/private/help/trade/products/crypto-asset-products) includes whitelisting and wallet eligibility conditions. Public sources do not establish its acceptance of this Safe, EIP-1271, the prototype proof, or automatic funding. Obtain sponsor confirmation before promising “no whitelisting needed.”

When the owner signs a wallet-to-third-party transfer and another account submits it, the technical sender is the Safe. **Whether Swissquote is a sending institution or otherwise an obligated intermediary for its relay/service remains a legal question.** Our hypothesis that gas sponsorship is different from custody is not a legal exemption. Bank-controlled account withdrawals remain a separate service with their own duties.

## Sanctions and theft

MOCK list checks and passkey requirements affect the app/sponsored relay. A holder of the owner key can pay gas directly, bypassing them. Therefore this wallet cannot promise to prevent every prohibited external transfer. A signature also does not prove that a customer authorized a stolen-key transaction; duties and loss allocation require incident facts and contracts, not labels.

Underlying research, primary citations and limits: [Swiss custody / verification](<../research/swiss-custody-wallet-verification.md>) and [stolen seed / Swiss legal considerations](<../research/stolen-wallet-seed-swiss-legal-considerations.md>). These notes are design research, not legal advice. Production needs approved proof methods/wallet eligibility, actual AML/beneficial-owner and sanctions workflows, records/privacy controls, complete authority review and security assessment.
