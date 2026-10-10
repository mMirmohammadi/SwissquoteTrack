# Issuer freeze checks: exclude only the issuer token's own address

**Historical proposal, rejected by parent review.** This task initially changed the adapter to omit the issuer's own address. Parent reverted that subtraction because an explicit recipient or spender equal to the token must remain frozen. Current integration instead derives account roles from signed calls and routes only those subjects to issuer checks; sanctions and MOCK checks retain the complete address set. The initial task's measurements below describe the rejected snapshot, not current live acceptance.

## Diagnosis and evidence boundary

The parent supplied the live diagnosis: the wallet `0xa1fFBa9b87CD2253108fC67252E4fc2985088CFa` was deployed and funded with 1 USDC, but payment stopped at `SANCTIONS_BLOCK`; Safe nonce remained zero and no payment was broadcast. For wallet, USDC, and TREASURY, RedStone and Chainalysis returned no hits, EURC returned no freeze hits, and USDC returned a hit for the USDC token itself. The parent's durable observation is recorded in [the live finding](<../plans/v3/issuer-freeze-finding.md#L3-L5>).

These are parent-reported live observations, not independently repeated reads by this implementation task. No additional network research, live RPC checks, service restarts, or browser runs were performed. No previously retrieved public issuer source output was provided to this task at report creation, so the self-deposit explanation below is a contextual rationale, not a newly verified issuer-source claim.

The source previously queried every address against every token's freeze list. A token contract appears in that address set because a payment invokes its `transfer` function. The contract called to execute a transfer is not necessarily the account receiving the tokens. Treating the token's own blacklist entry as a counterparty finding therefore blocks unrelated transfers. An issuer self-address blacklist can serve as a safeguard against depositing tokens into their own contract; it does not by itself identify a suspicious third-party recipient.

## Implementation boundary

The only production change is inside [the live freeze adapter](<../../swissquote-wallet/services/swissquote/src/screening.ts#L49-L57>):

`const accounts = addresses.filter(address => address.toLowerCase() !== token.toLowerCase());`

The adapter queries those accounts and returns only positive accounts from that same original subset. Case-insensitive equality is the complete exception: there is no generic contract exclusion and no filtering of returned positive hits. [Common screening](<../../swissquote-wallet/services/swissquote/src/screening.ts#L6-L28>), [sanctions requests](<../../swissquote-wallet/services/swissquote/src/screening.ts#L39-L48>), endpoint failover, required-source handling, stale evidence rejection, and the existing success cache are unchanged.

The exclusion is token-bound, not an allowlist. For example, USDC is omitted from USDC's account freeze checks but still queried in EURC's freeze checks and in both sanctions oracles. Any positive wallet, recipient, router, Compound, or other-asset result still makes screening fail.

## Offline acceptance evidence

[The new adapter tests](<../../swissquote-wallet/services/swissquote/test/screening.test.ts>) mock `fetch`, decode the actual adapter-generated JSON-RPC `eth_call` payloads, and return ABI-encoded responses. They do not replace `ScreeningSource.check` with a fake implementation.

All 14 new tests passed. They verify exact per-issuer account sets, unchanged complete RedStone/Chainalysis subject sets, mixed-case self-token exclusion, preservation of supplied hit addresses, positive wallet/recipient/router/Compound/other-asset blocking, a cross-issuer positive on USDC, sanctions positives on USDC, required RedStone/USDC/EURC outages, and stale required sanctions evidence while retaining a real account positive.

Commands run from the wallet workspace or its Swissquote service package:

- `node --import tsx --test test/screening.test.ts`: 14 passed, zero failed.
- `pnpm --filter @sq/swissquote typecheck`: exit 0; includes production source and package tests.
- `pnpm test`: exit 0; 383 passed, zero failed, seven skipped across package and adversarial suites. The Swissquote service passed all 53 tests.

The seven full-suite skips were five browser tests because Chromium was unavailable, one local wallet end-to-end test, and one real-chain integration test because `INTEGRATION_RPC_URL` was absent. This is offline regression evidence, not live payment or Compound acceptance. The contracts test command is separate from `pnpm test` and was not run because no contract code changed and chain operations were outside this task's scope.

## Limits and parent acceptance decision

The current `screenAddresses(addresses, sources, mockHits, now)` interface carries addresses, not their transaction roles. It cannot distinguish the same token address included as a call target from that address explicitly used as a transfer recipient. The requested same-token adapter exclusion therefore also omits that address when supplied as an actual recipient. Both sanctions and the other issuer's freeze list still check it, but the same issuer's self-blacklist alone no longer blocks that special case.

This limitation is not a claim that self-deposits are safe or valid. A separate role-aware transaction guard or verified simulation rejection is needed if the parent requires proof that `recipient == token` still refuses before broadcast; neither was implemented because App/policy/simulation ownership was excluded. The parent should resolve this boundary before declaring live acceptance, as [the live finding](<../plans/v3/issuer-freeze-finding.md#L5>) already requests.

No sanctions bypass, end-user freeze-hit bypass, configuration change, new deployment, or live retry was performed. Parent-owned live job 1243 was not touched. Actual payment broadcast, receipt success, and Compound behavior remain unverified by this task.
