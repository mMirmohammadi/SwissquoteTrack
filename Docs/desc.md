# BSA — The Hackathon: descriptions and resources

## Source status

**The Swissquote track brief is now included below, from the user-supplied Word document and pasted description.** The document also contains the custody-model examples and judging tables omitted from the pasted text.

Requested web source: <https://dorahacks.io/hackathon/bsa-the-hackathon/tracks>.

The DoraHacks tracks page and hackathon landing page returned HTTP 405 with a **Human Verification** CAPTCHA when fetched. The supplied brief has been transcribed from [Swissquote Wallet Challenge_EPFL Hackathon_Oct2026.docx](<Swissquote Wallet Challenge_EPFL Hackathon_Oct2026.docx>); it has not been independently compared with the live DoraHacks page.

The event background and schedule below come from the organizer's public event website and its linked Luma registration page. They remain supplementary sources, not replacements for the track brief.

## Event description

The Hackathon is organized by the **Blockchain Student Association at EPFL**, in the **BC Building, EPFL, Lausanne / Ecublens, Switzerland**.

The [Luma event description](https://luma.com/d5gqew38) describes a **30-hour hackathon** focused on building innovative solutions in **DeFi risk and self-custody wallets**, across multiple tracks. It lists **Belem Capital** and **Swissquote** as sponsors.

The supplied Swissquote brief identifies its challenge as **Build the Swissquote Wallet**, a self-custody wallet prototype. Its requirements are reproduced below.

### Participation and support

According to the [registration page](https://luma.com/d5gqew38):

- Solo participation is allowed.
- Teams may have a maximum of **5 people**; **3 people** is the recommended team size.
- Registration requires host approval.
- Food and snacks are provided during the event.
- Club members and senior developers from sponsors provide hands-on support.
- The page advertises **more than USD 5,700** in prizes; the organizer website states **USD 5,700 total**. Neither fetched page provides a track-level allocation.

## Published event schedule

The [organizer website](https://hackathon.bsaepfl.ch/) currently advertises **10–11 October 2026**, from Saturday **09:00** to Sunday **15:00**, with all program times in **CEST**.

| Day | Time (CEST) | Activity |
| --- | --- | --- |
| Saturday, 10 October | 09:00 | Registration and breakfast |
| Saturday, 10 October | 10:00 | Opening ceremony |
| Saturday, 10 October | 10:15 | Hacking starts |
| Saturday, 10 October | 12:30 | Lunch |
| Saturday, 10 October | 18:30 | Dinner |
| Sunday, 11 October | 00:00 | Midnight snack |
| Sunday, 11 October | 07:00 | Breakfast |
| Sunday, 11 October | 10:00 | Hacking ends and submissions |
| Sunday, 11 October | 10:30 | Judging starts |
| Sunday, 11 October | 13:00 | Judging ends |
| Sunday, 11 October | 13:30 | Closing ceremony and awards |
| Sunday, 11 October | 15:00 | Event ends |

This is the organizer website's published schedule, not a verified DoraHacks submission deadline. Confirm the relevant event edition and official submission cutoff on DoraHacks. Search-engine snippets showed a different historical event description, so they were not used as authoritative dates or rules.

## Official links and documents inventory

| Resource | URL | Retrieval status / purpose |
| --- | --- | --- |
| Official tracks and submission information | <https://dorahacks.io/hackathon/bsa-the-hackathon/tracks> | Live page blocked by human verification; Swissquote brief supplied by the user |
| Swissquote wallet challenge brief | [Word document](<Swissquote Wallet Challenge_EPFL Hackathon_Oct2026.docx>) | User-supplied source; text and both tables transcribed below |
| DoraHacks hackathon landing page | <https://dorahacks.io/hackathon/bsa-the-hackathon> | Blocked by human verification |
| Organizer event website | <https://hackathon.bsaepfl.ch/> | Retrieved; event details, schedule, sponsors and registration link |
| Luma registration and event description | <https://luma.com/d5gqew38> | Retrieved; participation rules, broad themes and link to official tracks |
| Blockchain Student Association | <https://www.bsaepfl.ch/> | Organizer reference; not independently reviewed |
| Swissquote | <https://www.swissquote.com/> | Sponsor reference; not a track brief |
| Belem Capital | <https://www.belemcapital.com/> | Sponsor reference; not a track brief |

**Available track file:** The user-supplied Word brief is preserved alongside this document. No additional track-specific PDFs, datasets, starter repositories, SDK documents, or attachments have been retrieved.

## Swissquote track — Build the Swissquote Wallet

The following is a transcription of the supplied brief, with Markdown headings, lists and tables added for readability. The legal primer is the brief's simplified guidance, not independently verified legal advice.

### The challenge

Build the self-custody wallet Swissquote could launch tomorrow. In this Swissquote track, design and build a working prototype that lets a Swissquote client hold their own keys without losing the safety, simplicity and compliance they expect from a Swiss bank.

Today, clients who want self-custody withdraw their crypto to an external wallet and leave the Swissquote ecosystem. Your wallet should give them a better option: their keys, their control, but one step away from their Swissquote account.

The topic is deliberately open. We value engineering first, but the best projects will also show that their wallet could legally exist in Switzerland and that it makes business sense for Swissquote.

### Technical constraints

**Don't reinvent cryptography.** Use established open-source libraries and SDKs (MPC/threshold-signature libraries, Safe, ERC-4337 tooling, WebAuthn/passkeys). Homemade crypto will be penalized, not rewarded.

**Mocking is fine if it's honest.** Anything you can't build during the hackathon (a bank backend, a compliance provider, a key-share server) can be mocked, as long as it's clearly labeled in your demo and README. A mocked share holder must run as a separate process with its own storage, and the client app must never hold its share.

### Required topics

Every team must cover the six topics below. Your demo must show one end-to-end story: **create a wallet → log in and sign a transaction → lose the wallet or its keys → recover access**.

1. **Custody model decision.** Choose a model and defend it. There is no single right answer; we judge the quality of the reasoning. Include pros, cons and a short threat model: who could steal funds, who could lock the client out, and could Swissquote, alone or together with a partner, move the funds without the client?
2. **Architecture.** A diagram of your components (client app, backend services, key storage, smart contracts, chain) and what talks to what. Make clear which parts are real and which are mocked.
3. **Wallet creation.** How a Swissquote client gets a wallet: where keys or key shares are generated, where they live, and how the wallet is linked to the client's existing identity.
4. **Authentication.** How the client proves who they are before signing: passkeys, biometrics, device binding, 2FA, or a mix. Show how a high-value transaction differs from a small one, if it does.
5. **Recovery.** What happens when the wallet or its keys are lost, stolen or destroyed, whether it lives in a phone app, a browser or a hardware device. Who is involved, how long it takes, and what stops an attacker from using the same process. Also show how the client gets their funds back if Swissquote's services are permanently gone. Bonus credit if your demo shows the recovery process refusing an attacker who has stolen the client's phone and email.
6. **Business case.** What Swissquote gains from offering this wallet: revenue, keeping assets in its ecosystem, new clients or lower costs. A paragraph is enough, but it has to be concrete.

At minimum, the transaction in that story must be **signed and sent to a blockchain (a testnet is fine)**. Everything beyond that is where you stand out.

To get you started, these are the common custody models. Combinations are allowed and often stronger.

| Model | How it works | Questions to answer |
| --- | --- | --- |
| Custodial account | Swissquote holds the keys | Is it still a "wallet"? What does the client gain? |
| Seed phrase | 12 or 24 words generate the keys; the client stores them | Will a typical Swissquote client keep the phrase safe? |
| MPC / threshold signatures | The key is split into shares (client, Swissquote, backup); no one holds it whole | Who holds which share? Does Bitcoin work too? (Hint: yes. MPC signs for any chain, unlike ERC-4337, which is EVM-only.) |
| Smart-contract account (ERC-4337) | An on-chain account controlled by passkeys and rules | EVM-only? Who pays gas? What does recovery look like on-chain? |
| Split backup (Shamir /SLIP-39) | The seed is split into shares (for example, client paper, Swissquote, an independent partner); any two of the three restore it | Can Swissquote and the partner restore it without the client? Where is the seed put back together? |

### Bonus topics

Optional. Each topic you implement well earns extra points. Bonus points count only if the **create → sign → recover** works end to end.

**Gasless transactions.** Clients shouldn't need to buy the chain's native token (like ETH) just to move their USDC. Sponsor fees with a paymaster, meta-transactions, EIP-7702 or the equivalent on your chain, and explain who pays and how abuse is prevented.

**Compliant dApp interaction.** Let clients use DeFi without exposing them, or Swissquote, to scams and sanctions risk. Ideas: an approved list of dApps, screening addresses against sanctions lists, simulating a transaction and showing its effects in plain language before signing, extra checks above a threshold.

### Legal primer for engineers

You don't need to be a lawyer, but your design has to survive a conversation with one. Two facts to start from (simplified, not legal advice):

**Custody depends on who can move the funds.** If Swissquote can move the client's crypto on its own, it is custody, with the capital and segregation rules of a bank. If it cannot act alone, the wallet is closer to software. Your custody model decides which side you are on, so say which and why. Control shared with a third party (Swissquote plus a partner together) is a grey zone. If your design allows it, argue why it is or isn't custody.

**Self-hosted wallets need proven ownership.** The Travel Rule requires crypto transfers to carry information about who sends and who receives. Switzerland applies it strictly: under FINMA's rules, a Swiss bank may only send crypto to, or receive it from, an external wallet after verifying who owns it. A wallet that Swissquote provides could make this check automatic. How would yours do it? And when the client pays a third party from your wallet, is Swissquote the sending institution at all?

### What your submission should cover

For this track, your project description should cover:

- your custody model decision and threat model;
- the architecture diagram, with mocked parts marked;
- how your wallet handles custody and the Travel Rule (see the legal primer);
- how Swissquote would make money from it, or what it would gain;
- which bonus topics you tackled;
- which AI tools you used, and what you used each one for.

### How we judge

Swissquote's judges score projects in this track out of **100, plus up to 20 bonus points**:

| Criterion | Points | What judges look for |
| --- | --- | --- |
| Technical implementation | 35 | The create → sign → recover story works end to end; clean, sensible code |
| Security and custody design | 20 | A well-argued custody model, a credible threat model and recovery that can't be abused |
| Legal feasibility | 15 | Realistic reasoning about custody and wallet ownership verification |
| Business case | 15 | Clear value for clients and for Swissquote: revenue, retention or cost savings |
| User experience and pitch | 15 | A non-technical client could use it; the demo tells a clear story |
| Bonus topics | up to +20 | Up to 10 points each for gasless transactions and compliant dApp interaction; only awarded if the core story works end to end |

## Information not supplied in the brief

The supplied brief does not specify a Swissquote prize allocation, an exact submission deadline or platform format, sponsor support channels, additional linked technical resources, or separate eligibility and licensing conditions. Confirm those with the organizers or the live DoraHacks page; do not infer them from the supplementary event schedule.
