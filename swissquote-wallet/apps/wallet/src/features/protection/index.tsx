import { useEffect, useState } from 'react';
import { ADDRESSES, decodeSetupCode, moduleAbi, type WalletResponse } from '@sq/protocol';
import { call } from '../../api';
import { readPending } from '../../chain';
import { updateDeviceEvidence } from '../../storage';
import { TEST_IDS } from '../test-ids';
import type { FeatureProps } from '../context';

export default function Protection({ context }: FeatureProps) {
  const [ownership, setOwnership] = useState('Not checked');
  const [helpers, setHelpers] = useState('Not checked');
  const [recovery, setRecovery] = useState('Unknown');
  const [checked, setChecked] = useState(!!context.device?.independentCheckedAt);
  useEffect(() => {
    let live = true;
    setOwnership('Not checked'); setHelpers('Not checked'); setRecovery('Unknown'); setChecked(!!context.device?.independentCheckedAt);
    if (!context.wallet || !context.device) return;
    const wallet = context.wallet; const owner = context.device.owner;
    void (async () => {
      try {
        if (context.session) {
          try { const result = await call<WalletResponse>(`/wallets/${wallet}`, { token: context.session.token }); if (live) setOwnership(result.verified && result.owner.toLowerCase() === owner.toLowerCase() ? 'Current owner registered' : 'Not verified for this owner'); }
          catch { if (live) setOwnership('Service registration unavailable — public chain checks are separate'); }
        }
        const pending = await readPending(wallet, [{ address: ADDRESSES.moduleA, label: 'Partner' }, { address: ADDRESSES.moduleB, label: 'Swissquote' }]);
        if (live) setRecovery(pending.length ? `${pending.length} pending — review the alert` : 'No pending request on either checked node');
        if (!context.device?.cardGuardian || !context.setupCode || context.clients.length < 2) throw new Error('Original recovery setup or independent public nodes unavailable');
        const setup = decodeSetupCode(context.setupCode);
        const heads = await Promise.all(context.clients.slice(0, 2).map(rpc => rpc.getBlockNumber({ cacheTime: 0 })));
        const blockNumber = heads.reduce((a, b) => a < b ? a : b);
        const expected = [[ADDRESSES.moduleA, setup.partnerGuardian], [ADDRESSES.moduleB, setup.sqGuardian]] as const;
        const valid = await Promise.all(context.clients.slice(0, 2).flatMap(rpc => expected.map(async ([address, helper]) => {
          const [guardians, threshold] = await Promise.all([rpc.readContract({ address, abi: moduleAbi, functionName: 'getGuardians', args: [wallet], blockNumber }), rpc.readContract({ address, abi: moduleAbi, functionName: 'threshold', args: [wallet], blockNumber })]);
          return threshold === 2n && guardians.length === 2 && [context.device!.cardGuardian!, helper].every(value => guardians.some(guardian => guardian.toLowerCase() === value.toLowerCase()));
        })));
        if (live) setHelpers(valid.every(Boolean) ? 'Card + one helper required on each path' : 'Unexpected recovery rules — do not fund');
      } catch { if (live) setHelpers('Unknown — public checks unavailable'); }
    })();
    return () => { live = false; };
  }, [context.wallet, context.device, context.session, context.setupCode, context.clients]);
  const rows = [['Ownership registered', ownership], ['Independent wallet check', checked ? 'Acknowledged by you — not an automated result' : 'Not acknowledged'], ['Emergency Kit saved', context.device?.kitSavedAt ? 'Download acknowledged on this device' : 'Not acknowledged'], ['Passkey for large payments', context.device?.passkeyRegisteredAt ? 'Enrolled on this device; transaction step-up still required' : 'Not confirmed on this device'], ['Helpers ready on chain', helpers], ['No recovery pending', recovery]];
  return <section className="panel" data-testid={TEST_IDS.protection}><span className="section-label">PROTECTION</span><h2>Your safety checks, without guesswork</h2><dl className="protection-status">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><label className="check"><input type="checkbox" checked={checked} disabled={!context.device || context.busy} onChange={event => { const value = event.target.checked; void context.run('Saving independent check acknowledgement', async () => { if (!context.device) return; await updateDeviceEvidence(context.device.id, { independentCheckedAt: value ? new Date().toISOString() : undefined }); setChecked(value); await context.refresh(); }); }}/>I independently checked this wallet and its current owner and saw a green result.</label><p>The 12-word Recovery Card approves replacement together with one helper; it does not spend. The advanced 24-word owner seed directly controls spending. The Emergency Kit is an encrypted owner-seed file plus a separate kit code. Anyone with both can unlock it.</p><details><summary>What Swissquote stores about you</summary><p>The prototype stores client ID, email, login password hash, passkey public credential data and counters, MOCK identity-verification status, password-reset state, account balance, guardian key, sessions and passkey step-up approvals, wallet address and original public setup, current-owner registration, challenges, transaction hashes, and audit events. Audit events may include destination, amount, source, decision and DeFi identifiers.</p><p>Swissquote’s guardian key is a helper key, not your owner key. Your owner seed remains encrypted on this device; the wallet does not send it, Recovery Card words, or your kit code to either service. The partner receives its own MOCK face record and guardian information, not a required Swissquote user reference.</p><small>The plan cites a 10-year AML audit-retention obligation; this prototype has no production retention enforcement, and that legal period has not been re-checked here. MOCK mailbox and identity data are for local demonstration only.</small></details></section>;
}
