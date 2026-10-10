# Stolen wallet seed: Swiss customer and bank legal considerations

## Bottom line

A thief's use of a customer's wallet does not automatically make the customer guilty of sanctions violations. A Swiss bank is not automatically responsible for every subsequent transfer merely because it generated the seed. Equally, calling a wallet “self-custody” does not excuse insecure bank services or failures in the bank's own sanctions controls.

The decisive distinctions are actual control of the wallet, customer authorization, the applicable prohibition, and contractual allocation of loss. Criminal liability, regulatory duties, and reimbursement are separate questions.

## Scope and limitations

This note interprets “sanctioned transactions” as transactions prohibited by sanctions, not simply transactions unauthorized by the customer. It assumes a Swiss bank and an ordinary customer who says a third party stole a sufficient spending credential. No contract, wallet implementation, transaction, counterparty, or compromise evidence was supplied.

Research reference date: 10 October 2026. Statutory versions actually reviewed include AMLA dated 1 October 2026, the Ukraine ordinance dated 20 August 2026, the Embargo Act dated 1 July 2023, and the Code of Obligations and Criminal Code dated 1 January 2025. Later changes to the latter two were not independently compared. English federal-law translations are informational; the official-language texts govern. This is a research framework, not a legal opinion on a particular incident. Swiss counsel should verify the rules and lists applicable on the transaction date.

## 1. Identify what the bank controls

**Bank-controlled custody or mandatory bank co-signature.** If a bank authorization is indispensable for a transfer, the bank has a transaction-control point. Whether it operated that control properly, complied with sanctions, and executed a valid instruction matters. A customer-facing seed might be a recovery credential rather than an unrestricted on-chain spending key; inspect the actual design.

**True self-custody.** If the customer's seed alone permits independent on-chain spending, a thief may bypass the bank's application. The bank generally cannot prevent that transfer just by disabling the account in its database. Generating or supplying the wallet is nevertheless a service whose security and contractual promises need review.

**Shared recovery or threshold arrangements.** Identify every sufficient combination of keys and recovery powers. “Bank cannot spend alone” does not answer whether it can spend with a partner, replace the owner, or prevent a transfer. A product label does not determine the legal classification.

These are technical and contractual inferences, not a complete licensing classification. FINMA's custody guidance emphasizes secure custody and appropriate supervision of custody providers. [FINMA Guidance 01/2026][custody]

## 2. Customer: criminal responsibility and practical exposure

A valid blockchain signature establishes use of a key under the network's rules; it does not by itself prove that the named customer personally authorized the transaction. Under Criminal Code Article 12, intention is the default requirement for felonies and misdemeanours unless negligence is expressly punishable. Article 25 addresses intentional assistance. A theft allegation therefore requires evidence, not automatic acceptance or automatic rejection. [Criminal Code][criminal]

Do not promise immunity merely because the customer did not intend a sanctions violation. Embargo Act Article 9(3) expressly punishes negligent commission of an Article 9 offence; Article 10(3) separately covers negligent commission of its offences. The prosecution must still establish the customer's own legally relevant conduct or omission and the elements of the applicable offence. Losing a seed is not, by itself, proof of those elements. [Embargo Act][emba]

A customer may still face verification questions, a police investigation, transaction restrictions or asset measures under the applicable legal grounds. None is itself a conviction or proof that all the customer's assets must be frozen. A transfer to a listed recipient does not automatically designate the sender. Screening findings must be connected to an actual applicable restriction. [Ukraine ordinance, especially Articles 15–16][ukraine]

**Recommended response:** notify the bank promptly; make a police report; preserve transaction hashes, addresses, timestamps, device evidence, bank notifications and the chronology of suspected compromise. Do not disclose the seed in support messages. Obtain legal advice before attempting recovery from sanctioned persons or moving assets subject to a legal freeze. Prompt notice helps contain loss and preserve evidence; it is not a retroactive legal safe harbour.

## 3. Bank: sanctions and AML duties

### Determine whether the transfer is actually prohibited

Start with the relevant Swiss ordinance and annexes, the recipient's identity and ownership/control, the service involved, and any exception or authorization. An analytics alert or foreign listing alone is not a complete Swiss-law analysis. Foreign sanctions can create additional obligations or exposure where their jurisdictional requirements are met; foreign-law applicability requires a separate analysis rather than an assumption that every foreign list is Swiss law. [Embargo Act, Articles 1–2][emba] [SECO sanctions guidance portal][seco]

The Ukraine ordinance is an example, not a universal sanctions rule: Article 1 expressly includes cryptoassets within funds; Article 15 freezes specified owned or controlled assets and prohibits making funds or economic resources available directly or indirectly to the covered persons and entities, subject to its exceptions. Article 16 establishes the associated reporting duties. Article 32 connects substantive violations to Embargo Act Article 9 and reporting violations to Article 10. Other regimes must be checked separately. [Ukraine ordinance][ukraine]

Where its services are involved, the bank must not execute a prohibited transfer. It must apply required freezes to assets within its control and comply with the relevant SECO reporting duty. A completed external-chain transfer cannot be undone merely by writing a freeze flag into the bank's systems. Conversely, technical inability to reverse an external transfer does not excuse failing to secure bank systems or apply controls at a bank-controlled transfer point.

### Treat SECO reporting and MROS reporting separately

The Anti-Money Laundering Act imposes due-diligence and organizational duties. Article 9 requires an immediate report to the Money Laundering Reporting Office Switzerland (MROS) when its conditions are met, including qualifying suspicion concerning criminal proceeds or terrorism financing. Stolen assets may engage these conditions. A sanctions match does not automatically establish every condition for a MROS report, and a SECO report does not replace a required MROS report. [AMLA, Articles 3–9][amla]

Do not apply a blanket “all suspicious transactions freeze immediately for five days” rule. For an ordinary report under Article 9(1)(a), Article 10(1) triggers its freeze when MROS notifies the intermediary that it is forwarding the information to a prosecution authority. Article 10(1bis) provides an immediate freeze for the distinct Article 9(1)(c) case. The Article 10(2) maximum of five working days concerns that interim mechanism pending the competent authority's decision; it does not expire a separate sanctions freeze or judicial seizure. Article 9a governs customer orders during MROS analysis and does not authorize independently prohibited or unauthorized transfers. [AMLA][amla]

Article 10a restricts disclosure that a MROS report was filed, subject to statutory exceptions. Plan customer communications accordingly; do not treat the rule as forbidding every factual security notification. [AMLA][amla]

### Investigate security failures and assess other notifications

Examine seed generation, delivery, storage, retained copies, access logs, recovery powers, vendors, authorization and transaction screening. Preserve evidence and document why a transfer was blocked, released, or outside the bank's control. This is an incident-response recommendation informed by custody and cyber-risk supervision, not a claim that one prescribed wallet architecture is mandatory. [FINMA custody guidance][custody] [FINMA cyber guidance][finma-cyber]

If the incident meets the relevant thresholds, consider separate reports to FINMA, the National Cyber Security Centre and the Federal Data Protection and Information Commissioner (FDPIC). FINMA guidance describes initial and detailed cyber reports and clarifies deadline calculation; NCSC reporting for qualifying critical-infrastructure attacks operates under a separate regime. FADP Article 24 requires controllers to notify the FDPIC as quickly as possible when a personal-data breach is likely to create a high risk. Theft only from a customer's private device does not automatically prove a reportable breach of the bank's systems or data processing. [FINMA cyber guidance][finma-cyber] [NCSC][ncsc] [FDPIC][fdpic]

Bank failures may lead to supervisory action and, where statutory elements are met, criminal consequences for responsible persons. Embargo Act Article 12 refers business offences to administrative criminal-law rules; do not describe every bank-control failure as automatic corporate criminal liability. [Embargo Act][emba]

## 4. Who bears the financial loss?

### Unauthorized bank debit: restoration may be the starting claim

For an ordinary unauthorized bank-account debit, Federal Supreme Court BGE 146 III 121 distinguishes the customer's claim for performance/restoration from a damages claim. Under the default allocation, bank fault need not be proved. Contractual risk-transfer terms can affect the outcome. A bank may also assert a proven damages counterclaim based on customer breach. Article 44's contributory-fault reduction does not simply apply directly to the customer's performance claim. Do not automatically transplant this account-debit doctrine to every crypto-custody product. [BGE 146 III 121, reasons 2, 3.1.2 and 4–5][judgment]

### Insecure wallet service: contractual damages may be the route

For a self-custody wallet service, Code of Obligations Article 97 is a potential basis: breach, loss and causation must be established; fault is presumed subject to exculpation. Article 398 supplies diligent-performance obligations where mandate law applies, and Article 101 concerns auxiliaries. Insecure generation, exposure during delivery or retained seed copies could support a claim if a causative breach is proved. Generation alone proves neither custody nor a compensable breach. [Code of Obligations][co]

Customer contribution can affect damages under Article 44 via Article 99(3). Contractual exclusions face limits under Articles 100–101, including the prohibition on advance exclusion of liability for intentional misconduct or gross negligence under Article 100(1). Precise application depends on the contractual relationship and the actor involved. Neither “the customer lost the seed, so the bank never pays” nor “the bank created the seed, so it always pays” is sound. [Code of Obligations][co]

## 5. Product implication

If an unrestricted seed can bypass the bank's controls, the bank should not promise that its application can prevent every prohibited on-chain transfer. If the product promises bank-enforced authorization or sanctions blocking, verify that the actual spending and recovery paths enforce that promise. This is a design inference; mandatory legal controls must still be determined for the specific service.

The highest-value next fact is: **Can the seed alone move funds outside the bank, or must the bank approve/co-sign every transfer?** After that, review the contract and compromise evidence with Swiss counsel.

## Primary sources

[emba]: https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2002/564/20230701/en/html/fedlex-data-admin-ch-eli-cc-2002-564-20230701-en-html.html
[ukraine]: https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2022/151/20260820/fr/html/fedlex-data-admin-ch-eli-cc-2022-151-20260820-fr-html.html
[amla]: https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1998/892_892_892/20261001/fr/html/fedlex-data-admin-ch-eli-cc-1998-892_892_892-20261001-fr-html.html
[criminal]: https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/54/757_781_799/20250101/en/html/fedlex-data-admin-ch-eli-cc-54-757_781_799-20250101-en-html.html
[co]: https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/27/317_321_377/20250101/fr/html/fedlex-data-admin-ch-eli-cc-27-317_321_377-20250101-fr-html.html
[judgment]: https://search.bger.ch/ext/eurospider/live/it/php/clir/http/index.php?lang=fr&type=highlight_simple_query&highlight_docid=BGE-146-III-121&regeste_lang=fre
[custody]: https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20260112-finma-aufsichtsmitteilung-01-2026.pdf
[seco]: https://www.seco.admin.ch/fr/faq-sanctions-suisse
[finma-cyber]: https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/4dokumentation/finma-aufsichtsmitteilungen/20160707-finma-aufsichtsmitteilung-03-2024.pdf
[ncsc]: https://www.ncsc.admin.ch/25-mp-en
[fdpic]: https://databreach.edoeb.admin.ch/
