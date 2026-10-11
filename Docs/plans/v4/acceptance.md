# V4 integration acceptance

**Final V4 acceptance: 609 tests passed, zero skips; typechecks/builds passed (`bash-2077`, exit 0).** G1 public-browser recovery also PASSED (`bash-2054`, exit 0): creation, funding, first payment, card+partner recovery and replacement-owner payment at the same address across encrypted retained browser sessions—not one uninterrupted take.

Final terminal: `GATE PASS: passed=609, skipped=0, duration=434.2s`. Inventory: 567 Node/browser + 42 contracts, including 34 browser cases and local recovery with the actual wait. The seven added MOCK bank-return shortcut regressions are included; its destination prefill fails closed and still uses normal payment preview/signing. The gate stopped its owned processes; ports 5273/5274/4101/4102/8645 were verified free. Existing v2 ports 5173/4001 remained live and v3 stayed clean. No further product delta follows this acceptance.

## Local gate

- Execution: `bash-1996`, exit 0; terminal `GATE PASS: passed=602, skipped=0, duration=417.0s`; typechecks/builds passed.
- Inventory: frozen v3 591 + eight launcher + three UI tests = 602; 560 Node/browser + 42 contracts, including 34 browser cases and complete local recovery with the actual 180-second wait. No skipped/cancelled/todo tests.
- Candidate: isolated `v4-ui` based on v3 `cb7297a`; uncommitted changes. Existing v2 runtime and frozen v3 preserved.
- This 602-test result is the earlier baseline. The final 609-test gate above supersedes it and accepts the added C1 shortcut. Gate default and inventory now match 609; final diff checks passed.
- Gate fixes: explicit React imports for root-cwd JSX execution, versioned public Compound exact-math fixtures, restored provenance-tracked vendored package distribution, and recovery completion conditional on successful replacement registration. No test removed or skip introduced.

## Completed public-browser story

The [final allowlisted public artifact](<../../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-2026-10-11.json>) completes the [earlier partial artifact](<../../../swissquote-wallet/evidence/sepolia/browser-recovery-v4-partial-2026-10-11.json>), preserving timeout chronology. Both were read offline for documentation reconciliation; no private state was inspected or copied and no independent fresh chain query was performed by this docs lane.

Wallet `0x9BAE9f8b97262d95c3834Dea2E74BA520d686E5c`:

| Step | Public receipt |
| --- | --- |
| Deployment | [Deployment](https://sepolia.etherscan.io/tx/0x9c1549421b52a006ebd23967ef188e7182ba8491063dc881281607434ab7787b) |
| 2-USDC test funding | [Funding](https://sepolia.etherscan.io/tx/0x2f61fd2f254cd20cb3a9093de009d11a8c7b114104e1079b7ef77bb6c1bff51d) |
| First owner 1-USDC payment | [Payment](https://sepolia.etherscan.io/tx/0xfce86ae97a677abd7e5277c1ca65084cc09ad76ff10946dad8fc5ed453cb87fe) |
| Card+partner recovery A start | [Start](https://sepolia.etherscan.io/tx/0xb91ce0bec9a62eb4844f309ea3961b9d70eb551e4838e4f2bed2a86bef88654f) |
| Finalization | [Finalize](https://sepolia.etherscan.io/tx/0x2de7323c1e8de99119cd2ba651794e90e252c3c0729961bd8d7132485c62fa5e) |
| Replacement-owner 1-USDC payment | [New payment](https://sepolia.etherscan.io/tx/0xaf43a7e72b8f8f951fef5d68b73700525416e1581f25c44e81edc2de3053976a) |

Start block 11889728 timestamp 1791697812; executeAfter 1791697992. Common mature block 11889747 timestamp 1791698040 establishes **228 seconds elapsed**, exceeding the actual contract delay 180 seconds plus 15-second safety margin; no clock manipulation. Finalize block 11889749 timestamp 1791698064; replacement payment block 11889750 timestamp 1791698076. Final state: sole owner `0x7Bb5750ead80776136a6ddCCaED94073F5910371`, threshold one, nonce two, zero USDC, both pending modules clear.

Exact retained receipts and public state were checked on two RPCs before any action. Normal password login resumed the retained account without authentication injection. Normal saved-replacement unlock preserved the exact owner without restarting recovery. Finalization and new payment used the same visible page with normal replacement-device unlock, no reload, seed import or shell state injection. Actual old-key `GS026` was read-only `eth_call`, no relay intent/POST and no Safe nonce change. A fresh actual replacement-kit download rejected a wrong code, decrypted offline with matching owner, then passed independent current-owner checking; this is not a kit broadcast.

## Evidence and delivery boundary

Identity/bank/partner face are MOCK. Real service WebAuthn verification used a Chromium virtual authenticator, not physical fingerprint proof. Historical public payment, third-party Compound III supply, scripted cancellation/recovery and RPC-only kit sweep are separate runs. Module B's three-day wait was not completed. G1 did not test high-value step-up or DeFi. These results are not production security audit or regulatory approval.

UI and documentation remain isolated candidates; no commit, push, publication, upload or submission is claimed. Offline deck and judge card are prepared. Human presenter/device/projector/QR rehearsal and submission decisions remain required.
