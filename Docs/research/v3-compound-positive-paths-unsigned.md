# Compound positive positions: unsigned deployed-path evidence

**Result: both public nodes reproduce exact positive-principal supply, partial withdrawal, full withdrawal of the displayed balance, and a tiny positive-principal supply with no mint. Full withdrawal leaves principal and debt exactly zero; no debt was fabricated or hidden.** This closes the missing deployed examples for the bounded [critic P0-C evidence request](<../plans/v3/compound-exact-math-critic.md#L43-L47>), not acceptance of the implementation or source/build identity.

## Evidence and safety boundary

Primary evidence is the complete HTTP JSON-RPC requests and raw responses from [PublicNode](<../../AgentsLocal/c94e170a/publicnode.json>) and [dRPC](<../../AgentsLocal/c94e170a/drpc.json>). The [isolated probe](<../../AgentsLocal/c94e170a/probe.mjs>) imports existing viem through `createRequire` anchored to the protocol package; it installs nothing and imports no application/service module. [Independent integer derivation](<../../AgentsLocal/c94e170a/math.mjs>) and [computed comparisons](<../../AgentsLocal/c94e170a/expected.json>) are separate from the production model. Prior ABI/probe evidence was read in full from the [earlier probe](<../../AgentsLocal/8f23ad61/probe.ts>) and [saved results](<../../AgentsLocal/8f23ad61/result.json>), as were the communication protocol, critic and [fix plan](<../plans/v3/compound-exact-math-fix-plan.md>).

Only public HTTPS endpoints `https://ethereum-sepolia-rpc.publicnode.com` and `https://sepolia.drpc.org` were contacted. The explicit method allowlist is `eth_chainId`, `eth_getBlockByNumber`, `eth_call`, `eth_getCode`, `eth_simulateV1`; anything else throws before HTTP. All chain reads use the explicit historical base block. Each simulation has exactly one `blockStateCalls` entry, unsigned `from=wallet` calls, zero value, `validation:false`, `traceTransfers:true`, and no state/block/account/allowance/ETH/balance overrides. There is no actual approve, supply, withdrawal, funding, signing or send. Calls to mutating selectors occur only inside `eth_simulateV1`.

Wallet is `0x1a9E01F4C170c4674F02C6b85A9205D09132492d`. Market is `0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e`; USDC is `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`. Both nodes identify chain 11155111, base **11887593**, hash **0xa006f4e35ba55f0b867c92f1ed02e21090352febc6a8ed04e8d113b2d785b0cc**, and simulation **11887594**, timestamp **1791672132**. The simulated parent equals the fetched base header; the header is fetched again afterward and remains stable. These are historical deterministic observations, not fresh relay acceptance or mined receipts.

The main/proxy/extension code hashes are captured at that same base. Main implementation is `0xe3e0106227181958abfba960c13d0fe52c733265`, hash `0x210f4eb2374e25850607bdb9f4f41f183c1cc881e932a0e4f304279ef3f6e4f9`; extension `0xdCbDb7306c6Ff46f77B349188dC18cEd9DF30299`, hash `0x462b212abc00fb7e835d516da02805a359663ee9dd1050a4f827f17b1185cab2`. This diagnostic does not independently re-audit every existing production code/storage pin and is not evidence that strengthened production pin enforcement passed.

## Deterministic call sequences

Every boundary contains the same fourteen probes: USDC/EURC/position balances, borrow balance, four token/spender allowances, userBasic, totalsBasic, utilization, supply rate at the fixed **pre-accrual utilization** argument, index scale and factor scale. Rate calldata is static and is not misrepresented as a fresh post-utilization-rate probe. Probe calls emit no logs.

First replay starts from real base state USDC **1000000**, position/principal/debt **0**, and all four allowances **0**. It simulates exact approve1000000/supply1000000/approve0, probes, withdraw500000, probes, approve499999/supply499999/approve0, probes, then approve1/supply1/approve0 and probes. Splitting the returned 500000 into 499999 plus 1 deliberately preserves one actual simulated wallet unit for the tiny-supply no-mint case; no balance override is needed. This is **80 calls** (70 probes, 10 action calls).

The full-withdraw replay rebuilds the same fresh supply prefix at the same fixed base, then encodes **999998** as a literal known amount learned from the preceding fixed replay, and probes. This is **46 calls** (42 probes, 4 action calls). The prefix again returns position999998 and principal695575 at the same timestamp. No calldata depends dynamically on an earlier return value inside a request.

A separate same-base replay uses the exact approve500000/supply500000/approve0 after partial withdrawal, consuming all simulated returned funds. Its raw requests and results are retained alongside the other replays. It is **63 calls** (56 probes, 7 action calls). All calls in all three replays succeeded on both nodes, all boundary probes emitted no logs, and all independent model comparisons passed. The two nodes' decoded stage vectors and expected-number records are identical.

## Hand-derived integer expectations

All nonnegative divisions are floor. Let S=1000000000000000 and F=1000000000000000000. Stored totals have I=1437404818773468, Ib=1533718315546426, Ts=1636868415756, Tb=1538191064853, last accrual1791652656; elapsed=19476.

Stored supply=floor(Ts*I/S)=2352842548505; stored borrow=floor(Tb*Ib/S)=2359151808974. U=floor(storedBorrow*F/storedSupply)=1002681548101469396. For either supply or borrow, rate=base+floor(low*min(U,kink)/F)+floor(high*max(U-kink,0)/F). Supply constants are base0, low1522070015, high50735667174, kink850000000000000000, yielding rate9040159720. Borrow constants base475646879, low1680618975, high53906646372, same kink, yield rate10134723228.

J=I+floor(I*9040159720*19476/F)=**1437657897106916**. Jb=Ib+floor(Ib*10134723228*19476/F)=**1534021046802407**. Both observed indices agree. Later actions are at zero elapsed time: indices and stored accrual time stay unchanged.

For starting principal P, B=floor(P*J/S); for signed action A, Q=floor((B+A)*S/J), C=floor(Q*J/S). Mint/burn amount=floor(abs(Q-P)*J/S), only if the corresponding principal transition is nonzero. TotalSupplyAfter=TotalSupplyBefore+Q-P. Expected total borrow principal stays1538191064853. These computations are independent integer derivations, not a claim of general Solidity overflow equivalence.

- Fresh supply: P0, B0, A+1000000 => Q**695575**, C**999998**, mint**999998**, total supply**1636869111331**, wallet USDC0.
- Partial withdrawal: P695575, B999998, A-500000 => Q**347786**, C**499997**, burn**500001**, total supply**1636868763542**, wallet USDC500000. The one-unit residual loss is exact model behavior, not an extra token transfer.
- Positive supply499999: P347786, B499997, A+499999 => Q**695572**, C**999994**, mint**499997**, total supply**1636869111328**, wallet USDC1.
- Positive supply500000 in its separate replay: P347786, B499997, A+500000 => Q**695573**, C**999996**, mint**499998**, total supply**1636869111329**, wallet USDC0. Here C-B=499999 differs from mint499998: principal-difference event validation is essential.
- Tiny supply1: P695572, B999994, A+1 => Q**695572**, C**999994**, **no mint**, total supply**1636869111328**, wallet USDC0. Actual USDC spend1 is not fictitious credited principal.
- Exact full withdrawal: P695575, B999998, A-999998 => Q**0**, C**0**, burn**999998**, total supply**1636868415756**, wallet USDC999998. Actual signed principal0 and displayed borrow0 corroborate no debt; this is not merely a displayed-debt floor test.

For every stage, actual principal, balance, both accrued indices, total supply/borrow and post-utilization agree with these equations on both nodes. Post-utilization is independently calculated from **both accrued indices**, never from the old borrow index. It is 1002702493131017962 after fresh supply, 1002702706177526317 after partial withdrawal, 1002702493132722327 after positive499999 and tiny1, and 1002702919221994748 after full withdrawal.

## Tracking and unchanged fields

Observed baseTrackingSupplySpeed=11574074074, baseTrackingBorrowSpeed=1145833333333, baseMinForRewards=100000000, trackingIndexScale=S, baseScale1000000. Stored total principals exceed the rewards threshold. Tracking supply index74341550762472+floor(11574074074*19476*1000000/1636868415756)=**74341688474620**; tracking borrow index4491939236158804+floor(1145833333333*19476*1000000/1538191064853)=**4491953744271944**. Both observed totals agree exactly.

Wallet tracking index starts0, becomes74341688474620 on fresh supply and remains there through subsequent zero-elapsed actions, including full withdrawal. Wallet tracking accrued stays0: the elapsed action starts at principal0, and every positive-principal action here has zero tracking-index delta. This does **not** establish nonzero wallet reward accrual or reward rescaling generally. Wallet assetsIn/reserved and market pauseFlags remain0. EURC stays0, displayed borrow stays0, and all four boundary allowances stay0. Exact approvals are temporary simulation state only.

## Actual event grammar

Logs have canonical three-topic indexed-address layout and a single amount data word. Raw evidence retains addresses, topics, data and order; strict viem decoding corroborates semantics.

Supply with principal increase has per-call cardinality **1 / 3 / 1**: USDC Approval(wallet,market,a); then USDC Transfer(wallet,market,a) → market Supply(wallet,wallet,a) → market Transfer(zero,wallet,mint); then USDC Approval(wallet,market,0). Fresh-supply mint999998 and positive499999 mint499997 agree with principal-difference math.

Tiny supply has cardinality **1 / 2 / 1**: approve1; USDC Transfer1 → Supply1; revoke0. There is no market Transfer mint because Q=P. Requiring three action logs unconditionally would incorrectly remove this supported path.

Withdrawal has one action call with exactly **3 logs**, no approvals: USDC Transfer(market,wallet,a) → market Withdraw(wallet,wallet,a) → market Transfer(wallet,zero,burn). Partial amount500000 burns500001; full amount999998 burns999998. This independently establishes withdrawal order on the actual fixed deployment rather than inferring it from the fresh supply sample. No unexpected collateral, manager, borrow, EURC or probe logs were observed.

## Acceptance implication and stop

Use these exact raw vectors when independently reviewing the implementation owner's P0-C/P0-D handling. Do not disable supported positive positions/withdrawals, require fabricated mint on Q=P, or substitute displayed balance deltas for principal-difference event arithmetic. Preserve refusal for negative principal, repayment, debt crossing, a>B or any non-modeled state. These unsigned success examples do not prove negative parser/event mutations, integer-width/revert cases, nonzero-elapsed positive-P wallet rewards, source identity, an audit, live preview-to-relay availability or inclusion-time state.

Only this new research note and this agent's ignored evidence directory were written. No implementation/test edits, dependency installation, keys/private API/auth, Git operation, funding, signature, broadcast, server launch/stop or runtime changes occurred. Runtimes1646/374/487 remain untouched. The stopping condition is retained exact two-node unsigned path evidence and an explicit bounded claim; live acceptance/funding remain with the parent and independent critic.
