# Candidate B on Bitcoin: compiled policy and regtest findings

## Result

**The authorization rule works on Bitcoin Taproot, but the proposed policy is not equivalent to Candidate B's full smart-account recovery flow.** The final Bitcoin Core regtest run passed **54 checks** and mined **five spending transactions**. It demonstrated user-only normal spending and recovery requiring the independent user recovery key plus either recovery partner.

Three limits affect the product decision:

- **The delay is the age of each coin, not a countdown started by a recovery request.** Old coins can be recovered immediately; this script has no request/cancel state.
- **Swissquote co-signs the recovery spending transaction on its branch.** Not learning the phone key is different from being unable to co-sign. If G2 prohibits every spending-transaction co-signature, this implementation fails that requirement.
- **Recovery moves funds to a new address.** It cannot revoke the old phone key at the original address. A thief holding that key can spend first.

This is a bounded executable experiment, not a production wallet, cryptographic audit, legal classification, or approval of Candidate B. No public-network transaction was sent. The isolated node stopped after the test.

## Scope and authority

User assignment: this session's m00162, Bitcoin open piece 1 from [the catch-up message](<AgentsLocal/46257332/outbox/003-4ccb895d-catch-up.md>). Read the [official brief](<Docs/desc.md>), [G1–G6 authority record](<AgentsLocal/AUTHORITY.md>), shared context, coordination proposal and linked prior findings before testing. G2–G5 remain the recorded decisions; G6 is a wish and Candidate B remains a proposal. The subsequent [design-note message](<AgentsLocal/46257332/outbox/004-4ccb895d-user-doc.md>) is also input, not approval of an alternative policy.

This report extends, rather than repeats, [the existing candidate analysis](<AgentsLocal/46257332/research/03-design-candidates.md>). Research 01–05 and other agents' files were not modified. The earlier [general wallet-recovery note](<Docs/research/wallet-recovery-options.md>) is background, not the current authority record.

## Exact policy and compiled script

`U` is the phone's everyday key; `R` is an independent user-held recovery-card key; `P` is the independent partner's key; `SQ` is Swissquote's recovery-signing key. The experiment uses unrelated, publicly reproducible test keys. **Never send real funds to its addresses.** The ordinary signing key and recovery-card key must not collapse into the same compromised secret in a real design.

The spending condition is `U OR (R AND (P OR SQ) AND coin_age >= N)`. This is not ordinary two-of-three recovery. `R` is mandatory in the recovery branch and is not the standalone phone-key backup requested in G5.

The compiler received `and(pk(R),and(or(pk(P),pk(SQ)),older(6)))`. Its output was `and_v(v:pk(R),and_v(or_c(pk(P),v:pk(SQ)),older(6)))`. The resulting symbolic descriptor is `tr(U,and_v(v:pk(R),and_v(or_c(pk(P),v:pk(SQ)),older(6))))`: substitute the concrete x-only public keys before using it as a descriptor. `U` is the Taproot internal key; the recovery policy is one committed leaf. The high-level input is a policy expression, not itself a Bitcoin Core descriptor.

The leaf's assembly is `<R> OP_CHECKSIGVERIFY <P> OP_CHECKSIG OP_NOTIF <SQ> OP_CHECKSIGVERIFY OP_ENDIF 6 OP_CHECKSEQUENCEVERIFY`. Its encoded size is **106 bytes**. The [compiled artifact](<Docs/research/bitcoin-taproot-candidate-b-evidence/compiled-policy.json>) records the exact script bytes, public keys, tree root, control block, address and concrete descriptor. Core independently parsed that descriptor and derived the same address as the signing library.

The witness stacks, listed bottom to top, are:

- Normal key path: the phone's signature under its **Taproot-tweaked** key. No recovery-party signature is needed.
- Partner branch: `sig(P), sig(R), script, control_block`.
- Swissquote branch: `sig(SQ), empty, sig(R), script, control_block`. The empty item is the deliberately unsatisfied partner-signature slot, not a missing user signature.

Recovery transactions used version 2 and input sequence 6. Six blocks is a short test parameter, not a proposed production waiting period. Signatures used `SIGHASH_DEFAULT`. Taproot's tree commitment, key-path tweak and script-path witness rules are specified in [BIP-341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki); Tapscript execution is specified in [BIP-342](https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki).

## What was executed

Final run: **2026-10-10 13:41:27–13:41:29 UTC**, Bitcoin Core **29.0**, Node **26.4.0**, regtest only. The recorded chain ended at height **120**. Core reported Taproot active, network activity disabled and zero peers. RPC bound to loopback; P2P listening, discovery and DNS seeding were disabled.

The [test harness](<Docs/research/bitcoin-taproot-candidate-b-evidence/verify.mjs>) compiles the policy, constructs real Schnorr-signed transactions, and calls a real Core node. It does not mock the Bitcoin interpreter. The [full results](<Docs/research/bitcoin-taproot-candidate-b-evidence/results.json>) include each assertion, signed transaction hex, rejection reason, block hash and mined transaction ID.

### Authorization

- The phone spent immediately through the key path, with a final sequence, and the transaction was mined.
- `R + P` and `R + SQ` each produced a successful, mined script-path recovery transaction.
- All eight subsets of `{R, P, SQ}` were checked against both witness branches: **16 coalition probes**. No set without `R` succeeded. `R` alone also failed.
- Separate attempts to use `R`, `P` or `SQ` as the phone key failed. Supplying a Swissquote signature where the script demands `R` failed with `mandatory-script-verify-flag-failed (Invalid Schnorr signature)`, including a block-validation attempt.
- Replacing the committed leaf with a partner-only script failed with `mandatory-script-verify-flag-failed (Witness program hash mismatch)`.
- Changing the destination after the user signed failed. This establishes binding for the tested `SIGHASH_DEFAULT` transactions, not protection against a compromised signing interface or a user approving different transaction contents.

### Delay: the important counterexample

The original outputs were confirmed at height **H = 102** with `N = 6`. At tip **106**, a candidate spend in the next block, 107, was rejected with `non-BIP68-final`. At tip **107**, spending in the next block, **108 = H + N**, was accepted. An immature recovery was also rejected by block validation: `TestBlockValidity failed: bad-txns-nonfinal`.

After further blocks, the same recovery remained immediately available for an old output **without any recovery-initiation transaction**. A fresh deposit to the same address was still immature. Thus the timer belongs to each output, not to the account or the recovery attempt.

Attempts to bypass CSV with a lower sequence, the sequence disable flag, final sequence, a time-based sequence against this block-based script, or transaction version 1 failed with `mandatory-script-verify-flag-failed (Locktime requirement not satisfied)`.

These observations match [BIP-68 relative lock-time](https://github.com/bitcoin/bips/blob/master/bip-0068.mediawiki) and [BIP-112 CHECKSEQUENCEVERIFY](https://github.com/bitcoin/bips/blob/master/bip-0112.mediawiki). `older(N)` cannot by itself create a fresh, cancellable waiting period each time recovery is requested. Spending the coin first can defeat a competing recovery spend; it is not cancellation of a persistent recovery request. More elaborate vault/staged-transaction constructions are outside this experiment.

### Migration, theft and backup

The partner recovery swept to an output committing to a new phone key. The old phone key failed on that output, and the new phone key spent it in a mined transaction. The new address differed from the original. A later deposit to the **original** address remained spendable by the **old** phone key.

A recovery transaction was valid before a competing phone-key transaction was mined. After that competing spend confirmed, the original output was gone and recovery failed with `missing-inputs`. The network cannot distinguish the legitimate phone from a thief holding the same private key. This is a concrete counterexample to guaranteed rescue after phone-key theft, not a simulation of fee bidding or every mempool race.

For G5, the harness deserialized a test phone-key backup and public tree metadata, then successfully signed without either recovery party. It also showed that deriving a bare `tr(U)` address without the committed recovery tree produces a different address. A practical kit therefore needs the relevant descriptor/tree metadata and wallet discovery information, not just an assumption that restoring a bare key reproduces this address. **No encrypted kit, paper-code flow, hardware restoration, or separate time-locked emergency-key branch was implemented.**

## Fit with the current requirements

**Normal user-only signing:** satisfied by this tested key path. Swissquote is not part of ordinary spending.

**No coalition of non-user recovery parties can recover:** the tested policy enforces a user-key requirement, assuming `U` and `R` remain unavailable to the coalition, the funded output really commits to this policy, and the cryptographic primitives hold. It does not prove biometric identity, honest enrollment, trustworthy wallet delivery, correct HSM operation, availability, or that nobody can deceive Swissquote.

**Swissquote cannot co-sign:** not satisfied if this means any transaction moving funds. The successful `R + SQ` witness contains a Swissquote signature on the recovery spend itself. This is not hidden by calling it a recovery vote. Whether that capability creates legal duties requires the separate legal analysis; no legal conclusion follows just from this test.

**Plain two-of-three recovery:** not satisfied. Making `R` mandatory intentionally excludes the partner-plus-Swissquote pair. Losing `U`, `R`, and the standalone phone-key backup leaves no permitted spending path. The experiment does not approve a change to G2/G4.

**Same-address revocation:** not provided. Changing the phone key, guardian keys, threshold structure or committed delay requires a different commitment and migration of affected outputs. Existing commitments do not change when an app changes its settings. The phone backup can restore access to the same address if its metadata is preserved, but it does not revoke a stolen copy.

**Minimal institutional data:** no phone private key is needed by Swissquote. Its own recovery-signing key and approval process are nevertheless security-sensitive. Production identity checks, transaction review, privacy and key storage were not tested.

**Recommendation:** keep this as evidence for a Bitcoin-specific **sweep recovery with mandatory user participation**. Do not present it as a direct implementation of the EVM request/wait/cancel flow. Before adopting it, resolve the recovery co-signing prohibition and whether the desired delay is coin age or time since a request. Do not fund a production policy while those meanings remain unsettled.

## Reproduction and evidence integrity

The durable [evidence directory](<Docs/research/bitcoin-taproot-candidate-b-evidence/>) contains the [harness](<Docs/research/bitcoin-taproot-candidate-b-evidence/verify.mjs>), [dependency manifest](<Docs/research/bitcoin-taproot-candidate-b-evidence/package.json>), [lockfile](<Docs/research/bitcoin-taproot-candidate-b-evidence/package-lock.json>), [compiled policy](<Docs/research/bitcoin-taproot-candidate-b-evidence/compiled-policy.json>) and [successful results](<Docs/research/bitcoin-taproot-candidate-b-evidence/results.json>). Runtime block databases and binaries are not part of the durable evidence.

Pinned packages: `@bitcoinerlab/miniscript-policies@1.1.0`, `@bitcoinerlab/miniscript@2.0.0`, and `@scure/btc-signer@2.4.1`. The [policy compiler](https://github.com/bitcoinerlab/miniscript-policies) exposes a Taproot wrapper around its reference-compiler/rewriting path; this experiment does not claim it is an independently verified or globally optimal native Taproot compiler. [Miniscript analysis and satisfaction](https://github.com/bitcoinerlab/miniscript) produced two non-malleable symbolic satisfactions. [Scure's signing library](https://github.com/paulmillr/scure-btc-signer) encoded the script, generated signatures and applied the Taproot tweak. Core descriptor parsing and consensus validation provided an independent check on the resulting artifacts.

The final harness SHA-256 is `55880042f9f054e559f06f3276d464551ffe53c3b08fa4c5320c3021c26d2c3b`; it matches the value recorded by the successful run. Bitcoin Core's x86-64 Linux archive SHA-256 is `a681e4f6ce524c338a105f214613605bac6c33d58c31dc5135bbc02bc458bb6c`, checked against the [official release manifest](https://bitcoincore.org/bin/bitcoin-core-29.0/SHA256SUMS). Maintainer-signature verification of that manifest was not performed.

To repeat on x86-64 Linux with the recorded Node version:

1. Reserve a new, exclusively created `AgentsLocal/<8-hex-id>/` directory, then create a `bitcoin-regtest` subdirectory. Copy the durable harness, dependency manifest and lockfile into it. Do not run inside another agent's directory or copy its node data.
2. In that new subdirectory, run `npm_config_cache="$PWD/npm-cache" npm ci --ignore-scripts --no-audit --no-fund`.
3. Download the [Core 29.0 Linux archive](https://bitcoincore.org/bin/bitcoin-core-29.0/bitcoin-29.0-x86_64-linux-gnu.tar.gz), verify the checksum above, and extract its `bitcoin-29.0/bin/bitcoind` into the same subdirectory. Preserve its executable permission.
4. Run `npm test`. Expected terminal conclusion: `ALL 54 CHECKS PASSED; 5 SPENDS MINED; NODE STOPPED`, exit code 0. Each invocation creates a new `run-*` directory and writes its own results; it does not overwrite the durable reference result.

The funding wallet and mined blocks are fresh each run, so transaction IDs and block hashes may differ. Policy bytes and deterministic test addresses should match. Never use the fixture keys with real assets.

An initial run reached the final negative case but failed its test assertion because the harness expected a different rejection-string spelling. Core actually reports `missing-inputs`. The corrected test verifies that the previously valid transaction becomes invalid after the outpoint is confirmed spent, and records Core's actual response. The final expanded suite passed in full; this was not an unresolved consensus failure.

## Limits and stopping condition

Covered: one concrete leaf, fixed test keys, all recovery-party subsets, important CSV bypass attempts, actual key-path and both recovery-path spends, a migration, tampering attempts and one confirmed-spend race. This is not exhaustive formal verification. Key generation ceremonies, HD discovery, multi-input coin selection, multisigner PSBT transport, RBF/package-fee strategies, reorg behavior, HSMs, biometric services, hardware-wallet support, app integration, alternate two-of-three policies and public signet interoperability remain untested.

The requested compile/regtest/report task is complete. Further implementation or alternate-policy testing requires a separate scope decision. No production wallet files, peer-owned research, shared authority entries, commits or deployments were changed.
