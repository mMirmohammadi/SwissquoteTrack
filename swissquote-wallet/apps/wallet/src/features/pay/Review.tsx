import React, { useEffect, useState } from 'react';
import { ADDRESSES, erc20Abi, hashSafeTx, type SafeTx } from '@sq/protocol';
import { formatUnits } from 'viem';
import { usdcAmount } from '../../chain';
import type { FeatureContext } from '../context';

export function displayUsdc(value: bigint): string {
  const [whole, fraction = ''] = formatUnits(value, 6).split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

export function Review({ context, review, firstTime, lookalike, relayAllowed, requiresPasskey }: {
  context: FeatureContext; review: { tx: SafeTx; recipient: string; amount: string };
  firstTime: boolean; lookalike: boolean; relayAllowed: boolean; requiresPasskey: boolean;
}) {
  const [balanceRead, setBalanceRead] = useState<{ wallet: string; tx: SafeTx; balance: bigint }>();
  useEffect(() => {
    let live = true;
    setBalanceRead(undefined);
    const wallet = context.wallet;
    if (wallet && context.clients[0]) void context.clients[0].readContract({ address: ADDRESSES.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] })
      .then(balance => { if (live) setBalanceRead({ wallet, tx: review.tx, balance }); }).catch(() => { /* Unknown balance must not become an invented number. */ });
    return () => { live = false; };
  }, [context.wallet, context.clients, review.tx]);
  const amount = usdcAmount(review.amount);
  const balance = balanceRead && balanceRead.wallet === context.wallet && balanceRead.tx === review.tx ? balanceRead.balance : undefined;
  const selfPayment = review.recipient.toLowerCase() === context.wallet?.toLowerCase();
  const after = balance === undefined || balance < amount ? undefined : selfPayment ? balance : balance - amount;
  const flag = lookalike ? 'Address warning' : !relayAllowed ? 'Not sponsored' : firstTime || requiresPasskey ? 'Check carefully' : 'Review before signing';
  const shortRecipient = `${review.recipient.slice(0, 6)}…${review.recipient.slice(-4)}`;
  return <>
    <p className="pay-hero">You send <strong>{displayUsdc(amount)} USDC</strong></p>
    <dl className="payment-review">
      <div><dt>You send</dt><dd>−{displayUsdc(amount)} USDC</dd></div>
      <div><dt>Recipient gets</dt><dd>+{displayUsdc(amount)} USDC<small>Expected if this USDC transfer succeeds</small><code title={review.recipient}>{shortRecipient}</code></dd></div>
      <div><dt>Network fee</dt><dd className={relayAllowed ? undefined : 'payment-fee-blocked'}>{relayAllowed ? 'Sponsored by Swissquote — you pay no network fee if approved. No ETH needed.' : 'Swissquote won’t pay the fee for this payment, so it can’t be sent here.'}</dd></div>
      <div><dt>Balance after</dt><dd>{after === undefined ? '—' : `${displayUsdc(after)} USDC`}<small>{balance !== undefined && balance < amount ? 'Insufficient balance in this read' : selfPayment ? 'Same-wallet transfer; balance unchanged if successful' : 'Estimate from the latest balance read, if payment succeeds'}</small></dd></div>
    </dl>
    <span className={`payment-flag ${lookalike || !relayAllowed ? 'blocked' : firstTime || requiresPasskey ? 'warning' : ''}`}>{flag}</span>
    {requiresPasskey && <p className="pay-note">Above 5 USDC, Swissquote asks for your passkey for this exact payment. Your device may use a fingerprint, face or PIN.</p>}
    <p className="pay-note">Payments can’t be reversed. When you confirm, Swissquote checks a live public sanctions list, USDC freeze status and MOCK demo entries. This preview has not cleared those checks.</p>
    <details className="payment-technical pay-details"><summary>Details</summary>
      <small>Full recipient address: <code>{review.recipient}</code></small>
      <small>Exact payment hash: {context.wallet && hashSafeTx(context.wallet, review.tx, context.chainId)}</small>
      <p>Sponsorship limits are not on-chain spending limits.</p><p>This preview is not an approval or a receipt.</p>
    </details>
  </>;
}
