# Integration status — final local handoff

The parallel builders and independent reviewers have finished. The lead integrated their fixes; final local acceptance is recorded in [final verification](<swarm-final-verification.md>) and the [acceptance ledger](<swarm-acceptance.md>). Earlier reviewer reports preserve historical failures and are superseded where the lead records a passing rerun.

## Resolved findings

- Safe receipt ABI uses indexed transaction hashes; successful-execution enforcement remains intact.
- WebAuthn step-up uses decoded hash bytes rather than a double-encoded string. The service supervisor was restarted; real browser large-payment verification passes.
- Immutable creation owner and separately proven current owner remain distinct. Replacement registration requires a fresh wallet-bound EIP-1271 proof; funding verifies the proven current owner.
- Device promotion retains original setup/card-guardian metadata. Authenticated public metadata supports fresh-device preparation without returning seeds or card words.
- Wire validation, recovery chain binding, nonce-zero module history, one-use challenges, concurrent deployment/withdrawal reservations, and definite-failure versus uncertain-send handling have regression coverage.

## Evidence and limits

Real local contracts cover create, pay, cancellation of both modules, helper-collusion refusal, delayed same-address recovery, old-key rejection, key rotation, and a service-independent kit sweep. Local time is advanced for delay testing. Browser evidence covers create/check/kit/fund/small and large payments with a virtual authenticator and real server verification. Complete browser recovery/rotation, fresh-device recovery, physical passkeys and live Sepolia are not verified. Security tests include explicitly labelled doubles and are not an audit.

## Existing listeners

Lead-managed Hardhat job `bash-374` serves loopback RPC8545. Current supervisor `bash-487` serves wallet5173, tool5174, Swissquote4001 and partner4002. Previous supervisors `bash-384` and `bash-476` were stopped and collected. The current supervisor includes the final public creation-metadata endpoint. No chain reset was performed for final browser verification. DSH GUI3080 was not changed.

Use `localhost` consistently for passkeys. Two loopback RPC aliases are the same node, not independent providers. Services, guardian protection, identity checks and bank balances are explicitly MOCK. No public-chain transactions, commits, pushes or external submissions were authorized or performed.
