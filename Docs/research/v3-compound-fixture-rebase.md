# Compound P0 fixture rebase

**Result:** all 27 original dApp policy tests pass after rebasing their Compound evidence; four explicitly named additional regressions also pass, for 31/31 final scoped tests. No original test case was deleted, renamed or skipped. This is offline fixture evidence, not live acceptance or source/build identity proof.

## Scope and baseline

Only [the existing policy fixture](<../../.worktrees/v3/swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts>) and this new report are owned by this fixture task. The implementation owner owns simulation, ABI and exact-math implementation plus the new exact-math suite. No implementation file was edited here.

The independently run command, from the v3 wallet directory, is `node --import tsx --test tests/protocol/v3-dapps-policy.test.ts`. Before edits it reported 27 tests, 27 passes, zero failures, zero skipped/cancelled. The first rebased run also reported 27 tests, 27 passes, zero failures, zero skipped/cancelled. The final run, after four optional named regressions, reported 31 tests, 31 passes, zero failures, zero skipped/cancelled. A TypeScript `transpileModule` syntax-diagnostics check reported zero errors without writing output. This was a syntax check, not a full semantic typecheck.

The four additions cover forward/reverse eight-probe swaps without Compound timestamp/tuples, one-unit credit/principal mutations, missing/duplicate/diverted Compound logs, and lawful exact rounding changing the observed v1 hash. The rounding vector is independently hand-derived: J=1500000000000000, P=0, a=2000000 gives Q=1333333 and C=mint=1999999. This hash-only regression does not claim to prove relay refusal or zero sends; the integration/service owner must prove that separately.

## Migration and independent expectations

The old Compound fixture had eight scalar probes before and after three supply calls or one withdrawal call, no timestamp/principal/index tuples and empty execution logs. The implementation now exports `simulationProbes(wallet, action)` and requires matching base-block hash/time evidence for Compound interpretation. Its Compound plan has 14 probes before/after; its swap plan remains the original eight. Fixtures now use named probe indexes instead of hardcoded offsets, canonical parent/time, five-word user tuples, eight-word totals tuples, scales/rate/utilization and actual event grammar.

The original positive expectations are hand-derived, not obtained by calling the production model: index J equals scale S (1000000000000000), elapsed time is zero and aggregate debt is zero. Therefore displayed balance B equals principal P, new principal Q equals B plus signed action amount, displayed balance C equals Q, tracking stays zero, and mint/burn equals the absolute principal change. Empty fresh supply of 2000000 has Q=C=2000000; full withdrawal from P=B=2000000 ends at Q=C=0. The known-argument rate getter is the saved constant 9040159720; it is not described as the zero-utilization rate.

Original forward/reverse swap policy and quote checks, approval/order/shape negatives, classifier checks, observed-hash wallet/call binding, incomplete/reverted/false-approval evidence, changed allowance, debt, fabricated position, missing code, outside-contract event, offline/no-client/wrong-chain refusal remain intact. Error literals changed only to the implementation's specific exact-math and event-grammar failures; rejection meaning remains the same.

## Boundaries

No live RPC/API/authentication/key/private-state operation, broadcast, funding, Git operation, dependency installation, distribution build or runtime/process change was performed. Runtime 1646 and main runtimes 374/487 were not touched. Other owners still need to assess implementation correctness, security suites, integration freshness/no-send paths and acceptance gates. A passing migrated baseline alone does not establish those.
