import React from 'react';
import { ADDRESSES, MODULE_WAITS } from '@sq/protocol';
import { clock, SAFETY_MARGIN, secondsLeft, type Pending, type Snapshot } from './core';

export function Countdown({ pending, snapshot, unavailable = false }: { pending: Pending; snapshot: Snapshot; unavailable?: boolean }) {
  if (unavailable || !snapshot.certain) return <p className="polish-warning">Countdown unavailable — the public nodes have not confirmed the current wait. The last known request may still be active.</p>;
  const left = secondsLeft(pending.executeAfter, snapshot.timestamp);
  const total = BigInt(pending.module.toLowerCase() === ADDRESSES.moduleA.toLowerCase() ? MODULE_WAITS.A : MODULE_WAITS.B) + SAFETY_MARGIN;
  const bounded = left > total ? total : left;
  return <div className="recovery-countdown">
    <strong className="countdown-value">{clock(left)}</strong>
    <p>{left ? 'left until the wallet can move — not an automatic key change' : 'The waiting period is over. Finishing still needs a fresh chain check.'}</p>
    <progress max={Number(total)} value={Number(total - bounded)} aria-label="Recovery waiting period elapsed" />
    <details><summary>Details</summary><small>Updated every 15 seconds from the blockchain clock at block {snapshot.blockNumber.toString()}. Includes the 15-second safety margin.</small></details>
  </div>;
}
