# v3 plan documents

**Status: plan — awaiting the user's go-ahead.** Only the first Sepolia preparation is built (part of P0.1, and the story script of P0.2). It passes the offline tests but has sent nothing. All evidence so far comes from a local test chain on one computer; no transaction has been sent to a public blockchain.

v3 is the overnight plan to take the working v2 demo onto Sepolia (Ethereum's public test network), add recovery in the browser and the brief's compliant-dApp bonus, and prepare the judge pack. The deadline is Sunday 11 Oct 2026, 10:00 CEST.

## Files

- **[build-plan.md](build-plan.md): start here.** It holds the result we aim for, the features ranked by expected points per hour and by risk, and the architecture and security changes. It also covers how parallel lanes build v3 without touching the live demo, the schedule with gates and cut lines, the Sepolia runbook, and the decisions needed from you ([§9](build-plan.md#9-decisions-needed-from-you)).
- **[implementation-status.md](implementation-status.md):** what is built today and how it was verified, checked against the brief, the user's original wants and the v2 plan. It also lists known defects and indexes the evidence with its commands. It is a snapshot from before the v3 build started; [its §8](implementation-status.md#8-changes-in-the-working-tree-since-the-snapshot) lists the files changed since.
- **[critique-log.md](critique-log.md):** the 85 findings from five reviewers (security, feasibility, judge fit, legal and business, status honesty) and what was done with each: 70 accepted, 15 accepted with a different fix, 0 rejected.
- **README.md:** this index.

The lead owns these files. If the plan is approved, the independent verification lane will add its reports in a `verification/` folder here.

## Evidence boundary: local chain only so far

- **Verified on the local chain** (Hardhat, a test blockchain running on this computer, chain id 31337):
  - The recorded test run passed 228 workspace tests and 42 contract tests, with no failures ([swarm-final-verification.md](../swarm-final-verification.md)).
  - One script runs the whole story, including a recovery ([swarm-acceptance.md](../swarm-acceptance.md), line 10). It skips the waiting time by moving the chain clock, and it signs the helpers' approvals with test keys instead of going through the Swissquote and partner services.
- **Verified by the user** in the browser with a real passkey (lead's report; no log file): every step from wallet creation through a 6 USDC payment, which needed a passkey confirmation.
- **Not verified anywhere yet:**
  - any transaction on Sepolia;
  - recovery through the services or in the browser;
  - a completed recovery through Swissquote's 3-day recovery module;
  - the DeFi feature, which is not built.
- **Read-only checks on Sepolia:**
  - The 8 contracts the wallet relies on exist there with the expected code (the lead's check; not repeated for this index).
  - The four service addresses held no funds at 20:50 CEST, so the first step is the faucet request (D0 in the plan).
- **Sepolia edits tested offline only:** the edits made since the status snapshot pass the offline test suites, but none has sent a transaction ([implementation-status.md §8](implementation-status.md#8-changes-in-the-working-tree-since-the-snapshot), lead update).

Labels used in these files: **Verified** (checked, and the file says how), **Sourced** (a cited document says so), **Assumption** (our judgement, not checked).

## Inputs (not in Git)

The five critiques and the research notes behind these files are in `AgentsLocal/46257332/v3/critique/` and `AgentsLocal/46257332/v3/explore/`. `AgentsLocal/` is ignored by Git, so they exist only on the build machine. The v2 plan is [swissquote-wallet-build-plan.md](../swissquote-wallet-build-plan.md).
