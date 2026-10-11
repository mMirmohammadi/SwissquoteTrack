# Paste-ready message for the lead agent (46257332)

Send only after the user approves decision 1 in [README.md](README.md). Paste the block below into
the lead's session as a user message.

Written for the lead's state at 01:20 CEST: Compound run 8 accepted, v3 at `cb7297a` (pushed,
clean), last full gate 591 passed / 0 skipped, v3 live stack stopped, lead idle.

---

User decision (V4 plan, `/home/dev/Hackaton/SwissquoteTrack/Docs/plans/v4/README.md`, main checkout):
thank you — the Compound supply is accepted. The demo will be product-first and live on Sepolia.
One more live proof is needed before the code freeze.

1. **Gate G1, due 02:45 CEST — one complete recovery in the product on Sepolia**, browser-driven
   through the wallet and Recovery Desk screens, on a freshly launched Sepolia stack. Follow the
   click path of `tests/browser/recovery-complete.test.mjs:305-315`: the recovery runs in the old
   phone's own page, in one tab that is never hidden (hiding clears the old key and the new-kit
   acknowledgement, `apps/wallet/src/features/recovery/index.tsx:41`).
   a. fresh wallet: create → "Verified as yours" → MOCK funding → pay 1 USDC through the relayer;
   b. Recovery Card approval in the desk → partner approval → start → real 180 s wait → create,
      download and acknowledge the new kit → Finish → "Try the old key" refused → the new key pays
      1 USDC through the relayer **without a page reload** (if the app asks to reload or unlock
      again, record it: that decides whether the stage shows this step live);
   c. open the new Emergency Kit in the desk: "Both nodes confirm this kit owner at the same block";
   d. save hashes and screenshots to `swissquote-wallet/evidence/sepolia/browser-recovery-2026-10-11.json`
      (+ a Playwright video if the harness can record it; the screenshots become pitch stills).
   Report G1 as pass, or fail with the cause classified as code / environment / chain. Fix code only
   if the fix is small and the full gate still passes by 04:30. Hard stop at 03:00: if G1 has not
   passed by then, record where it stopped and go to step 2; the humans retry it at 06:00.
2. **03:00–03:45 (or as soon as G1 is done):**
   a. add a run-folder reuse option to `sepolia-demo.mjs` (for example `DEMO_RUN_ID=<existing folder>`;
      today `:17` always picks a new random run and `:71` passes none) so a relaunch keeps accounts,
      sessions and helper keys; test launch → create account → stop → relaunch → sign in, with the
      relayer latch idle;
   b. set the demo feature-flag profile from `Docs/plans/v4/frontend.md` (main checkout); it keeps
      `dapps`;
   c. apply the documentation fixes listed in `Docs/plans/v4/submission-plan.md` §4, if the planner's
      docs helper has delivered them as ready patch files with a `NOTES.md` in
      `/home/dev/Hackaton/SwissquoteTrack/AgentsLocal/770ad2e6/patches/` (skip this step if that folder
      is empty); review, secret scan → commit → push.
3. **03:45–04:30, UI merge and freeze:** if the UI helpers delivered the `v4-ui` patch by 03:45,
   stop the launcher (the gate uses the same ports, `scripts/gate.mjs:70`), merge the patch and run
   the full gate; set `GATE_EXPECTED_TESTS` if the patch adds tests (`:63` expects 591); if the gate
   fails, drop the patch and ship today's UI. Then secret scan → commit → push → tag `v4-freeze`.
   **04:30 = product code freeze.** After it, documentation only.
4. **Do not:** start another Compound or DeFi run; change protocol or services beyond the launcher
   option; run two live Sepolia flows at once (the relayer lock is global); touch the v2 runtime
   (ports 5173, 5174, 4001, 4002, 8545).

Write G1 and the freeze result into your `STATE.md` when each happens.
