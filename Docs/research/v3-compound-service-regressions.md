# Compound exact-math service regression handoff

## Parent follow-up: corpus blocker resolved

The parent captured public runtime-code preimages at fixed block 11887593, checking every production hash before writing [the offline corpus](<../../swissquote-wallet/services/swissquote/test/fixtures/sepolia-dapp-code.json>). Loading that corpus into the same test—without mocking hashes, pin checks or the simulator—produced **17/17 passing, zero skipped** (`bash-1736`). [Captured output](<../../AgentsLocal/46257332/v3/compound-service-corpus.log#L18-L24>) shows positive exact 999998 sponsorship, fresh lawful hash-drift refusal and all listed fresh mutation/signature/preflight refusals passing with the expected mock-send boundaries. Global typecheck (`bash-1733`) also passed. Full aggregate and independent patch review remain separate requirements; this is offline evidence, not mined supply.

The remainder below records the original partial handoff, before corpus capture. Its blocked statements are historical, not current acceptance status.

**Partial offline evidence only: the mandatory successful service path is blocked on unavailable pinned runtime-bytecode fixtures. Do not declare exact-math or live acceptance from this suite.** The new [service regression test](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/swissquote-wallet/services/swissquote/test/compound-exact-sponsorship.test.ts>) exercises the real App handler and simulator without modifying existing tests or implementation.

## Observed evidence

Targeted command, from the service directory:

`node --import tsx --test test/compound-exact-sponsorship.test.ts`

Latest run: **17 tests, 4 passed, 0 failed, 13 explicitly skipped for the bytecode-corpus blocker**. Service `pnpm typecheck` also completed successfully. The parent owns the full gate and independent patch review; those were not performed here.

The passing service cases use Sepolia chain ID 11155111, explicit `strictSponsorship`, an in-memory database and direct in-memory HTTP handler invocation. They first register the wallet through the actual challenge/registration routes with a distinct trusted current owner and explicitly mocked rules/EIP-1271 proof. The adapter provides `registrationBlock` and the required receipt-status capability. No server listener or network request is started.

Wrong-chain, missing-extension and wrong-extension cases each refuse both preview and relay with `NOT_SPONSORED`. Relay verifies the mocked current-owner signature, invokes the mocked signed-Safe preflight and performs a fresh chain check; each case asserts **zero mock sends** and no sender latch. These cases do **not** establish revalidation after a successful preview: no successful preview is possible without the bytecode corpus.

The remaining passing case independently checks literal known vectors:

| Simulation time | Supply index | Principal | Credit |
| --- | --- | --- | --- |
| 1791672132 | 1437657897106916 | 695575 | 999998 |
| 1791672252 | 1437659456431214 | 695575 | 999999 |

Expected tuple, borrow-index, tracking and utilization values are literal constants calculated with independent integer arithmetic, not imported `modelCompound` outputs. The first vector agrees with the saved two-node unsigned replay inspected in [the replay record](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/AgentsLocal/8f23ad61/result.json>). The second advances elapsed time by 120 seconds; it is an offline independent vector, not a new chain observation.

## Blocked acceptance and exact continuation

The fixture's `pinnedRuntime` corpus is deliberately empty. Inspected local replay artifacts contain runtime hashes but not the runtime-bytecode preimages needed by real `verifyDappCode`; the saved contract-code plan contains Safe-related code, not the required dApp corpus. Hashes alone cannot manufacture bytecodes satisfying those hashes. No simulator-function, hash-function, pin or exact-model mock was used to bypass this constraint.

The parent must supply reviewed, offline runtime bytes for every code-hashed `DAPP_CODE_PINS` address and every code-hashed implementation/admin slot, in the new test's lowercase-address `pinnedRuntime` map. Admin slots without a code hash must continue returning empty code. Keep every production pin unchanged. Then rerun this new suite and inspect the resulting failures; do not count skipped cases as acceptance.

Implemented but **not executed/accepted** due to the explicit corpus blocker:

- Successful real-App 999998 preview then relay with signature-valid mock, complete raw `eth_simulateV1` evidence, exact getter/event grammar, all fresh code/storage/config reads at the explicit base block, both header reads and signed-Safe preflight before one local mock send.
- Receipt reconciliation followed by actual `/relay/status` reporting idle; the fixture never clears the latch directly.
- Lawful exact 999998 preview → 999999 fresh resimulation, refusing specifically because observed hash changed with `EFFECTS_MISMATCH`, not because the fresh vector is malformed.
- Post-preview missing/wrong main or extension code, changed extension/config, credit +1, missing mint event, reorg, invalid owner signature and signed-Safe preflight revert, each asserting zero sends and absent sender/nonce reservations.

The frozen named probe plan is checked as 14 before + 3 actions + 14 after = 31 supply calls. Getter responses are selected by named probes and use canonical ABI words/tuples; fixture construction never imports the exact model to calculate expected evidence. A plan change must be explicitly reconciled rather than silently weakening that assertion.

This scoped handoff does not cover withdrawal service success or the full protocol/security/typecheck/build gate. Those remain with the parent and protocol-test owner. Fresh pin revalidation after accepted preview remains unproved until the skipped cases actually run.

## Scope and safety

Only the new test and this new report were written. Existing tests and implementation files were not edited. The full [human-facing communication protocol](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/Docs/agents/HUMAN_FACING_COMMUNICATION.md>) and [exact-math critic](</home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/Docs/plans/v3/compound-exact-math-critic.md>) were read before work.

No live API/RPC/authentication/key access, private-file inspection, Git operation, runtime/server change, funding or actual broadcast was performed. Session, signature, registration proof, screening, chain preflight, gas estimate, receipt and send adapters are visibly local mocks. The mandatory positive-path requirement remains open; lack of offline corpus is a handoff blocker, not grounds to loosen sponsorship policy.
