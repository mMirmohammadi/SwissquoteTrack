# Gate isolation finding

The updated gate `bash-1346` passed typecheck/build and all 438 Node tests with zero skips, including 33 browser tests, but failed the separate contract suite (41 passed, one failed). It is not aggregate acceptance.

Exact failure: `ProviderError: Timestamp 1791668472 is equal to the previous block's timestamp. Enable the 'allowBlocksWithSameTimestamp' option to allow this` at `swissquote-wallet/contracts/test/t1-t5.candidateB.test.js:179`.

Mechanism: `V3_LOCAL_OWNED_RUN` enables natural one-second blocks for the browser's real waiting-period test. The gate forwarded that environment into Mocha's separate in-process chain, which also performs exact `executeAfter - 1` / `executeAfter` timestamp assertions. A naturally mined block could consume the exact boundary between explicit timestamp calls.

Fix: the contract child environment removes only `V3_LOCAL_OWNED_RUN`. Browser RPC keeps interval mining and real waiting. No same-timestamp override, threshold weakening or skipped assertion was added. Separate contract verification and a full gate rerun are required.
