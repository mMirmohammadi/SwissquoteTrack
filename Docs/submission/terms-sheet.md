# Recovery assistance — proposed terms sheet

**FINAL V4 acceptance:** `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. This includes the seven added MOCK bank-return shortcut regressions (567 Node/browser + 42 contracts). It supersedes the earlier 602-test baseline below. G1 public-browser recovery separately passed across retained sessions, not one uninterrupted take. No production audit, hardware proof or publication is implied.

**Design proposal for counsel, not an executed contract, a Swissquote offer or legal advice.** The service is best-efforts recovery assistance and fee sponsorship for a client-controlled wallet. No contractual rights, production price or service-level guarantee are created by this prototype.

## Authority and client responsibilities

The client holds the ordinary spending key. Every assisted recovery requires the client's Recovery Card **and** one helper. Swissquote has no card-free recovery route and must not receive card words, owner seed or kit code. Card possession is not proof that the holder is the client; helper verification remains essential. Losing all owner/kit access and the card can permanently lose access to funds.

The client keeps three things: phone (encrypted owner key and separate device passphrase; optional login passkey, required for owner-signed large/admin sponsorship, not assisted recovery/finalization), 12-word Recovery Card, and Emergency Kit file plus separate kit code. The 24-word seed is advanced owner material, not the Recovery Card. After owner replacement, save the new kit: the old kit no longer controls the wallet. Use a trusted saved tool, verify the full new-owner address and monitor both modules.

## Best efforts, cancellation and service withdrawal

Recovery is not guaranteed. Demo module A waits 180 seconds; module B waits three days. Production periods are not agreed. The owner can cancel during the wait; a thief holding the owner key can cancel too. Cancellation requires timely awareness, working chain/RPC, a valid signature and mined submission. Protective sponsorship has dedicated limits and exceptions; no unconditional “always paid” or reimbursement promise is made.

Proposed mandate: continue assistance after the client's death, subject to lawful authority, verification and mandatory duties. [Swiss Code of Obligations](https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en), **Art. 405**, permits a contrary agreement to the default termination on death/loss of capacity/bankruptcy; it does not itself implement inheritance or grant heirs unilateral wallet control. Counsel must draft the survival clause and conflict procedure.

Under **Art. 404**, either party may revoke/terminate the mandate at any time; termination at an inopportune time can entail damages. A proposed Swissquote step-down should include notice and safe transition where lawful, not an assurance that all liability vanishes. Bank departure does not by itself alter the on-chain module: de-enrolment/key handling needs a tested transition. The partner route still requires card + an available cooperating partner; the current kit still needs its code, trustworthy tooling, RPC and self-funded gas. Neither route is guaranteed solely by a contract clause.

## Inheritance: not implemented

A future opt-in might name heirs and require joint heir action or an executor, plus verified succession documents. [Swiss Civil Code](https://www.fedlex.admin.ch/eli/cc/24/233_245_233/en), **Art. 559** (certificate of inheritance) and **Art. 602** (community/joint rights of heirs), are proposed legal starting points, not a tested product flow. No heir registry, certificate check, executor flow or card-free inheritance exists. The build plan marks Art. 602 as not fetched; these provisions need primary-text/counsel confirmation before drafting binding terms.

## Fees, compliance, privacy and losses

CHF 4.90/month is a business assumption, not an approved tariff. Sponsored fees are bounded and may be refused; independent owner submissions pay their own gas. DeFi is client-initiated, not a bank deposit, not depositor-protected and not investment advice; token, contract, liquidity and issuer-freeze risks remain.

Real AML/KYC/sanctions review, data roles/retention and complaints/incident procedures must replace the MOCKs before a pilot. Contract language cannot automatically shift every stolen-key loss to the client or exclude mandatory liability. Counsel must approve authority, service scope, termination, succession, fees, loss allocation and regulatory classification together. See [legal position](<custody-travel-rule.md>), [threat model](<threat-model.md>) and [business case](<business-case.md>).
