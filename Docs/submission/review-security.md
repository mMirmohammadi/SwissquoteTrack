# Independent security review — bounded final pass

**Result: 49 of 50 tests passed; security acceptance remains blocked by production passkey step-up options.** The actual WebAuthn adapter returns HTTP 500 before an assertion can be requested. This is an availability/demo blocker, not demonstrated unauthorized signing. Exact builder action is in [final findings](<../plans/security-final-findings.md>).

## Executed evidence

Command, from `/home/dev/Hackaton/SwissquoteTrack/swissquote-wallet`, Node v26.4.0:

`node --import tsx --test --test-timeout=15000 tests/security/*.test.ts`

Final run: exit 1; **50 tests, 49 passed, 1 failed, 0 skipped, 0 cancelled**. Duration approximately 2.15 seconds. Breakdown: protocol 13/13; partner HTTP 11/11; partner storage 4/4; Swissquote HTTP 21/22. Every imported suite loaded and scenario bodies executed, except the later malformed-assertion part of SEC-S20, which was blocked by its options control. No test was skipped to obtain this result.

The initial rerun reproduced 25/28 passes and the three previously reported failures. Subsequent bounded runs corrected verifier errors and added actual regression coverage. These supersede the earlier first-pass entrypoint blockers; missing code is no longer the reason for incomplete acceptance.

## Only failing test: SEC-S20

[Real-adapter HTTP test](<../../swissquote-wallet/tests/security/service-adversarial.test.ts#L226-L237>): authenticated account, fixture-enrolled credential, real `createWebAuthn` authentication-options adapter, valid 32-byte hash. `POST /auth/passkey/step-up/options` returned:

`HTTP 500 {"error":"WebAuthn challenge must bind transaction hash"}`

Expected control remains HTTP 200. The [adapter](<../../swissquote-wallet/services/swissquote/src/webauthn.ts#L8>) passes an already base64url-encoded challenge as a string; SimpleWebAuthn 14.0.3 treats strings as UTF-8 input and encodes them again. The app correctly refuses the changed challenge. Pass decoded bytes to the library and retain the exact binding guard. The intended follow-on malformed assertion against the real verifier **did not execute** because options failed. Genuine browser-generated passkeys remain unverified by this reviewer.

## Three earlier failures correctly separated

**SEC-P03:** [test batch helper](<../../swissquote-wallet/tests/security/protocol-adversarial.test.ts#L23-L24>) originally sent raw packed bytes from `encodeMultiSend`, without the enclosing `multiSend(bytes)` ABI. Admin was the malformed-calldata rejection, not legitimate strictest-class behavior. Corrected fixture now asserts cancel-plus-large-transfer is exactly Large, requires passkey, is not Protective and remains relayable. A separate valid admin-plus-transfer test proves Admin intentionally outranks Large, matching [rank](<../../swissquote-wallet/packages/protocol/src/classifier.ts#L27-L29>).

**SEC-S07:** [injected hash double](<../../swissquote-wallet/tests/security/service-adversarial.test.ts#L19-L22>) now canonicalizes transaction hex/address casing before JSON SHA-256, matching the actual app's normalized transaction. Actual implementation hashing was not edited. Wrong-hash, expiry, sequential replay and concurrent replay assertions remain strict and pass.

**SEC-S08:** invalid injected assertion returns HTTP 502 with `Operation failed; inspect local service and chain configuration`. [Test](<../../swissquote-wallet/tests/security/service-adversarial.test.ts#L112-L122>) confirms no approval token, no reusable challenge, refusal of large relay without approval, and no send. This is security refusal with misleading error presentation; it is not a security bypass. The assertion-throwing double does not prove every production invalid assertion has this status.

## What passed against actual exported code

[Protocol suite](<../../swissquote-wallet/tests/security/protocol-adversarial.test.ts>): pure two-module cancellation; fake selector target; mixed cancellation/transfer; value-bearing cancellation; outer/inner forbidden delegatecalls; malformed/empty batch; unknown token; unlimited approval; zero-value administration; strictest admin rank; exact USDC boundary.

[Swissquote HTTP suite](<../../swissquote-wallet/tests/security/service-adversarial.test.ts>): session wallet ownership, unregistered wallet, absent/forged/wrong-hash/expired approval, sequential and concurrent token replay, challenge replay, recent-reset guardian hold, invalid signature, budget exemption only for owner-signed Protective cancellation, forbidden delegatecall despite approval, same/different-wallet deployment race, simulation failure restoring withdrawal balance and allowing retry, concurrent overdraft refusal, account/global budget serialization with refused debit restored, uncertain-send debit retained, and recovery approval/relay chain mismatch rejected before hash/sign/send. Matching-chain approval using an injected passkey session succeeds. Deployment duplicates during reservation return 409; completed same-wallet retry returns the cached result with only one send.

[Partner HTTP suite](<../../swissquote-wallet/tests/security/partner-http.test.ts>): wrong-face enrollment overwrite refusal with original guardian unchanged; same-face enrollment control; wrong-face recovery before chain read/sign; valid-face signing control; wrong module, request/RPC chain, stale nonce, missing/duplicate guardians, wrong threshold and hash mismatch refuse signing; demo bypass disabled by default. HTTP/service/storage are actual code. Chain snapshots are injected; positive approval uses real protocol hash and signature helpers with an explicitly synthetic unfunded key.

[Partner storage suite](<../../swissquote-wallet/tests/security/partner-storage.test.ts>): both actual memory and in-memory SQLite stores reject overwrites and isolate returned copies. No filesystem permissions or restart durability claim.

## Scope and stop condition

Edited only the reviewer-owned security tests, this report and [final findings](<../plans/security-final-findings.md>). No implementation edits, installations, root edits, commits, public transactions or changes to the lead-managed stack. Tests use ephemeral loopback HTTP listeners and isolated in-memory databases; they do not replace demo listeners or submit to localhost chain/testnet. Chain and most WebAuthn boundaries are injected; their passed policy checks are not chain-contract or genuine-passkey cryptography evidence. No human click-test is claimed.

Still unverified here: full browser create/sign/recover story, genuine passkey enrollment/assertions, production chain adapters and on-chain recovery/old-owner refusal, real simultaneous deployment across multiple service processes, reset-hold expiry/passkey exception, and offline emergency-kit sweep. Other reviewers' evidence must be reported separately rather than counted as this review's execution.

Bounded final tests and exact actionable findings are complete; this verifier stops. Lead should route SEC-S20 to the Swissquote owner, rerun the unchanged regression and complete suite, and retain SEC-S08's UX caveat. This report is not a security audit certification.
