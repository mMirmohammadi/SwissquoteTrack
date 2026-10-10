# Acceptance gate ledger

All entries begin UNVERIFIED. Populate only with commands and actual observed results, never a builder's assertion alone.

| Gate | Required evidence | State |
|---|---|---|
| Dependencies | pnpm install, reproducible lockfile; allowed esbuild postinstall | Installed after pnpm allowBuilds.esbuild=true; first failure was ERR_PNPM_IGNORED_BUILDS |
| Compile | workspace typecheck + production build | PASS final integrated pnpm typecheck && pnpm build (bash-489, final post-metadata source), exit0 |
| Contracts | copied harness tests, exact deployed module fixture | PASS npm test: 42 harness tests; older scenario delays noted in harness, not claim of live v2 | 
| Local core | devnet/story create, EIP1271 ownership, fund, owner send, 0 ETH, delay, recovery, GS026 | PASS pnpm devnet && pnpm story: 9 checks; independent local-chain suite 8 tests (7 cases + setup); local clock advanced, not real wait |
| Protective | both-module pending requests cancelled in one owner-signed batch | PASS local story and independent actual-contract suite |
| No-card refusal | bank+partner signatures cannot recover A/B | PASS local story and independent actual-contract suite |
| Kit | encrypt/decrypt and owner sweep without wallet/SQ/partner services | PASS local programmatic public-RPC-only sweep; actual saved-file offline decrypt/wrong-code and persistence checks PASS. No browser outage sweep proof |
| Security | adversarial independent tests; findings fixed and retested | PASS final full pnpm test with browser/local integrations enabled: 148 adversarial plus all package suites, zero failures/skips (bash-489, final post-metadata source). Mixture of actual contracts and explicitly labelled doubles, not audit |
| Browser | actual screens and portable saved file, virtual passkey authenticator | PASS mandatory5 and full real customer create/check/kit/fund/smallsend/largesend clickflow (bash-482). Actual SQ hash-bound passkey verification. Complete browser recovery/cancel/rotation remains unverified |
| Live | authorized Sepolia transactions + funded relayer/account + actual 180-second wait | NOT AUTHORIZED / UNVERIFIED |
| Demo laptop | human passkey/click test | UNVERIFIED |

Stopping condition: local build/core/security/browser verified or concrete missing evidence explicitly reported; live only after direct authorization/funding. No commits/push/submission authorization exists.
