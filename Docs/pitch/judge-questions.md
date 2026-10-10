# Judge talking points — precise promises, visible limits

**The distinctive claim is card-required recovery, not “nobody can steal”.** Keep answers short; use the [public record](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) for measured results and the [claim ledger](<../submission/claims.md>) for outstanding gates. The [script](<../submission/pitch-script.md>) controls the main story.

## 1. Can Swissquote move the client's money?

Its on-chain keys are not ordinary owners of the configured wallet. Swissquote alone cannot sign an owner payment or replace the owner; neither can Swissquote plus the partner without the card. But card + Swissquote can replace the owner after the wait, and the replacement owner can spend. You also trust the app version Swissquote publishes. This is a technical control claim, not a final legal non-custody determination. [Legal assessment](<../submission/custody-travel-rule.md#L1-L9>).

## 2. Is “only the user transacts” literally true?

No unconditional human-consent guarantee. Ordinary payments need the current owner credential; assisted recovery needs the independent card and a helper, after which a new owner can pay. Under the configured rules, a user-held credential is necessary. A stolen owner credential can spend without the human's consent; a stolen card plus a fooled helper can take over. The script's treasury submits outer transactions, but owner signatures authorize Safe payments. [Threat model](<../submission/threat-model.md>).

## 3. Why 24 words and a 12-word card?

The advanced 24 words recreate the ordinary spending key. The 12-word Recovery Card is independently generated recovery authority—not half the seed or an any-two-of-three share. It cannot pay alone; either assisted route needs it. Keep phone, card, and kit file + separate kit code apart. Never enter card words in the wallet app or a page opened from a recovery link. [Responsibilities](<../submission/terms-sheet.md#L5-L9>).

## 4. What happens if the phone and email are stolen?

MOCK reset and face checks illustrate identity defenses, not real biometric security. Without an owner credential or card, helpers together fail the recorded contract checks. If the phone exposes the owner key, the thief can pay and cancel legitimate recovery immediately. Do not claim we defeat every stolen-phone attack. Service-side attacker checks still need independent evidence. [No-card recorded calls](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L175-L200>).

## 5. Does recovery really wait, and did the old key really fail?

Module A waited against public chain time: the record reports a refusal 12 seconds before maturity, then a mined finalize. Old-key refusal was a real read-only contract call returning GS026, not a mined theft transaction. Address unchanged; owner replaced. Module B's three-day path was started and cancelled, not completed publicly. [Delay and finalize evidence](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L201-L249>).

## 6. What if I do not open the app for three days?

The wait helps only if you learn of the request and get a valid cancellation mined before finalization. MOCK mailbox/alerts and any independent relay path need their own acceptance evidence. There is no promise that an offline client is protected automatically. Production monitoring and delay choices remain open. [Proposed cancellation terms](<../submission/terms-sheet.md#L11-L17>).

## 7. Can I stop a recovery? Is cancellation always free?

The recorded owner-signed batch cancelled both modules. That proves the contract action, not unconditional service payment. Protective sponsorship is intended to avoid ordinary budget/screening-outage failures, but has separate limits, fee caps, sanctions exceptions and availability dependencies. A thief with the current owner key can cancel too. [Mined cancel](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L158-L174>).

## 8. What if Swissquote or both helpers disappear?

The current kit + code can restore the owner credential for a self-funded exit without helper approval, with trustworthy software, working RPC and gas. The public script swept 3 USDC using RPC only and FUNDER-paid gas. It does not document a browser with services actively stopped, all-token support or an offline chain payment. If all owner/kit access and the card are lost, funds can be permanently inaccessible. [Kit sweep/checks](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L251-L283>).

## 9. Can I disable a stolen seed or keep using the old kit?

If you still control the wallet and act before the thief, replacing the owner retires that key on this deployed wallet. The old kit fails because it holds the old owner; save a fresh kit. Rotation cannot undo funds already stolen. Do not infer browser key-replacement acceptance from a script transaction. [Rotation and previous-owner refusal](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L284-L313>).

## 10. Is it audited or production-ready?

No independent audit of our assembled setup is claimed. We reuse Safe v1.4.1 and Candide recovery module v0.0.1; an Ackee audit is listed for that module version, but deployed-bytecode matching to its audited commit is unchecked. Guardian SQLite storage is a MOCK HSM. App publisher trust, real identity checks, operational security and independent review remain. [Plan's contract/audit qualification](<../plans/v3/build-plan.md#L20>).

## 11. Does the public run prove gasless service use or browser passkeys?

No. It records owner-authorized transactions submitted by TREASURY, wallet ETH zero at reported checks, and FUNDER-paid kit gas. Service RELAYER receipts with wallet ETH before/after are needed for that gasless claim. A “requiresPasskey” script field records classification, not WebAuthn execution. Browser/service public acceptance remains pending. [Gasless proof boundary](<../submission/claims.md#L10-L12>).

## 12. Is the DeFi feature done or safe?

Real read-only simulations exist; mined swap/supply/withdraw execution is pending. A preview is not a receipt. Proposed controls restrict sponsorship to pinned targets, simulate effects, screen and reset exact approvals; they cannot stop self-funded owner calls or remove protocol/issuer risk. Compound is a third-party test market. Not a bank deposit, not depositor-protected, not investment advice. If execution stays incomplete, omit the live beat without changing the core story. [Simulation record](<../plans/v3/build-plan.md#L246-L254>); [bonus gates](<../submission/bonus.md>).

## 13. Are sanctions and the Travel Rule solved?

No production compliance claim. Screening decides what the sponsor helps submit, not every owner transaction. MOCK SECO checks are not real SECO address screening; vendor-list coverage and freshness matter. An EIP-1271 signature proves control, not beneficial ownership or bank eligibility. Whether a sponsored third-party relay is the sending institution, and FinSA for DeFi, need counsel. [Sources and legal boundaries](<../submission/custody-travel-rule.md#L11-L29>).

## 14. What does Swissquote earn, and what are its duties?

Assumed CHF 4.90/month is CHF 58.80 gross/year before all costs, not an approved price. At assumed 1% paid adoption of 690,828 trading accounts—not unique clients—the scenario is roughly CHF 406,207 gross/year, not profit or measured demand. Gas stress, support, checks, compliance, audits and waivers must be deducted. The proposed helper/sponsorship mandate is best-efforts; termination, succession, authority and liability require counsel. [Economics](<../submission/business-case.md#L18-L42>); [draft terms](<../submission/terms-sheet.md>).

## 15. What about other networks, Bitcoin, Solana and inheritance?

This evidence story is Sepolia only; recovery changes owners per deployed wallet per network. The same address elsewhere is not synchronized recovery: old keys can remain in control on unrecovered or undeployed networks. Extra-network code-hash/address checks need their own artifact before claiming them. Bitcoin is separate private-test research, Solana is design, and inheritance is not implemented. A proposed surviving mandate does not grant heirs a card-free on-chain path. [Scope limits](<../plans/v3/build-plan.md#L670-L679>); [inheritance proposal](<../submission/terms-sheet.md#L19-L21>).
