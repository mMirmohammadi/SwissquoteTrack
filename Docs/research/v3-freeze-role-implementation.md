# Freeze subjects now follow validated call roles

**Implemented the proposed role boundary; the focused offline regressions and service typecheck pass.** This is not a certification or permission to resume live activity. The parent must review the complete concurrent change and run the full test suite before any live action. The previously funded wallet remains at nonce 0; this work neither inspected nor changed it.

## Implementation

[policy.ts](<../../swissquote-wallet/services/swissquote/src/policy.ts>) exports `derivefreezeSubjects(wallet: Address, tx: SafeTx, options: AppOptions = {}): Address[]`. It normalizes and adds the wallet, validates transaction calls, retains the authorized MultiSend wrapper and derives the remaining subjects additively. The only omitted role is a known USDC/EURC token's target in a canonical, zero-native-value CALL to transfer or approve. Canonical means an exact 138-character hex encoding with zero-padded ABI address. Trusted identities are `options.usdc ?? USDC`, protocol USDC and protocol EURC.

Explicit decoded recipients and spenders remain subjects even when they equal a token, including approve amount zero. Native-value calls, malformed encodings, unsupported methods and unknown contracts retain their targets. No address is globally subtracted, so an account role in another call survives either batch order.

[app.ts](<../../swissquote-wallet/services/swissquote/src/app.ts>) passes this separate optional subject list from validated dApp previews and non-protective strict signed relay. The broad sanctions/mock input, including the existing dApp registry, remains unchanged. Direct screening, deployment and funding omit the optional argument and therefore retain complete coverage. Exact protective owner cancellation still screens only the wallet against non-freeze sources; no new bypass or sponsorship permission was added.

The parent owns [screening.ts](<../../swissquote-wallet/services/swissquote/src/screening.ts>) and its integration. The final read observed its fifth parameter, out-of-broad-input rejection and removal of the adapter token filter. This agent did not edit that file.

## Observed verification

Executed from the wallet workspace:

- `node --import tsx --test services/swissquote/test/freeze-subjects.test.ts`: **9 tests passed, 0 failed**.
- `pnpm --filter @sq/swissquote typecheck`: **passed** after the parent's concurrent fixture type correction. The initial attempt found only two missing `mock` fields in parent-owned screening fixtures; the parent was notified and fixed them.

[freeze-subjects.test.ts](<../../swissquote-wallet/services/swissquote/test/freeze-subjects.test.ts>) covers canonical known tokens, configurable USDC, token-as-wallet, token-as-recipient/spender, revoke0, additive cross-call order, wrapper authorization, native value, truncated/extended/nonhex/nonzero-padding ABI, unknown selectors and unknown targets. Compound supply/withdraw and both router directions preserve actual action targets and spenders while excluding token-only target roles.

Source spies independently verify freeze subsets, broad sanctions/mock/unclassified coverage, direct no-context coverage, outside-subset returned-hit rejection, out-of-broad-input subject rejection, required outage and stale evidence. Real App handlers run entirely in memory with deterministic chain stubs and SQLite `:memory:`. Strict payment exercises a successful stubbed relay plus token-recipient, sanctions/mock and outage refusals. Deployment, funding and cancellation exercise their unchanged defaults.

The dApp handler matrix exercises supply, withdrawal and both swap directions through both preview and signed relay, with token-only, target, wallet, sanctions and mock positives. **Token-only issuer positives reach the actual unavailable-simulation guard**, proving the screening step clears; target/wallet/sanctions/mock positives block before it. These tests deliberately do not claim a successful dApp simulation or broadcast: simulation clients are absent, so the existing fail-closed policy refuses.

## Acceptance limits and next action

Only [app.ts](<../../swissquote-wallet/services/swissquote/src/app.ts>), [policy.ts](<../../swissquote-wallet/services/swissquote/src/policy.ts>), the new [freeze-subjects.test.ts](<../../swissquote-wallet/services/swissquote/test/freeze-subjects.test.ts>) and this report were modified by this agent. No API/RPC/network/live call, private file, environment inspection, Git operation or listening service was used. The real handler tests create a server object but never listen; there is no service startup.

The [security review](<v3-issuer-freeze-security-review.md>) is an implementation proposal, not certification. Parent acceptance must still confirm all concurrent adapter/source-routing changes, run the full suites, and independently review the integrated diff before live activity. Successful live dApp simulation/broadcast and public-chain findings remain outside this offline task.
