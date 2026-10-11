import React, { useEffect, useState } from 'react';
import { auditWallet, decodeSetupCode, type WalletAudit } from '@sq/protocol';
import type { FeatureContext } from '../context';

export function custodyConfirmed(context: FeatureContext, audit: WalletAudit): boolean {
  const { facts } = audit;
  const wallet = context.wallet;
  const device = context.device;
  if (!wallet || !device || device.wallet?.toLowerCase() !== wallet.toLowerCase() || !device.cardGuardian || !context.setupCode) return false;
  if (facts.verified !== true || facts.chainId !== String(context.chainId) || facts.ownerThreshold !== '1' || typeof facts.owners !== 'string' || facts.owners.toLowerCase() !== device.owner.toLowerCase()) return false;
  try {
    const setup = decodeSetupCode(context.setupCode);
    if (setup.chainId !== context.chainId || setup.wallet.toLowerCase() !== wallet.toLowerCase() || typeof facts.sharedGuardian !== 'string' || facts.sharedGuardian.toLowerCase() !== device.cardGuardian.toLowerCase()) return false;
    const expected = [[device.cardGuardian, setup.partnerGuardian], [device.cardGuardian, setup.sqGuardian]];
    return ['A', 'B'].every((module, index) => {
      const guardians = facts[`module${module}Guardians`];
      const addresses = typeof guardians === 'string' ? guardians.split(',').map(address => address.trim().toLowerCase()) : [];
      return addresses.length === 2 && expected[index].every(address => addresses.includes(address.toLowerCase())) && facts[`module${module}ExecuteAfter`] === '0';
    });
  } catch { return false; }
}

export function WhoCanMove({ context }: { context: FeatureContext }) {
  const identity = `${context.chainId}:${context.wallet}:${context.device?.owner}:${context.device?.cardGuardian}:${context.setupCode}`;
  const [check, setCheck] = useState<{ identity: string; audit?: WalletAudit }>();
  useEffect(() => {
    let live = true;
    setCheck(undefined);
    if (context.wallet) void auditWallet(context.clients, context.wallet)
      .then(audit => { if (live) setCheck({ identity, audit }); })
      .catch(() => { if (live) setCheck({ identity }); });
    return () => { live = false; };
  }, [identity, context.clients]);
  const audit = check?.identity === identity ? check.audit : undefined;
  if (!check || check.identity !== identity) return <p className="custody-card">Checking who can move money on two public nodes…</p>;
  if (!audit || !custodyConfirmed(context, audit)) return <p className="custody-card polish-warning">Couldn’t confirm that only this phone’s key controls this wallet with the expected recovery rules and no pending request — don’t assume protection.</p>;
  return <div className="custody-card">
    <h2>Who can move my money?</h2>
    <ul>
      <li><strong>You</strong> — this phone’s owner key signs payments. Anyone with that key, or your Emergency Kit and its code, can also spend.</li>
      <li><strong>Swissquote</strong> — its configured helper key cannot send money. With your Recovery Card, it can help replace the owner key after a 3-day wait.</li>
      <li><strong>The partner</strong> — its configured helper key cannot send money. With your Recovery Card, it can help replace the owner key after 3 minutes in this demo.</li>
      <li>Neither configured helper, even together, can replace your key without your Recovery Card. The current owner can stop a replacement before it is finalized.</li>
    </ul>
    <small>Current rules checked at block {String(audit.facts.blockNumber)} on {context.chainId === 11155111 ? 'the public Ethereum test network' : 'the local test network'}. Helper names are matched to this device’s original setup; public addresses alone do not prove identities.</small>
    <p>If Swissquote disappears, your Emergency Kit and its separate code can unlock the owner key without a Swissquote server.</p>
    <small>This checks current wallet rules, not the app’s safety or wallet history. A malicious wallet app could copy your key. Fee screening does not stop an owner-key holder sending elsewhere.</small>
    <div className="custody-links">
      {context.chainId === 11155111 && <a target="_blank" rel="noreferrer" href={`https://app.safe.global/home?safe=sep:${context.wallet}`}>Open in Safe{'{Wallet}'} ↗</a>}
      <a target="_blank" rel="noreferrer" href={`http://localhost:5274/#check=${context.wallet}`}>Check it yourself in the Independent Recovery Desk ↗</a>
    </div>
    <small>Read-only checks: do not connect a wallet or enter secret words in Safe{'{Wallet}'}.</small>
  </div>;
}
