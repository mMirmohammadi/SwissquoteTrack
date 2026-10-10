# Swissquote Wallet v3 — judge tour

**Your payment key; your card plus one helper for recovery; an emergency kit for an independent exit.** This is a Safe-based EVM prototype, not MPC, ERC-4337 or a guarded-wallet design. Swissquote has no ordinary owner key. The app publisher remains trusted, and a thief with the unlocked owner key can spend immediately.

**Evidence checkpoint:** the [copied Sepolia story](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) reports 23 successful script-driven records, including 11 mined transactions: wallet creation, 1/6-USDC payments, both-module cancellation, module-A recovery after a real 180-second chain wait, a 3-USDC RPC-only kit sweep and owner rotation at the same address. L10 inspected the full artifact offline, not the chain independently. TREASURY submits ordinary story transactions; FUNDER pays the sweep. Browser/service RELAYER execution and mined DeFi are not confirmed. [Exact claim/receipt map](<claims.md>) preserves those limits and L13's two reported regressions awaiting verified fixes; no full-gate or safety completion is claimed.

## Two-minute tour: claim → evidence

| Claim | Evidence available | What it does not establish |
| --- | --- | --- |
| One owner; assisted recovery requires card plus one helper | [Initializer](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>); [Sepolia C1 checks](<claims.md>) | Script card+helper starts accepted; helpers together without card refused read-only on both modules. Not arbitrary-wallet or live-service assurance |
| Public scripted create → pay → recover → old-key refusal exists | [Exact Sepolia records C2–C3](<claims.md>) | A finalizes after the real 180-second chain wait; GS026 and early-finalize refusals are read-only. No browser/service recovery proof |
| Small payments differ from large/admin payments | [Sepolia payment/rotation records C14](<claims.md>) | Small/Large/Admin classification, not executed WebAuthn or on-chain passkey enforcement; owner can bypass relay |
| Recovery and owner rotation preserve the contract address | [Sepolia deploy/finalize/rotation C2/C14](<claims.md>) | Synchronised recovery across networks |
| Current recovered kit can exit without helper-service calls | [3-USDC Sepolia RPC-only sweep C8](<claims.md>); [sweep implementation](<../../swissquote-wallet/scripts/kit-sweep.ts>) | FUNDER pays gas; no actual service-shutdown drill, saved-file browser proof, all-token support or offline settlement |
| Gasless and DeFi bonuses are being implemented | [Bonus acceptance checklist](<bonus.md>); [claim ledger](<claims.md>) | Completed bonus credit; the core story and service-sent transactions must pass first |
| Legal and commercial decisions are reasoned, not approved | [Legal position](<custody-travel-rule.md>); [business case](<business-case.md>); [draft terms](<terms-sheet.md>) | FINMA approval, bank wallet eligibility, production pricing or profit |

## What is real, simulated and MOCK

| Item | Classification |
| --- | --- |
| Safe/Candide signatures, browser encryption, contract checks | Real implementation; execution coverage depends on the linked run, not the component name |
| Hardhat lifecycle tests | Recorded local execution; chain clock advanced; not public-chain evidence |
| Sepolia script lifecycle/receipt gas | Recorded public: 11 successful transaction hashes; actual gas used, but no effectiveGasPrice/actual fee total. Read-only checks and local kit cryptography are separate |
| Bank account, KYC, partner face check, mailbox, SECO name check, demo sanctions list | MOCK; not a real bank/compliance/identity integration |
| Guardian keys in SQLite | MOCK HSM; separate processes/storage, not hardware key protection |
| Public sanctions-oracle reads, DeFi effects preview, strict sponsorship | v3 targets; only claim measured results after dated source/decision/receipt evidence |
| Bitcoin recovery spending rule | Separate private-regtest research, not integrated wallet recovery |
| Solana, inheritance, production waiting periods | Design/roadmap, not built |

## Documents and running the prototype

Read [threat model](<threat-model.md>), [architecture](<architecture.md>), [bonus status](<bonus.md>), [AI disclosure](<ai-tools.md>) and [paste-ready submission](<SUBMISSION.md>). The existing [run guide](<../../swissquote-wallet/README.md>) is a local/v2-oriented baseline; the integration owner must supply the final v3 launcher/gate instructions. Do not use its live-v2 ports for acceptance tests. v3's intended ports are wallet 5273, tool 5274, services 4101/4102 and local chain 8645.

**Test counts are historical, not current v3 acceptance.** The pre-v3 record reports 228 workspace tests plus 42 contract tests, with the qualifications in the [status evidence index](<../plans/v3/implementation-status.md#L142-L191>). Later pre-v3 runs had skips. No current green full gate is asserted here; require its exact command, counts, zero skips and network. [Current routing](<../plans/v3/lane-routing.md#L29-L36>) reports two L13 regressions under repair (signing-enabled fooled route; uncertain-send queue release), not verified closure.

The existing [security review](<review-security.md>), [browser review](<review-browser.md>) and [integration review](<review-integration.md>) are earlier reports, not v3 sign-off. New execution evidence belongs to L2/L12 and the independent claims audit to L13. [Documentation handoff](<IMPLEMENTATION.md>) lists the remaining evidence gates.
