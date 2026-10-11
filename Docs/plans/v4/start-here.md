# V4 — use this for the judges

**Show one client story: the phone pays, the Recovery Card plus a helper restores access, and the Emergency Kit provides a key-based exit.** Keep the custom Swissquote wallet; do not introduce a Rabby/Safe fork before judging. Safe's public app is useful read-only evidence, not demonstrated independent signing.

## Present

Open the [offline deck](<../../pitch/v4/deck.html>) or [PDF](<../../pitch/v4/deck.pdf>). Keep the whole presentation folder together for HTML images and links. Use the [presenter notes](<../../pitch/v4/presenter-notes.pdf>) and print the [judge card](<../../pitch/v4/judge-card.pdf>). The deck has eight main slides and five backups; use the main story for the default five-minute slot, subject to organizer confirmation.

Tell Claire's problem first, then the three objects. Show payment evidence and the completed public recovery: same address, new owner, new payment. Explain the recovery delay rather than letting the presentation become a wait. Close with who controls funds, what is real versus MOCK, and the concrete relationship-retention opportunity. Business inputs are scenarios, not verified forecasts; regulatory classification is an argument needing counsel, not approval.

## Demonstrate safely

Use the already-rehearsed runtime for any live clicks. Do not replace it simply because this candidate passes tests. The isolated [V4 candidate](<../../../README.md>) includes payment previews, recovery timeline/countdown, explicit stop action, fail-closed custody checks, a verified-account MOCK bank-return prefill, hardened persistent launcher and a portable Recovery Desk. The shortcut does not credit a bank balance; its transfer still uses the normal payment preview/signing path.

For an isolated local rehearsal on this prepared machine, run from the candidate wallet directory:

    pnpm demo:local

It owns local ports 5273/5274/4101/4102/8645 and refuses occupied ports. This is a fresh local demo, not the retained Sepolia wallet. It does not update the existing v2 UI at 5173. No product server is left running by the verification handoff. A clean-clone installation on a fresh machine has not been rehearsed.

Never project recovery words, owner keys, passphrases or kit codes. Reviewed public screenshots and receipts are the fallback—not an uninterrupted live-demo video. If a send times out, check the existing intent/receipt before any retry. The completed G1 story needs no additional chain transaction.

## Evidence to defend

[Acceptance and six exact public receipts](<acceptance.md>) distinguish the local aggregate from Sepolia G1. G1 completed across retained browser sessions; finalization and replacement payment used normal unlock on one page. The actual chain wait was met, the old key was refused by a read-only call, and the new kit downloaded/decrypted offline with the correct current owner. That is not a kit broadcast. Older scripted cancellation/kit sweep and third-party Compound test supply are separate runs.

Identity, bank and helper checks are MOCK. WebAuthn was a Chromium virtual authenticator; physical hardware remains unproved. An accessible owner key can spend and cancel recovery. The three-day route, independent publisher governance, service-shutdown saved-file sweep and public high-value step-up remain unproved. No test aggregate is a security audit.

## Humans finish

Confirm the actual slot and presenter/driver. Rehearse on the real laptop with projector, physical authenticator and phone QR scans. Fill human team/AI attribution and submission fields. Obtain explicit approval before repository publication, upload or submission. This execution has not committed, pushed, published or submitted anything; existing v2/v3 were preserved.

[Implementation handoff](<implementation-handoff.md>) · [Submission draft](<../../../Docs/submission/SUBMISSION.md>) · [Architecture](<../../../Docs/submission/architecture.html>)
