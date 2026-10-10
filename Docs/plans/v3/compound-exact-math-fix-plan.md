# Compound: smallest exact-math fix and authorization gate

**Decision:** replace the ±1 position predicate with an exact, same-simulation-timestamp principal/index model, not a larger tolerance. Keep the current exact observed-effects hash for the first patch (P0); a legitimate later credit change must still refuse relay, with no automatic retry. This fixes the reproducible math rejection but does **not** solve preview-to-relay availability. A separately reviewed authorization-envelope design is the candidate for that second problem.

This is a plan, not implementation approval evidence. Only this document and [owned ignored probes](<../../../AgentsLocal/8f23ad61/probe.ts>) were created. No implementation edit, dependency installation, private/API-key/auth access, Git operation, state override, broadcast, funding or runtime change occurred. Runtime bash-1646 and main runtimes 374/487 remain untouched. No further funding is planned until correctness is accepted.

## Evidence added beyond the diagnosis

The [full refusal report](<../../research/v3-compound-rounding-refusal.md>) remains the original diagnosis. New public unsigned fixed-block replay at base **11887593**, simulation **11887594**, timestamp **1791672132**, on PublicNode and dRPC gives the same exact observations in [raw extended results](<../../../AgentsLocal/8f23ad61/result.json>):

- Stored supply index 1437404818773468, last accrual 1791652656; pre-action utilization 1002681548101469396 and supply rate 9040159720.
- Actual post-action `totalsBasic.baseSupplyIndex` **1437657897106916**, `lastAccrualTime` **1791672132**, and actual `userBasic.principal` **695575**, not merely derived values. Actual displayed credit **999998** agrees exactly. Total supply principal increases 1636868415756 → 1636869111331; total borrow principal stays 1538191064853. Wallet principal starts zero and debt/allowances remain zero.
- Post-action utilization is **1002702493131017962**. A separate deterministic fixed-block replay with an appended `getSupplyRate(postUtilization)` call returns **9041222380**, matching immutable-constant math. The main 31-call replay calls `getSupplyRate(preUtilization)` both before and after and correctly returns the old rate; it must **not** be described as the fresh post-utilization rate. Production static calldata can probe a known pre-utilization argument, then independently compute/check post-utilization math; diagnostic two-pass replay establishes the new rate without pretending calldata can depend on an earlier return value.

Existing code pins pass on both nodes. The implementation has **19027 runtime bytes** and CBOR tail `...a2646970667358221220d326c7b1c685fda5defac52f8cf57a0ceec8f9906d883f04954a8cfdde4de18664736f6c634300080f0033`, consistent with Solidity **0.8.15** metadata. Metadata IPFS identifier is `QmcYu2kggq9JoPGNYZ51dHkbqViUQFLSMyB4KntxEuSRtH`; both [ipfs.io](<https://ipfs.io/ipfs/QmcYu2kggq9JoPGNYZ51dHkbqViUQFLSMyB4KntxEuSRtH>) and [dweb.link](<https://dweb.link/ipfs/QmcYu2kggq9JoPGNYZ51dHkbqViUQFLSMyB4KntxEuSRtH>) returned HTTP 429. Compiler-version agreement is not a source/build identity proof.

### Source and deployment correspondence: still unverified

Upstream main resolved through the [GitHub commit API](<https://api.github.com/repos/compound-finance/comet/commits/main>) to **f766f51583c23acc33b2a7824654ef2029a96804**. Use immutable references for the candidate, not moving main:

- [CometCore](<https://github.com/compound-finance/comet/blob/f766f51583c23acc33b2a7824654ef2029a96804/contracts/CometCore.sol>): BASE_INDEX_SCALE=1e15, FACTOR_SCALE=1e18, floor supply conversions; borrow conversion rounds upward.
- [CometWithExtendedAssetList](<https://github.com/compound-finance/comet/blob/f766f51583c23acc33b2a7824654ef2029a96804/contracts/CometWithExtendedAssetList.sol>): constructor immutables, accrue/view ordering, supply/withdraw principal accounting and mint/burn events. The main source was fetched; the immutable main-interface/core/extension references were fetched separately. No build was attempted and no exact upstream revision has been identified as the deployment's source.
- [CometStorage](<https://github.com/compound-finance/comet/blob/f766f51583c23acc33b2a7824654ef2029a96804/contracts/CometStorage.sol>) and [CometExt](<https://github.com/compound-finance/comet/blob/f766f51583c23acc33b2a7824654ef2029a96804/contracts/CometExt.sol>): exact tuple layouts; totals/scales are extension fallback getters, not direct main getters.
- [Build configuration](<https://github.com/compound-finance/comet/blob/f766f51583c23acc33b2a7824654ef2029a96804/hardhat.config.ts>): Solidity 0.8.15, viaIR=true, optimizer enabled/runs=1 with explicit custom Yul steps unless OPTIMIZER_DISABLED. Do not execute that config: it reads environment/key/provider settings. A future offline standard-JSON build must reconstruct settings and source hashes without private configuration or installing a package in this task.

Constructor copies token, extension, governors, scales and risk/reward settings into immutables; annual rates are integer-divided by 31536000 to obtain per-second rates. Observed immutable getters: USDC base token, baseScale 1000000, supplyKink 850000000000000000, supply base 0, low slope 1522070015, high slope 50735667174. These match behavior, not an authenticated constructor-argument/build match.

Current [pins](<../../../swissquote-wallet/packages/protocol/src/simulate.ts#L12-L28>) retain proxy hash `0x64952234eab8f3aed74355c49119f627965640b1efeb6b28430b5a31b0d3b192`, implementation `0xe3e0106227181958abfba960c13d0fe52c733265` / `0x210f4eb2374e25850607bdb9f4f41f183c1cc881e932a0e4f304279ef3f6e4f9`, and admin address/code hash. **New trust edge:** observed extensionDelegate is `0xdCbDb7306c6Ff46f77B349188dC18cEd9DF30299`, code hash `0x462b212abc00fb7e835d516da02805a359663ee9dd1050a4f827f17b1185cab2`. The existing list does not pin it. Add a same-base-block immutable address read and runtime hash pin before trusting totals/scales; inspect whether extension itself has delegate/proxy dependencies. Do not label this deployment an official Compound market.

Acceptance prerequisite: retrieve metadata/source hashes, compiler standard-JSON settings, constructor immutable references/values and deployment input where public; compare the exact deployed runtime (including linked libraries/immutable substitution/metadata), or obtain independently reviewed bytecode equivalence of every relied-on path. Etherscan 403/Sourcify 404 from the earlier report remain unresolved. Do not claim GitHub main “build matches” from ABI/getter/behavior/compiler-version agreement. If identity cannot be proved, stop before live acceptance; public replay is valuable corroboration but not the missing proof.

## Exact probes, parser and model

[Current probes/parser](<../../../swissquote-wallet/packages/protocol/src/simulate.ts#L53-L71>) accept scalar data only and discard timestamp. Keep the eight original balance/debt/allowance probes; append action-specific Compound probes, keeping Uniswap behavior unchanged. Use exact ABI:

```text
userBasic(address) returns (int104 principal,uint64 baseTrackingIndex,uint64 baseTrackingAccrued,uint16 assetsIn,uint8 reserved)
totalsBasic() returns ((uint64 baseSupplyIndex,uint64 baseBorrowIndex,uint64 trackingSupplyIndex,uint64 trackingBorrowIndex,uint104 totalSupplyBase,uint104 totalBorrowBase,uint40 lastAccrualTime,uint8 pauseFlags))
getUtilization() returns (uint256)
getSupplyRate(uint256 utilization) returns (uint64)
baseIndexScale() returns (uint64)
factorScale() returns (uint64)
extensionDelegate() returns (address)
```

`totalsBasic` is one static tuple (eight words); `userBasic` is the public mapping getter (five words). Require exact lengths, canonical uint widths/int104 sign extension and re-encode equality; never use generic scalar BigInt on a tuple or signed principal. Reject negative principal even if displayed borrow floors to zero. Parse canonical simulated number **and timestamp**; require number=base+1, timestamp in uint40 domain, timestamp >= stored lastAccrualTime, and same-block evidence throughout. Base header/time may be recorded for consistency but cannot replace simulated time.

Production minimum can append userBasic/totalsBasic/getUtilization (11 before + actions + 11 after = **25 supply calls / 23 withdrawal calls**), derive the rate from pinned immutable constants, and check the public getSupplyRate at the same base block for deployment configuration. If retaining the diagnostic rate/scales in production: **14 before + 3 actions + 14 after = 31 supply**, or **29 withdrawal**; approved dynamic probe plans must define exact counts rather than blind hardcoded indexes. Rate before/after at a single known argument is only a rate-function consistency check. The deployed extended diagnostic had 31 main calls plus a separate 32-call replay for post-rate verification.

Define S=1e15, F=1e18, I=stored supply index, Ib=stored borrow index, Ts/Tb=stored total principals, t0=last accrual, t=simulation timestamp, P=wallet principal, a=canonical signed-call amount. All nonnegative divisions below are integer floor. Validate Solidity widths/checked intermediate operations; JavaScript BigInt alone does not emulate overflow/revert.

```text
storedSupply = floor(Ts * I / S)
storedBorrow = floor(Tb * Ib / S)
U = storedSupply == 0 ? 0 : floor(storedBorrow * F / storedSupply)
r = base + floor(low * min(U,kink) / F)
          + (U > kink ? floor(high * (U-kink) / F) : 0)
J = I + floor(I * r * (t-t0) / F)
B = floor(P * J / S)
A = supply ? a : -a
require P >= 0 and B + A >= 0
Q = floor((B + A) * S / J)
C = floor(Q * J / S)
require observedBalanceBefore == B
require observedPrincipalAfter == Q
require observedBalanceAfter == C
require observedIndexAfter == J and observedLastAccrualAfter == t
```

The contract accrues using **stored** utilization before totals are changed. Do not calculate J using post-action utilization. Post-action views have zero elapsed time because the action stored t; before views project the same J without writing it. Check totalSupplyBaseAfter = Ts + (Q-P), totalBorrowBase unchanged for the admitted no-debt subset; independently model borrow-index accrual and expected post utilization if those aggregate checks are included. TimeElapsed=0 retains indices/time, not a special unsupported case.

Preserve exact token spend/receive, unrelated token/allowance invariants, selected allowances zero, canonical wallet recipient, call order, zero values/operations, code/upgrade pins, complete success and event evidence. No credit above or below C is accepted as rounding. Existing-position interest is already in B at t, not an extra unexplained delta.

### Events: validate source semantics, not convenient deltas

The [current interpreter](<../../../swissquote-wallet/packages/protocol/src/simulate.ts#L122-L141>) allows empty logs and skips semantic validation of Compound-address logs. Tighten Compound action evidence: exact USDC Transfer wallet→Compound or reverse with amount a; exact Compound Supply(from=wallet,dst=wallet,amount=a) or Withdraw(src=wallet,to=wallet,amount=a); exact input approve a/revoke0 events for supply, none for withdrawal. Require cardinality/order and reject missing/duplicate/unexpected allowed-contract events, not just outside addresses.

Comet Transfer mint/burn event is **floor(abs(Q-P)*J/S)**, emitted only when the relevant principal difference is positive, from zero→wallet on supply or wallet→zero on withdrawal. For positive P, that need not equal C-B or its magnitude. A tiny supply can have Q=P and no mint event; encode that valid case. No collateral/borrow/manager events are admitted. Do not silently redefine observed balances to match events.

## Preview → relay authorization: critic verdict

[Observed hash](<../../../swissquote-wallet/packages/protocol/src/simulate.ts#L75-L78>) binds exact calls and observed amounts, but not block. [Relay revalidation](<../../../swissquote-wallet/packages/protocol/src/simulate.ts#L154-L157>) requires exact equality. Thus lawful 999998→999999 time drift changes the hash. **P0 retains this refusal deliberately**, and UI must say a fresh preview/review is needed, not loop or reuse a changed authorization. Timing may pass; it is not a guarantee of availability.

**Security critic outcome (self-review, not independent sign-off):** reject silently normalizing position to amount, hashing model outputs as if observed, dropping position from v1, or comparing fresh effects to fresh bounds not previously reviewed. Independent delegation was unavailable because this delegated agent is already at the configured depth cap; parent must obtain independent critic approval before envelope adoption.

Candidate explicit v2 authorization: retain exact raw observed-effects hash/audit separately. Preview records a distinct reviewed authorization envelope with chain, wallet, full SafeTxHash (including nonce and all outer fields), exact canonical calls, dapp/model/pin version, exact USDC amount and recipient, zero permissions/debt, and a mathematical maximum rounding loss. One narrow bound is K=ceil(Jpreview/S), with an explicitly reviewed admissible index ceiling **J <= K*S** and expiry; for this sample K=2. At every fresh simulation still require **exact** principal/index/balance math first, then admit delta `a-L` for supply or `-a-L` for withdrawal where 0<=L<=K (also enforce nonnegative residual). This permits lawful 999998/999999 without admitting extra unmodeled loss. The inequality is derived from the two integer projections, not an arbitrary larger tolerance. An admissible-index ceiling is part of the authorization, not a fixed source-code tolerance. If J exceeds it or model/pins/state/debt cease to meet conditions, require new review.

For a stable envelope across later state, include allowed starting-principal/state conditions explicitly: preferably bind starting principal P and fail on unrelated position changes, while allowing its time-projected B. Any support for changed P needs its own review. Preserve swap v1 semantics. If expiry or index envelope cannot be specified honestly, choose P0 rather than hide normalization.

**Important limitation:** the existing [service preview](<../../../swissquote-wallet/services/swissquote/src/app.ts#L120-L126>) writes an audit record, not a consumed authorization record. The [relay owner signature](<../../../swissquote-wallet/services/swissquote/src/app.ts#L162-L195>) authenticates the Safe transaction, **not effectsHash/envelope** supplied as HTTP metadata. Do not claim that a v2 envelope is cryptographically signed by the owner. Minimum service design stores issued preview/envelope against authenticated user+wallet+SafeTxHash, checks expiry/current nonce, consumes/reserves it atomically with existing send dedupe, and keeps failed simulations distinguishable from uncertain sends. If owner cryptographic consent to envelope is required, a separate reviewed signature/typed authorization is necessary; server records alone do not supply it. No new auth/keys/signatures are performed by this plan.

Any off-chain revalidation still cannot guarantee inclusion-time state matches; canonical pinned signed calls fix token amount/recipient, but a true on-chain minimum credit/expiry constraint would require an additional guarded call/contract and is outside this smallest patch. State this residual risk; do not promise simulation guarantees at mining time.

## Change map and acceptance tests

P0 implementation owner would touch [dapps.ts](<../../../swissquote-wallet/packages/protocol/src/dapps.ts#L28-L34>) for exact read/event ABI; [simulate.ts](<../../../swissquote-wallet/packages/protocol/src/simulate.ts>) for extension pin, typed action-specific probes/parser/model/events; and [policy fixtures](<../../../swissquote-wallet/tests/protocol/v3-dapps-policy.test.ts#L62-L108>) for timestamp/tuple/canonical logs/indexed layout. Preserve existing positive-principal withdrawal feature. Do not silently remove it or empty-fresh supply. A narrower unsupported-withdraw fail-closed release is possible only with explicit user scope approval and visible UI/policy change.

The existing focused read-only test command passed **41/41, zero failures/skips**: 27 dApp policy tests + 14 independent-policy tests. This baseline proves neither exact model nor live acceptance: fixtures currently accept empty events, supply balance exactly amount and missing timestamp/principal/index tuples. [Independent hash test](<../../../swissquote-wallet/tests/security/v3-independent-policy.test.ts#L87-L90>) must continue proving observed amount mutations change v1; add separate v2 tests rather than weakening it.

Required named test cases (report actual final test count, not planned counts as passes):

1. Replay both recorded J values: P=0,a=1000000 → (Q=695575,C=999998) and → C=999999; actual post principal/index/time agree. Wrong C±1 and Q±1 reject even inside a broader mathematical bound.
2. Supply with positive P; existing accrued balance measured at t; tiny amount/no principal change; losses 0/1/2; J=S and just above S/2S boundaries; exact overflow and signed104/uint64/uint40/uint256 errors; zero-total supply utilization; both rate-kink branches; elapsed=0 and t<t0.
3. Partial withdrawal from an existing position with deterministic residual loss; exact-full B withdrawal to Q=0; a>B rejection; negative starting principal/repayment/debt crossing and displayed-zero hidden debt reject. Empty fresh supply remains supported; empty fresh withdrawal rejects.
4. Parse missing/extra calls, malformed timestamp/block/status/tuple widths/sign extension/trailing data, failed getter/approve/action, absent/changed extension/main/proxy/admin pins; swaps retain original count/quote/hash behavior.
5. Exact USDC in/out; theft/extra loss/recipient diversion/false credit; pre-existing and changed allowances; unrelated EURC changes; missing/duplicate/malformed Supply/Withdraw/Approval/Transfer; positive-P mint/burn vs displayed-delta mismatch; unexpected collateral/manager events.
6. P0 hash unchanged between equivalent observations, but lawful recorded drift refuses with EFFECTS_MISMATCH and **zero sends**; no automatic retry. V1 wallet/calls/amount mutation remains rejected.
7. If v2 is separately adopted: equivalent lawful rounding admitted inside the issued envelope while raw hashes differ; envelope amount/recipient/nonce/wallet/chain/model/pin/index-ceiling/expiry/starting-P mutations reject; missing/unissued/expired/consumed record rejects; drift beyond ceiling rejects; exact-math mismatch rejects even inside envelope; simultaneous relay race cannot consume twice; simulation refusal leaves safe retry state, uncertain send never resets it.

Run targeted policy/security suites, protocol/service/wallet typecheck/build and adversarial suites using existing dependencies only. V2 adds [API interfaces](<../../../swissquote-wallet/packages/protocol/src/api.ts>), [service preview/relay](<../../../swissquote-wallet/services/swissquote/src/app.ts>), [wallet helpers](<../../../swissquote-wallet/apps/wallet/src/features/dapps/helpers.ts>), UI review copy and corresponding fixture/security tests under one integration owner. Existing service strict refusal tests must still prove no send when simulation/hash unavailable; add positive fully mocked simulation-before-send paths without live funds.

## Stop / handoff

This bounded source+plan phase stops with this document, owned unsigned two-node principal/index/rate evidence and the focused baseline count. **Exact deployed source/build correspondence remains open**; no independent security approval or implementation tests exist yet. Do not fund/run another wallet, alter bounds, sign or broadcast to work around a refusal. Next correctness acceptance requires deployed correspondence (or reviewed bytecode equivalence), exact-model/event/parser regressions, and an explicit P0-versus-v2 authorization decision with independent security review. Preserve runtimes and the already-funded wallet; only after acceptance may separately authorized G10/live work proceed.
