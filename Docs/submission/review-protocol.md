# Independent protocol review — final bounded pass

**59 independent protocol tests passed; no failures or skips. Protocol fixes are accepted within this offline test scope. Recovered-wallet caller integration remains open.**

The exact evidence, before/after failures and next actions are recorded once in [protocol final findings](<../plans/protocol-final-findings.md>). This result supersedes the earlier 37-test run with four failures. Builders edited concurrently; this is a working-tree observation, not an audit of a fixed commit.

## Executed acceptance

From the wallet workspace, `node --import tsx --test --test-reporter=spec tests/protocol/*.test.ts` exited 0: **59 tests, 59 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo; 2360.536373 ms**. The owned-files whitespace check also passed. No implementation edits, shared installs, commits, live transactions or resets of the existing localhost:8545 Hardhat chain were performed.

The [independent tests](<../../swissquote-wallet/tests/protocol/>) exercise actual protocol implementation with independently encoded expected data, saved code bytes and injected RPC responses. They do not certify a deployed story or browser behavior.

## Acceptance boundaries that changed

The clearly labelled [nonce-zero malicious-history test doubles](<../../swissquote-wallet/tests/protocol/wallet-verification.test.ts#L67-L84>) now reject pinned-module delegatecall, unapproved-module CALL and history RPC failure at Safe nonce zero. Module-event inspection is no longer skipped when the owner transaction nonce is zero.

The labelled [owner-lifecycle tests](<../../swissquote-wallet/tests/protocol/wallet-verification.test.ts#L86-L120>) now verify completed module recovery and owner rotation using immutable original creation `setup.owner` plus a separately trusted `expectedCurrentOwner`. Replacing the creation owner changes CREATE2 evidence and correctly rejects. Mismatching/hidden owners and unusable expected-owner addresses reject.

The [wire tests](<../../swissquote-wallet/tests/protocol/wire-validation.test.ts>) now reject uint256 overflow in each numeric field, malformed addresses and malformed calldata. [Request-code tests](<../../swissquote-wallet/tests/protocol/codes-classification.test.ts>) reject zero wallet and zero/sentinel replacement owner. [Kit tests](<../../swissquote-wallet/tests/protocol/encryption-kit.test.ts>) confirm a wrong valid-checksum kit code rejects with a readable error rather than an opaque WebCrypto message.

## Other passing coverage

[Template/signing tests](<../../swissquote-wallet/tests/protocol/template-signing.test.ts>) independently encode five atomic creation calls, compare CREATE2 derivation and actor/threshold mutations, bind all Safe/recovery typed-data fields and validate numeric signer sorting. The recovery digest matches the saved Sepolia vector. [Encryption tests](<../../swissquote-wallet/tests/protocol/encryption-kit.test.ts>) check public BIP39/BIP44 fixtures, pinned KDF settings, randomized authenticated encryption, header/ciphertext tamper refusal and kit transcription checks. [Classification tests](<../../swissquote-wallet/tests/protocol/codes-classification.test.ts>) cover protective cancellation, payment thresholds, admin rules, forbidden delegatecalls, strict mixed batches and nested CALL denial. [Verification tests](<../../swissquote-wallet/tests/protocol/wallet-verification.test.ts>) check pinned code/storage/actors/modules, pending recovery, owner nonce history and multi-client disagreement/refusal.

Fixture paths now use durable contract-plan snapshots and the already-installed contract SafeProxy artifact, not another agent's temporary directory. Reproducible clean-checkout dependencies/snapshots still need the normal project setup; this pass did not install them or certify CI portability.

## Remaining actionable gate

[Recovery-tool checkWallet](<../../swissquote-wallet/apps/recovery-tool/src/core.ts#L23-L29>) and [service adapter verification](<../../swissquote-wallet/services/swissquote/src/chain.ts#L30>) still omit `expectedCurrentOwner`. They therefore default to the original owner after legitimate recovery/rotation. The service [funding route](<../../swissquote-wallet/services/swissquote/src/app.ts#L146>) rechecks linked original setup. Owning builders must preserve original creation evidence, carry an authorized expected current owner separately and add post-change recheck/funding evidence. Simply trusting the returned owner list would defeat this independent expectation.

No live/local deployed end-to-end recovery, real waits, no-card/personal-sign refusal, old-key GS026, dual-module cancellation, services-stopped kit sweep, browser/portable HTML, relayer/passkey enforcement, package-entry integration or reviewer-test typechecking was executed here. Those remain separate acceptance gates in the [current swarm plan](<../plans/swarm-integration-status.md>). The bounded protocol-review task is complete; project/story acceptance is not inferred from it.
