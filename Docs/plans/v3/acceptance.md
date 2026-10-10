# V3 local acceptance

Lead managed job bash-1236 completed with exit 0.

- Typecheck and build passed.
- Aggregate: 433 passed, zero skipped; elapsed 426.9 seconds before owned-process cleanup.
- Node suites: scripts 12; recovery tool 18; wallet 27; partner 14; Swissquote 39; protocol package 29; browser 19; protocol acceptance 100; security 72; integration 61. Total Node 391.
- Contract harness: 42 passed, no pending.
- Original browser recovery executes card+partner start, protective cancel, fresh-nonce restart, natural 180-second wait plus margin, downloaded replacement-kit offline decryption, finalization, current-owner promotion and old-key refusal. Module B is checked clear locally, not separately finalized.
- Original browser kit/funding/payment flow passed in the aggregate and twice on separate fresh runtimes: 20-USDC MOCK funding, 1-USDC owner payment without step-up, 6-USDC payment with exactly one hash-bound virtual-WebAuthn verification.
- Runtime cleanup stopped only owned isolated ports 5273/5274/4101/4102/8645. Existing v2 stack was not stopped or reset. Shutdown pnpm error text follows the aggregate pass when owned process groups are deliberately terminated; managed gate exit remains 0.

Local chain, MOCK identity/bank/face/screening and virtual authenticator are not live compliance, hardware authentication, independent infrastructure or public-chain service sponsorship proof. Public Sepolia scripted contract evidence is separate: 23 successful records including 11 mined transactions. Live browser/service RELAYER and mined DeFi remain unverified.

Source evidence: ignored local AgentsLocal/46257332/v3/gate-final.log, lines 3063–3064; individual suite counts throughout that log. This document preserves the inspected result without publishing verbose runtime logs or test credentials.
