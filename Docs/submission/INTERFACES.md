# Submission lane integration hints

Submission owns only `Docs/submission/**` and `swissquote-wallet/README.md`. No package exports or HTTP routes are added.

## Stable document entry points

- [Run guide](<../../swissquote-wallet/README.md>) — local-first commands read from current package manifests; runtime success is not assumed.
- `README.md` — submission index and evidence boundary.
- `threat-model.md`, `custody-travel-rule.md`, `business-case.md`, `bonus.md`, `ai-tools.md`, `demo-script.md` — concise judging notes.
- `architecture.html` and `architecture.md` — planned authority/component view, real versus MOCK; not a runtime attestation.
- `IMPLEMENTATION.md` — lane checks and integration gaps.

## Lead integration obligations

Keep claim status separate from implementation intent. Update the run guide only after actual local story, browser, and public-chain evidence exists. This lane does not run installs, root build/test commands, live transactions, or commits. Concurrent reviewers own their existing `review-*.md` files; submission will link, not overwrite them.

Current root scripts expose `dev:all`, `devnet`, `story`, `build`, `typecheck`, `test`, and `test:contracts`. Root dependency installation and lockfile ownership remain with the lead. Local two-URL RPC configuration can point to one Hardhat node; that is fallback transport, not independent-provider verification. Never describe it as two independent nodes.
