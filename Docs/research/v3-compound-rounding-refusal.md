# Compound preview refusal: exact rounding diagnosis

**Decision:** the existing ±1-USDC-base-unit position check rejects a mathematically consistent Compound supply at the run-7 funding block. Two public nodes reproduce the exact refusal with a simulated credit of **999998**, not 1000000. Do not change the implementation or substitute an arbitrary larger tolerance. A protocol-specific exact-integer model is the supported correctness candidate; source-to-deployed-bytecode verification and regression/security tests remain acceptance work.

Only this report and an owned ignored diagnostic directory were created. Public RPC reads and unsigned `eth_simulateV1` calls were used; no state overrides, transaction broadcast, service preview POST, authentication, key/private-file access, funding, Git command or runtime change occurred. Existing runtime 1646 was left untouched. Synthetic hashes in RPC simulation output are **not mined transaction receipts**.

## Evidence and precise reproduction

Run 7's public [artifact](<../../AgentsLocal/46257332/v3/sepolia-compound-7.json#L78-L103>) identifies wallet `0x1a9E01F4C170c4674F02C6b85A9205D09132492d`, funding block 11887593 and starting USDC 1000000, position/borrow/allowance/Safe nonce zero. The parent supplied the service-audit refusal; no service audit/private log was read here. This investigation independently reproduces that literal from the repository interpreter.

The probe imports the actual [buildDappTx](<../../swissquote-wallet/apps/wallet/src/features/dapps/helpers.ts#L5-L22>) and [batch decoder](<../../swissquote-wallet/packages/protocol/src/dapps.ts#L44-L90>), not a manually approximated transaction. It builds supply amount 1000000 with Safe nonce 0, decodes its outer MultiSend, and uses the exact eight-before/three-action/eight-after probe order from [simulate.ts](<../../swissquote-wallet/packages/protocol/src/simulate.ts#L53-L91>). Canonical calls are approve(Compound,1000000), supply(USDC,1000000), approve(Compound,0), each zero-value CALL. Outer transaction is the helper's zero-value DELEGATECALL to pinned MultiSendCallOnly.

At fixed base block **11887593**, hash `0xa006f4e35ba55f0b867c92f1ed02e21090352febc6a8ed04e8d113b2d785b0cc`, timestamp **1791672120**, both `https://ethereum-sepolia-rpc.publicnode.com` and `https://sepolia.drpc.org` returned the same relevant evidence. Simulation block is **11887594**, timestamp **1791672132**. All 19 calls succeeded; both approvals returned true; every registered code/implementation/admin pin passed `verifyDappCode` at the base block.

Observed state inside the unsigned simulation:

- Wallet USDC: **1000000 → 0**, exact spend **1000000**.
- Wallet Compound `balanceOf`: **0 → 999998**, exact credit **999998**, difference from requested amount **−2** base units (0.000002 USDC).
- Wallet Compound borrow: **0 → 0**; wallet EURC: **0 → 0**.
- All four USDC/EURC allowances to Uniswap/Compound: **0 → 0**.
- USDC Transfer wallet→Compound and Compound Supply wallet→wallet both report **1000000**. Compound mint Transfer zero→wallet reports **999998**. Approval events report **1000000** then **0**.

The unchanged [effects interpreter](<../../swissquote-wallet/packages/protocol/src/simulate.ts#L117-L120>) throws code `EFFECTS_MISMATCH` and exact message `Compound effects do not match a supply-only withdrawal/supply`. Its lower accepted position bound is **999999**; observed **999998** fails that clause. EURC/spend checks pass, as do the earlier debt/permission checks. This is a direct replay at the actual funding block, not proof that the historical service selected exactly that same base block: the historical preview block/raw response was not available.

At later base block **11887603**, hash `0x8ee299e125eca2b0952f531dc58043383bf1751434920593f27a1642678d8ff2`, dRPC simulation at timestamp **1791672252** instead credits **999999** and the existing full effects interpreter passes. Effects hash is `0x8de52964c361125b730f88f22fd4f61cc54a617ab89e9165c6250a570c4ffeeb`. This pass is unsigned simulation evidence only; actual wallet position remains zero. PublicNode's parallel latest-block run intermittently returned `block not found: 0xb563f3`; the fixed funding-block replay subsequently succeeded on both nodes.

Raw evidence: [funding-block results](<../../AgentsLocal/6b2f81a9/funding-block-result.json>) and [later-block results](<../../AgentsLocal/6b2f81a9/result.json>). Reproduction implementation: [owned diagnostic probe](<../../AgentsLocal/6b2f81a9/probe.ts>). Its `nonce` field uses Ethereum `eth_getTransactionCount`, **not Safe nonce**: the returned 1 reflects contract-account nonce and must not be used as Safe transaction nonce evidence. Safe nonce 0 is supplied by the run artifact and helper input, not independently reverified by that field.

## Why one principal unit can cost more than one USDC base unit

Compound records integer principal, then translates principal into the displayed USDC balance using the interest index. The scale is **1000000000000000** (1e15), not the USDC decimal scale. Primary upstream source: [CometCore](<https://raw.githubusercontent.com/compound-finance/comet/main/contracts/CometCore.sol>) defines `BASE_INDEX_SCALE = 1e15`, `principalValueSupply = floor(presentValue * scale / index)`, and `presentValueSupply = floor(principal * index / scale)`.

[Compound's current main implementation](<https://raw.githubusercontent.com/compound-finance/comet/main/contracts/CometWithExtendedAssetList.sol>) defines `accruedInterestIndices`, `getUtilization`, `getSupplyRate`, `supplyBase`, and `balanceOf`. Supply accrues the index, adds the actual received tokens to the current present balance, rounds back to principal, and rounds principal forward to the displayed balance. `balanceOf` projects interest in a view call; it does not need a prior state-changing accrue. The deployed implementation's public getters and observed result agree exactly with this math. **This is behavioral evidence, not a verified source/bytecode identity proof**: [Etherscan implementation source](<https://sepolia.etherscan.io/address/0xe3e0106227181958abfba960c13d0fe52c733265#code>) returned HTTP 403; [Sourcify](<https://sourcify.dev/server/files/any/11155111/0xe3e0106227181958abfba960c13d0fe52c733265>) returned HTTP 404, not verified. Upstream main is a moving reference, not a pinned deployed version. On-chain code hash remains the repository's exact pinned implementation hash `0x210f4eb2374e25850607bdb9f4f41f183c1cc881e932a0e4f304279ef3f6e4f9`.

At the funding block, actual `totalsBasic()` reports:

- Stored supply index **1437404818773468**; borrow index **1533718315546426**; last accrual timestamp **1791652656**.
- Total supply principal **1636868415756**; total borrow principal **1538191064853**.
- Utilization **1002681548101469396** (factor scale 1e18). Supply kink **850000000000000000**.
- Supply rate base **0**; low slope **1522070015**; high slope **50735667174**, all per-second factor-scale values. `getSupplyRate(utilization)` returns **9040159720**.
- Wallet `userBasic` principal **0** and other returned fields zero; `baseToken()` is the pinned USDC.

Let S=1e15, I=stored supply index, r=per-second supply rate, t=simulation timestamp, t0=last accrual timestamp, J=accrued supply index, a=1000000. Every division below is integer floor:

```text
r = 0 + floor(1522070015 * 850000000000000000 / 1e18)
      + floor(50735667174 * (1002681548101469396 - 850000000000000000) / 1e18)
  = 9040159720
elapsed = 1791672132 - 1791652656 = 19476
J = I + floor(I * r * elapsed / 1e18) = 1437657897106916
newPrincipal = floor(a * S / J) = 695575
remainder = a * S - newPrincipal * J = 1108219856903300
newBalance = floor(newPrincipal * J / S) = 999998
loss = a - newBalance = ceil(remainder / S) = 2
```

One principal tick is worth **J/S ≈ 1.437657897106916 USDC base units**. Rounding away less than one principal tick, then flooring the displayed balance, can therefore lose two USDC base units. The comment asserting one base unit is not a sound bound for this index.

At the later simulation timestamp, elapsed=**19596**, J=**1437659456431214**, principal remains **695575**, remainder becomes **23592858321950**, and floor(principal*J/S)=**999999**. The two outcomes follow from different fractional remainders, not unexplained token loss or interest earned by a pre-existing position. Since the starting principal is zero, legitimate old-position growth is exactly zero. Before/after probes within each simulation share one timestamp; existing positive principal, if supported later, should be valued at that same accrued index rather than compared across wall-clock blocks.

## Supported correctness candidate, not an implementation change

For nonnegative starting principal P, same simulation timestamp and index J, and signed supply/withdraw action A (+a supply, −a withdrawal), the protocol-specific prediction is:

```text
B = floor(P * J / S)
require B + A >= 0  // never authorize crossing into borrow
P_expected = floor((B + A) * S / J)
B_expected = floor(P_expected * J / S)
require observedPrincipalAfter == P_expected
require observedBalanceBefore == B
require observedBalanceAfter == B_expected
```

For the current zero-position supply this predicts **exactly 999998**, rather than accepting every loss up to an arbitrary ceiling. If using only a mathematical diagnostic bound, loss is nonnegative and at most `ceil(J/S)`; here that upper bound is **2**. This bound is index-dependent and **not** sufficient authorization by itself. For withdrawals, rounding reduces the residual supply balance, so the position reduction can exceed the requested withdrawal by the deterministic residual-rounding loss; a symmetric ±n check still fails to express the mechanism.

Continue requiring exact token spend/receive, zero existing/after debt, selected allowance zero before/after, unchanged unrelated allowances/EURC, canonical recipient/amount/call order, current code and upgrade pins, complete successful RPC results and expected events. Reject observed principal or displayed credit below or above the exact model; neither malicious extra loss nor fabricated extra credit is rounding. Add model inputs/observations as same-block simulation probes (without state overrides); do not rely on separate latest reads. A token Supply event alone cannot establish principal correctness.

## Acceptance work and stopping condition

Diagnosis acceptance achieved: canonical helper-built batch, two-node fixed-block unsigned replay, exact failing predicate, exact integer loss reconstruction, and a later passing sample explaining intermittent behavior. No supply was broadcast or mined.

Before adopting the candidate, obtain immutable source/compiler/build correspondence for the pinned deployment, or an independently reviewed bytecode-level equivalent; capture actual simulated post-action principal/index/time, not just derived principal; add regression vectors for both recorded indices, positive principal, withdrawal without debt, zero/one/two-unit rounding boundaries, index changes and overflow/revert conditions. Include negative tests for extra token loss, principal/credit mismatch, recipient diversion, debt, permissions, missing logs, unexpected growth and pin changes. Check preview→relay effects-hash behavior: [revalidation](<../../swissquote-wallet/packages/protocol/src/simulate.ts#L154-L157>) currently hashes observed position exactly, so a legitimate remainder change from 999998 to 999999 changes the hash. Do not normalize away evidence without a separately reviewed authorization design.

The historical service-selected preview block and raw response are still missing, so the exact historical numerical result is not asserted as observed. The independently reproduced refusal at the artifact's funded state establishes a concrete rounding defect in the current bound. Stop here: preserve the funded wallet/runtime, do not fund another run, do not edit bounds, and treat any future browser/private restoration or transaction as separately authorized work.
