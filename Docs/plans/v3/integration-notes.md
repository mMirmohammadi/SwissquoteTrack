# V3 integration notes — implementation in progress

## Frozen interfaces

Lead owns protocol api.ts/index.ts and wallet features context.ts/index.ts/test-ids.ts.
Builders preserve exported stubs; request additional fields here rather than editing shared files.

## L5 → L6 simulation boundary

simulateCalls is an unsigned wallet-origin sequential simulation with observed pre/post
balances and allowances, effectsHash, code/proxy pins and fresh quote. It does not prove
Safe signatures. L6 must both resimulate calls and compare reviewed effectsHash, and keep
existing signed Safe execution preflight immediately before broadcast. Static checkDappBatch
cannot prove freshness or code identity. Compound withdraw is a standalone call; supply and
swap require exact approve/action/revoke0 batches.

## DeFi wire contract

POST /dapps/preview uses DappPreviewRequest {wallet,tx:SafeTxWire,dappId}; response
{summary:string[],effectsHash,blockNumber,dappId,warnings}. GET /dapps should return
{dapps:DappEntry[]} using registry id/name/address/chainId/warning. L7 encodes calls
using protocol MultiSend helpers and reads QuoterV2 via simulateContract. L5 expose
registry details needed for router/quoter/token/Compound or exported constants.

## L4 → recovery

Shell refresh reloads current encrypted device metadata after promotion. Recovery lane
must call context.refresh after installing replacement. No feature edits shared context.

## Test isolation

Local gate owns chain8645; never connect/reset/advance8545. Browser tests with hardcoded
4001/4002 must be parameterized before the v3 gate. Sepolia story run owner is lead;
no builder may broadcast or read service keys.

## Evidence

ETH distribution confirmed on Sepolia blocks11886624–11886626. Full story completed23 successful records /11 mined transactions in evidence/sepolia/full-2026-10-10T19-28-59Z.json. Real180s module-A finalization, both-module cancellation, readonly oldkey GS026 and helpers-without-card refusal, current-kit3USDC sweep and owner rotation. Scripted TREASURY payments are not service-relayer/browser/passkey evidence. ModuleB was started/cancelled, not finalized after3days.

## Current acceptance checkpoint

Original complete recovery browser acceptance passed in gate7 after the evidenced stale-device notice fix. The original payment/kit clickflow then passed twice on fresh owned local runtimes (root AgentsLocal/c8a63f29/clickflow-owned-2.log and AgentsLocal/2d48e091/clickflow-fresh.log): independent card/setup proof, encrypted kit actual download/offline opening, 20-USDC MOCK funding receipt, owner-signed 1-USDC payment without step-up and 6-USDC payment with exactly one hash-bound virtual-WebAuthn step-up. No Retry registration workaround or reordered stages. Lead also repaired App.refresh metadata-only invalidation found by source inspection; tests now preserve verified identity/check after backup timestamps. Browser tests remain local/MOCK/virtual-authenticator evidence, not Sepolia RELAYER or hardware proof. Final aggregate expected433 gate bash-1236 running; no overall pass yet.

## Historical security acceptance and integration repairs

Historical independent L13 regression tests discovered21:19pass2fail0skip before fixes. L6 completed durable pending/uncertain sender latch and globally disabled fooled signing. Independent follow-up59d911c6-7278-4a25-932e-8f3a6dba31af ran27tests27pass0skip twice, including real SQLite close/reopen, different-wallet cancel blocked, settled-release and missing-API refusal. Original defects no longer reproduced in offline injected-chain tests; this is not live/browser evidence. Lead owns isolated8645 gate; no gate pass claimed yet. Initial integrated typecheck/build and96protocoltests passed; later concurrent changes require rerun. Gate discovers recursive wallet feature .test.tsx files and enables fixed approved runtime flags; unit test processes explicitly clear inherited SQ_FEATURES so legacy injected fixtures do not silently change policy (strict fixtures explicitly enable it). Independent source inventory in AgentsLocal/4dd376f2/gate-test-count.md established425 tests (383 Node +42 contracts); subsequent partner privacy regressions add8, approved expected433 before aggregate rerun. Security-only recheck passed72/72 zero skips; full gate has not passed. Browser trust-check passed. Lead bounded diagnostic proved deployment failure caused by omitted PARTNER_ALLOWED_ORIGINS for isolated5273 origin (partner server default5173 refuses CORS); after configuring only localhost/127.0.0.1:5273, real virtual-passkey registration, both guardian enrollments, mineddeployment, EIP1271ownership registration and kitcreation succeeded. Complete browserrecovery acceptance is running; not passed yet. A second actual diagnosis proved Protection metadata GET403 before POST/wallets200 due App publishingcontext before registration, and ownershiprefusal incorrectly suppressedpublicreads. Lead now publishescontext after registration and isolatesownership-service failure from publicchainchecks; partialrecovery persistence/realofflinekit browser acceptance and trust-check passed. Fullbrowser original acceptance failed finalization notice assertion. Actual bounded diagnostic061e57c0 completed230682ms: finalize/registration200, minedreceipt, bothnodes sole replacement threshold1/bothmodulesclear, GS026 no relay/noncechange, reload/unlock/promotedsetup and currentkit checks passed. Noticehistory registered→stale-old-device proved App.refresh capturedolddevice overwrote success, not API/promotionfailure. Lead now compares fresh stored effectiveowner and suppresses comparisons when promotion changed duringRPCread. Original aggregate433-test gate rerun bash-1202 running; original fullbrowserpass not yet claimed. Integratedtypecheck passed afterrepairs; service39/39 and security72/72zero-skip, contracts42pass0pending. These remain scoped evidence, not aggregateacceptance. Contract recheck initially41pass1pending because ignored abstractionkit vendorfixture missing; restored existing main immutablefixture without overwrites, rerunning42 checks. No pending count accepted. The canonical portable tool was rebuilt twice with VITE_CHAIN/VITE_RPC_URLS unset: byte-identical400460-byte Sepolia artifact SHA-256 a9e4db3f95bf5ae541a3322ad6d087f25cd29f5035e998589fa371c9c4c931db. Local embedded8645 configuration produces a distinct documented hash, not a replacement canonical reference.
D3/D4/D5 remain undecided; no external publication authorized.
