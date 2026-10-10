# Compound P0 — independent source inventory: 591

**Current sources register 591 intended tests: 549 Node + 42 Mocha contract tests, across 78 registered files.** The Compound delta is exactly 72: new protocol exact-math 51, existing dApp policy 27 → 31 (+4), and new service sponsorship 17. Every other filename and per-file count matches the prior registration inventory plus its one retention correction.

This is source-count evidence, not passing or zero-skip evidence. The parent must explicitly set `GATE_EXPECTED_TESTS=591` before a separately authorized gate; never derive that value from observed passes. The [gate:61–64](<../../../swissquote-wallet/scripts/gate.mjs#L61-L64>) currently defaults to 519 and requires an approved integer at least 519. Neither gate nor implementation was changed in this audit.

## Basis and limits

Read the worktree's [communication protocol](<../../agents/HUMAN_FACING_COMMUNICATION.md>) in full. Discovered source files with scoped globs and inspected gate discovery, manifests, contract configuration, prior inventories, new tests, changed policy tests, and retention source. A read-only Node process used installed TypeScript 5.9.3 to parse all registered test text; it did not import or evaluate test/application modules. No tests, gate, typecheck/build, browser, runtime, server start/stop, Git operation, broadcast, private API, key material, or private run files were used. Only this new report was written.

Count direct Node `test` calls and nested `t.test` calls, including their parents. Count Mocha `it` calls, not `describe` containers. Expand registration-enclosing literal-array loops, named literal arrays, `Object.entries` tables, and the explicit integer loop `for(let i=0;i<2;i++)`. Stop expansion at the enclosing parent registration: scenario, fixture, event, mutation, campaign, and assertion loops inside tests do not multiply tests. The traversal found 465 declaration sites. Its only initially unresolved registration loop, `tampers.entries()`, was resolved by directly reading the three-element source table; no unresolved registration cardinality remains.

The audit does not establish execution readiness of every historical integration/browser prerequisite, test correctness, bytecode hash correspondence, or live behavior. Sources are mutable; later registration/discovery/table edits require recounting. User-supplied main/live acceptance references 374/487 and 1646 remain unchanged historical references, not counts inferred or reproduced here.

## Independent baseline reconciliation

The [registration inventory](<registration-test-inventory.md>) records 518 = 476 Node + 42 contracts, across 76 files. Its [retention correction](<retention-test-inventory.md>) adds exactly one top-level test, not a new file. The current [retention declaration:169–212](<../../../swissquote-wallet/tests/browser/live-retention.test.mjs#L169-L212>) encloses its metadata/encoding cases inside that test; they do not add registrations. Current retention count is 15, browser suite 34.

Removing the new exact-math and sponsorship files and the four added policy declarations from this independent recount produces 519 = 477 Node + 42 contracts, across the same 76 prior files. Removing the retention correction then reproduces 518 = 476 Node + 42. This comparison checks every prior filename and count, rather than adding the supplied delta to an assumed baseline.

## Compound registrations and expansion evidence

### New protocol exact-math: 51 registrations from 20 sites

[Exact-math source](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts>) contains:

| Registration group | Source lines | Count |
| --- | --- | ---: |
| Recorded exact vectors | [38](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L38>) | 2 |
| Saved-node replay, explicit `i < 2` loop | [41–48](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L41-L48>) | 2 |
| Exact mutations: two deltas × three keys | [49](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L49>) | 6 |
| Positive-principal action/amount table | [50](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L50>) | 3 |
| Index boundary table | [53](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L53>) | 4 |
| Bounded math object entries | [55](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L55>) | 7 |
| Canonical tuple table | [56](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L56>) | 3 |
| Strict-evidence mutation object entries | [58](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L58>) | 12 |
| Fixed declarations at 51, 52, 54, 57, 59, 60, 61, 62, 73, 77, 81, 94 | [51–94](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts#L51-L94>) | 12 |
| Total | | 51 |

The two saved-node registrations are source-determined by `i < 2`, not by inspecting saved result lengths. The test source refers to public diagnostic JSON outside the test tree; this audit did not inspect or execute those diagnostic files. Their availability/content can cause runtime failure, not an intended-count reduction.

### Existing dApp policy: 31 registrations, delta +4

[Policy source](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts>) retains 11 policy object entries ([32–44](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts#L32-L44>)), seven swap object entries ([45](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts#L45>)), and nine pre-existing fixed declarations. Four additional fixed regression declarations are at [134, 149, 157, 165](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts#L134-L179>): swap baseline, one-unit credit/principal mutations, missing/duplicate/diverted events, and lawful rounding changing the observed effects hash. Therefore 13 fixed + 11 + 7 = 31, compared with 9 + 11 + 7 = 27. Internal forward/reverse, offset, and before/after loops do not register tests.

### New service sponsorship: 17 registrations from four sites

[Sponsorship source](<../../../swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts>) registers three initial faults ([145–147](<../../../swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts#L145-L147>)), one independent-vector test ([149–151](<../../../swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts#L149-L151>)), one positive fresh-acceptance test ([153–155](<../../../swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts#L153-L155>)), and twelve post-preview faults ([157–159](<../../../swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts#L157-L159>)). Thus 3 + 1 + 1 + 12 = 17. Vector, probe, code-pin, slot, configuration, and event loops inside those callbacks add assertions only.

## Service skip condition: currently false, never acceptable as a skip

The [service corpus setup:49–54](<../../../swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts#L49-L54>) reads the public [code corpus](<../../../swissquote-wallet/services/swissquote/test/fixtures/sepolia-dapp-code.json>), asserts chain 11155111 and block `11887593`, and defines:

`missingRuntime = DAPP_CODE_PINS.flatMap(pin => [pin, ...(pin.slots ?? []).filter(slot => slot.codeHash)]).filter(pin => !pinnedRuntime[pin.address.toLowerCase()]);`

`corpusBlocker = missingRuntime.length ? 'Blocked: reviewed offline runtime-code preimages required; positive/fresh revalidation acceptance is NOT established' : false;`

Static parsing resolved pin addresses through the [production pin table:13–31](<../../../swissquote-wallet/packages/protocol/src/simulate.ts#L13-L31>), [dApp address table:10–17](<../../../swissquote-wallet/packages/protocol/src/dapps.ts#L10-L17>), and [USDC address:16](<../../../swissquote-wallet/packages/protocol/src/constants.ts#L16>). The corpus contains 13 keys. All 11 required runtime keys are present with nonempty canonical hex bytecode: Compound extension, router, quoter, pool, Compound main, Compound implementation and code-bearing admin, USDC proxy and implementation, EURC proxy and implementation. The two no-code token admins are not required by `missingRuntime`.

Therefore **`missingRuntime=[]` and `corpusBlocker=false` in the current public corpus**. Thirteen service registrations have `{ skip: corpusBlocker }`; their options are currently false. Four registrations are unconditional. None is an accepted skip. This statically establishes that the condition permits all 17 to run; it does not prove successful hashes or test execution.

The source currently asserts corpus chain/block but has no separate `assert.equal(missingRuntime.length, 0)`. An explicit readiness assertion would fail earlier if the corpus regresses; that is for the implementation owner, not this read-only inventory. The [gate Node summary:14–16](<../../../swissquote-wallet/scripts/gate.mjs#L14-L16>) rejects any skipped/cancelled/todo/failed result regardless.

## Exact gate suites and files

Every filename below was independently parsed. Paths refer to this worktree. Counts include parent tests where present.

### scripts — 12, two files

[Runtime](<../../../swissquote-wallet/scripts/test/runtime.test.ts>) 2; [story Sepolia](<../../../swissquote-wallet/scripts/test/story-sepolia.test.ts>) 10.

### apps/recovery-tool — 26, seven files

[Approval](<../../../swissquote-wallet/apps/recovery-tool/test/approval.test.ts>) 2; [core](<../../../swissquote-wallet/apps/recovery-tool/test/core.test.ts>) 5; [lifecycle](<../../../swissquote-wallet/apps/recovery-tool/test/lifecycle.test.ts>) 1; [portable](<../../../swissquote-wallet/apps/recovery-tool/test/portable.test.ts>) 1; [public RPC pacing](<../../../swissquote-wallet/apps/recovery-tool/test/public-rpc-pacing.test.ts>) 8; [validation](<../../../swissquote-wallet/apps/recovery-tool/test/validation.test.ts>) 5; [wallet](<../../../swissquote-wallet/apps/recovery-tool/test/wallet.test.ts>) 4.

### apps/wallet — 42, nine files

[Lifecycle](<../../../swissquote-wallet/apps/wallet/test/lifecycle.test.ts>) 4; [local integration](<../../../swissquote-wallet/apps/wallet/test/local.integration.test.ts>) 1; [registration activity](<../../../swissquote-wallet/apps/wallet/test/registration-activity.test.ts>) 5; [registration retry](<../../../swissquote-wallet/apps/wallet/test/registration-retry.test.tsx>) 9; [Sepolia receipt](<../../../swissquote-wallet/apps/wallet/test/sepolia-receipt.test.ts>) 4; [wallet](<../../../swissquote-wallet/apps/wallet/test/wallet.test.ts>) 7; [dApps component](<../../../swissquote-wallet/apps/wallet/src/features/dapps/component.test.tsx>) 2; [dApps helpers](<../../../swissquote-wallet/apps/wallet/src/features/dapps/helpers.test.ts>) 8; [demoLab model](<../../../swissquote-wallet/apps/wallet/src/features/demoLab/model.test.ts>) 2. Test directory 30 + feature directory 12 = 42.

### services/partner — 14, two files

[Partner](<../../../swissquote-wallet/services/partner/test/partner.test.ts>) 11; [runtime](<../../../swissquote-wallet/services/partner/test/runtime.test.ts>) 3.

### services/swissquote — 102, seventeen files

[App](<../../../swissquote-wallet/services/swissquote/test/app.test.ts>) 7; [chain](<../../../swissquote-wallet/services/swissquote/test/chain.test.ts>) 3; [Compound exact sponsorship](<../../../swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts>) 17; [final fixes](<../../../swissquote-wallet/services/swissquote/test/final-fixes.test.ts>) 3; [freeze subjects](<../../../swissquote-wallet/services/swissquote/test/freeze-subjects.test.ts>) 9; [interface](<../../../swissquote-wallet/services/swissquote/test/interface.test.ts>) 1; [local screening](<../../../swissquote-wallet/services/swissquote/test/local-screening.test.ts>) 5; [races](<../../../swissquote-wallet/services/swissquote/test/races.test.ts>) 1; [registration freshness](<../../../swissquote-wallet/services/swissquote/test/registration-freshness.test.ts>) 16; [registration proof](<../../../swissquote-wallet/services/swissquote/test/registration-proof.test.ts>) 1; [registration read isolation](<../../../swissquote-wallet/services/swissquote/test/registration-read-isolation.test.ts>) 2; [registration transports](<../../../swissquote-wallet/services/swissquote/test/registration-transports.test.ts>) 2; [screening](<../../../swissquote-wallet/services/swissquote/test/screening.test.ts>) 16; [sender safety](<../../../swissquote-wallet/services/swissquote/test/sender-safety.test.ts>) 6; [Sepolia chain](<../../../swissquote-wallet/services/swissquote/test/sepolia-chain.test.ts>) 6; [storage](<../../../swissquote-wallet/services/swissquote/test/storage.test.ts>) 1; [strict](<../../../swissquote-wallet/services/swissquote/test/strict.test.ts>) 6. Prior 85 + 17 = 102.

### packages/protocol — 31, four files

[History chunks](<../../../swissquote-wallet/packages/protocol/test/history-chunks.test.ts>) 16; [protocol](<../../../swissquote-wallet/packages/protocol/test/protocol.test.ts>) 11; [receipt events](<../../../swissquote-wallet/packages/protocol/test/receipt-events.test.ts>) 2; [registration signing](<../../../swissquote-wallet/packages/protocol/test/registration-signing.test.ts>) 2.

### tests/browser — 34, eight files

[Browser](<../../../swissquote-wallet/tests/browser/browser.test.mjs>) 4; [clickflow](<../../../swissquote-wallet/tests/browser/clickflow.test.mjs>) 1; [feature flow](<../../../swissquote-wallet/tests/browser/feature-flow.test.mjs>) 2; [harness](<../../../swissquote-wallet/tests/browser/harness.test.mjs>) 6; [live retention](<../../../swissquote-wallet/tests/browser/live-retention.test.mjs>) 15; [offline kit](<../../../swissquote-wallet/tests/browser/offline-kit.test.mjs>) 1; [recovery complete](<../../../swissquote-wallet/tests/browser/recovery-complete.test.mjs>) 1; [validation](<../../../swissquote-wallet/tests/browser/validation.test.mjs>) 4. Prior 33 + retention 1 = 34; this is unchanged from 519.

### tests/protocol — 155, ten files

[Codes classification](<../../../swissquote-wallet/tests/protocol/codes-classification.test.ts>) 16; [encryption kit](<../../../swissquote-wallet/tests/protocol/encryption-kit.test.ts>) 6; [template signing](<../../../swissquote-wallet/tests/protocol/template-signing.test.ts>) 7; [v3 audit](<../../../swissquote-wallet/tests/protocol/v3-audit.test.ts>) 4; [Compound exact math](<../../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts>) 51; [dApps policy](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts>) 31; [Sepolia plumbing](<../../../swissquote-wallet/tests/protocol/v3-sepolia-plumbing.test.ts>) 6; [Sepolia verification](<../../../swissquote-wallet/tests/protocol/v3-sepolia-verification.test.ts>) 4; [wallet verification](<../../../swissquote-wallet/tests/protocol/wallet-verification.test.ts>) 17; [wire validation](<../../../swissquote-wallet/tests/protocol/wire-validation.test.ts>) 13. Prior 100 + 51 + 4 = 155.

### tests/security — 72, five files

[Partner HTTP](<../../../swissquote-wallet/tests/security/partner-http.test.ts>) 15; [partner storage](<../../../swissquote-wallet/tests/security/partner-storage.test.ts>) 8; [protocol adversarial](<../../../swissquote-wallet/tests/security/protocol-adversarial.test.ts>) 13; [service adversarial](<../../../swissquote-wallet/tests/security/service-adversarial.test.ts>) 22; [independent policy](<../../../swissquote-wallet/tests/security/v3-independent-policy.test.ts>) 14.

### tests/integration — 61, seven files

[HTTP contract](<../../../swissquote-wallet/tests/integration/http-contract.test.ts>) 5 = parent 1 + children 4; [local chain](<../../../swissquote-wallet/tests/integration/local-chain.test.ts>) 8 = parent 1 + children 7; [owner lifecycle](<../../../swissquote-wallet/tests/integration/owner-lifecycle.test.ts>) 15; [partner](<../../../swissquote-wallet/tests/integration/partner.test.ts>) 5 = parent 1 + children 4; [services](<../../../swissquote-wallet/tests/integration/services.test.ts>) 6 = parent 1 + children 5; [independent service](<../../../swissquote-wallet/tests/integration/v3-independent-service.test.ts>) 13; [recovery services](<../../../swissquote-wallet/tests/integration/v3-recovery-services.test.ts>) 9. Four parents plus twenty children are included; failed/skipped setup preventing their observed registration does not reduce the intended count.

### contracts — 42, seven registered files

[Plan Sepolia copy](<../../../swissquote-wallet/contracts/test/plan-sepolia-copy.test.js>) 10; [T1–T5 Candidate B](<../../../swissquote-wallet/contracts/test/t1-t5.candidateB.test.js>) 11 = 7 fixed + 2 routes × 2 paths; [T10 request hygiene](<../../../swissquote-wallet/contracts/test/t10-request-hygiene.test.js>) 3; [T6 property](<../../../swissquote-wallet/contracts/test/t6-property.test.js>) 2; [T7 creation tamper](<../../../swissquote-wallet/contracts/test/t7-creation-tamper.test.js>) 4 = 1 fixed + three literal [tamper entries:76–82](<../../../swissquote-wallet/contracts/test/t7-creation-tamper.test.js#L76-L82>); [T8 two instances](<../../../swissquote-wallet/contracts/test/t8-two-instances.test.js>) 9 = 7 fixed + two routes; [T9 hidden owner](<../../../swissquote-wallet/contracts/test/t9-hidden-owner.test.js>) 3. The additionally discovered [contract helper](<../../../swissquote-wallet/contracts/test/helpers.js>) is support code, not an additional registered test file.

Node suite sum: 12 + 26 + 42 + 14 + 102 + 31 + 34 + 155 + 72 + 61 = 549. Contracts add 42, giving 591. File sum: 2 + 7 + 9 + 2 + 17 + 4 + 8 + 10 + 5 + 7 + 7 = 78.

## Retained dynamic baseline and discovery checks

Prior generated groups independently retain their cardinalities: screening 6 fixed + 5 + 2 + 3 = 16; history chunks 11 fixed + 5 = 16; receipt events 2; registration activity 4 helper cases + 1 fixed = 5; registration retry 3 fixed + 2 + 2 + 2 = 9; codes classification 11 fixed + 3 + 2 = 16; wallet verification 8 fixed + 2 + 2 + 2 + 3 = 17; wire validation 2 fixed + 5 + 3 + 3 = 13; partner HTTP 7 fixed + 3 + 5 = 15; partner storage 4 sites × 2 implementations = 8; service adversarial 20 fixed + 2 = 22; independent policy 7 fixed + 7 = 14; owner lifecycle 6 fixed + 2 + 7 = 15; independent service 10 fixed + 3 = 13. Contract generated groups are resolved above.

[Gate discovery:26–58](<../../../swissquote-wallet/scripts/gate.mjs#L26-L58>) recursively accepts `.test.ts`, `.test.tsx`, `.test.mjs`, `.test.js`, excluding node_modules/dist/.git. It examines scripts and immediate apps/services/packages manifests with a test command, then adds recursive wallet feature tests and the four explicit browser/protocol/security/integration roots. Manifest reads confirm exactly six workspace suites: [scripts](<../../../swissquote-wallet/scripts/package.json#L9>), [recovery tool](<../../../swissquote-wallet/apps/recovery-tool/package.json#L11>), [wallet](<../../../swissquote-wallet/apps/wallet/package.json#L10>), [partner](<../../../swissquote-wallet/services/partner/package.json#L12>), [Swissquote](<../../../swissquote-wallet/services/swissquote/package.json#L7>), and [protocol](<../../../swissquote-wallet/packages/protocol/package.json#L7>). Both new files land inside existing discovered suites. [Gate invocation:77](<../../../swissquote-wallet/scripts/gate.mjs#L77>) imports tsx for all Node suites and includes wallet module-mock support.

Contracts use the separate [Hardhat invocation:87–89](<../../../swissquote-wallet/scripts/gate.mjs#L87-L89>) and [contract test command:7](<../../../swissquote-wallet/contracts/package.json#L7>). The [Hardhat configuration](<../../../swissquote-wallet/contracts/hardhat.config.js>) has no test-path or grep override. The separate contract story command is not the gate suite. Standalone browser/live/diagnostic scripts without the discovery suffix, including [Compound live harness](<../../../swissquote-wallet/tests/browser/sepolia-compound.mjs>) and [finalize diagnostic](<../../../swissquote-wallet/tests/browser/finalize-diagnostic.mjs>), contribute no gate registrations. The harness's child-process checks do not add tests to the parent gate summary.

**Stopping condition met:** complete source inventory, exact per-suite/file cardinalities, prior retention reconciliation, all new dynamic groups resolved, and current service skip condition statically false. Runtime acceptance remains the parent's separately authorized lane; no skipped service acceptance or reduced observed count can replace 591 intended registrations.
