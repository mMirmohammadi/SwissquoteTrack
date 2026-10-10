# V3 payment failure: read-only source diagnostic

## Decision

**Payment remains NOT passed. The strongest source-based explanation is a real non-success HTTP response hidden by the harness's generic assertion category, not a demonstrated `classification` or screening-field mismatch.** The exact refusal is unknown because the public artifact contains neither HTTP status nor an allowlisted service error code. Preserve the funded wallet and retained encrypted state; do not retry, create another wallet, or recover a session on the basis of this report.

This diagnostic changes no implementation or runtime. Its stopping condition is an evidence-backed source explanation plus a bounded instrumentation proposal, not another payment attempt.

## Observed evidence and limits

The supplied [public run artifact](<../../AgentsLocal/46257332/v3/sepolia-service-4.json#L12-L84>) records real deployment and MOCK-account funding receipts for wallet `0xa1fFBa9b87CD2253108fC67252E4fc2985088CFa`, at blocks `11887171` and `11887172`. Its submitted list contains only those two transactions. It records one intercepted `/relay/safe-tx` request, the payment-stage blocker category `contract_or_configuration_assertion`, and encrypted device/auth retention before funding. It does not record payment HTTP status, a payment transaction hash, or an error code.

The task additionally supplies a later public observation: relay idle, last settlement still funding at block `11887172`, Safe nonce `0`, USDC balance `1000000`, latest block `11887174`. These are **user-supplied observations**, not independently queried in this diagnostic. They support “no payment effect observed at that point,” not a permanent guarantee that no transaction was ever submitted.

Only source and the explicitly supplied public artifact were read. No browser, public API request, RPC request, test runner, runtime action, Git operation, private retention file, environment file, key, service database, or authentication/session recovery was used. References below are current checkout source, not proof that the running service/browser bundles contain exactly this version.

## What the harness actually proves

### A request count is not a broadcast count

The interceptor increments its attempts counter **before** retaining/validating the body and before `route.continue()` ([payment harness:127–164](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L127-L164>)). A count of one means the browser request reached interception. It does not establish that the service received it or that a chain sender was invoked. Route errors are caught, mark `networkViolation`, and abort the request ([payment harness:166–171](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L166-L171>)).

The fixed payment validator checks wallet/source, CALL operation, zero native value/refund/gas fields, USDC target, exact recipient/amount, current-owner EIP-712 signature, and absence of step-up token ([payment harness:145–154](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L145-L154>)). None of those conditions is contradicted by the current App/protocol source described below. We cannot identify a particular request-body field as bad from the public artifact.

### The crucial misleading field is the blocker category

`actionResponse` waits for a POST response, parses JSON, records a recognized `transactionHash`, and only then executes `assert.equal(response.ok(), true)` ([payment harness:179–185](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L179-L185>)). Thus a valid payment hash in a normally completed JSON response would enter public evidence **before** the classification or screening checks.

The outer catch maps **every** `ERR_ASSERTION` to `contract_or_configuration_assertion` ([payment harness:329–335](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L329-L335>)). A service 403, 409, 429, 502, or 503 can therefore appear as a “contract/configuration assertion” merely because `response.ok()` is false. That category does not prove a contract defect.

**Inference:** given an assertion category and no recorded payment hash, a non-2xx JSON response failing the HTTP-success assertion is the leading explanation. A post-success classification/screening assertion is less consistent with the missing hash. A request-validator failure is possible but is swallowed by the route wrapper and would normally leave `waitForResponse` to time out, producing the different `bounded_browser_timeout` category. An abnormal success response without the expected hash or deployed-source drift remains possible. The public evidence cannot select a specific cause conclusively.

## Contract checks: likely mismatches versus actual source

**Classification is a string in the service.** The service classifiers return the union `'Protective' | 'Admin' | 'Large' | 'Small'`, and the success response includes that value as `classification` ([service policy:14–48](<../../swissquote-wallet/services/swissquote/src/policy.ts#L14-L48>), [strict classifier:63–89](<../../swissquote-wallet/services/swissquote/src/policy.ts#L63-L89>), [response assembly:193](<../../swissquote-wallet/services/swissquote/src/app.ts#L193>)). A zero-value direct USDC transfer of `1000000` base units is `Small` under both classifiers. The browser classifier instead returns an object with `.class` and `.requiresPasskey` ([browser classifier:9–14](<../../swissquote-wallet/packages/protocol/src/classifier.ts#L9-L14>)). Confusing those contracts would be a harness error, but the existing assertion correctly uses `payment.classification === 'Small'` ([payment harness:291](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L291>)). Do not “fix” it to `.class`.

**The screening-field assertions match source.** The service returns `ok`, ISO `checkedAt`, `sources`, `hits`, `warnings`, and `mock` ([screening:6–28](<../../swissquote-wallet/services/swissquote/src/screening.ts#L6-L28>)). Its exact label construction produces the RedStone and Circle clear prefixes tested by the harness ([live sources:39–52](<../../swissquote-wallet/services/swissquote/src/screening.ts#L39-L52>), [payment assertions:291–297](<../../swissquote-wallet/tests/browser/sepolia-service.mjs#L291-L297>)). Required RedStone evidence older than 30 days, a future/invalid update time, or an unavailable required adapter fails closed; secondary Chainalysis outage/old coverage may warn without blocking. `mock: true` is always returned because MOCK identity/list handling remains present; it does not prove Sepolia adapters are fixture-only. Local fixtures are chosen only for chain `31337`; Sepolia selects live adapters ([configuration:14–35](<../../swissquote-wallet/services/swissquote/src/local-screening.ts#L14-L35>)).

**The App produces the intended request shape.** `paymentTx` makes a direct USDC `transfer` using the current Safe nonce and six-decimal amount ([payment construction:16–25](<../../swissquote-wallet/apps/wallet/src/chain.ts#L16-L25>)). `submitTx` derives the browser classification, obtains step-up only when required, signs with the explicit chain ID, and sends `wallet`, wire transaction, `signature`, optional step-up, source, optional dApp fields and chain ID ([App:217–250](<../../swissquote-wallet/apps/wallet/src/App.tsx#L217-L250>)). The feature adapter defaults its source to `payment` ([App:422](<../../swissquote-wallet/apps/wallet/src/App.tsx#L422>)); both `payment` and `pay` are accepted by the harness. Wire conversion restores numeric fields to bigint ([wire conversion:56–63](<../../swissquote-wallet/packages/protocol/src/api.ts#L56-L63>)); harness and App use the same EIP-712 domain layout ([signing:11–15](<../../swissquote-wallet/packages/protocol/src/signing.ts#L11-L15>)). Source does not show a default-local-chain signature bug in this payment path.

## Real refusal paths consistent with the symptoms

The service can reject before any payment send for invalid/missing session, KYC or wallet linkage; stale nonce/invalid current-owner signature; a prior Safe-nonce reservation; sponsorship policy; screening; global/account fee budget; sender latch; gas cap; simulation/estimation; or send preparation. The relevant sequence is [safe-tx route:161–195](<../../swissquote-wallet/services/swissquote/src/app.ts#L161-L195>) and [serialized relay:64–108](<../../swissquote-wallet/services/swissquote/src/app.ts#L64-L108>).

Explicit strict-screening hits return HTTP 403 with `SANCTIONS_BLOCK`; unavailable/stale required sources return HTTP 403 with `SCREENING_UNAVAILABLE` ([screen enforcement:34–35](<../../swissquote-wallet/services/swissquote/src/app.ts#L34-L35>)). Funding having passed screening does not prove payment screening passed: payment adds token/recipient addresses, the successful-source cache is keyed by the complete address set, and upstream availability can change ([screening cache:54–59](<../../swissquote-wallet/services/swissquote/src/screening.ts#L54-L59>)). This is a plausible refusal, not an observed one.

Other refusals often have **no code**: `requireThat` creates an `ApiError` without one, and the HTTP handler returns only optional `code` alongside its error text ([policy:6–9](<../../swissquote-wallet/services/swissquote/src/policy.ts#L6-L9>), [HTTP handler:285](<../../swissquote-wallet/services/swissquote/src/app.ts#L285>)). Chain preflight is wrapped as 502; send-preparation failures can be proven pre-broadcast, while a send invocation throwing keeps the sender uncertain ([relay:81–104](<../../swissquote-wallet/services/swissquote/src/app.ts#L81-L104>), [chain adapter:97–108](<../../swissquote-wallet/services/swissquote/src/chain.ts#L97-L108>)). The supplied idle relay observation makes an unresolved sender latch less likely at the observation time, but cannot disclose which earlier gate refused.

## Safe instrumentation proposal — no implementation in this task

Add locally defined gate categories around existing checks, without loosening any validation or enabling another action. For public payment-failure diagnostics persist **only** `httpStatus`, `errorCode`, and `gateCategory`:

- `httpStatus`: integer HTTP status from an actually observed response, or `null` if no response was observed. Capture it before JSON parsing or assertions.
- `errorCode`: exact allowlist member `NOT_SPONSORED`, `SANCTIONS_BLOCK`, `SCREENING_UNAVAILABLE`, or `EFFECTS_MISMATCH`; otherwise one fixed sentinel such as `NONE_OR_UNRECOGNIZED`. Never echo an unrecognized value.
- `gateCategory`: a closed, locally defined enum such as `REQUEST_VALIDATION`, `RESPONSE_WAIT`, `RESPONSE_JSON`, `HTTP_NON_SUCCESS`, `RESPONSE_CLASSIFICATION`, `RESPONSE_SCREENING`, `RESPONSE_HASH_BINDING`, `CHAIN_RECEIPT`, `CHAIN_EFFECTS`, `UI_CONFIRMATION`, or `UNKNOWN`. Set categories at known code boundaries; never derive them from error-message text. In the route catch record `REQUEST_VALIDATION`, while retaining its abort and no-resend behavior.

Use a path-specific observer for `/relay/safe-tx` to avoid recording registration/auth responses. Do not persist arbitrary service `error`, `sources`, `warnings`, JSON/raw response, HTTP headers, request body, signature, token, browser exception/stack, credentials, retention contents, or environment. Status alone cannot distinguish an uncoded stale-nonce/auth/budget/preflight gate; the report must keep that uncertainty. If finer uncoded categories are required later, they must be fixed service-authored enums at the throw site, not an error-text classifier.

Offline synthetic fixtures, under a separate authorized implementation task, should verify that a non-2xx JSON response becomes `HTTP_NON_SUCCESS`, an unknown code is replaced by the sentinel, a route assertion becomes `REQUEST_VALIDATION` without continuing, malformed JSON preserves status with `RESPONSE_JSON`, and arbitrary secret-bearing text never enters evidence. Keep existing public transaction-hash capture before successful-response assertions; do not remove or relax receipt/effect acceptance.

## Acceptance and next decision

This read-only diagnostic is complete. **Payment acceptance is still NOT passed:** there is no recorded payment hash/receipt, Safe success/Transfer event, nonce increment, exact wallet/recipient USDC deltas, or confirmed payment UI result. The successful deployment/funding and independent-wallet-check claims remain bounded to the supplied artifact.

The next safe decision is whether to authorize an offline instrumentation change. It is not authorization to re-run the live harness, import retained state, create another wallet, send a payment, screen through a write endpoint, or bypass a refusal. Any later live continuation needs separate authorization and verified settlement/state first.
