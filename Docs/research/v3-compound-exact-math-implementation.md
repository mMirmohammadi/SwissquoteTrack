# Compound exact-math P0: bounded implementation handoff

**Result: the owned exact-math suite passes 51 tests and protocol typecheck passes. This is implementation evidence, not correctness/live acceptance.** The parent must finish legacy-fixture migration, service zero-send/fresh-before-send testing, independent patch review and regating before new funding. Exact observed-effects hash v1 and relay equality remain unchanged; lawful credit drift still requires a fresh preview/review.

## Scope and evidence

Only [simulate.ts](<../../swissquote-wallet/packages/protocol/src/simulate.ts>), [dapps.ts](<../../swissquote-wallet/packages/protocol/src/dapps.ts>), new [compound-math.ts](<../../swissquote-wallet/packages/protocol/src/compound-math.ts>), new [v3-compound-exact-math.test.ts](<../../swissquote-wallet/tests/protocol/v3-compound-exact-math.test.ts>) and this report were written by this owner. Existing fixture files were not edited by this owner; concurrent integration-owner changes were observed while reading a policy fixture. No Git operation, installation, build/dist write, live API/auth/key/private-file access, broadcast, funding or process start/stop occurred. Main runtimes 374/487 and live runtime 1646 were not touched.

The actual saved [extended two-node results](<../../AgentsLocal/8f23ad61/result.json>) and [funding-block results](<../../AgentsLocal/6b2f81a9/funding-block-result.json>) are loaded by the new test. Both saved 31-call responses pass with their six diagnostic probes reordered to the production named plan; the underlying return bytes and event observations are not fabricated. Their actual principal 695575, supply index 1437657897106916, borrow index 1534021046802407, timestamp 1791672132 and credit 999998 agree exactly. The second recorded index 1437659456431214 at time1791672252 produces principal695575/credit999999 in an explicit model regression; this later vector is synthetic model evidence, not a saved extended post-tuple replay.

The permitted claim is pinned-code/getter consistency with an independently computed exact candidate model. Deployed-source/build identity, a contract audit and mining-time guarantees remain unverified. This market remains labeled a third-party test deployment.

## Public reads and extension trust

Necessary ABI/code inspection used one successful unsigned fixed-base dRPC `eth_getCode` and eight immutable getter calls at block11887593, plus immutable candidate-source HTTP reads. No unsigned action simulation or actual transaction was submitted in this implementation phase.

The extension at0xdCbDb7306c6Ff46f77B349188dC18cEd9DF30299 hashes to0x462b212abc00fb7e835d516da02805a359663ee9dd1050a4f827f17b1185cab2. PUSH-aware linear disassembly of its3381 metadata-stripped executable bytes found no DELEGATECALL or CALLCODE opcodes. Thus no further proxy/delegate edge was found in this pinned extension. This is a narrow dispatch inspection, not bytecode equivalence/audit. The candidate [CometExt source](<https://raw.githubusercontent.com/compound-finance/comet/f766f51583c23acc33b2a7824654ef2029a96804/contracts/CometExt.sol>) has direct totals storage getters and pure scale getters. The candidate [main source](<https://raw.githubusercontent.com/compound-finance/comet/f766f51583c23acc33b2a7824654ef2029a96804/contracts/CometWithExtendedAssetList.sol>) confirms main fallback delegation and withdrawal event order: USDC transfer, Withdraw, principal-difference burn.

New observed borrow/reward constants: borrowKink850000000000000000; borrow rate base475646879, low1680618975, high53906646372; baseTrackingSupplySpeed11574074074; baseTrackingBorrowSpeed1145833333333; baseMinForRewards100000000; trackingIndexScale1000000000000000. Production checks these and the previously approved supply/token/index/factor configuration freshly at every selected base block. All previous main/proxy/admin/token/router/quoter/pool pins are retained; extension code pin is added.

Intermediate read failures: Python PublicNode request returned `HTTP Error 403: Forbidden`; a direct `node_modules/viem/index.js` import failed with `ERR_MODULE_NOT_FOUND`. Standard existing `viem` resolution from the protocol package and dRPC then succeeded. These failures are not hidden or counted as successful evidence.

## Stable migration interfaces

[simulate.ts](<../../swissquote-wallet/packages/protocol/src/simulate.ts>) exports:

- `simulationProbes(wallet: Address, action: DappAction['action']): SimulationProbe[]`, where each entry has `{target,data,key}`. Swap retains8 probes/19calls. Supply and withdrawal use14 probes: original8, userBasic, totalsBasic, getUtilization, baseIndexScale, factorScale, getSupplyRate. Supply has31calls; withdrawal29. Parser and constructor share this exact plan. Allowance invariants explicitly use original indices4..7 only.
- `COMPOUND_RATE_ARGUMENT = 1002681548101469396n`: both rate probes use this same known argument. The returned9040159720 is a rate-function consistency check, **not** post-utilization supply rate. Independent rates use each modeled utilization as appropriate.
- `effectsFromSimulation(wallet, calls, raw, blockNumber, base?: {hash: Hex; timestamp: bigint})`: Compound requires the fifth base header argument; swaps do not. Simulated parent must equal it, number must bebase+1, timestamp must be canonical uint40 and not precede base/stored accrual. Production also rereads base header to reject detected reorgs. This interpreter alone does not authenticate supplied headers or check code pins: only `simulateCalls` is the production route.
- `verifyCompoundConfiguration(client: PublicClient, blockNumber: bigint): Promise<void>`, `COMPOUND_EXTENSION`, `DAPP_CODE_PINS`, `SimCall`, and `SimulationProbe` support independent adapter/mocked configuration tests. Fresh config uses `client.call` with explicit blockNumber and canonical returndata.

[compound-math.ts](<../../swissquote-wallet/packages/protocol/src/compound-math.ts>) exports `COMPOUND_CONFIG`, `CompoundUser`, `CompoundTotals`, `checkedUint(value: bigint, bits = 256): bigint`, `parseCompoundWords(data: Hex, widths: readonly number[], signedFirst = false): bigint[]`, `parseCompoundUser(data: Hex): CompoundUser`, `parseCompoundTotals(data: Hex): CompoundTotals`, `compoundRate(utilization: bigint, borrow = false): bigint`, `compoundUtilization(t: CompoundTotals): bigint`, and `modelCompound(before: CompoundUser, totals: CompoundTotals, timestamp: bigint, amount: bigint, action: 'supply' | 'withdraw')`.

The model returns index, utilization, principal, balanceBefore/balanceAfter, signed principal difference, mint/burn eventAmount, exact userAfter/totalsAfter tuples and postUtilization. Use it to construct fixtures, but expected acceptance vectors must independently state equations/numbers to avoid a circular oracle. The new owned test exports `compoundFixture(...)` as a synthetic builder; importing a Node test file also registers its tests, so prefer migrating its builder pattern into an integration-owned fixture utility rather than importing it as production code.

## Enforced semantics

Canonical5-word user and8-word totals layouts enforce all narrow unsigned widths and signed104 sign extension, exact lengths and no trailing words. Checked multiplication/addition/subtraction/narrowing model Solidity uint256/uint64/uint104/int104/int256 boundaries. Negative principal is rejected even if displayed debt iszero. Supply/borrow indices accrue independently from stored utilization at actual simulated time; post utilization uses the accrued borrow index. Total supply principal changes exactly byQ-P; aggregate borrow principal is unchanged. Supply/borrow tracking indices accrue from old totals; account tracking accrual and index update are computed exactly. Collateral flags/reserved and pause flags remain unchanged, rather than freezing legitimate tracking or admitting arbitrary flag changes. Zero elapsed retains indices/time.

Positive-principal supply, partial withdrawal, exact-full displayedB withdrawal and empty fresh supply remain supported. Borrow crossing, repayment, empty withdrawal and non-monotone principal transitions refuse. Tiny supply withQ=P produces exactzero credit and no mint, which is admitted rather than inventing credit.

Compound getter calls require empty logs. Supply approvals each require exactly one canonical Approval in their respective calls. Action calls require exact USDC Transfer(amounta), Supply/Withdraw(wallet,wallet,a), then mint/burn only if principal difference is nonzero. Event amount isfloor(abs(Q-P)*J/S), not displayed delta. No empty/extra/duplicate/diverted/reordered events or unexpected action return bytes are admitted. Existing selected allowancezero and unrelated unchanged permissions, debtzero, EURC unchanged, exact token spend/receive and canonical signed call policy remain intact.

## Actual checks and remaining acceptance work

Commands were run from the protocol package with existing dependencies:

- `node --import tsx --test ../../tests/protocol/v3-compound-exact-math.test.ts`: final51tests,51pass,0fail,0skip. Earlier47-test run had46pass/1fail because the mint-vs-display regression chose amount2 where both values werezero. Corrected to amount3: mint1 vs displayedDelta2; subsequent50/50 and final51/51 passed.
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`: passed before tests and after final changes. No build output was written.

Coverage includes both saved nodes, both index/time vectors, exactC/Q/J±1 refusal, hand-derived positive-P supply/partial/full withdrawal, principal mint vs displayed delta, zero-credit supply, scale boundaries, zero utilization/kink branches, canonical/sign-width/overflow checks, missing base/time/calls, failed action, strict event grammar, wrong withdrawal amount, permissions/EURC changes, configuration address/constant/encoding changes, and raw lawful-drift hash inequality.

Not claimed: complete legacy suite pass, service/wallet typecheck/build, full proxy-pin mutation suite, fully mocked production relay zero-sends/fresh-before-send paths, deployed positive-position/withdrawal replay acceptance or independent security sign-off. The protocol module itself has no send primitive; the raw drift hash test proves inequality, not the service's no-send behavior. Parent integration must exercise existing `revalidateSimulation` before send and prove EFFECTS_MISMATCH withzero sends; its code remains unchanged. New funding/live acceptance stays closed pending that evidence and independent review.
