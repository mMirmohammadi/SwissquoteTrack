# Sepolia service P0: prepared, not executed

The opt-in [browser script](<sepolia-service.mjs>) is ready for lead review. No browser, API, RPC or transaction action was executed during preparation. No source, launcher, gate, package manifest, key file or Git operation was changed. Only the new script and this report were written.

## Approved scope and stopping condition

The script attaches to the existing wallet, independent tool, Swissquote and partner processes on localhost ports 5273, 5274, 4101 and 4102. It never launches a service or reads service keys/storage. It refuses browser launch without `ALLOW_SEPOLIA_BROWSER=yes` and `SEPOLIA_BROWSER_CHAIN_ID=11155111`, checks the actual service health chain and strict-sponsorship flags, and checks two public Sepolia RPC chain IDs.

It stops after one fresh registration, virtual-passkey enrollment verified by the actual service, explicitly MOCK KYC, independent offline 12-word card creation, unsigned UI wallet deployment, fresh EIP-1271 ownership proof, actual independent-tool validation and wallet verification, optional exact 1-USDC MOCK-account funding, and one owner-signed 1-USDC payment. Recovery, kit download/opening, owner rotation, DeFi, publication and repeat payment are intentionally excluded. The current App automatically constructs an encrypted kit during wallet creation; the script neither extracts nor tests it.

The entire approved run has a hard 300-second process deadline. Receipt polling is bounded and read-only. Each deployment, funding and payment service POST is allowed at most once. Unknown network destinations, non-read RPC methods and other service transaction endpoints are blocked before forwarding. An uncertain result is never automatically retried. Public hashes and attempt counts are preserved when available; a missing hash does not claim that nothing was broadcast.

## Run contract for the lead

After review and separate authorization for real writes, run from the wallet project root with these non-secret environment values: `ALLOW_SEPOLIA_BROWSER=yes`, `SEPOLIA_BROWSER_CHAIN_ID=11155111`, and a lead-approved public `SEPOLIA_RECIPIENT` address. Use `ALLOW_SEPOLIA_BROWSER_FUND=yes` only when the optional real transfer from the funded MOCK account is authorized. Invoke `node --import tsx tests/browser/sepolia-service.mjs`. An installed Chromium may be selected using `BROWSER_EXECUTABLE`; the script does not install dependencies or browsers.

The process emits public, redacted JSON to stdout. The lead may capture that stdout outside a publication path. It includes wallet/owner/relayer public addresses, submitted transaction hashes, chain, block number/hash, receipt gas used, effective gas price, computed gas cost, exact amount and Safe nonce effects, and recognized screening-source outcomes. It never emits login responses, bearer tokens, passphrases, raw request bodies, ownership signatures, storage, card words, owner seed, kit or kit code. The browser receives only a small OS environment allowlist, not inherited service keys.

## Evidence the script requires

The unsigned creation request must match the actual approved initializer and deterministic factory address computation, and the predicted proxy must not already exist. A mined factory `ProxyCreation` must identify that wallet and the approved Safe singleton. Two public receipts must agree. Both public nodes must confirm the Safe proxy code hash, sole browser-generated owner, threshold one and nonce zero. The fresh browser ownership signature must return the actual EIP-1271 magic value.

The independent portable tool is loaded offline from the fixed public build path in a separate browser context. Both that artifact and the served tool must display the actual Sepolia default. The served tool must refuse a setup URL and synthetic 24-word input, then report both pinned history-node checks passing for the original setup, independently expected owner and actual card. The script only acknowledges green in the wallet after that real tool result.

The payment request must be an exact owner EIP-712 signature over a zero-refund Safe CALL transferring 1,000,000 USDC base units to the approved recipient. The service must classify it Small and return successful strict screening, no hits, fresh required RedStone sanctions evidence, and clear required issuer-freeze results for the actual USDC/EURC configuration. Known-old secondary Chainalysis coverage is not described as comprehensive compliance. Identity remains MOCK.

The mined payment must come from the same public sender as the deployment, not the owner. A matching Safe `ExecutionSuccess` with zero refund, no `ExecutionFailure`, and exact token `Transfer` are required. At the payment block both nodes must confirm nonce increment, exact wallet/recipient USDC deltas, and zero ETH for both owner and Safe. An actual UI chain-confirmation message must appear.

## Cost and blockers

Expected authorized broadcasts: two from RELAYER (deploy + one payment), plus one optional SQ_ACCOUNT transfer of exactly 1 USDC for a fresh empty wallet. WebAuthn and EIP-1271 verification do not broadcast transactions. No testnet ETH cost was measured because nothing ran. The existing service estimates gas with a 20% allowance, caps each operation at 15,000,000 gas and rejects normal Sepolia fee quotes above 20 gwei. These are service ceilings, not a cost estimate or a script-enforced financial cap; default worst-case ceiling is 0.3 testnet ETH per operation. The lead must review relayer/account funding and approve the real run.

The current health response does not expose `ALLOW_SEPOLIA_WRITES` or the configured relayer address. The script does not invent those fields: it gates on the actual chain/mock/strict feature fields plus explicit browser consent, and establishes the sponsor from mined transaction senders. The service's own write flag, funded service-only RELAYER/SQ_ACCOUNT keys, budgets and screening availability remain prerequisites.

Preparation checked repository contracts only. It did not verify the current running processes, portable artifact execution, browser availability or RPC freshness. Public RPC lag/outage, stale required sanctions data, unavailable issuer-freeze evidence, service sender latch/budget, absent funding consent, insufficient MOCK-account funds, and selector changes all remain possible blockers. A timeout after any submission means inspect service state and public hashes before deciding whether another run is safe.

## Sources reviewed

[Communication policy](<../../../Docs/agents/HUMAN_FACING_COMMUNICATION.md>), [existing clickflow](<clickflow.test.mjs>), [browser harness](<harness.mjs>), [tool validation tests](<validation.test.mjs>), [feature-flow selectors](<feature-flow.test.mjs>), [actual App](<../../apps/wallet/src/App.tsx>), [ownership lifecycle](<../../apps/wallet/src/lifecycle.ts>), [payPreview](<../../apps/wallet/src/features/pay/index.tsx>), [settings implementation](<../../apps/wallet/src/features/settings/index.tsx>), [tool entry](<../../apps/recovery-tool/src/main.ts>), [tool core](<../../apps/recovery-tool/src/core.ts>), [tool validation](<../../apps/recovery-tool/src/validation.ts>), [Sepolia launcher](<../../sepolia-demo.mjs>), [service API](<../../services/swissquote/src/app.ts>), [chain adapter](<../../services/swissquote/src/chain.ts>), [screening implementation](<../../services/swissquote/src/screening.ts>), [screening configuration](<../../services/swissquote/src/local-screening.ts>), and [protocol constants](<../../packages/protocol/src/constants.ts>).

Static review only: imports and signatures were checked against protocol exports; selectors were traced to actual App/payPreview and existing browser tests. No syntax command, build, auto gate or test was executed under the no-execute instruction.
