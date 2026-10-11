# V4 S1 — Recovery Desk wording and build evidence

The Desk now uses the S1 header and plain labels without changing recovery behavior. The public rules tab stays available as the no-secret audit fallback. The independently published desk is still explicitly MOCK and unaudited.

## Changes and boundaries

- [index.html](./index.html) retains every existing `id`, `data-tab`, CSP directive and RPC endpoint. No fonts or other remote assets were added.
- [main.ts](./src/main.ts) changes displayed status text only. Chain checks, secret clearing, confirmation, signing and offline-kit behavior are unchanged.
- [portable.test.ts](./test/portable.test.ts) also checks the S1 header, check-word labels, every tab and key secret/confirmation controls in the generated artifact. Existing no-storage/no-external-assets checks remain.

## Observed checks

Run from `swissquote-wallet/apps/recovery-tool/` in the isolated V4 worktree:

- `pnpm --filter @sq/recovery-tool typecheck`: exit 0.
- `pnpm --filter @sq/recovery-tool build`: exit 0, Vite 7.3.7; inline portable HTML produced. Rollup removed an existing dependency PURE annotation, a non-fatal warning.
- `node --import tsx --test test/approval.test.ts test/core.test.ts test/portable.test.ts test/public-rpc-pacing.test.ts test/validation.test.ts test/wallet.test.ts`: 25 passed, none failed or skipped. These are local test doubles, not live RPC evidence.
- `node scripts/verify-tool.mjs`: exit 0 against the updated [fingerprint reference](./tool-fingerprint.sha256).
- Fresh repeated build under the exclusively created agent scratch directory with `--emptyOutDir false`, followed by inline generation, `cmp` and the verifier: exit 0; identical default Sepolia HTML bytes.

Default Sepolia artifact SHA-256:

`4a90813514e5c2ce52868228a09a1847ef4ceb8eb10b4c0e09976c759fe2cd9e`

This supersedes the default artifact reference from [V3 L8 evidence](./V3-L8-EVIDENCE.md), whose recorded results remain historical. No new local-chain fingerprint was established. This is same-environment repeatability and byte equality, not publisher authenticity, a security audit or cross-machine reproducibility. DOM-based saved pages or a different Vite environment can legitimately have different bytes; references must come from an independently trusted channel.

## Remaining lead acceptance

The full Desk suite initially failed because the lifecycle test's SafeProxy artifact was absent at `contracts/node_modules/@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json`; a separate pre-build failure for missing portable HTML was fixed by building. The lifecycle dependency was not installed or substituted in this lane. The lead must rerun that test after dependencies are prepared.

No browser, services, servers, public network calls/writes, full gate, commits or pushes were run. The lead still needs browser/rehearsal checks for the refreshed copy, bookmarks, signing flow, clipboard/printing, offline kit and actual CSP connectivity. The wallet M2 card and flag cutover remain a separate owner's acceptance; this lane retained `audit` and `dapps` launcher flags.
