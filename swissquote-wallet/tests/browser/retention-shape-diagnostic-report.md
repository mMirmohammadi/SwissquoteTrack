# Retention failure: encoded IndexedDB record rejected before deployment

## Result

The isolated browser reproduces the retention mismatch without contacting a live app, RPC, or service. A device record with an explicitly undefined `wallet` property is exported by Playwright under `records[].valueEncoded`, not `records[].value`. The retention guard reads only `value`, so it rejects the record before examining the encryption envelope or matching the owner.

This is a serialization mismatch, not evidence that the owner key was missing or that its encryption was invalid. It explains the reported pre-deploy guard failure and the repeated generic failure during the final snapshot. The live run itself was not opened, so attribution to that run is an inference from its reported failure and the source-equivalent reproduction.

## Executable evidence

Run from the workspace root with a newly created, exclusive directory under `AgentsLocal/`:

`timeout --signal=TERM --kill-after=2s 30s node .worktrees/v3/swissquote-wallet/tests/browser/retention-shape-diagnostic.mjs /absolute/path/to/owned/AgentsLocal/attempt`

The [diagnostic](<retention-shape-diagnostic.mjs>) uses only the authorized Chromium binary, library directory, an owned browser HOME, isolated browser contexts, and an in-process route fulfillment. It creates a synthetic database and calls the actual `context.storageState({ indexedDB: true })`, exported `hasEncryptedDevice`, and actual retention `guardWrite`/`snapshot`. Guard runs first, before any failed snapshot can latch it. The diagnostic is deadline-bounded and asserts the expected mismatch. It outputs primitive types and field names, never payload values. No private browser state, environment file, live credentials, seed, or authentication storage was read.

The installed Playwright version is 1.64.0; the [browser package](<package.json#L12-L14>) declares `^1.56.0`.

## Structural comparison

When `wallet` is absent, the export has `records[].value` containing the plain device object. Its fields are `id:string`, `owner:string`, `createdAt:string`, and `envelope:object`. The direct detector reports present, the first deploy guard allows the synthetic operation, and subsequent snapshots succeed.

When `wallet` exists with type `undefined`, the export instead has `records[].valueEncoded:object`. That object contains `o:array` and `id:number`; `o[]` entries have `k:string` and `v` containing primitive data or nested encoded objects. The undefined property uses a nested `v:string` marker. No marker contents or record payload values are reproduced here. The plain `value` field is absent. The direct detector, first deploy guard, subsequent snapshot, and cleanup-style snapshot all produce the same generic retention failure.

When `wallet` has type `string`, the export returns to `records[].value` with a plain device object, and both the detector and retention operations succeed. Therefore neither the optional field's name nor the envelope alone triggers rejection; preserving an explicitly undefined property triggers Playwright's encoded representation.

## Source connection

[Device storage](<../../apps/wallet/src/storage.ts#L17-L22>) opens the expected database and store with key path `id`. [saveDevice](<../../apps/wallet/src/storage.ts#L37-L40>) constructs the object literal `{ id, owner, wallet, envelope, createdAt }` even when its optional wallet argument is undefined. The diagnostic preserves that undefined property, rather than omitting it with JSON serialization.

[hasEncryptedDevice](<live-retention.mjs#L15-L23>) collects actual IndexedDB records but destructures only `value`. Its missing-value check rejects an encoded record immediately. [guardWrite](<live-retention.mjs#L111-L116>) calls the same snapshot validation before deployment, so the storage representation blocks deployment even though the owner is present in the underlying device object.

The synthetic envelope preserves the exact shape required by [protocol encryption](<../../packages/protocol/src/crypto.ts#L29-L43>) and the retention validator: `v:number`, `kdf:{name:string,hash:string,iterations:number}`, and `salt:string`, `iv:string`, `ciphertext:string`. It uses PBKDF2/SHA-256 with 600000 iterations, AES-GCM-256, a 16-byte salt, 12-byte IV, base64url encoding, and a real encrypted synthetic non-seed payload. The detector compares the matching synthetic owner in every case. The passing plain cases establish that envelope and owner validation were not weakened for the reproduction.

[Existing guard fixtures](<live-retention.test.mjs#L22-L26>) fabricate `{key,value}` records and use a string wallet. The pre-deploy test [deletes wallet](<live-retention.test.mjs#L61-L67>), unlike the source object literal's explicitly undefined property. Those fixtures therefore test the guard against a different storage shape and cannot exclude this failure.

## Recommendation only

The retention implementation owner should normalize the real Playwright `valueEncoded` representation into a device record before applying the unchanged device-field, exact envelope, ciphertext-bound, and owner/wallet checks. Any decoder should be bounded, reject unsupported encodings and extra fields, and distinguish a absent record from a malformed one. Do not bypass retention validation, reduce the KDF requirement, accept unknown fields, or retry a live deployment as a diagnostic.

Retain a real-browser regression covering the exact pre-deployment object with `wallet:undefined`; JSON round-tripping a fixture removes the property and hides the problem. A JSON-only fixture cannot prove equivalence to IndexedDB structured cloning. Production implementation files were not changed by this task.
