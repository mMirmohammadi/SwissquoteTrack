# Swiss crypto custody and wallet-control verification

Research date: 10 October 2026. Scope: Swiss regulatory expectations, published Swissquote Switzerland transfer policy, and technically credible design implications. This is research for product design, not a legal opinion, FINMA approval, or confirmation of a hackathon judging requirement.

## The answer in plain English

A credible solution must answer two different questions: **who can move the assets**, and **what evidence allows the bank to associate an external address with an identified customer and approve a transfer**. A wallet signature helps with the second question, but does not settle legal ownership, beneficial ownership, exclusive access, source of funds, or the custody model.

For example, a person with a stolen seed can produce a valid signature. The signature is genuine evidence of access; it is not evidence that the person is entitled to the assets. Equally, proving control of a withdrawal address does not prove that a bank's custody infrastructure can safely return customers' assets after a failure.

The strongest demo claim is therefore: **we demonstrate control of a specific address, bind that evidence to an authenticated customer, and keep it separate from the bank's identity, beneficial-owner and transfer-approval decisions**. Do not claim that a signature makes a wallet “Swiss compliant.” [FINMA payments guidance][1] [AMLA arts. 3–7][4] [SIWE specification][8]

## 1. Custody: explain actual powers, not product labels

### What the sources establish

FINMA applies financial-market law in a technology-neutral way. Calling an arrangement “decentralised,” “MPC,” or “non-custodial” does not itself decide which obligations apply. FINMA's staking guidance provides a concrete example: where customers retain exclusive control of withdrawal keys, non-custodial staking involves no custody or acceptance of assets by third parties. Where a provider retains withdrawal keys, the analysis is different. This is a staking-specific example, not a complete classification rule for every wallet service. [1] [3] (§2.2)

For custody of cryptobased payment tokens, FINMA explains these important distinctions:

- Collective custody with clearly identified customer shares requires banking-law authorisation; a FinTech licence can be sufficient where tokens are held in readiness at all times.
- Individual custody of payment tokens held in readiness at all times does not require a banking licence on that basis, but such custodians remain AMLA financial intermediaries and must join a self-regulatory organisation for AML supervision.
- Off-balance-sheet treatment as custody assets depends on readiness for the customer at all times; collective custody also needs clear customer allocations, for example through an internal register enabling segregation and return in bankruptcy. [3] (§3.1)

These are not blanket exemptions: the token type, other business activities, custody structure and applicable law still matter. An internal per-customer database does not automatically turn an omnibus blockchain wallet into “individual custody.”

The FinTech licence is not simply a small-bank licence. FINMA describes a model allowing public deposits up to CHF 100 million or cryptobased assets, without investing them or paying interest. It warns that client assets are neither privileged nor covered by deposit protection in the institution's bankruptcy. Do not confuse deposit protection with the separate question of whether particular crypto custody assets meet segregation conditions. [5]

### Bankruptcy protection is a separate design requirement

Swiss legislation introduced crypto segregation provisions through the DLT reforms: Article 242a of the Debt Enforcement and Bankruptcy Act and Articles 16 no. 1bis and 37d of the Banking Act. FINMA's guidance explains how readiness and identifiable customer allocations matter. This protects qualifying custody assets from being treated like the custodian's own assets in bankruptcy; it does not insure against hacking, missing keys, market losses, or every failure to return assets. [2] (§§1 and 3.1) [3] (§3.1)

FINMA's January 2026 custody guidance adds a crucial warning: **AML supervision alone is not equivalent to prudential custody supervision**. Prudential supervision concerns matters such as institutional safety and risk management. For individual portfolio management, the normal expectation is custody with an appropriately prudentially supervised institution, suitable infrastructure and expertise, and bankruptcy segregability. Foreign custody needs equivalent supervision and bankruptcy protection. The guidance allows narrowly described exceptions for existing arrangements, subject cumulatively to documented risk disclosure, information about suitable alternatives, and written client consent. It is not a general permission to pick any SRO member as a bank-grade custodian. [2] (§3.2)

For a Swiss bank's segregable custody assets, the usual capital-treatment exemption for delegation abroad is likewise conditioned on prudential supervision of the foreign custodian and foreign-law bankruptcy protection. A foreign licence alone is not enough. [2] (§3.1)

### What a technically credible proposal should show — recommendation

Draw the complete authority structure. State which sufficient combinations can sign a transfer, change signers, recover access, upgrade a contract, or bypass transaction policy. Include the customer, bank, key-service vendor and recovery actors. A bank unable to spend alone may still have meaningful authority through a bank-plus-vendor combination or recovery path; classify the whole arrangement rather than one key share.

Also identify where customer assets are held, how allocations reconcile to on-chain holdings, whether assets are lent or staked, and how the authorised operator could return them after a provider failure. Explain key protection, access separation, approval controls, incident handling, recovery and reconciliation without presenting these recommendations as a statutory checklist.

If the customer has a complete, independently usable seed, a database “freeze” at the bank cannot stop that customer from spending directly on-chain. If the demo instead uses a controlled contract, say precisely which transfer paths the contract controls and which administrator or upgrade paths remain.

Do not add staking or lending casually: FINMA's staking guidance discusses uncertainty around readiness where lock-up periods or slashing affect return of assets. Its published supervisory treatment is more specific than “staked assets are always safe” or “staking always destroys segregation.” [3] (§§3.2–4)

## 2. External wallets: why Switzerland asks for technical evidence

### FINMA's requirement

FINMA Guidance 02/2019 applies Article 10 AMLO-FINMA to blockchain payments. Required sender and beneficiary information can travel through other communication channels; it does **not** have to be written to a public blockchain. FINMA states that Article 10 does not create an exception for unregulated wallet providers. [1] (pp. 2–3)

The guidance then states a conditional rule: **as long as a supervised institution cannot send and receive the required payment information**, external-wallet transfers are permitted to and from its own customers' wallets, with ownership proven through suitable technical means. Transfers to or from third-party wallets require first verifying the third party's identity, establishing the beneficial owner and technically proving that party's wallet ownership as for a client relationship. Exchanges involving an external wallet also require suitable technical proof; otherwise the payment rules apply. [1] (p. 3)

Two boundaries matter:

- The guidance's statement that no reliable information-exchange system existed describes the situation in August 2019. It must not be repeated as a fact about today's market.
- This is not a universal ban on third-party transfers and not a demand to collect every customer's seed. It is a regulated-institution rule with explicit conditions. A bank's own policy may be stricter. [1]

The guidance uses “ownership” in its requirement. In implementation, name the cryptographic result more narrowly: **address-control evidence**. That is what the mechanism can actually establish; associating it with the legally and economically relevant person needs the other evidence and review.

### Keep the evidence categories separate

AMLA requires identity verification, identification of the beneficial owner with circumstance-appropriate diligence, renewed checks when doubts arise, clarification of purpose/background and heightened risks, and records that allow an expert to assess the relationship and transactions. Article 7 provides a ten-year retention period after the relationship ends or the transaction completes. These are not replaced by signing a message. [4] (arts. 3–7)

Keep separate records and outcomes for:

- the identified customer and, where applicable, their authority to represent an organisation;
- beneficial-owner information and the customer declaration supporting it;
- the exact address, chain/network, wallet type and control proof;
- source-of-funds and transaction-risk findings, including applicable sanctions review;
- the bank's final policy decision, allowed use, review conditions and revocation.

A blockchain risk score is contextual transaction evidence, not proof of the human owner's identity. A screenshot or a transaction hash can support a bank's process, but neither is interchangeable with a signature proving control of a self-hosted address.

## 3. Swissquote: published policy versus unconfirmed integration

Swissquote's Switzerland FAQ and crypto-wallet product page publish a concrete operational policy:

- Withdrawals require adding an external address to the address whitelist.
- Deposits are allowed from approved exchanges or a wallet for which the customer is the sole owner of the private key associated with the public address(es).
- Approved-exchange deposits require additional confirmation, specifically transaction screenshots.
- Withdrawals to cryptocurrency exchanges are currently not supported; Swissquote warns attempts could result in loss of funds.
- The supported asset/network table controls transfer eligibility. Supporting Ethereum does not imply support for arbitrary Ethereum L2s or every token carrying the same ticker. [6] [7]

The FAQ names Bitpanda, Bitstamp, Coinbase, Gemini, Kraken and Revolut as approved exchanges, but directs users to the platform list. Treat this as a changeable published list, not a permanent contractual guarantee. [6]

**Not established by the public sources:** Swissquote acceptance of SIWE/EIP-4361, EIP-191, EIP-1271, BIP-322, AOPP, or a Satoshi test; exact proof challenge; confirmation count; whitelist activation delay; proof refresh schedule; signature API; and eligibility of multisig or contract wallets. Public silence does not establish rejection. Its sole-private-key-owner wording makes multisig/contract-wallet eligibility a particularly important question even when a proof is technically valid. [6] [7]

Therefore, describe a hackathon prototype as a **proposed verification adapter and policy workflow**, not a confirmed Swissquote production integration. Confirm accepted wallet types, networks and proof methods with the sponsor before promising interoperability.

## 4. Which technical proof is credible?

### Ethereum: a message challenge, not a transfer approval

For a conventional externally owned account (EOA), EIP-191's message prefix separates a message signature from an ordinary Ethereum transaction. Verify the correct encoding/hash and recover the signer matching the claimed address. **EIP-191 alone does not provide replay protection.** [9]

EIP-4361, Sign-In with Ethereum (SIWE), supplies a structured challenge with domain, address, URI, version, chain ID, nonce and issued-at fields, and optional expiration. The verifier must check the message grammar and expected field values as well as the signature. Wallets must check the requesting origin. SIWE is an authentication standard, not a legal ownership certificate or a bank-transfer authorisation standard. [8]

**Recommended demo:** use a server-issued SIWE-style challenge narrowly worded to demonstrate address control. Bind the challenge to the authenticated customer/session and intended operation; use a cryptographically random one-use nonce, exact chain and address, verifier origin/URI and a short expiry. Use sufficient nonce entropy, not merely the specification's minimum character count. Validate on the server and atomically consume the nonce so concurrent requests cannot reuse it. Do not put customer identity documents in the message.

A challenge should plainly say it does not authorise an asset transfer. Never request a seed, private key or recovery backup, and never ask the user to sign an opaque transaction or token approval disguised as verification.

### Contract and multisig wallets need a different verifier

An Ethereum contract address is not normally verified by recovering an EOA signer and comparing it to the contract address. EIP-1271 uses `isValidSignature(bytes32,bytes)` and the success value `0x1626ba7e`. A contract can accept signatures using multisig, roles, or state-dependent policy. Resolve the contract on the specified chain and retain the chain/block context used for verification. [10] [8]

This proves acceptance under the contract's signature policy, not possession of one exclusive key or unrestricted spending power. Signature policy may differ from transfer policy; validity may change after signer rotation or contract-state changes. Undeployed/counterfactual wallets need additional, explicitly scoped support. Do not silently treat unsupported wallets as verified. Bank eligibility remains a separate decision.

### Bitcoin: verify the actual address script

BIP-322 defines message proofs using virtual transactions that cannot be broadcast as real spends. It supports script-based verification rather than assuming one Ethereum-like address-recovery method. Full proofs cover broader script types than simple proofs; unsupported cases can be inconclusive. [11]

Test actual wallet/verifier interoperability. The currently fetched specification identifies itself as version 2.0.0 and includes `smp`, `ful` and `pof` formats; older wallet implementations may differ. A valid proof is about the challenged script/address at verification time. It does not prove every address in a wallet, complete asset holdings, beneficial ownership, or who sent an earlier deposit. [11] [12]

### Microtransactions: useful only with precise service instructions

A small transfer, sometimes called a Satoshi test, can demonstrate spending authority, but only if the test ties the spend to the intended address or output and checks the service's exact destination, amount, deadline and confirmation requirements. Bitcoin coin selection matters: spending another address's UTXO does not prove control of the address under review. Receiving dust or merely quoting a transaction ID is not proof of spending authority. [12]

The test costs fees, moves value, needs spendable funds and creates a public transaction. Do not broadcast one without explicit user authorisation and the recipient service's instructions. This is a technical option, **not an established Swissquote method**.

## 5. Smallest credible demo and its acceptance evidence

Recommendation: demonstrate one supported Ethereum EOA flow, with honest boundaries rather than nominal support for every chain.

1. Start with a mock or already-authenticated customer. Label mocked identity and compliance checks clearly.
2. Select the exact supported network/address and obtain a separate customer declaration about wallet use and beneficial ownership. A declaration is an assertion to review, not a cryptographic fact.
3. Issue and verify the scoped message challenge server-side. Never request wallet secrets.
4. Show separate states: `control proof valid`, `customer association reviewed`, and `transfer policy approved`. Do not collapse them into `owner verified`.
5. Retain the exact message, signature, method/version, address/network, challenge identifier, verification time, verification result and policy decision. Contract support would additionally retain chain/block context. Restrict access and do not publish the customer-to-address mapping or KYC information on-chain.
6. Permit only explicitly supported transfer paths. Require risk-based review after relevant changes, and show failed/unsupported proofs without creating a whitelist entry.

Demonstrate rejection of a wrong signer, wrong domain, wrong chain, altered message, expired challenge and reused nonce; test simultaneous nonce reuse. Show a contract wallet as unsupported unless its adapter is actually implemented. Show that a successful control proof still leaves a mocked AML/policy review pending. These are recommended demo tests, not evidence that the bank or FINMA has accepted the implementation.

For production, obtain bank-approved proof methods and wallet policy, a legal assessment of the full custody/recovery arrangement, and security review of verification, transaction approval, data handling and recovery. No universal re-verification interval or mandatory cryptographic algorithm was established by the sources reviewed.

## Suggested wording for the proposal

> Our design addresses Swiss crypto-custody and external-wallet verification considerations by documenting spending and recovery authority, separating customer-asset allocation from operational keys, and producing auditable address-control evidence linked to an identified customer. Control proof does not replace beneficial-owner, source-of-funds, sanctions or transfer-policy review. The prototype supports a defined wallet/network scope; production proof acceptance and custody classification remain subject to Swissquote confirmation and legal review.

## Evidence and limits

The research prioritised FINMA guidance, official Swiss legislation, Swissquote's own Switzerland pages and original signature specifications. FINMA PDFs were downloaded from the official URLs and read through local text extraction because the web reader did not decode PDF content. Text extraction omits embedded chart images; conclusions above rely on readable explanatory sections, not inferred diagram contents. Technical-spec and Swissquote evidence was independently researched by a bounded subagent and integrated here.

The AMLA citation is the official French consolidation effective 1 October 2026. FINMA's payments guidance is dated 2019 and its staking guidance 2023; historical statements are identified as such. Current bank-platform behaviour was not tested through an authenticated account. This note does not establish an exhaustive legislation-update audit, contractual allocation of losses, an API integration, or the official track brief. Swiss requirements should not be substituted with EU MiCA requirements simply because FINMA discusses foreign custody regimes.

## Primary sources

[1]: https://www.finma.ch/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20190826-finma-aufsichtsmitteilung-02-2019.pdf?sc_lang=en
[2]: https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20260112-finma-aufsichtsmitteilung-01-2026.pdf?sc_lang=en
[3]: https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20231220-finma-aufsichtsmitteilung-08-2023.pdf?sc_lang=en
[4]: https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1998/892_892_892/20261001/fr/html/fedlex-data-admin-ch-eli-cc-1998-892_892_892-20261001-fr-html.html
[5]: https://www.finma.ch/en/authorisation/fintech/fintech-bewilligung/
[6]: https://www.swissquote.com/en-ch/private/help/trade/products/crypto-asset-products
[7]: https://www.swissquote.com/en-ch/private/trade/products/cryptocurrencies/wallet
[8]: https://eips.ethereum.org/EIPS/eip-4361
[9]: https://eips.ethereum.org/EIPS/eip-191
[10]: https://eips.ethereum.org/EIPS/eip-1271
[11]: https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki
[12]: https://support.bitbox.swiss/en_US/kontrolle-bitcoin-adresse-bitbox-nachweisen

- [FINMA 02/2019 — Payments on the blockchain][1], especially pp. 2–3.
- [FINMA 01/2026 — Custody of cryptobased assets][2], especially §§2, 3.1 and 3.2.
- [FINMA 08/2023 — Staking][3], especially §§2.2, 3.1–3.2 and 4.
- [AMLA / LBA — official French text, effective 1 October 2026][4], arts. 3–7.
- [FINMA — FinTech licence][5].
- [Swissquote Switzerland — Crypto-asset FAQ][6] and [wallet/transfer product page][7].
- [EIP-4361 — Sign-In with Ethereum][8]; [EIP-191 — Signed Data Standard][9]; [EIP-1271 — Standard Signature Validation Method for Contracts][10].
- [Bitcoin BIP-322 — Generic Signed Message Format][11].
- [BitBox — proving control of a Bitcoin address][12], first-party implementation guidance, not Swissquote policy.
