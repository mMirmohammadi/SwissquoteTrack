# Current gate test inventory: 480

The current registered sources independently account for **480 intended tests: 438 Node tests plus 42 contract tests**. This is a source inventory, not passing or zero-skip evidence. No test suite, app, runtime, Git operation, private file, network request, or child agent was executed or inspected. Only this new report was written.

## Approval implication

The parent should use this inventory as the basis for explicit approval before running the gate. **Do not set `GATE_EXPECTED_TESTS` from an observed `GATE PASS` count.** The current [gate declaration:61–63](<../../../swissquote-wallet/scripts/gate.mjs#L61-L63>) still defaults to 433. A shorter observed run is a failure or incomplete registration, not evidence for lowering the intended count.

The reconciliation is:

**425 previous source inventory + 8 partner privacy/security regressions = 433 historical baseline.**

**433 + 8 recovery-tool pacing + 14 browser retention + 16 screening + 9 freeze subjects = 480 current inventory.**

The [previous report](</home/dev/Hackaton/SwissquoteTrack/AgentsLocal/4dd376f2/gate-test-count.md>) contained 383 Node + 42 contracts. The eight intervening security registrations are independently visible in current sources: [partner-http](<../../../swissquote-wallet/tests/security/partner-http.test.ts>) increased from 11 to 15; [partner-storage](<../../../swissquote-wallet/tests/security/partner-storage.test.ts>) increased from 4 to 8. Thus the historical registered Node baseline was 391, not 383, and 391 + 42 = 433. The historical pass/zero-skip claim supplied with this task was not reproduced in this read-only audit.

## Registered per-suite baseline and current count

All paths below refer to this worktree. Each paragraph gives historical 433-baseline → current registrations, followed by current per-file counts.

### scripts: 12 → 12

[runtime](<../../../swissquote-wallet/scripts/test/runtime.test.ts>): 2; [story-sepolia](<../../../swissquote-wallet/scripts/test/story-sepolia.test.ts>): 10. Two files.

### apps/recovery-tool: 18 → 26

[approval](<../../../swissquote-wallet/apps/recovery-tool/test/approval.test.ts>): 2; [core](<../../../swissquote-wallet/apps/recovery-tool/test/core.test.ts>): 5; [lifecycle](<../../../swissquote-wallet/apps/recovery-tool/test/lifecycle.test.ts>): 1; [portable](<../../../swissquote-wallet/apps/recovery-tool/test/portable.test.ts>): 1; [public-rpc-pacing](<../../../swissquote-wallet/apps/recovery-tool/test/public-rpc-pacing.test.ts>): 8; [validation](<../../../swissquote-wallet/apps/recovery-tool/test/validation.test.ts>): 5; [wallet](<../../../swissquote-wallet/apps/recovery-tool/test/wallet.test.ts>): 4. Seven files. Pacing contributes eight top-level declarations, not one test per fetch attempt.

### apps/wallet: 27 → 27

[lifecycle](<../../../swissquote-wallet/apps/wallet/test/lifecycle.test.ts>): 3; [local.integration](<../../../swissquote-wallet/apps/wallet/test/local.integration.test.ts>): 1; [sepolia-receipt](<../../../swissquote-wallet/apps/wallet/test/sepolia-receipt.test.ts>): 4; [wallet](<../../../swissquote-wallet/apps/wallet/test/wallet.test.ts>): 7; [dapps/component](<../../../swissquote-wallet/apps/wallet/src/features/dapps/component.test.tsx>): 2; [dapps/helpers](<../../../swissquote-wallet/apps/wallet/src/features/dapps/helpers.test.ts>): 8; [demoLab/model](<../../../swissquote-wallet/apps/wallet/src/features/demoLab/model.test.ts>): 2. Seven files, including recursive feature TSX discovery.

### services/partner: 14 → 14

[partner](<../../../swissquote-wallet/services/partner/test/partner.test.ts>): 11; [runtime](<../../../swissquote-wallet/services/partner/test/runtime.test.ts>): 3. Two files.

### services/swissquote: 39 → 64

[app](<../../../swissquote-wallet/services/swissquote/test/app.test.ts>): 7; [chain](<../../../swissquote-wallet/services/swissquote/test/chain.test.ts>): 3; [final-fixes](<../../../swissquote-wallet/services/swissquote/test/final-fixes.test.ts>): 3; [freeze-subjects](<../../../swissquote-wallet/services/swissquote/test/freeze-subjects.test.ts>): 9; [interface](<../../../swissquote-wallet/services/swissquote/test/interface.test.ts>): 1; [local-screening](<../../../swissquote-wallet/services/swissquote/test/local-screening.test.ts>): 5; [races](<../../../swissquote-wallet/services/swissquote/test/races.test.ts>): 1; [screening](<../../../swissquote-wallet/services/swissquote/test/screening.test.ts>): 16; [sender-safety](<../../../swissquote-wallet/services/swissquote/test/sender-safety.test.ts>): 6; [sepolia-chain](<../../../swissquote-wallet/services/swissquote/test/sepolia-chain.test.ts>): 6; [storage](<../../../swissquote-wallet/services/swissquote/test/storage.test.ts>): 1; [strict](<../../../swissquote-wallet/services/swissquote/test/strict.test.ts>): 6. Twelve files.

Screening is six fixed tests plus generated groups of five account positives ([81–89](<../../../swissquote-wallet/services/swissquote/test/screening.test.ts#L81-L89>)), two sanctions oracles ([99–106](<../../../swissquote-wallet/services/swissquote/test/screening.test.ts#L99-L106>)), and three required outages ([108–117](<../../../swissquote-wallet/services/swissquote/test/screening.test.ts#L108-L117>)): 6 + 5 + 2 + 3 = 16. Freeze subjects has nine top-level tests; its internal scenario loops add assertions, not registrations. Combined increase: 25.

### packages/protocol: 29 → 29

[history-chunks](<../../../swissquote-wallet/packages/protocol/test/history-chunks.test.ts>): 16 = 11 fixed + 5 history-span cases; [protocol](<../../../swissquote-wallet/packages/protocol/test/protocol.test.ts>): 11; [receipt-events](<../../../swissquote-wallet/packages/protocol/test/receipt-events.test.ts>): 2 generated cases. Three files.

### tests/browser: 19 → 33

[browser](<../../../swissquote-wallet/tests/browser/browser.test.mjs>): 4; [clickflow](<../../../swissquote-wallet/tests/browser/clickflow.test.mjs>): 1; [feature-flow](<../../../swissquote-wallet/tests/browser/feature-flow.test.mjs>): 2; [harness](<../../../swissquote-wallet/tests/browser/harness.test.mjs>): 6; [live-retention](<../../../swissquote-wallet/tests/browser/live-retention.test.mjs>): 14; [offline-kit](<../../../swissquote-wallet/tests/browser/offline-kit.test.mjs>): 1; [recovery-complete](<../../../swissquote-wallet/tests/browser/recovery-complete.test.mjs>): 1; [validation](<../../../swissquote-wallet/tests/browser/validation.test.mjs>): 4. Eight files.

All fourteen retention tests are top-level declarations. Malformed-envelope, filesystem-attack, and encoded-value fixture loops occur inside those tests and do not add registrations. Diagnostic scripts and prepared live scripts without a `.test` filename are excluded; no new diagnostic test is included in this inventory.

### tests/protocol: 100 → 100

[codes-classification](<../../../swissquote-wallet/tests/protocol/codes-classification.test.ts>): 16; [encryption-kit](<../../../swissquote-wallet/tests/protocol/encryption-kit.test.ts>): 6; [template-signing](<../../../swissquote-wallet/tests/protocol/template-signing.test.ts>): 7; [v3-audit](<../../../swissquote-wallet/tests/protocol/v3-audit.test.ts>): 4; [v3-dapps-policy](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts>): 27; [v3-sepolia-plumbing](<../../../swissquote-wallet/tests/protocol/v3-sepolia-plumbing.test.ts>): 6; [v3-sepolia-verification](<../../../swissquote-wallet/tests/protocol/v3-sepolia-verification.test.ts>): 4; [wallet-verification](<../../../swissquote-wallet/tests/protocol/wallet-verification.test.ts>): 17; [wire-validation](<../../../swissquote-wallet/tests/protocol/wire-validation.test.ts>): 13. Nine files.

Expanded groups: codes classification 11 fixed + 3 code kinds + 2 address fields; dapps policy 9 fixed + 11 policy object entries + 7 swap object entries ([32–45](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts#L32-L45>)); wallet verification 8 fixed + 2 malicious histories + 2 lifecycle states + 2 owner mismatches + 3 unusable addresses; wire validation 2 fixed + 5 overflow fields + 3 address fields + 3 malformed inputs.

### tests/security: 72 → 72

[partner-http](<../../../swissquote-wallet/tests/security/partner-http.test.ts>): 15 = 7 fixed + 3 request mutations + 5 snapshot mutations; [partner-storage](<../../../swissquote-wallet/tests/security/partner-storage.test.ts>): 8 = 4 declarations × 2 store implementations; [protocol-adversarial](<../../../swissquote-wallet/tests/security/protocol-adversarial.test.ts>): 13; [service-adversarial](<../../../swissquote-wallet/tests/security/service-adversarial.test.ts>): 22 = 20 fixed + 2 budget implementations; [v3-independent-policy](<../../../swissquote-wallet/tests/security/v3-independent-policy.test.ts>): 14 = 7 fixed + 7 mutations. Five files. The historical eight-test increase is already included here, not added again to 480.

### tests/integration: 61 → 61

[http-contract](<../../../swissquote-wallet/tests/integration/http-contract.test.ts>): 5 = 1 parent + 4 children; [local-chain](<../../../swissquote-wallet/tests/integration/local-chain.test.ts>): 8 = 1 parent + 7 children; [owner-lifecycle](<../../../swissquote-wallet/tests/integration/owner-lifecycle.test.ts>): 15 = 6 fixed + 2 transitions + 7 attacks; [partner](<../../../swissquote-wallet/tests/integration/partner.test.ts>): 5 = 1 parent + 4 children; [services](<../../../swissquote-wallet/tests/integration/services.test.ts>): 6 = 1 parent + 5 children; [v3-independent-service](<../../../swissquote-wallet/tests/integration/v3-independent-service.test.ts>): 13 = 10 fixed + 3 receipt states; [v3-recovery-services](<../../../swissquote-wallet/tests/integration/v3-recovery-services.test.ts>): 9. Seven files.

Node's total includes parent registrations and their nested `t.test` registrations. Therefore these suites include twenty nested children and their four parents. Setup failure or a skipped local-chain parent can prevent children from registering; that does not change the intended count.

### contracts: 42 → 42

[plan-sepolia-copy](<../../../swissquote-wallet/contracts/test/plan-sepolia-copy.test.js>): 10; [t1-t5.candidateB](<../../../swissquote-wallet/contracts/test/t1-t5.candidateB.test.js>): 11 = 7 fixed + 2 routes × 2 submission paths; [t10-request-hygiene](<../../../swissquote-wallet/contracts/test/t10-request-hygiene.test.js>): 3; [t6-property](<../../../swissquote-wallet/contracts/test/t6-property.test.js>): 2; [t7-creation-tamper](<../../../swissquote-wallet/contracts/test/t7-creation-tamper.test.js>): 4 = 1 fixed + 3 tamper cases; [t8-two-instances](<../../../swissquote-wallet/contracts/test/t8-two-instances.test.js>): 9 = 7 fixed + 2 routes; [t9-hidden-owner](<../../../swissquote-wallet/contracts/test/t9-hidden-owner.test.js>): 3. Seven files. `describe` containers, campaign steps, random actions, and repeated assertions do not add Mocha tests.

## Discovery, cross-check, and uncertainty

Current [gate discovery:26–58](<../../../swissquote-wallet/scripts/gate.mjs#L26-L58>) recursively accepts `.test.ts`, `.test.tsx`, `.test.mjs`, and `.test.js`, excluding node_modules, dist, and .git. Manifest inspection found exactly six declared workspace suites: scripts, recovery-tool, wallet, partner, swissquote, and protocol package. Wallet additionally discovers recursive feature tests. The four tests directories are explicitly included regardless of their package commands.

The separate [contract invocation:81–85](<../../../swissquote-wallet/scripts/gate.mjs#L81-L85>) uses [contract package test command:7](<../../../swissquote-wallet/contracts/package.json#L7>), `hardhat test`. The [Hardhat configuration](<../../../swissquote-wallet/contracts/hardhat.config.js>) does not override test paths or apply grep. The separate contract story command is not the gate's contract suite.

A read-only TypeScript AST traversal counted declaration sites and expanded source-literal arrays, named literal tables, array entries, and object entries. A second traversal independently walked registration ancestors and checked conditional or callback registration and imports of other test sources. Across **69 registered files, 404 declaration sites expand to 480 test registrations**. There were no unresolved cardinalities or conditional/callback-registration anomalies in that cross-check. The first traversal's object-entry recognition order missed two dapps tables; manual source reading and the corrected independent traversal both resolve them to 11 and 7. No suites or application imports were evaluated.

The Node sum is 12 + 26 + 27 + 14 + 64 + 29 + 33 + 100 + 72 + 61 = 438. Adding 42 contracts gives 480.

This worktree is mutable: changes to test files, generated tables, discovery, manifests, or contract configuration require a recount. Runtime prerequisites can cause failures or skipped tests, especially wallet local integration, local-chain children, and browser prerequisites. **This audit establishes intended registration cardinality only; whether all 480 pass with zero skips remains unverified.**
