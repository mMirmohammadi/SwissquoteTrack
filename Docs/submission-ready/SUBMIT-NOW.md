# Submit now — Swissquote track

Use the **Swissquote / Build the Swissquote Wallet** track on the event page. The event page returned HTTP405 / Human Verification to the automated reader, so exact form labels and mandatory upload fields could not be verified. Map the fields below to the form you see. You submit; nothing has been published by this agent.

## Team members
Mehrshad Mirmohammadi  
Erfan Mousavian

## Project name
Swissquote Wallet — Your key. A way back.

## Short description / tagline
A self-custody wallet with gas-sponsored payments, card-plus-helper recovery and an independent Emergency Kit—built on Safe and demonstrated on Sepolia.

## Project description — paste this

People should not have to choose between controlling their money and having a way back after losing a device. Our prototype combines a bank-familiar wallet experience with a user-controlled payment key.

The wallet is a one-owner Safe on Ethereum Sepolia. The owner key is generated locally and stored encrypted in the browser. Swissquote’s service sponsors approved transactions, so the client can send test USDC without holding ETH. Logging in authenticates the account; it does not give Swissquote the payment key.

Recovery requires a separate 12-word Recovery Card plus one helper. Two Candide recovery modules provide distinct paths: card + partner after a three-minute demo wait, or card + Swissquote after three days. Neither helper alone, nor both helpers together without the card, can satisfy either recovery threshold. The existing owner can cancel a pending recovery. An encrypted Emergency Kit and separate browser tool provide a further exit path without helper-service calls.

We demonstrated public-Sepolia wallet creation, owner-signed sponsored payment, card-plus-partner recovery after the real waiting period, and a replacement-owner payment at the same wallet address. The browser recovery evidence spans resumed sessions, not one uninterrupted take. Separate script evidence records both-helper refusal, recovery cancellation and an RPC-only Emergency Kit sweep. A separate browser run supplied test USDC to a third-party Compound III test deployment through the built-in allow-listed DeFi flow.

The prototype also includes payment previews, recipient checks, public-chain screening reads, account-to-wallet ownership proof, recovery alerts while the wallet is open, and a separate Recovery Desk. The product aims to retain the bank relationship through optional recovery assistance and fee sponsorship while allowing clients to control and leave with their assets. Subscription pricing and commercial demand remain hypotheses, not validated revenue.

Real: Safe contracts, signatures, Sepolia transactions, sponsored fees and the recorded recovery wait. Mocked: bank balances/origin, KYC, face/video identity checks and helper-key vaults. This is a hackathon prototype, not an audited production wallet or a claim of regulatory approval. The custody and Travel Rule analysis distinguishes client signatures, bank withdrawals and sponsored third-party transactions; production classification and compliance require legal and bank review.

## Technologies / tags
Ethereum; Sepolia; Safe; Candide Social Recovery Module; Solidity; TypeScript; React; Vite; Node.js; SQLite; viem; WebAuthn; WebCrypto; USDC; self-custody; account recovery.

## What we built / technical highlights
- Safe v1.4.1, one owner, with separate card-required 2-of-2 recovery paths.
- Locally encrypted owner key, independent Recovery Card tool and encrypted Emergency Kit.
- Sponsored owner-signed USDC transfers, plain-language previews and large-payment passkey approval.
- Deterministic setup and public-node verification, ownership proof and recovery cancellation.
- Built-in allow-listed DeFi with a retained test-supply receipt; no generic WalletConnect integration.

## Evidence links — paste into links/evidence field or append to description
Sponsored payment (wallet and owner needed no ETH):
https://sepolia.etherscan.io/tx/0xe3188195628404c7da0883744aa6562c45e6597fe32c636e72fb3890801dc77e

Recovery finalized after a real wait:
https://sepolia.etherscan.io/tx/0x2de7323c1e8de99119cd2ba651794e90e252c3c0729961bd8d7132485c62fa5e

Replacement owner paid from the same wallet:
https://sepolia.etherscan.io/tx/0xaf43a7e72b8f8f951fef5d68b73700525416e1581f25c44e81edc2de3053976a

Separate built-in DeFi test supply (third-party test deployment, not an official Compound market):
https://sepolia.etherscan.io/tx/0xa44904bd58728a3cdeef571a6c0aa7c23aaa5af7cad7bc618fafd2ea1b3694af

## AI disclosure — paste and add your own tools if applicable
AI coding/research assistants accessed through DeepSeek Harness were used for implementation support, parallel design and security critiques, code/test review, documentation and presentation preparation. Confirmed agent tooling included gpt-6.1-sol and Archify for diagrams. AI is not part of the wallet’s signing or recovery trust model. The human team reviewed the final submission and remains responsible for its claims. Add any additional tools/models actually used by your human team; do not invent a roster.

## Repository, demo URL and video — human action required
Repository: https://github.com/mMirmohammadi/SwissquoteTrack
IMPORTANT: last observed repository was private and the newest V4 candidate is uncommitted. Do not imply this URL already exposes the submitted V4 source. Use the clean local source snapshot included in the handoff archive; upload/publish the correct source yourself if the form needs an accessible repository. Check access in a signed-out window. No commit/push/publication was performed here.

Demo: the existing wallet is http://localhost:5273 and Recovery Desk http://localhost:5274 through your SSH tunnel. These are NOT public judge-accessible URLs. Do not put localhost in a public demo-URL field. Use your own public video URL or clearly say “live demo at judging” where the form permits.

Video: no full-demo video is currently packaged. If mandatory, supply/upload your own recording; do not submit a fake or broken URL. Do not record Recovery Card words, owner seed, kit code, passwords or developer-console secrets.

## Files to attach
- Pitch deck PDF: `Docs/pitch/technical/pitch.pdf` (the user-selected technical pitch, seven main slides).
- Speaker notes: `Docs/pitch/technical/speaker-notes.pdf` (presenter aid, not necessarily an upload). Planned delivery is 4:50; do not add an unrehearsed live demo. Solana is proposed, not implemented.
- Architecture PNG: real vs mocked components.
- Judge card PDF, if extra attachments are allowed.
- Clean source-and-submission archive if source/file uploads are accepted.
- Optional detailed audit, primarily for your review rather than the first thing judges read.

## Claims to avoid
Do not claim a current full-suite pass: historical609pass predates later UI changes; a later full run failed during recovery waiting. Latest prior scoped wallet run was54pass/1skip; this audit's mocked checks were20pass. Do not claim generic WalletConnect, real biometrics/bank integration, live attack execution from the current Demo lab, external MetaMask→Safe spending verification, production security or FINMA approval. Swissquote fallback is three DAYS, not five minutes. The three-minute partner path is the stage-demo path.

## Final form checklist
Fill your real team/contact details; choose the Swissquote track; paste name/description/AI disclosure; provide an actually accessible source/video link if required; attach deck/architecture where permitted; submit; verify the success/confirmation page and save it. If the page allows editing after initial submission, secure a valid submission before polishing optional fields—but do not assume edits remain open past the deadline.
