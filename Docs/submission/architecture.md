# Architecture: intended authority, not a deployment attestation

[Open the architecture diagram](<architecture.html>). It depicts the intended design with MOCK labels. The concurrent implementation is uncommitted and changing, so the diagram is deliberately not presented as a commit-pinned code snapshot. Source-visible relationships below are pointers for integration review, not execution evidence.

## Main path and authority

The recovery tool handles card words and, when opening a kit, the decrypted owner seed. Copy-paste approval/setup codes connect it to the wallet without sending secret words. The wallet signs a Safe transaction locally; the Swissquote service sponsors its submission. The partner supplies a separate recovery approval, not an owner payment signature. The contract checks the required signer set, nonce and recovery delay; Swissquote paying gas is not bank co-signing.

The wallet/tool read chain state via RPC. The kit restores the **current** owner, who can sign and use an independently funded submitter without the wallet/bank/partner services. This is not offline settlement. Monitor and cancel both recovery modules. A later pending module can otherwise replace the new owner again.

## Source evidence map

| Component / relation | Source-visible evidence | Boundary |
| --- | --- | --- |
| Four processes plus optional local chain | [Supervisor](<../../swissquote-wallet/dev.mjs#L10-L16>) | Separate process names do not prove independent publishers |
| Local contract placement / token fixture | [Devnet](<../../swissquote-wallet/scripts/devnet.ts#L13-L28>) | Pinned runtime on local chain; MOCK mintable token |
| Owner signatures / funded submitter | [Story](<../../swissquote-wallet/scripts/story.ts#L41-L50>) | Script bypasses service passkey enforcement |
| Recovery approvals and delay checks | [Story](<../../swissquote-wallet/scripts/story.ts#L51-L82>) | Source asserts checks; this lane did not execute them |
| RPC-only kit exit | [Sweep](<../../swissquote-wallet/scripts/kit-sweep.ts#L7-L26>) | Needs current owner, matching chain and gas-funded submitter |
| Swissquote runtime adapter / configuration | [Startup](<../../swissquote-wallet/services/swissquote/src/main.ts#L5-L11>) | MOCK opt-in; no adapter without relayer key |
| Partner key isolation and signing | [Partner implementation record](<../../swissquote-wallet/services/partner/IMPLEMENTATION.md#L19-L45>) | Reported lane checks, not this lane's runtime test; MOCK HSM / face |
| Tool portable bundle | [Inliner](<../../swissquote-wallet/apps/recovery-tool/scripts/inline.mjs#L4-L21>) | Intended self-contained HTML; saved-file behavior still needs browser testing |

## Artifact checks

Archify showcase schema/layout validation, generation, and strict artifact check passed. The overall finalize command exited 2 because its browser gate was skipped: `viewer/chrome-unavailable` — “Chrome or Chromium is unavailable. Set ARCHIFY_CHROME to its executable path.” No browser evidence or perceptual visual review is claimed. See [summary receipt](<architecture.finalize-summary.json>) and [browser-check receipt](<architecture.browser-check.json>).

## Real versus MOCK

The signing/encryption/RPC/contract-code machinery is implementation code, not simulated cryptography; its complete runtime behavior remains unverified by this lane. Swissquote account/KYC/mailbox, partner face verification, guardian HSM protection, sanctions/dApp lists, CHF rates and independent tool publisher are MOCK. Local DemoUSDC is MOCK. Sepolia is a configured target, not a completed deployment. Bitcoin/Solana are roadmap scope, not part of this runtime diagram.
