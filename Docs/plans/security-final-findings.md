# Final security findings — reviewer-owned

**Current blocker: real passkey step-up options return HTTP 500.** Injected-boundary security tests are not evidence that the production WebAuthn adapter works. No implementation changes were made by this reviewer.

## SEC-S20 — production challenge is encoded twice (builder action)

Observed in the actual exported HTTP app with actual `createWebAuthn` authentication-options adapter: `POST /auth/passkey/step-up/options` with a valid 32-byte `safeTxHash`, authenticated account and enrolled fixture credential returns HTTP 500, `{error:"WebAuthn challenge must bind transaction hash"}`. [Regression test](<../../swissquote-wallet/tests/security/service-adversarial.test.ts>) deliberately keeps its expected HTTP 200 control; it does not turn this failure into acceptance.

Mechanism: [WebAuthn adapter](<../../swissquote-wallet/services/swissquote/src/webauthn.ts#L8>) passes the already base64url-encoded hash challenge as a string to `generateAuthenticationOptions`. Installed SimpleWebAuthn 14.0.3 converts a string challenge to UTF-8 bytes, then base64url-encodes those bytes. The output therefore differs from the original hash challenge required by [HTTP step-up policy](<../../swissquote-wallet/services/swissquote/src/app.ts>). This is an availability/demo blocker, not demonstrated unauthorized signing.

Action for Swissquote builder: when an explicit base64url hash challenge is supplied, pass its decoded bytes to the library; preserve random challenge generation for login. Retain the app's exact challenge-binding guard. Rerun SEC-S20 and the complete security suite. No duplicate builder fix is made here.

## SEC-S08 — refusal succeeds, error presentation misidentifies bad assertion

Observed: an injected verifier assertion error returns HTTP 502, `{error:"Operation failed; inspect local service and chain configuration"}`. No token is returned; the consumed challenge cannot be reused; a large relay without approval is refused and no send occurs. This is **security refusal with misleading UX**, not a passkey bypass. The injected assertion is not proof of the same production status for every invalid browser assertion. SEC-S20 will exercise a malformed assertion through the real verifier once its options control works.

Action: classify expected verifier validation exceptions as a clear authentication refusal, without exposing assertion internals or minting approval. Do not globally hide genuine RPC/configuration failures as authentication errors.

## Known observations resolved by verifier evidence

SEC-P03 was malformed test calldata: `encodeMultiSend` returns packed bytes, not `multiSend(bytes)` function calldata. Correctly wrapped cancel-plus-large-transfer is Large, requires passkey, and is not Protective. A separate valid administration-plus-transfer case is Admin: [classifier rank](<../../swissquote-wallet/packages/protocol/src/classifier.ts#L27-L29>) intentionally makes Admin strictest. Keep both guarantees.

SEC-S07 was JSON-double canonicalization: mixed-case USDC was hashed before the app lowercased transaction addresses. Only the injected hash double is canonicalized; actual hash checks, wrong-hash refusal, expiry and replay controls remain unchanged.

Published deployment reservation, preflight withdrawal rollback and recovery chain checks are already implemented by their owner. Tests now exercise concurrent same/different-wallet deployment, token and challenge replay, definite failure balance restoration with successful retry, concurrent overdraft refusal, uncertain-send debit retention, and both approval/relay chain mismatch. These are in-process HTTP tests with injected chain operations, not live-chain proofs.
