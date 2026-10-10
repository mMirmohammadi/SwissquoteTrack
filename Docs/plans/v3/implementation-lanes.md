# Active v3 implementation lanes

Status: implementation in progress, not a passing verification report. Worktree
`/home/dev/Hackaton/SwissquoteTrack/.worktrees/v3`, branch `v3`, base `ce6f3d3`.
Main user demo and chain remain untouched. Lead alone owns public testnet runs.

| Lane | Owner | Exclusive write scope |
| --- | --- | --- |
| L0 lead | 46257332 | protocol api/index; wallet feature context/index/testids; root package/lockfile; integration docs |
| L0 gate | 96691cab-dd87-40d0-94b7-8ddd73a1c75e | dev/local-demo/prepare-local-demo/.env.example; scripts/gate.mjs and v3-local.mjs |
| L1 plumbing | 677ae6c4-3edd-4904-9fe8-0d12fb2c284c | protocol verification/constants/signing; service and wallet chain.ts; sepolia launcher/distribution utilities; v3-sepolia tests |
| L3 recovery | 19c9c5e5-e7ff-4d97-8286-3e424fac73b6 | wallet recovery/alert features; v3-recovery-services integration test |
| L4 shell | 85c773e7-072a-4f4d-b80e-43401f746c2e | wallet App/styles/api/storage/lifecycle/main; protection/pay/settings features |
| L5 protocol | aed0ae15-0af9-47fd-a98d-d12dc5a34f68 | dapps/simulate/classifier; v3-dapps protocol tests; fork utility |
| L6 service | eb6f57db-14e0-46fd-9a3c-24414a2d1484 | Swissquote service except chain.ts |
| L7 DeFi UI | d4901c3e-5899-4fbe-a5f6-ff8366389863 | wallet features/dapps only |
| L10 docs | 96a39db5-08b2-4477-9d49-a1ecd7d20a8d | Docs/submission except evidence |

Deferred until capacity frees: L8 trust, L9 partner/privacy/demo, L11 pitch,
L12 browser, L13 independent verification. L2 run currently owned by lead in main.
Builders run scoped tests only; full suites via isolated gate. No builder Git writes,
service-key access, external publication, or transactions. Shared interface changes
require lead integration. The guarded-wallet prototype is explicitly rejected.
