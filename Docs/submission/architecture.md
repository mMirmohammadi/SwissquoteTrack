# Architecture v3 — unchanged custody core, stricter sponsorship

**Owner signatures authorize spending; the relay only submits/pays; the card plus one helper authorizes delayed owner replacement.** The [existing interactive diagram](<architecture.html>) is a v2-era custody/design view, not a current v3 deployment attestation. Its sidecar receipts attest only to artifact checks; the old browser check was skipped. Until updated and checked, use the v3 component map below for sponsorship/screening boundaries.

## Component and data-flow map

| Component | Talks to / purpose | Real versus MOCK / evidence |
| --- | --- | --- |
| Wallet browser | Swissquote login/ownership proof/sponsor requests; partner recovery checks; RPC contract state | Owner key generated/encrypted locally; passkey authorizes service step-up, not on-chain co-ownership. [Historical evidence](<../plans/v3/implementation-status.md#L49-L54>) |
| Independent recovery tool | Copy-paste public request/setup codes; card approval; kit opening; optional RPC check | Real signing/encryption implementation; trusted independent distribution, reproducibility and saved-file operation require [C9 evidence](<claims.md>). Never send secret words via link/API |
| Swissquote service | Client session/proof, fee sponsorship, screening/simulation; module-B guardian approval | Bank balance/KYC/mailbox/SECO client check and HSM are MOCK. It must never possess the owner seed, card words or kit code |
| Separate partner process/storage | Partner face verification and module-A guardian approval | MOCK face/HSM; helper private key stays at service. `userRef` removal is pending [C10 proof](<claims.md>), not anonymity |
| Screening sources and dApp registry | Swissquote checks addresses, code/proxy pins and freshness; returns reasons/preview | Planned real on-chain/vendor reads plus labelled MOCK list/SECO; execution/coverage requires [C6–C7 evidence](<claims.md>) |
| Public RPC providers | State/history, simulation, broadcast/receipts | Reads/simulations are not mined results; providers see client addresses, can lag/lie and are not bank-internal infrastructure |
| Safe 1.4.1 | Checks owner's Safe signature, executes approved calls, exposes EIP-1271 proof | Established contract dependency; initial threshold 1. [Initializer](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>) |
| Candide v0.0.1 module A | Card + partner; 180 s demo delay | Existing module instance; [constants](<../../swissquote-wallet/packages/protocol/src/constants.ts#L18-L19>) |
| Candide v0.0.1 module B | Card + Swissquote; 259,200 s delay | Existing module instance; full three-day public completion unconfirmed |
| Token/DeFi contracts | Wallet transfers, swap or supply/withdraw batch | Local DemoUSDC is MOCK; Sepolia uses test tokens. Third-party Compound market provenance unresolved; not production money |

The wallet obtains a server challenge for authentication/ownership proof, signs locally and sends only the signature/public context. For a sponsored spend the user signs the Safe transaction; Swissquote checks policy, simulation and step-up, then its relayer pays for submission. These checks control **fee eligibility**, not owner authority: an independently funded sender can submit a valid owner signature outside the service.

The intended browser recovery creates a replacement key on the new device; the trusted tool signs the full new-owner address with the card, and the chosen helper signs after its check. The [recorded Sepolia script](<claims.md>) instead generates/signs its own guardian keys and bypasses those services/browser steps. It proves card+helper starts on A and B, mined cancellation of both, and A finalization after the real 180-second delay at the same wallet. Helpers-together/no-card, early finalize and old-key GS026 are read-only checks. B was cancelled, not completed. The recovered kit swept 3 USDC with RPC only and FUNDER-paid gas, then an owner rotation mined and a replacement kit was created. This proves no helper-service dependency for that scripted USDC exit, not an actual service-shutdown drill, saved-file browser operation, all-token support or offline settlement.

The record does not attest that the planned strict-sponsorship or browser controls work. [Current L13 routing](<../plans/v3/lane-routing.md#L29-L36>) reports signing-enabled fooled and uncertain-send queue regressions being fixed; full-gate and safety completion are not asserted.

## What changed in v3

Custody contracts/template remain unchanged; no guarded-wallet prototype, new custody Solidity, MPC or passkey-owner migration is in scope. Off-chain targets are strict fee sponsorship, effects preview/recheck, source-labelled screening, protective-cancel exemption, recovery UI/alerts, trust checks, partner privacy and tool fingerprinting. [Build plan](<../plans/v3/build-plan.md#L456-L502>) is intent; [claims](<claims.md>) is actual evidence status.

An audit of Safe/Candide dependencies does not audit our composition. Safe's [Candide repository](https://github.com/5afe/CandideWalletContracts) lists an Ackee audit of v0.0.1; deployed bytecode has not been matched to that audited commit here. Bitcoin regtest research and Solana design are outside this runtime. Recovery on another EVM network is separate even if CREATE2 reproduces an address.
