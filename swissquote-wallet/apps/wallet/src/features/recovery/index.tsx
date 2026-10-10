import { useEffect, useRef, useState } from 'react';
import { getAddress, type Address } from 'viem';
import { assertRecoveryHash, createKit, decodeSetupCode, encodeCode, encodeExecTransaction, generateKitCode, generateOwnerSeed, makeSafeTx, mnemonicToAddress, mnemonicToPrivateKey, moduleAbi, safeAbi, signSafeTx, type EmergencyKit, type RecoveryApproveResponse, type RecoveryRequest, type TransactionResponse } from '@sq/protocol';
import type { FeatureProps } from '../context';
import { TEST_IDS } from '../test-ids';
import { call } from '../../api';
import { confirmedOn, validatedAddress } from '../../chain';
import { creationMetadata, registerDeviceOwnership, type WalletMetadataResponse } from '../../lifecycle';
import { bindWallet, loadDevice, promoteDevice, saveDevice, unlockDevice, type DeviceRecord } from '../../storage';
import { useRecoveryPoll } from '../alert/useRecoveryPoll';
import { addressGroups, assertReady, cardApproval, helperApproval, pollRecovery, RECOVERY_MODULES, remaining } from './core';

export default function Feature({ context }: FeatureProps) {
  const [target, setTarget] = useState(context.wallet || '');
  const [moduleIndex, setModuleIndex] = useState(0);
  const [passphrase, setPassphrase] = useState('');
  const [replacement, setReplacement] = useState<DeviceRecord>();
  const [request, setRequest] = useState<RecoveryRequest>();
  const [approval, setApproval] = useState('');
  const [face, setFace] = useState('client-demo');
  const [video, setVideo] = useState(false);
  const [matched, setMatched] = useState(false);
  const [kit, setKit] = useState<EmergencyKit>();
  const [kitCode, setKitCode] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [oldKeyResult, setOldKeyResult] = useState('');
  // Keep only an already-unlocked old key for the read-only check; never request/import old seed words.
  const oldSeed = useRef('');
  const selected = RECOVERY_MODULES[moduleIndex];
  const { snapshot, error: pollError } = useRecoveryPoll(context.clients, replacement?.wallet, context.chainId);
  const rpc = context.clients[0];
  useEffect(() => {
    let live = true; setReplacement(undefined); setRequest(undefined); setKit(undefined); setSaved(false); setDone(false); setClearConfirmed(false); oldSeed.current = '';
    if (context.session) void loadDevice(`${context.session.clientId}:replacement`).then(record => { if (live && record) { setReplacement(record); setTarget(record.wallet || ''); } }).catch(() => { if (live) context.notify('Cannot read encrypted replacement storage. Do not create another key or finalize until storage is available.'); });
    return () => { live = false; oldSeed.current = ''; };
  }, [context.session?.clientId]);
  useEffect(() => {
    const lock = () => { if (document.hidden) { oldSeed.current = ''; setPassphrase(''); setKitCode(''); setKit(undefined); setDownloaded(false); setSaved(false); } };
    document.addEventListener('visibilitychange', lock); return () => document.removeEventListener('visibilitychange', lock);
  }, []);
  function session() { if (!context.session) throw new Error('Sign in to Swissquote first. Login does not replace your Recovery Card.'); return context.session; }
  function requireRpc() { if (!rpc || context.clients.length < 2) throw new Error('Configure two independent public chain clients before recovery.'); }
  async function prepare() {
    const auth = session(); requireRpc(); const wallet = getAddress(validatedAddress(target));
    if (replacement?.wallet && replacement.wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error('An encrypted replacement is saved for another wallet. Resume that wallet; do not overwrite its key.');
    const pendingId = `${auth.clientId}:replacement`;
    const existing = await loadDevice(pendingId);
    if (existing?.wallet && existing.wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error('Saved replacement belongs to another wallet. Resume that recovery first.');
    const seed = existing ? await unlockDevice(existing, passphrase) : generateOwnerSeed();
    let record = existing || await saveDevice(pendingId, seed, passphrase, getAddress(mnemonicToAddress(seed)), wallet);
    setReplacement(record); // Storage succeeded before any helper receives a request.
    if (mnemonicToAddress(seed).toLowerCase() !== record.owner.toLowerCase()) throw new Error('Saved replacement seed does not match its owner. Do not continue.');
    const metadata = context.device?.wallet?.toLowerCase() === wallet.toLowerCase() && context.device.setupCode && context.device.cardGuardian
      ? { wallet, owner: context.device.owner, verified: false, clientId: auth.clientId, chainId: context.chainId, setupCode: context.device.setupCode, cardGuardian: context.device.cardGuardian }
      : await call<WalletMetadataResponse>(`/wallets/${wallet}`, { token: auth.token });
    const original = creationMetadata(record, metadata); const setup = decodeSetupCode(original.setupCode);
    if (setup.chainId !== context.chainId) throw new Error('Original setup belongs to another chain. Switch to the wallet’s network.');
    record = await bindWallet(record, wallet, original.setupCode, original.cardGuardian); setReplacement(record);
    const recoveryNonce = await rpc.readContract({ address: selected.address, abi: moduleAbi, functionName: 'nonce', args: [wallet] });
    const next: RecoveryRequest = { wallet, module: selected.address, newOwner: getAddress(record.owner), nonce: recoveryNonce, chainId: context.chainId };
    await Promise.all(context.clients.slice(0, 2).map(client => assertRecoveryHash(client, next)));
    setRequest(next); setApproval(''); setMatched(false); setKit(undefined); setDownloaded(false); setSaved(false); setDone(false); setClearConfirmed(false); setOldKeyResult(''); setPassphrase('');
    if (context.device?.wallet?.toLowerCase() === wallet.toLowerCase() && context.mnemonic && mnemonicToAddress(context.mnemonic).toLowerCase() === context.device.owner.toLowerCase()) oldSeed.current = context.mnemonic;
    context.notify('Replacement key encrypted on this device. Compare its full address in your independently saved offline tool.');
  }
  async function start() {
    const auth = session(); requireRpc();
    if (!request || !replacement?.cardGuardian || !replacement.setupCode || !matched) throw new Error('Prepare the device and compare the full new owner address in the offline tool first.');
    if (request.module.toLowerCase() !== selected.address.toLowerCase()) throw new Error('Helper changed. Prepare a new public request and obtain a new card approval.');
    const fresh = await pollRecovery(context.clients, request.wallet, context.chainId);
    if (!fresh.certain || fresh.pending.length) throw new Error('A recovery may already be pending. Check its address and countdown before requesting another approval.');
    await Promise.all(context.clients.slice(0, 2).map(client => assertRecoveryHash(client, request)));
    const card = await cardApproval(request, approval, replacement.cardGuardian);
    const setup = decodeSetupCode(replacement.setupCode); const wire = { ...request, nonce: request.nonce.toString() };
    if (moduleIndex === 1 && !video) throw new Error('Confirm the explicitly MOCK Swissquote video-ID check before requesting approval.');
    // Only public request fields and MOCK check input go to helpers. Never card/owner words or kit code.
    const helper = await call<RecoveryApproveResponse>('/recovery/approve', moduleIndex === 0
      ? { partner: true, body: { ...wire, mockFace: face } }
      : { token: auth.token, body: { ...wire, mockVideoId: video } });
    const approved = await helperApproval(request, helper, moduleIndex === 0 ? setup.partnerGuardian : setup.sqGuardian);
    const result = await call<TransactionResponse>('/relay/recovery', { token: auth.token, body: { ...wire, approvals: [card, approved] } });
    context.recordTransaction('Recovery submitted — receipt pending', result.transactionHash);
    await confirmedOn(rpc, context.chainId, result.transactionHash);
    const after = await pollRecovery(context.clients, request.wallet, context.chainId);
    if (!after.certain || !after.pending.some(p => p.module.toLowerCase() === request.module.toLowerCase() && p.newOwners.length === 1 && p.newOwners[0].toLowerCase() === request.newOwner.toLowerCase())) throw new Error('Receipt confirmed, but both nodes have not confirmed this recovery request. Refresh before retrying; do not submit another request.');
    setApproval(''); context.notify('Both nodes confirm this recovery is pending. Keep this device and save your new emergency kit before finalizing.'); await context.refresh();
  }
  async function exportKit() {
    const auth = session(); if (!replacement?.wallet) throw new Error('Prepare or resume your encrypted replacement first.');
    const record = await loadDevice(`${auth.clientId}:replacement`) || (done ? await loadDevice(auth.clientId) : undefined);
    if (!record || record.owner.toLowerCase() !== replacement.owner.toLowerCase()) throw new Error('Encrypted replacement is missing. Do not finalize.');
    const seed = await unlockDevice(record, passphrase); const code = await generateKitCode();
    setKit(await createKit(seed, code, { wallet: replacement.wallet, owner: replacement.owner, chainId: context.chainId, modules: RECOVERY_MODULES.map(m => m.address) }));
    setKitCode(code); setDownloaded(false); setSaved(false); setPassphrase('');
  }
  function downloadKit() {
    if (!kit) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' })); const link = document.createElement('a');
    link.href = url; link.download = 'swissquote-new-emergency-kit.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
  }
  async function finish() {
    const auth = session(); requireRpc(); if (!replacement?.wallet || !saved || !kit || kit.owner.toLowerCase() !== replacement.owner.toLowerCase()) throw new Error('Download the replacement emergency kit and confirm its code is stored separately before finalizing.');
    const record = await loadDevice(`${auth.clientId}:replacement`);
    if (!record || record.owner.toLowerCase() !== replacement.owner.toLowerCase() || record.wallet?.toLowerCase() !== replacement.wallet.toLowerCase()) throw new Error('Encrypted replacement storage is missing or does not match. Do not finalize.');
    const seed = await unlockDevice(record, passphrase);
    if (mnemonicToAddress(seed).toLowerCase() !== record.owner.toLowerCase()) throw new Error('Replacement owner does not match the encrypted key.');
    const current = await rpc.readContract({ address: record.wallet!, abi: safeAbi, functionName: 'getOwners' });
    // Resume installation after a receipt timeout or interrupted promotion without sending finalize twice.
    if (!(current.length === 1 && current[0].toLowerCase() === record.owner.toLowerCase())) {
      if (!request) throw new Error('Prepare the saved replacement with the same helper to resume its public request.');
      assertReady(await pollRecovery(context.clients, record.wallet!, context.chainId), request);
      const result = await call<TransactionResponse>('/relay/finalize', { token: auth.token, body: { wallet: record.wallet, module: request.module } });
      context.recordTransaction('Recovery finalization submitted — receipt pending', result.transactionHash);
      await confirmedOn(rpc, context.chainId, result.transactionHash);
    }
    const checks = await Promise.all(context.clients.slice(0, 2).map(async client => {
      if (await client.getChainId() !== context.chainId) throw new Error('RPC chain mismatch');
      const owners = await client.readContract({ address: record.wallet!, abi: safeAbi, functionName: 'getOwners' });
      const threshold = await client.readContract({ address: record.wallet!, abi: safeAbi, functionName: 'getThreshold' });
      return threshold === 1n && owners.length === 1 && owners[0].toLowerCase() === record.owner.toLowerCase();
    }));
    if (!checks.every(Boolean)) throw new Error('The chain has not confirmed this replacement as sole owner on both nodes. Key stays encrypted; retry installation after nodes catch up.');
    const installed = await promoteDevice(record.id, auth.clientId, record.wallet!); setReplacement(installed); setDone(true); setPassphrase('');
    const pending = await pollRecovery(context.clients, record.wallet!, context.chainId).catch(() => undefined);
    if (!pending?.certain || pending.pending.length) {
      context.notify('New owner confirmed and encrypted replacement installed, but recovery is NOT yet secure: another request may remain active. Reload/unlock the installed replacement and use Stop it in the recovery alert before treating recovery as complete.');
      await context.refresh(); return;
    }
    setClearConfirmed(true);
    try { await registerDeviceOwnership(installed, seed, auth.clientId, auth.token, context.chainId); }
    catch { context.notify('Same address and new owner confirmed; encrypted key installed. Swissquote ownership registration is incomplete: retry registration before funding.'); await context.refresh(); return; }
    context.notify('Done — same wallet address. New owner confirmed by both nodes and registered. Reload/unlock this installed device if the shell still shows the old key.'); await context.refresh();
  }
  async function tryOldKey() {
    requireRpc(); if (!done || !replacement?.wallet || !oldSeed.current) throw new Error('Old key is unavailable on this new phone. This check requires the old device’s already-unlocked key; never paste seed words here.');
    const tx = makeSafeTx({ to: replacement.wallet, nonce: await rpc.readContract({ address: replacement.wallet, abi: safeAbi, functionName: 'nonce' }) });
    const signature = await signSafeTx(mnemonicToPrivateKey(oldSeed.current), replacement.wallet, tx, context.chainId);
    try { await rpc.call({ to: replacement.wallet, data: encodeExecTransaction(tx, signature) }); }
    catch (error) { if (error instanceof Error && error.message.includes('GS026')) { setOldKeyResult('The wallet contract refused the old key (GS026). Read-only eth_call; no transaction sent.'); return; } throw new Error('Could not verify GS026. Node failure or a different revert is not proof that the old key was refused. Retry on the old device.'); }
    throw new Error('The contract did not refuse the old key. Do not claim recovery verification passed.');
  }
  const code = request ? encodeCode({ ...request, nonce: request.nonce.toString(), v: 1, kind: 'request' }) : '';
  const pending = snapshot?.pending.find(p => p.module.toLowerCase() === selected.address.toLowerCase());
  return <section className="panel" data-testid={TEST_IDS.recovery}><h2>I lost my phone — recover the same wallet.</h2>
    <p>Recovery needs your Recovery Card and one helper. A password reset cannot unlock your wallet. Keep the new device until recovery finishes.</p>
    <label className="field">Wallet to recover<input data-testid={TEST_IDS.recoveryWallet} value={target} disabled={!!request || done} onChange={e => setTarget(e.target.value)} /></label>
    <label className="field">Choose a helper<select data-testid={TEST_IDS.recoveryHelper} value={moduleIndex} disabled={done} onChange={e => { setModuleIndex(Number(e.target.value)); setRequest(undefined); setApproval(''); setMatched(false); }}>
      {RECOVERY_MODULES.map((m, i) => <option key={m.address} value={i}>{m.label} — {m.wait}</option>)}</select></label>
    <label className="field">{replacement ? 'Unlock saved replacement · app unlock code' : 'New app unlock code · at least 12 characters'}<input type="password" autoComplete="off" value={passphrase} onChange={e => setPassphrase(e.target.value)} /></label>
    {!done && <button data-testid={TEST_IDS.recoveryPrepare} disabled={context.busy || !context.session || !passphrase} onClick={() => { void context.run('Preparing encrypted new phone', prepare); }}>{replacement ? 'Resume saved replacement' : 'Prepare new phone'}</button>}
    {replacement && <><h3>Full new owner address — compare every group</h3><strong className="address-wrap" data-testid={TEST_IDS.recoveryNewOwner}>{addressGroups(replacement.owner)}</strong><p><code>{getAddress(replacement.owner)}</code></p></>}
    {request && !done && <><h3>Approve with your Recovery Card, offline</h3><p>Open the offline tool from your own bookmark or saved copy, never from a link sent to you. Paste this public request there. Enter card words only in that independently saved tool, never in this wallet or a helper’s website.</p>
      <textarea aria-label="Public recovery request code" readOnly value={code} /><button disabled={context.busy} onClick={() => { void context.run('Copying public request', async () => { await navigator.clipboard.writeText(code); context.notify('Public request copied. Open your own saved offline tool.'); }); }}>Copy public request</button>
      <label><input type="checkbox" checked={matched} onChange={e => setMatched(e.target.checked)} />I compared every group of the full new owner address on the offline approval screen.</label>
      <label className="field">Public card approval code, not card words<textarea data-testid={TEST_IDS.recoveryCardApproval} value={approval} onChange={e => setApproval(e.target.value)} /></label>
      {moduleIndex === 0 ? <label className="field">Partner face check — MOCK<select value={face} onChange={e => setFace(e.target.value)}><option value="client-demo">Enrolled demo client face</option><option value="thief-face">Different face — should be refused</option></select></label> : <label><input type="checkbox" checked={video} onChange={e => setVideo(e.target.checked)} />Swissquote video ID passed — MOCK, not a real identity check.</label>}
      <button data-testid={TEST_IDS.recoveryStart} disabled={context.busy || !approval || !matched || !!snapshot?.pending.length} onClick={() => { void context.run('Requesting helper-approved recovery', start); }}>Ask helper and start recovery</button></>}
    {pollError && <p role="alert">{pollError}</p>}{pending && <p role="status">{pollError ? 'Countdown unavailable; last known request may still be active.' : remaining(pending.executeAfter, snapshot!.timestamp)}. Rechecked every 15 seconds using block time, not this device’s clock.</p>}
    {replacement && <><h3>Save your new Emergency Kit before finalizing</h3><p>The old kit stops controlling this wallet after recovery. Unlock the encrypted replacement to export its new kit. This code stays local and is never sent to helpers.</p>
      <button disabled={context.busy || !passphrase} onClick={() => { void context.run('Creating replacement emergency kit', exportKit); }}>Create new encrypted kit</button>
      {kit && <><p>New kit code — store separately from the kit file: <strong>{kitCode || 'Hidden; create a fresh kit export.'}</strong></p><button disabled={!kitCode} onClick={downloadKit}>Download new encrypted kit</button><label><input type="checkbox" checked={saved} disabled={!downloaded} onChange={e => setSaved(e.target.checked)} />I saved the new kit file and stored its code separately. This is my acknowledgement, not an automated backup check.</label></>}
      {!done && <button data-testid={TEST_IDS.recoveryFinalize} disabled={context.busy || !saved || !passphrase || !!pollError} onClick={() => { void context.run('Finalizing and installing recovered owner', finish); }}>Check block time, finalize and install saved key</button>}</>}
    {done && <><h3>{clearConfirmed ? 'Done — same address' : 'New key installed — protection check incomplete'}</h3><p className="address-wrap">{replacement?.wallet}</p><p>Both public nodes confirmed the saved replacement as the sole owner. The new encrypted key is installed on this device. Reload and unlock it if the wallet still shows the previous key.</p>{!clearConfirmed && <p role="alert">Other recovery requests may still be active. Unlock the installed replacement and use Stop it in the alert before treating recovery as secure. Swissquote ownership registration still needs retrying.</p>}
      <button data-testid={TEST_IDS.recoveryOldKey} disabled={context.busy || !oldSeed.current} onClick={() => { void context.run('Checking old key without sending', tryOldKey); }}>Try the old key · read-only</button>
      {!oldSeed.current && <p>The old key is not available here. Run the check on the old, unlocked device; no refusal has been claimed.</p>}{oldKeyResult && <p role="status">{oldKeyResult}</p>}</>}
  </section>;
}
