# Independent security checks — final pass

**Final bounded run: 49 passed, 1 failed, no skips.** The remaining failure is production passkey step-up options, not a reproduced unauthorized relay. See [review report](<../../../Docs/submission/review-security.md>) and [exact builder action](<../../../Docs/plans/security-final-findings.md>).

Run from the wallet workspace using existing lead-installed dependencies:

`node --import tsx --test --test-timeout=15000 tests/security/*.test.ts`

[Protocol suite](<protocol-adversarial.test.ts>) runs 13 cases against actual exports. The batch helper wraps packed `encodeMultiSend` bytes in the actual `multiSend(bytes)` ABI; mixed cancel/transfer cannot become Protective, and genuine administration is intentionally strictest.

[Swissquote HTTP suite](<service-adversarial.test.ts>) runs 22 cases against actual `createApp` with isolated memory storage. Chain operations and most WebAuthn operations are injected. JSON SHA-256 hashing is only a canonicalized boundary double, not actual EIP-712 verification. Tests retain wrong-hash/expiry/replay refusal and add concurrent token/challenge consumption, deployment reservation, definite-preflight balance restoration, overdraft/budget races, uncertain-send debit retention and recovery-chain refusal with valid control. SEC-S08 records HTTP 502 as misleading UX while separately proving security refusal. SEC-S20 uses real WebAuthn authentication options/verification, with only enrollment injected; its options control currently fails HTTP 500 before malformed-assertion verification can execute. Do not skip it or remove the challenge-binding expectation.

[Partner HTTP suite](<partner-http.test.ts>) runs 11 cases through actual exported server/service/storage. Chain snapshots are injected. Valid-face control uses real recovery hash/signing helpers and an explicit synthetic unfunded key, never an RPC. Wrong face, enrollment overwrite, module/chain/nonce/guardian/threshold/hash errors all refuse signing; demo bypass is disabled by default.

[Partner storage suite](<partner-storage.test.ts>) runs four cases against real memory and in-memory SQLite storage. No filesystem or restart durability claim.

Tests listen on ephemeral loopback ports, close their own servers and use request/test deadlines. They do not restart or alter the lead-managed demo stack, install dependencies or send public/local-chain transactions. Genuine browser-generated WebAuthn, production chain adapters, on-chain end-to-end recovery and offline kit sweep remain separate verification work. This suite is bounded policy evidence, not audit certification.
