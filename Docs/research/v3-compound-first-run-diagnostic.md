# Compound first-run diagnostic

The first Compound run deployed its wallet and passed EIP-1271 ownership verification, then stopped before funding or supply. The exact failing operation is not recoverable from the public evidence. This change adds granular, locally defined diagnostic stages; it does **not** claim to fix an RPC fault or authorize another live run.

## Evidence and failure boundary

The [public run evidence](<../../AgentsLocal/46257332/v3/sepolia-compound-1.json#L13-L38>) records only deployment transaction `0xd58b2858585290032e6c0ed13c5c73e3b7fa32dd38fa219e620ddac06bc279f1`, successful at Sepolia block `11887231`. Wallet: `0x55d868BCbf7daDce87b1ADEC90dEab530F6233A6`; original owner: `0xA739b6b9455C3171a13D07cc43e52AC8a73319E3`. Its [broadcast counter](<../../AgentsLocal/46257332/v3/sepolia-compound-1.json#L60-L66>) contains only one `/relay/deploy`; no funding or supply request appears. The parent reported that command 1334 completed with exit code 1; this diagnostic did not execute that command or access its private state.

The [retention and ownership evidence](<../../AgentsLocal/46257332/v3/sepolia-compound-1.json#L52-L59>) records encrypted device/auth retention before funding and `ownershipProofHash`. In the [harness](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L275-L281>), that hash is assigned only after both proof-hash binding and the actual Safe `isValidSignature` assertion return the EIP-1271 magic value `0x1626ba7e`. Therefore the broad blocker label does not mean EIP-1271 failed.

The remaining original failure boundary is the setup textarea read, setup decoding/binding, or either node's receipt-block runtime code, owners, threshold, nonce, or owner ETH check. The [original public blocker](<../../AgentsLocal/46257332/v3/sepolia-compound-1.json#L63-L66>) is `redacted_runtime_error`, not the category used for a directly thrown Node assertion. That does not identify an RPC failure: setup decoding can also throw ordinary errors, and a code-hash operation can throw on an unexpected value. No raw exception, setup contents, signature, credentials, or private retention files were inspected.

## Source comparison and RPC guard

The [service P0 source](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L230-L243>) has the same order: EIP-1271, setup textarea/decode/binding, then two-node receipt-block code/owner/threshold/nonce/owner-ETH checks. The parent reports P0 passed; this comparison establishes shared logic, not a reproduction of the Compound failure.

The Compound [transport guard](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L26-L28>) and [fetch wrapper](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L79-L89>) allow exact public RPC origins and only their root URL, plus the explicit read-method allowlist. Every configured URL is an origin without a path. Offline `new URL(configured)` checks confirmed that each produces the required root trailing slash and matches the origin list. There is no fixed origin/trailing-slash mismatch in these constants. The run already passed guarded two-node chain identification, deployment receipt agreement, and the primary EIP-1271 call, which also argues against a universal transport rejection.

The [installed viem transport](<../../swissquote-wallet/node_modules/viem/clients/transports/http.ts#L129-L136>) passes the configured fetch function through to its RPC client. The [RPC implementation](<../../swissquote-wallet/node_modules/viem/utils/rpc/http.ts#L120-L146>) constructs a JSON body, sets method `POST` by default, and supplies URL/body/method to that function. The wrapper's expected shape matches that implementation. No dependency or guard was changed.

A secondary node could lag the receipt block, or a historical read could fail temporarily, but neither cause is demonstrated by the original evidence. Both nodes had already returned agreeing successful receipts. A fresh successful public read would show present availability; it would not prove what the node returned during the original failure. The parent's separate public-read job 1337 was left to its owner rather than duplicated here.

## Change and verification

The [modified failure boundary](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L273-L312>) assigns local labels immediately before each operation and its assertion. Labels distinguish primary versus secondary receipt-block reads and separate RPC reads from returned-value assertions. Setup retrieval, decoding, chain binding, and wallet/owner binding are also separately labelled. No exception text or arbitrary RPC response enters public evidence.

All existing assertions remain strict: same receipt block, runtime-code pin, sole original owner, threshold one, nonce zero, and zero owner ETH on both nodes. Independent-tool current-owner/history checks, registry pins, the read-method guard, retention, deadline, and single-broadcast restrictions are unchanged. No retry was added to a broadcast or read. A head-wait/retry change was deliberately withheld because the original evidence does not demonstrate head lag or an outage; instrumentation is the supported scope.

Verification passed: `node --check tests/browser/sepolia-compound.mjs` and an offline assertion of all configured RPC URL normalizations, from the wallet project directory. The harness itself was not executed. No browser, authentication, runtime mutation, key/private environment read, service API write, RPC send, fresh deployment, or Git operation occurred during this diagnostic.

## Decision for the parent

Treat this as a diagnostic improvement, not completed Compound acceptance. Preserve the existing retained wallet; the parent reports its wallet ETH and USDC remain zero. Review the separately owned public-read result before deciding any next experiment. Only demonstrated head lag or transport outage would justify a bounded read-only wait/retry within the existing deadline, while retaining exact block/history, both nodes, current-owner verification, and pins. The original failing operation remains unknown until evidence identifies it; no fresh live run is authorized by this report.
