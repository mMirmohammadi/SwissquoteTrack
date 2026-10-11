# V4 implementation handoff — public story completed, unpublished

**V4 is implemented and accepted: 609 tests passed with zero skips; G1 public-browser same-wallet recovery is completed and reconciled.** V4 implementation is isolated in the UI worktree; judge documentation is isolated in the docs worktree. The offline presentation already exists in the main checkout. No commit, push, publication, upload or submission has occurred in this execution.

## Open the presentation

- [Offline deck](<../../pitch/v4/deck.html>) · [deck PDF](<../../pitch/v4/deck.pdf>)
- [Presenter notes](<../../pitch/v4/presenter-notes.html>) · [notes PDF](<../../pitch/v4/presenter-notes.pdf>)
- [Judge card PDF](<../../pitch/v4/judge-card.pdf>)
- [Presentation usage and checks](<../../pitch/v4/README.md>)

Use Phone → Recovery Card + helper → Emergency Kit as the stable mental model. Show the client story first, contract evidence second. Lead with completed G1 browser recovery across retained sessions, not one uninterrupted take. Keep older Sepolia scripted cancellation/kit sweep and third-party Compound supply separate. Safe history demonstrates public visibility, not independent signing.

## Implementation locations

[UI source](<../../../swissquote-wallet/apps/wallet/src/App.tsx>) has payment previews, block-clock recovery countdown/timeline, explicit cancellation, fail-closed custody checks and read-only Safe history access. [Sepolia launcher](<../../../swissquote-wallet/sepolia-demo.mjs>) adds deliberate persistent run IDs, private service directories, symlink refusal and child-environment allowlists. [Recovery Desk](<../../../swissquote-wallet/apps/recovery-tool/index.html>) clarifies key export/check and same-environment artifact hashing; independent publisher governance remains unproved.

[Reconciled submission](<../../../Docs/submission/SUBMISSION.md>) reconciles real/MOCK, browser/scripted, custody, legal and business boundaries. [Architecture](<../../../Docs/submission/architecture.html>) now has source-backed recovery routes and visible publisher-governance uncertainty. Finalize, strict browser and visual gates pass; its canonical PNG was inspected. The tall layout retains disclosed route crossings.

## Verification and stopping condition

The expected full gate is 602 tests: frozen 591 + eight launcher + three UI cases. A regression previously depended on ignored scratch data; [public recorded simulation vectors](<../../../swissquote-wallet/tests/protocol/fixtures/compound-exact-recorded.json>) now live with their tests, and all 51 exact-math cases pass. The installed-browser rerun passed all 560 Node/browser cases, including local mined recovery after the actual wait. It then correctly failed on one pending mandatory contract case because the public vendored SDK build was ignored by Git. That unchanged build was restored and exempted from the ignore rule; the complete fresh gate then **passed 602 tests, zero skips**, typechecks/builds, in 417.0 seconds (`bash-1996`, exit 0). Running C8 alone with `--grep` is invalid because it shares setup with earlier cases. See [acceptance](<acceptance.md>).

**G1 PASSED (`bash-2054`, exit 0)**: create → fund → first owner payment → card+partner recovery → finalization → replacement-owner payment at the same address. [Final public artifact](<../../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json>) and [earlier partial artifact](<../../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-partial-2026-10-11.json>) preserve the exact retained-session boundary after timeouts. Finalization/new payment used the same page, normal encrypted-replacement unlock, no reload or auth injection. Actual mature-chain elapsed time is 228 seconds; no clock fake. Actual fresh-kit download/wrong-code refusal/offline decrypt/current-owner check and read-only old-key GS026/no POST passed; no kit broadcast or physical biometric proof is claimed. [Exact receipts/state](<acceptance.md>).

The C1 verified-account MOCK bank-return prefill is implemented and accepted by the final full gate `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. Its seven regressions bring the inventory to 567 Node/browser + 42 contracts. The final gate stopped its processes; V4 ports are free, existing v2 remains live and v3 stays clean. Documentation reconciliation is complete. Stop at this checked handoff; no additional on-chain writes or retries are needed. Use [start here](<start-here.md>) for presentation and safe rehearsal.

## Human-only finish

Confirm presenter/driver, actual slot, hardware passkey, projector and QR scan; fill real team AI attribution and submission fields. Publication/upload/submission require separate human approval. The demo remains a self-custody prototype with mocked identity/bank/helpers, trusted publisher/unlocked-key risks and an unsettled regulatory classification.

[Current execution status](<execution-status.md>) is the live progress record.
