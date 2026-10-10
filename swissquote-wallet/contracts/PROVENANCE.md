# Preserved verification harness

The harness was copied read-only from [the verified source tree](<../../AgentsLocal/46257332/verify/>) into this directory, excluding `node_modules`, `artifacts`, `cache`, and `.xdg`. Existing source provenance and captured historical results are retained. Local generated dependencies/build output are ignored, not source deliverables.

Candide source remains unchanged at commit `113d3c059e039e332637e8f686d9cbd505f1e738`; [SOURCES.txt](<contracts/candide/SOURCES.txt>) records upstream blobs. `bash scripts/check-sources.sh` validates all eight files offline.

The preserved C8 test originally depended on a sibling scratch directory. Its only harness edit redirects that fixture to [the vendored abstractionkit package](<vendor/abstractionkit/package/package.json>): version 0.4.3, copied unchanged from [the original unpacked package](<../../AgentsLocal/46257332/plan-review/scratch-technical/ak/package/>). The original tarball SHA-256 is `4af20f81a0bb85f1d10084a841803cd5e5ab63d9dcda63d14a995bc25fcd283c`; MIT license is preserved. This is test-only, not a runtime dependency of the wallet or scripts.

[Saved Sepolia code](<contracts/plan/sepolia-code.json>) is preserved from the verified harness, including source block and constructor storage. [Module B code](<contracts/plan/sepolia-module-b.json>) was fetched read-only from the public Sepolia RPC and saved with source/block/time plus pinned hash `0xdbebd5942589cb48bc55fd0d804e2a825ae485fa4eb771ec030e0ec4c330ae03`. Neither recovery runtime is patched. The new [DemoUSDC fixture](<contracts/fixtures/DemoUSDC.sol>) is explicitly local-only and is not Circle USDC.

New integration: [local story runner](<scripts/local-story.test.cjs>) provides a temporary loopback JSON-RPC adapter to Hardhat's real EVM, then imports the production story. It does not change the preserved test suite or require running bank/partner/app services.
