# Chain/story lane integration hints

The lane owns only `contracts/**` and `scripts/**`; no public-chain transactions are authorized.

Package: `@sq/scripts` (ESM TypeScript, consumes `@sq/protocol` source exports). Planned commands: `pnpm --filter @sq/scripts devnet`, `pnpm --filter @sq/scripts story`, `pnpm --filter @sq/scripts kit-sweep`.

`devnet.ts` exports `setupDevnet(rpcUrl?: string)`: installs saved Sepolia runtime code and constructor storage at pinned addresses on chain 31337, installs a test ERC20 at the pinned USDC address, and funds development fixture accounts. It does not start a node. Start the contracts Hardhat node on port 8545 first.

`story.ts` exports `runStory(rpcUrl?: string)`: local-only, asserts create + verification + ownership proof + funding + small/large classification + recovery's genuine 180-second contract delay (EVM time advance) + old-key GS026 + both-module cancellation + no-card refusal + kit encrypt/decrypt + RPC-only sweep + owner rotation. No service dependency; service/passkey behavior is not claimed by this chain fixture.

`kit-sweep.ts` exports `sweepKit(...)`: reads kit data, decrypts with protocol crypto, signs as its owner, reads nonce and balance from RPC, submits through a separately funded account. CLI takes kit file path and destination; kit code and funder key must come from environment (never command-line arguments or logs). Public RPC only: no service imports or calls. Live-chain submission remains forbidden in this implementation session.

Implemented commands and signatures are recorded in [IMPLEMENTATION.md](<IMPLEMENTATION.md>). The frozen protocol exports are consumed directly. Lead owns installing workspace dependencies. Contracts installs are isolated and never modify workspace lockfiles. First working checkpoint: `npm run story` from contracts (temporary loopback RPC; nine passing checkpoints). Preserved contract harness: 42 passing, zero pending.
