# Swarm implementation contract

User approved implementation of build plan v2 with massive parallel subagents. Local implementation/test actions authorized; NO commits, pushes, deployments or Sepolia transactions yet. Local dev servers and local chain transactions are permitted. Never print secrets.

## Ownership
- Lead: swissquote-wallet root package.json, pnpm-workspace.yaml, tsconfig.base.json, .env.example, root integration, .gitignore.
- Protocol builder: swissquote-wallet/packages/protocol/** (including src/api.ts). Publish EXPORTS.md immediately before implementation so consumers have fixed signatures.
- Swissquote builder: swissquote-wallet/services/swissquote/**.
- Partner builder: swissquote-wallet/services/partner/**.
- Wallet builder: swissquote-wallet/apps/wallet/**.
- Tool builder: swissquote-wallet/apps/recovery-tool/**.
- Chain/story builder: swissquote-wallet/contracts/** and swissquote-wallet/scripts/**.
- Submission builder: Docs/submission/** and swissquote-wallet/README.md.
- Independent reviewers: swissquote-wallet/tests/{security,integration,browser,protocol}/** and their own Docs/submission/review-*.md, no implementation edits.

## Fixed integration facts
Workspace root swissquote-wallet; package manager pnpm; Node 26; TypeScript ESM; packages names @sq/protocol, @sq/swissquote, @sq/partner, @sq/wallet, @sq/recovery-tool, @sq/scripts. All packages expose build, typecheck and test scripts (test may use node --import tsx --test). Root is sole owner of lockfile and dependency installation: builders do not run pnpm install or edit shared files. Contracts excluded from pnpm workspace and may run npm install --cache /tmp/npmcache within contracts only. Each package defines its own dependencies. Shared protocol consumed as workspace:* with source TypeScript exports, compiled by Vite or tsx.

Ports wallet 5173, tool 5174, Swissquote 4001, partner 4002, local Hardhat 8545. Local chain id 31337; Sepolia 11155111. Env CHAIN=local|sepolia, RPC_URLS comma separated, RELAYER_PRIVATE_KEY, SQ_ACCOUNT_PRIVATE_KEY, FUNDER_PRIVATE_KEY. Browser env VITE_CHAIN, VITE_RPC_URLS, VITE_SQ_URL, VITE_PARTNER_URL. No replacement DSH GUI server; these are separate requested wallet demo services.

Protocol builder owns exact export signatures; consumers read packages/protocol/EXPORTS.md before integration. Publish explicit HTTP request/response contract in packages/protocol/src/api.ts immediately. Service endpoints per build plan. JSON encodes bigint as decimal strings; use Authorization Bearer opaque session tokens in local app, never log them. API responses errors {error:string}. Local services support injected clients and environment overrides for tests, and independent data directories. MOCK features labeled. Do not silently weaken passkey requirements to password for large/admin transactions.

Shared defaults: viem 2.x, @scure/bip39 + bip32 2.x, @simplewebauthn/server/browser 14.x, React 19, Vite 7, TypeScript 5, tsx 4. Recovery tool should bundle to single portable HTML without external assets; apply no-frame CSP. Secrets generated only by secure random/local key storage, never hardcoded outside explicit Hardhat development fixture.

## Completion evidence
Each builder writes a brief IMPLEMENTATION.md in own scope: implemented flows, exact exports/endpoints, commands, tests actually run, remaining gaps. Reviewers must run tests against actual code, cite failures and distinguish unavailable tests. Core gates: template deploy, verified rules, owner payment with zero ETH, genuine recovery delay, old-key GS026, both-module cancellation, no-card refusal, emergency kit sweep with services stopped. Browser automation is encouraged if installed/available; no claim of human click-testing.
