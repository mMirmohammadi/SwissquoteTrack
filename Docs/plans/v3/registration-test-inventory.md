# Registration test inventory — frozen source recount: 518

**Independent source recount: 518 intended tests = 476 Node + 42 contracts, across 76 registered files.** Removing the seven new registration files and the one added wallet lifecycle declaration independently reproduces the baseline **480 = 438 Node + 42 contracts, across 69 files**. The registration delta is **38**, not an observed passing count. This report does not approve a gate count: the parent must explicitly approve the expected count before a separately authorized gate.

The task states both implementation lanes are closed and no coding children remain. This is the latest read snapshot of those sources; no test, application, gate, browser, runtime, network request, or private-key file was executed or inspected. A permitted read-only `git diff --name-only` identified modified tracked sources. The only edited file is this report. A read-only Node process parsed test text using the installed TypeScript parser; it did not import or evaluate any test or application source.

## Independent method and baseline reconciliation

Discovery used scoped globs for every gate test root, then a static AST traversal of every discovered registered file. The traversal counted direct `test`, nested `t.test`, and contract `it` calls, expanding only registration-enclosing loops over source-literal arrays, named literal arrays, and `Object.entries` tables. It stopped loop expansion at the enclosing parent test so fixture/scenario loops inside a registration do not multiply the count. No unresolved registration-loop cardinality was encountered. There are **436 declaration sites expanding to 518 registrations**; removing the registration additions yields the baseline's **404 sites expanding to 480**. Every baseline filename and per-file cardinality below matches the [baseline report](<current-test-inventory.md>), except the explicitly expanded lifecycle file.

All seven new registration files were read in full. Lifecycle, Sepolia receipt, and wallet tests were also read in full; the remaining registered files were independently parsed from source text, and relevant generated-table declarations were directly read. This is source cardinality evidence, not implementation correctness or runtime acceptance.

## Registration changes: baseline 480 + 38

* [Service freshness](<../../../swissquote-wallet/services/swissquote/test/registration-freshness.test.ts>): 16 fixed declarations, +16.
* [Service transports](<../../../swissquote-wallet/services/swissquote/test/registration-transports.test.ts>): 2 fixed declarations, +2.
* [Service proof](<../../../swissquote-wallet/services/swissquote/test/registration-proof.test.ts>): 1 fixed declaration, +1. Its three failure scenarios do not multiply registrations.
* [Service read isolation](<../../../swissquote-wallet/services/swissquote/test/registration-read-isolation.test.ts>): 2 fixed declarations, +2. These cover outside-registration read isolation and recovered-versus-terminal transport failure classification; neither creates nested tests.
* [Protocol signing](<../../../swissquote-wallet/packages/protocol/test/registration-signing.test.ts>): 2 fixed declarations, +2.
* [Wallet retry](<../../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx>): 9 registrations = 3 fixed + 2 lock/logout cases ([133–148](<../../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx#L133-L148>)) + 2 unlock/pending cases ([149–165](<../../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx#L149-L165>)) + 2 replacement-promotion cases ([166–185](<../../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx#L166-L185>)); +9 from baseline, +6 since the archived read.
* [Wallet activity](<../../../swissquote-wallet/apps/wallet/test/registration-activity.test.ts>): 5 registrations = 4 helper-boundary cases ([17–33](<../../../swissquote-wallet/apps/wallet/test/registration-activity.test.ts#L17-L33>)) + 1 fixed async-guard/minimum/proof-tuple case ([34–47](<../../../swissquote-wallet/apps/wallet/test/registration-activity.test.ts#L34-L47>)); +5. The filename ends in `.test.ts`, not `.test.tsx`.
* [Wallet lifecycle](<../../../swissquote-wallet/apps/wallet/test/lifecycle.test.ts>): 4 fixed declarations versus baseline 3; +1 for the optional receipt-minimum registration. Its invalid-minimum and storage assertion loops add no registrations.

Seven new files contribute 16 + 2 + 1 + 2 + 2 + 9 + 5 = 37; lifecycle adds 1; **480 + 38 = 518**. Relative to the archived as-of-read 505, read isolation +2, retry +6, and activity +5 add 13. The archive remains historical evidence only, never an approved expected count.

## Exact suite totals and per-filename counts

Paths below are relative to the wallet project. All counts come from the independent current-source traversal, not pass output.

### scripts: 12 tests, 2 files

[runtime](<../../../swissquote-wallet/scripts/test/runtime.test.ts>) 2; [story-sepolia](<../../../swissquote-wallet/scripts/test/story-sepolia.test.ts>) 10.

### apps/recovery-tool: 26 tests, 7 files

[approval](<../../../swissquote-wallet/apps/recovery-tool/test/approval.test.ts>) 2; [core](<../../../swissquote-wallet/apps/recovery-tool/test/core.test.ts>) 5; [lifecycle](<../../../swissquote-wallet/apps/recovery-tool/test/lifecycle.test.ts>) 1; [portable](<../../../swissquote-wallet/apps/recovery-tool/test/portable.test.ts>) 1; [public-rpc-pacing](<../../../swissquote-wallet/apps/recovery-tool/test/public-rpc-pacing.test.ts>) 8; [validation](<../../../swissquote-wallet/apps/recovery-tool/test/validation.test.ts>) 5; [wallet](<../../../swissquote-wallet/apps/recovery-tool/test/wallet.test.ts>) 4.

### apps/wallet: 42 tests, 9 files (baseline 27, delta 15)

[lifecycle](<../../../swissquote-wallet/apps/wallet/test/lifecycle.test.ts>) 4; [local.integration](<../../../swissquote-wallet/apps/wallet/test/local.integration.test.ts>) 1; [registration-activity](<../../../swissquote-wallet/apps/wallet/test/registration-activity.test.ts>) 5; [registration-retry](<../../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx>) 9; [sepolia-receipt](<../../../swissquote-wallet/apps/wallet/test/sepolia-receipt.test.ts>) 4; [wallet](<../../../swissquote-wallet/apps/wallet/test/wallet.test.ts>) 7; [dapps/component](<../../../swissquote-wallet/apps/wallet/src/features/dapps/component.test.tsx>) 2; [dapps/helpers](<../../../swissquote-wallet/apps/wallet/src/features/dapps/helpers.test.ts>) 8; [demoLab/model](<../../../swissquote-wallet/apps/wallet/src/features/demoLab/model.test.ts>) 2.

### services/partner: 14 tests, 2 files

[partner](<../../../swissquote-wallet/services/partner/test/partner.test.ts>) 11; [runtime](<../../../swissquote-wallet/services/partner/test/runtime.test.ts>) 3.

### services/swissquote: 85 tests, 16 files (baseline 64, delta 21)

[app](<../../../swissquote-wallet/services/swissquote/test/app.test.ts>) 7; [chain](<../../../swissquote-wallet/services/swissquote/test/chain.test.ts>) 3; [final-fixes](<../../../swissquote-wallet/services/swissquote/test/final-fixes.test.ts>) 3; [freeze-subjects](<../../../swissquote-wallet/services/swissquote/test/freeze-subjects.test.ts>) 9; [interface](<../../../swissquote-wallet/services/swissquote/test/interface.test.ts>) 1; [local-screening](<../../../swissquote-wallet/services/swissquote/test/local-screening.test.ts>) 5; [races](<../../../swissquote-wallet/services/swissquote/test/races.test.ts>) 1; [registration-freshness](<../../../swissquote-wallet/services/swissquote/test/registration-freshness.test.ts>) 16; [registration-proof](<../../../swissquote-wallet/services/swissquote/test/registration-proof.test.ts>) 1; [registration-read-isolation](<../../../swissquote-wallet/services/swissquote/test/registration-read-isolation.test.ts>) 2; [registration-transports](<../../../swissquote-wallet/services/swissquote/test/registration-transports.test.ts>) 2; [screening](<../../../swissquote-wallet/services/swissquote/test/screening.test.ts>) 16; [sender-safety](<../../../swissquote-wallet/services/swissquote/test/sender-safety.test.ts>) 6; [sepolia-chain](<../../../swissquote-wallet/services/swissquote/test/sepolia-chain.test.ts>) 6; [storage](<../../../swissquote-wallet/services/swissquote/test/storage.test.ts>) 1; [strict](<../../../swissquote-wallet/services/swissquote/test/strict.test.ts>) 6.

### packages/protocol: 31 tests, 4 files (baseline 29, delta 2)

[history-chunks](<../../../swissquote-wallet/packages/protocol/test/history-chunks.test.ts>) 16; [protocol](<../../../swissquote-wallet/packages/protocol/test/protocol.test.ts>) 11; [receipt-events](<../../../swissquote-wallet/packages/protocol/test/receipt-events.test.ts>) 2; [registration-signing](<../../../swissquote-wallet/packages/protocol/test/registration-signing.test.ts>) 2.

### tests/browser: 33 tests, 8 files

[browser](<../../../swissquote-wallet/tests/browser/browser.test.mjs>) 4; [clickflow](<../../../swissquote-wallet/tests/browser/clickflow.test.mjs>) 1; [feature-flow](<../../../swissquote-wallet/tests/browser/feature-flow.test.mjs>) 2; [harness](<../../../swissquote-wallet/tests/browser/harness.test.mjs>) 6; [live-retention](<../../../swissquote-wallet/tests/browser/live-retention.test.mjs>) 14; [offline-kit](<../../../swissquote-wallet/tests/browser/offline-kit.test.mjs>) 1; [recovery-complete](<../../../swissquote-wallet/tests/browser/recovery-complete.test.mjs>) 1; [validation](<../../../swissquote-wallet/tests/browser/validation.test.mjs>) 4. Non-test Compound opt-in scripts are excluded by the discovery suffix rule, including the modified [sepolia-compound script](<../../../swissquote-wallet/tests/browser/sepolia-compound.mjs>).

### tests/protocol: 100 tests, 9 files

[codes-classification](<../../../swissquote-wallet/tests/protocol/codes-classification.test.ts>) 16; [encryption-kit](<../../../swissquote-wallet/tests/protocol/encryption-kit.test.ts>) 6; [template-signing](<../../../swissquote-wallet/tests/protocol/template-signing.test.ts>) 7; [v3-audit](<../../../swissquote-wallet/tests/protocol/v3-audit.test.ts>) 4; [v3-dapps-policy](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts>) 27; [v3-sepolia-plumbing](<../../../swissquote-wallet/tests/protocol/v3-sepolia-plumbing.test.ts>) 6; [v3-sepolia-verification](<../../../swissquote-wallet/tests/protocol/v3-sepolia-verification.test.ts>) 4; [wallet-verification](<../../../swissquote-wallet/tests/protocol/wallet-verification.test.ts>) 17; [wire-validation](<../../../swissquote-wallet/tests/protocol/wire-validation.test.ts>) 13.

### tests/security: 72 tests, 5 files

[partner-http](<../../../swissquote-wallet/tests/security/partner-http.test.ts>) 15; [partner-storage](<../../../swissquote-wallet/tests/security/partner-storage.test.ts>) 8; [protocol-adversarial](<../../../swissquote-wallet/tests/security/protocol-adversarial.test.ts>) 13; [service-adversarial](<../../../swissquote-wallet/tests/security/service-adversarial.test.ts>) 22; [v3-independent-policy](<../../../swissquote-wallet/tests/security/v3-independent-policy.test.ts>) 14.

### tests/integration: 61 tests, 7 files

[http-contract](<../../../swissquote-wallet/tests/integration/http-contract.test.ts>) 5 = 1 parent + 4 children; [local-chain](<../../../swissquote-wallet/tests/integration/local-chain.test.ts>) 8 = 1 parent + 7 children; [owner-lifecycle](<../../../swissquote-wallet/tests/integration/owner-lifecycle.test.ts>) 15 = 6 fixed + 2 transitions + 7 attacks; [partner](<../../../swissquote-wallet/tests/integration/partner.test.ts>) 5 = 1 parent + 4 children; [services](<../../../swissquote-wallet/tests/integration/services.test.ts>) 6 = 1 parent + 5 children; [v3-independent-service](<../../../swissquote-wallet/tests/integration/v3-independent-service.test.ts>) 13 = 10 fixed + 3 receipt states; [v3-recovery-services](<../../../swissquote-wallet/tests/integration/v3-recovery-services.test.ts>) 9. Node totals include all four parents and twenty nested children; skipped/failed setup preventing registration does not lower the intended total.

### contracts: 42 tests, 7 files

[plan-sepolia-copy](<../../../swissquote-wallet/contracts/test/plan-sepolia-copy.test.js>) 10; [t1-t5.candidateB](<../../../swissquote-wallet/contracts/test/t1-t5.candidateB.test.js>) 11 = 7 fixed + 2 routes × 2 paths; [t10-request-hygiene](<../../../swissquote-wallet/contracts/test/t10-request-hygiene.test.js>) 3; [t6-property](<../../../swissquote-wallet/contracts/test/t6-property.test.js>) 2; [t7-creation-tamper](<../../../swissquote-wallet/contracts/test/t7-creation-tamper.test.js>) 4 = 1 fixed + 3 tampers; [t8-two-instances](<../../../swissquote-wallet/contracts/test/t8-two-instances.test.js>) 9 = 7 fixed + 2 routes; [t9-hidden-owner](<../../../swissquote-wallet/contracts/test/t9-hidden-owner.test.js>) 3. Mocha `describe` containers and internal campaign/action loops add no tests.

The Node suite sum is **12 + 26 + 42 + 14 + 85 + 31 + 33 + 100 + 72 + 61 = 476**; **476 + 42 = 518**. File counts are **2 + 7 + 9 + 2 + 16 + 4 + 8 + 9 + 5 + 7 + 7 = 76**.

## Full-tree modified-source and generated-loop checks

The permitted tracked filename diff identifies these modified existing tests: wallet lifecycle 4 (baseline 3, disclosed +1), Sepolia receipt 4, wallet 7; service app 7, freeze-subjects 9, interface 1, local-screening 5, sender-safety 6, strict 6; integration owner-lifecycle 15, services 6, independent-service 13, recovery-services 9; security service-adversarial 22. **Every modified existing test other than the disclosed lifecycle addition retains its baseline cardinality.** The only modified tracked browser source lacks a `.test` suffix. Scoped discovery accounts separately for untracked/new registration files; a filename diff alone does not discover them.

All baseline registration-enclosing loops were independently expanded: screening 6 fixed + 5 + 2 + 3 = 16; history-chunks 11 fixed + 5 = 16; receipt-events 2; codes-classification 11 fixed + 3 + 2 = 16; dapps-policy 9 fixed + 11 + 7 = 27; wallet-verification 8 fixed + 2 + 2 + 2 + 3 = 17; wire-validation 2 fixed + 5 + 3 + 3 = 13; partner-http 7 fixed + 3 + 5 = 15; partner-storage 4 sites × 2 implementations = 8; service-adversarial 20 fixed + 2 = 22; independent-policy 7 fixed + 7 = 14; owner-lifecycle 6 fixed + 2 + 7 = 15; independent-service 10 fixed + 3 = 13. Contract expansions are recorded above. These reproduce baseline counts without using run output.

## Discovery and approval boundary

The [root gate discovery](<../../../swissquote-wallet/scripts/gate.mjs#L26-L58>) recursively includes `.test.ts`, `.test.tsx`, `.test.mjs`, and `.test.js`, excludes node_modules/dist/.git, adds wallet feature tests, and includes all four external test directories. Source manifest reads confirm exactly six declared workspace suites: scripts, recovery-tool, wallet, partner, Swissquote, and protocol. All seven new registration files are in those existing roots.

The [root gate invocation](<../../../swissquote-wallet/scripts/gate.mjs#L75-L77>) uses `--import tsx` for every Node suite, including all apps, and supplies `--experimental-test-module-mocks` for wallet. This covers both the TSX retry source and the `.test.ts` activity source's `mock.module` setup. The [wallet package command](<../../../swissquote-wallet/apps/wallet/package.json#L10>) also includes both suffixes and the mock flag; the root gate independently includes feature tests. Flag presence is source evidence, not a runtime support claim.

Contracts remain a separate [Hardhat invocation](<../../../swissquote-wallet/scripts/gate.mjs#L82-L89>), using the [contract package command](<../../../swissquote-wallet/contracts/package.json#L7>) and [configuration](<../../../swissquote-wallet/contracts/hardhat.config.js>), which has no test-path or grep override. The separate contract story command is excluded.

The [gate expected-count default](<../../../swissquote-wallet/scripts/gate.mjs#L61-L64>) is still 480. It was not edited. **Parent approval of 518 must precede the gate; never set the expected count from observed passes.** Passing tests, zero skips, typecheck/build, runtime mock compatibility, browser acceptance, and the live deployment cause remain outside this inventory task and unverified here. Any later change to registrations, tables, discovery, manifests, or configuration invalidates this frozen snapshot and requires a recount.

---

## Archived as-of-read history: 505 (not approval; superseded by the frozen recount above)

The remainder preserves the earlier non-atomic read verbatim. Statements about unfinished lanes, Git prohibition, file counts, and future rechecks describe that earlier read only, not the current closed-lane snapshot.

### Earlier report — source snapshot: 505

**The sources read for this audit account for 505 intended registrations: the supplied 480 baseline plus 25 additions.** This is not a passing-test claim or an approved gate count. The service/UI sources were changing during the read: the service freshness file grew from 14 to 16 tests. The lead must recount after the implementation lanes close, before explicitly approving the expected count. Never derive an expected count from observed passes.

Only this new report was written. No tests, browser, network, runtime, Git operation, private-key file, or application import was executed. The task's previously validated gate reference “1358” is supplied historical evidence, not reproduced here and not interpreted as a test count.

## Basis and counting rule

The existing [baseline inventory](<current-test-inventory.md>) independently records 480 = 438 Node + 42 contract registrations across 69 files. This audit carries that baseline forward, then reads the registration additions and identified changed fixture/receipt/lifecycle sources. It does not claim a fresh independent recount of all unchanged baseline files.

Count each top-level `test` and each nested `t.test`, including the parent; expand loops only when their body registers a test. Loops inside a test add scenarios/assertions, not registrations. The five new registration files contain no generated registrations or nested subtests. Their scenario loops therefore do not multiply their counts.

Git was prohibited, so a complete modified-file set cannot be proven by a diff. Source discovery used glob in the service test, wallet test/features, protocol package test, protocol integration test, security test, and integration test directories, plus registration-named test discovery. Relevant changed fixtures were located by their new barrier capability and read in full. No additional registration-named test file was discovered.

## New and expanded sources: delta 25

[Service registration freshness](<../../../swissquote-wallet/services/swissquote/test/registration-freshness.test.ts>): **16**, all top-level; baseline 0, delta +16. The initial full read had 14; the later declaration scan and read of the changed tail found two actual additions: concurrent-store owner/setup recheck and handler timeout before late rules success. Coverage includes common-block catch-up and pinning, same-client/no-minimum/old-minimum behavior, ahead bound, chain/hash refusal, reorg before persistence, uint64 parsing, missing barrier/withdrawal refusal, permanent lag, absolute deadlines, late completion/rejection, safe error classification, request-local failure state, paced starts, and queued-request expiry. Internal failure/stage/invalid-input loops are not extra tests.

[Service registration transports](<../../../swissquote-wallet/services/swissquote/test/registration-transports.test.ts>): **2**, top-level; baseline 0, delta +2. Mocked real transport construction checks shared-URL pacing/retries and the absence of local-chain pacing. Endpoint/call loops add assertions only.

[Service registration proof](<../../../swissquote-wallet/services/swissquote/test/registration-proof.test.ts>): **1**, top-level; baseline 0, delta +1. Its three transport/magic/unknown scenarios are inside that single registration.

[Wallet registration retry](<../../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx>): **3**, top-level; baseline 0, delta +3. Mounted React tests cover refused creation retaining the bound encrypted record, unlock/retry without redeploy, persisted receipt minimum and stale GET refusal; late registration after owner change; and late registration after sign out. No delayed-challenge/pre-sign lock test was present in the read snapshot.

[Protocol registration signing](<../../../swissquote-wallet/packages/protocol/test/registration-signing.test.ts>): **2**, top-level; baseline 0, delta +2. Selected-block forwarding and unpinned compatibility share the first test; wrong magic and RPC failure share the second.

[Wallet lifecycle](<../../../swissquote-wallet/apps/wallet/test/lifecycle.test.ts>): **4**, top-level; baseline 3, delta +1. The added registration-minimum test checks omitted/explicit/persisted lower bounds and malformed values. The fresh-proof retry, creation metadata, and replacement storage tests remain registrations already covered by the baseline. Added storage assertions do not add tests.

Thus new files contribute 16 + 2 + 1 + 3 + 2 = 24; lifecycle contributes 1; total delta = 25. Registered files become 74 if unchanged baseline discovery remains intact.

## Existing changed sources: no count increase found

The following sources were read in full. Their current registration cardinalities match the baseline; capability/fixture changes are not new tests.

Service: [app](<../../../swissquote-wallet/services/swissquote/test/app.test.ts>) 7; [freeze subjects](<../../../swissquote-wallet/services/swissquote/test/freeze-subjects.test.ts>) 9; [sender safety](<../../../swissquote-wallet/services/swissquote/test/sender-safety.test.ts>) 6; [local screening](<../../../swissquote-wallet/services/swissquote/test/local-screening.test.ts>) 5; [strict](<../../../swissquote-wallet/services/swissquote/test/strict.test.ts>) 6; [interface](<../../../swissquote-wallet/services/swissquote/test/interface.test.ts>) 1; [chain](<../../../swissquote-wallet/services/swissquote/test/chain.test.ts>) 3; [Sepolia chain](<../../../swissquote-wallet/services/swissquote/test/sepolia-chain.test.ts>) 6; [races](<../../../swissquote-wallet/services/swissquote/test/races.test.ts>) 1; [final fixes](<../../../swissquote-wallet/services/swissquote/test/final-fixes.test.ts>) 3.

Wallet: [Sepolia receipt](<../../../swissquote-wallet/apps/wallet/test/sepolia-receipt.test.ts>) 4. Receipt return-block/callback/malformed-block assertions are inside existing registrations, so delta 0.

External fixtures: [services](<../../../swissquote-wallet/tests/integration/services.test.ts>) 6 = 1 parent + 5 children; [recovery services](<../../../swissquote-wallet/tests/integration/v3-recovery-services.test.ts>) 9 top-level; [independent service](<../../../swissquote-wallet/tests/integration/v3-independent-service.test.ts>) 13 = 10 fixed + 3 generated receipt states; [owner lifecycle](<../../../swissquote-wallet/tests/integration/owner-lifecycle.test.ts>) 15 = 6 fixed + 2 generated transitions + 7 generated attacks; [service adversarial](<../../../swissquote-wallet/tests/security/service-adversarial.test.ts>) 22 = 20 fixed + 2 generated budget cases. Fixed-head barriers in these external fixtures refuse a minimum above their labelled head instead of inventing progress.

## Suite reconciliation and gate discovery

Only three suite totals change: service Swissquote 64 → 83 (+19); wallet 27 → 31 (+4); protocol package 29 → 31 (+2). The other carried-forward suite totals remain scripts 12, recovery tool 26, partner 14, browser 33, protocol integration 100, security 72, integration 61, and contracts 42. Node total becomes 463; 463 + 42 = 505.

[Gate discovery:26–58](<../../../swissquote-wallet/scripts/gate.mjs#L26-L58>) recursively accepts `.test.ts`, `.test.tsx`, `.test.mjs`, and `.test.js`, excluding node_modules/dist/.git. Wallet feature tests are additionally included. All five new registration files fall within the existing discovery roots; no package test-command update is required for gate discovery.

[Gate invocation:77](<../../../swissquote-wallet/scripts/gate.mjs#L77>) now supplies `--experimental-test-module-mocks` specifically to the wallet suite, required by its new top-level `mock.module` setup. This flag is visibly present in source; it is not runtime compatibility evidence. [Gate expected-count declaration:61–64](<../../../swissquote-wallet/scripts/gate.mjs#L61-L64>) still defaults to 480. This audit does not edit it or authorize execution; the lead must explicitly approve the final independently recounted total.

## Known unfinished lanes and lead recheck

**Service ALS-only pacing correction remains unfinished as of the test read.** The [review routing](<registration-review-routing.md>) requires pacing only inside the registration AsyncLocalStorage context and an explicit immediate/no-queue nonregistration test. The read freshness tail still tests ordinary paced calls outside that context, and contains no new nonregistration-scope regression. Its promised addition must not be counted until present. The two newly observed deadline/store tests are included in 505; the earlier “14 service tests” routing note is stale.

**UI pre-sign/pre-POST invalidation correction remains unfinished as of the test read.** The same routing requires delayed challenge followed by lock/sign out, proving no signing or registration POST, and guarded replacement registration. The read retry file contains only the three tests catalogued above; its post-POST sign-out test is not that evidence. The number of future lock-guard additions is unknown and excluded.

**Acceptance remains the lead's lane.** This source-only audit did not verify either implementation correction, typecheck/build, module-mock support, passing/zero-skip counts, real Chrome gate, or original live deployment cause. No observed pass count has been used to fill those gaps.

The snapshot is deliberately not atomic: 14 → 16 was observed during the service read. After both lanes stop editing, the lead must reread all five registration files plus lifecycle/receipt and any further modified/generated tests, confirm discovery/flag/configuration, and recompute baseline 480 plus the actual delta. Also recheck whether any non-registration-named sources changed outside the identified set; this audit cannot certify that set without Git. Only then approve the intended count for a separately authorized gate.
