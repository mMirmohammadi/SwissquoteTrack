# Swissquote Wallet — client-controlled payments, card-required recovery

## Project and evidence status

We built a Safe-based EVM wallet prototype designed to keep a Swissquote relationship without giving Swissquote the client's payment key. The [recorded Sepolia script story](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) reports success on chain 11155111: 23 records including 11 mined transactions. It creates wallet `0xad9c2831beeF85Df126BE1f80a443d26e2122dA9`, funds 10 USDC, pays 1 and 6 USDC, cancels both recovery modules, finalizes module A after its real 180-second chain-time wait, sweeps the remaining 3 USDC using the recovered kit with RPC only, and rotates the owner at that same address.

L10 read the entire copied artifact offline; it did not independently re-query the chain. TREASURY submits ordinary transactions and FUNDER pays the sweep, not the Swissquote service RELAYER. Old-key GS026, no-card and early-finalize refusals are read-only checks, not mined attacker transactions. The 6-USDC `requiresPasskey:true` field is classification, not an executed WebAuthn ceremony. Browser/service recovery and mined DeFi remain unconfirmed. The [exact claim/receipt ledger](<claims.md>) and [judge tour](<README.md>) retain those gaps. [Independent L13 follow-up](<../../AgentsLocal/46257332/v3/results/L13.md#L7-L27>) passed 27 tests with 0 failures and 0 skips twice, superseding the historical pre-fix 19 pass / 2 fail of 21. The signing-enabled fooled bypass and uncertain-send queue release no longer reproduce in actual handlers with an injected chain and real SQLite close/reopen, not live relayer/browser tests. No-hash uncertainty remains fail-closed until manual chain investigation; no full-gate or safety completion is asserted.

## Custody model and threat model

The wallet has one owner key. Two separate recovery modules require **card + partner** or **card + Swissquote**, not any two of three. Neither helper alone nor both together without the card meet the intended contract rule. Recovery replaces the owner at the same wallet address. [Configuration evidence](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>).

Trade-off: the owner can spend independently and use an exit kit, but an attacker with the unlocked key/24 words can spend immediately or cancel legitimate recovery. Swissquote publishes the app, so a malicious version could expose the key. Card + a fooled helper can seize control after the wait unless the owner cancels. Loss of all owner/kit access and the card can permanently lock out the client. Full [threat model](<threat-model.md>).

## Architecture, creation, authentication and recovery

The browser creates and encrypts the owner key locally. The recovery tool handles card words/kit opening, handing off only public codes/signatures. Swissquote and the independent partner run as separate helper processes with their own storage; neither is an ordinary Safe owner. The client links a wallet to a MOCK bank identity through a purpose-limited EIP-1271 control proof. The service design uses a passkey for login and large/admin sponsored transactions; it is not the on-chain owner. The public script bypasses service authentication; its Large/Admin labels do not prove an executed passkey step-up. [Architecture and MOCK map](<architecture.md>).

Module A waits 180 seconds in this demo; module B waits three days. Production delays are undecided. A new device generates a replacement key, the card and chosen helper approve, the contract waits, and the old owner may cancel both modules. Full public three-day module-B completion is not confirmed; a pending countdown or clock-advanced local test must not be described as completion. The recovered kit swept 3 USDC on Sepolia with RPC only and FUNDER-paid gas; no helper services were called. An actual service-shutdown drill, browser saved-file proof and broader asset exit remain pending. [Recovery/exit evidence gates](<claims.md>).

## Custody and Travel Rule position

Our reasoned position is that Swissquote acts as a regulated recovery helper and fee sponsor rather than holding an ordinary spending key. Conditional card+Swissquote owner replacement and app publication still require counsel/FINMA assessment; no “FINMA-compliant” or production non-custody determination is claimed.

Proposed own-wallet bank withdrawals require an authenticated wallet-control proof. A signature does not by itself establish beneficial ownership or legal bank acceptance. FINMA 02/2019 informs the design; this prototype is not a production Travel Rule integration. For client-signed third-party wallet payments, whether Swissquote's sponsored relay is a sending institution remains open. Client-initiated DeFi is proposed execution-only; FinSA applicability needs counsel. Screening is a fee rule, not blanket prevention of owner self-funded transfers. [Legal sources and limits](<custody-travel-rule.md>); [draft best-efforts terms](<terms-sheet.md>). Inheritance is not built.

## Business value

The product tests paid recovery/support and retention among clients who want self-custody. Using the plan's sourced 690,828 **trading accounts, not unique clients**, assumed 1% paid adoption at an unapproved CHF 4.90/month yields roughly **CHF 406,207 gross/year before all costs**. This is a subscription scenario, not net revenue, profit or measured demand. Gas, support, partner checks, compliance, audits, operations and possible withdrawal-fee waivers must be deducted. [Sources, adoption range and gas-stress arithmetic](<business-case.md>).

## Bonus topics tackled

**Gasless:** owner-signed Safe transactions submitted by a funded Swissquote relayer, with simulation, limits and exact-hash passkey step-up. Public proof must show RELAYER as outer sender and wallet ETH zero before/after; treasury-scripted setup is not that proof.

**Compliant dApp interaction:** targeted Uniswap swaps and third-party Compound III test-market supply/withdrawal, Swissquote-generated preview, source-labelled screening, pinned targets/proxy logic and exact approvals reset to zero. “Allow-listed” means fee sponsorship after technical checks, not investment advice. Without matching execution receipts these are “not executed”, not live DeFi. Bonus completion is not claimed until the core story and relevant receipts pass. [Bonus acceptance and risk wording](<bonus.md>).

## AI tools

DSH with the configured gpt-6.1-sol model assisted this v3 documentation lane with repository inspection, drafting and claim/link/arithmetic checks. Earlier recorded research/Archify use supplied reused source notes and architecture artifacts, not security/runtime attestations. Other contributors' confirmed disclosures remain an integration requirement; no invented full roster is given. [AI disclosure](<ai-tools.md>).

## Submission attachments and remaining evidence

Existing linked docs and the [seven-slide storyboard](<../pitch/storyboard.md>) are ready for review; the storyboard is a pitch artifact, not a rendered deck or recording. V3 recovery-kit persistence, strict DeFi, trust/tool checks and partner privacy exist, but aggregate acceptance is not passed. The scripted public story and passing L13 offline follow-up are recorded; the new browser recovery test is underway. Browser/service RELAYER receipts, live DeFi/fork execution, final zero-skip isolated gate/claims audit, independent-tool hash/file checks, current screenshots/video and full team tool disclosures remain unconfirmed. Human video/publication decisions remain open. Keep those limits if they remain unresolved at submission. Keep local links for review; replace them with public repository permalinks only after approved publication, before pasting externally; attachment/video publication and submission are human-authorised actions, not performed by this lane.
