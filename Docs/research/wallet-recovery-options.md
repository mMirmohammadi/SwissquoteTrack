# Wallet recovery without institution-controlled spending

## Conclusion

Recommend designing recovery of **account control**, not institutional retrieval of plaintext seed phrases. Stable-address replacement of compromised signing keys requires account rules that the chain enforces: a programmable wallet account or native key rotation. It is not a universal property of ordinary key-derived accounts, and ERC-4337 is not required for the general idea. ERC-4337 supplies account-abstraction transaction infrastructure; recovery permissions must be implemented separately. [Account model][accounts] [ERC-4337 specification][4337] [Native rotation example][aptos]

A conventional threshold that lets an institution and a trusted party recover an unrestricted spending secret without any user-held factor also lets those parties spend. Likewise, recovery guardians able to select an arbitrary new owner can select themselves. This is a consequence of the authority granted by the proposed design, not a limitation cured by a particular cryptographic library.

This is research and architectural analysis, not an approved implementation or a security audit. No production wallet, smart contract, or recovery flow was tested.

## Scope and assumptions

The requested properties are user-only spending, assisted recovery after loss, protection after phrase theft, minimal institutional data, retention of the existing address where possible, and an independent emergency exit. The proposed participants are the user, the institution, and an independent trusted party. No Ethereum-specific standard is assumed to be mandatory.

“Only the user can transact” is interpreted as only the user being able to **authorize spending**. A relayer or guardian may still submit a transaction or pay its network fee. This distinction matters for smart accounts and recovery transactions.

There are two different incidents. Loss means the user cannot access a key but nobody else necessarily has it. Theft means an attacker may already have a working signing key. Restoring a backup addresses loss; it does not remove the attacker's copy. Nothing discussed here reverses transfers already finalized under the chain's rules.

“Same address” means retaining an account's address on one chain through recovery, not obtaining an identical address across unrelated chains.

## Why the proposed guarantees conflict

### Recovery of a bearer secret grants spending authority

A seed or private key that independently authorizes spending is a bearer credential: whoever obtains it has that authority. Encrypting delivery to a new device protects delivery, but does not by itself prove that the recipient device belongs to the original user. If the institution and trusted party can choose the replacement recipient without a surviving user-held credential, they can choose an attacker-controlled recipient instead. [Ordinary Ethereum account example][accounts]

For ordinary two-of-three signing or unencrypted-secret reconstruction with participants user, institution, and trusted party, every pair reaches the threshold. The institution alone cannot spend; the institution plus trusted party can. An application-level promise that a pair will only perform recovery is not a cryptographic prohibition on spending. [Threshold signing][frost] [Secret reconstruction][slip39]

A smart-account restriction allowing guardians only to change the owner is narrower than direct transaction permission, but unrestricted owner replacement still permits indirect takeover. Delays, alerts, independent identity checks, and cancellation can reduce this risk; they do not prove that guardians can never take control.

### Stable-address recovery is not stable-address revocation

Restoring the same seed, passphrase, derivation configuration, and account state can restore the same ordinary addresses. Refreshing MPC shares can preserve the same combined signing key. Neither operation invalidates a full signing key already copied by an attacker. Even a complete old threshold of retained shares may remain sufficient for the unchanged combined key. Safe share refresh depends on the protocol, secure deletion, and the assumed number of compromised participants. [BIP-39][bip39] [MPC key lifecycle][mpc]

For fixed-key accounts, a genuinely new key normally implies a different address or spending condition, so migration is necessary. A wallet server cannot impose a revocation that validators do not enforce. Where account authorization can change independently of the address, the old key can instead be removed from that account's accepted signers. Aptos provides a native example; smart contracts provide a programmable one. Native rotation still needs a valid authorization path and is not automatic recovery after every key has been lost. [Account model][accounts] [Aptos key rotation][aptos]

## What each method does

### Seed phrases

A mnemonic is a human-readable backup used to derive a wallet seed. The seed produces signing keys through the wallet's derivation scheme. Correct restoration requires the appropriate passphrase, derivation paths, and wallet configuration, not merely recognizing the word list. BIP-39 defines a common mnemonic-to-seed format; it is not used by every chain or wallet. [BIP-39][bip39]

A seed backup is portable and useful for recovering the same keys, but theft of a sufficient spending secret lets an attacker use those keys. Changing the wallet password or creating a different phrase does not revoke the old keys. For an account whose authorization is programmable, a seed-derived key can instead be just one replaceable signer. [Account model][accounts]

### Shamir secret sharing

Shamir secret sharing divides a secret into mathematical shares. A configured threshold reconstructs the secret; fewer shares reveal no information about it under the scheme's assumptions. This is not the same as cutting a mnemonic's words into several pieces. A backup system can share a seed or an encryption key protecting a backup. [SLIP-39 algorithm and motivation][slip39]

During conventional reconstruction, the complete secret exists at the reconstruction endpoint. It should be a user-controlled, trusted endpoint rather than an institutional server. A threshold of parties that already possesses enough unprotected shares can also reconstruct elsewhere. Extra encryption helps only if the decryption factor is not available to the same coalition.

### SLIP-39

SLIP-39 is a standardized mnemonic format and recovery scheme built around Shamir sharing. It specifies share metadata, checksums, group thresholds, and passphrase-based protection. It solves interoperability and backup-format problems, not on-chain authorization or revocation. [SLIP-39][slip39]

SLIP-39 is not simply a split BIP-39 phrase. The standard targets backup of a master seed, and an arbitrary recovered seed cannot generally be converted back into the original BIP-39 words. Wallet support and round-trip recovery must be tested. If literal recovery of the original phrase is required, the design must deliberately preserve that representation rather than assume standard SLIP-39 backup preserves it. [SLIP-39 compatibility discussion][slip39] [BIP-39 derivation][bip39]

### MPC and threshold signatures

Secure multiparty computation, or MPC, is a broad family of techniques for computing with private inputs. Threshold signing is a wallet application: enough participants jointly create a valid signature using their shares without assembling the full private key during normal signing. Distributed key generation can also avoid creating a complete key at setup. The resulting signature can appear to the chain like an ordinary single-key signature. [FROST][frost] [MPC protocols][mpc]

MPC supports broad multi-chain integration, but the protocol and signature encoding must match each chain. Threshold ECDSA and Schnorr/EdDSA protocols are not interchangeable; FROST is a Schnorr threshold protocol, not a universal ECDSA replacement. Matching a curve alone is insufficient. Key derivation, transaction encoding, and signing domain separation also require chain-specific integration. [FROST][frost] [MPC integration responsibilities][mpc]

Share refresh preserves the combined key and can replace shares under the protocol's security assumptions. It does not revoke a leaked full key. A two-of-three arrangement does not make the user mandatory: either non-user party can cooperate with the other to reach the threshold. MPC software also does not remove the need to secure peers, shares, backups, and authorization policy. [MPC key lifecycle][mpc]

### Passkeys and WebAuthn

A passkey is a public-key credential held by an authenticator, such as a platform authenticator or security key. WebAuthn is the API and protocol through which an application requests and verifies authentication assertions. Credentials are scoped to a relying party, which helps resist phishing on unrelated sites. User verification can use a local PIN or biometric; the biometric is not the blockchain key. Credentials may be device-bound or backed up/synced, depending on the authenticator. [WebAuthn][webauthn]

A passkey can authorize a smart account whose verifier understands its assertion, or authenticate access to a separate wallet-key operation. Ordinary WebAuthn authentication does not automatically encrypt or recover wallet keys. On supported platforms, the PRF extension can provide secret material from which a key-encryption key is derived; envelope encryption can then protect a separate wallet secret. Support must be tested across the intended authenticators, browsers, and operating systems. [WebAuthn][webauthn] [PRF guide][prf]

Passkeys do not automatically supply a provider-independent emergency exit. Recovery must account for loss of the authenticator, loss of access to the passkey-sync provider, and loss of the application's relying-party domain. A second passkey in the same sync account may share the same failure mode. An independent offline recovery credential can address that dependency. Origin binding also does not make a compromised legitimate wallet frontend trustworthy. These are design consequences of the WebAuthn trust boundary. [WebAuthn][webauthn]

### Smart accounts, native rotation, and ERC-4337

A smart account holds assets at an address controlled by account logic rather than one permanently fixed key. Properly designed rules can separate spending from recovery and allow owner changes, guardian approvals, freezes, delays, or restricted emergency transfers. The account address can remain stable while its accepted signers change. These features must be deliberately implemented and reviewed; smart accounts do not automatically have them. [Account model][accounts] [ERC-4337 verification model][4337]

ERC-4337 describes infrastructure including UserOperations, an EntryPoint, bundlers, and optional gas sponsorship. It does not specify a universal recovery policy or revoke seed phrases by itself. A contract wallet can implement signer rotation without using ERC-4337. A chain may also expose native rotation, as Aptos does. [ERC-4337][4337] [Aptos][aptos]

Removing a seed-derived signer stops it controlling the configured smart account once the change takes effect. It does not invalidate the seed globally, protect other accounts derived from it, or automatically turn a pre-existing ordinary address into a recoverable contract address. Assets must be held under the intended account rules from the outset, or explicitly migrated into them. [Account model][accounts]

## Recommended policy, subject to user approval

Separate the everyday spending credential from an independent user-controlled recovery credential. Let U denote the everyday credential, R the offline recovery credential, I the institution, and T the trusted party.

Normal spending requires U. Assisted recovery requires **R AND (I OR T)** and binds approval to the exact account, chain, new owner, and fresh recovery request. I plus T without R must not suffice. For programmable accounts, enforce the access structure in the account rather than relying only on a backend policy. The recovery credential must not be derived solely from the possibly stolen everyday seed or stored only on the lost everyday device.

This policy is a recommendation derived from the desired authority boundary, not a ready-made audited protocol. It means losing both U and R can make recovery impossible. Redundant user-controlled recovery devices can improve availability, but if every user-only factor is lost, someone else must be trusted with effective takeover authority to recover at all.

If recovery after total loss of all user factors is a higher priority, use guardian-assisted owner replacement with explicitly disclosed trust assumptions. The honest promise is that the institution alone cannot spend, not that the institution and recovery partners are cryptographically unable to take over.

Use chain-specific enforcement behind a common product experience. Prefer account-level recovery and revocation where supported. For fixed-key accounts, use audited encrypted backup or threshold signing for loss recovery, and plan migration for full-key compromise. Do not advertise universal stable-address revocation.

## Institutional data and security

With an on-chain recovery policy, the institution need not store user seeds. It can retain minimal account/credential identifiers and recovery configuration, while protecting its own guardian signing key. With encrypted backup, it may store authenticated ciphertext and necessary public metadata; no server-held factor should suffice to decrypt the backup if that would violate the custody goal. Public addresses and credential metadata can still be privacy-sensitive. [WebAuthn privacy and verification][webauthn] [PRF envelope encryption][prf]

Minimal data lowers breach impact; it does not eliminate security work. Guardian keys, recovery-recipient selection, software delivery, availability, and audit trails remain security-sensitive. A compromised frontend can mislead users or target locally decrypted material. MPC explicitly leaves peer authentication, transport, storage, access policy, backup, and incident response to the integrating application. [MPC responsibilities][mpc]

## Emergency kit

Provide a user-controlled kit containing an independent recovery credential; enough public configuration to reconstruct the wallet, including chains, account addresses, derivation paths or account-policy details; and tested instructions plus independently available recovery software. Include the public configuration needed by the chosen backup format. Never place all effective recovery factors in one institutional system.

For a smart account, the kit may exercise a preconfigured recovery or restricted evacuation path. For an ordinary account, it may reconstruct signing capability and move assets to fresh keys. A route restricted to a precommitted user-controlled destination can limit a helper's ability to redirect funds, although it still grants authority to trigger that particular move.

Do not promise an atomic all-chain sweep. Gas, token enumeration, NFTs, pending transactions, chain availability, and locked or staked positions can require separate handling. An active thief may transact before a recovery or freeze is finalized. A delay alone does not protect funds while a stolen key remains able to spend; any freeze or spending limit must already be enforceable by the account's rules.

## Acceptance evidence before implementation approval

The next decision is whether the institution and trusted party may jointly recover after the user loses every user-held factor. This determines the custody claim and the recovery policy.

A later prototype should demonstrate successful recovery to a fresh user credential; continued spending by the legitimate user; rejected spending or owner replacement by unauthorized coalitions; rejection of the old signer after rotation on supported accounts; emergency recovery with the institutional service unavailable; and accurate address/asset restoration from the documented kit. Test stale requests, altered recovery recipients, replay across chains, lost devices, compromised shares, and attacker activity during a recovery delay.

Stop this research task after explaining the mechanisms, exposing the incompatible guarantees, presenting the conditional recommendation, and recording primary sources. Selecting target chains, an audited implementation, and operational/legal custody requirements remains future work.

## Primary sources

[accounts]: https://ethereum.org/en/developers/docs/accounts/
[4337]: https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-4337.md
[aptos]: https://aptos.dev/build/guides/key-rotation.md
[bip39]: https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039.mediawiki
[slip39]: https://raw.githubusercontent.com/satoshilabs/slips/master/slip-0039.md
[frost]: https://www.rfc-editor.org/rfc/rfc9591.html
[mpc]: https://raw.githubusercontent.com/coinbase/cb-mpc/master/README.md
[webauthn]: https://www.w3.org/TR/webauthn-3/
[prf]: https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html
