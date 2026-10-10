# Contracts lane implementation

The preserved harness now runs **42 passing, zero pending**. The separate production-script integration story also passes. No Sepolia transaction, commit, push, workspace install, or root configuration change was performed.

## Files and provenance

[PROVENANCE.md](<PROVENANCE.md>) records the read-only source copy from `AgentsLocal/46257332/verify`, preserved upstream pin/hash evidence, and the unchanged test-only abstractionkit fixture used to make the previously pending C8 test executable. Existing historical [results](<results/>) were copied as provenance, not overwritten or presented as this run's output.

Only substantive edits to the copied harness are scoped package command additions with local XDG paths and [C8's fixture location](<test/plan-sepolia-copy.test.js#L330-L340>). All Candide contract sources remain unchanged. No new wallet or recovery contract was authored. [DemoUSDC.sol](<contracts/fixtures/DemoUSDC.sol>) is a local-only token fixture with mint and transfer behavior, installed at the pinned USDC address; it is not a claim about Circle deployment.

[Saved module B runtime](<contracts/plan/sepolia-module-b.json>) extends the saved exact Sepolia fixtures. Both modules retain their original bytecode and immutable delays. The [devnet loader](<../scripts/devnet.ts>) validates all saved runtime hashes before writing local code/storage, then reads each installed code back.

## Commands and observed evidence

Working directory: `swissquote-wallet/contracts`.

- `npm ci --cache /tmp/npmcache --no-audit --no-fund`: isolated harness dependencies installed; no wallet workspace install or lockfile edits.
- `npm run compile`: passed. Local token fixture compiled alongside preserved fixture contracts.
- `bash scripts/check-sources.sh`: all eight preserved upstream source hashes pass.
- `npm test` (final background job bash-328, exit 0): **42 passing (3m), zero pending**. Includes C8 helper compatibility, coalition properties and negative controls, exact copied Sepolia deployment, malicious setup/hidden owner/module controls, recovery races and cancellation hygiene.
- `npm run story` (final bash-381, exit 0): **1 passing (4s)**, all nine production-script checkpoints. Exact A delay 180 seconds and B delay 259200 seconds are asserted; actual EVM time advances, old-owner GS026, both-module cancellation, no-card refusal, kit crypto, no-service RPC sweep, owner rotation and replacement kit pass.
- `npm run typecheck && npm test` from scripts: passed; **2 guard tests**, no failures.

## Lead integration

[Scripts implementation](<../scripts/IMPLEMENTATION.md>) contains commands, exports, boundary notes and limitations. First standalone P0 is `npm run story` here; [the adapter](<scripts/local-story.test.cjs>) starts only a temporary loopback RPC and closes it in `finally`. Persistent demo is `npm run node` here followed by the scripts devnet/story command; the scoped XDG directories avoid out-of-workspace writes.

No unresolved chain/story blocker. Passkey/browser/bank/partner workflow checks still belong to their respective lanes. No live Sepolia sweep was executed or claimed. The complete chain gate is local and deliberately advances chain time rather than waiting in real wall-clock time.
