# Authority and threat model

**The card is required for helper-assisted owner replacement, not for ordinary payments.** This property depends on the intended Safe/module state and trustworthy code. An independently obtained tool must verify the rules before deposit and after changes. No runtime proof of those properties was produced by this documentation lane.

## Decision and trade-off

A one-owner Safe preserves independent spending and an exit path. Two separate Candide recovery modules make the recovery card mandatory with either helper. This is not MPC or a seed split: the helpers sign replacement approvals, not the owner's payment. Compared with a plain seed wallet, recovery is assisted and delayed; compared with mandatory bank co-signing, Swissquote cannot veto every spend. Costs are EVM-only implementation, more recovery items, and trust in applications, contracts, and monitoring.

## Who can do what under the intended rules

| Actor / sufficient material | Spend now | Replace owner | Lock-out / residual risk |
| --- | --- | --- | --- |
| Current owner key | Yes; an external submitter pays gas | Owner-signed rotation; can change wallet rules | A compromised owner can drain funds, alter rules, and cancel legitimate recovery |
| Swissquote alone | No payment signature | Not without card | Can refuse sponsored gas or its recovery route; malicious app publication is a separate theft path |
| Partner alone | No | Not without card | Can refuse its recovery route |
| Swissquote + partner, no card | No | Neither module has the required pair | Can deny both assisted routes; cannot deny a valid owner/kit spend on-chain |
| Card + partner | Not immediately | Module A after 180 seconds in demo | Misuse can seize control after the wait if current owner does not cancel |
| Card + Swissquote | Not immediately | Module B after 259,200 seconds | Same delayed seizure risk; these waits are demo settings, not recommended production policy |
| Kit file + correct separate code | Yes, if it contains the current owner | Same powers as current owner | Immediate takeover; no recovery delay protects a decrypted owner key |
| Phone + email, owner key still locked | No by those possessions alone | Must still obtain card and an accepted helper | MOCK reset/face defenses are not production identity assurance |
| Phone + wallet passphrase, or stolen seed | Yes | Has owner authority | Can bypass sponsored-relay passkeys and spend before recovery |

The owner can change guardians/modules. Initial address derivation alone therefore does not establish current rules after later transactions. Check current owners, thresholds, modules, guard state, code, pending recoveries and relevant history. Helper keys in local databases are **MOCK HSM**: the isolation demonstration is real process/storage separation, not tamper-resistant custody.

## Recovery and denial of service

Monitor **both** modules. Cancel every pending recovery; a second pending module can otherwise finish later and replace a newly recovered owner. Disabling a module or changing the owner is not a substitute for cancellation. Finalization is permissionless after the contract delay. A client needs a working owner/kit and gas-funded submitter to bypass relayer refusal.

If the device is lost, card + either cooperating helper can recover. If both helpers refuse, the current kit can still exit. If the device and kit are lost and the card is unavailable, funds may be permanently inaccessible. If the chain stops or sufficient gas/RPC access is unavailable, even an intact kit cannot settle a transfer. Swissquote disappearance is survivable only if the client already saved the kit, its separate code, and an independently obtainable tool.

## Important unmitigated threats

A malicious Swissquote app can exfiltrate an unlocked seed. A malicious tool can steal card words or a decrypted kit; its independent publisher is **MOCK**, not established governance. Bookmark/content-addressed publication, reproducible builds and hardware ownership are roadmap defenses, not completed protection. A valid blockchain signature proves credential use, not that the client consented.

Public guardian lists and recovery events leak metadata. Customer-to-address mappings and MOCK face/account records must remain off-chain and access controlled. Local demo switches, CORS, and string-matching faces are not production authentication. Contract flaws, stale state, compromised RPCs and unsafe owner-signed changes remain risks; two aliases of one local RPC do not provide independent verification.

## Acceptance evidence

Before making the no-card claim, show real contract refusal for helper-only approvals on **both** modules, plus independently verified exact guardian sets/thresholds. Show genuine delay, premature-finalize refusal, old-key refusal after recovery, both-module cancellation and service-independent kit sweep. The [story source](<../../swissquote-wallet/scripts/story.ts>) encodes these intended checks, but a source read is not their execution result. See [legal analysis](<custody-travel-rule.md>) for why technical authority does not settle liability or classification.
