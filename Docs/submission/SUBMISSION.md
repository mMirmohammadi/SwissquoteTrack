# Swissquote Wallet — your key, a card-required way back

**FINAL V4 acceptance:** `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. This includes the seven added MOCK bank-return shortcut regressions (567 Node/browser + 42 contracts). It supersedes the earlier 602-test baseline below. G1 public-browser recovery separately passed across retained sessions, not one uninterrupted take. No production audit, hardware proof or publication is implied.

**Clients keep their payment key in the wallet app. A Recovery Card plus one helper can replace it after a wait; an Emergency Kit lets the client export/check the key independently.** Swissquote holds no ordinary spending key. This prototype is built on a one-owner Safe with two separate recovery modules.

## CURRENT V4 acceptance

The isolated, **uncommitted V4 candidate** passed the complete local gate `bash-1996`, exit 0: **602 passed, zero skipped, 417.0 seconds**, typecheck/build passed. Inventory: 560 Node/browser + 42 contracts; 34 browser tests include local recovery with a real 180-second wait. **G1 public-browser recovery now PASSED (`bash-2054`, exit 0): create → fund → first payment → card+partner recovery → replacement-owner payment at the same wallet address.** It completed across encrypted retained browser sessions after harness timeouts, not one uninterrupted take. [Current acceptance](<../../../../Docs/plans/v4/acceptance.md>) and [exact public G1 evidence](<claims.md#g1-public-browser-recovery--completed-across-retained-sessions>). Frozen v3 stays clean at `cb7297a`. The C1 shortcut is included in the final 609-test gate above.

## Demo story and evidence

Claire is a fictional client; all public transactions below use Sepolia test funds. G1 is one same-wallet browser story across retained sessions. Older payment, Compound supply, scripted cancellation and kit sweep are separate runs.

| Demonstrated step | Where it ran | Proof and limit |
| --- | --- | --- |
| Create and verify the wallet; pay 1 USDC with zero ETH | Public Sepolia, browser and services | [Payment evidence](<../research/v3-live-payment-evidence.md>); [payment receipt](https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e). Actual Swissquote service RELAYER paid gas; wallet and owner held 0 ETH |
| Supply 1 USDC after preview and screening | Public Sepolia, browser and services, **second wallet** | [Supply receipt](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af); [record](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json>). Third-party Compound III test deployment, not an official market. No withdrawal or swap |
| Lost device: card + partner, real wait, replacement owner at the same address; pay again | **Public Sepolia browser/services, G1 retained sessions** | [Finalize receipt](https://sepolia.etherscan.io/tx/0x2de7323c1e8de99119cd2ba651794e90e252c3c0729961bd8d7132485c62fa5e); [new-owner 1-USDC payment](https://sepolia.etherscan.io/tx/0xaf43a7e72b8f8f951fef5d68b73700525416e1581f25c44e81edc2de3053976a). Actual 228-second chain maturity exceeds the 180-second delay plus 15-second safety margin; no clock manipulation. Old-key `GS026` was actual read-only refusal, no POST |
| Owner stops both recovery routes | Sepolia SCRIPTED | [Cancellation receipt](https://sepolia.etherscan.io/tx/0x4bbdd6bd0b25a2981e7f7f6fa4dc2b9c9fe75b6b5252e543f930fe1838980681) |
| Both helpers without the card are refused | Sepolia SCRIPTED, read-only | [Recorded refusals](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L176-L201>); no transaction sent |
| Recovered kit moves the remaining 3 USDC without helper-service calls | Sepolia SCRIPTED, RPC-only | [Sweep receipt](https://sepolia.etherscan.io/tx/0xbc661bfd7f78d65385f7f7bcb4bcc6231205312e6a3e510401b34b8268e9110c). A separate FUNDER paid gas; **the Recovery Desk did not broadcast this sweep** |

The [historical frozen-v3 gate](<../plans/v3/compound-acceptance.md>) passed **591 tests, zero skips**, with typechecks/builds. Current candidate acceptance is V4 above; this documentation lane records the lead's gate result, not an independent runtime rerun or fresh chain query. G1 completion is recorded in the [public final artifact](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json>); its earlier partial artifact preserves the timeout chronology.

Reviewed secret-masked captures: [old key refused](<../../swissquote-wallet/evidence/sepolia/v4-05-old-key-refused.png>), [replacement payment confirmed](<../../swissquote-wallet/evidence/sepolia/v4-06-new-owner-payment.png>), [kit owner verified](<../../swissquote-wallet/evidence/sepolia/v4-independent-kit-current-owner.png>). The first two retain an earlier poll's recovery banner; use the receipts/final state—not that stale banner—to establish completion. No continuous video is claimed.

## Custody and threats

The [wallet rules](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>) put **card + partner** on module A and **card + Swissquote** on module B. Both helpers together without the card cannot satisfy either intended rule. The card is required for assisted recovery, **not for ordinary spending**.

An attacker with the unlocked owner key, or current kit plus code, can spend immediately and cancel legitimate recovery. Card + a fooled helper can install a new owner after the wait unless a cancellation is mined. A malicious app publisher could copy the unlocked key. Losing all owner/kit access and the card can permanently lock out the client; helpers and outages can deny assistance or sponsorship. These are material trade-offs, not a guarantee against custody, theft or loss. [Threat model](<threat-model.md>).

## Architecture, authentication and recovery

[Real-versus-MOCK architecture](<architecture.md>). The browser generates and encrypts the owner key locally. The separate Recovery Desk signs with card words and opens/exports/checks kits; APIs receive public context and signatures, not the secret words. Helpers have separate processes and storage.

Login uses email/password or an optional passkey; it does not unlock the encrypted owner key. Above 5 USDC and for owner-signed admin transactions (including owner-initiated key rotation), sponsorship requires a passkey bound to the exact transaction hash. Assisted card/helper recovery and its finalization do not require that owner passkey. This is a **sponsorship rule**, not an on-chain spending limit. Public runs used virtual Chromium WebAuthn, not physical biometric evidence.

Module A waits 180 seconds in this demo; module B waits three days. Production waits are undecided. Public-browser module-A recovery is completed. Public three-day module-B completion, large/admin public-browser step-up, service-shutdown exit and broader asset sweep are not confirmed. EIP-1271 proves wallet control for the MOCK bank association, not beneficial ownership or bank acceptance.

## Legal position

We argue for client-controlled software and fee sponsorship rather than ordinary key custody: the client key signs payments, and a client-held card is required for assisted replacement. This supports an argument, **not a legal verdict**. Swissquote, a regulated bank, is a proposed recovery helper and fee payer; conditional card+Swissquote takeover and app publication require assessment.

Our relay position is that the client authorizes the exact payee/amount and the relay pays/submits that signed transaction. FINMA may nonetheless classify the complete service as an obligated intermediary; a proposed fallback is sponsorship only to verified recipients, subject to legal approval. Own-wallet bank withdrawals and third-party wallet sponsorship are separate questions. [Primary sources and limits](<custody-travel-rule.md>); [draft terms](<terms-sheet.md>). No regulatory approval, production Travel Rule integration or inheritance flow is claimed.

## Business value — hypothetical retention scenario

The product tests whether convenient self-custody retains a Swissquote trading relationship. **Assume**, without measured evidence, 10,000 retained paying/trading clients × CHF 10,000 annual incremental trading volume × an **unconfirmed** 0.64% income/volume ratio: about CHF 640,000 annual income before product costs. That ratio is not an established marginal commission rate; this is not a forecast or guaranteed revenue. A CHF 4.90/month recovery subscription is additional hypothetical upside, not an approved price. [Inputs, alternative subscription arithmetic and gas stress](<business-case.md>).

## Bonuses and MOCK boundary

Gasless sponsorship is proven on two bounded public service paths: the small payment and the single supply. The supply batch approved exactly 1,000,000 USDC base units, supplied, then reset approval to zero; receipt-block allowance was zero. Position credit was 999,998 units under the verified rounding model, not nominal equality. No withdrawal/swap or investment approval is established.

Live public sanctions-oracle and USDC blacklist reads are real; demo sanctions entries, bank account/funding provenance, KYC, face/video checks, mailbox and SQLite helper-key vaults are **MOCK**. Test-token funding can be a real mined transaction while its bank-account origin is simulated. Screening controls fee eligibility, not owner-funded transfers. DeFi is not a bank deposit, not depositor-protected, and can lose value. [Bonus evidence](<bonus.md>).

## Human-owned submission fields

Video URL, screenshots, public repository/diagram URLs, repository visibility and each human's AI-tool disclosure remain **PENDING — human confirmation required**. [AI disclosure](<ai-tools.md>) records this lane's DSH/gpt-6.1-sol and Archify use without inventing a team roster. This pack is prepared for review in v4-docs, not applied to v3, committed, published, uploaded or submitted.
