# Swissquote Wallet — V4

**A self-custody wallet with sponsored payments and card-required recovery.** This branch publishes the V4 application source, its latest interface changes, evidence and judge materials as normal repository files.

**Team:** Mehrshad Mirmohammadi and Erfan Mousavian.

## Start here

- [Technical presentation](<Docs/pitch/technical/README.md>) · [Slides PDF](<Docs/pitch/technical/pitch.pdf>) · [Speaker notes](<Docs/pitch/technical/speaker-notes.pdf>)
- [Complete written submission](<Docs/submission-ready/manual/SUBMISSION.md>) · [Exact submitted ZIP](<Docs/submission-ready/Swissquote-Wallet-Team-Submission.zip>)
- [Feature walkthrough](<Docs/plans/v4/feature-walkthrough.md>) · [Simplified user journeys](<Docs/plans/v4/ux-journeys.md>)
- [Clause-by-clause implementation audit](<Docs/reviews/wallet-build-plan-audit.md>) · [Offline searchable audit](<Docs/reviews/wallet-build-plan-audit.html>)

The ZIP is the preserved submission artifact. This branch makes the current source and supporting documents directly browsable; publishing it does not change the artifact or backdate the Git commit. Older plan and handoff documents retain their historical status statements and deadlines. This README records the current publication status.

## What V4 adds

The wallet has a compact setup form, balance-first overview, payment review, recovery countdown/cancellation, a separate Recovery Desk, and explicit network-fee sponsorship copy. A manually confirmed independent check is remembered for the same wallet, owner, network and setup; it is not silently treated as a new verification after those change.

A one-owner Safe executes the user's signed payments. Each recovery route requires the Recovery Card plus its own helper: partner recovery waits three minutes in this demo; Swissquote recovery waits three days. The old owner can cancel. Helpers alone do not satisfy either configured recovery rule. An unlocked owner key can spend, and the application publisher remains a trust dependency.

## Verification status

For the source published here, wallet TypeScript checking passes and the focused wallet/feature regression run reports **54 passed, zero failed and one service-dependent test skipped**. This publication does not start another chain, run new public transactions, or replace the running demo.

The earlier **609-test full gate passed before the later UX changes**. A subsequent full run failed during recovery waiting. The full gate has not since been demonstrated green for the final interface. Do not read the older aggregate as current full-suite acceptance. [Historical acceptance](<Docs/plans/v4/acceptance.md>) and the [audit](<Docs/reviews/wallet-build-plan-audit.md>) explain the distinction.

## Public Sepolia evidence — separate runs, test funds only

- [Sponsored 1-USDC payment](https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e): browser and services, with the relayer paying gas.
- [Third-party Compound III test supply](https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af): one test-supply transaction, not a withdrawal, swap or official-market claim.
- [Public-browser recovery record](<swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json>): creation, recovery and replacement-owner payment across retained sessions, not one uninterrupted recording.

[Evidence ledger](<Docs/submission/claims.md>) · [Architecture](<Docs/submission/architecture.md>) · [Threat model](<Docs/submission/threat-model.md>).

Bank balances and funding provenance, KYC, face/video checks, mailbox and helper-key vaults are MOCK. Public receipts and configured on-chain reads are real testnet activity. There is no production security audit, regulatory approval or bank integration claim. No full-demo video is packaged.

## Run locally

Use Node 26 and pnpm 12.6.0. From the repository root:

    cd swissquote-wallet
    pnpm install
    npm --prefix contracts install
    pnpm demo:local

The launcher creates a fresh local chain and refuses occupied owned ports. Defaults are wallet `http://localhost:5273`, Recovery Desk `http://localhost:5274`, services 4101/4102 and RPC 8645. Do not run this over an existing demo. A clean-machine installation has not been freshly rehearsed for this publication. [Detailed run instructions](<swissquote-wallet/README.md>).

Live-chain credentials, local databases, browser sessions and recovery secrets are deliberately excluded from Git. See the [legal analysis](<Docs/submission/custody-travel-rule.md>), [hypothetical business case](<Docs/submission/business-case.md>) and [AI disclosure](<Docs/submission/ai-tools.md>) for their qualifications.
