import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { ADDRESSES, buildCancelRecoveryTx, buildRotateOwnerTx, createKit, generateKitCode, generateOwnerSeed, mnemonicToAddress, ownerFingerprint, type PasskeyOptionsResponse } from '@sq/protocol';
import { call } from '../../api';
import { nonce, owners, readPending } from '../../chain';
import { bindWallet, loadDevice, promoteDevice, saveDevice, unlockDevice, updateDeviceEvidence, type DeviceRecord } from '../../storage';
import { registerDeviceOwnership } from '../../lifecycle';
import type { FeatureProps } from '../context';
const modules = [{ address: ADDRESSES.moduleA, label: 'Card + partner' }, { address: ADDRESSES.moduleB, label: 'Card + Swissquote' }];
function download(file: unknown) { const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'swissquote-emergency-kit.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export default function Settings({ context }: FeatureProps) {
  const [passphrase, setPassphrase] = useState('');
  const [email, setEmail] = useState('');
  const [replacement, setReplacement] = useState<DeviceRecord>();
  const [seed, setSeed] = useState('');
  const [kit, setKit] = useState<Awaited<ReturnType<typeof createKit>>>();
  const [code, setCode] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [kitOwner, setKitOwner] = useState('');
  useEffect(() => {
    let live = true;
    if (context.session) void loadDevice(`${context.session.clientId}:replacement`).then(value => { if (live) setReplacement(value); }).catch(() => { if (live) context.notify('Could not load the saved replacement record.'); });
    return () => { live = false; };
  }, [context.session?.clientId]);
  useEffect(() => {
    const lock = () => { if (document.hidden) { setSeed(''); setPassphrase(''); setCode(''); setSaved(false); setDownloaded(false); } };
    document.addEventListener('visibilitychange', lock); return () => document.removeEventListener('visibilitychange', lock);
  }, []);
  async function makeKit(ownerSeed: string, owner: string) {
    if (!context.wallet) throw new Error('Select a wallet first.');
    const kitCode = await generateKitCode();
    setKit(await createKit(ownerSeed, kitCode, { wallet: context.wallet, owner: mnemonicToAddress(ownerSeed), chainId: context.chainId, modules: modules.map(module => module.address) }));
    setKitOwner(owner); setCode(kitCode); setDownloaded(false); setSaved(false);
  }
  async function prepare() {
    if (!context.wallet || !context.device || !context.session || !context.mnemonic) throw new Error('Unlock your current owner key first.');
    if (!context.device.setupCode || !context.device.cardGuardian) throw new Error('Restore the original setup metadata first.');
    if (replacement?.wallet && replacement.wallet.toLowerCase() !== context.wallet.toLowerCase()) throw new Error('The saved replacement belongs to another wallet.');
    const nextSeed = replacement ? await unlockDevice(replacement, passphrase) : generateOwnerSeed();
    let record = replacement || await saveDevice(`${context.session.clientId}:replacement`, nextSeed, passphrase, mnemonicToAddress(nextSeed), context.wallet);
    record = await bindWallet(record, context.wallet, context.device.setupCode, context.device.cardGuardian);
    setReplacement(record); setSeed(nextSeed); setPassphrase(''); await makeKit(nextSeed, record.owner);
  }
  async function rotate() {
    if (!replacement || !context.device || !context.wallet || !context.session || !seed || !saved || !downloaded || kitOwner !== replacement.owner) throw new Error('Prepare the replacement and save its new kit and separate code first.');
    const pending = await readPending(context.wallet, modules);
    if (pending.length) await context.relay(buildCancelRecoveryTx(context.wallet, await nonce(context.wallet), pending.map(item => item.module)), { source: 'recovery' });
    await context.relay(buildRotateOwnerTx(context.wallet, context.device.owner, replacement.owner, await nonce(context.wallet)), { source: 'settings' });
    const current = await owners(context.wallet);
    if (current.length !== 1 || current[0].toLowerCase() !== replacement.owner.toLowerCase()) throw new Error('Replacement owner is not confirmed. The encrypted pending key remains saved; retry installation after checking the chain.');
    await updateDeviceEvidence(replacement.id, { kitSavedAt: new Date().toISOString() });
    const record = await promoteDevice(replacement.id, context.session.clientId, context.wallet);
    setReplacement(undefined); setSeed(''); setCode(''); setKit(undefined); setSaved(false); setDownloaded(false);
    await context.refresh();
    await registerDeviceOwnership(record, seed, context.session.clientId, context.session.token, context.chainId);
    context.notify('Owner key replaced on chain; encrypted replacement installed. The old phrase no longer controls this deployed wallet. Unlock the new key and independently re-check before funding.');
  }
  return <div className="content-grid" data-testid="settings-panel"><div><section className="panel"><span className="section-label">DEVICE SECURITY</span><h2>Your owner key stays on this device</h2><p>{context.mnemonic ? 'Unlocked in memory' : 'Locked'} · encrypted seed in IndexedDB. Your login password does not unlock it.</p><p>Owner address: <code>{context.device?.owner ?? 'No device key'}</code></p><label className="field"><span>Account email for passkey enrollment</span><input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)}/></label><button disabled={context.busy || !context.session || !email} onClick={() => { void context.run('Enrolling a passkey', async () => { if (!context.session) return; const options = await call<PasskeyOptionsResponse>('/auth/passkey/register/options', { token: context.session.token, body: { email } }); const response = await startRegistration({ optionsJSON: options.options as Parameters<typeof startRegistration>[0]['optionsJSON'] }); await call('/auth/passkey/register/verify', { token: context.session.token, body: { email, response, challengeId: options.challengeId } }); if (context.device) await updateDeviceEvidence(context.device.id, { passkeyRegisteredAt: new Date().toISOString() }); await context.refresh(); context.notify('Passkey enrolled. Large payments and owner changes still require transaction-bound confirmation.'); }); }}>Add a passkey</button></section><section className="panel"><span className="section-label">REPLACE MY DEVICE KEY</span><h3>A fresh key. The same wallet address.</h3><p>Use this while you still control the wallet and before a thief acts. Save the encrypted replacement and its new Emergency Kit first. Your current key signs the owner swap; your passkey approves its exact transaction hash. The old local record is replaced only after chain confirmation.</p><label className="field"><span>{replacement ? 'Saved replacement unlock code' : 'New device unlock code'}</span><input type="password" minLength={12} value={passphrase} onChange={event => setPassphrase(event.target.value)} autoComplete="new-password"/></label><button disabled={context.busy || !context.mnemonic || passphrase.length < 12} onClick={() => { void context.run('Preparing encrypted replacement and kit', prepare); }}>Prepare replacement & new kit</button>{replacement && <div className="fingerprint"><small>NEW OWNER FINGERPRINT</small><strong>{ownerFingerprint(replacement.owner)}</strong><code>{replacement.owner}</code></div>}<button className="primary" disabled={context.busy || !context.mnemonic || !seed || !saved || !downloaded || kitOwner !== replacement?.owner} onClick={() => { void context.run('Replacing owner key with passkey', rotate); }}>Replace my device key with passkey</button><small>If interrupted after chain submission, the encrypted replacement remains saved. Use “Check chain and install replacement” below, not another owner swap.</small></section></div><section className="panel kit-panel"><span className="section-label">EMERGENCY KIT</span><h3>Encrypted file + separate kit code</h3><p>This contains the owner seed, not the 12-word Recovery Card. The advanced 24-word owner seed can directly spend funds. Anyone with the kit file and its code can unlock that seed.</p><button disabled={context.busy || !context.mnemonic || !context.device || !!seed} onClick={() => { void context.run('Exporting current owner kit', async () => { if (context.device) await makeKit(context.mnemonic, context.device.owner); }); }}>Export current owner kit</button>{kit && <><div className="kit-code"><small>KIT CODE · SAVE SEPARATELY</small><strong>{code || 'Hidden. Create a fresh export before proceeding.'}</strong></div><button className="primary" disabled={!code} onClick={() => { download(kit); setDownloaded(true); }}>Download encrypted kit</button><label className="check"><input type="checkbox" checked={saved} disabled={!downloaded || !code} onChange={event => { const value = event.target.checked; setSaved(value); if (value && context.device && kitOwner === context.device.owner) void context.run('Saving kit acknowledgement', async () => { await updateDeviceEvidence(context.device!.id, { kitSavedAt: new Date().toISOString() }); await context.refresh(); }); }}/>I saved the file and wrote the kit code separately from it and the Recovery Card.</label></>}<small>A download and acknowledgement are not a verified backup. Test your kit in the independently saved recovery tool. Never share its code with a service.</small></section></div>;
}
