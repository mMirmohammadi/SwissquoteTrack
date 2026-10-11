# Swissquote Wallet — visual pitch

Visual-first revision: short headlines replace explanatory paragraphs; wallet illustrations and simple diagrams carry the story. Technical detail remains in the speaker notes and Q&A backups. The main slides retain the four-phase structure and the original speaking script.

Seven main slides, planned for **4:50**, with two Q&A-only backups. Includes the user-facing actions and underlying implementation. Human timing is not yet measured. Do not add an unrehearsed live demo on top of this script.

Open [pitch.html](<pitch.html>) offline in a modern browser: arrows or Space to advance, N for notes, B for Q&A, visible Full screen button for projection. [pitch.pdf](<pitch.pdf>) contains only the main slides. [speaker-notes.pdf](<speaker-notes.pdf>) and [speaker-notes.html](<speaker-notes.html>) include the timed script, deeper explanations and evidence links. The HTML is editable text; no external fonts or image assets are required.

Sections: generation/authentication; send/receive and EVM/Solana sponsorship; separate recovery keys and owner replacement; lost device versus leaked owner key. A final slide summarizes proof and proposed pilot value. Q&A covers exact cryptography, chain-address rules and emergency exit.

Claims reflect inspected V4 source and [existing acceptance](<../../plans/v4/acceptance.md>), not newly executed wallet tests. EVM Safe relaying is implemented; Solana is proposed. The user’s seed is not split between helpers. Recovery replaces the owner of the existing Safe; it does not restore stolen funds. Live-source screening is not legal clearance. Current passkeys authenticate login/step-up, not seed decryption. Banking/identity/vault protection remain mocks.

The earlier [simple deck](<../simple/pitch.html>) is retained unchanged. No runtime files, contracts or public transactions were modified for this revision.

Validation passed: all nine HTML slides fit without overflow; next/back, notes, main-deck stop and Q&A return work; the stage fits desktop and mobile viewports; no JavaScript errors or external assets were requested. The PDF has seven main-slide pages; the speaker-notes PDF has five pages. All slide screenshots were visually reviewed. Detailed checks are in [validation.json](<validation.json>).

The spoken script contains 559 words for a planned 4:50 delivery; actual timing still needs a human rehearsal. Rehearse on the actual projector and never reveal secret words or codes.
