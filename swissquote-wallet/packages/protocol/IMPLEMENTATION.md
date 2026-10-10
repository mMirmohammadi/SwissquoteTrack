# Protocol lane handoff

**Ready for integration:** stable exports, concrete HTTP types, wallet template/signing, independent verification and emergency-kit helpers are implemented. The package builds and its unit tests pass. This lane wrote only under `swissquote-wallet/packages/protocol/`; no installs, lockfile/root edits, commits, pushes or Sepolia transactions were performed.

## Consumer entry points

Import from `@sq/protocol`. The complete interface is in [EXPORTS.md](<EXPORTS.md>); HTTP request/response types and endpoint registry are in [api.ts](<src/api.ts>). Source exports are collected in [index.ts](<src/index.ts>).

The setup code intentionally excludes the card guardian. The tool derives that guardian from the user's BIP39 card words; it must not accept the app's claim about it. Services and code formats use unsigned decimal strings for bigint fields. `safeTxToWire` / `safeTxFromWire` convert signed transaction fields.

## Implemented behavior

- One-transaction Safe setup uses creation-only MultiSend with a delegatecall into SafeModuleSetup, then four guardian calls with thresholds 1/2. CREATE2 uses the exact initializer and supplied, pinned proxy creation code. Owner/card/partner/Swissquote addresses must all differ.
- SafeTx EIP712, module recovery EIP712, sorted duplicate-free approvals, on-chain recovery hash/nonce/chain assertion, executable calldata, both-module cancellation, owner rotation and SafeMessage ownership proof with EIP1271 magic-value checking.
- Classifier recursively decodes call-only batches, preserves Protective cancellation and strictest inner class, identifies USDC amounts/approvals and decoded recipients, rejects unauthorized delegatecalls and nonzero refund fields. Unknown tokens/calldata conservatively require a passkey as Large. Services still enforce account ownership, Settings origin for Admin, passkey hash binding, simulation, gas estimation, budgets and sanctions checks.
- Scure BIP39/BIP32 generates 24-word owner seeds and 12-word cards on the standard Ethereum path. WebCrypto implements PBKDF2-SHA256 at 600000 iterations and AES-256-GCM. Device passphrases require 12 characters. Emergency-kit code has 160 random bits (32 base32 body characters) plus a five-character checksum. Authenticated kit metadata prevents changing wallet, owner, chain, path or modules unnoticed.
- Verification pins all Safe/factory/module/setup runtime hashes and proxy runtime/creation hashes, checks singleton, owners/threshold, exact module list/pagination, guard and fallback slots, exact guardian sets/counts/thresholds, and pending recoveries. For nonzero Safe nonce, every nonce must appear in the complete SafeL2 multisig event history. Module history is scanned even at Safe nonce zero, because module executions do not increment that nonce. Both owner and module histories are inspected for forbidden delegatecalls. Allowed MultiSendCallOnly history is decoded and its inner operations must be calls. Errors/incomplete logs fail closed. Independent verification requires distinct clients and rejects duplicate known transport URLs.

## Evidence actually run

From the `swissquote-wallet` workspace:

```text
pnpm --filter @sq/protocol test       # 11 passed, 0 failed
pnpm --filter @sq/protocol typecheck  # passed
pnpm --filter @sq/protocol build      # passed
```

Final targeted-fix rerun: package tests **11 passed, 0 failed, 0 skipped**; typecheck and build both exited **0**. Independent reviewer-owned protocol suite (`node --import tsx --test tests/protocol/*.test.ts`) finished **59 passed, 0 failed, 0 skipped**, exit **0**. The first independent rerun was **54 passed, 1 failed** on the newly added sentinel replacement-owner regression; that unusable owner is now rejected, and the complete final rerun passed. Independent tests were read and executed, never edited by this lane.

Final fixes: all five wire numeric fields reject uint256 overflow and non-string decimals; wire addresses and byte-aligned hex calldata are validated; request codes reject zero wallet and zero/sentinel replacement owner; kit AES authentication errors are clear and nonsensitive; nonce-zero module history is checked; separately authenticated current-owner expectations preserve original CREATE2 evidence. Full bounded handoff: [protocol-fixes.md](<../../../Docs/plans/protocol-fixes.md>).

`git diff --check -- swissquote-wallet/packages/protocol` passed. Tests cover initializer contents and deterministic address differences, strict MultiSend parsing, small/large/admin/protective classification, refunds/delegatecall rejection, signature recovery and chain/nonce binding, SafeMessage proofs, strict codes and HTTP integer parsing, known standard seed derivation, encryption/decryption and tamper rejection, every pinned public bytecode hash, hidden owners/modules/guard and weak thresholds, pending recovery, RPC/code/chain failure, duplicate providers, incomplete and forbidden execution history. Public fixture bytes are stored inside the package so tests do not require another lane's contracts dependency installation.

## Limits and next action

No blocker for local integration. These are unit tests using public bytecode fixtures and injected RPC clients, **not evidence of a wallet deployed or a transaction executed by this package**. The chain/story lane must test actual template deployment, Safe/hash agreement, on-chain ownership proof, recovery delay, old-key refusal, cancellation, no-card refusal and kit sweep.

Use the same chainId consistently: default signatures are Sepolia 11155111; local is 31337. Ownership-proof text intentionally retains the exact Sepolia wording from the plan while its EIP712 domain may use the local test chain.

History starts at `historyStartBlock(chainId, head)` by default: `SEPOLIA_HISTORY_START` (11,886,000, shortly before our first Sepolia deployment) on Sepolia; block zero on the local chain and on any chain with Sepolia's id whose head is still below that block. A supplied `fromBlock` wins and must cover wallet creation; otherwise missing multisig nonces fail verification. The head is read once; `eth_getLogs` then runs in sequential ranges of at most 10,000 blocks (`LOG_CHUNK_BLOCKS`) up to that head, separately for multisig and module events. Any failed range, including a provider limit, fails closed; the UI must show that error, not green. Read history through `HISTORY_RPC_URLS` (tenderly, ethpandaops): publicnode answers `4444 pruned history unavailable` for older log ranges, and drpc's free plan rejected a 176-block range, so drpc is no longer listed. Distinct provider ownership cannot be proven from client objects; independent-tool publisher must pin truly independent public RPC endpoints. Nodes may disagree around finality; retry once stable rather than weakening checks.

Rechecking after legitimate owner rotation/recovery supports `VerificationOptions.expectedCurrentOwner`. Keep `setup.owner` unchanged as original CREATE2 evidence; pass a replacement expected owner only after the consumer authenticates that owner independently. Verification never automatically trusts the RPC's current owner. With no option, owner replacement still reports red. Exact single-owner matching and threshold 1 remain mandatory. Do not rebuild a CREATE2 setup with the new owner and claim its original address matches.

Kit instructions are explanatory, not executable; the tool must render them as text and never use kit data to load scripts. JavaScript strings/private-key hex cannot be securely erased; byte arrays are cleared where possible, but app-publisher trust remains as stated in the plan.
