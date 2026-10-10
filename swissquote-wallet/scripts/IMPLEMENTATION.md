# Chain/story implementation

The complete local chain story passes, including recovery and emergency sweep without bank/partner/app services. All writes are confined to this lane. No commit, push, workspace install, workspace lockfile/root config edit, or Sepolia transaction was performed.

## Runnable checkpoint

From `swissquote-wallet/contracts`, run `npm run story`. It exposes a real Hardhat EVM over a temporary loopback RPC, places the saved pinned Sepolia runtimes, runs the story, and shuts down the adapter. No persistent chain or other service is required.

For an interactive local chain, run `npm run compile`, then `npm run node` from contracts. In another terminal run `pnpm --filter @sq/scripts devnet` or `pnpm --filter @sq/scripts story` from the wallet workspace. Default RPC is `http://127.0.0.1:8545`; `RPC_URLS` can override it. Devnet/story reject any chain other than 31337 before mutations. The scripts do not start a persistent node.

## Implemented checks

[The story](<story.ts>) verifies one-transaction CREATE2 deployment and pinned wallet configuration, EIP-1271 ownership proof, a real MOCK-account token transfer, small 2-USDC and large 8-USDC owner-signed payments, wallet balance and zero ETH. It checks the shared transaction classes but does not pretend to enforce WebAuthn; passkey/service policy belongs to the service lane.

It starts requests on both modules, asserts B's exact 259200-second wait, cancels both in one Protective owner-signed batch, and proves partner + Swissquote signatures without the card are refused by both contracts. A recovery checks its exact 180-second wait, refuses finalization immediately and one second before maturity, advances the actual EVM timestamp, finalizes, reads the new owner, and proves the old key receives GS026. No recovery bytecode or wait is patched.

The kit checks authenticated encryption/decryption and wrong-code refusal; the stale owner kit cannot sweep. The new kit sweeps the remaining 5 USDC through RPC with no services. Rotation uses an Admin owner-signed swap, proves the previous owner gets GS026, and creates a replacement kit.

## Public exports

Package `@sq/scripts` exposes build/typecheck/test/devnet/story/kit-sweep commands. Build performs a no-emit typecheck: this source-run package does not publish compiled artifacts or a package-root export barrel. Consumers use explicit source-module imports:

- [devnet.ts](<devnet.ts>): `setupDevnet(rpcUrl = DEV_RPC): Promise<{ rpcUrl: string; addresses: typeof DEV_ADDRESSES }>`; `DEV_RPC`, `DEV_KEYS`, `DEV_ADDRESSES`, `USDC_ADDRESS`. Keys are conspicuously deterministic local fixtures; never public-chain keys.
- [story.ts](<story.ts>): `runStory(rpcUrl = DEV_RPC): Promise<{wallet: Address; checks: string[]}>`.
- [kit-sweep.ts](<kit-sweep.ts>): `SweepOptions { kit: EmergencyKit; code: string; destination: Address; rpcUrls: readonly string[]; funderPrivateKey: Hex; allowSepolia?: boolean }`; `sweepKit(options: SweepOptions)`. It rejects stale ownership, same-wallet destination, empty balance, chain mismatch, bad kit/code and failed simulation/receipt; estimates target-chain gas. It imports no service and uses RPC fallback.
- [runtime.ts](<runtime.ts>): `clients`, `assertLocal`, `localRpc`, `submit`, `isMain` shared command helpers.

Kit CLI: `pnpm --filter @sq/scripts kit-sweep <kit.json> <destination>`. Set `KIT_CODE`, `FUNDER_PRIVATE_KEY`, `RPC_URLS` in environment, never command-line arguments. Sepolia sending is disabled by default; the optional future opt-in is `ALLOW_SEPOLIA_SWEEP=yes`. This session did not opt in or send any public transaction. CLI prints no keys, seeds, or code, and sanitizes errors.

## Evidence and limits

- `npm run story` in contracts: 1 integration test passing, all nine story checkpoints; final rerun includes both actual token balance assertions and exact three-day B delay.
- `npm run typecheck` in scripts: passed against the frozen protocol source entry.
- `npm test` in scripts: 2 passing, including chain refusal before any Hardhat mutation.
- `bash scripts/check-sources.sh` in contracts: all eight Candide source hashes pass.
- Full preserved contract suite: first run 41 passing / 1 pending due C8's missing sibling fixture; fixture path was repaired with an unchanged vendored test-only abstractionkit copy. Final result is recorded in [contracts implementation](<../contracts/IMPLEMENTATION.md>).

Observed limitation: bare Hardhat node invocation attempted an out-of-workspace config mkdir and was refused by sandbox. Package commands now specify scoped XDG directories; the ephemeral story passed without escalation. No persistent server was left running. Team messaging was unavailable in this delegated subagent (`not a member of an active Agent Team`); [early interface hints](<INTERFACES.md>) were published in the shared scope for lead integration.

Not claimed: browser/passkey/service end-to-end behavior, independent publishers, two independent live RPC correctness, live Sepolia transaction success, or a real elapsed wall-clock wait. This gate uses real contracts with accelerated EVM time, not sleeping or mocked recovery logic.
