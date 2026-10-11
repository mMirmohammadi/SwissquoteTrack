# V4 offline pitch — ready to present

Open [deck.html](<deck.html>) directly in a browser. No server, package installation or internet is required to present the deck and packaged screenshots. Keep the entire folder together when copying it to a laptop or USB drive. Public receipt links and QR destinations require internet.

## Deliverables

- [Deck HTML](<deck.html>): eight main slides followed by five concise backups.
- [Deck PDF](<deck.pdf>): 13 pages, 16:9 landscape, rendered by Chromium from the actual HTML with print CSS.
- [Judge card HTML](<judge-card.html>) and [judge card PDF](<judge-card.pdf>): two A5 portrait pages, front and back. Print actual size; test duplex orientation before making copies.
- [Presenter notes HTML](<presenter-notes.html>) and [presenter notes PDF](<presenter-notes.pdf>): notes for every slide; PDF has four A4 pages.
- [Public evidence manifest](<evidence-manifest.json>): source records, receipt links, modes and limitations.

## Presentation controls

Arrow keys, Space or Page Down advance; Left or Page Up go back. Home goes to the opening. End goes to the final backup. N toggles presenter notes; Escape closes notes. B switches between the opening and backups. Visible controls support keyboard focus. Print / PDF uses print CSS and hides controls and notes.

Main path: client problem → three objects → browser payment / Compound evidence → verified retained-session browser recovery → independent Safe visibility / historical scripted kit exit → legal position → business model → close and QR. Notes contain the spoken evidence boundaries and unavailable-media fallback.

## Verified in this lane

Final G1 update rendered at 2026-10-11T05:57:30.872Z. All 13 slides were recaptured and passed automated layout checks: 720px scroll height within a 720px design and no flagged footer-boundary overflow. Recovery slide 04, receipt backup 12 and both judge-card sides were visually inspected; slide 04 and card-back print captures were also inspected. Unchanged slides retain the prior author’s visual inspection. Both card sides have no footer overlap. Actual Chromium PDFs contain 13 deck pages, two judge-card pages and four notes pages.

Navigation, notes and backup switching passed. Local images load. No JavaScript errors or external asset requests occurred. The deck fits 1280×720, 1920×1080 and a 390px-wide browser viewport; the projected layout is designed for landscape rather than phone reading. System Arial / Helvetica fallback is used; no font download.

[Browser checks](<browser-checks.json>), [viewport checks](<viewport-checks.json>) and [QR checks](<qr-checks.json>) retain results. QR codes were generated locally without a remote API. Independent matrix parsing recovered the exact intended URLs, format bits and byte-mode payload; Reed–Solomon syndromes were zero. Chromium has no BarcodeDetector in this environment. **Physical scan on two phones remains HUMAN PENDING.** Ordinary link fallbacks are available.

## Current candidate acceptance

The isolated, uncommitted V4 candidate passed the full local gate `bash-1996`, exit 0: **602 tests, zero skips, 417.0 seconds; typechecks/builds passed**. This is the current unchanged-code result, not the **prior frozen-v3 591-test gate**. The inventory is 560 Node/browser + 42 contract tests, including 34 browser tests and local recovery with the actual 180-second wait. [Current durable acceptance](<../../plans/v4/acceptance.md>).

The deck, judge card and notes now include the completed public G1 recovery. Treat any prior frozen-v3 591-count references as historical, not current V4 acceptance. The reported local gate is distinct from the public G1 evidence.

## Evidence boundary

Older browser reports support creation, a sponsored payment and third-party Compound III supply; those older runs did not test recovery or kit opening. Their scripted recovery, cardless-helper read-only checks, and three-day start/cancel are historical evidence, separate from the completed G1 browser recovery below. G1 did not run the three-day route or Compound.

The kit exit was a scripted key-based transfer of 3 USDC using RPC only, with a separate test account paying gas. It was not a live service-shutdown drill. Safe’s read-only screenshot proves visibility and interoperability, **not independent signing in Safe’s UI**. The historical kit key was later rotated and should not be described as the current owner.

Browser recovery verified on Sepolia · resumed across retained browser sessions. Public G1 finalize PASS `bash2054` is supported by [public finalize source](<../../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json>) and [earlier public partial source](<../../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-partial-2026-10-11.json>). Same wallet `0x9BAE9f8b97262d95c3834Dea2E74BA520d686E5c`: create, fund 2 USDC, old owner pays 1 USDC, card + partner starts module A, actual chain wait, finalize, replacement owner pays 1 USDC. This was **not an uninterrupted take**. Start 1791697812; eligibility 1791697992; mature common block 1791698040; finalized 1791698064. The 180-second delay plus 15-second buffer used the actual clock, with no manipulation. Old key refused with GS026 in read-only eth_call, no broadcast. Actual new kit download refused a wrong code, decrypted offline and matched the independently checked current replacement owner. **Kit owner check is not kit-broadcast exit.** Identity, bank and helper checks are MOCK; Chromium WebAuthn is virtual, hardware pending. Exact finalize/new-payment receipt URLs and both source paths are in the [manifest](<evidence-manifest.json>). Keep older Compound, P0, scripted recovery and kit-exit receipts separate.

No creation clip, Compound preview screenshot or demo video is packaged. Return to the evidence slides if live media is unavailable; never promise a missing recording.

The business slide uses a formula, not the unconfirmed CHF 640k scenario. No FINMA approval, audited composition, hardware fingerprint proof or universal thief immunity is claimed.

## Human inputs still needed

Confirm team names, presenter / driver, current slot and rehearsal choice. Supply the permitted public repository URL and team-wide AI-tool disclosure. G1 public-browser recovery evidence is now verified; confirm hardware passkey rehearsal before adding hardware claims; the current local count is 602, not the historical 591. Supply actual creation / recovery media or Compound preview image if desired, then revalidate the deck. Scan both QR codes with two phones and test the projector and judge-card print.

Do not project Recovery Card words, owner keys or Emergency Kit codes. The older overnight timeline is expired; this package does not restart the stack or stage wallets.

## Source inspection and scope

The original deck author recorded reading the communication protocol, track background, V4 planning documents and older public evidence, and visually inspecting the Safe screenshots. This finalize updater read the full communication protocol and only the two named public G1 JSON sources plus pitch/render assets. Neither pitch pass edited runtime/worktrees, launched wallet services, sent blockchain transactions or published externally.

## Finalize update scope

This update read only the two named public G1 JSON records and pitch/render assets; no private files, codes, state or video were inspected. Only this pitch folder and the author’s scratch folder were modified. No runtime changes, service launch, blockchain/network transactions or external publication. Author scratch: the original author’s ignored local scratch (not packaged). Rendering uses the existing Playwright browser and temporary library path with an owned HOME.
