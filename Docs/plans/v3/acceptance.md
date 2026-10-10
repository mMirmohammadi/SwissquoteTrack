# V3 local acceptance

## Current registration-correction acceptance

Managed job `bash-1435` exited 0: **518 passed, zero skipped**, typecheck/build passed, 423.3 seconds before cleanup. The independent [registration source inventory](<registration-test-inventory.md>) accounts for 476 Node tests and 42 contracts before this run. Suite counts: scripts12, recovery-tool26, wallet42, partner14, Swissquote85, protocol-package31, browser33, external-protocol100, security72, integration61, contracts42. Evidence: [gate log:3579–3580](<../../../AgentsLocal/46257332/v3/gate-registration-final.log#L3579-L3580>).

The aggregate includes activity-guarded registration, retained unregistered wallets, receipt-bounded freshness, transport isolation and the original complete local-browser recovery. It does **not** establish the original Compound refusal cause or mined Compound execution. A tail-only status probe matched deliberate shutdown error text after `GATE PASS`; the managed job exit0 and complete log establish success, not that probe. Only owned isolated processes were stopped; the v2 demo remains untouched.

## Historical checkpoints

Historical checkpoint below: managed job bash-1236 completed with exit 0. The later live payment is separately [verified](<../../research/v3-live-payment-evidence.md>); Compound remains incomplete. **Post-live-fix aggregate acceptance passed: managed job bash-1358 exited 0, 480 passed, zero skipped, typecheck/build passed, duration 432.1 seconds before cleanup.** The independent [source inventory](<current-test-inventory.md>) matches 438 Node tests plus 42 contracts. Node suites: scripts 12, recovery tool 26, wallet 27, partner 14, Swissquote 64, protocol package 29, browser 33, protocol acceptance 100, security 72, integration 61. This current full gate includes real local waiting-period recovery and encrypted-kit/browser acceptance; it is not mined Compound or hardware/compliance evidence. Earlier post-fix gate bash-1346 passed 438 Node tests but failed one contract timestamp boundary because browser interval-mining configuration leaked into Mocha. The [clock-isolation correction](<gate-interval-mining-finding.md>) separately passed 42 contract tests (bash-1357); those separate results are not a complete aggregate pass.

- Typecheck and build passed.
- Aggregate: 433 passed, zero skipped; elapsed 426.9 seconds before owned-process cleanup.
- Node suites: scripts 12; recovery tool 18; wallet 27; partner 14; Swissquote 39; protocol package 29; browser 19; protocol acceptance 100; security 72; integration 61. Total Node 391.
- Contract harness: 42 passed, no pending.
- Original browser recovery executes card+partner start, protective cancel, fresh-nonce restart, natural 180-second wait plus margin, downloaded replacement-kit offline decryption, finalization, current-owner promotion and old-key refusal. Module B is checked clear locally, not separately finalized.
- Original browser kit/funding/payment flow passed in the aggregate and twice on separate fresh runtimes: 20-USDC MOCK funding, 1-USDC owner payment without step-up, 6-USDC payment with exactly one hash-bound virtual-WebAuthn verification.
- Runtime cleanup stopped only owned isolated ports 5273/5274/4101/4102/8645. Existing v2 stack was not stopped or reset. Shutdown pnpm error text follows the aggregate pass when owned process groups are deliberately terminated; managed gate exit remains 0.

Local chain, MOCK identity/bank/face/screening and virtual authenticator are not live compliance, hardware authentication, independent infrastructure or public-chain service sponsorship proof. Public Sepolia scripted contract evidence is separate: 23 successful records including 11 mined transactions. Live browser/service RELAYER and mined DeFi remain unverified.

Source evidence: ignored local AgentsLocal/46257332/v3/gate-final.log, lines 3063–3064; individual suite counts throughout that log. This document preserves the inspected result without publishing verbose runtime logs or test credentials.
