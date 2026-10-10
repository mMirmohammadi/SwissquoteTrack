# Threat model — who can spend, recover or lock you out

**The card protects assisted recovery, not ordinary spending. A thief with the unlocked owner key or 24 words can drain the wallet and cancel your recovery.** Swissquote's keys are not ordinary owners under the [initial configuration](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>), but a malicious app it publishes could copy your unlocked key. This is not a production-audited system.

## Decision and powers

A one-owner Safe preserves independent spending. Two separate Candide modules require card + partner (module A) or card + Swissquote (module B). This is not a symmetric two-of-three seed split: the two helpers without the card do not meet either module's guardian rule. Recovery changes the owner at the same address; it does not reconstruct the old seed. The benefits are assisted recovery and an independent kit exit; the costs are EVM dependency, more backup items and trust in software, monitoring and helper checks.

| Actor/material | Spend now | Replace owner / deny access |
| --- | --- | --- |
| Current owner key; current kit plus kit code | Yes, with a gas-funded submitter | Can change rules/owners and cancel any recovery; compromise is immediate full control |
| Swissquote alone / relayer | No owner signature | Can refuse sponsorship or its helper service; publishes trusted app code |
| Partner alone | No | Can refuse its helper service |
| Swissquote + partner, no card | No under expected configuration | Cannot meet either module's recovery threshold; can deny both assisted routes |
| Card + partner | Not directly | After 180 s in this demo, can acquire owner control unless cancelled; production delay is undecided |
| Card + Swissquote | Not directly | After 259,200 s (three days), can acquire owner control unless cancelled |
| Phone + email without unlocked owner key | Not by those possessions alone | Needs card plus an accepted helper; password-reset/face checks are MOCK |

Those powers assume the expected owners, thresholds, guardian lists, modules, guard, fallback handler and code. The owner can change them. An unknown module means “unknown authority”, not “safe”. [Claim ledger C1–C4](<claims.md>) separates configuration from executed refusal/recovery tests.

## Recovery and availability

Monitor and cancel **both** modules. A pending second module can otherwise replace the recovered owner later. Finalization is permissionless once its contract delay has elapsed. Card + a fooled or compromised helper can take control if the owner does not learn of the request and get a cancel mined in time.

Protective sponsorship is best-efforts, not “always”: the planned exemption avoids ordinary screening-outage and spending-budget refusal, but a positive wallet sanctions hit, dedicated fee/rate cap, insufficient funds, outage or chain congestion can still prevent relay. A second submitter path needs its own tested availability. The owner/current kit can use an independently funded sender; no helper is needed for an owner-signed cancel.

If the device and kit are lost, the card and one cooperating helper are required. Lose all owner access and the card, and helpers cannot recover. With services permanently gone, the current kit, its separate code, trustworthy tool, matching chain, working RPC and gas-funded submitter are still needed. This is not offline settlement. The [recorded Sepolia exit](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L270-L284>) moved 3 USDC using the recovered kit with `services: none (RPC only)` and FUNDER-paid gas; balance became 0. It proves the script does not call helper services, not an actual service-shutdown drill or browser saved-file/all-token exit.

## Residual threats after the planned v3 controls

| Threat | Intended mitigation / remaining exposure |
| --- | --- |
| Unlocked device/seed theft | No on-chain spend guard; thief can bypass passkeys and win a cancel race. Guarded-wallet prototype was rejected |
| Malicious wallet/tool publisher | Saved independent tool and fingerprint help identify a file, not prove its safety; no native app, hardware owner or audited build pipeline |
| Stolen card + fooled helper | Full delayed takeover by design; MOCK face check is not biometric assurance; alarms/cancels matter only if noticed and mined |
| Bypass of sanctions/passkey policy | Rules decide what Swissquote pays for. Owner can self-fund or sign an off-chain token permit outside the app; not blanket sanctions prevention |
| Different network at same address | Recovery is per network; old key can still control an undeployed/unrecovered instance elsewhere |
| Guardian/database compromise | Helper private keys are unencrypted SQLite records: MOCK HSM, not production key custody; separate processes do not establish independent governance |
| Client privacy | One relayer links wallets publicly; RPC providers see addresses; guardian events reveal metadata. Removing `userRef` does not create anonymity |
| Third-party DeFi / proxy upgrade | Pin target code and proxy implementation/admin; reject mismatch. Compound Sepolia official provenance remains unconfirmed; contract, issuer-freeze, shallow-liquidity and loss risks remain |
| Screening errors/stale lists/outage | Planned per-source freshness and fail-closed spend policy; vendor coverage is not comprehensive legal clearance; MOCK SECO names are not address screening |
| Malicious/stale simulation or RPC state | Re-simulate before sending, compare fixed-block reads where applicable; nodes can still lie or lag, and state can change before mining |
| Leftover token allowances | Planned exact allowance and same-batch reset plus readback; completed evidence still required |
| Contract/dependency flaw or unsafe admin change | Safe 1.4.1 and Candide v0.0.1 reused; audit listing is not an independent audit of our setup or a matched deployed-bytecode attestation |
| Replacement kit not saved | Old kit ceases to own wallet after rotation; new-kit enforcement and saved-file behavior require browser proof |

## Acceptance boundary

The [Sepolia record map](<claims.md>) establishes card+helper starts on both modules, helpers-together/no-card read-only refusals, real 180-second A maturity and mined finalize, early-finalize/old-key GS026 read-only refusals, mined both-module cancellation and a 3-USDC RPC-only recovered-kit exit. Separate helper-only/throwaway checks, actual service-shutdown and saved-file browser exit, service/browser exact-hash passkey and availability tests remain required. [L13 routing](<../plans/v3/lane-routing.md#L29-L36>) reports two regressions under repair: signing-enabled fooled approval and uncertain-send queue unlock. No safety closure or full-gate pass is inferred. The full three-day module-B public completion is not confirmed; a local clock-advanced test or pending countdown is not that result. See [claims](<claims.md>) and [legal position](<custody-travel-rule.md>). No test suite constitutes an audit or guarantees freedom from loss.
