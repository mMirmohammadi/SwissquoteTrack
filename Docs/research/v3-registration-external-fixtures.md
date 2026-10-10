# Registration fixture compatibility

The existing external service fixtures now provide the required `registrationBlock(minimumBlockNumber?: bigint): Promise<bigint>` adapter method. Production service, protocol, app, browser, and runtime files were not changed.

## Changes

Only mock methods and explanatory comments were added. Existing assertions, test cases, and test IDs remain unchanged; no tests were skipped or removed.

- [service-adversarial.test.ts](<../../swissquote-wallet/tests/security/service-adversarial.test.ts#L34>): fixed local in-memory head `0n`.
- [v3-recovery-services.test.ts](<../../swissquote-wallet/tests/integration/v3-recovery-services.test.ts#L94>): fixed local in-memory head `0n`. The separate polling client's head `100n` does not describe this service adapter.
- [services.test.ts](<../../swissquote-wallet/tests/integration/services.test.ts#L31>): fixed local in-memory head `0n`.
- [v3-independent-service.test.ts](<../../swissquote-wallet/tests/integration/v3-independent-service.test.ts#L28>): fixed fake Sepolia head `100n`, or `0n` when the existing fixture selects local chain `31337`. Mock receipt block numbers do not advance this registration head.
- [owner-lifecycle.test.ts](<../../swissquote-wallet/tests/integration/owner-lifecycle.test.ts#L52>): fixed local in-memory head `0n`. The existing owner-replacement control changes only the owner, not an invented block height.

Each method returns its fixed head only when the requested minimum is absent or at most that head. A requested future minimum throws instead of claiming future chain state exists.

The genuinely missing Sepolia receipt API test and all global sender queue assertions in [v3-independent-service.test.ts](<../../swissquote-wallet/tests/integration/v3-independent-service.test.ts#L101-L181>) remain intact.

## Verification

All five edited fixtures passed syntax checking with Node `v26.4.0` using `node --experimental-strip-types --check`. This check does not execute imports, access private keys, start servers, connect to ports, or invoke a chain runtime.

Behavioral service tests remain pending service-lane coherence confirmation. The existing listening/key-bearing suites were not executed because this lane prohibits network/runtime/private-key access. Syntax success is not a claim that service behavior passed.

No new boundary suite was added at this stage: the service lane was still implementing registration, and duplicate ownership of its security regressions had not been resolved. Bad decimal/maximum values, missing head API, and timeout late-write behavior require the final handler API and confirmation that those cases are not already covered by service-owned tests.

## Handoff

The parent can run the unchanged existing tests once the service implementation is coherent. Existing test count is unchanged; this lane added zero test cases. Scope ends at fixture compatibility and this report, without Git, RPC, service-runtime, or private-key operations.
