# V4 full-gate inventory

**Final expected count: 609, established from source before the final full run.** Baseline 602 already passed; the optional bank-return shortcut adds seven regression cases.

Frozen v3 inventory: 591 tests ([prior inventory](<../v3/compound-test-inventory.md>)). New V4 cases: seven [bank-return shortcut cases](<../../../swissquote-wallet/apps/wallet/test/return-shortcut.test.tsx>), eight [launcher cases](<../../../swissquote-wallet/scripts/test/sepolia-demo.test.mjs>) and three [wallet polish cases](<../../../swissquote-wallet/apps/wallet/test/ui-polish.test.tsx>). The existing portable-build test was strengthened without increasing the count. Moving recorded Compound vectors from ignored scratch to a versioned public fixture retains all 51 existing exact-math cases.

Run from the V4 wallet worktree with the existing installed browser and library path:

    BROWSER_EXECUTABLE=/tmp/sq-playwright/chromium-1248/chrome-linux64/chrome LD_LIBRARY_PATH=/tmp/sq-browser-libs/usr/lib/x86_64-linux-gnu GATE_EXPECTED_TESTS=609 node scripts/gate.mjs

The gate owns only 5273/5274/4101/4102/8645 and stops its processes on exit. Typechecks/builds, every inventoried Node suite, actual local browser flows and contract tests must all pass. Any skip, cancellation, todo, missing suite or count mismatch fails acceptance. An incomplete gate's successful suites do not establish an aggregate pass.

The runtime paths above are specific to this prepared machine. A fresh machine requires provisioned Chromium and its libraries; this is not a clean-clone installation claim. Public Sepolia G1 is a separate bounded gate, not included in the 609 local tests.
