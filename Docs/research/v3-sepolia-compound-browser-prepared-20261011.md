# Standalone Sepolia Compound browser acceptance prepared — not run

**Result:** the new [Compound browser harness](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs>) passes `node --check` (exit 0). It has not been imported or executed. No browser, service, API, RPC, broadcast, key inspection, Git operation or external publishing was performed by this delegate. This is preparation evidence, not a live acceptance result.

## Lead-only invocation

Working directory: `/home/dev/Hackaton/SwissquoteTrack/.worktrees/v3/swissquote-wallet`.

Exact invocation, with the lead's already known **public** RELAYER address in `SEPOLIA_EXPECTED_RELAYER`:

`ALLOW_SEPOLIA_COMPOUND=yes SEPOLIA_BROWSER_CHAIN_ID=11155111 ALLOW_SEPOLIA_BROWSER_FUND=yes SEPOLIA_EXPECTED_RELAYER="$SEPOLIA_EXPECTED_RELAYER" node --import tsx tests/browser/sepolia-compound.mjs`

The address variable must be nonzero and valid; no private key or service environment file is read by the harness. The existing built portable recovery tool and installed Playwright/tsx dependencies must already exist. The optional `BROWSER_EXECUTABLE` selects an existing Chromium binary; this script does not install one.

Attach only to the parent's existing isolated Sepolia stack: wallet `http://localhost:5273`, independent tool `http://localhost:5274`, Swissquote `http://localhost:4101`, partner `http://localhost:4102`. The script starts no stack, changes no flags and owns no ports. Run it separately, after the parent's existing [P0 harness](<../../swissquote-wallet/tests/browser/sepolia-service.mjs>) has settled. A MOCK fresh ledger of 2 USDC does not require this harness to spend 2: its distinct new user requests exactly 1 USDC of actual test-token funding. The lead owns service-role funding and payout/fee budget checks.

## Bounded action and safety scope

The hard deadline is 300 seconds including cleanup. A separate browser context generates a 12-word recovery card offline. The wallet context performs fresh password registration plus genuine service-verified WebAuthn with a Chromium virtual authenticator, MOCK KYC, unsigned UI wallet deployment, actual EIP-1271 ownership verification and deterministic Safe checks. The independent tool performs its existing two-public-node wallet/card checks and invalid-link/24-word rejection checks. Only after an observed green result does the wallet funding checkbox get checked.

The new wallet receives one real MOCK-bank payout of 1000000 USDC base units. There is no payment. Through the existing DeFi UI it chooses Compound supply, enters `1`, requests one real service preview, acknowledges the displayed risk summary and confirms once. The intercepted relay request must match the preview transaction exactly, use chain 11155111, source `dapp`, dappId `compound`, the reviewed effectsHash and a recovered current-owner EIP-712 signature. Exported protocol decoders require exactly approve(1000000), supply(USDC,1000000), approve(0), zero-value CALLs inside the pinned zero-value MultiSendCallOnly DELEGATECALL, nonce zero and all Safe gas/refund fields zero. Small classification does not require transaction-bound passkey step-up; no step-up token is injected.

Every deploy, bank funding and supply endpoint has a maximum of one browser POST attempt. There is no recovery, withdrawal from Compound, direct handcrafted API submission, signing-key import, owner-funded send, automatic retry, state override, fixture response, fork or chain relabeling. Only fixed public-node origins and enumerated read-only RPC methods are permitted in Node and browser traffic; Node transports use no RPC retries. The browser may use the existing application's bounded read-only retries. Unknown origins, write methods and service POST routes are aborted. Card phrases in plain/URI-encoded or JSON-array form are blocked before transmission. Browser exceptions and arbitrary service bodies/messages are never printed; output contains explicit public evidence fields and sanitized blocker categories only.

Before any browser write, the harness requires strict sponsorship enabled, an idle unblocked service sender, two nodes reporting 11155111 and the existing exported registry code/proxy/admin pins. It repeats those pins before supply. It does not weaken live screening or simulation: the service must return accepted current evidence. Pin changes, unavailable simulation or effects mismatch remain stop conditions, including pins for unrelated registered swap contracts.

## Acceptance evidence the lead's run must produce

The JSON record starts as `not_run`; only the fully completed path sets `passed`. It records public hashes, wallet/owner/contract/expected sponsor addresses, separate funding provenance, two-node receipts including outer success, block number/hash, gas usage/cost and sender identity, plus preview block/effectsHash and counts rather than arbitrary service text.

At a common agreeing block before supply and at the receipt block after, both nodes must agree on actual wallet USDC, Compound `balanceOf`, `borrowBalanceOf`, selected allowance, Safe nonce and owner/wallet ETH. Required initial values are exactly 1000000 USDC, zero position/borrow/allowance/nonce/ETH. Required effects are spend exactly 1000000, positive actual position credit, borrow still zero, allowance zero at receipt block, nonce +1, and owner/wallet ETH still zero. Actual position values and difference from nominal are saved, not fabricated into an exact 1-USDC position delta: Compound rounding and elapsed-block accrual can differ.

Supply additionally requires the actual transaction sender to equal the explicit intended RELAYER, wallet Safe `ExecutionSuccess` with matching Safe hash and zero refund payment, absence of `ExecutionFailure`, and the exact wallet-to-Compound USDC Transfer. Canonical signed calldata already proves the approval/action/revoke order. Actual matching Approval event values are retained: first 1000000, then only zeroes, including a possible intermediate zero emitted by `transferFrom`. Exactly two Approval logs are deliberately not assumed. Compound logs are retained as raw public topics/data because current repository ABIs do not include its Supply event; no unverified event ABI is invented.

The UI must finish with its exact confirmed Safe success and receipt-block zero-permission messages and no alert. Exactly three successful receipts and one attempt per deploy/fund/supply path are required. Timeout or uncertain submission produces an incomplete outcome with any observed public hashes; inspect the service's durable sender intent/status and public chain before any retry. The deadline does not cancel an already accepted service broadcast.

## Source basis and limits

The scope follows the [read-only lead plan](<v3-defi-mined-execution-readonly-lead-plan-20261011.md>) and [G10 authority](<../../../../AgentsLocal/AUTHORITY.md#L115-L117>). Scoped P0 helpers were copied because the existing standalone script exports none; that script, root tests, feature/runtime interfaces and service policies were not altered.

Selectors and request shape come from the current [DeFi feature](<../../swissquote-wallet/apps/wallet/src/features/dapps/index.tsx#L49-L168>) and [wallet navigation/signing shell](<../../swissquote-wallet/apps/wallet/src/App.tsx#L418-L426>). Batch validation and actual state methods use the existing [protocol dApp code](<../../swissquote-wallet/packages/protocol/src/dapps.ts#L23-L90>). Fail-closed pins and rounding semantics use [simulation code](<../../swissquote-wallet/packages/protocol/src/simulate.ts#L11-L44>) and [observed-effects validation](<../../swissquote-wallet/packages/protocol/src/simulate.ts#L100-L142>). Sender, strict health and preview behavior come from [service routes](<../../swissquote-wallet/services/swissquote/src/app.ts#L111-L125>).

Syntax validation is not an import-resolution check, browser result, public RPC availability check or acceptance result. The lead still must validate its existing build flags, service fee/payout budget, supported simulation nodes and actual mined receipts. MOCK KYC/account, virtual passkey, third-party nonofficial Compound deployment, no cash value, no deposit protection and smart-contract risk remain explicit. Recovery and emergency kit are not exercised by this standalone supply variant. Stop after recording the bounded supply result; publishing is not authorized.
