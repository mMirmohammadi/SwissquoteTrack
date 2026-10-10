# Submission lane — documentation checkpoint

**Submission packet and run guide implemented within assigned scope.** No application/API exports, commits, pushes, installs, lockfile/root-config edits or live Sepolia transactions. Concurrent reviewer documents were preserved.

## Files and interfaces

Published [interface hints](<INTERFACES.md>) first. Deliverables: [index](<README.md>), [run guide](<../../swissquote-wallet/README.md>), [threat model](<threat-model.md>), [custody / Travel Rule](<custody-travel-rule.md>), [business case](<business-case.md>), [bonus topics](<bonus.md>), [AI tools](<ai-tools.md>), [demo script](<demo-script.md>), [architecture evidence map](<architecture.md>), [architecture HTML](<architecture.html>), [candidate](<architecture.candidate.json>) and [documentation checker](<check-docs.mjs>). Archify emitted artifact/finalize/browser receipt sidecars in this directory. No package exports or endpoints were added.

Required communication protocol, agent instructions, build plan and swarm contract were read. Skills loaded: research and archify. Existing legal research and actual manifests/source informed the packet. No reported business figures were included: all economics inputs are assumptions and the arithmetic is separately checked.

## Checks actually performed

- Source/manifests inspected for root commands, supervisor, local fixtures/story, current-owner kit sweep, service startup and portable tool build. This is not runtime testing.
- Archify CLI path was initially incorrect: `MODULE_NOT_FOUND`, exit 1. Located the installed skill CLI and reran it.
- `node <installed-archify-cli> finalize architecture Docs/submission/architecture.candidate.json Docs/submission/architecture.html --quality showcase --json`: showcase validation, deliver and strict artifact check **passed**. Overall exit **2**, browser check **skipped** with `viewer/chrome-unavailable`: “Chrome or Chromium is unavailable. Set ARCHIFY_CHROME to its executable path.” No browser evidence or visual inspection. [Summary receipt](<architecture.finalize-summary.json>).
- `node Docs/submission/check-docs.mjs`: **passed**; 11 documents, 63 local links, assumed-economics arithmetic, diagram endpoint integrity, and documented root-script availability. This command reads files only and performs no dependency installation or application build.
- `git diff --check -- Docs/submission swissquote-wallet/README.md`: no reported whitespace errors. These new files are untracked, so this is not a substitute for the explicit document checker or a full tracked-diff review. Scoped status showed new submission files and the new run README.

## Integration gaps / blockers

Documentation itself is not blocked. Architecture browser validation is unavailable without Chrome/Chromium; the HTML exists but is not browser-validated. The lead must reconcile [security](<review-security.md>), [browser](<review-browser.md>) and [integration](<review-integration.md>) reports, which may change concurrently.

No wallet runtime, whole-system chain story, browser/passkey flow, saved-file tool flow or outage sweep was run by this lane. No live testnet evidence was observed or claimed. Do not promote source-visible implementation to passed acceptance gates.

Run-guide integration findings: Swissquote runtime reads `ENABLE_MOCK`, `PORT`, and relayer/account keys; the example has blank keys and uses `SQ_PORT`. A missing relayer key disables its chain adapter. Local story keys/enrollment are distinct from browser service provisioning. Local RPC aliases are not independent providers. Root provisioning, funding and command outcomes remain lead-owned.

## Acceptance evidence still required from the lead

Record exact command results and network for wallet creation, owner-signed token payment with wallet zero ETH, genuine recovery delay and premature-finalize refusal, old-key refusal, both-module cancellation, card-free helper refusal on both contracts, replacement kit after owner change, and kit sweep with app/bank/partner services stopped but RPC available. Verify same-hash passkey step-up for large/admin and no password downgrade. Verify independent tool / saved-file operation and honest MOCK labels. Legal bank acceptance and production custody/Travel Rule classification remain unconfirmed.

Stop condition for this lane: packet written, internal links/economics/root script availability checked, diagram generated with actual gate status recorded, and this handoff returned. It does not require pretending the application is complete.
