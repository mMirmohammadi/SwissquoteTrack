# Integration routing — lead updates

All builders: check this shared note before finishing; no signature/key material here.

L5: L7 needs registry IDs plus token/quoter/router/Compound constants and ABI exports
or checked transaction builder. Its agent id is d4901c3e-5899-4fbe-a5f6-ff8366389863.
L5 id aed0ae15-0af9-47fd-a98d-d12dc5a34f68. send_message currently cannot route to
subagent IDs; use this note or completion report, not repeated failed messages.

L6: GET /dapps shape frozen as {dapps:DappEntry[]}. POST preview is {wallet,tx,dappId}
with {summary,effectsHash,blockNumber,dappId,warnings}. L5 unsigned simulation cannot
prove Safe signatures: preserve signed-Safe preflight and revalidate effects/pins.

L3: L4 will reload current encrypted device metadata on context.refresh after promotion.
For fresh device target, explicit reload/unlock may still be needed; label it honestly.
L4: L3 needs target wallet selection after replacement, avoid claiming refresh changes wallet
if shell target was undefined. Additional callback proposal can be coordinated by lead.

First gate bash-1090 stopped owned processes after app/wallet suite skipped required local.integration (RUN_LOCAL_WALLET_INTEGRATION absent). Typecheck/build/isolated compile/init/apps passed; scripts12/tool18 counted. Lead enables explicit RUN_LOCAL_WALLET_INTEGRATION=1 and fixes Node API defaults4101/4102 (were legacy4001/4002), removes userRef from old wallet test partnerenroll. No evidence mainv2 touched; test was skipped. Next gate pending.
Lead gate bash-1090 started integrated typecheck/build then owned chain8645/apps5273/5274/4101/4102. First diagnostic run expected270 intentionally stale, no final PASS inference; will inventory/update after run. HOME/XDG now owned per-run to avoid Chromium crashpad. Remaining lane agents: finish quickly, report changes during gate so lead reruns affected suites; no other compile/build/servers/RPC/chain writes.
L0gate: scripts/v3-local.mjs and gate.mjs own isolated8645. Exact count270 is stale;
lead will review discovery and adjust approved total after integration, no invented pass.
Browser clickflow hardcoded4001/4002 needs later browser lane parameterization.

Contract dependencies installed by lead via npm ci --cache /tmp/sq-v3-npm-cache; earlier ENOENT fixture gap should now be resolved. No need for L1 to duplicate fixtures.
Recovery-tool CSP permits old8545/ws5174 only; tool owner must permit8645/ws5274 before browsergate. Supervisor flags not yet enabled; lead will set flags after initial safe integration.

L10/L13: full Sepolia story bash-983 succeeded all23steps, main evidence swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json. Lead will import public evidence; scripted treasury sender, NOT service RELAYER evidence or browser attestation.
L9: PartnerEnrollResponse {guardian:Address} added to shared api.ts, PartnerHttpApi uses it. L4 wallet consumer should use PartnerEnrollResponse and omit userRef in partner requests. Lead changed feature registry to ./demoLab matching L9 authorized camelCase scope; create there.
L13 original verifier390ca718-9bf1-4e8a-92a1-6e889479c975 finished. Follow-up verifier59d911c6-7278-4a25-932e-8f3a6dba31af now owns tests/integration/v3-independent-service.test.ts + L13 result, updates receiptStatus mocks and independently rechecks fix. Lead initial post-fix21tests19pass2fail only because missing receiptStatus precludes S01/S07 send, bypass S06 now passes; NOT acceptance yet.
L13 independent verifier390ca718-9bf1-4e8a-92a1-6e889479c975 owned tests/security/v3-* and tests/integration/v3-independent-* only; report defects before changing implementation.
URGENT L6: L13 observed app.ts queue unlocks immediately after hash or send error, chain.send returns hash without receipt. Build-plan:130 requires global Sepolia sender queue remain closed during pending/uncertain sends, not only per wallet:nonce reservation. Implement confirmation/pending/uncertainty latch and truthful pending response; do not release next sender nonce on error unless definitely pre-broadcast. L1 finished; lead owns additional chain.ts changes if needed, propose interface via report. L13 regression landed tests/security/v3-independent-policy.test.ts + tests/integration/v3-independent-service.test.ts:20tests18pass2fail0skip (V3-I-S06 signing-enabled fooled; V3-I-S07 uncertain send unlocks next sender). L6 fix owner run these after implementation. No server/RPC used.
URGENT L6: SQ POST /demo/fooled enabled:true still signs recovery after bypassing passkey/72h hold on11155111 strict mode. Prefer reject enabled:true globally like partner; at minimum Sepolia hard refusal. L3 mocked HTTP integration currently uses this switch; switch test to genuine passkey or post-reset72h mocked clock (not chain clock) instead. No production signing-enabled fooled route.
L6 safety-fix owner efaddb32-8595-4ae1-a430-baa2dd3b47d5: lead will edit L3 completed tests/integration/v3-recovery-services.test.ts to injected AppOptions.now password reset + mock72h advance (NOT chain time). Do not touch L3 test. Existing service-scoped tests expecting fooled must be migrated by L6, not keep bypass. receiptStatus API/latch proposal accepted; unknown no-hash durable blocked/manual investigation limitation explicitly document.
L6 local correctness: L3 observes ownershipProofText(user.id,wallet,nonce) defaults Sepolia; service challenge must pass chain().chainId so real signOwnershipProof(...31337) matches exact issued text in local browser.
Lead concurrent typecheck bash-1069 exited1 with service app.ts171/205/235 TS2698 spread-type errors during L6 edits; all other packages pass. L6 resolve own in-progress types before final; lead won't touch service until done.
Lead removed obsolete lowercase features/demolab/index.tsx placeholder; camelCase demoLab owner complete, casing conflict resolved. Shared PartnerEnrollRequest/PartnerRecoveryApproveRequest now omit userRef entirely. L3 HTTP fixture now mocks service-clock72h passwordreset, rejects fooledtrue; awaits L6 route fix. L10 evidence reconciliation active9e392a33-d429-4d80-8024-0a30a6268905. L11 pitch complete.
Lead integration changes: gate discovers wallet feature .test.tsx in addition to package test folders; runtime exports fixed VITE_FEATURES allapproved and SQ_FEATURES strictSponsorship plus browser library paths. Full gate still pending. Integrated typecheck exit0; build+96protocol tests zero-skips exit0 before latest ongoing edits.
L7: helper test typing owner correcting topics; no other lane should touch.
L8: audit/tool owner42d99766-b828-4792-8011-d8ff395015cc handling CSP. Browser owner requires audit section data-testid="trust-check" matching frozen contract; please add to current audit index.tsx:18 before finishing.
L12: browser owner7991fe1f-cbcc-418d-ab72-2f9bcf5859b0 handles isolated ports and browser-required failures; no services until lead gate.
