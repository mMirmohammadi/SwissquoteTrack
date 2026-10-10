# Seven-slide storyboard — your key, a necessary card, a way out

**Security first; evidence second; bonus features last.** This is a documentation-only slide plan, not a rendered deck or approved recording. The [five-minute script](<../submission/pitch-script.md>) is the narration source; [judge answers](<judge-questions.md>) supply optional depth. No new diagram, video, upload or hosting is needed.

## Slide 1 — Keep the relationship. Keep your payment key.

**Screen:** one sentence, three plain labels: “Your key pays · Card + helper recover · Current kit exits”.

**Speaker:** clients should not need to leave Swissquote to choose self-custody. This is a Safe-based EVM prototype, not MPC, ERC-4337 or a new guarded wallet. [Challenge source](<../desc.md#L74-L97>).

**Label:** prototype; retention benefit unmeasured. Do not imply sponsor endorsement or a launched Swissquote product.

## Slide 2 — One public address; a recorded payment

**Screen:** recorded Sepolia address, deployment and 6-USDC payment links from the [public artifact](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L40-L112>). Keep the full address readable; shorten only in decorative text.

**Speaker:** the script created, funded and paid; the EIP-1271 check proves control. TREASURY paid fees, not the service RELAYER. A “large” classification is not proof of a real browser passkey.

**Label:** recorded public contract execution; browser/service proof pending; bank identity MOCK. If later authorized live staging uses L and S, name each and announce every switch.

## Slide 3 — Three things to keep; two different sets of words

**Screen:** phone/passkey/app unlock code; **12-word Recovery Card**; Emergency Kit file + separate code. Beneath: **Advanced 24-word owner seed: can spend; NOT the Recovery Card**.

**Speaker:** the card is independently generated; it is not twelve words selected from the owner seed or a two-of-three backup share. Card words stay in a trusted saved tool. The kit restores the current owner and must be replaced after rotation.

**Evidence/limit:** [terms and responsibilities](<../submission/terms-sheet.md#L5-L17>). Never display actual words, kit code, private keys or real passkey material. Saved-tool distribution/fingerprint independence must be verified separately.

## Slide 4 — Who can replace the key?

**Screen:** “Card + partner → 180-second demo wait”; “Card + Swissquote → three-day wait”; “Swissquote + partner, no card → refused”. Annotate: “Separate modules, not any two of three”. Show the decoded contract refusal.

**Speaker:** a user-held credential is necessary under the configured rules, not proof of human consent. Card + a fooled helper can install an attacker owner after the wait. An unlocked owner/24-word thief can spend and cancel. A malicious app publisher can steal the owner key.

**Evidence/limit:** [no-card read-only checks](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L175-L200>); [custody configuration/threat model](<../submission/threat-model.md>). These are not mined attacks, throwaway-wallet coverage or service authorization attestation. Production waits undecided.

## Slide 5 — Protection has boundaries; DeFi stays reversible

**Screen:** mined both-module cancel receipt; smaller status strip: “DeFi: real read-only simulations; mined execution pending”.

**Speaker:** cancellation clears both requests. Timely alerts and reliable sponsored delivery still need separate evidence. Fee rules do not prevent self-funded owner transactions. If available and verified, show a preview without signing; otherwise show only the status strip.

**Evidence/limit:** [cancel record](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L158-L174>); [simulation source record](<../plans/v3/build-plan.md#L246-L254>); [bonus checklist](<../submission/bonus.md>). Allow-listed means fee sponsorship after technical checks, not suitability. Compound is a third-party test deployment. Not a bank deposit, not depositor-protected, not investment advice. No public DeFi/gasless bonus completion asserted.

**Fallback:** drop only the preview; enlarge the refusal/cancel beat. Keep the same core pitch and pending label.

## Slide 6 — Recover the same address; retire the old key; leave independently

**Screen:** same address before/after, finalize receipt, “Old key refused (read-only GS026)”, “Current kit swept 3 USDC; RPC + FUNDER gas”.

**Speaker:** a real chain wait elapsed for module A. A new kit is essential: the old one no longer owns this wallet. Exit needs working RPC, trustworthy tooling, current kit + code and funded gas; no bank/partner approval is needed in this script path.

**Evidence/limit:** [maturity, finalize, kit checks and sweep](<../../swissquote-wallet/evidence/sepolia/full-2026-10-10T19-28-59Z.json#L216-L283>). Module B was started and cancelled, not publicly completed. USDC sweep coverage is not all-token support; RPC-only script is not a browser shutdown experiment or offline settlement.

## Slide 7 — A paid relationship, not a custody promise

**Screen:** “Assumed CHF 4.90/month → CHF 58.80 gross/year”; below: “Before costs · Demand unmeasured · Security + counsel review before pilot”.

**Speaker:** Swissquote's proposed role is helper and fee sponsor, not ordinary owner. Conditional recovery authority, AML/Travel Rule intermediary status and FinSA applicability remain counsel questions. Proposed terms are best-efforts, not a guarantee.

**Evidence/limit:** [business case](<../submission/business-case.md#L18-L38>), [legal position](<../submission/custody-travel-rule.md>), [draft terms](<../submission/terms-sheet.md>). Optional economics only if asked: 690,828 trading **accounts, not unique clients**, at assumed 1% paid adoption yields approximately CHF 406,207 gross/year. Original company financial sources are reused, not freshly verified by L11. No net margin or adoption forecast.

## Local recording plan, only if separately approved

Capture only an already-verified walkthrough; put “Recorded Sepolia script” or “Local browser demo” on every relevant frame. Use receipt/address views, public refusal text and the conceptual three-items slide; never capture secret entry. End with pending-browser/DeFi and MOCK labels. Public visibility/upload is prohibited without new explicit approval. Until capture is approved and exists, this storyboard is the fallback asset; do not promise a video.
