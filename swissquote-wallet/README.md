# Swissquote Wallet prototype

A local-first Safe wallet demo: the client signs payments; replacing the owner needs the recovery card plus either the partner or Swissquote. Both helpers together are insufficient under the intended, independently checked wallet rules. This is a prototype, not a bank integration or a production security guarantee.

**Evidence boundary:** final builds and all workspace/adversarial tests pass with local integrations and browser enabled. Actual browser flow passes passkey registration, wallet creation, independent checks, offline kit opening, funding and small/large hash-bound-passkey payments. Complete browser recovery/rotation and live Sepolia remain unverified; no production-readiness claim. See [final integrated evidence](<../Docs/plans/swarm-final-verification.md>). See [acceptance ledger](<../Docs/plans/swarm-acceptance.md>) and [browser findings](<../Docs/plans/browser-final-findings.md>) for exact limits.

## Run locally

Prerequisites: Node 26 and pnpm matching [package.json](<package.json>), dependencies provisioned by the integration owner, and compiled contract artifacts. Do not use real keys. Root installation and lockfile changes belong to the lead; this guide intentionally does not request an install.

From the repository root, install the workspace and isolated contract dependencies, then start the chain:

```sh
cd swissquote-wallet
pnpm install
npm --prefix contracts install
npm --prefix contracts run compile
npm --prefix contracts run node
```

Leave the chain running. In a second terminal in this directory, initialize its pinned local fixtures and start the browser demo with local-only keys and MOCK bank liquidity:

```sh
pnpm devnet
pnpm demo:local
```

The local launcher refuses a nonlocal chain and supplies explicitly unsafe development keys only to local processes. Never use these fixtures on a public chain. It starts the wallet, separate tool and two MOCK services. For the standalone contract/protocol acceptance story use `pnpm story`; do not mutate a chain during a browser run.

`devnet` places pinned contract-runtime fixtures at their Sepolia addresses **on the local chain**, and a mintable DemoUSDC fixture at the USDC address. It is not a public deployment. `story` is the chain/protocol fallback story, not a browser/service rehearsal. It advances local EVM time to test the genuine recovery delay; it does not spend three real minutes waiting. Script execution can mutate local chain state. Do not run these commands against a shared chain without coordinating with its owner.

Open the wallet at <http://localhost:5173> and the separate tool at <http://localhost:5174>. Swissquote listens on loopback port 4001; partner on 4002; local RPC on 8545. Use `localhost` consistently for passkeys. [dev.mjs](<dev.mjs>) stops supervised processes together when one exits or Ctrl-C is pressed.

### Browser/service configuration is a separate checkpoint

The CLI story uses explicit local-only development fixtures. The browser/services require their own enrolled users and guardian keys; a story wallet is not automatically a registered browser wallet.

The supervisor loads a local `.env` if present. [Environment example](<.env.example>) defines local chain/RPC/browser settings, but its empty keys do not fund or enable the relayer. Configure local-only keys privately; never paste them into chat or logs. Swissquote additionally requires `ENABLE_MOCK=true` for its demo-only endpoints; its startup code reads `PORT` (default 4001), not `SQ_PORT`. Without `RELAYER_PRIVATE_KEY`, it starts without its chain adapter. The partner reads `PARTNER_PORT` and uses separate storage. Ask the integration owner to provision/fund the local account and relayer and align service configuration. The checked-in example alone is not evidence that browser funding works.

Keep `CHAIN=local` and `VITE_CHAIN=local`. The two local URLs `127.0.0.1` and `localhost` can point to the same node: fallback aliases, **not independent providers**. Sepolia write opt-ins must remain off during this implementation session.

### Validation commands for the integration owner

```sh
pnpm typecheck
pnpm build
pnpm test
pnpm test:contracts
pnpm --filter @sq/recovery-tool build
```

These are available commands, not results from this lane. Package-manager invocation can synchronize dependencies; only the lead should run workspace commands during concurrent implementation. The tool build's inliner is intended to produce a standalone HTML file. Confirm the output exists and actually works from a saved file before the outage demo.

## What is real and what is MOCK

- **Real implementation, runtime unverified here:** Safe transaction and recovery signing, pinned-contract checks, WebCrypto-encrypted kit, WebAuthn integration, separate services, public-RPC reads. Local development uses real pinned Safe/Candide runtime code, but is not a Sepolia execution receipt.
- **MOCK:** Swissquote identity/KYC/account/mailbox, partner face checks, local guardian-key protection (“MOCK HSM”), sanctions and approved-dApp lists, fixed CHF conversion, independent publisher/governance of the tool. Local DemoUSDC is a mintable token fixture, not Circle-issued USDC.
- **Not claimed:** production banking APIs, production biometrics/HSMs, audited integration, formal verification, on-chain passkey spending limits, live WalletConnect, or live multichain support.

## Authority and limits

Safe v1.4.1 has one owner and threshold one. Module A requires card + partner with a 180-second demo wait. Module B requires card + Swissquote with a 259,200-second wait. The owner can cancel pending requests; both modules must be checked and cleared. Production waits are recommendations, not deployed policy.

Passkeys for large/admin transactions control **sponsored relay acceptance**, not the Safe's independent spending path. Someone holding the owner key can pay their own gas and bypass application/relayer checks. A malicious wallet-app publisher could steal a key while it is unlocked. An independently obtained tool checks setup rules; it cannot prove a compromised app never copied the key.

The encrypted kit plus its separate code restores the current owner key without Swissquote. It still needs a working chain/RPC and a funded submitter; it is not offline settlement. After recovery or rotation, replace the kit and reject stale owner credentials. Keep kit code separate from recovery-card words.

## Submission and source evidence

Start with the [submission index](<../Docs/submission/README.md>), [threat model](<../Docs/submission/threat-model.md>), [custody / Travel Rule note](<../Docs/submission/custody-travel-rule.md>), and [demo script](<../Docs/submission/demo-script.md>). The legal proposal is address-control evidence linked to a MOCK customer, not legal ownership proof or approved Swissquote interoperability. No commits, pushes, public deployment, or live transactions were performed by this lane.
