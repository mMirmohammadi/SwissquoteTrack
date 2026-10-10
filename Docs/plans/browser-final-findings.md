# Final browser findings

**Mandatory browser acceptance passed; latest customer clickflow is blocked at large-payment WebAuthn challenge binding.** Funding and small send now pass. The initial funding refusal and indexed-event receipt defect below are historical findings repaired by other owners before later reruns. No implementation was edited by this verifier. UI/protocol builders own fixes. Existing wallet5173, tool5174, SQ4001, partner4002 and Hardhat8545 remained in place; no chain reset or workspace package installation occurred.

## Current blocker: large-payment WebAuthn challenge binding

After the protocol builder corrected indexed-event ABI, fresh Chromium clickflow **passed the small 1 USDC owner-signed send**, with a chain confirmation and no step-up verification. The 6 USDC large-payment action then failed with **`WebAuthn challenge must bind transaction hash`**; real SQ `/auth/passkey/step-up/options` refused before authenticator verification. [Latest after-ABI log](<../../AgentsLocal/6b19e47a/clickflow-after-abi.log#L7-L24>).

[Server step-up options](<../../swissquote-wallet/services/swissquote/src/app.ts#L112-L115>) requires generated challenge to equal base64url-encoded transaction-hash bytes. Current [WebAuthn adapter](<../../swissquote-wallet/services/swissquote/src/webauthn.ts#L18>) passes decoded bytes as Uint8Array; source was being edited concurrently, so a stale managed SQ process is plausible but unproved. Direct installed-library probe with decoded Uint8Array bytes returned challenge equality true and 32-byte challenge. Installed SimpleWebAuthn converts a string challenge from UTF8 before base64url output, so passing the already-base64url string would double encode it. Action for integration owner: ensure SQ4001 executes the current adapter and test challenge equality with the installed SimpleWebAuthn version. Preserve exact hash binding; do not bypass the equality guard. Rerun the real browser flow after the runtime is current.

## Resolved receipt ABI defect: indexed transaction hash

Stricter rerun passed funding, then actual small-send relay reached chain but wallet UI reported **`The receipt does not prove successful Safe execution. Inspect chain state before retrying.`** [Rerun log](<../../AgentsLocal/6b19e47a/clickflow-final.log#L21>). Read-only latest receipt inspection found status `0x1`, USDC Transfer of 1,000,000 base units to the selected destination, and Safe ExecutionSuccess topic `0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e` with **two topics** (transaction hash indexed) and only the uint256 payment in data. Public transaction hash: `0x34c558ce9fec0b4b8bdb7e89cb9e77cd42882abc88c226313924da1393fa293c`.

Current [protocol ABI](<../../swissquote-wallet/packages/protocol/src/abis.ts#L14-L15>) declared `event ExecutionSuccess(bytes32 txHash,uint256 payment)` and ExecutionFailure likewise, without `indexed`. [Wallet receipt check](<../../swissquote-wallet/apps/wallet/src/chain.ts#L29-L34>) swallows event decode errors, so a real successful transfer becomes an unproved receipt to the UI.

Action for protocol builder: match the deployed contract event declarations (expected `bytes32 indexed txHash` for these events); rerun wallet receipt decoding and real browser clickflow. Do not drop ExecutionSuccess enforcement. Actual transfer evidence is not yet a passing UI/payment stage, and large passkey step-up remains unproved. A later fresh-context rerun still timed out at small send, so this was not resolved by reload alone.

## Historical integration defect: wallet funding refused

Observed in actual Chromium after a fresh customer was registered with a virtual passkey verified by the real SQ server. MOCK KYC, Safe deployment, ownership proof, independent card+wallet green check, encrypted kit download and offline kit opening succeeded.

Reproduction: create a customer with “Create with a passkey”; mark MOCK KYC verified; create a separate card in the portable tool; deploy the wallet; check its setup/card in the independent tool; acknowledge green; enter 20 USDC on Overview and click “Move to my wallet”. Real SQ `/account/withdraw` returns failure and the UI displays **`Chain preflight refused transaction; nothing broadcast`**. The test stops; it does not claim funding, small payment or large hash-bound step-up passed.

Evidence: [clickflow log](<../../AgentsLocal/6b19e47a/clickflow.log#L1-L25>), [repeatable clickflow](<../../swissquote-wallet/tests/browser/clickflow.test.mjs>). Failure is from [SQ preflight](<../../swissquote-wallet/services/swissquote/src/app.ts#L37>) before broadcasting. The [withdraw adapter](<../../swissquote-wallet/services/swissquote/src/chain.ts#L23>) transfers USDC from the configured MOCK account signer; this is not a browser launch or passkey failure.

Action for integration owner: verify that the configured account signer exists, holds sufficient test-token balance and ETH, and points at the same deployed token/chain. Capture the underlying simulate/estimate exception safely on the server; the current generic preflight refusal does not identify which prerequisite failed. Do not merely bypass preflight or mark the test passed. Preserve the running chain and its existing deployments. Rerun the owned clickflow after the runtime prerequisite is repaired.

## User feedback improvement

Observed funding failure is appropriately explicit that nothing broadcast. However, the user sees a funded MOCK account in the UI but gets no actionable reason when the backing on-chain transfer cannot be sponsored. Recommendation: retain the honest no-broadcast statement and append a nonsecret operator/action hint for unavailable account liquidity, signer gas or chain configuration where the server can classify it. This is a usability recommendation, not a proved token-balance root cause.

## Test harness issues fixed, not UI defects

The portable kit import previously reported “Portable artifact or protocol entry unavailable”. Actual cause was native Node source import `ERR_MODULE_NOT_FOUND` for protocol `types.js`; the installed tsx loader maps NodeNext source specifiers correctly. [Kit test](<../../swissquote-wallet/tests/browser/offline-kit.test.mjs>) now loads actual source and retains exact future import errors rather than masking them.

A broad card-generation role selector matched both the “Make a card” tab and “Generate 12 card words” action. [Mandatory test](<../../swissquote-wallet/tests/browser/browser.test.mjs#L111>) now selects the published `#generate` action. Mandatory rerun: **5 passed, 0 failed, 0 skipped**, [log](<../../AgentsLocal/6b19e47a/mandatory-final.log>).

## Evidence limits

Virtual CTAP2 resident/verified authenticator evidence is real Chromium plus real SQ verification, not hardware authenticator proof. Wallet and tool ran against a local Hardhat chain; two loopback RPC URLs share one operator/node. No live Sepolia transaction, production identity/face verification, live bank account or independent publisher was proved. Browser recovery/cancellation/rotation and post-funding payment results remain outside the completed evidence. No seeds, private keys, card words or kit codes are included in this report.
