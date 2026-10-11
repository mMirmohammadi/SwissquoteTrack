# V4 feature walkthrough — start here and click through everything

This tutorial follows the **isolated V4 candidate**, not the older demo at port 5173. Use local test funds for exploration. The Sepolia evidence is a separate, already-completed public run; it does not require more public transactions.

## 1. Start the right version

On this prepared machine, open a terminal in `/home/dev/Hackaton/SwissquoteTrack/.worktrees/v4-ui/swissquote-wallet` and run:

    pnpm demo:local

Wait for `Isolated local MOCK demo ready: http://localhost:5273`. Keep that terminal running. It starts a fresh local chain, funds local fixtures and starts both helper services and the two interfaces. It refuses occupied ports instead of attaching to another process. It does not update the older UI.

Open these in separate windows, ideally side by side:

- Wallet: <http://localhost:5273>
- Recovery Desk: <http://localhost:5274>

Use `localhost` consistently for passkeys; do not alternate it with `127.0.0.1`. Confirm the wallet says **LOCAL / Local development chain**. The Desk's footer identifies LOCAL DEVNET; both RPC URLs reach the same local node, not independent operators. Its header still says Sepolia: trust the configured footer/network for this local exercise. The wallet's creation instructions also contain an older `5174` address: use **5274** for this V4 run.

Use a fresh browser profile for this rehearsal. Each launcher invocation makes a fresh chain and service database, but an old browser profile can retain encrypted keys for the previous run. Do not delete real browser wallet data to repair a disposable demo.

Prepare a new demo email and choose private, separate values for your login password and device unlock code, both at least 12 characters. Later choose another device unlock code for the replacement. Never send those values to chat. Do not project or record Recovery Card words, owner seed words or kit codes. Keep card and kit operations off the projector.

**Expected navigation:** Overview, Pay, Recover access, Settings, Demo lab, DeFi, Trust check and Protection. Some Overview buttons still say “Send money” or “Manage kit”; they open the same Pay and Settings screens.

## 2. Create the account and Recovery Card

1. Wallet: select **New here? Create a login**.
2. Enter your demo email and login password. Click **Create login**. Alternatively, **Create with a passkey** registers the account and opens your browser's authenticator flow; it still needs the initial login password.
3. Overview: click **MOCK KYC: mark identity verified**. This is a demo switch, not real identity verification.
4. Desk: select **Make my card**, then **Generate 12 card words**.
5. Privately write down the words in order, or use **Print card + stub**. The words are not saved by the Desk. Printing and clipboard use can leave external copies.
6. Click **Copy guardian address**. Paste only that public `0x…` address into the wallet's **Recovery card public address** field. Never paste the words into the wallet.
7. In the wallet, enter your separate device passphrase. Leave **Partner face template · MOCK** as `client-demo`; this matches the later “Enrolled demo client face” recovery option.
8. Click **Create my wallet ↗** and wait for chain confirmation and ownership registration.
9. Save the wallet address and original **Wallet setup code**. Keep the setup code unchanged after future owner replacements.

**You should see:** a Safe wallet address, a locally encrypted owner key, both configured recovery paths and **Verified as yours**. The Safe holds the tokens; the owner address is its signing key, not the token balance account.

**If creation was mined but registration failed:** use **Retry registration**. Do not deploy another wallet simply because a service check failed. A green ownership-registration label is not the separate Desk check.

## 3. Check the wallet before depositing

1. Desk: select **Check my wallet**.
2. Paste the original setup code and enter your 12 Recovery Card words privately.
3. Leave **Current owner after recovery or key rotation · optional** blank for this original owner.
4. Click **Check my wallet**. Wait for the green result. It checks the original setup, the card-derived address and the configured wallet rules; unavailable checks prevent green. Words clear from that input after success.
5. Wallet → Overview: tick **I personally saw a green result in the independent tool.** This is your acknowledgement, not an automatic data connection between the screens.
6. Desk: select **Public rules check**, paste only the Safe wallet address and click **Check current rules**. This is the no-secret version: it reports public configuration but cannot prove which person holds a key.
7. Wallet: open **Trust check**, click **Check wallet rules**, and read **Observed facts**, the questions about control and the warnings.
8. Open **Protection**, and also inspect its copy at the top of Overview. Read **Who can move your money?**, owner registration, helper requirements, pending-recovery status and backup/passkey acknowledgements.
9. Expand **What Swissquote stores about you** for the privacy explanation. Read the distinction between the helper key and your owner key.

**What these checks mean:** the configured helpers cannot directly sign ordinary payments; each assisted-recovery route needs the card and its own helper. The checks do not prove the publisher is independent, the app is trustworthy, or an unlocked key has never been copied.

The Safe history link is Sepolia-only. A freshly created local wallet does not have public Safe/Etherscan history. Use the packaged public receipts for that part of the presentation.

## 4. Save and test an Emergency Kit

1. Wallet → **Settings**: click **Export current owner kit** while your device key is unlocked.
2. Privately write down the **KIT CODE · SAVE SEPARATELY**. The kit code is not your Recovery Card and not your device passphrase.
3. Click **Download encrypted kit**. Store the file separately from the code and Recovery Card.
4. Tick **I saved the file and wrote the kit code separately from it and the Recovery Card.** Protection can now show a download acknowledgement; this is not proof that the backup works.
5. Desk → **Swissquote gone? Open my kit**: select the downloaded JSON, enter its kit code privately and click **Decrypt locally**.
6. Confirm the owner address matches the original device owner. Owner seed words appear: keep this screen private. To see the failure path, clear secrets, select the same file and try an intentionally incorrect code; decryption must fail. Then reopen with the correct code.
7. Click **Check if this kit is current · contacts two nodes**. Expect confirmation that the recorded owner is current at the checked block.
8. Click **Clear all secrets**. This clears the Desk's in-memory fields, not printed copies, downloads or your clipboard.

A kit decrypts offline, but the current-owner check needs an RPC connection. The Desk does **not** have a “sweep funds” button: decrypting is not broadcasting. An external Safe transaction still needs compatible signing software and a funded gas payer. The kit's owner seed only controls the Safe while that owner is current.

**Portable page:** the local launcher serves the Vite development Desk, where **Save portable emergency page** intentionally reports that saving is only available from a built preview. To exercise that feature without stopping the local runtime, use another terminal in the candidate wallet directory:

    VITE_CHAIN=local VITE_RPC_URLS=http://127.0.0.1:8645,http://localhost:8645 pnpm --filter @sq/recovery-tool build
    pnpm --filter @sq/recovery-tool exec vite preview --host 127.0.0.1 --port 5284 --strictPort

Open <http://localhost:5284>, click **Save portable emergency page**, and privately open the downloaded HTML in your browser. It saves the tool, not your secrets or kit. Disconnect the network and decrypt your throwaway kit there; current-owner checks should not work offline. Reconnect and clear secrets afterwards. Stop this additional preview with Ctrl+C when finished. This optional build changes only generated artifacts, not wallet contracts or the active chain.

## 5. Fund the wallet and make a small payment

1. Overview → **SWISSQUOTE ACCOUNT · MOCK**: enter `15` USDC and click **Move to my wallet ↗**. The fresh local account starts with 20 test USDC, so this leaves 5 in the MOCK account.
2. Wait for confirmation; use **Refresh chain status ↻** if the displayed balance is stale.
3. Inspect the wallet balance, MOCK CHF 1:1 estimate, ETH balance, safety-net paths and **Recent activity**.
4. Select **Pay**. For this prepared local fixture, use recipient `0x00f3fA661cB9f6f298ef7C9B75a6aF42c0409E42` (reported by the active local initializer), or a second disposable wallet's public address. You can also use **Move back to my Swissquote account · MOCK** to supply the authenticated demo-account destination; do not invent an address or use real funds.
5. Enter `1` USDC and click **Review payment**.
6. Read **You send**, **Recipient gets**, **Network fee** and **Balance after**. The after-balance is an estimate; unknown reads stay blank. Screening has not cleared merely because the preview exists.
7. For a first-time recipient, type its last four address characters into **Recipient last four characters**. Check the full address through a trusted source; four characters alone are not ownership verification.
8. Expand **Technical details** to see the exact payment hash and sponsorship caveat.
9. Click **Sign & send**. Wait for a successful receipt, then inspect Overview activity and the updated balance.
10. Pay the same recipient another `1` USDC. It should no longer require the first-time-recipient suffix for that successfully saved destination on this device.

Your device owner key signs; the Swissquote relayer pays the gas. The MOCK bank account and CHF conversion are not real banking operations. Local screening uses fixtures; live public sanctions and USDC issuer-freeze reads belong to Sepolia.

**Bank-return shortcut:** click **Move back to my Swissquote account · MOCK**, if you did not already. It rechecks account/wallet association and only prefills the recipient; choose an amount and go through the same review/sign/send flow. It does not automatically credit the displayed bank balance. If identity, current ownership, token/network or service data cannot be verified, the shortcut hides rather than guessing.

## 6. Passkeys, login and high-value protection

1. Settings: enter the same account email under **Account email for passkey enrollment**, then click **Add a passkey**. Complete the browser/device prompt.
2. Pay: review a `6` USDC transfer to your controlled test recipient. This is above the 5-USDC sponsorship threshold.
3. Observe **Confirm with passkey & send**. Completing it requests an authenticator confirmation tied to that transaction hash. Cancelling the prompt should not authorize a send.
4. If exercising the actual payment, ensure the wallet still has enough test funds. Submit only once and wait for its receipt.
5. Sign out. Sign back in using password; the key remains encrypted. Enter its device passphrase in the **Device key locked** bar and click **Unlock device**.
6. Sign out again and try **Sign in with a passkey** using your enrolled email. Login still does not replace the separate device unlock.
7. Leave the wallet page hidden for more than two minutes, return and inspect its locked state. Unlock normally to continue.

These are fee-sponsorship rules, **not an on-chain spending cap**. An owner using another gas payer can bypass this relayer's policy. Physical-device WebAuthn has not been proven by the automated evidence: that used a virtual Chromium authenticator. If this device cannot enroll/authenticate, stop the high-value/rotation exercise rather than claiming success or bypassing it.

## 7. Recovery: wrong helper input, cancellation, then successful replacement

Use the same disposable wallet for the first rehearsal, while its old owner is available. This lets you see the cancellation path. A genuinely new browser/device recovery is an additional variant at the end.

### Prepare and approve

1. Wallet → **Recover access**. Confirm **Wallet to recover** is the original Safe address.
2. Choose **Recovery Card + partner — 3 minutes in this demo**. Do not choose the three-day route for the short tutorial.
3. Enter a new, private replacement app unlock code, at least 12 characters. Click **Prepare new phone**.
4. Save/compare the full replacement owner address. Preparation encrypts and saves a new device key before any helper request. The field is cleared deliberately.
5. Click **Copy public request**. Desk → **Approve a new phone**: paste the request and privately enter the card words.
6. Click **Review against the chain**. Compare the Safe address, recovery module and **full new owner address** between both screens. The Desk also shows four check words; use those as an additional request check, not a substitute for the full address.
7. Tick the Desk's comparison checkbox, then **Sign this recovery approval** and **Copy approval code**. This signs the card approval locally; it does not broadcast a recovery.
8. Wallet: tick **I compared every group of the full new owner address on the offline approval screen**, and paste the public approval into **Public card approval code, not card words**.

### See refusal and stop a real pending request

9. Set **Partner face check — MOCK** to **Different face — should be refused**. Click **Ask helper and start recovery**. Expect a refusal, not a pending contract request. This tests a MOCK matching rule, not real biometrics.
10. Change it to **Enrolled demo client face** and click once again. If the first refusal invalidated the screen's request, prepare/resume and obtain a fresh card approval rather than forcing stale input.
11. After confirmation, inspect the progress timeline, full replacement address and recovery alert. The countdown follows block time with a 15-second margin, not the laptop clock.
12. Click **It was me** in the alert. The request stays active; this only acknowledges it.
13. To exercise protection, keep/unlock the original device key and click **Stop it — this wasn’t me**. Wait until both configured RPC reads report no pending recovery. Cancellation is an owner-signed protective transaction, not a password action.
14. Resume the saved replacement using its same unlock code. Generate a **fresh public request and card approval** after cancellation: the recovery nonce has changed. Do not generate a different replacement key or reuse the cancelled approval.
15. Start the partner recovery again using the matching MOCK face. From here, leave it pending and continue to completion.

### Save the new kit, wait and finalize

16. In Recover access, re-enter the replacement unlock code and click **Create new encrypted kit**. This clears the unlock field and initially masks the kit code.
17. Privately click **Show code**, store the code separately, then **Download new encrypted kit** and tick its saved/separate-code acknowledgement. **Hide code** masks it visually; it does not remove it from page memory.
18. Privately test that kit in the Desk. Its new owner is **not current yet** before finalization, so do not expect the current-owner check to pass. Offline decryption should still match the saved replacement owner.
19. If switching away hides the wallet tab, recovery-specific secrets, kit state and acknowledgements clear. Re-enter the replacement unlock code and recreate/download/acknowledge a kit before continuing. Use visible side-by-side windows to avoid accidental tab hiding; never defeat the privacy clearing.
20. Wait for approximately 3 minutes plus the safety margin, allowing for block/15-second polling updates. Keep the runtime running. Before maturity, finalization must refuse; clicking cannot skip the on-chain wait.
21. Re-enter the replacement unlock code (exporting cleared it). Click **Check block time, finalize and install saved key** once.
22. Expect **Done — same address** only after sole-owner confirmation, clear pending status and registration. The old Safe address stays unchanged; the owner key changes.
23. Unlock the installed key using the **new** passphrase in the shell's **Device passphrase / Unlock device** bar. Make another `1` USDC payment from the same wallet, without resetting the chain.
24. Re-check the Desk using the **unchanged original setup code**, card words and your independently saved replacement address in the optional current-owner field. Do not copy a node-returned owner merely to manufacture green.
25. Open the fresh replacement kit, decrypt privately and check that its owner is now current. The original kit still decrypts its old seed but its current-owner check must fail.

**Actual new-device variant:** repeat the partner path using a second disposable browser profile with no original owner key. Sign in normally to the same account, enter the saved Safe address and prepare/approve the replacement there. Keep the original profile only for the cancellation demonstration. Do not copy browser storage or seed words into the replacement profile. The actual helper recovery route still requires the Recovery Card; login alone is insufficient. The old-key test will not be available on that replacement device.

**Swissquote fallback route:** select **Recovery Card + Swissquote — 3 days**, prepare the matching request, approve it in the Desk, then tick **Swissquote video ID passed — MOCK, not a real identity check**. Starting it creates a real pending request even locally; do this only on a disposable wallet and cancel it with the current owner if you will not wait. There is no three-day fast-forward button in the UI. The public evidence has not completed that three-day route. Resolve one route before starting another; the wizard refuses a new request while any recovery remains pending.

**Old-key refusal:** **Try the old key · read-only** is only enabled when this recovery screen retained an already-unlocked old key. Navigating away/hiding the page clears that reference, and a real replacement device does not have it. If available, click it and require the actual `GS026` result before claiming refusal. It sends an `eth_call`, not a payment. Otherwise, use the already-reviewed public evidence; never paste an old owner seed into the app to enable the demonstration.

**Interrupted recovery:** sign in normally, choose the same wallet/helper and **Resume saved replacement** with its existing unlock code. Check current chain/receipt state first. If finalization succeeded but installation failed, **Check chain and install replacement** can install the saved key only after confirming it is already current. Do not blindly repeat deploy, fund, recovery-start or finalization transactions. A warning about other pending requests or incomplete registration is not “all safe”: resolve that warning using the current key and retry registration before funding.

## 8. Replace a still-available owner key — no recovery-card wait

This is different from lost-key recovery: the existing owner can approve its own replacement.

1. Ensure no saved/pending recovery remains unresolved. Unlock your current owner and enroll a working passkey first.
2. Settings → **New device unlock code**: choose the next private code and click **Prepare replacement & new kit**.
3. Inspect the new owner fingerprint/address. Privately download the replacement kit, save its code separately and tick the acknowledgement in the kit panel.
4. Keep this wallet page visible; hiding it clears the in-memory replacement seed/code and requires preparing/resuming again.
5. Click **Replace my device key with passkey**. The current owner signs and the passkey confirms the exact owner-swap transaction. Pending recoveries, if present, are cancelled first.
6. Wait for chain confirmation. Unlock the installed replacement with its new code; independently re-check the original setup against its new expected owner and verify the newest kit.

The Safe address stays the same. Every older kit is now an obsolete signing-key backup. Do not confuse recovering a login password, assisted recovery and a voluntary owner-key swap.

## 9. Read-only Demo lab and the hidden password-reset lab

### Visible V4 Demo lab

1. Select **Demo lab**.
2. Under **Explore an approval pair**, select **One helper alone**: see **Card approval missing**.
3. Select **Swissquote + partner, without the card**: see why helpers on different routes cannot substitute for the card.
4. Select **Recovery Card + one helper**: see **Required approval pair — not a completed recovery**.

This screen is an illustration. It loads no keys, obtains no signatures and runs no contract simulation. Actual refusal evidence comes from the tests/public read-only calls, not this dropdown.

### Password reset — present in the app shell, not exposed by the default V4 lab

The default `audit` flag selects the new Demo lab and hides the older authenticated mailbox/helper-collusion screen. It is not correct to promise those older buttons inside the visible V4 lab.

The signed-out **Forgot password?** path still opens the shell's MOCK reset lab:

1. Finish the main tutorial, sign out and enter your demo email.
2. Click **Forgot password?**. In the opened lab, click **Open MOCK mailbox**.
3. Select the message with **Use this local reset token**.
4. Enter a private **New login password** and click **Reset login password · MOCK**.
5. Return to Overview/sign-in and use the new password. The existing wallet still needs its own device passphrase; a password reset has not decrypted or replaced the owner key.

The mailbox is deliberately a local demonstration, not real email. Do not publish its messages/reset tokens. The legacy **Test helper-only recovery · eth_call only** button needs an authenticated wallet in that legacy screen, which the default V4 flags do not expose. Use the visible Demo lab plus recorded contract evidence; do not silently change flags during the rehearsal.

## 10. DeFi — explore the UI locally, execute only in a deliberately provisioned Sepolia session

1. Select **DeFi** and read its allow-list, shallow-liquidity, third-party-deployment and investment-risk statements.
2. Select each **Action**: **Swap USDC → EURC on Uniswap**, **Supply USDC to Compound (third-party test deployment)** and **Withdraw USDC from Compound (third-party test deployment)**.
3. Enter a small amount, at most 5 USDC. Read the explanation of exact approvals/reset-to-zero versus no approval for withdrawal.
4. On LOCAL, expect **DeFi signing is unavailable on this network** and a disabled preview. This is intentional, not a missing wallet-creation step. Do not change chain labels to bypass it.

In a separately provisioned Sepolia runtime with pinned registry, registered owner, sufficient test funds and explicit test-spend authorization:

5. Click **Preview with Swissquote**. Read the simulated effects, warnings, simulation block and effects hash. Previewing is not execution.
6. Tick **I reviewed the service’s summary and understand the risks**. Click **Confirm this exact action** only if you intend the testnet transaction.
7. Inspect the confirmed Safe receipt and, for swap/supply, the on-chain permission result. Do not claim zero allowance until the read confirms it.
8. If a result is unresolved, use **Check pending receipt (read-only)** and inspect Etherscan; never repeat an uncertain action.

The existing public evidence proves a **third-party Compound test supply**, not a proven public swap or withdrawal. No tutorial action above provisions a new Sepolia service or authorizes another public spend.

## 11. Inspect everything without another transaction

- Open the [V4 deck](<../../pitch/v4/deck.html>): eight main slides and five backups. Use its visible navigation/notes controls; consult the [presenter notes](<../../pitch/v4/presenter-notes.pdf>) and [judge card](<../../pitch/v4/judge-card.pdf>).
- Open the candidate [architecture](<../../../.worktrees/v4-ui/Docs/submission/architecture.html>) and inspect the actual wallet/Desk/helper/relayer boundaries and real/MOCK labels.
- Read [acceptance](<acceptance.md>) for the exact public create, fund, old-owner payment, recovery start, finalization and new-owner payment receipts. Those completed across retained browser sessions, not one uninterrupted take.
- Read the [submission draft](<../../../.worktrees/v4-ui/Docs/submission/SUBMISSION.md>) for business, custody, legal and bonus boundaries.
- Public Safe history shows interoperability/visibility, not demonstrated independent signing. Kit decryption/current-owner verification is not a kit sweep. The three-day route and physical hardware remain distinct from the automated proven path.

## 12. Finish safely

Clear Desk secrets and your clipboard, close private seed/code views, sign out and close the disposable browser profile. Keep the latest useful kit file/code separately only if retaining that test wallet. Stop the optional preview and local-launcher terminals with Ctrl+C. Restarting `demo:local` creates another fresh chain/account database; it does not resume this local exercise. Do not reuse the earlier wallet address/key data as if the new chain were the old one.

## Common stops

- **Buttons missing:** verify 5273/V4, not the old 5173 UI; see feature-flag limitations above.
- **Deposit disabled:** complete MOCK KYC, successful owner registration and your actual independent-check acknowledgement in Overview.
- **Signing fails:** login and key unlock are different; use the current device passphrase, not the login password or kit code.
- **Kit/finalize disabled:** re-enter the replacement code after prepare/export, download the current kit and acknowledge separate storage; hiding a tab clears recovery secrets.
- **Recovery remains unknown:** RPC error/disagreement is not “clear.” Retry read-only checks; do not proceed until the matching saved replacement and mature request are confirmed.
- **Timeout after a send:** inspect the submitted hash and chain/service status first. A timeout is not proof that no transaction happened.

Tutorial basis: current candidate screen labels, feature registry, launcher and protocol paths were inspected. The final candidate gate passed 609 tests with zero skips; this guide itself does not claim a new human rehearsal, fresh installation, physical authenticator test or public DeFi execution.
