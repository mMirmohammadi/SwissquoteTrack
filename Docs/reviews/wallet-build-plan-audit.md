# Wallet build-plan audit: what works, what the client actually sees

**Bottom line: the core wallet story has real execution evidence, but the supplied draft is not implemented word for word—and several promised proofs are not experienced in the current normal demo.** The largest gaps are external WalletConnect, a live attacker-refusal demonstration, recovery notifications outside an open wallet, and independent MetaMask/Safe spending from the Emergency Kit.

Audited 11 October 2026 against the supplied draft v1 and the uncommitted V4 candidate. Input SHA-256: `2b5d3dafd5a8800211b938bd05e3af18be43a98e631792c6949e1b7bf6f5d5da`. This is a comparison to that historical draft, **not** a claim that later authorized product decisions were mistakes. Changed behavior still needs to be disclosed when claiming draft compliance. No application source, account data or running service was changed by this audit.

## Read this first

| Area | What works or is supported | What is missing, changed, or not established |
|---|---|---|
| Core story | Retained browser/Sepolia evidence for creation, owner-signed sponsored USDC payment, partner recovery, old-key refusal and replacement-owner payment | Recovery evidence spans resumed sessions, not one uninterrupted current-build rehearsal; the old-key button requires a special same-page setup |
| Self-custody and recovery | One Safe owner; each recovery route requires its card plus its own helper; old owner can cancel | The normal screen describes the attacker refusal but the active Demo lab does not execute it |
| Creation | Encrypted local key, separate card tool, predictable wallet setup, independent-check and kit flows | No signed enrollment statements; manual public-address copy instead of automatic return; independent verification is a separate client action |
| Fees and approvals | Sponsorship visibly explained on home, payment and review screens; large-payment passkey path exists | Normal currency is USDC; >5 USDC uses passkey, not password alternative; quota counts submissions, not per-wallet daily gas |
| dApps and portability | Built-in allow-listed DeFi; retained third-party Compound test-supply receipt; encrypted kit/RPC exit evidence | No WalletConnect session or generic signing methods; no completed MetaMask→Safe spending demonstration; no receive QR |
| Recovery timing and notifications | Partner route waits three minutes; wallet checks both modules; cancellation and replacement supported | Swissquote route waits three days, not five minutes; browser polling only, no server watcher/mock email; other-module conflict needs manual handling |
| Presentation and acceptance | Packaged deck, architecture and written custody/business materials | No packaged full-demo recording; human rehearsals not established; earlier full test gate is stale after UI changes |

## How strong is the evidence?

**Fresh during this audit:** read-only public HTTP health/source checks show the existing server is on Sepolia with strict sponsorship; a delegate ran local mocked API/dApp/UI tests successfully (20 passed, no failures). Those tests do not prove hardware passkeys or new on-chain execution.

**Retained, not rerun here:** concrete Sepolia receipts and browser records support successful core operations and one Compound supply. They are historical evidence, not proof that every current screen or every draft branch was executed today. The latest prior wallet-only run had 54 passing tests and one service-dependent skip. The full 609-test pass preceded later UX changes; a subsequent full run failed during recovery waiting. **Do not claim the current whole suite is green.**

**Not inspected:** the user's authenticated browser session. No login, transfer, recovery, forced outage or adversarial transaction was performed by this audit. A screenshot or a textual safety statement alone is not a live security proof.

## Warning visibility: what an ordinary successful demo will not show

“Not normal” means **a special input, state, or failure is required**, not a measured claim about real-world frequency. A missing warning implementation is different from a working warning that simply has not been triggered.

| Warning / proof | How it becomes visible | Current limitation / safe demonstration |
|---|---|---|
| Partner + Swissquote cannot recover without the card | Requires deliberately exercising the invalid signer combination | Active Demo lab is explanation-only. Retained contract/script refusals exist; label them as retained proof, not a live button test |
| Old key can no longer spend | Complete recovery while the old key was unlocked on the same wizard page; then use its test control | This is a staged proof path, not what a genuinely new device naturally possesses |
| Large-payment passkey prompt | Enter more than 5 USDC; have sufficient funds and an enrolled passkey | A normal 0.1/1-USDC payment will not show it. Password login is not a substitute; virtual-authenticator/local evidence is not physical hardware proof |
| First-time recipient / look-alike address | New recipient; for look-alike, a stored address with the same first six and last four characters | Not universal warnings. Use test addresses in preview; do not transfer funds merely to show a warning |
| Sanctions / frozen recipient / unavailable screening | A configured blocklisted or frozen subject, or a failed/stale required data source | Ordinary clear recipient shows screening result, not a refusal. Retained coverage-limit warnings exist; do not claim comprehensive compliance |
| Sponsorship denied / budget exhausted | Unsupported action, account/global submission cap, per-transaction gas cap, or other policy refusal | A successful sponsored payment shows fee sponsorship, not denial. No per-wallet daily gas-total feature exists |
| Recovery pending / Stop it | Start a real recovery request, leaving old-owner access available | Not shown while both modules are clear; can change wallet control. Use an isolated test wallet, not the user's active wallet without approval |
| Other-module pending conflict | Both recovery paths have pending state | UI warns/returns rather than automatically cancelling; ordinary both-clear success does not test this hazard |
| Wrong card / stale nonce / mismatched recovery details / wrong mock face | Deliberately inconsistent card, request or mock identity input | Refusal paths are separate from successful recovery; do not paste secrets into reports or the wallet app |
| Swissquote recovery password hold | Use the password fallback without a sufficiently aged reset and mock video step | Current hold is at least 72 hours; passkey login is an alternative. Three-day finalization still cannot fit a short demo |
| Unknown safety state / pending transaction / registration retry | RPC failures/disagreement, receipt delay or interrupted registration | Genuine prior RPC timeouts occurred. Never induce them on the live user session just to make UI appear |
| Recovery notification while the wallet is closed | Would require server watcher/email/push | Not implemented. Open-wallet polling must not be presented as closed-device notification |
| Import-owner-seed exposure warning | The draft expected it when importing an owner seed | No ordinary create-by-import route was found. Opening a kit is different; do not promise this warning appears during normal creation |
| Emergency Kit danger / both file and code compromised | Open/export the kit and read the nearby caution | An informational warning, not a detector of compromise. Keep file and code separate; external Safe signing remains unproved |

## Recommended correction to the demo claim

Say: **“We demonstrate a self-custody Safe wallet with sponsored USDC payments and card-plus-helper recovery. We also have retained transaction and test evidence for specific security properties.”**

Do not say: “Every item in the original plan works end to end,” “the attack screen executes a takeover attempt,” “we support WalletConnect,” “the fallback finishes in five minutes,” or “the current full suite passes.”

Keep the natural successful client journey separate from a labelled **Security proof** segment. Explain which refusals are live, which are retained, and which are only planned. Use the three-minute partner route on stage; treat the three-day Swissquote route as a documented fallback. Adding missing functionality or staging new on-chain proof is a separate implementation task, not something this audit silently performs.

## Detailed clause-by-clause comparison

Each original section is covered below. Quotes preserve the draft's wording; source line numbers refer to the unmodified original reproduced in the appendix. A row marked **CHANGED** may be an intentional later improvement. **WORKS** is scoped to its stated evidence, not an assertion of fresh end-to-end execution. **INTERNAL** is not client-visible; **SPECIAL** requires deliberate navigation/input/state. The appendixed source preserves every word, including historical deadlines and questions.

The candidate root is `.worktrees/v4-ui/swissquote-wallet`. Report links refer to the inspected snapshot; source may change after the audit. All public-chain assets here are testnet assets, not money in a production bank product.

---



---

## Creation, custody, storage and protocol audit

This section compares §§1–3,5–6 and7.1 of the original draft. **Implementation is not the same as ordinary visible experience.** Code references are current-candidate evidence; retained transaction/browser records are historical, not newly replayed here. No user secret storage was opened.

## §§1–2 — custody, network and fixed decisions

| ID | Exact original clause / line | Verdict and client visibility | Evidence |
|---|---|---|---|
| C01 | We build a web wallet in which **only the user's key can move money**. A lost key can be replaced by (original L7) | QUALIFIED. One-owner Safe spending; helpers cannot normally spend. Recovery can replace that owner with the card plus matching helper after delay. A malicious wallet publisher or stolen unlocked key remains a threat. The client sees a custody explanation; that text is not a fresh adversarial proof. | [wallet.ts:37-44](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>); [threat-model.md](<../../Docs/submission/threat-model.md>) |
| C02 | **the user's recovery card plus either the biometric partner or Swissquote**, after a waiting time (original L8) | WORKS under configured rules, with MOCK identity checks. Two independent 2-of-2 modules, card+partner or card+Swissquote. Waiting/cancel visible during recovery, not ordinary clear-wallet home. Retained A recovery/cancellation proof; B finalization not freshly demonstrated. | [wallet.ts:40-44](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L40-L44>); [browser-recovery-v4-2026-10-11.json](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json>); recovery section |
| C03 | during which the old device can cancel. Swissquote and the partner, even together, cannot replace it. (original L9) | Configured contract property supported by retained rejection evidence; not a live active-Demo-lab test. See exact attack distinction in7.5. | [full-2026-10-10T19-28-59Z.json:175-199](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L175-L199>) |
| C04 | The demo, live on Ethereum's Sepolia test network: create wallet → log in and send → lose the device → recover → show that partner + Swissquote alone are refused. (original L11–12) | PARTIAL as one visible story. Core operations have retained public evidence; login happens before creation. Recovery run was resumed across sessions. Last attack action is static explanation in active UI, not live refusal. | Retained public browser records; recovery7.5; [index.tsx:5-21](<../../swissquote-wallet/apps/wallet/src/features/demoLab/index.tsx#L5-L21>) |
| C05 | - **Chain:** Sepolia only, live. Bitcoin and Solana appear in slides only. Bitcoin has tested (original L19) | WORKS for selected live demo; implementation additionally supports a local chain. Current GET-only health confirms11155111, not fresh action execution. | [constants.ts:2-3](<../../swissquote-wallet/packages/protocol/src/constants.ts#L2-L3>); runtime evidence |
| C06 | - **Chain:** Sepolia only, live. Bitcoin and Solana appear in slides only. Bitcoin has tested   evidence from agent 4ccb895d ([bitcoin-taproot-candidate-b.md](<../../Docs/research/bitcoin-taproot-candidate-b.md>)). (original L19–20) | OUTSIDE integrated wallet. Bitcoin research exists; neither chain is an implemented wallet route. Do not infer that both are shown in every pitch just because the draft requested slides. | [bitcoin-taproot-candidate-b.md](<../../Docs/research/bitcoin-taproot-candidate-b.md>); [deck.html](<../../Docs/pitch/v4/deck.html>) |
| C07 | - **Wallet contract:** Safe v1.4.1 (canonical deployment), one owner = the user's key, threshold 1. (original L21) | WORKS. Pinned singleton/factory and one-owner initialization. Visible wallet address/ownership summary; version/threshold mainly technical detail. | [constants.ts:8-13](<../../swissquote-wallet/packages/protocol/src/constants.ts#L8-L13>); [wallet.ts:44](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L44>) |
| C08 | - **Recovery:** two instances of Candide's Social Recovery Module v0.0.1: (original L22) | WORKS in configured protocol, with pinned hashes and domain version. Names/version internal; two paths visible in recovery. | [constants.ts:14-22](<../../swissquote-wallet/packages/protocol/src/constants.ts#L14-L22>); [signing.ts:19-25](<../../swissquote-wallet/packages/protocol/src/signing.ts#L19-L25>) |
| C09 |   - module A: guardians {card R, partner P}, threshold 2, Candide's 3-minute instance; (original L23) | WORKS. Visible partner recovery choice/countdown. Retained public A completion. | [wallet.ts:40](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L40>); [constants.ts:19](<../../swissquote-wallet/packages/protocol/src/constants.ts#L19>) |
| C10 |   - module B: guardians {card R, Swissquote SQ}, threshold 2, our own deployment of the same code     with a 5-minute wait, because Candide deployed only one short-wait instance. (original L24–25) | CHANGED. Guardian rule remains; current B is 259200 seconds (three days), not 300 seconds. A historical five-minute test fixture is not current B. Visible fallback choice/countdown; no short live completion. | [constants.ts:15-22](<../../swissquote-wallet/packages/protocol/src/constants.ts#L15-L22>); [plan-sepolia-copy.test.js:239-249](<../../swissquote-wallet/contracts/test/plan-sepolia-copy.test.js#L239-L249>) |
| C11 |   Tested on a local chain (T8): P + SQ refused on both; R + P and R + SQ succeed after the wait. (original L26) | Historical test assertion supported by retained test sources; no full fresh rerun in this audit. Local test pass is not current public B completion. Internal proof unless presenter opens evidence. | [local-chain.test.ts:128-134](<../../swissquote-wallet/tests/integration/local-chain.test.ts#L128-L134>); [plan-sepolia-copy.test.js](<../../swissquote-wallet/contracts/test/plan-sepolia-copy.test.js>) |
| C12 | - **No contract code of our own**, except deploying an unmodified copy of module v0.0.1. (original L27) | Application deployment follows pinned Safe/Candide code; repository also has test/adversarial fixtures. Do not interpret fixture contracts as deployed product logic. Internal provenance, not ordinary client step. | [PROVENANCE.md](<../../swissquote-wallet/contracts/PROVENANCE.md>); [verification.ts:44-61](<../../swissquote-wallet/packages/protocol/src/verification.ts#L44-L61>) |
| C13 | - **No cryptography of our own.** Libraries: viem, @scure/bip39 and @scure/bip32, WebCrypto,   @simplewebauthn, Safe protocol-kit (optional helper), Candide abstractionkit (optional helper), (original L28–29) | WORKS as primitive selection. Application-specific protocol/serialization and validation are still our code, not an independent security audit. Users experience signing/encryption, not library names. | [package.json:8](<../../swissquote-wallet/packages/protocol/package.json#L8>); [crypto.ts:1-6,33-49](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L1-L6>); payment/service sources |
| C14 |   @simplewebauthn, Safe protocol-kit (optional helper), Candide abstractionkit (optional helper),   @reown/walletkit. (original L29–30) | Optional helpers are not acceptance requirements; abstractionkit provenance exists. Reown WalletKit is absent, and unlike optional helpers this removes the requested7.7 integration. | [PROVENANCE.md](<../../swissquote-wallet/contracts/PROVENANCE.md>); payments7.7 |
| C15 | - **Fees:** a Swissquote relayer key with Sepolia ETH submits every transaction. It submits only (original L31) | QUALIFIED. Normal app sends use sponsored submission, with retained zero-owner/wallet-ETH proof. It is not literally every transaction: account funding uses separate account sender; emergency exit can use another funded sender. Client sees sponsorship copy on home/review. | [browser-service-2026-10-11.json](<../../swissquote-wallet/evidence/sepolia/browser-service-2026-10-11.json>); [chain.ts:64-72](<../../swissquote-wallet/services/swissquote/src/chain.ts#L64-L72>) |
| C16 | - **Fees:** a Swissquote relayer key with Sepolia ETH submits every transaction. It submits only   transactions already signed by the user's key (or guardian approvals), so it cannot change them. (original L31–32) | QUALIFIED. Spending uses owner-signed Safe transaction; recovery initiation guardian signatures. Deployment needs no existing owner transaction signature, and mature finalization is permissionless. Signed payload cannot be changed into a different approved payload; relayer can refuse/delay. Internal security property, downstream visible receipt. | [signing.ts:6-17,19-45](<../../swissquote-wallet/packages/protocol/src/signing.ts#L6-L17>); [app.ts:160-196,215-231](<../../swissquote-wallet/services/swissquote/src/app.ts#L160-L196>) |
| C17 | - **Login** proves who the client is to Swissquote. It never moves money. (original L33) | WORKS in intended separation. Session permits service requests, not on-chain owner signature. Device passphrase distinct from account password/passkey. Ordinary login visible; independence requires explanation or deliberate refusal test. | [App.tsx:252-296](<../../swissquote-wallet/apps/wallet/src/App.tsx#L252-L296>); [storage.ts:78-80](<../../swissquote-wallet/apps/wallet/src/storage.ts#L78-L80>) |

## §3 — each component and what it stores

| ID | Exact original clause / line | Verdict and client visibility | Evidence |
|---|---|---|---|
| C18 | \| Wallet app \| React + Vite, `localhost:5173` \| User's seed, encrypted in IndexedDB \| Card, partner key, SQ key \| (original L39) | WORKS with port changed to5273. Device record stores encrypted seed plus public metadata; unlocked seed exists transiently in memory. Wallet accepts card public address, not card words; no helper private keys in device schema. At-rest/source design, not proof against malicious served JS. | [storage.ts:4-20,41-45](<../../swissquote-wallet/apps/wallet/src/storage.ts#L4-L20>); [App.tsx:307-324](<../../swissquote-wallet/apps/wallet/src/App.tsx#L307-L324>); [sepolia-demo.mjs:14](<../../swissquote-wallet/sepolia-demo.mjs#L14>) |
| C19 | \| Recovery tool \| Static page, `localhost:5174` (separate origin) \| Nothing \| Anything (card typed in, used once, forgotten) \| (original L40) | PARTIAL/CHANGED port5274. Separate browser origin and no persistent secret store. Card words are shown/kept in page memory during generation; clipboard/print are explicit user actions. Input is cleared after checks/signing and on hiding page. Therefore not literal instant forgetting or single view. Same project publisher, not independent audited publisher. | [main.ts:12-16,49-63,75-82,107-131](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L12-L16>); [sepolia-demo.mjs:14](<../../swissquote-wallet/sepolia-demo.mjs#L14>) |
| C20 | \| Swissquote service \| Node + SQLite, `localhost:4001` \| Account, passkey public key, mock KYC flag, wallet address, SQ guardian key per user (mock HSM), relayer key \| Seed, card, partner key \| (original L41) | Configured design matches, port4101. Relayer private key is runtime configuration, not a client-visible bank feature. Database contents/secrets were not opened in this audit. MOCK flag visible; data custody requires source/architecture explanation. | [app.ts](<../../swissquote-wallet/services/swissquote/src/app.ts>); [main.ts](<../../swissquote-wallet/services/swissquote/src/main.ts>); [sepolia-demo.mjs:47-53](<../../swissquote-wallet/sepolia-demo.mjs#L47-L53>) |
| C21 | \| Partner service \| Node + SQLite, `localhost:4002`, separate process \| Mock biometric template, user reference, P guardian key per user (mock HSM) \| Seed, card, SQ key, Swissquote account data \| (original L42) | PARTIAL/CHANGED port4102. Stores mock-face digest and guardian key; does not take shared random userRef/account identity. Separate process/store; no actual biometric verification. API rejects unexpected account/secret fields. Source design, not secret-database attestation. | [service.ts:28-32,43-60](<../../swissquote-wallet/services/partner/src/service.ts#L28-L32>); [storage.ts](<../../swissquote-wallet/services/partner/src/storage.ts>); [sepolia-demo.mjs:49-53](<../../swissquote-wallet/sepolia-demo.mjs#L49-L53>) |
| C22 | \| Chain \| Sepolia \| Safe wallet, modules A and B, guardians \| Secrets \| (original L43) | WORKS for intended calldata/state: public addresses, signatures, setup; no mnemonic in transaction format. Addresses/signatures are public, not secret words. Client sees explorer links; storage internals are not ordinary UI. | [wallet.ts:37-54](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L54>); [signing.ts:44-45](<../../swissquote-wallet/packages/protocol/src/signing.ts#L44-L45>) |
| C23 | The brief requires mocked key holders to be separate processes with their own storage; the two services satisfy that. Anything mocked is labelled "MOCK" in the UI and in the architecture diagram. (original L45–46) | WORKS in supported launcher: separate Swissquote and partner child services/stores. Not independent organizations, hosts or audited HSMs. Visible architecture/MOCK labels, not obvious merely from using the wallet. | [sepolia-demo.mjs:49-53](<../../swissquote-wallet/sepolia-demo.mjs#L49-L53>); [architecture.md](<../../Docs/submission/architecture.md>) |
| C24 | services satisfy that. Anything mocked is labelled "MOCK" in the UI and in the architecture diagram. (original L46) | PARTIAL evidence, not blanket attestation of every string. Identity/button/face fields and architecture label mocks; service health says mock=true. Gas sponsorship and Sepolia receipts are real testnet operations, not real bank integration. No exhaustive every-screen visual replay here. | [App.tsx:303-304,524](<../../swissquote-wallet/apps/wallet/src/App.tsx#L303-L304>); [architecture.html](<../../Docs/submission/architecture.html>); current runtime health |

## §§5–6 — contract addresses and exact protocol

| ID | Exact original clause / line | Verdict and client visibility | Evidence |
|---|---|---|---|
| C25 | ## 5. Contracts on Sepolia (chain id 11155111) Checked on Sepolia today with `eth_getCode` (all have code): (original L64; L66) | Chain configured/live health confirms11155111. The quoted code-read assertion is historical; this audit did not freshly fetch every contract's code. Pinned code hashes and retained deployed transactions are distinct evidence. | [constants.ts:2,24-34](<../../swissquote-wallet/packages/protocol/src/constants.ts#L2>) |
| C26 |  (original L2) | MATCH. Exact address pinned; underlying bytecode checked by verification path. Internal technical detail, not an ordinary user action. | [constants.ts:8,25](<../../swissquote-wallet/packages/protocol/src/constants.ts#L8>) |
| C27 | \| SafeProxyFactory v1.4.1 \| `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` \| (original L71) | MATCH; same evidence/visibility boundary. | [constants.ts:9,26](<../../swissquote-wallet/packages/protocol/src/constants.ts#L9>) |
| C28 | \| CompatibilityFallbackHandler v1.4.1 \| `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` \| (original L72) | MATCH; same boundary. | [constants.ts:10,27](<../../swissquote-wallet/packages/protocol/src/constants.ts#L10>) |
| C29 | \| MultiSendCallOnly v1.4.1 \| `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` \| (original L73) | MATCH. Deployed creation additionally uses ordinary MultiSend for the atomic initializer. Call-only remains for later safe batching. | [constants.ts:11-12,28-29](<../../swissquote-wallet/packages/protocol/src/constants.ts#L11-L12>); [wallet.ts:43-44,61](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L43-L44>) |
| C30 | \| SafeModuleSetup v0.3.0 \| `0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47` \| (original L74) | MATCH; internal pin/check. | [constants.ts:13,30](<../../swissquote-wallet/packages/protocol/src/constants.ts#L13>) |
| C31 | \| Module A: Candide recovery, 3 minutes \| `0x949d01d424bE050D09C16025dd007CB59b3A8c66` (on-chain `VERSION()` = "0.0.1") \| (original L75) | Address/wait/domain MATCH. No fresh VERSION call in this audit; pinned hash/test provenance support intended version. | [constants.ts:14,19,21](<../../swissquote-wallet/packages/protocol/src/constants.ts#L14>); [signing.ts:22](<../../swissquote-wallet/packages/protocol/src/signing.ts#L22>) |
| C32 | \| Module B: our copy of v0.0.1, 5 minutes \| deployed in M0 \| (original L76) | CHANGED. B pinned at0x38275826E1933303E508433dD5f289315Da2541c with three-day wait. Historical M0 schedule not re-attested. | [constants.ts:15,19,22](<../../swissquote-wallet/packages/protocol/src/constants.ts#L15>) |
| C33 | Candide's current main branch is version 0.2.0. We use **0.0.1**, the version actually deployed. Its (original L78) | Upstream-main claim is historical/not freshly researched. Implemented recovery domain is0.0.1 and provenance concerns deployed version; do not present this as current upstream research. | [signing.ts:22](<../../swissquote-wallet/packages/protocol/src/signing.ts#L22>); [PROVENANCE.md](<../../swissquote-wallet/contracts/PROVENANCE.md>) |
| C34 | EIP-712 domain is name "Social Recovery Module", version "0.0.1"; the signed type is `ExecuteRecovery(address wallet,address[] newOwners,uint256 newThreshold,uint256 nonce)`. (original L79–80) | MATCH. Domain additionally chainId+module verifyingContract; exact field order/types in signing code. Internal cryptographic detail; wallet/Desk preview shows its meaning, not raw schema by default. | [signing.ts:19-25](<../../swissquote-wallet/packages/protocol/src/signing.ts#L19-L25>) |
| C35 | **Guardian statement** (returned by partner and Swissquote at enrollment), signed with EIP-712 by the party's statement key. The app has each party's statement-key address built in. (original L84–85) | MISSING. Neither enrollment response is this signed attestation and no pinned statement-verification step exists. No visible statement-validation result. This is not fixed merely by signed recovery approvals, a different message. | [App.tsx:322-324](<../../swissquote-wallet/apps/wallet/src/App.tsx#L322-L324>); [service.ts:49-60](<../../swissquote-wallet/services/partner/src/service.ts#L49-L60>); paymentsS8/S19 |
| C36 | GuardianStatement { party: "partner" \| "swissquote", userRef: bytes32,                     guardian: address, chainId: uint256, issuedAt: uint256 } (original L88–89) | MISSING as requested schema/signature. Current enrollment delivers guardian addresses and service-specific metadata. Neither UI nor retained receipt proves the absent statement protocol. | Same enrollment sources |
| C37 | `userRef` is a random 32-byte value the app creates at onboarding. It links the user's records at the partner and at Swissquote without sharing personal data between them. (original L92–93) | CHANGED. App submits mockFace to partner and separate authenticated enrollment to Swissquote; no shared app-generated32-byte link. Partner uses face digest/on-chain guardian matching instead. Privacy rationale may improve separation, but it is not the draft protocol. | [App.tsx:322-324](<../../swissquote-wallet/apps/wallet/src/App.tsx#L322-L324>); [service.ts:43-60,75-80](<../../swissquote-wallet/services/partner/src/service.ts#L43-L60>) |
| C38 | **Recovery approval:** a guardian's ECDSA signature over the module's recovery hash for `(wallet, [newOwner], 1, nonce)`. The signer checks that its locally computed EIP-712 hash equals (original L95–96) | MATCH. Visible preview/approval code; signature internals hidden. Retained A start proves use, not all helper paths freshly exercised. | [signing.ts:19-30](<../../swissquote-wallet/packages/protocol/src/signing.ts#L19-L30>); recovery evidence |
| C39 | `(wallet, [newOwner], 1, nonce)`. The signer checks that its locally computed EIP-712 hash equals the module's on-chain `getRecoveryHash`. Signatures are sorted by signer address before submission. (original L96–97) | MATCH. Also checks chain/nonce. Refusals require mismatch or unavailable chain; successful flow does not expose failure text. | [signing.ts:36-42](<../../swissquote-wallet/packages/protocol/src/signing.ts#L36-L42>); [service.ts:72-87](<../../swissquote-wallet/services/partner/src/service.ts#L72-L87>) |
| C40 | the module's on-chain `getRecoveryHash`. Signatures are sorted by signer address before submission. (original L97) | MATCH. Internal; no dedicated client-visible step. Duplicate approvals rejected. | [signing.ts:32-45](<../../swissquote-wallet/packages/protocol/src/signing.ts#L32-L45>) |

## §7.1 — creation, clause by clause

| ID | Exact original clause / line | Verdict and client visibility | Evidence |
|---|---|---|---|
| C41 | 1. Log in to Swissquote (passkey, or password fallback). Press "Mock KYC: verified". (original L103) | WORKS with changed button text/capitalization. Normal sign-in/create flow; KYC explicitly mock. It establishes account state, not live identity verification. | [App.tsx:303-304,514-524](<../../swissquote-wallet/apps/wallet/src/App.tsx#L303-L304>); payment API audit |
| C42 | 2. App creates a 24-word seed (or imports one, with a warning: funds at the seed's ordinary    address are not protected; only funds in the new wallet are). Owner key = path (original L104–105) | PARTIAL. Standard creation generates256-bit BIP39 owner seed. No ordinary seed-import control found in current creation form; the optional parenthesis must not be advertised as a normal supported creation route. Kit opening is not create-by-import. | [crypto.ts:13](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L13>); [App.tsx:307-320,520-525](<../../swissquote-wallet/apps/wallet/src/App.tsx#L307-L320>) |
| C43 |    address are not protected; only funds in the new wallet are). Owner key = path    `m/44'/60'/0'/0/0`. App asks for a device password and stores the seed encrypted (original L105–106) | MATCH. Internal derivation; not a user decision. | [constants.ts:6](<../../swissquote-wallet/packages/protocol/src/constants.ts#L6>); [crypto.ts:15-23](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L15-L23>) |
| C44 |    `m/44'/60'/0'/0/0`. App asks for a device password and stores the seed encrypted    (PBKDF2-SHA256, 600,000 iterations → AES-GCM) in IndexedDB. (original L106–107) | MATCH. Device passphrase input visible; encryption internals aren't. Local record persists encrypted seed; unlocked seed is transiently in memory. Login-password reset does not decrypt it. | [crypto.ts:10,33-54](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L10>); [storage.ts:23-45,78-80](<../../swissquote-wallet/apps/wallet/src/storage.ts#L23-L45>) |
| C45 | 3. App opens the recovery tool (`:5174`). The tool creates the card: 12 BIP-39 words for key R, (original L108) | CHANGED. Client follows separate Desk link at5274. Not automatic controlled popup/return. | [App.tsx:520-525](<../../swissquote-wallet/apps/wallet/src/App.tsx#L520-L525>); [sepolia-demo.mjs:14](<../../swissquote-wallet/sepolia-demo.mjs#L14>) |
| C46 | 3. App opens the recovery tool (`:5174`). The tool creates the card: 12 BIP-39 words for key R,    shown once with a printable page. The tool returns only R's address to the app (original L108–109) | PARTIAL.128-bit BIP39 generation gives12words; printable card exists. Words remain visible in current page until reset/hidden; “shown once” is not literal one-render enforcement. User must deliberately generate/save card. | [crypto.ts:14](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L14>); [main.ts:49-56,107-131](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L49-L56>) |
| C47 |    shown once with a printable page. The tool returns only R's address to the app    (`postMessage` to the pinned app origin). (original L109–110) | CHANGED. Only public guardian address is copied/pasted; no postMessage return. Secret separation preserved by manual transfer, but extra client action remains. | [main.ts:54-55](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L54-L55>); [App.tsx:307,520-525](<../../swissquote-wallet/apps/wallet/src/App.tsx#L307>) |
| C48 | 4. App sends `userRef` to the partner (`POST /enroll`, with a mock selfie and ID number) and to    Swissquote (`POST /guardian/enroll`). Each returns a guardian statement. (original L111–112) | PARTIAL. Both routes called; partner payload ismockFace only, not userRef/selfie+ID. Swissquote uses authenticated account. Ordinary create starts calls behind the scenes; user sees a mock face template in technical details, not real identity capture. | [App.tsx:322-324,524](<../../swissquote-wallet/apps/wallet/src/App.tsx#L322-L324>); [service.ts:49-60](<../../swissquote-wallet/services/partner/src/service.ts#L49-L60>) |
| C49 |    Swissquote (`POST /guardian/enroll`). Each returns a guardian statement. 5. App checks both statements against the built-in statement keys. (original L112–113) | MISSING as specified. Usable guardian addresses returned, not signed statements. No visible or internal statement-key-verification step. | Same enrollment sources; C35–C36 |
| C50 | 6. App builds the Safe setup call itself: owners [owner], threshold 1, (original L114) | MATCH. Internal setup builder; client sees outcome. | [wallet.ts:37-44](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L44>) |
| C51 |    `to` = SafeModuleSetup, `data` = `enableModules([A, B])`, fallback handler = the address above,    payment 0. It computes the wallet address from factory, singleton, setup call and salt. (original L115–116) | CHANGED structure, equivalent target state plus atomic guardians. Top-level setup target is ordinary MultiSend; first nested delegatecall is SafeModuleSetup.enableModules; then four guardian calls. Fallback/payment match. Not literal original calldata. | [wallet.ts:39-44](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L39-L44>) |
| C52 |    payment 0. It computes the wallet address from factory, singleton, setup call and salt. (original L116) | MATCH. CREATE2 derivation includes initializer hash,nonce,proxy creation code+singleton. Internal; wallet public address visible. | [wallet.ts:46-50](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L46-L50>); [App.tsx:325-329](<../../swissquote-wallet/apps/wallet/src/App.tsx#L325-L329>) |
| C53 | 7. Swissquote relayer deploys (`createProxyWithNonce`). (original L117) | MATCH with retained live sponsored deploy receipts. Current path posts predicted setup to relay. | [wallet.ts:52-54](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L52-L54>); [App.tsx:327-330](<../../swissquote-wallet/apps/wallet/src/App.tsx#L327-L330>); [browser-service-2026-10-11.json](<../../swissquote-wallet/evidence/sepolia/browser-service-2026-10-11.json>) |
| C54 | 8. App signs one Safe transaction: MultiSendCallOnly with    `A.addGuardianWithThreshold(wallet, R, 1)`, `A.addGuardianWithThreshold(wallet, P, 2)`,    `B.addGuardianWithThreshold(wallet, R, 1)`, `B.addGuardianWithThreshold(wallet, SQ, 2)`.    Relayer submits it. (original L118–121) | CHANGED. Same resulting per-module guardian thresholds installed atomically inside deployment initializer, not a second owner-signed transaction. Actual ABI calls omit wallet argument because wallet ismsg.sender. No separate visible signing prompt for this draft step. | [wallet.ts:39-44](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L39-L44>); [App.tsx:327-341](<../../swissquote-wallet/apps/wallet/src/App.tsx#L327-L341>) |
| C55 | 9. App verifies through a public RPC (not Swissquote's): deployed address equals the computed (original L122) | CHANGED visible allocation. Wallet/service registration performs chain checks; strongest independent card+setup/current-owner comparison is a separate Desk action using two public endpoints. User must open it, supply inputs and acknowledge green result. A persisted checkbox is not automated independent verification. | [main.ts:57-63](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L57-L63>); [verification.ts:110-125](<../../swissquote-wallet/packages/protocol/src/verification.ts#L110-L125>); [App.tsx:191-196,343](<../../swissquote-wallet/apps/wallet/src/App.tsx#L191-L196>) |
| C56 | 9. App verifies through a public RPC (not Swissquote's): deployed address equals the computed    address; owners = [owner]; threshold 1; guards none; A and B guardians and thresholds as    expected; no pending recovery. **The address comparison is mandatory**: T9 showed that a (original L122–124) | MATCH as verification rules; visible aggregate green/error, not six automatic step screens. Current-owner expectation is separate from original initializer after rotation. | [verification.ts:50-76](<../../swissquote-wallet/packages/protocol/src/verification.ts#L50-L76>) |
| C57 |    expected; no pending recovery. **The address comparison is mandatory**: T9 showed that a    malicious setup can plant a hidden owner that the read-back does not reveal. (original L124–125) | MATCH design constraint. Deterministic comparison + proxy/dependency hashes and state/history checks included. Warning requires tampered setup/state; normal green result does not reproduce T9 attack. | [App.tsx:328-329](<../../swissquote-wallet/apps/wallet/src/App.tsx#L328-L329>); [verification.ts:44-76,78-105](<../../swissquote-wallet/packages/protocol/src/verification.ts#L44-L76>) |
| C58 | 10. App creates the emergency kit (7.6) and asks the user to download it. (original L126) | WORKS after successful registration; download/acknowledgement is a real client action, not automatic proof the user stored it safely. Full kit nuances in7.6. | [App.tsx:339-343](<../../swissquote-wallet/apps/wallet/src/App.tsx#L339-L343>); [index.tsx:62-80](<../../swissquote-wallet/apps/wallet/src/features/settings/index.tsx#L62-L80>); retained browser-kit evidence |

**Quotation note:** Requirement cells reproduce the complete cited source lines, joining line wraps only. Original formatting and line breaks remain exact in the appendix. Some adjacent rows repeat overlapping source lines so no clause is lost.

**Normal creation experience:** sign in, explicitly mark MOCK identity verified, generate/save a card in the separate Desk, paste its public address, enter a device passphrase and create; then separately check setup and export/save kit. Current flow does not make signed statements, automatic postMessage return or a live attacker-refusal screen appear just by following creation.


---

## Payments, dApps and service API audit

Daily payments exist and have retained Sepolia execution evidence. They do **not** match the draft literally: normal payments use USDC, large payments require a passkey rather than a password alternative, quotas count account submissions rather than per-wallet gas, and dApps are built-in DeFi rather than WalletConnect. Receive QR and the specified wallet-status API are missing. Enrollment returns guardian addresses, not signed guardian statements.

## Scope and evidence

Audited current implementation under `/home/dev/Hackaton/SwissquoteTrack/.worktrees/v4-ui/swissquote-wallet` against [the supplied draft](</home/dev/.dsh/attachments/v1/files/2b/2b5d3dafd5a8800211b938bd05e3af18be43a98e631792c6949e1b7bf6f5d5da/swissquote-wallet-build-plan.md>), read in full. Requirement lines below refer to that attachment. Communication protocol read in full first. No app edits, live transactions, credentials, or new persistent services were used.

Labels: **WORKS** matches the atom, with evidence strength stated; **CHANGED** differs materially; **PARTIAL** only partly exists; **MISSING** absent; **UNVERIFIED** lacks relevant empirical verification. Visibility: **ordinary** normal relevant screen; **special** feature flag, exceptional input/state, API client, or error; **none** absent UI. Backend functions are not themselves visible UI.

Fresh check: `node --experimental-test-module-mocks --import tsx --test services/swissquote/test/app.test.ts apps/wallet/src/features/dapps/helpers.test.ts apps/wallet/src/features/dapps/component.test.tsx apps/wallet/test/ui-polish.test.tsx` from implementation root: **20 passed, 0 failed, 0 skipped; exit 0**. Service tests use in-memory SQLite and stub ChainAdapter/WebAuthn (C14:14–19); no real transactions or hardware passkeys. Component tests are local rendering, not browser end-to-end. User-supplied latest **54 pass / 1 skip** wallet result was not rerun and is not proof of each requirement. C10:10's default script omits feature-directory dApp tests; this audit ran those explicitly. C23:9–10 is opt-in local transaction integration; a skip is not transaction evidence.

E1–E3 are retained structured execution artifacts with concrete hashes/checks, **not newly reproduced or independently re-queried** during this audit. They are stronger than README claims; documentation is not a test. E1 records an owner-signed 1 USDC Sepolia payment. E2 records a recovered-owner payment and explicitly says high-value step-up was not tested. E3 records built-in Compound supply, not WalletConnect.

## Source map

C/E identifiers below name the exact actual files; findings give exact line ranges within them.

- **C1** [Pay entry](<../../swissquote-wallet/apps/wallet/src/features/pay/index.tsx>).
- **C2** [Pay review](<../../swissquote-wallet/apps/wallet/src/features/pay/Review.tsx>).
- **C3** [Wallet shell](<../../swissquote-wallet/apps/wallet/src/App.tsx>).
- **C4** [Wallet chain adapter](<../../swissquote-wallet/apps/wallet/src/chain.ts>).
- **C5** [Shared classifier](<../../swissquote-wallet/packages/protocol/src/classifier.ts>).
- **C6** [Shared constants](<../../swissquote-wallet/packages/protocol/src/constants.ts>).
- **C7** [Swissquote API](<../../swissquote-wallet/services/swissquote/src/app.ts>).
- **C8** [Swissquote startup](<../../swissquote-wallet/services/swissquote/src/main.ts>).
- **C9** [Service policy](<../../swissquote-wallet/services/swissquote/src/policy.ts>).
- **C10** [Wallet package manifest](<../../swissquote-wallet/apps/wallet/package.json>).
- **C11** [Built-in dApps](<../../swissquote-wallet/apps/wallet/src/features/dapps/index.tsx>).
- **C12a** [Feature registry](<../../swissquote-wallet/apps/wallet/src/features/index.ts>); **C12b** [flag gate](<../../swissquote-wallet/apps/wallet/src/features/context.ts>).
- **C13** [Protocol signing](<../../swissquote-wallet/packages/protocol/src/signing.ts>).
- **C14** [Mocked service API tests](<../../swissquote-wallet/services/swissquote/test/app.test.ts>).
- **C15** [Partner server](<../../swissquote-wallet/services/partner/src/server.ts>).
- **C16** [Partner service](<../../swissquote-wallet/services/partner/src/service.ts>).
- **C17** [Partner startup](<../../swissquote-wallet/services/partner/src/cli.ts>).
- **C18** [Partner tests](<../../swissquote-wallet/services/partner/test/partner.test.ts>).
- **C19** [Review tests](<../../swissquote-wallet/apps/wallet/test/ui-polish.test.tsx>).
- **C20** [dApp helper tests](<../../swissquote-wallet/apps/wallet/src/features/dapps/helpers.test.ts>).
- **C21** [dApp component tests](<../../swissquote-wallet/apps/wallet/src/features/dapps/component.test.tsx>).
- **C22** [Wallet tests](<../../swissquote-wallet/apps/wallet/test/wallet.test.ts>).
- **C23** [Opt-in local integration](<../../swissquote-wallet/apps/wallet/test/local.integration.test.ts>).
- **E1** [Retained payment evidence](<../../swissquote-wallet/evidence/sepolia/browser-service-2026-10-11.json>).
- **E2** [Retained recovered-owner evidence](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json>).
- **E3** [Retained Compound evidence](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json>).

## 7.2 Daily send — atomic requirements

**D1 — WORKS.** Exact request L130: “Enter recipient and amount”. Actual C1:27–33 accepts recipient and USDC amount; C4:11–25 validates nonzero address and positive amount with six decimals and builds ERC-20 transfer. Visibility **ordinary** Pay; enhanced component needs `payPreview` (C12a:19, C12b:16), base Pay also exists C3:531. Evidence: fresh review/unit checks and retained E1:102–109 amount/recipient. Not an ETH-send form.

**D2 — WORKS.** L130: “plain-language summary”. C1:35–40/C2:31–46 show send/receive amount, recipient, sponsor, balance estimate, screening caveat and expandable details. Visibility **ordinary** after Review. Fresh C19 test “USDC review has four honest rows, exact decimals, unknown balance and real screening distinctions” passed; rendered-component evidence, not a fresh browser click-through.

**D3 — CHANGED.** L130: “if above 0.01 ETH, re-authenticate”. Normal Pay constructs USDC (C4:24–25), threshold **above 5 USDC** (C6:37; C5:48–51; C2:40). Nuance: shared classifier retains `ETH_LIMIT = 10_000_000_000_000_000n` (0.01 ETH), C6:38 and C5:45; native rule was not globally removed, but no ordinary native-send screen. Visibility **special trigger** >5 USDC, native threshold code-level only. Fresh mocked large-payment test C14:29–35 passed. E2:10 explicitly excludes live high-value step-up; hardware/live large-payment behavior remains **UNVERIFIED**.

**D4 — CHANGED.** L130–131: “(passkey or password)”. C3:283–294 obtains hash-bound WebAuthn step-up; C7:179–182 requires single-use token. Password cannot replace it. Device passphrase unlock C3:252–263 is separate, not a payment-approval alternative. Visibility **special trigger** large/admin action, not small payment. Fresh C14:29–35 proves password refusal/hash binding/single use using a stub authenticator, not hardware.

**D5 — WORKS.** L131: “app signs the Safe transaction with the owner key”. C3:271–295 unlocks local owner, verifies current sole owner and nonce around asynchronous steps, then signs; C13:15 uses Safe EIP-712 typed data. Visibility **ordinary** send confirmation, cryptography internal. Evidence: E1:73 owner signature and Safe success; E2:17–19 old-key refusal/new-owner payment. Fresh mocked API test alone does not prove actual signatures.

**D6 — WORKS.** L131: “relayer submits”. C3:296 posts signature to `/relay/safe-tx`; C7:177 validates owner/nonce; C7:194 delegates relay; C7:82–106 simulates, estimates, submits. Visibility **ordinary** pending/confirmed result. Fresh C14:28 observes mock simulate/estimate/send; E1:54–64,73,108–109 retains real sponsor and zero owner/wallet ETH.

**D7 — WORKS.** L131–132: “show the Etherscan link”. C3:511 renders pending Etherscan link; shell activity has transaction links C3:528; C4:28–32 constructs URL. Visibility **ordinary** recorded successful activity; **special trigger** receipt timeout for pending banner. Evidence code plus retained transaction artifacts; link-click not freshly tested. A pending link is not success evidence.

**D8 — WORKS.** L132: “wallet registered”. C7:31 requires verified client ownership; C7:167 applies it to non-protective send; C7:215–258 registration verifies rules/current-owner proof. Visibility **ordinary** ownership status; refusal **special trigger** unregistered/wrong client. Fresh fixture C14:21–28 registers then relays; E1:70 retains EIP-1271 verification. Protective cancellation intentionally differs.

**D9 — WORKS, expanded.** L132: “recipient not on a mock sanctions list”. C9:30–40 checks mock target/decoded recipient; C7:188 strict screening includes call addresses and token freeze subjects; C7:35–36 blocks hits and required stale/unavailable sources. Visibility screening explanation **ordinary** C2:41; refusal/warnings **special triggers** positive hit, freeze, unavailable/stale/limited source. Fresh C14:50 tests decoded-recipient block; E1:94–100 retains live sanctions/freeze clearance and limited-secondary-source warning. Not a warning guaranteed on every payment. Strict mode is configuration-dependent (C9:9; C8:13–20), not proven enabled on an arbitrary current server by source alone.

**D10 — PARTIAL / CHANGED.** L132–133: “daily gas budget per wallet”. C7:72–91 stores daily global **submission count** default 1000 and account **submission count** default 50, plus per-transaction estimated gas cap default 15,000,000. It does not total gas/cost per wallet per day. One-wallet-per-account C7:224 approximates account scope, not gas accounting. Visibility **special trigger** cap exhaustion, not routine warning. Fresh C14:37–42 proves protective bypass, zero-account-budget refusal and gas/simulation refusal, not real repeated daily depletion.

## 7.7 dApps — do not equate built-in DeFi with WalletConnect

**A1 — MISSING.** L181: “Reown WalletKit”. C10:12–18 has no Reown dependency; implementation TypeScript search found no WalletKit/WalletConnect handler. C11 is a local React DeFi panel. Visibility **none** for pairing/session; substitute **special flag** `dapps` (C12a:16/C12b:16). Evidence source/package inspection, no attempted real pairing. Compound success is not WalletKit evidence.

**A2 — MISSING.** L181: “with a project ID from `.env`”. No Reown project-ID consumption found with absent integration. Real environment files/secrets not read. Visibility **none**. Evidence source/import inspection only.

**A3 — MISSING.** L181: “Namespace `eip155:11155111`”. No session namespace negotiation. Built-in Sepolia gate C11:27 and chain selection C4:4 are not namespace declaration. Visibility namespace **none**; substitute network label special-flag screen. Evidence code only.

**A4 — MISSING.** L181: “account = wallet address”. No WalletConnect account advertisement. C11:51–70 internally uses `context.wallet`, correctly the Safe, but not a session account. Visibility **none** for requested flow; evidence code only.

**A5 — MISSING / substitute CHANGED.** L182: “`eth_sendTransaction` goes through the 7.2 confirmation screen”. No incoming JSON-RPC handler. C11:49–78 builds its own pinned actions and preview; C11:81–98 calls shared shell relay. It uses its own DeFi review, not C1 Pay review. Visibility external flow **none**; built-in **special flag** plus Sepolia/session/registry/simulation requirements. Fresh C20/C21 tests and E3:71–79 prove built-in behavior, not external requests.

**A6 — MISSING.** L182–183: “`personal_sign` … return a Safe smart-wallet signature”. No handler or dApp message-consent screen. C13:56–59 signs an internal ownership-proof Safe message only. Visibility **none**. Evidence source search, no external-signing test.

**A7 — MISSING.** L183: “`eth_signTypedData_v4` return a Safe smart-wallet signature”. No arbitrary typed-data handler/consent. C13:15 Safe transaction signing and C13:30 recovery signing are not this JSON-RPC method. Visibility **none**. Evidence code/search; no interoperability test.

**A8 — PARTIAL.** L183–184: “(verified by dApps through the fallback handler)”. Internal Safe message signing C13:56–59 and EIP-1271 registration verification C7:238–249 exist; E1:70 retains proof. No external dApp verifies the missing personal_sign/typed-data outputs. Visibility **none** requested flow. Evidence internal proof, not external-dApp interoperability.

**A9 — CHANGED.** L184: “Only dApps on a small approved list may connect.” C11:38–43 checks pinned registry; C7:37,119–126 validates exact built-in calls. No peer/origin/session connection allowlist. Visibility built-in **special flag**; connect UI **none**. Fresh registry/batch tests passed; E3 proves one Compound operation. Contract allowlisting is not WalletConnect peer allowlisting.

## 8 Service APIs — every route and behavior

**S0 — WORKS, code only.** L188: “Swissquote service (`:4001`)”. C8:21 defaults 4001 with PORT/SQ_PORT overrides. Visibility **none**; no fresh listener probe.

**S1 — CHANGED.** L190: “`POST /auth/register/options`”. Actual `/auth/passkey/register/options`, C7:199–203; requires authenticated account, later enrollment requires passkey login. Visibility **ordinary** Create-with-passkey/Settings. Fresh C14:30 actual route with mock authenticator; E1:69 retains service-verified virtual authenticator. Planned alias absent.

**S2 — CHANGED.** L190: “`/auth/register/verify`”. Actual `/auth/passkey/register/verify`, C7:204 stores credential and issues session. Visibility **ordinary** enrollment. Same fresh C14:30 and retained virtual-authenticator evidence; exact alias absent.

**S3 — CHANGED.** L190: “`/auth/login/options`”. Actual `/auth/passkey/login/options`, C7:154–158. Visibility **ordinary** passkey sign-in with enrolled email. Evidence code; no fresh browser login ceremony. Alias absent.

**S4 — CHANGED.** L190: “`/auth/login/verify`”. Actual `/auth/passkey/login/verify`, C7:159; consumes challenge, verifies and updates counter. Visibility **ordinary** passkey sign-in. Evidence code, not fresh hardware/browser proof. Alias absent.

**S5 — WORKS.** L191: “`POST /auth/password/register`”. C7:128–134 creates account/session; C3:223,231 calls it. Visibility **ordinary** registration. Fresh C14:21 and retained E1:69.

**S6 — WORKS.** L191: “`/auth/password/login`”. C7:135–139 validates password; C3:231 calls. Visibility **ordinary** login. Fresh C14:46–48 and retained E2:14. Login alone does not authorize high-value payments.

**S7 — WORKS, MOCK.** L192: “`POST /kyc/mock-verify`”. C7:211 sets KYC only when mocks enabled and rejects configured mock-name hits. Visibility **ordinary** onboarding, refusal **special trigger** mock hit. Fresh C14:22 and retained E1:6,69. No real identity verification implied.

**S8 — PARTIAL.** L193: “`POST /guardian/enroll` → guardian statement”. Route C7:213 requires KYC and returns guardian/address/userRef/mock label; **no signed GuardianStatement, issuedAt or statement-key verification**. Draft L84–90 defines a signed EIP-712 statement, not plain JSON address. Visibility **ordinary** onboarding; response internal. Fresh C14:22 proves usable address response, not statement signature.

**S9 — WORKS.** L194: “`POST /wallets` → register wallet address for the logged-in user”. C7:198,215–258 requires login/KYC, exact setup and current-owner proof. Visibility **ordinary** onboarding/recovery; interrupted registration warning **special** C3:536. Fresh C14:23 and retained E1:70. Warning not expected on uninterrupted success.

**S10 — WORKS.** L195: “`POST /relay/deploy`”. C7:215–231 checks predicted setup, reserves one deployment and relays. Visibility **ordinary** onboarding. E1:14–15,28–38 retained real receipt; fresh C14:40 tests exhausted-budget refusal rather than chain deployment.

**S11 — WORKS.** L195: “`/relay/safe-tx`”. C7:162–196 validates and submits; C3:296 calls. Visibility **ordinary** Pay, failures special. Fresh C14:28–35 and retained E1/E2 payments.

**S12 — WORKS.** L195: “`/relay/recovery`”. C7:272–274 accepts/sorts unique signers, hashes and relays request. Visibility **special** recovery. E2:34–41 retains card-plus-partner initiation; no new transaction.

**S13 — WORKS.** L195: “`/relay/finalize`”. C7:160–161 allows no-login finalization, checks known module, relays protective operation. Visibility **special** mature recovery. Fresh C14:37–42 mocked finalize; E2:44–51 retained real finalize.

**S14 — WORKS route/signature, live B UNVERIFIED.** L196: “`POST /recovery/approve` → SQ's approval signature for module B”. C7:272–277 pins B, verifies guardian membership/hash and signs. Visibility **special** SQ recovery. Fresh C14:47–48 mocked approval. E2 uses A, so not live module-B evidence.

**S15 — CHANGED.** L196: “(after login + mock KYC re-check)”. C7:273 checks login and stored KYC, **not a fresh recovery-bound re-check**. C7:276 instead requires passkey login, or password reset at least 72 hours ago plus mock video-ID flag. Visibility **special** SQ recovery; hold refusal triggered by unsatisfied password path. Fresh C14:44–48 proves mocked hold, not fresh KYC.

**S16 — MISSING.** L197: “`GET /wallets/:address/status`”. C7:260 only has `/wallets/<address>` metadata; suffix parsing as address means `/status` is not an alias. Alternative C4:72–83 reads public RPC directly. Visibility requested route **none**, alternative recovery UI special. Evidence code, no request sent.

**S17 — CHANGED alternative.** L197: “pending requests on A and B, with time left; alerts”. C4:72–83 reads both modules at common block from two nodes; C4:85–89 computes remaining time; C3:511–513 renders uncertainty/recovery alerts. Not returned by specified API. Visibility **special triggers** pending recovery or failed/disagreeing RPC; not normal clear-wallet warning. E2:12–20 retained module checks; fresh C19 countdown check is local rendering, not API proof.

**S18 — WORKS, code only.** L199: “Partner service (`:4002`)”. C17:2–6 default 4002, configurable separate runtime. Visibility **none**; no fresh listener probe.

**S19 — PARTIAL.** L201: “`POST /enroll` → guardian statement”. C15:39–42 routes; C16:49–60 accepts mockFace, returns `{ guardian }`; no signed statement or shared userRef. Visibility **ordinary** onboarding; response internal. C18:30 idempotent enrollment test exists, not rerun; E2 proves later guardian use, not signed statement.

**S20 — WORKS.** L202: “`POST /recovery/approve` → P's approval signature for module A”. C15:39–42/C16:62–93 pin A, validate guardian set, threshold, chain, nonce/hash then sign. Visibility **special** partner recovery. E2:34–41 real retained recovery start; C18:36–53 tests exist, not freshly run.

**S21 — WORKS, MOCK.** L202: “(after mock face match)”. C16:64,75–80 selects enrolled partner from on-chain guardian set and compares digest before signing. Visibility **special** recovery; mismatch warning only with mismatched mock input. C18:41,47 refusal tests exist; E2:7 explicitly labels mock identity. No actual biometric proof.

## M2 receive QR and acceptance

**M1 — MISSING.** L212: “receive with QR”. Home offers Copy wallet address C3:518; no receive view, QR renderer/generator or QR test found in wallet source. C10:12–18 also lacks QR dependency (source/UI absence is decisive, not dependency absence alone). Visibility QR **none**, address copy **ordinary**. Evidence source/search only. Copyable address is not a scannable QR.

**M2 — WORKS historically, current end-to-end UNVERIFIED.** L212: “Real Sepolia transfer from the UI”. E1:67–74 and E2:18–19 retain explicit UI/payment checks with receipts E1:54–64/E2:54–61. Current source preserves signing/relay/receipt validation. No new transaction authorized or attempted; every current UI branch and latest copy changes were not freshly reproduced.

## Visibility corrections and rare-warning triggers

Sponsorship is **visible** on home C3:518 and Pay C1:29, and review C2:36. Independent-check acknowledgement is **persisted**, not session-only: C3:193 and C3:526–527 save/label browser-wallet-owner-network scope. It is a user acknowledgement, not automatic independent verification.

Do not present warnings as normal screens without triggers. Look-alike requires a different stored recipient sharing first six/last four characters (C1:20,38). First-time confirmation requires recipient absent from local history (C1:19,39–40). Passkey prompt requires large/admin classification. Not-sponsored appears on refused classification (C2:29,36). Pending banner requires timeout/RPC receipt failure (C4:52–55). Unknown recovery requires RPC failure/disagreement (C4:73–83/C3:511). Registration warning requires failed/interrupted registration (C3:536). Quota/gas refusal requires limit exhaustion. Screening limitation warning requires source coverage/availability limitation. None is established here as routinely observed on a successful small-payment path.

## Conclusion

Describe the implementation as **owner-signed sponsored USDC payments, passkey-only large-payment approval, and built-in allow-listed DeFi**. Do not claim WalletConnect pairing, arbitrary dApp message signing, signed enrollment statements, per-wallet daily gas accounting, the specified status API, or receive QR. The main issue is missing integration/specification drift, not absence of a working payment path.

Only this report was written. All fresh execution used mock chain/auth adapters; retained evidence was read without submitting transactions.



---

## Recovery, cancellation, attack demo, kit and risk audit

**Main gaps:** the active Demo lab is explanation only, not the planned partner + Swissquote contract attack; Swissquote has no server recovery watcher/email notification; external MetaMask/Safe{Wallet} kit interoperability is not demonstrated. Recovery and cancellation do have executable implementations and retained demonstrations. A second pending module is detected but requires manual cancellation. The old-key refusal button requires an unusually retained unlocked old key, not the literal lost-device path.

## Scope and evidence standard

Read the communication protocol in full first. Audited current source and retained evidence only; no app/runtime edits, transactions, secrets, user databases, or fresh test executions. Only this report was written. Source establishes the click path, not a claim that this auditor operated the live browser. Test source establishes assertions, not a fresh pass. Retained reports are historical demonstrations, not current chain state.

Source requirement quotes below are verbatim from [attached build plan](</home/dev/.dsh/attachments/v1/files/2b/2b5d3dafd5a8800211b938bd05e3af18be43a98e631792c6949e1b7bf6f5d5da/swissquote-wallet-build-plan.md#L135-L177>); risk quotes from [section 11](</home/dev/.dsh/attachments/v1/files/2b/2b5d3dafd5a8800211b938bd05e3af18be43a98e631792c6949e1b7bf6f5d5da/swissquote-wallet-build-plan.md#L226-L235>). Labels below distinguish implementation, ordinary visibility and prior demonstration per clause.

### Active path and historical proof

The supported [Sepolia launcher:35–44](<../../swissquote-wallet/sepolia-demo.mjs#L35-L44>) enables recoveryWizard/audit/protection; [feature registry:14–22](<../../swissquote-wallet/apps/wallet/src/features/index.ts#L14-L22>) selects the new recovery, settings and DemoLab components. [Feature gating:16](<../../swissquote-wallet/apps/wallet/src/features/context.ts#L16>) is build-environment dependent. This audits the supported launcher, not an uninspected running process environment. Legacy App fallback functions are not evidence that an active feature invokes them.

[Public browser record:12–20,89–99](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L12-L20>) records normal password login, resumed encrypted replacement, actual downloaded/decrypted kit, real old-key GS026 call, finalize and new-owner payment. It expressly spans retained browser sessions after timeouts, not one uninterrupted take. [Older public script:124–200](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L124-L200>) records both-module initiation/cancel and helper-together rejection; [its later steps:217–282](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L217-L282>) record wait, finalize, old-key refusal and RPC-only kit sweep. These are separate evidence levels, not interchangeable UI demonstrations.

## 7.3 Recovery — atomic requirements

### 1a. Password login

**Quote L137:** “New device: log in with password (the old passkey is gone with the device).”

**Implemented; ordinary path; prior demonstrated.** Sign-in has password form [App:514](<../../swissquote-wallet/apps/wallet/src/App.tsx#L514>); wizard requires session, not old passkey [wizard:46–49](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L46-L49>). Click path: sign in → Recover access. [Public record:14–15](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L14-L15>) explicitly records normal password login.

### 1b. Identity re-check

**Quote L137:** “Mock KYC re-check.”

**Partial.** Recovery checks persisted KYC [service:272–276](<../../swissquote-wallet/services/swissquote/src/app.ts#L272-L276>), but wizard starts without a fresh recovery-specific KYC event [wizard:71–86](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L71-L86>). A uses mock face; B offers mock video. Existing true KYC is not a new check. Public evidence labels identity MOCK; no distinct re-check demonstrated.

### 2a. New seed and owner

**Quote L138:** “App creates a new seed; new owner = its key.”

**Implemented; ordinary Prepare new phone; demonstrated.** [Wizard:48–69](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L48-L69>) generates/encrypts/persists before helper requests, derives owner, refuses replacement overwrite for another wallet, and resumes existing encrypted key. [Public record:15](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L15>) confirms unchanged resumed owner.

### 2b. Four-word fingerprint

**Quote L138:** “It shows a 4-word fingerprint of the new address.”

**Changed, not literal compliance in active wallet.** Wallet shows full grouped owner address and comparison checkbox [wizard:172–182](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L172-L182>); Desk displays four words and addresses [Desk:7](<../../swissquote-wallet/apps/recovery-tool/index.html#L7>). Four-word generator exists [crypto:25–28](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L25-L28>). Ordinary path can compare full addresses, but active wallet does not present matching four words. No claim of four-word cross-screen demonstration.

### 3a. Default A

**Quote L139:** “App picks module A (card + partner) for the demo.”

**Implemented and demonstrated.** Index defaults zero [wizard:16](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L16>); [module map:4–7](<../../swissquote-wallet/apps/wallet/src/features/recovery/core.ts#L4-L7>) selects A. [Public receipts:34–51](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L34-L51>) record A start/finalize.

### 3b. B fallback

**Quote L139–140:** “Module B is the fallback if the partner is unavailable.”

**Manual option, materially constrained.** Select helper B [wizard:163–165,188](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L163-L165>); no automatic failover. B is now **three days** [module map:4–7](<../../swissquote-wallet/apps/wallet/src/features/recovery/core.ts#L4-L7>), not draft five-minute B. Ordinary password login with `resetAt=null` is refused by B: requires passkey login, or a recorded reset ≥72 hours old plus mock video [service:275–277](<../../swissquote-wallet/services/swissquote/src/app.ts#L275-L277>). Thus selecting B after partner failure does not guarantee immediate approval. [Public script:141–155](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L141-L155>) proves B start, not completed three-day recovery.

### 4a. Tool opened with fragment

**Quote L141–142:** “App opens the recovery tool with wallet, module, new owner, nonce and chain in the URL fragment.”

**Not implemented as specified; manual public-code exchange instead.** [Wizard:177–182](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L177-L182>) says open own saved tool, copy request, paste approval. No recovery window/fragment launch. Desk only handles `#check=` into no-secret rules pane [Desk main:41–48](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L41-L48>). Ordinary flow requires extra manual transfer; intentional separation, not seamless URL workflow.

### 4b. Independent chain/guardian/nonce validation

**Quote L142–143:** “The tool reads the chain itself, confirms the card is a guardian and the nonce is current”

**Implemented.** Desk → Approve a new phone → paste request and card → Review against chain. Two clients check chain, pinned module bytecode, wallet deployment, on-chain recovery hash, nonce and guardian [Desk core:75–95](<../../swissquote-wallet/apps/recovery-tool/src/core.ts#L75-L95>), repeated at sign boundary [Desk core:97–102](<../../swissquote-wallet/apps/recovery-tool/src/core.ts#L97-L102>). Error warnings need wrong chain/stale request/non-guardian input; normal review does not demonstrate those failures. Local browser test source and retained public start support functioning card approval, not every negative case freshly rerun.

### 4c. Approval summary

**Quote L143:** “and shows: "Replace the owner of wallet 0x… with new key 0x… (fingerprint …)".”

**Semantically implemented, different literal copy.** Review displays Replace wallet owner, wallet, new owner, four words and module [Desk:7](<../../swissquote-wallet/apps/recovery-tool/index.html#L7>), populated only after chain review [Desk main:66–72](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L66-L72>). Ordinary review-visible, not failure-only.

### 4d. User comparison/card/confirmation

**Quote L144:** “The user checks the fingerprint, types the card words, and confirms.”

**Implemented with ordering/representation change.** Card typed first for membership review; user then compares addresses/words and explicitly confirms [Desk main:74–81](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L74-L81>). Wallet asks full-address acknowledgement. Human comparison is not automated proof; Desk warns four words cannot defeat malicious wallet UI [Desk:7](<../../swissquote-wallet/apps/recovery-tool/index.html#L7>).

### 4e. Signature-only return

**Quote L144–145:** “The tool signs and returns only the signature.”

**Substantive implementation, manual encoded return.** [Desk core:97–102](<../../swissquote-wallet/apps/recovery-tool/src/core.ts#L97-L102>) returns versioned approval with signer/signature/chain, not seed/card or raw signature alone. [Desk main:75–84](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L75-L84>) clears card words and offers copy. No automatic postMessage return. Ordinary successful approval path.

### 5. Partner approval

**Quote L146:** “App asks the partner to approve (`POST /recovery/approve`, mock selfie). Partner signs.”

**Implemented; mock selector not selfie capture; demonstrated A start.** [Wizard:78–86](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L78-L86>) calls partner, verifies exact request/signer [approval checks:61–75](<../../swissquote-wallet/apps/wallet/src/features/recovery/core.ts#L61-L75>), submits pair. [UI:188](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L188>) offers enrolled/different face. Different-face rejection is explicitly selected staged failure, not ordinary success. [Public receipt:34–42](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L34-L42>) demonstrates A initiation.

### 6a. Exact recovery call

**Quote L147:** “Relayer submits `multiConfirmRecovery(wallet, [newOwner], 1, sorted signatures, true)`.”

**Implemented; prior demonstrated.** Service sorts and rejects duplicates [service:272–274](<../../swissquote-wallet/services/swissquote/src/app.ts#L272-L274>); [encoder:44–45](<../../swissquote-wallet/packages/protocol/src/signing.ts#L44-L45>) supplies exact argument shape. Adapter invokes encoded recovery [chain:63–69](<../../swissquote-wallet/services/swissquote/src/chain.ts#L63-L69>). A browser receipt and both A/B script receipts support actual chain use.

### 6b. Waiting starts

**Quote L148:** “The waiting time starts.”

**Implemented/demonstrated.** UI waits receipt and confirms exact pending new owner on both nodes [wizard:86–91](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L86-L91>). Countdown appears only for pending request and uses block time +15s margin [core:14–20,54–59](<../../swissquote-wallet/apps/wallet/src/features/recovery/core.ts#L54-L59>). [Public wait record:80–87](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L80-L87>) has natural 180-second A wait, no clock manipulation.

### 7a. Server watcher

**Quote L149:** “Swissquote's watcher polls both modules every 15 s and raises an alert.”

**Missing as server feature; browser substitute implemented.** React hook polls every15s while mounted [hook:4–20](<../../swissquote-wallet/apps/wallet/src/features/alert/useRecoveryPoll.ts#L4-L20>), both modules [core:29–52](<../../swissquote-wallet/apps/wallet/src/features/recovery/core.ts#L29-L52>). [Service main:18–22](<../../swissquote-wallet/services/swissquote/src/main.ts#L18-L22>) starts no watcher. Closed/offline old device gets no watcher notification. No retained server monitoring demonstration found; browser polling must not be relabeled server watcher.

### 7b. Old-device alert/cancel

**Quote L149–150:** “The old device shows a banner with a Cancel button.”

**Implemented with open signed-in page/wallet prerequisites.** [App:512](<../../swissquote-wallet/apps/wallet/src/App.tsx#L512>) mounts alert. [Alert:39–51](<../../swissquote-wallet/apps/wallet/src/features/alert/index.tsx#L39-L51>) shows pending and Stop it; clear state ordinarily shows no pending. Trigger is actual pending or poll failure, not permanent warning. [Local browser test:205–219](<../../swissquote-wallet/tests/browser/recovery-complete.test.mjs#L205-L219>) exercises A cancel with B clear; not both pending via browser.

### 7c. Recovery email

**Quote L150:** “A mock email is printed in the service log.”

**Missing for recovery.** Existing mailbox is password reset [service:141–153](<../../swissquote-wallet/services/swissquote/src/app.ts#L141-L153>); recovery route creates no mail [service:272–277](<../../swissquote-wallet/services/swissquote/src/app.ts#L272-L277>). No normal/staged recovery email evidence. Password-reset mailbox does not satisfy recovery notification.

### 8. Finalization

**Quote L151:** “After the wait, relayer calls `finalizeRecovery(wallet)`.”

**Implemented; manual click; demonstrated.** Finish checks matching pending/time, calls service, verifies both-node sole owner + threshold [wizard:106–127](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L106-L127>); adapter calls finalize [chain:69](<../../swissquote-wallet/services/swissquote/src/chain.ts#L69>). [Public receipt:44–52](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L44-L52>) demonstrates. No automatic timer submission.

### 9a. Other-module cancellation before guardian changes

**Quote L152–153:** “New device: if a request is pending on the other module, cancel it **before** changing any guardian (T8 hazard).”

**Partial.** [Wizard:128–135](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L128-L135>) installs replacement, polls, then warns/returns on pending or uncertainty. It does not cancel automatically; requires reload/unlock installed key → global Stop it. No guardian change in finish, so prohibited ordering avoided, but secure completion needs extra user action. Warning only on rare dual-pending or RPC failure, not ordinary A-only path. [Public final state:91–98](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L91-L98>) is both-clear and does not demonstrate this hazard handling.

### 9b. Replacement kit

**Quote L153:** “Then create a new emergency kit.”

**Implemented earlier, with stronger gate.** Download/acknowledge matching new kit before finalization [wizard:93–110,196–202](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L93-L110>). [Public record:16](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L16>) proves downloaded kit/wrong-code rejection/offline decrypt. Durable storage is acknowledgement only.

### 10. Old key refusal

**Quote L154:** “Check shown in the demo: a transaction signed by the old key is rejected (`GS026`).”

**Executable and demonstrated, but specially retained-old-key scenario.** [Wizard:139–145](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L139-L145>) accepts literal GS026 only; generic failure is not success. Old seed captured only when same page already has unlocked old device at preparation [wizard:68](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L68>), cleared on hidden/unmount [wizard:37–44](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L37-L44>). Button rendered only after done and disabled without seed [wizard:203–208](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L203-L208>). True new device lacks seed; unrelated old-device tab does not automatically get done state. Copy saying run on old device is not a proved resumable click path. [Public record:17](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L17>) proves actual refusal in retained unlocked-key setup, not lost-device ordinary flow.

## 7.4 Cancel

**Quote L158–159:** “Old device signs a Safe transaction calling `cancelRecovery()` on the module, and the relayer submits it.”

**Implemented/demonstrated with owner-key prerequisite.** Alert checks current owner, nonce, pending modules, signs/relays cancellation and verifies receipt/two-node clear [alert:15–35](<../../swissquote-wallet/apps/wallet/src/features/alert/index.tsx#L15-L35>), [builder:58–61](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L58-L61>). Login alone cannot cancel. Visible only pending/error; may require device unlock. [Public script:159–173](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L159-L173>) proves both-module cancellation; [browser test:219](<../../swissquote-wallet/tests/browser/recovery-complete.test.mjs#L219>) explicitly says A pending, B only checked clear.

**Quote L159–160:** “Only `cancelRecovery` clears a request; disabling the module or bumping the nonce does not (T10).”

**Correct primitive used; negative variants not ordinary UI demos.** Builder uses cancel, not disable/nonce shortcut. [Integration test:137–150](<../../swissquote-wallet/tests/integration/local-chain.test.ts#L137-L150>) checks both requests clear and captured signatures stale after cancel. That test does not itself demonstrate both negative T10 variants. Plan's T10 citation is not freshly validated evidence. Protective sponsorship not guaranteed: [threat model:25–29](<../../Docs/submission/threat-model.md#L25-L29>) preserves sanctions/fee/outage/congestion limits.

## 7.5 Partner + Swissquote attack demo

**Quote L164:** “A button "Partner and Swissquote try to take the wallet"”

**Absent from active feature.** Demo lab → approval-pair selector → helpers together [DemoLab:5–21](<../../swissquote-wallet/apps/wallet/src/features/demoLab/index.tsx#L5-L21>). No executable attack button.

**Quote L164–165:** “builds `multiConfirmRecovery` with P's and SQ's signatures on each module and runs it as `eth_call` (no gas).”

**Not implemented in active UI.** [Model:1–7](<../../swissquote-wallet/apps/wallet/src/features/demoLab/model.ts#L1-L7>) explicitly says no signature/contract simulation, keys/helper calls/approvals or transactions. Legacy [App:546–561](<../../swissquote-wallet/apps/wallet/src/App.tsx#L546-L561>) has attempted attack logic but active feature replaces it; legacy also requests `thief-face`, allowing helper refusal before contract test. Neither is evidence current click path executes this clause.

**Quote L165:** “The UI shows the revert reason.”

**Missing.** Current output “Card approval still missing” is static scenario copy [model:4](<../../swissquote-wallet/apps/wallet/src/features/demoLab/model.ts#L4>), not observed revert. This is not merely a rare trigger: screen never invokes attack. Its honest evidence-boundary warning is not implementation of the attack.

**Quote L166:** “On module A, SQ is not a guardian; on module B, P is not a guardian.”

**Contract property separately demonstrated.** [Local integration:128–134](<../../swissquote-wallet/tests/integration/local-chain.test.ts#L128-L134>) signs both helpers/each module and requires rejection. [Public script:175–199](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L175-L199>) records each Signer not a guardian refusal. Supports recorded expected configuration, not current UI execution or arbitrary changed wallets.

## 7.6 Emergency kit

**Quote L170:** “A 32-character kit code (160 bits) is shown once.”

**Entropy yes; literal format/show-once no.** [Crypto:56–71](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L56-L71>) generates 20 random bytes, 32 base32 data characters + five checksum characters + hyphens. [Recovery UI:198](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L198>) can hide/show repeatedly within session; [Settings:75–80](<../../swissquote-wallet/apps/wallet/src/features/settings/index.tsx#L75-L80>) displays code during export. Ephemeral export is not single reveal. Ordinary export visible; no special failure required.

**Quote L170:** “The user writes it down.”

**Instruction/acknowledgement, not verifiable storage.** [Settings:75–80](<../../swissquote-wallet/apps/wallet/src/features/settings/index.tsx#L75-L80>) requires download before acknowledgement. Public decrypt proof supports usable downloaded file/code, not paper retention.

**Quote L171:** “The kit file (JSON, plus a printable page)”

**JSON implemented; printable kit not established.** [Settings:10,75–78](<../../swissquote-wallet/apps/wallet/src/features/settings/index.tsx#L10>) downloads JSON. [Desk:5](<../../swissquote-wallet/apps/recovery-tool/index.html#L5>) prints Recovery Card + code stub, not a printable encrypted-kit page. These are different deliverables.

**Quote L171–172:** “holds the seed encrypted with a key derived from the kit code, plus the wallet address, chain, module addresses, derivation path and instructions.”

**Implemented/demonstrated.** [Crypto:33–49,74–96](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L74-L96>) uses PBKDF2-SHA256 600000/AES-GCM, authenticated header, complete metadata and instructions. [Kit tests:62–86](<../../swissquote-wallet/tests/protocol/encryption-kit.test.ts#L62-L86>) test roundtrip/tamper; [public record:16](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L16>) proves actual downloaded decrypt.

**Quote L173:** “The recovery tool has an "Open kit" function: kit file + kit code → seed words.”

**Implemented; ordinary direct Desk tab; demonstrated.** [Desk:4,8](<../../swissquote-wallet/apps/recovery-tool/index.html#L8>), [main:85–105](<../../swissquote-wallet/apps/recovery-tool/src/main.ts#L85-L105>): offline decrypt; separate optional current-owner network check. [Public record:16,20](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L16-L20>) proves both. Wrong-code/stale-owner warnings require explicitly bad inputs or changed state.

**Quote L174–175:** “Instructions if Swissquote disappears: open the kit in the recovery tool, import the seed into any standard wallet (for example MetaMask), open the wallet in Safe{Wallet} on Sepolia, move the funds.”

**Generic instructions and primitive exit yes; external Safe interoperability unproved.** [Desk:8](<../../swissquote-wallet/apps/recovery-tool/index.html#L8>) gives path/standard wallet/Safe instructions; [JSON instructions:83](<../../swissquote-wallet/packages/protocol/src/crypto.ts#L83>) generic. [Script sweep:270–282](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L270-L282>) moved 3 USDC with RPC-only funded submitter, not MetaMask import → Safe{Wallet} UI → external send. No actual service-shutdown or saved-file all-token exit proved; [threat model:29,51](<../../Docs/submission/threat-model.md#L29>) explicitly limits claim. Copy alone cannot establish interoperability.

**Quote L176:** “The owner key needs a little ETH for fees on this path, because our relayer is gone.”

**Gas need conveyed; separate payer is possible.** [Desk:8](<../../swissquote-wallet/apps/recovery-tool/index.html#L8>) says funded gas payer. [Recorded sweep:276–281](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L276-L281>) uses separate FUNDER, no services, so owner EOA itself need not hold ETH. External UI gas-funding path not demonstrated.

**Quote L177:** “Keep the kit file, the kit code and the card apart.”

**Ordinary visible warning.** Prominent [Settings:62–80](<../../swissquote-wallet/apps/wallet/src/features/settings/index.tsx#L62-L80>), [recovery kit:196–198](<../../swissquote-wallet/apps/wallet/src/features/recovery/index.tsx#L196-L198>). Physical separation remains human action, not tested property.

**Quote L177:** “The kit file plus the kit code is the owner key.”

**Implemented and visibly explained with current-owner caveat.** [Desk:8](<../../swissquote-wallet/apps/recovery-tool/index.html#L8>) says reveals recorded owner, controls Safe only while current; [Settings:66](<../../swissquote-wallet/apps/wallet/src/features/settings/index.tsx#L66>) warns combined possession spends. Not rare-failure-only copy. Stale-key rejection is separately triggered.

## 11 Risk controls — every row

### Funding reserve

**Quote L230:** “No Sepolia ETH for the relayer” / “Nothing can be deployed” / “Get it in M0 from two faucets; keep 0.3 ETH minimum”.

**Unproved procurement/reserve control.** [Retained preflight:24–37](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L24-L37>) has treasury ETH 0.0169993861901792 and funder 0.003, below 0.3. Successful recorded deploy proves enough then, not two faucets/ongoing minimum. [Fee caps:10–28](<../../swissquote-wallet/services/swissquote/src/chain.ts#L10-L28>) cap spending, not reserve. No ordinary minimum-balance warning established; current balances intentionally not queried.

### RPC redundancy

**Quote L231:** “Public RPC rate limits” / “Flaky demo” / “Two RPC URLs with fallback”.

**Implemented, with fail-closed recovery qualification.** [Wallet chain:5–9](<../../swissquote-wallet/apps/wallet/src/chain.ts#L5-L9>), [service chain:30–46](<../../swissquote-wallet/services/swissquote/src/chain.ts#L30-L46>) provide fallback; recovery demands two agreeing clients [core:29–59](<../../swissquote-wallet/apps/wallet/src/features/recovery/core.ts#L29-L59>). [Desk pacing:12–47](<../../swissquote-wallet/apps/recovery-tool/src/core.ts#L12-L47>) reduces rate pressure. Outage warnings only on failure; ordinary success does not prove resilience. One remaining endpoint cannot authorize recovery clear/finalize alone.

### Stage wait and backup

**Quote L232:** “Recovery wait too long on stage” / “Demo drags” / “3-minute module; talk through the threat model while waiting; backup recording”.

**Three-minute A implemented/demonstrated; speech/video controls unproved.** [A/B waits:4–7](<../../swissquote-wallet/apps/wallet/src/features/recovery/core.ts#L4-L7>), [natural wait proof:80–89](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L80-L89>). B is 3 days. Countdown normal after start; threat narration not enforceable by source. Reviewed screenshots/JSON are not backup recording; none established. Retained-session public completion is not uninterrupted rehearsal video.

### Password fallback

**Quote L233:** “WebAuthn quirks” / “Login fails” / “Password fallback always available”.

**Login fallback implemented/demonstrated, not all-operation fallback.** [Sign-in form:514](<../../swissquote-wallet/apps/wallet/src/App.tsx#L514>), [public normal login:14](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L14>). B rejects password without reset+72h+video [service:275–277](<../../swissquote-wallet/services/swissquote/src/app.ts#L275-L277>); large/admin sponsorship still requires passkey. Sign-in success alone hides subsequent restriction; refusal appears only when attempting restricted action.

### Malicious publisher

**Quote L234:** “Web app is served fresh by Swissquote” / “A malicious version could copy the key” / “State in threat model; product answer = native app with reproducible builds”.

**Risk documented; native/reproducible product absent.** [Threat model:5,35–37](<../../Docs/submission/threat-model.md#L35-L37>) explicitly retains malicious publisher/no native app or audited pipeline. [Desk header:3](<../../swissquote-wallet/apps/recovery-tool/index.html#L3>) ordinarily warns independent publisher is MOCK and recommends saved verified tool. This warning is not technical prevention of malicious fresh wallet code. No delivered reproducible native product control established.

### Cut extras before core

**Quote L235:** “Running out of time” / “Missing core demo” / “Cut M4 first; never cut M3”.

**Process decision not inferable; present core coverage incomplete.** [Active registry:14–22](<../../swissquote-wallet/apps/wallet/src/features/index.ts#L14-L22>) includes extras, while planned M3 executable attack and server watcher/email are absent. This proves current scope gaps, not historical prioritization rationale.

## Visibility conclusions

Ordinary successful path displays grouped new owner, helper choice, countdown, kit separation warning and kit-save gate. It does not automatically demonstrate adversarial behavior.

Pending-chain state is required for Stop it. Dual-pending/RPC uncertainty is required for incomplete-protection warning; successful A-only recovery never hits it. Wrong face, stale nonce, wrong kit code, stale owner and RPC failure warnings require deliberately selected exceptional inputs. Old-key refusal needs a retained unlocked seed on the same wizard page. DemoLab is categorically different: it never executes an attack under any selection.

Use public browser proof for A recovery/kit/GS026, and older script proof for two-module cancellation/helpers-together refusal, labeled separately. Do not claim current ordinary UI completes all M3 or that external Safe{Wallet} kit exit/closed-device notification works. No fresh test result or chain-state verification is claimed by this audit.
Headers and source line references reflect files read during this attempt; unrelated later edits can change them.
Descendant safety: no hidden environment, secret fixture, retained encrypted browser profile, service data directory or user DB was opened.
Final output: this report only.
Additional bounds: module B's long delay and password policy are current-source deviations, not failures of the 180-second A proof. The JSON kit's checksum length change improves transcription handling but is not literal compliance with 32 displayed characters. Neither copy nor a passing unrelated suite fills a missing workflow demonstration.


---

## §4 — Repository and tooling (source lines 48–62)

| ID | Exact request / source | Verdict | What exists; what a demo user experiences | Evidence |
|---|---|---|---|---|
| D01 | “apps/wallet/ React app” (L52) | WORKS · INTERNAL | React wallet runs on current port 5273; implementation folder is not a client feature. | [App.tsx:507](<../../swissquote-wallet/apps/wallet/src/App.tsx#L507>) |
| D02 | “apps/recovery-tool/ static recovery and kit page” (L53) | WORKS · VISIBLE ON DEMAND | Separate Recovery Desk at 5274; independent origin, same project publisher. | [sepolia-demo.mjs:14](<../../swissquote-wallet/sepolia-demo.mjs#L14>) |
| D03 | “services/swissquote/ Node service”; “services/partner/ Node service” (L54–55) | WORKS · INTERNAL | Separate service processes/ports 4101 and 4102. Client sees requests/results, not service internals. | [sepolia-demo.mjs:49-53](<../../swissquote-wallet/sepolia-demo.mjs#L49-L53>) |
| D04 | “packages/protocol/ shared TypeScript: addresses, wallet template, address check, message formats” (L56) | WORKS · CHANGED · INTERNAL | Shared package exists. Signed enrollment statements/message schema in §6 were removed; see creation audit. | [constants.ts:7-38](<../../swissquote-wallet/packages/protocol/src/constants.ts#L7-L38>); [wallet.ts:37-54](<../../swissquote-wallet/packages/protocol/src/wallet.ts#L37-L54>) |
| D05 | “contracts/ Hardhat: existing 32 tests + deploy script for module B” (L57) | WORKS · CHANGED · INTERNAL | Hardhat tests include original security cases plus extensions; retained full gate had 42 contract cases. Active module B is three days, not draft five minutes. | [acceptance.md:5](<../../Docs/plans/v4/acceptance.md#L5>); [constants.ts:15-19](<../../swissquote-wallet/packages/protocol/src/constants.ts#L15-L19>) |
| D06 | “scripts/ end-to-end scripts (create, recover, attack)” (L58) | WORKS · INTERNAL | Story scripts and retained evidence cover these; scripts are not ordinary app buttons. | [story-sepolia.ts](<../../swissquote-wallet/scripts/story-sepolia.ts>); [full-2026-10-10T19-28-59Z.json](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) |
| D07 | “pnpm-workspace.yaml”; “Node 26.4.0, pnpm 12.6.0”; “npm needs --cache /tmp/npmcache here” (L59–62) | INTERNAL / HISTORICAL | Workspace and pnpm 12.6.0 pin exist. Report does not re-attest historical Node install or global npm-cache requirement. None is visible to a client. | [pnpm-workspace.yaml](<../../swissquote-wallet/pnpm-workspace.yaml>); [package.json:5](<../../swissquote-wallet/package.json#L5>) |

## §9 — Milestones and delivery (source lines 204–219)

These are historical schedule commitments, not pending instructions to launch, publish or submit.

| ID | Exact request / source | Verdict | What exists; what a demo user experiences | Evidence |
|---|---|---|---|---|
| D08 | “Each milestone ends with a check that can be shown” (L206) | PARTIAL | Many checks are retained tests/receipts, not visible in normal wallet navigation. Attack proof, external Safe signing and rehearsal/video remain distinct gaps. | [acceptance.md:15-38](<../../Docs/plans/v4/acceptance.md#L15-L38>) |
| D09 | “M0 Setup … Workspace; move test harness to contracts/; addresses and code hashes in packages/protocol” (L210) | WORKS · INTERNAL | Present; exact pinned addresses/code hashes are technical evidence, not a user interaction. | [constants.ts:7-36](<../../swissquote-wallet/packages/protocol/src/constants.ts#L7-L36>); [plan-sepolia-copy.test.js:89-98](<../../swissquote-wallet/contracts/test/plan-sepolia-copy.test.js#L89-L98>) |
| D10 | “fund relayer with Sepolia ETH” (L210) | WORKS · BACKSTAGE | Existing relayer has submitted retained public transactions; client sees sponsored payment, not treasury funding. Current public health confirms Sepolia/strict sponsorship; not a fresh funding transaction. | [browser-recovery-v4-2026-10-11.json:23-61](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L23-L61>) |
| D11 | “deploy module B; verify module A bytecode equals our compiled v0.0.1 except the wait value”; “32 tests pass … module B on Etherscan” (L210) | CHANGED · INTERNAL | Active deployed B has three-day wait. Historical local copy test compares five-minute B against A; do not confuse that fixture with current three-day deployment. Current constants separately pin deployed module hashes. Historical test count superseded; no fresh contract suite rerun in this audit. | [plan-sepolia-copy.test.js:239-249](<../../swissquote-wallet/contracts/test/plan-sepolia-copy.test.js#L239-L249>); [constants.ts:14-23](<../../swissquote-wallet/packages/protocol/src/constants.ts#L14-L23>) |
| D12 | “M1 … Services (enroll, statements, relay)” (L211) | PARTIAL · CHANGED | Enrollment and relay exist; signed GuardianStatement protocol is absent. | See §6 and API audit |
| D13 | “scripts/create.ts runs flow 7.1 without UI, first on a local chain, then Sepolia”; “Wallet on Etherscan” (L211) | CHANGED · WORKS BY OTHER SCRIPT | Story scripts and public receipts exist, not that exact script filename. Ordinary client gets explorer links instead of script output. | [story.ts](<../../swissquote-wallet/scripts/story.ts>); [story-sepolia.ts](<../../swissquote-wallet/scripts/story-sepolia.ts>); [full-2026-10-10T19-28-59Z.json](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json>) |
| D14 | “script refuses a tampered statement” (L211) | MISSING AS SPECIFIED | No signed enrollment-statement verification remains; different proof/registration checks do not demonstrate this requirement. | Creation/API audit (§6) |
| D15 | “M2 … Login, onboarding, card page, balance … send”; “Real Sepolia transfer from the UI” (L212) | WORKS · VISIBLE | Available normal journey and retained public-browser transfer receipts. Receive-with-QR clause is audited separately and is missing. | [browser-service-2026-10-11.json](<../../swissquote-wallet/evidence/sepolia/browser-service-2026-10-11.json>); [browser-recovery-v4-2026-10-11.json:12-20](<../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json#L12-L20>) |
| D16 | “M3 … Flows 7.3, 7.4, 7.5; watcher and alerts”; “Owner replaced on Sepolia; cancel works; attack refused on screen” (L213) | PARTIAL | Retained public recovery and cancellation evidence exists. Browser polling/alerts exist; service watcher/email and live attack-button requirements are not equivalent to the active text-only Demo lab. | Recovery audit; [acceptance.md:23-36](<../../Docs/plans/v4/acceptance.md#L23-L36>) |
| D17 | “M4 … Kit download and Open kit; WalletConnect; approved-dApp list”; “Kit opens; one dApp transaction” (L214) | PARTIAL · CHANGED | Kit opens. Third-party Compound test supply mined in an earlier browser run; built-in DeFi is not WalletConnect. No generic connector or all requested signing methods. | [browser-compound-2026-10-11.json](<../../swissquote-wallet/evidence/sepolia/browser-compound-2026-10-11.json>); payments/recovery audits |
| D18 | “M5 … Architecture diagram (real vs mock)” (L215) | WORKS · PRESENTATION ONLY | HTML/PNG architecture is packaged, not an app feature. Must open it during pitch for judges to experience it. | [architecture.html](<../../Docs/submission/architecture.html>); [architecture.png](<../../Docs/submission/architecture.png>) |
| D19 | “threat model, custody and Travel Rule notes” (L215) | WORKS · PRESENTATION ONLY | Written material exists; not regulatory approval or a tested compliance programme. Product alone does not convey it all. | [threat-model.md:5-29](<../../Docs/submission/threat-model.md#L5-L29>); [custody-travel-rule.md:5-33](<../../Docs/submission/custody-travel-rule.md#L5-L33>) |
| D20 | “business case” (L215) | WORKS · DOCUMENT ONLY | Explicit hypothetical scenarios, not measured adoption/revenue. Need deck narration; users do not experience a validated business model. | [business-case.md:5-24](<../../Docs/submission/business-case.md#L5-L24>) |
| D21 | “AI tools used” (L215) | PARTIAL · DOCUMENT ONLY | Agent tooling recorded; human/team fields remain pending. | [ai-tools.md:7-16](<../../Docs/submission/ai-tools.md#L7-L16>) |
| D22 | “screen recording of the full demo as backup” (L215) | MISSING / NOT PACKAGED | No full demo video packaged in candidate; existing screenshots/receipts/deck are not a recording. Recursive video-file search found no mp4/webm/mov under candidate. | [README.md:41](<../../Docs/pitch/v4/README.md#L41>) |
| D23 | “two rehearsals”; “Demo runs twice without errors” (L215) | UNVERIFIED | No evidence of two human end-to-end rehearsals. Automated tests and interrupted/resumed public-browser story are not two uninterrupted judge rehearsals. | [acceptance.md:30-38](<../../Docs/plans/v4/acceptance.md#L30-L38>); [README.md:45-49](<../../Docs/pitch/v4/README.md#L45-L49>) |
| D24 | “Freeze … Only fixes to blocking bugs”; “Submitted before 10:00” (L216) | HISTORICAL / NOT VERIFIED | No submission claimed or performed. Later authorized UX changes mean historical freeze is not proof of present acceptance. | [execution-status.md:7,41-43](<../../Docs/plans/v4/execution-status.md#L7>) |
| D25 | “four lanes … A protocol and scripts, B services, C app … D submission documents” (L218–219) | HISTORICAL · INTERNAL | Work was divided across agents; source and artifact deliverables exist. Staffing/schedule are not client-visible features. | [execution-status.md:9-18](<../../Docs/plans/v4/execution-status.md#L9-L18>) |

## §10 — Out of scope (source lines 221–224)

| ID | Exact request / source | Verdict | What exists; what a demo user experiences | Evidence |
|---|---|---|---|---|
| D26 | “Live Bitcoin and Solana” (L223) | INTENTIONALLY NOT BUILT | Current app is EVM Sepolia/local only; no live BTC/SOL demo. Bitcoin research is not an integrated wallet. | [constants.ts:2-3](<../../swissquote-wallet/packages/protocol/src/constants.ts#L2-L3>); [bitcoin-taproot-candidate-b.md](<../../Docs/research/bitcoin-taproot-candidate-b.md>) |
| D27 | “formal proofs; native mobile app; passkey as the signing key; MPC” (L223) | INTENTIONALLY NOT BUILT | Web app, ordinary secp256k1 owner key, WebAuthn authentication/step-up. Tests are not formal proofs; helper design is not MPC. | [App.tsx](<../../swissquote-wallet/apps/wallet/src/App.tsx>); [threat-model.md:9-19](<../../Docs/submission/threat-model.md#L9-L19>) |
| D28 | “banking integration; on-chain spending limits” (L224) | INTENTIONALLY NOT BUILT | MOCK account funding and service sponsorship policy; no real bank integration, no on-chain spending cap. High-value prompts cannot stop an owner spending through another submitter. | [custody-travel-rule.md:15-33](<../../Docs/submission/custody-travel-rule.md#L15-L33>) |
| D29 | “production waiting periods (3 and 7 days)” (L224) | CHANGED | Prototype actually uses A=3 minutes, B=3 days; B therefore uses a longer wait, but there is no seven-day path or production-ready claim. B completion cannot fit an ordinary short demo. | [constants.ts:19](<../../swissquote-wallet/packages/protocol/src/constants.ts#L19>) |

## §12 and historical deadlines — questions, not product requirements

| ID | Exact request / source | Verdict | What exists; what a demo user experiences | Evidence |
|---|---|---|---|---|
| D30 | “Hacking ends Sunday 10:00 CEST … about 17.5 hours away … assumes … 17:00” (L14–15); milestone timeboxes (L210–216) | HISTORICAL | Original draft schedule only. Not evidence features shipped or submission occurred. | Original attachment lines14–15,210–216 |
| D31 | “May we commit and push this code …?” (L239) | HUMAN DECISION | Question, not a wallet feature. This audit does not authorize or perform publication. | Original attachment line239; current audit scope |
| D32 | “Who builds: you and teammates, coding agents, or both?” (L240) | HUMAN DECISION / HISTORICAL | Staffing question; no client-visible outcome beyond implemented work. | Original attachment line240 |
| D33 | “relayer key and the Reown project ID go in a local .env … Do not paste them in chat” (L241–242) | PARTIAL · INTERNAL | Existing ignored local sending-key configuration supports the live launcher. Reown project ID not used because connector is absent. No secrets inspected or copied in this audit. | [sepolia-demo.mjs:47-48,93-96](<../../swissquote-wallet/sepolia-demo.mjs#L47-L48>); payments audit |

## Current audit evidence boundary

Public health and served source were fetched with GET only: Sepolia chain11155111, strict sponsorship enabled, MOCK service true, updated gasless copy served. No login, account mutation, signing, funding, forced outage or adversarial transaction was performed. The current authenticated client session was not inspected.

Latest wallet-only regression run before this audit: typecheck passed; 54 passed, one service integration skipped. Historical full 609-test gate predates subsequent UX changes; a later whole gate failed during recovery wait. Do not describe current code as a freshly passing complete609gate. Public G1 receipts are retained earlier evidence, not a fresh full-session run of today's rendering.

“Not observed in the normal demo” below is an exposure classification, not a statistically measured real-world rarity rate. Actual prior RPC timeouts are known; do not dismiss all infrastructure warnings as hypothetical.

## Plain-language decision summary

The demonstrable core is real: wallet creation, owner-signed sponsored USDC payment, separate card/kit tool, assisted recovery and same-address replacement-owner payment. It is not the full draft implemented word for word. Biggest user-visible omissions/deviations: generic WalletConnect, receive QR, live adversarial takeover button, service-side email watcher, automatic Recovery Desk launch/return, five-minute fallback (now three days), and independent MetaMask/Safe spending drill. Most low-level checks work behind the scenes; seeing a safety claim is not the same as experiencing a refusal.

Recommended presentation change (not implemented by this audit): use the existing natural successful journey for core proof, explicitly choose a bounded >5USDC payment if demonstrating step-up, and open a separately labelled proof scenario for refusals. Never manufacture a real unsafe recovery to make a warning appear on a valuable wallet.

### Coverage index

§1–3,5–6,7.1 → creation rows; §4 → D01–D07; §7.2,7.7,8 → payments rows; §7.3–7.6,11 → recovery rows; §9 → D08–D25; §10 → D26–D29; deadlines and §12 → D30–D33. The unmodified attachment is reproduced at the end of the full report so every original word remains available alongside these clause-level findings.

### Heading/status-only source lines

Title/status/author (L1–3), section headings, markdown fences/table separators, and the introductory “Checked on Sepolia today …” (L66) are metadata, not user features. The dated code-presence assertion is historical; pinned addresses and retained deployment/use evidence exist, but this audit did not freshly call eth_getCode for each address. Candide-main-branch version assertion (L78) is historical upstream context; deployed v0.0.1 is inspected, upstream current main branch not re-researched. No requirement is silently treated as satisfied because its heading exists.



---

## Appendix — supplied draft, verbatim

The following is the original file, unedited. Line references in the audit count from its first line.

~~~~markdown
# Swissquote Wallet: build plan (draft v1, before review)

Status: draft for critique. Author: agent 46257332. Written Sat 10 Oct 2026, 16:35 CEST.

## 1. What we build, and the deadline

We build a web wallet in which **only the user's key can move money**. A lost key can be replaced by
**the user's recovery card plus either the biometric partner or Swissquote**, after a waiting time
during which the old device can cancel. Swissquote and the partner, even together, cannot replace it.

The demo, live on Ethereum's Sepolia test network: create wallet → log in and send → lose the
device → recover → show that partner + Swissquote alone are refused.

**Hacking ends Sunday 10:00 CEST. At the time of writing that is about 17.5 hours away.** Every time
box below is in CEST and assumes we start building at 17:00.

## 2. Fixed decisions

- **Chain:** Sepolia only, live. Bitcoin and Solana appear in slides only. Bitcoin has tested
  evidence from agent 4ccb895d (`Docs/research/bitcoin-taproot-candidate-b.md`).
- **Wallet contract:** Safe v1.4.1 (canonical deployment), one owner = the user's key, threshold 1.
- **Recovery:** two instances of Candide's Social Recovery Module v0.0.1:
  - module A: guardians {card R, partner P}, threshold 2, Candide's 3-minute instance;
  - module B: guardians {card R, Swissquote SQ}, threshold 2, our own deployment of the same code
    with a 5-minute wait, because Candide deployed only one short-wait instance.
  Tested on a local chain (T8): P + SQ refused on both; R + P and R + SQ succeed after the wait.
- **No contract code of our own**, except deploying an unmodified copy of module v0.0.1.
- **No cryptography of our own.** Libraries: viem, @scure/bip39 and @scure/bip32, WebCrypto,
  @simplewebauthn, Safe protocol-kit (optional helper), Candide abstractionkit (optional helper),
  @reown/walletkit.
- **Fees:** a Swissquote relayer key with Sepolia ETH submits every transaction. It submits only
  transactions already signed by the user's key (or guardian approvals), so it cannot change them.
- **Login** proves who the client is to Swissquote. It never moves money.

## 3. The parts and what each one stores

| Part | Runs as | Stores | Never stores |
|---|---|---|---|
| Wallet app | React + Vite, `localhost:5173` | User's seed, encrypted in IndexedDB | Card, partner key, SQ key |
| Recovery tool | Static page, `localhost:5174` (separate origin) | Nothing | Anything (card typed in, used once, forgotten) |
| Swissquote service | Node + SQLite, `localhost:4001` | Account, passkey public key, mock KYC flag, wallet address, SQ guardian key per user (mock HSM), relayer key | Seed, card, partner key |
| Partner service | Node + SQLite, `localhost:4002`, separate process | Mock biometric template, user reference, P guardian key per user (mock HSM) | Seed, card, SQ key, Swissquote account data |
| Chain | Sepolia | Safe wallet, modules A and B, guardians | Secrets |

The brief requires mocked key holders to be separate processes with their own storage; the two
services satisfy that. Anything mocked is labelled "MOCK" in the UI and in the architecture diagram.

## 4. Repository layout

```text
swissquote-wallet/
  apps/wallet/          React app
  apps/recovery-tool/   static recovery and kit page
  services/swissquote/  Node service
  services/partner/     Node service
  packages/protocol/    shared TypeScript: addresses, wallet template, address check, message formats
  contracts/            Hardhat: existing 32 tests + deploy script for module B
  scripts/              end-to-end scripts (create, recover, attack)
  pnpm-workspace.yaml
```

Tooling found on this machine: Node 26.4.0, pnpm 12.6.0. npm needs `--cache /tmp/npmcache` here.

## 5. Contracts on Sepolia (chain id 11155111)

Checked on Sepolia today with `eth_getCode` (all have code):

| Contract | Address |
|---|---|
| Safe v1.4.1 SafeL2 singleton | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` |
| SafeProxyFactory v1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| CompatibilityFallbackHandler v1.4.1 | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |
| MultiSendCallOnly v1.4.1 | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| SafeModuleSetup v0.3.0 | `0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47` |
| Module A: Candide recovery, 3 minutes | `0x949d01d424bE050D09C16025dd007CB59b3A8c66` (on-chain `VERSION()` = "0.0.1") |
| Module B: our copy of v0.0.1, 5 minutes | deployed in M0 |

Candide's current main branch is version 0.2.0. We use **0.0.1**, the version actually deployed. Its
EIP-712 domain is name "Social Recovery Module", version "0.0.1"; the signed type is
`ExecuteRecovery(address wallet,address[] newOwners,uint256 newThreshold,uint256 nonce)`.

## 6. Message formats

**Guardian statement** (returned by partner and Swissquote at enrollment), signed with EIP-712 by
the party's statement key. The app has each party's statement-key address built in.

```text
GuardianStatement { party: "partner" | "swissquote", userRef: bytes32,
                    guardian: address, chainId: uint256, issuedAt: uint256 }
```

`userRef` is a random 32-byte value the app creates at onboarding. It links the user's records
at the partner and at Swissquote without sharing personal data between them.

**Recovery approval:** a guardian's ECDSA signature over the module's recovery hash for
`(wallet, [newOwner], 1, nonce)`. The signer checks that its locally computed EIP-712 hash equals
the module's on-chain `getRecoveryHash`. Signatures are sorted by signer address before submission.

## 7. Flows

### 7.1 Create wallet

1. Log in to Swissquote (passkey, or password fallback). Press "Mock KYC: verified".
2. App creates a 24-word seed (or imports one, with a warning: funds at the seed's ordinary
   address are not protected; only funds in the new wallet are). Owner key = path
   `m/44'/60'/0'/0/0`. App asks for a device password and stores the seed encrypted
   (PBKDF2-SHA256, 600,000 iterations → AES-GCM) in IndexedDB.
3. App opens the recovery tool (`:5174`). The tool creates the card: 12 BIP-39 words for key R,
   shown once with a printable page. The tool returns only R's address to the app
   (`postMessage` to the pinned app origin).
4. App sends `userRef` to the partner (`POST /enroll`, with a mock selfie and ID number) and to
   Swissquote (`POST /guardian/enroll`). Each returns a guardian statement.
5. App checks both statements against the built-in statement keys.
6. App builds the Safe setup call itself: owners [owner], threshold 1,
   `to` = SafeModuleSetup, `data` = `enableModules([A, B])`, fallback handler = the address above,
   payment 0. It computes the wallet address from factory, singleton, setup call and salt.
7. Swissquote relayer deploys (`createProxyWithNonce`).
8. App signs one Safe transaction: MultiSendCallOnly with
   `A.addGuardianWithThreshold(wallet, R, 1)`, `A.addGuardianWithThreshold(wallet, P, 2)`,
   `B.addGuardianWithThreshold(wallet, R, 1)`, `B.addGuardianWithThreshold(wallet, SQ, 2)`.
   Relayer submits it.
9. App verifies through a public RPC (not Swissquote's): deployed address equals the computed
   address; owners = [owner]; threshold 1; guards none; A and B guardians and thresholds as
   expected; no pending recovery. **The address comparison is mandatory**: T9 showed that a
   malicious setup can plant a hidden owner that the read-back does not reveal.
10. App creates the emergency kit (7.6) and asks the user to download it.

### 7.2 Daily send

Enter recipient and amount → plain-language summary → if above 0.01 ETH, re-authenticate (passkey
or password) → app signs the Safe transaction with the owner key → relayer submits → show the
Etherscan link. Relayer checks: wallet registered, recipient not on a mock sanctions list, daily
gas budget per wallet.

### 7.3 Recovery (new device)

1. New device: log in with password (the old passkey is gone with the device). Mock KYC re-check.
2. App creates a new seed; new owner = its key. It shows a 4-word fingerprint of the new address.
3. App picks module A (card + partner) for the demo. Module B is the fallback if the partner
   is unavailable.
4. App opens the recovery tool with wallet, module, new owner, nonce and chain in the URL
   fragment. The tool reads the chain itself, confirms the card is a guardian and the nonce is
   current, and shows: "Replace the owner of wallet 0x… with new key 0x… (fingerprint …)".
   The user checks the fingerprint, types the card words, and confirms. The tool signs and returns
   only the signature.
5. App asks the partner to approve (`POST /recovery/approve`, mock selfie). Partner signs.
6. Relayer submits `multiConfirmRecovery(wallet, [newOwner], 1, sorted signatures, true)`.
   The waiting time starts.
7. Swissquote's watcher polls both modules every 15 s and raises an alert. The old device shows a
   banner with a Cancel button. A mock email is printed in the service log.
8. After the wait, relayer calls `finalizeRecovery(wallet)`.
9. New device: if a request is pending on the other module, cancel it **before** changing any
   guardian (T8 hazard). Then create a new emergency kit.
10. Check shown in the demo: a transaction signed by the old key is rejected (`GS026`).

### 7.4 Cancel (old device)

Old device signs a Safe transaction calling `cancelRecovery()` on the module, and the relayer submits
it. Only `cancelRecovery` clears a request; disabling the module or bumping the nonce does not
(T10).

### 7.5 Attack demo: partner + Swissquote

A button "Partner and Swissquote try to take the wallet" builds `multiConfirmRecovery` with P's and
SQ's signatures on each module and runs it as `eth_call` (no gas). The UI shows the revert reason.
On module A, SQ is not a guardian; on module B, P is not a guardian.

### 7.6 Emergency kit

- A 32-character kit code (160 bits) is shown once. The user writes it down.
- The kit file (JSON, plus a printable page) holds the seed encrypted with a key derived from the
  kit code, plus the wallet address, chain, module addresses, derivation path and instructions.
- The recovery tool has an "Open kit" function: kit file + kit code → seed words.
- Instructions if Swissquote disappears: open the kit in the recovery tool, import the seed into any
  standard wallet (for example MetaMask), open the wallet in Safe{Wallet} on Sepolia, move the funds.
  The owner key needs a little ETH for fees on this path, because our relayer is gone.
- Keep the kit file, the kit code and the card apart. The kit file plus the kit code is the owner key.

### 7.7 dApps (extra, after recovery works)

Reown WalletKit with a project ID from `.env`. Namespace `eip155:11155111`, account = wallet address.
`eth_sendTransaction` goes through the 7.2 confirmation screen. `personal_sign` and
`eth_signTypedData_v4` return a Safe smart-wallet signature (verified by dApps through the fallback
handler). Only dApps on a small approved list may connect.

## 8. Service APIs

Swissquote service (`:4001`):

- `POST /auth/register/options`, `/auth/register/verify`, `/auth/login/options`, `/auth/login/verify`
  (passkey); `POST /auth/password/register`, `/auth/password/login`
- `POST /kyc/mock-verify`
- `POST /guardian/enroll` → guardian statement
- `POST /wallets` → register wallet address for the logged-in user
- `POST /relay/deploy`, `POST /relay/safe-tx`, `POST /relay/recovery`, `POST /relay/finalize`
- `POST /recovery/approve` → SQ's approval signature for module B (after login + mock KYC re-check)
- `GET /wallets/:address/status` → pending requests on A and B, with time left; alerts

Partner service (`:4002`):

- `POST /enroll` → guardian statement
- `POST /recovery/approve` → P's approval signature for module A (after mock face match)

## 9. Milestones

Each milestone ends with a check that can be shown.

| Milestone | Time (CEST) | Work | Check |
|---|---|---|---|
| M0 Setup | 17:00–18:00 | Workspace; move test harness to `contracts/`; addresses and code hashes in `packages/protocol`; fund relayer with Sepolia ETH; deploy module B; verify module A bytecode equals our compiled v0.0.1 except the wait value | 32 tests pass in the new folder; module B on Etherscan |
| M1 Create by script | 18:00–20:30 | Services (enroll, statements, relay); `scripts/create.ts` runs flow 7.1 without UI, first on a local chain, then Sepolia | Wallet on Etherscan; script refuses a tampered statement |
| M2 App, daily use | 20:00–23:30 | Login, onboarding, card page, balance, receive with QR, send | Real Sepolia transfer from the UI |
| M3 Recovery | 23:30–03:30 | Flows 7.3, 7.4, 7.5; watcher and alerts | Owner replaced on Sepolia; cancel works; attack refused on screen |
| M4 Extras | 03:30–05:30 | Kit download and "Open kit"; WalletConnect; approved-dApp list | Kit opens; one dApp transaction |
| M5 Submission | 05:30–09:30 | Architecture diagram (real vs mock), threat model, custody and Travel Rule notes, business case, AI tools used; screen recording of the full demo as backup; two rehearsals | Demo runs twice without errors |
| Freeze | 09:30 | Only fixes to blocking bugs | Submitted before 10:00 |

Work can run in four lanes once M0's shared package exists: **A** protocol and scripts,
**B** services, **C** app screens and recovery tool, **D** submission documents (can start now).

## 10. Out of scope (slides only)

Live Bitcoin and Solana; formal proofs; native mobile app; passkey as the signing key; MPC;
banking integration; on-chain spending limits; production waiting periods (3 and 7 days).

## 11. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| No Sepolia ETH for the relayer | Nothing can be deployed | Get it in M0 from two faucets; keep 0.3 ETH minimum |
| Public RPC rate limits | Flaky demo | Two RPC URLs with fallback |
| Recovery wait too long on stage | Demo drags | 3-minute module; talk through the threat model while waiting; backup recording |
| WebAuthn quirks | Login fails | Password fallback always available |
| Web app is served fresh by Swissquote | A malicious version could copy the key | State in threat model; product answer = native app with reproducible builds |
| Running out of time | Missing core demo | Cut M4 first; never cut M3 |

## 12. Questions for the user

1. May we commit and push this code to the repository? (AGENTS.md requires your authorization.)
2. Who builds: you and teammates, coding agents, or both? This decides how the lanes are staffed.
3. The relayer key and the Reown project ID go in a local `.env` that you create. Do not paste them
   in chat.

~~~~
