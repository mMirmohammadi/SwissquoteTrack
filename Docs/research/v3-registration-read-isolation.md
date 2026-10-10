# Registration read isolation: regression evidence

**The two new isolated regressions pass, and the service typecheck passes.** Only [the owned test file](<../../swissquote-wallet/services/swissquote/test/registration-read-isolation.test.ts>) and this report were created. No implementation or other registration tests were changed.

## Real-adapter isolation

The first regression constructs `createViemChain` with the existing synthetic `01`-repeated key fixture, actual viem transports, and mocked global `fetch`. Every response echoes the incoming JSON-RPC ID. The mock accepts only the configured `HISTORY_RPC_URLS` and expected methods; it checks the nonce contract address and selector. No HTTP connection, socket, signing, or broadcast is performed.

`registrationBlock()` produces exactly six registration requests: two chain-ID reads, two head reads, and two block reads. Their synthetic start times are exactly 0, 150, 300, 450, 600, and 750 ms, all on the first configured endpoint. On return, all six registration request signals are aborted and no registration context remains.

Two concurrent `safeNonce()` calls then return `7`. They produce exactly three additional requests—one chain-ID read, deduplicated by viem, and two nonce calls—all starting at 750 ms on the same first endpoint. The fake fetch checks that their signals are not aborted when used. They do not reuse any registration request signal, advance the synthetic registration clock, or change the recorded registration requests. This distinguishes actual transport isolation from merely testing `pacedFetch` in isolation.

## Recovered attempts versus terminal action failure

The second regression injects HTTP 429 on the first actual transport attempt and then returns successful RPC responses. Inside `withRegistrationReads` and `classifiedRegistrationRead`, the real adapter's `verifyOwnership()` runs the real protocol ERC-1271 verifier and returns `true`. The exact observed methods are chain ID, chain ID retry, and contract call. The registration context records no terminal transport failure.

A separately controlled fake PublicClient action, wrapped in the production `registrationClient` Proxy, demonstrates the converse: a terminal `HttpRequestError` swallowed by the protocol verifier still becomes `registration_rpc_unavailable`. A succeeding classified action clears that failure. The test then leaves another scope in the failed state and proves a new scope starts clean and can return `true`. This covers both action-level reset and request-local isolation.

## Verification and limits

From the service directory, `node --import tsx --test test/registration-read-isolation.test.ts` passed exactly two tests with zero failures, cancellations, or skips. `./node_modules/.bin/tsc --noEmit` completed successfully with no diagnostics.

An initial expectation of two outside chain-ID RPCs was corrected after the first scoped run showed viem deduplicates those concurrent calls. The final assertion pins the actual three-request outside sequence rather than relaxing request counts.

The regressions intentionally cover `safeNonce` as the non-registration read; they do not exercise fee quotes, gas estimates, writes, live providers, or secondary-endpoint failover. The HTTP 429 recovery is viem's same-endpoint retry through the real fallback transport, not a claim that a second URL was selected. The successful verifier is ownership/ERC-1271, not the separate wallet-configuration verifier. No new dependency, Git operation, runtime launch, or live broadcast was used.
