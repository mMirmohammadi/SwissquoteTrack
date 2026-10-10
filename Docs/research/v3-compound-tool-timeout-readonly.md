# Compound 6 independent-tool timeout: public read-only diagnosis

## Result and decision

**The unchanged two-history-node wallet verifier passes now; the original browser timeout remains unclassified beyond the actual-card phase.** Current public verification took 4.337 seconds, returned `ok: true`, nonce `0`, and no reasons. Every observed RPC HTTP response was 200. No HTTP 429, provider error code, transport error, or history assertion was reproduced. This is current-state verification, **not reproduction or explanation of the original transient**.

Do not fund or rerun deployment based on this result. The current test establishes the public wallet/template/history checks, not possession of the original card or successful completion of the original browser interaction. Keep both nodes, complete history, independently expected current owner, and the original card guard unchanged.

## What Compound 6 had already passed

The public [Compound 6 artifact](<../../AgentsLocal/46257332/v3/sepolia-compound-6.json#L13-L68>) records only deployment, successful two-node registration-state checks and EIP-1271, saved encrypted retention, and successful rejection of both a setup link and synthetic 24-word input. It records no funding or supply transaction.

The fixture-success check is appended **after** both rejection assertions. Therefore the historical timeout was after that append, during actual-card input, expected-current-owner input, check-button click, or the green-result wait. It was not the invalid-link or 24-word fixture. At initial inspection these operations were [harness lines 340–352](<../../swissquote-wallet/tests/browser/sepolia-compound.mjs#L340-L352>); the harness is parent-owned and may be edited independently after this observation. No exact failed operation or RPC error is retained in the artifact: its terminal category is `bounded_browser_timeout`, stage `independent two-public-node card and wallet verification`.

A wait specifically for success can exhaust its bound even if the tool has already displayed an error. Source [tool handler](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L57-L63>) sets status error for a failed verifier result; [run](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L19-L25>) also displays thrown errors. That is a mechanism to distinguish next time, not proof that this happened previously.

## Public setup reconstruction and unchanged verification

The new [read-only diagnostic script](<../../AgentsLocal/9e42b610/compound-tool-readonly.mjs>) reads no private files, keys, environment variables, auth, browser storage, or recovery words. It is not registered with tests and is outside production code. It permits only one existing-tool-origin anonymous GET and an explicit JSON-RPC read allowlist on the two pinned history URLs.

It fetched public transaction `0x5ff7eda9dc49547bfa4530c0fd8cd4f522db6b81eb388f88f1ac583492a9277e`, checked its factory destination and Safe singleton, decoded `createProxyWithNonce`, Safe `setup`, the five packed MultiSend calls, and guardian-addition parameters. Rebuilding `buildWalletInitializer(setup)` exactly matched the original transaction initializer. This equality covers the module enabling call, module addresses, operations, guardian additions and thresholds, Safe owner/threshold, fallback handler, and zero-payment parameters, rather than merely trusting current guardians returned by RPC. The canonical template is [wallet initializer](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L54>).

Decoded public parameters, recorded in [result](<../../AgentsLocal/9e42b610/compound-tool-readonly-result.json#L435-L448>):

- Creation owner and independently expected current owner: `0x1E13CEBDf48f43144224E36081405cFC8c4B78f7`. Expected owner was the public artifact value, not inferred from `getOwners`.
- Card guardian address: `0x600411bbc29Ec148436660d53c6C51c893304863`. This address is public; its words were neither accessed nor reconstructed.
- Partner guardian: `0x79b920AbE1e4f644167761D5D59bb20c5e8667B5`; SQ guardian: `0x77F164C4F7ae689b02B8A76166cc141e4633C06A`.
- Salt nonce: `100747979750526600387314241413411034346763503013434830811125482926436479673245`; guardian-addition thresholds: `1, 2, 1, 2`.

The script called the existing `makeClients({ chainId: CHAIN_ID }, HISTORY_RPC_URLS)` and existing `verifyWalletIndependent(clients, setup, { expectedWallet, expectedCurrentOwner })` without monkey-patching verifier methods or changing options to shorten history. It instrumented only the underlying fetch to record HTTP metadata and enforce read-only methods. The [verifier](<../../swissquote-wallet/packages/protocol/src/verification.ts#L35-L125>) selected the minimum current head itself and retained all code pins, guard, fallback, owners/threshold, module and guardian checks, recovery-pending checks, prehistory absence, and module-history validation.

Observed module-log range on both nodes was `0xb55db0` through `0xb563dc`, i.e. default start block 11886000 through common current head 11887580. Both history reads returned HTTP 200. Nonce zero means the existing verifier intentionally skips owner-transaction history enumeration; it still checks prehistory code absence and module execution history. No history rule was disabled. See [history requests](<../../AgentsLocal/9e42b610/compound-tool-readonly-result.json#L390-L425>) and [history rules](<../../swissquote-wallet/packages/protocol/src/verification.ts#L78-L106>).

## Exact current terminal category and pacing

Run observed between `2026-10-10T22:39:28.916Z` and `2026-10-10T22:39:33.360Z`. [Recorded result](<../../AgentsLocal/9e42b610/compound-tool-readonly-result.json#L450-L475>) has terminal category `verification_pass`, `ok: true`, wallet `0x82fE65A6b8a41d9Cb4DA98eF4597823520AF8F54`, nonce `0`, reasons `[]`.

- Node 1, `https://rpc.sepolia.ethpandaops.io`: 30 read attempts including public transaction reconstruction; HTTP statuses `[200]`; minimum actual fetch-start gap 150.012 ms.
- Node 2, `https://sepolia.gateway.tenderly.co`: 29 read attempts; HTTP statuses `[200]`; minimum actual fetch-start gap 150.048 ms.
- Provider JSON-RPC error codes: none. HTTP rate limits: none. `Retry-After` headers: null on all responses. Transport errors: none. History assertions: none. No extra retries or fallback provider were added.

Anonymous GET `http://localhost:5274/src/core.ts` returned HTTP 200. The actually served transformed source contains the `150 - (clock.now() - lastStart)` pacing calculation, `fetchFn: pacedFetch(fetch)`, 12000 ms timeout and `retryCount: 1`. Its SHA-256 is `5a8b0378d646e1670c816eb3d9e1f9ce324127d18cbd304e89527cfc42ca0974`; see [served observations](<../../AgentsLocal/9e42b610/compound-tool-readonly-result.json#L427-L433>). The live source endpoint is therefore paced now; this does not prove which cached version the historical browser executed. Existing [pacing evidence](<v3-recovery-tool-public-rpc-pacing-evidence.md>) was reused as source context, not treated as a newly reproduced rate-limit result.

Re-run only the read-only probe from the v3 wallet workspace with `node --import ./node_modules/tsx/dist/loader.mjs ../AgentsLocal/9e42b610/compound-tool-readonly.mjs`. This command does not invoke the funded Compound harness.

## Safe stage proposal only

No implementation changes were made. In a separately authorized harness-only edit, set a locally defined stage immediately before each actual-card fill, independently expected owner fill, check-button click, terminal-status wait, success assertion, and words-cleared assertion. Keep fixture stages separate. Wait boundedly for either terminal `success` or `error`, then assert success rather than waiting only for green.

Persist only allow-listed classifications: success/error status enum, check-button enabled boolean, elapsed duration, node ordinal, RPC method, numeric HTTP status, numeric provider code, rate-limit boolean, and predefined history/assertion category. Do not persist raw tool error text, RPC bodies, setup/proof payloads, words, auth, or private storage. Keep the existing deadline and fail-closed behavior; an error must not advance to funding. Separating terminal state from the success assertion would distinguish a completed failed read from a browser/UI timeout without weakening verification.

## Limits and preserved runtime

Original-card possession and mnemonic-to-guardian binding were not tested: they require the prohibited secret card. The public guardian address was reconstructed from the original initializer, not used to replace the production card guard. No browser check was run with a fake card, and no claim of end-to-end card success is made.

The historical provider response/status, exact stopping operation, and browser's original served bundle remain unknown. No new authentication, enrollment, deployment, funding, supply, signature, secret printing, private-file read, Git operation, reset, stop, or service change occurred. Existing 5273/5274/4101/4102 services and parent bash job 1646 were untouched. The probe was foreground and completed; no diagnostic background jobs remain.
