# Candidate B: local-chain executable verification

Runs the real, unmodified contracts on a local Hardhat chain (no testnet, no public network, no real
funds) and checks the on-chain rules claimed for Candidate B in
`../research/03-design-candidates.md`. The report is `../research/05-executable-verification.md`.

## What is under test
- **Safe v1.4.1** (singleton, `SafeProxyFactory`, `CompatibilityFallbackHandler`): deployed from the build
  artifacts in npm `@safe-global/safe-contracts@1.4.1-2`, not recompiled. Test T0 checks that their runtime
  code hash equals the canonical v1.4.1 `codeHash` in `@safe-global/safe-deployments`.
- **Candide `SocialRecoveryModule` + `GuardianStorage`**: copied verbatim into `contracts/candide/` from
  https://github.com/5afe/CandideWalletContracts at commit `113d3c059e039e332637e8f686d9cbd505f1e738`
  (the commit pinned by Safe's release tag `recovery/v0.1.0` of
  https://github.com/safe-global/safe-modules). `contracts/candide/SOURCES.txt` records each file's
  upstream git blob SHA. Compiled with the same settings as Safe's release (solc 0.8.20, optimizer
  1,000,000 runs, viaIR). Our own module instance uses `recoveryPeriod = 60` seconds.
- `contracts/fixtures/SetupFixture.sol` is a **test-only fixture** (not audited, not under test). T7 uses
  it to put the whole configuration into the Safe creation transaction.
- `contracts/fixtures/HiddenEntrySetup.sol` is a **test-only malicious setup library** for T9. It does the
  honest configuration, then writes `owners[evil]` (storage slot 2 mapping) and/or `modules[evilModule]`
  (slot 1 mapping) without linking them into Safe's lists. Not under test; it plays the attacker.
- T8 deploys two more instances of the same module (`recoveryPeriod` 60 s and 120 s) inside the test.

## Roles (deterministic test keys, derived from `ethers.id("candidate-b-verify/<name>")`; never reuse)
Ph = phone key (W's only owner) · R = recovery card key (EOA guardian) · P = partner key · SQ = Swissquote
key · X = Safe {P, SQ} threshold 1 (second guardian) · W = user Safe, guardians {R, X}, threshold 2 ·
WA = second user Safe set up as Candidate A (guardians {P, SQ}, threshold 2) · newKey, attacker, a fresh
random outsider per T6 run, relayer.

## Rerun
```bash
cd AgentsLocal/46257332/verify
# Install (exact versions pinned in package.json + package-lock.json; .npmrc sets legacy-peer-deps=true,
# needed because @safe-global/safe-contracts@1.4.1-2 declares a peer dependency on ethers 5).
npm --cache /tmp/npmcache-46257332 install --no-audit --no-fund
# The sandbox blocks ~/.cache; keep Hardhat's cache/config inside this folder.
export XDG_CACHE_HOME=$PWD/.xdg/cache XDG_CONFIG_HOME=$PWD/.xdg/config XDG_DATA_HOME=$PWD/.xdg/data

bash scripts/check-sources.sh            # offline: copied sources == upstream blobs
bash scripts/fetch-candide-sources.sh    # optional, needs GitHub: re-download and re-verify the copy

npx hardhat test                                        # everything: T0-T10 (T6 and T8f at their defaults)
npx hardhat test test/t1-t5.candidateB.test.js          # T0-T5
npx hardhat test test/t6-property.test.js               # T6 + its Candidate A control
npx hardhat test test/t7-creation-tamper.test.js        # optional T7
# T6 knobs (defaults shown): T6_RUNS=100 T6_STEPS=40 T6_SEED=20261010 T6_CONTROL_RUNS=50
T6_RUNS=200 T6_SEED=1 npx hardhat test test/t6-property.test.js

# Red-team extension (report section "Extension: red-team checks (T8-T10)")
npx hardhat test test/t8-two-instances.test.js          # T8a-T8f: two module instances instead of X
npx hardhat test test/t9-hidden-owner.test.js           # T9: hidden owner/module from a malicious setup library
npx hardhat test test/t10-request-hygiene.test.js       # T10: invalidateNonce, disableModule, re-enable
# T8f knobs (defaults shown): T8_RUNS=100 T8_STEPS=40 T8_SEED=20261010 T8_CONTROL_RUNS=50
T8_RUNS=200 T8_SEED=1 npx hardhat test test/t8-two-instances.test.js
```
Every test prints `evidence:` lines with the exact revert string or the value read back from the chain.

## Layout
- `hardhat.config.js`: local chain only (chain id 31337), compiler settings as above.
- `test/helpers.js`: world setup (one EVM snapshot reverted before every test), Safe transaction and
  signature helpers (EOA signatures and Safe EIP-1271 signatures for X), revert decoding.
- `test/t1-t5.candidateB.test.js`: T0 (bytecode and hash sanity), T1a-T1d, T2, T3, T4, T5.
- `test/t6-property.test.js`: randomised property test plus a control run against Candidate A.
- `test/t7-creation-tamper.test.js`: creation tamper test.
- `test/t8-two-instances.test.js`: T8, guardians split into instance A {R, P} 60 s and instance B
  {R, SQ} 120 s, both threshold 2; includes the T8f randomised property test and its weak-A control.
- `test/t9-hidden-owner.test.js`: T9, Safe created through the real `SafeProxyFactory` with
  `HiddenEntrySetup` as the setup delegatecall target; T9c also checks red-team row 3.6.
- `test/t10-request-hygiene.test.js`: T10, what `invalidateNonce`, `disableModule` and re-enabling do to
  a pending request.
- `results/`: captured output of the runs quoted in the report. Extension runs: `t8-seed20261010.txt`,
  `t8-seed1-200runs.txt`, `t9-t10.txt`, and `full-suite-t0-t10.txt` (all 32 tests in one run).
- `scripts/`: source fetch and source check.

## Environment used
Node v26.4.0, npm 11.17.0, hardhat 2.29.1, ethers 6.17.0, @nomicfoundation/hardhat-ethers 3.1.3,
@nomicfoundation/hardhat-chai-matchers 2.1.2, chai 4.5.0, @openzeppelin/contracts 4.9.6,
@safe-global/safe-contracts 1.4.1-2, @safe-global/safe-deployments 1.37.63.
