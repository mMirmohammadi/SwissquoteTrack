# Retention correction — source inventory delta

The independently counted [registration inventory](<registration-test-inventory.md>) contains 518 registrations = 476 Node + 42 contracts across 76 files. The only new registered test in this correction is one top-level table-driven declaration in [live-retention.test.mjs](<../../../swissquote-wallet/tests/browser/live-retention.test.mjs>): optional canonical uint64 deployment metadata in plain and exact Playwright encodings, including unchanged raw snapshot persistence. Its internal cases do not register nested tests.

Therefore the explicitly approved expected aggregate is **519 = 477 Node + 42 contracts**, with the same registered-file count. The affected retention suite is 15 tests rather than 14. Changes to the opt-in Compound harness add public stage labels and use the exact accessible combobox selector; that standalone live harness is not registered in the local gate and adds no tests.

This is a source-count delta, not passing evidence. The last accepted 518-test gate predates this correction. A fresh isolated 519-test gate is required before claiming current aggregate acceptance.
