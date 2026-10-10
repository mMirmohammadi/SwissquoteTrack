# Compound exact-math correction — isolated acceptance

**Accepted locally: 591 tests passed, zero skips, typechecks/builds passed. Live Compound supply remains unverified.**

Parent job `bash-1746` exited 0. The [terminal gate log](<../../../AgentsLocal/46257332/v3/compound-gate.log#L4018>) reports `GATE PASS: passed=591, skipped=0, duration=433.0s`. Post-pass shutdown ERR_PNPM text comes from stopping owned services, not failed acceptance. Main v2 processes were retained.

The [independent source inventory](<compound-test-inventory.md>) fixed the expected count before execution: 549 Node tests plus 42 contracts. Suite totals: scripts12, tool26, wallet42, partner14, Swissquote102, protocol31, browser34, external protocol155, security72, integration61, contracts42. No observed-count substitution or accepted skip.

The [independent implementation review](<../../research/v3-compound-exact-implementation-review.md>) accepts bounded pinned-code/getter consistency, not source/build identity or an audit. Same-simulation principal/index, canonical rounding, rewards, balances, event order and allowance checks replace the incorrect universal one-micro-unit rounding bound. Positive-position supply, partial/full withdrawal and tiny zero-mint behavior remain tested. Raw observed-effects hash v1 is unchanged; lawful fresh credit drift from999998 to999999 refuses with zero sends. No hash normalization, automatic retry or widened tolerance was introduced.

Actual bytecode preimages in the offline service corpus must hash-match production pins. Missing preimages now fail the suite instead of skipping acceptance. The real-App sponsorship suite passed17/17 with zero skips in the gate, including fresh-before-send faults and legitimate hash drift refusal.

Latest public run7 remains funded1USDC with no supply submitted. [Run7 evidence](<../../../AgentsLocal/46257332/v3/sepolia-compound-7.json>) preserves its earlier preview refusal. A separately authorized bounded live run is still required for mined supply, positive position, zero remaining approval, and sponsor/zero-ETH proof. This acceptance does not authorize public publishing, submission, or production use.
