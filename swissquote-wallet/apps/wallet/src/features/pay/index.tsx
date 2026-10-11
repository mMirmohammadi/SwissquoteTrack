import React, { useEffect, useState } from 'react';
import { MoveBack } from './MoveBack';
import { classifyTransaction, type SafeTx } from '@sq/protocol';
import { Review } from './Review';
import { type Address } from 'viem';
import { paymentTx, validatedAddress } from '../../chain';
import { updateDeviceEvidence } from '../../storage';
import type { FeatureProps } from '../context';

// Vite-only stylesheet load; Node tests have no CSS loader and no import.meta.env.

export default function Pay({ context }: FeatureProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('2');
  const [suffix, setSuffix] = useState('');
  const [review, setReview] = useState<{ tx: SafeTx; recipient: Address; amount: string }>();
  const [past, setPast] = useState<readonly Address[]>(context.device?.pastRecipients ?? []);
  useEffect(() => { setReview(undefined); setSuffix(''); setPast(context.device?.pastRecipients ?? []); }, [context.wallet, context.device?.owner]);
  const firstTime = !!review && !past.some(address => address.toLowerCase() === review.recipient.toLowerCase());
  const lookalike = !!review && past.some(address => address.toLowerCase() !== review.recipient.toLowerCase() && address.slice(0, 6).toLowerCase() === review.recipient.slice(0, 6).toLowerCase() && address.slice(-4).toLowerCase() === review.recipient.slice(-4).toLowerCase());
  const classification = review && context.wallet ? classifyTransaction(context.wallet, review.tx) : undefined;
  const stage = review ? 2 : 1;
  return <section className="panel pay-flow" data-testid="pay-preview">
    <ol className="pay-steps" aria-label="Progress">
      {['Amount & recipient', 'Check', 'Send'].map((label, index) => <li key={label} className={index + 1 < stage ? 'done' : index + 1 === stage ? 'current' : undefined} aria-current={index + 1 === stage ? 'step' : undefined}><span className="pay-step-number">{index + 1 < stage ? '✓' : index + 1}</span>{label}</li>)}
    </ol>
    {!review ? <form className="pay-entry" onSubmit={event => { event.preventDefault(); void context.run('Preparing payment', async () => { if (!context.wallet) throw new Error('Create or recover your wallet first.'); const address = validatedAddress(recipient); setReview({ tx: await paymentTx(context.wallet, address, amount), recipient: address, amount }); setSuffix(''); }); }}>
      <h2>Send money</h2>
      <p className="pay-lead">Gasless payments · sponsored by Swissquote. You sign; Swissquote pays the network fee for approved payments. No ETH needed in your wallet.</p>
      <label className="field"><span>Recipient wallet address</span><input value={recipient} onChange={event => setRecipient(event.target.value)} required placeholder="0x…"/></label>
      <div className="pay-shortcut"><MoveBack context={context} onRecipient={setRecipient}/></div>
      <label className="field pay-amount"><span>Amount in USDC</span><input value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" required/></label>
      <button className="primary pay-primary" disabled={context.busy || !context.wallet}>Review payment</button>
      <details className="pay-details"><summary>Details</summary><small>Swissquote pays approved network fees. Your phone signs the payment on this device.</small></details>
    </form> : <div className="pay-review">
      <h2>Check before you send</h2>
      <Review context={context} review={review} firstTime={firstTime} lookalike={lookalike} relayAllowed={!!classification?.relayAllowed} requiresPasskey={!!classification?.requiresPasskey} />
      {lookalike && <div className="status warning" role="alert">Look-alike address: this destination has the same beginning and ending as a past recipient, but the full address differs. Confirm the entire address through a trusted channel.</div>}
      {firstTime && <div className="pay-first-time"><strong>First time sending here</strong><p>Type the last 4 characters of the recipient’s address to confirm you copied it right.</p><label className="field"><span>Last 4 characters</span><input value={suffix} onChange={event => setSuffix(event.target.value)} maxLength={4} autoComplete="off" aria-label="Recipient last four characters"/></label></div>}
      <button className="primary pay-primary" disabled={context.busy || !classification?.relayAllowed || (firstTime && suffix.toLowerCase() !== review.recipient.slice(-4).toLowerCase())} onClick={() => { void context.run('Signing and submitting payment', async () => { await context.relay(review.tx, { source: 'pay' }); const recipients = [...new Set([...past, review.recipient])].slice(-100); setPast(recipients); setReview(undefined); if (context.device) { await updateDeviceEvidence(context.device.id, { pastRecipients: recipients }); await context.refresh(); } }); }}>{classification?.requiresPasskey ? 'Confirm with passkey & send' : 'Sign & send'}</button>
      <button className="text-button" onClick={() => setReview(undefined)}>Edit payment</button>
    </div>}
  </section>;
}
