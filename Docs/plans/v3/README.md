# v3 plan documents

**Status: implementation exists; aggregate acceptance is not yet passed.** Recovery-kit persistence, strict DeFi, trust/tool checks and partner privacy are implemented. The [recorded full Sepolia story](<../../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) succeeded with 23 records including 11 mined transactions and a real 180-second module-A wait. It uses TREASURY for ordinary sends and FUNDER for kit-sweep gas, not the Swissquote service RELAYER or browser.

v3 takes the v2 demo onto Sepolia, adds browser recovery and the compliant-dApp bonus, and prepares the judge pack. The planned deadline is Sunday 11 Oct 2026, 10:00 CEST.

## Files

- **[Build plan](<build-plan.md>):** approved scope, architecture/security changes, gates, cut lines and decisions; a plan is not execution evidence.
- **[Implementation snapshot](<implementation-status.md>):** historical pre-v3 baseline and recorded changes, not current aggregate acceptance.
- **[Critique log](<critique-log.md>):** reviewer findings and decisions.
- **[Integration notes](<integration-notes.md>):** current interfaces and evidence boundary; **[claim ledger](<../../submission/claims.md>)** maps the public artifact and remaining acceptance gaps.
- **[This index](<README.md>):** concise evidence reconciliation. The lead owns plan integration; independent verification is recorded in the [L13 result](<../../../AgentsLocal/46257332/v3/results/L13.md>).

## Current evidence boundary

The [L13 follow-up](<../../../AgentsLocal/46257332/v3/results/L13.md#L7-L27>) supersedes the historical pre-fix result of 21 discovered, 19 pass, 2 fail, 0 skip: after fixes, 27 discovered, 27 pass, 0 fail, 0 skip, twice. Signing-enabled fooled recovery bypass and uncertain-send queue release no longer reproduce. Tests use actual exported handlers with an injected chain; restart means real SQLite close/reopen and service-object recreation, not an OS-process crash. This is offline verification, not live relayer/RPC/browser evidence. No-hash uncertainty intentionally remains fail-closed until manual chain investigation.

The [public artifact](<../../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) records creation, payments, both-module cancellation, real module-A maturity/finalization, recovered-kit RPC-only 3-USDC sweep and owner rotation at the same address. No-card, early-finalize and old-key GS026 refusals are read-only, not mined attacks. Module B was started then cancelled, not completed after three days. Large/Admin classification is not browser WebAuthn execution. This reconciliation reads existing evidence offline, without a fresh chain query.

The aggregate isolated gate has not passed. The original complete local browser recovery test passed in gate 7, including cancellation/restart, real 180-second wait plus natural safety margin, replacement-kit offline decryption, same-address owner promotion and old-key refusal. It uses virtual Chromium WebAuthn and MOCK identity/bank inputs; its two RPC URLs share one owned local chain. Gate 8 still failed the older payment-and-kit clickflow at settings navigation; that separate test is being repaired. No live DeFi, fork execution or Sepolia service-RELAYER evidence is established. Service sponsorship, cross-machine independent-tool reproducibility and other [ledger gaps](<../../submission/claims.md>) remain open. Historical [v2 verification](<../swarm-final-verification.md>) and [clock-advanced local story](<../swarm-acceptance.md>) are not v3 gate evidence.

The [seven-slide storyboard](<../../pitch/storyboard.md>) exists as a pitch artifact, not a rendered deck or recording. Human video/publication decisions remain undecided; no external publication is authorized. [Integration notes](<integration-notes.md#L40-L43>) retain the current acceptance/decision boundary.

Labels: **Recorded public** means the inspected artifact reports public receipts/reads; **offline verified** means scoped local tests; **source-visible** means implemented code, not executed acceptance; **MOCK** is an explicit substitute; **pending** means matching evidence is absent.

## Historical inputs

The [critique notes](<../../../AgentsLocal/46257332/v3/critique/>) and [exploration notes](<../../../AgentsLocal/46257332/v3/explore/>) are local build-machine inputs, not publication evidence. The historical v2 plan is [Swissquote wallet build plan](<../swissquote-wallet-build-plan.md>).
