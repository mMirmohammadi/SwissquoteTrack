import { useState } from 'react';
import { buildCancelRecoveryTx, safeAbi } from '@sq/protocol';
import type { FeatureProps } from '../context';
import { TEST_IDS } from '../test-ids';
import { confirmedOn } from '../../chain';
import { addressGroups, pollRecovery, RECOVERY_MODULES, remaining } from '../recovery/core';
import { Countdown } from '../recovery/Countdown';
import { useRecoveryPoll } from './useRecoveryPoll';

export default function Feature({ context }: FeatureProps) {
  const { snapshot, error } = useRecoveryPoll(context.clients, context.wallet, context.chainId);
  const [acknowledged, setAcknowledged] = useState('');
  if (!context.wallet) return null;
  const identity = snapshot?.pending.map(p => `${p.module}:${p.newOwners.join(',')}:${p.executeAfter}`).join('|') || '';
  async function stop() {
    const wallet = context.wallet;
    if (!wallet) throw new Error('Choose the wallet to protect first.');
    if (!context.device || context.device.wallet?.toLowerCase() !== wallet.toLowerCase()) throw new Error('Unlock the current owner device to cancel. Login alone cannot cancel recovery.');
    const fresh = await pollRecovery(context.clients, wallet, context.chainId);
    if (!fresh.pending.length) {
      if (!fresh.certain) throw new Error('Cannot confirm whether recovery is pending. Retry with both public nodes.');
      throw new Error('Both nodes report no pending recovery. Nothing was cancelled.');
    }
    const rpc = context.clients[0];
    const owners = await rpc.readContract({ address: wallet, abi: safeAbi, functionName: 'getOwners' });
    if (owners.length !== 1 || owners[0].toLowerCase() !== context.device.owner.toLowerCase()) throw new Error('This device is no longer the sole owner. Use the replacement device; this key cannot cancel.');
    const nonce = await rpc.readContract({ address: wallet, abi: safeAbi, functionName: 'nonce' });
    const modules = [...new Set(fresh.pending.map(p => p.module))];
    // context.relay signs with the unlocked owner. Protective classification controls sponsorship, not login.
    const result = await context.relay(buildCancelRecoveryTx(wallet, nonce, modules), { source: 'recovery' });
    await confirmedOn(rpc, context.chainId, result.transactionHash, wallet);
    context.recordTransaction('Protective recovery cancellation', result.transactionHash);
    const after = await pollRecovery(context.clients, wallet, context.chainId);
    if (!after.certain || after.pending.length) throw new Error('Cancellation receipt confirmed, but clear recovery status is not yet confirmed by both nodes. Retry the check.');
    context.notify('Both public nodes confirm all pending recovery requests were stopped.');
    await context.refresh();
  }
  const clear = !!snapshot?.certain && !snapshot.pending.length && !error;
  return <section className={snapshot?.certain && !snapshot.pending.length && !error ? 'recovery-alert all-clear' : 'recovery-alert'} data-testid={TEST_IDS.alert} aria-label="Recovery protection" data-pending={snapshot?.pending.length ? 'true' : undefined}>
    <div className="ra-text">{error && <p role="alert">{error}</p>}
      {!snapshot && !error && <p role="status">Checking whether anyone is recovering your wallet…</p>}
      {snapshot?.pending.length ? <><span className="ra-eyebrow">Was it you?</span><h3>Someone is replacing your wallet key.</h3>
        <p className="ra-lead">Someone is moving your wallet to a new phone. Your current phone can stop it before the waiting period ends.</p>
        {snapshot.pending.map((pending, i) => <div className="ra-pending" key={`${pending.module}:${i}`}><Countdown pending={pending} snapshot={snapshot} unavailable={!!error} />
          <details><summary>Details</summary><p>Helper: {RECOVERY_MODULES.find(module => module.address.toLowerCase() === pending.module.toLowerCase())?.label || 'Unknown helper'}</p><p>New owner address:</p><strong className="address-wrap">{pending.newOwners.map(addressGroups).join(' / ')}</strong><p>{error ? 'Countdown unavailable — last known request, not a current confirmation.' : remaining(pending.executeAfter, snapshot.timestamp)}</p>
            <p>Stopping uses your current phone’s key and cancels every pending request. Swissquote pays the network fee under its protective-cancel rules; service or network failures can still prevent it.</p></details></div>)}
        {acknowledged === identity && <p>You marked this request as yours. It is still pending and can still be stopped.</p>}
      </> : clear ? <><p>No one is trying to move your wallet.</p><details><summary>Details</summary><small>Both public nodes report no pending recovery at block {snapshot!.blockNumber.toString()}.</small></details></> : null}
    </div>
    {(snapshot?.pending.length || error) && <div className="ra-actions"><button className="polish-stop" data-testid={TEST_IDS.alertCancel} disabled={context.busy || !context.device} onClick={() => { void context.run('Stopping recovery', stop); }}>Stop it — this wasn’t me</button>
      {!!snapshot?.pending.length && <button className="ra-secondary" disabled={context.busy} onClick={() => setAcknowledged(identity)}>It was me</button>}</div>}
  </section>;
}
