# Independent integration review — bounded first pass

**FINAL V4 acceptance:** `bash-2077`, exit 0: `GATE PASS: passed=609, skipped=0, duration=434.2s`; typechecks/builds passed. This includes the seven added MOCK bank-return shortcut regressions (567 Node/browser + 42 contracts). It supersedes the earlier 602-test baseline below. G1 public-browser recovery separately passed across retained sessions, not one uninterrupted take. No production audit, hardware proof or publication is implied.

**Service integration checks pass. Real-chain verification remains unrun:** no isolated, initialized local RPC was assigned to this verifier. The local-chain suite intentionally skips without `INTEGRATION_RPC_URL`; its existence is not completion evidence.

Edited only this report and tests under [integration tests](<../../swissquote-wallet/tests/integration/>). No dependency installation, implementation/script edits, commits, pushes, or Sepolia transactions. Builders were changing implementation concurrently; results describe the implementation loaded during each run, not a frozen commit.

## Exact execution evidence

Commands ran from `/home/dev/Hackaton/SwissquoteTrack/swissquote-wallet` with Node v26.4.0:

- `node --version; node --import tsx --test tests/integration/*.test.ts` initially failed before assertions: two file-level failures, zero passes. Exact cause: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'viem' imported from /home/dev/Hackaton/SwissquoteTrack/swissquote-wallet/tests/integration/local-chain.test.ts` (same cause for the Swissquote service test).
- A subsequent `node --import tsx --test tests/integration/*.test.ts`, after adding the partner suite, failed loading all three files with the same missing root-resolvable `viem` dependency. No behavioral conclusions from these runs.
- `node --import tsx --test tests/integration/http-contract.test.ts`: five tests passed, zero failed. Checks actual HTTP response shapes and password reset using in-memory SQLite.
- `node --import tsx --test tests/integration/*.test.ts` subsequently passed twice as builders/lead published exports and dependencies. Final run, after adding the zero-ETH USDC real-chain test: **17 tests reported, 16 passed, zero failed, one skipped**; duration 2104.278135 ms; exit code 0. Includes parent tests in Node's count. No root dependency changes by this verifier.

The skipped test is `independent protocol integration on real local contract code`, with reason `INTEGRATION_RPC_URL is required for an isolated initialized local chain`. Its seven nested scenarios did not execute.

## What passed, and what that means

[HTTP contract tests](<../../swissquote-wallet/tests/integration/http-contract.test.ts>): SessionResponse `kycVerified`, KYC enrollment refusal, MockKycResponse, frozen mailbox `resetToken`, and old-session invalidation after password reset. Actual local HTTP server and in-memory database; no chain adapter.

[Swissquote service tests](<../../swissquote-wallet/tests/integration/services.test.ts>): stable guardian enrollment; unverified withdrawal refusal; published SetupCode + ownership-proof registration; failed proof refusal; funding only the verified client's wallet; simulate → estimate → send ordering; small USDC payment without passkey; large payment refusal without step-up; challenge bound to exact SafeTx hash; different transaction refusal; protective both-module cancellation despite exhausted account budget; owner-signature check still required; mailbox reset hold and post-hold MOCK video-ID policy; no approval when injected signer reports hash mismatch.

These checks execute the real Swissquote HTTP service and SQLite storage with explicitly injected chain and WebAuthn test doubles. Signing and hashing use actual protocol crypto. They **do not** validate EVM execution, real bank funding, authenticator origin/RP/signature checks, real identity verification, or real device encryption. The hash-mismatch refusal test currently relies on the injected signer throwing; it does not independently prove the HTTP route compares the digest itself.

[Partner service tests](<../../swissquote-wallet/tests/integration/partner.test.ts>): stable enrollment; no enrollment replacement by thief; no private key in response; stolen face refusal; valid approval recovered cryptographically to the enrolled guardian and round-tripped through ApprovalCode; wrong nonce/module/chain, wrong guardian set/threshold, chain-hash mismatch and RPC outage fail before signing; unexpected secret field refused; MOCK fooled switch bypasses face only, never chain verification. Actual HTTP server, real protocol EIP-712 signing, injected read-only chain snapshots and separate in-memory partner store. Not real-chain evidence.

## Prepared but unrun real-chain scenarios

[Local-chain tests](<../../swissquote-wallet/tests/integration/local-chain.test.ts>) require loopback RPC and chain id 31337 before any transaction. They use random role keys funded only via Hardhat and target the pinned real contract fixtures:

- Atomic CREATE2 deployment and both 2-of-2 guardian sets; zero-ETH wallet; independent wallet checker.
- EIP-1271 ownership proof and refusal for wrong client, nonce or thief key.
- MOCK local USDC mint plus actual owner-signed token transfer while wallet retains zero ETH.
- Independently reconstructed EIP-712 recovery digest equals protocol and on-chain digest; mutated owner/module/nonce/chain signatures rejected. Nonce and chain are mutated in the signature, not just JS request fields, because they are not recovery calldata fields.
- Partner + Swissquote signatures without card refused on both modules.
- Real A/B pending requests, owner-signed BOTH-module cancellation, empty requests afterward, finalize refusal and captured-signature replay refusal.
- Actual A=180-second and B=259200-second contract waits; A early finalize refusal, local time advance, new owner accepted and old key `GS026` refusal.

The local suite expects the builder's already initialized fixtures and MOCK DemoUSDC at the pinned USDC address. It does not initialize or reset a shared chain. Resume on a dedicated RPC only; advancing EVM time would interfere with other builders' tests.

## Read-only observations and remaining acceptance gaps

1. **Still required:** run the prepared local suite against a dedicated initialized chain, and then connect both service HTTP flows to actual chain adapters. Current service and chain scenarios are separate, not one end-to-end create → fund → pay → recover HTTP story. No isolated RPC was assigned in this first pass.
2. **Still required:** genuine WebAuthn verification/browser integration, service-independent kit sweep, and owner-rotation coverage. Other lanes may own these checks; this report supplies no independent passing evidence for them.
3. **Potential requirement mismatch:** [Swissquote relayer budget code](<../../swissquote-wallet/services/swissquote/src/app.ts#L25-L35>) retains a global cap for protective/finalize calls. [Build plan](<../plans/swissquote-wallet-build-plan.md#L182-L185>) says protective calls are always relayed outside any budget. Account-budget bypass passed; global-budget bypass was not tested and code inspection suggests it is not implemented.
4. [Existing plan-check log](<../../swissquote-wallet/contracts/results/plan-checks.txt>) is historical, read-only evidence, not a test run by this verifier. It records ten passes including hash binding, old-key GS026 and no-card refusal, but its module-B fixture wait is 300 seconds and differs from the approved 3-day B. Do not substitute this log for current integration acceptance.
5. Root README was not published when checked. [Partner implementation checkpoint](<../../swissquote-wallet/services/partner/IMPLEMENTATION.md>) still described work in progress; [frozen protocol exports](<../../swissquote-wallet/packages/protocol/EXPORTS.md>) and [API contracts](<../../swissquote-wallet/packages/protocol/src/api.ts>) were used to prepare tests. No README/manual-run claim was verified.

## Resume / stopping condition

Bounded first pass stops here: service checks have actual results; chain tests are explicitly unavailable, not passed. Lead can resume this verifier after assigning a dedicated initialized local RPC. Run `INTEGRATION_RPC_URL=http://127.0.0.1:<dedicated-port> node --import tsx --test tests/integration/local-chain.test.ts` from the wallet workspace, then rerun the complete integration collection. Do not point it at Sepolia or a shared devnet without coordination. Completion requires recorded actual chain assertions and the remaining end-to-end gaps resolved or explicitly accepted by the lead.
