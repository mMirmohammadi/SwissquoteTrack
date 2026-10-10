# Issuer freeze screening: reject the adapter-only exception

**Review decision: the inspected adapter-only change is unsafe and must not be accepted.** It removes a token address even when that same address is the signed transfer recipient or approval spender. Derive freeze subjects from validated transaction calls instead; keep sanctions and mock screening on the complete address set.

This is a source-only proposal, not a certification of the concurrent implementation. No tests, runtime, APIs, RPC, network, keys, or private files were accessed. Only this new review document was written. Stop condition: give the parent a concrete implementation boundary and security regressions; acceptance still requires the implementation owner's tests and parent review.

## Observed evidence

- [screening.ts:49–56](<../../swissquote-wallet/services/swissquote/src/screening.ts#L49-L56>) currently has `const accounts = addresses.filter(address => address.toLowerCase() !== token.toLowerCase());` inside each issuer adapter. The adapter receives addresses without their roles, so it cannot distinguish a token call target from a token recipient. Its comment does not constrain this exception to transfer calls.
- [screening.ts:6–28](<../../swissquote-wallet/services/swissquote/src/screening.ts#L6-L28>) sends one deduplicated list to every source, validates returned hits against that list, and keeps mock positives independently. [types.ts:53–55](<../../swissquote-wallet/services/swissquote/src/types.ts#L53-L55>) already distinguishes `kind: 'freeze'` from sanctions without changing `check(addresses)`.
- [policy.ts:50–62](<../../swissquote-wallet/services/swissquote/src/policy.ts#L50-L62>) exposes `transactionCalls` and `callAddresses`. The former validates the authorized MultiSend wrapper and forbids inner delegatecalls. The latter retains call targets and extracts transfer/approve recipients, but does not validate ABI address padding before extraction.
- [app.ts:117–125](<../../swissquote-wallet/services/swissquote/src/app.ts#L117-L125>) screens direct address queries without transaction context and dApp previews with calls plus the complete dApp address registry. [app.ts:176–193](<../../swissquote-wallet/services/swissquote/src/app.ts#L176-L193>) verifies the current owner's signature before screening and relay, but currently uses the same broad list for all source kinds.
- [dapps.ts:44–90](<../../swissquote-wallet/packages/protocol/src/dapps.ts#L44-L90>) validates canonical zero-value dApp calls. Compound has an actual action target; router swaps must return to the wallet; approvals name the actual action target and end with revoke0. Token identity is not the same as a token owner or spender.

The parent's [routing correction](<../plans/v3/issuer-freeze-owner-routing.md>) supplies the public-chain finding that USDC itself is issuer-listed, while the actual payment recipient is not. This review did not independently query that finding.

## Minimal correct implementation

### 1. Derive subjects by adding roles, never by deleting addresses globally

Add the following proposed function to [policy.ts](<../../swissquote-wallet/services/swissquote/src/policy.ts>) and import the server-owned `DAPP_ADDRESSES` from `@sq/protocol`. The trusted token identities cover the configurable payment token and the protocol's registered USDC/EURC dApp tokens. Do not derive trusted token identities from a request field or merely from a transfer-looking selector.

```ts
export function derivefreezeSubjects(wallet: Address, tx: SafeTx, options: AppOptions = {}): Address[] {
  const subjects = new Set<Address>([address(wallet)]);
  const tokens = new Set([
    options.usdc ?? USDC,
    DAPP_ADDRESSES.usdc,
    DAPP_ADDRESSES.eurc,
  ].map(token => address(token)));

  // The authorized delegatecall wrapper remains a contract subject.
  // transactionCalls below rejects unauthorized wrappers and inner delegatecalls.
  if (tx.operation === 1) subjects.add(address(tx.to));

  for (const call of transactionCalls(tx, options)) {
    const target = address(call.to);
    const data = call.data.toLowerCase();
    const canonicalAccountCall =
      call.operation === 0 &&
      call.value === 0n &&
      (data.slice(0, 10) === '0xa9059cbb' || data.slice(0, 10) === '0x095ea7b3') &&
      data.length === 138 &&
      /^0x[0-9a-f]+$/.test(data) &&
      /^0{24}$/.test(data.slice(10, 34));

    if (canonicalAccountCall) {
      // Add the account even if it equals this call's token address.
      subjects.add(address('0x' + data.slice(34, 74)));
    }
    // Exclude only the target role of a correctly shaped known-token call.
    // Native value, unknown targets, unknown selectors, and malformed data
    // never qualify for that exclusion.
    if (!tokens.has(target) || !canonicalAccountCall) subjects.add(target);
  }
  return [...subjects];
}
```

For `USDC.transfer(TREASURY, amount)`, this returns wallet plus TREASURY. For `USDC.transfer(USDC, amount)`, it returns wallet plus USDC. For `USDC.approve(USDC, 0)`, USDC also remains: a zero amount does not authorize deleting an explicit spender. When USDC is an account in another batch call, adding that account preserves it even if USDC is also a token target elsewhere in the batch. Deduplicate only after adding all roles.

This helper determines screening subjects, not sponsorship permission. Keep existing classification, canonical dApp validation, current-owner signature verification, effectsHash revalidation, gas checks, and nonce reservation. A correctly shaped approval to an unlisted spender must still be refused by policy; adding it as a freeze subject does not make it allowed.

### 2. Route an optional subset only to freeze sources

Extend the existing function boundary to:

```ts
export async function screenAddresses(
  addresses: readonly Address[],
  sources: readonly ScreeningSource[],
  mockHits: readonly Address[],
  now: number,
  freezeSubjects?: readonly Address[],
): Promise<ScreenResult>
```

Normalize and deduplicate the complete input and optional freeze subset. Reject a supplied subject outside the complete input; a programmer mistake must not silently remove coverage. Then, for each source, choose `queried = source.kind === 'freeze' ? (freezeSubjects === undefined ? unique : normalizedFreezeSubjects) : unique`. Call `source.check(queried)` and validate every returned hit against `queried`, not the broader input. Leave mock matching on `unique`. Missing or unclassified `kind` must continue to receive the complete input.

Remove the token-address filter from the live adapter entirely: it must call `isBlacklisted` for every address supplied to it, including its own token address. Keep required-source error handling, stale-list positive hits, and cache expiration unchanged. Cache keys already use the supplied complete address set per adapter, so routed subsets get distinct keys; never cache solely by the old broad sanctions set.

Do not skip required sources merely because a subset is empty. Do not turn provider exceptions, malformed responses, or stale evidence into a clear result. Normal transaction contexts include the wallet, so their freeze subsets are not empty.

### 3. Wire the same context into preview and relay

Extend the private `screen` and `enforceScreen` wrappers in [app.ts](<../../swissquote-wallet/services/swissquote/src/app.ts>) with an optional freeze-subject argument. Only validated transaction-backed routes may supply `derivefreezeSubjects(wallet, tx, options)`.

For both dApp preview and signed relay, leave the complete sanctions/mock input unchanged: `callAddresses(wallet, tx, options)` plus the existing registry addresses where applicable. Pass the derived call-role set separately to freeze sources. Do not union the entire registry into that subset: its token entries would recreate the USDC self-list false positive. Actual Compound/router call targets and approval spenders are already in the derived set. The router's recipient is already the wallet under existing canonical dApp policy; Compound's recipient is the calling wallet.

Direct `/screen`, deployment, withdrawal, recovery, and any preview without validated transaction context must omit the optional argument and therefore check **all** supplied addresses against every source. The request must not be allowed to supply its own `freezeSubjects`. Preserve the narrowly recognized protective owner-cancellation handling; do not use this fix to add another cancellation or admin exception.

## Security regressions required before acceptance

Use source spies and deterministic freeze/sanctions fixtures; do not require live providers. Test the helper and source-routing boundary separately from the relay paths so an earlier policy refusal cannot falsely prove issuer screening works.

### Payments

- Ordinary canonical USDC transfer: USDC itself is an issuer positive, wallet and recipient are clear. Freeze sources receive wallet and recipient, sanctions/mock still receive USDC; screening succeeds only when required sources are available.
- Explicit transfer recipient equals USDC: that issuer positive blocks. Same assertion when recipient uses mixed-case spelling.
- Explicit approval spender equals USDC, including amount zero: helper and routing retain USDC and block. Relay may separately refuse the spender under sponsorship policy; that earlier refusal is not evidence that freeze routing retained it.
- Wallet equals a listed token address, or the token appears as an account in another batch call: it remains a subject. Order of calls does not change the result.
- USDC target with native value, unknown selector, truncated/extended encoding, or nonzero ABI address padding: no token-target exception; policy may reject, but helper must not erase the target.
- Unknown non-token target with a canonical transfer/approve-looking selector: retain both target and decoded account. Selector resemblance alone never makes a contract exempt.
- Sanctions or mock positive on the token target still blocks an otherwise ordinary payment. Required freeze outage/stale evidence still refuses sponsorship.

### dApps

- Canonical approve/action/revoke0 Compound supply: issuer-listed USDC used only as token identity does not poison preview or relay; frozen Compound target or wallet still blocks both.
- Lone Compound withdrawal: actual Compound target and wallet remain freeze subjects; registry USDC is still sanctions/mock screened but not an account solely because it is a registry entry.
- Both supported router swap directions: token call targets do not cause self-list false positives; frozen router spender/target or wallet still blocks preview and signed relay. No exception for revoke0 spender.
- Token sanctions/mock positive still blocks a dApp even when it is not a freeze subject. If a supported action is ever expanded to allow a recipient other than wallet, its validated decoded recipient must be explicitly added before acceptance; current router policy rejects such recipients.
- Direct `/screen` with USDC and no context still detects USDC's issuer positive. An unknown-kind source still receives the broad list. A source returning a hit outside its routed set is unavailable/invalid, not clear.

## Acceptance boundary

Reject the inspected adapter-only snapshot. Accept a later implementation only after confirming the filter is removed, signed-call role derivation reaches both preview and relay, default no-context coverage remains complete, and deterministic regressions above pass. Concurrent edits are visible but were not stabilized or executed by this reviewer; this document is a concrete proposal, not a passing test report.
