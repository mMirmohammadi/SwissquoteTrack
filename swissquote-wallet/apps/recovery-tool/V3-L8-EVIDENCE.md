# v3 L8 scoped acceptance evidence

Implemented in the isolated v3 worktree only. The audit is read-only current-state evidence, not institutional identity verification, wallet-history verification, a collusion replay or a publisher audit.

## Observed acceptance

From `swissquote-wallet/`:

- `pnpm --filter @sq/protocol typecheck`: exit 0.
- `node --import tsx --test tests/protocol/v3-audit.test.ts`: 4 passed, 0 failed, 0 skipped. Covers every state/code read pinned to minimum shared head; extra owner/module, missing module, hidden guard/fallback, changed guardian threshold/cardless topology; bytecode/RPC disagreement/failure; pending target and cancellation deadline; qualified helper identity and owner-key leak warning.
- `pnpm --filter @sq/wallet typecheck`: final rerun exit 0. Earlier unrelated `TS1261` duplicate `demoLab`/`demolab` casing blocker was reported to lead; other lanes resolved it. L8 did not change either path.
- Recovery-tool `typecheck`, `build`, `test`: exit 0; 18 passed, 0 failed, 0 skipped. Uses mocked read-only clients and checked-in bytecode, not public RPC. Tests retain offline authenticated decryption, distinguish original CREATE2 initializer/current owner, refuse stale or disagreeing kit ownership, and check bounded CSP/local URLs/inline portable assets.

## Reproducibility evidence

Fresh, separate output directories were created under the exclusively allocated [attempt directory](../../../AgentsLocal/82b407ad/). Dependencies were the existing workspace dependencies, not fresh installs or isolated machines. Vite reported 7.3.7. For each pair, `cmp` and SHA-256 matched, exit 0.

Default environment (Sepolia configuration; no network requests during build):

`pnpm exec vite build --outDir ../../../AgentsLocal/82b407ad/final-default-a && node scripts/inline.mjs ../../../AgentsLocal/82b407ad/final-default-a`

Repeated for `final-default-b`. Both generated HTML files:

`a9e4db3f95bf5ae541a3322ad6d087f25cd29f5035e998589fa371c9c4c931db`

Isolated local environment, repeating the same commands with `VITE_CHAIN=local VITE_RPC_URLS=http://127.0.0.1:8645,http://localhost:8645` for `final-local-a`/`final-local-b`:

`9b2e20143233f6d9972042ca468a73babe6844aca06f7934d40c0b670590b472`

Default reference is stored in [tool-fingerprint.sha256](./tool-fingerprint.sha256); [verify-tool.mjs](./scripts/verify-tool.mjs) compares a file to an explicitly supplied reference. A different build environment/configuration can legitimately change the hash. This is scoped same-environment reproducibility, not cross-machine reproducibility or proof the publisher is trustworthy. The reference must come from an independently trusted channel; editing HTML or taking a DOM-based portable download changes byte identity. Do not embed the whole-file fingerprint in the file itself.

## Remaining lead-owned acceptance

No services/ports, Git, installs, public calls/writes, main/v2 modifications, full gate, or browser/deployed-chain acceptance were performed. Browser must confirm the public fragment opens only the no-secret pane, stale-kit refusal/clear behavior, saved-file decryption/printing/download and actual isolated CSP RPC/HMR connectivity. Static CSP allows exact endpoints but is not browser evidence. Live local/Sepolia story results, collusion-refusal linkage, hardcoded public story-code prefill, submission attachment, root README/root verifier wiring and fingerprint on externally produced cards remain lead integration, outside narrowed L8 paths. Final routing note was read before handoff.
