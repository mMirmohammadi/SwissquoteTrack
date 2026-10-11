# Swissquote Wallet prototype

**A client key signs payments; a Recovery Card plus one helper authorizes delayed replacement.** Swissquote holds no ordinary owner key. Both helpers without card cannot satisfy either intended recovery module. This is test software, not a production bank integration or security guarantee.

The frozen-v3 evidence includes a browser/service zero-ETH payment and one third-party Compound III test supply on Sepolia. Public recovery/kit sweep are **SCRIPTED**; complete browser recovery passed locally. The last recorded full gate passed **591 tests, zero skips**, typechecks/builds; no new gate for proposed v4 UI is asserted. [Root overview](<../README.md>); [exact ledger](<../Docs/submission/claims.md>).

## Run locally — source-checked, not rehearsed from a clean clone here

Prerequisites: Node 26, pnpm 12.6.0 from [package.json](<package.json>) and contract dependencies. From the repository root:

    cd swissquote-wallet
    pnpm install
    npm --prefix contracts install
    pnpm demo:local

[local-demo.mjs](<local-demo.mjs>) calls the [isolated launcher](<scripts/v3-local.mjs>), which owns a fresh local chain, compiles/initializes fixtures, prepares MOCK liquidity and starts both apps/services. **Do not start a separate chain or call devnet first.** The launcher refuses occupied ports and local dotenv files and does not load credentials or attach to/reset an existing demo. Stop with Ctrl-C. Do not use real keys or run public write commands as part of this local demo.

Defaults: wallet <http://localhost:5273>, separate Recovery Desk <http://localhost:5274>, Swissquote service loopback 4101, partner 4102, local RPC 8645. Use localhost consistently for WebAuthn. localhost/127.0.0.1 RPC aliases are the **same node**, not independent operators. DemoUSDC is a local fixture. The CLI `story` is a separate scripted contract path with locally advanced time, not a browser rehearsal; never mutate someone else's chain.

## Validation commands are not a full-gate receipt

    pnpm typecheck
    pnpm build
    pnpm test
    pnpm test:contracts

These commands were inspected, not run by this docs lane. The isolated acceptance command and browser/network scope are [recorded separately](<../Docs/plans/v3/compound-acceptance.md>); the unit/contract subset alone is not the full 591-test gate.

## Authority, exit and MOCKs

Safe threshold is one. Module A requires card+partner, 180-second demo wait; module B requires card+Swissquote, three-day wait. Both pending modules must be checked/cancelled. Production waits remain undecided; full public B completion is unconfirmed.

Email/password or optional passkey opens login, not the encrypted owner key. Large/admin sponsorship requires exact-hash passkey; owner-funded transactions bypass those fee rules. Unlocked-key theft, compromised publisher, card+fooled-helper takeover and cancellation races remain. [Threat model](<../Docs/submission/threat-model.md>).

The Desk opens/exports/checks the current kit key; a separate funded submitter and working chain/RPC are needed to move funds. The recorded 3-USDC exit used a script and FUNDER-paid gas, not a Desk broadcast or live shutdown drill. Refresh the kit after owner replacement.

Live public sanctions-oracle/USDC blacklist reads are real. MOCK: bank account/funding provenance, KYC, face/video, mailbox, demo sanctions entries, helper-key protection in SQLite and fixed CHF conversion. Independent publisher governance and production HSMs are not implemented. Public test funding may be mined despite its simulated bank origin.

[Submission guide](<../Docs/submission/README.md>) · [Architecture](<../Docs/submission/architecture.md>) · [Legal position](<../Docs/submission/custody-travel-rule.md>) · [AI disclosure](<../Docs/submission/ai-tools.md>). Human video, screenshots, disclosures and publication remain pending.
