# Retention correction acceptance

**PASS: 519 tests, zero failures/skips, plus typechecks and builds.** Parent-owned isolated gate `bash-1604` exited 0; exact summary at ignored lead log `AgentsLocal/46257332/v3/gate-retention-final.log:3586`: `GATE PASS: passed=519, skipped=0, duration=435.2s`.

[Source inventory delta](<retention-test-inventory.md>) approved 519 before execution: 477 Node tests + 42 contracts. Suite totals: scripts12, recovery-tool26, wallet42, partner14, Swissquote85, protocol31, browser34, protocol acceptance100, security72, integration61, contracts42. No pending contract tests. The original real-wait browser recovery remains in this gate; chain clock isolation preserves its natural 180-second delay.

Changes covered: exact optional canonical uint64 `deploymentBlock` retention metadata, strict raw state/envelope preservation, a table-driven regression, and public fail-closed Compound stage labels/exact accessible Action combobox selector. Child and parent independently passed the affected retention suite15/15 before the aggregate run.

Owned process-group cleanup emits pnpm termination errors after the success summary; the job exit was 0. A tail-only status probe missed the earlier summary and reached its deadline; it did not indicate gate failure. Full log reconciliation established the summary and every suite count.

**Live Compound remains incomplete.** Latest authorized run deployed and funded 1 test USDC, passed registration/tool/retention and two-node pre-supply state checks, then timed out before a service preview or supply POST. The wallet's encrypted state is preserved; this local gate does not execute the public supply. See [live checkpoint](<live-verification-checkpoint.md>) and [read-only selector diagnosis](<../../research/v3-compound-preview-readonly-diagnosis.md>). No new funded attempt was made after diagnosis.

Main v2 chain and demo were not stopped or reset. No public hosting, publication or submission is authorized by this acceptance.
