# Swiss legal position — proposed regulated helper, not approved custody classification

**Our position: Swissquote assists recovery and pays fees; it does not hold an ordinary wallet spending key. That supports a client-controlled model, but does not settle Swiss legal classification.** The [configuration](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>) requires the card with either helper; Swissquote + partner without the card cannot meet either recovery threshold. Swissquote + card can eventually install an owner who can spend. Counsel must assess that conditional authority, app-publication risk and the complete service, not only the absence of an ordinary payment key.

## Custody and liability

[FINMA Guidance 01/2026](https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20260112-finma-aufsichtsmitteilung-01-2026.pdf?sc_lang=en) concerns custody of crypto-based assets and associated risks. Our reasoned non-custody hypothesis is **not** a FINMA determination or a legal exemption. We do not claim that capital, segregation, AML, incident-response or liability duties disappear. Swissquote publishing a malicious/compromised app could expose the owner key even where its on-chain key cannot spend.

A stolen-key signature proves credential use, not client consent. The fact that the client controls a key does not automatically allocate theft losses to the client. Negligence, agreed duties, mandatory law and incident facts matter. No counsel or bank approval has been obtained. Detailed primary-source research: [custody and proof](<../research/swiss-custody-wallet-verification.md>) and [stolen seed / liability](<../research/stolen-wallet-seed-swiss-legal-considerations.md>).

## Bank withdrawals: narrow own-wallet proposal

The proposed MOCK bank withdrawal sends only to the authenticated client's verified wallet. A purpose-limited, expiring, one-use challenge binds the wallet, network and account; [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) checks the contract's signature policy. Verification must consume the challenge atomically and retain its context. Refresh association after recovery/rotation or suspicious changes. Signature validity, beneficial ownership/KYC and transfer approval are separate outcomes.

[FINMA Guidance 02/2019](https://www.finma.ch/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20190826-finma-aufsichtsmitteilung-02-2019.pdf?sc_lang=en) applies payment-information duties to blockchain payments; required information need not be on the public chain. Its external-wallet restriction is conditional on the ability to exchange required information; it is not a universal ban on third-party wallets. Our own-wallet-only policy is a conservative demo choice, not proof of production Travel Rule compliance.

[Swissquote's published crypto help](https://www.swissquote.com/en-ch/private/help/trade/products/crypto-asset-products) includes wallet eligibility and whitelisting conditions. Neither an ownership signature nor a wallet we publish proves that Swissquote accepts this Safe/EIP-1271 method or will fund it automatically. No “no whitelisting needed” promise is made.

## Third-party payments and DeFi

For an owner-signed wallet payment, the Safe moves tokens; the relayer's externally owned account sends the outer transaction and pays gas. **Our hypothesis is that this differs from Swissquote originating a bank-account withdrawal. Whether a sponsored relay is a sending institution or another obligated intermediary is open.** No explicit FINMA sponsored-relay determination was found in the reused research. Production sponsorship must sit inside an approved AML/sanctions programme; it cannot be sold as an exemption.

DeFi is proposed as client-initiated execution-only sponsorship, not investment advice, custody or bank yield. Whether FinSA or other duties apply to this relay/listing/preview service remains for counsel. “Allow-listed” means technical fee-sponsorship eligibility, not investment suitability or official protocol endorsement. A supply position is not a bank deposit, not depositor-protected and can lose its value.

## Screening and confidentiality

Planned address screening uses OFAC/EU/UN-derived on-chain sources, issuer freeze checks and explicitly MOCK SECO client-name/list checks. Vendor coverage is not demonstrated to include every Swiss designation. Do not call addresses “SECO-screened”. Required-source outage/staleness should refuse payment/DeFi sponsorship; protective cancellation follows its separate legal and availability policy.

These are **fee rules only**. A key holder can self-fund or use an off-chain permit and bypass them. Audit records, retention, outsourced RPC visibility, client-address mappings, guardian key protection and access controls need legal/security review. Ten-year AML retention, where applicable, is not a blanket licence to store every prototype field forever. Production needs actual SECO/AML workflows, approved proof methods, privacy contracts, a complete authority assessment and [reviewed terms](<terms-sheet.md>).
