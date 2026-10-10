# Protocol final findings — independent bounded review

**Protocol regressions now pass: 59 tests, 59 passed, 0 failed, 0 skipped. The remaining actionable issue is caller integration after owner recovery/rotation, not the corrected protocol verifier.**

The reviewer owns only [independent protocol tests](<../../swissquote-wallet/tests/protocol/>), [submission review](<../submission/review-protocol.md>) and this findings file. No implementation edit, shared dependency installation, commit, transaction or Hardhat reset was performed. The existing localhost:8545 chain was left untouched. Builders edited concurrently; this is an observation of working-tree code, not a fixed-commit audit.

## Final command and acceptance evidence

From the wallet workspace, `node --import tsx --test --test-reporter=spec tests/protocol/*.test.ts` exited **0**: **59 tests; 59 passed; 0 failed/cancelled/skipped/todo; duration 2360.536373 ms**. The command chained `git diff --check -- tests/protocol ../Docs/submission/review-protocol.md ../Docs/plans/protocol-final-findings.md`; that check also succeeded. The earlier dot-reporter run also passed all 59 cases. These are bounded, offline behavioral tests using injected public-client responses and saved contract bytes; they are not live-chain recovery evidence or reviewer-test TypeScript typechecking.

Fixture references now use the durable [Sepolia code snapshot](<../../swissquote-wallet/contracts/contracts/plan/sepolia-code.json>), [Module B snapshot](<../../swissquote-wallet/contracts/contracts/plan/sepolia-module-b.json>) and the already-installed [SafeProxy artifact](<../../swissquote-wallet/contracts/node_modules/@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json>). Tests no longer depend on another agent's temporary directory. A clean checkout still needs the existing workspace/contract dependencies and checked-in or reproducibly supplied snapshots; this pass did not certify a dependency-free clean checkout.

## 1. Nonce-zero module history bypass — fixed and independently reproduced

**Before fix:** the nonce-zero malicious module and history-failure test doubles returned verification green. Owner Safe transactions increment nonce; module execution does not. Keeping module-event inspection inside `nonce > 0` therefore skipped it before any owner transaction.

The clearly labelled [nonce-zero tests](<../../swissquote-wallet/tests/protocol/wallet-verification.test.ts#L67-L84>) inject a pinned-module delegatecall, an unapproved-module CALL, and an RPC exception while Safe nonce is zero. After the builder's correction, both malicious histories reject and the exception rejects with `history RPC unavailable`. The normal nonce-zero wallet still passes.

**Current mechanism:** [verification](<../../swissquote-wallet/packages/protocol/src/verification.ts#L57-L80>) queries module events outside the owner-nonce branch. `moduleTransactions.some(log => log.args.operation !== 0 || !MODULES.some(m => same(m, log.args.module)))` rejects the injected unsafe histories. Owner transaction completeness remains conditional on nonzero Safe nonce.

**Limit:** these are explicitly test doubles, not proof that pinned production modules permit the injected malicious operation. They establish verifier behavior if such history is returned, including the nonce-zero blind spot. Event-query success alone also does not prove a provider returned every module event; genuinely independent providers remain a deployment requirement.

## 2. Original creation owner versus expected current owner — protocol fixed; callers still need integration

**Before fix:** completed nonce-zero module recovery and nonce-one owner rotation both returned red with `Unexpected owners or owner threshold`, even though original CREATE2 evidence and the expected replacement owner were correct. Changing `setup.owner` to the replacement did not repair this: it changes the creation initializer and therefore derives a different wallet address.

**Current contract:** [verification options and current-owner check](<../../swissquote-wallet/packages/protocol/src/verification.ts#L7-L10>) separate immutable `setup.owner` from optional `expectedCurrentOwner`. [Owner validation](<../../swissquote-wallet/packages/protocol/src/verification.ts#L44-L46>) uses `options.expectedCurrentOwner ?? setup.owner`, rejects zero/sentinel/wallet-self/malformed values, and still requires exactly one owner and threshold one.

The labelled [lifecycle regressions](<../../swissquote-wallet/tests/protocol/wallet-verification.test.ts#L86-L120>) now pass with unchanged original setup plus a separately supplied current owner, for both completed nonce-zero recovery and nonce-one rotation. They also pass through `verifyWalletIndependent` with two client objects. Mismatch, hidden additional owner, zero/sentinel/malformed expectation, and replacing the creation owner all reject. Two test clients are not proof of two independent real providers.

**Unclosed integration gate, observed source:** [recovery tool checkWallet](<../../swissquote-wallet/apps/recovery-tool/src/core.ts#L23-L29>) still supplies only `expectedWallet` and `fromBlock`. [Swissquote chain adapter](<../../swissquote-wallet/services/swissquote/src/chain.ts#L30>) also omits `expectedCurrentOwner`; [funding route](<../../swissquote-wallet/services/swissquote/src/app.ts#L146>) rechecks `linked.setup`. Thus these callers still default to the original owner after a legitimate owner change. The protocol regression passes, but an end-to-end recovered-wallet recheck/funding claim is not established.

**Next action for owning builders:** preserve the original setup separately, obtain a trusted expected current owner through the authorized recovery/rotation flow, and pass it to verification. Do not blindly copy `getOwners()` into the expectation; that would remove the independent check. Add caller-level evidence that original Setup code still derives the wallet and that recheck/funding works after recovery and rotation. This reviewer did not edit those callsites.

## 3. Prior wire, request-code and wrong-kit-code failures — all closed

The [wire regressions](<../../swissquote-wallet/tests/protocol/wire-validation.test.ts>) now isolate every assertion instead of letting a first failure mask subsequent fields. All five numeric fields reject exactly `2**256`; `to`, `gasToken` and `refundReceiver` reject `0x1234`; calldata rejects `0x1`, `0xzz` and `not hex`. Valid bigint values above JavaScript's safe integer range still roundtrip. [Wire parser](<../../swissquote-wallet/packages/protocol/src/api.ts#L41-L54>) now bounds uint256 and validates address/calldata syntax. Earlier behavior was boundary-validation failure, not demonstrated successful malformed on-chain execution.

The [request-code tests](<../../swissquote-wallet/tests/protocol/codes-classification.test.ts>) separately reject zero wallet, zero replacement owner and sentinel replacement owner. [Schema validation](<../../swissquote-wallet/packages/protocol/src/codes.ts#L17-L19>) now enforces those semantic constraints. This is early refusal of unusable requests; guardian/contract checks remain necessary.

The [kit test](<../../swissquote-wallet/tests/protocol/encryption-kit.test.ts>) now passes its wrong-valid-checksum-code error assertion. Wrong codes previously rejected cryptographically but exposed `The operation failed for an operation-specific reason`; the current path returns a readable kit-code/decryption error. No claim is made that wrong-code can be distinguished from damaged authenticated ciphertext.

## Other passing evidence and stopping condition

Existing independent template, CREATE2, recovery/Safe EIP-712, signer sorting, encryption integrity, code/classification, complete owner-history, code-pinning and multi-client disagreement checks all pass in the same final run. The recovery digest agrees with saved Sepolia `getRecoveryHash` vector `0xae938c999b35386040c5e0b8aa985046603c34a489e4673a858250230d5b4cfe` in [template/signing tests](<../../swissquote-wallet/tests/protocol/template-signing.test.ts#L78-L84>).

This pass stops after the bounded final run and handoff. It does not certify live recovery waits, old-key GS026, no-card refusal, personal-sign refusal, full dual-module cancellation on a deployed Safe, services-stopped kit sweep, browser portability, relayer/passkey policy, package export integration, or a clean-checkout build. Those remain the owners' separate integration/story gates in the [current swarm plan](<swarm-integration-status.md>).
