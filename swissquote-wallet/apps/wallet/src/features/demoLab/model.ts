/** Read-only policy illustration. This is not a signature or contract simulation. */
export const DEMO_CASES = [
  { id: 'helper-only', title: 'One helper alone', outcome: 'Card approval missing', explanation: 'Neither recovery route accepts a helper approval alone. The independent Recovery Card must also approve the exact public request.' },
  { id: 'helpers-together', title: 'Swissquote + partner, without the card', outcome: 'Card approval still missing', explanation: 'The two helpers belong to different recovery routes. Their approvals cannot replace the card in either configured route.' },
  { id: 'card-and-helper', title: 'Recovery Card + one helper', outcome: 'Required approval pair — not a completed recovery', explanation: 'The card and chosen helper must sign the same wallet, chain, module, replacement owner and nonce. The request must then pass contract checks, its waiting period and finalization.' },
] as const;
export const DEMO_SAFETY_NOTICE = 'Read-only explanation: no keys loaded, no helper calls, no approvals signed and no transactions sent. This screen is not evidence of a contract rejection.';
