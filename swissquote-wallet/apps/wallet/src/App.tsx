import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { createPublicClient, http, formatUnits, type Address, type Hex } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import { generateOwnerSeed, mnemonicToAddress, mnemonicToPrivateKey, randomSaltNonce, buildWalletInitializer, computeWalletAddress, factoryAbi, ADDRESSES, encodeCode, decodeApprovalCode, ownerFingerprint, generateKitCode, createKit, signSafeTx, hashSafeTx, safeTxToWire, classifyTransaction, buildCancelRecoveryTx, buildRotateOwnerTx, moduleAbi, erc20Abi, type SessionResponse, type AccountResponse, type GuardianEnrollResponse, type DeployResponse, type WalletResponse, type TransactionResponse, type PasskeyOptionsResponse, type StepUpVerifyResponse, type RecoveryApproveResponse, type MockMailboxResponse, type SafeTx, type RecoveryRequest, type WalletSetup } from '@sq/protocol';
import { call, errorMessage } from './api';
import { client, chainId, validatedAddress, usdcAmount, paymentTx, nonce, owners, readPending, confirmed, countdown, PendingTransactionError, type PendingRecovery } from './chain';
import { saveDevice, loadDevice, bindWallet, promoteDevice, unlockDevice, type DeviceRecord } from './storage';
import { creationMetadata, registerDeviceOwnership, type WalletMetadataResponse } from './lifecycle';
import { FEATURE_REGISTRY, RecoveryAlert, featureEnabled, type FeatureContext } from './features';
const featureRpcUrls = (import.meta.env?.VITE_RPC_URLS || (chainId === 31337 ? 'http://127.0.0.1:8645,http://localhost:8645' : 'https://ethereum-sepolia-rpc.publicnode.com,https://rpc.sepolia.ethpandaops.io')).split(',').map((url: string) => url.trim()).filter(Boolean);
const featureClients = [...new Set<string>(featureRpcUrls)].map(url => createPublicClient({ chain: chainId === 31337 ? hardhat : sepolia, transport: http(url, { timeout: 12000, retryCount: 1 }) }));
const MODULES = [
    { address: ADDRESSES.moduleA, label: 'Card + partner', wait: '3 minutes' },
    { address: ADDRESSES.moduleB, label: 'Card + Swissquote', wait: '3 days' },
];
type Tab = 'overview' | 'pay' | 'recovery' | 'settings' | 'demo' | 'dapps' | 'audit' | 'protection';
interface Activity {
    label: string;
    hash: Hex;
    time: string;
}
function short(value: string) { return `${value.slice(0, 8)}…${value.slice(-6)}`; }
function Field({ label, children, hint }: {
    label: string;
    children: ReactNode;
    hint?: string;
}) { return <div className="field"><label><span>{label}</span>{children}</label>{hint && <small>{hint}</small>}</div>; }
function Copy({ value, label = 'Copy code' }: {
    value: string;
    label?: string;
}) { const [copied, setCopied] = useState(false); return <button className="secondary" onClick={() => { void navigator.clipboard.writeText(value).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copied' : label}</button>; }
function download(value: unknown, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function App() {
    const [session, setSession] = useState<SessionResponse>();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [register, setRegister] = useState(false);
    const [tab, setTab] = useState<Tab>('overview');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [device, setDevice] = useState<DeviceRecord>();
    const [mnemonic, setMnemonic] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [wallet, setWallet] = useState<Address>();
    const [card, setCard] = useState('');
    const [mockFace, setMockFace] = useState('client-demo');
    const [setupCode, setSetupCode] = useState('');
    const [checked, setChecked] = useState(false);
    const [verified, setVerified] = useState(false);
    const [account, setAccount] = useState<AccountResponse>();
    const [balance, setBalance] = useState<string>();
    const [eth, setEth] = useState<string>();
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('2');
    const [fundAmount, setFundAmount] = useState('15');
    const [review, setReview] = useState<SafeTx>();
    const [pending, setPending] = useState<PendingRecovery[]>([]);
    const [pollError, setPollError] = useState('');
    const [now, setNow] = useState(Date.now());
    const [recoverWallet, setRecoverWallet] = useState('');
    const [moduleIndex, setModuleIndex] = useState(0);
    const [request, setRequest] = useState<RecoveryRequest>();
    const [requestCode, setRequestCode] = useState('');
    const [approval, setApproval] = useState('');
    const [replacement, setReplacement] = useState<DeviceRecord>();
    const [replacementMnemonic, setReplacementMnemonic] = useState('');
    const [newPassphrase, setNewPassphrase] = useState('');
    const [kit, setKit] = useState<Awaited<ReturnType<typeof createKit>>>();
    const [kitCode, setKitCode] = useState('');
    const [activity, setActivity] = useState<Activity[]>([]);
    const [mailbox, setMailbox] = useState<MockMailboxResponse>();
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [fooled, setFooled] = useState(false);
    const [pendingTx, setPendingTx] = useState('');
    const busyRef = useRef(false);
    const signingGeneration = useRef(0);
    const ownershipGeneration = useRef(0);
    const currentIdentity = useRef({ token: session?.token, wallet, owner: device?.owner });
    currentIdentity.current = { token: session?.token, wallet, owner: device?.owner };
    const identityCommitWaiters = useRef<Array<() => void>>([]);
    useEffect(() => { identityCommitWaiters.current.splice(0).forEach(resolve => resolve()); });
    function assertRegistrationActivity(generation: number, activeSession: SessionResponse, identity?: { wallet?: Address; owner?: Address }) {
        const current = currentIdentity.current;
        if (generation !== signingGeneration.current || current.token !== activeSession.token || (identity && (current.wallet?.toLowerCase() !== identity.wallet?.toLowerCase() || current.owner?.toLowerCase() !== identity.owner?.toLowerCase()))) throw new Error('Device locked or session changed. Unlock and retry ownership registration.');
    }
    async function registerCurrent(record: DeviceRecord, seed: string, activeSession: SessionResponse, minimumBlockNumber?: bigint, generation = signingGeneration.current): Promise<boolean> {
        // Fresh creation/promotion setters may not have committed yet. The token
        // and lock generation are immediate; compare published identity after challenge.
        let challengeStarted = false;
        const needsCommit = currentIdentity.current.wallet?.toLowerCase() !== record.wallet?.toLowerCase() || currentIdentity.current.owner?.toLowerCase() !== record.owner.toLowerCase();
        const published = needsCommit ? new Promise<void>(resolve => { identityCommitWaiters.current.push(resolve); }) : Promise.resolve();
        const assertCurrent = async () => {
            assertRegistrationActivity(generation, activeSession);
            if (challengeStarted) {
                // A mocked/local challenge can finish before React commits fresh
                // creation/promotion. Wait for that publication, never skip identity.
                await published;
                assertRegistrationActivity(generation, activeSession, record);
            }
            challengeStarted = true;
        };
        await registerDeviceOwnership(record, seed, activeSession.clientId, activeSession.token, chainId, minimumBlockNumber, assertCurrent);
        await assertCurrent();
        // A lookup started before this proof must not undo its validated success.
        ownershipGeneration.current++;
        setVerified(true);
        return true;
    }
    async function run(label: string, action: () => Promise<void>) { if (busyRef.current)
        return; busyRef.current = true; setBusy(label); setError(''); setNotice(''); setPendingTx(''); try {
        await action();
    }
    catch (e) {
        if (e instanceof PendingTransactionError) { setNotice(''); setPendingTx(e.explorerUrl); } else setError(errorMessage(e));
    }
    finally {
        busyRef.current = false;
        setBusy('');
    } }
    const token = session?.token;
    const refresh = useCallback(async () => {
        if (!wallet)
            return;
        try {
            const saved = session ? await loadDevice(session.clientId) : undefined;
            if (saved?.wallet?.toLowerCase() === wallet.toLowerCase() && JSON.stringify(saved) !== JSON.stringify(device)) {
                const ownerChanged = saved.owner.toLowerCase() !== device?.owner.toLowerCase();
                const setupChanged = saved.setupCode !== device?.setupCode || saved.cardGuardian !== device?.cardGuardian;
                if (ownerChanged) { signingGeneration.current++; setMnemonic(''); setVerified(false); }
                setDevice(saved); setSetupCode(saved.setupCode || ''); setCard(saved.cardGuardian || '');
                // Backup/passkey timestamps are evidence updates, not owner changes.
                // Preserve registration and personal checks when identity is unchanged.
                if (ownerChanged || setupChanged) { setChecked(false); setReview(undefined); }
            }
            const [requests, tokenBalance, ethBalance, currentOwners] = await Promise.all([
                readPending(wallet, MODULES), client.readContract({ address: ADDRESSES.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }), client.getBalance({ address: wallet }), owners(wallet),
            ]);
            setPending(requests);
            setBalance(formatUnits(tokenBalance, 6));
            setEth(formatUnits(ethBalance, 18));
            setPollError('');
            // Promotion can complete while this refresh awaits RPCs. Never compare
            // the new chain owner against a stale render's old device key.
            const latestDevice = session ? await loadDevice(session.clientId) : saved;
            const effectiveDevice = latestDevice?.wallet?.toLowerCase() === wallet.toLowerCase() ? latestDevice : device;
            const ownerChangedDuringRead = saved?.owner.toLowerCase() !== latestDevice?.owner.toLowerCase();
            if (!ownerChangedDuringRead && effectiveDevice && (currentOwners.length !== 1 || currentOwners[0].toLowerCase() !== effectiveDevice.owner.toLowerCase())) {
                setVerified(false); setChecked(false); setReview(undefined);
                setNotice('This device no longer controls the wallet. Unlock the replacement device or recover access.');
            }
        }
        catch (e) {
            setPollError(`Cannot confirm both recovery modules: ${errorMessage(e)}`);
        }
    }, [wallet, device, session]);
    useEffect(() => { void refresh(); const timer = setInterval(() => { void refresh(); }, 15000); return () => clearInterval(timer); }, [refresh]);
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    useEffect(() => {
        if (!session)
            return;
        let live = true;
        void Promise.all([loadDevice(session.clientId), loadDevice(`${session.clientId}:replacement`)]).then(([record, next]) => { if (live) {
            setDevice(record);
            setReplacement(next);
            setWallet(record?.wallet || next?.wallet);
            setSetupCode(record?.setupCode || '');
            setCard(record?.cardGuardian || '');
        } }).catch(e => { if (live) setError(errorMessage(e)); });
        void call<AccountResponse>('/account', { token: session.token }).then(value => { if (live)
            setAccount(value); }).catch(e => { if (live)
            setError(errorMessage(e)); });
        return () => { live = false; };
    }, [session]);
    useEffect(() => {
        if (!wallet || !token) {
            setVerified(false);
            return;
        }
        let live = true;
        const generation = ++ownershipGeneration.current;
        setVerified(false);
        void call<WalletResponse>(`/wallets/${wallet}`, { token }).then(result => { if (live && generation === ownershipGeneration.current)
            setVerified(!!device && result.verified && result.wallet.toLowerCase() === wallet.toLowerCase() && result.owner.toLowerCase() === device.owner.toLowerCase()); }).catch(() => { if (live && generation === ownershipGeneration.current)
            setVerified(false); });
        return () => { live = false; };
    }, [wallet, token, device?.owner]);
    useEffect(() => { setChecked(false); setReview(undefined); }, [wallet, device?.owner]);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const lock = () => {
            if (timer) clearTimeout(timer);
            if (!document.hidden) return;
            timer = setTimeout(() => {
            signingGeneration.current++;
            setMnemonic('');
            setReplacementMnemonic('');
            setPassphrase('');
            setNewPassphrase('');
            setReview(undefined);
            setKitCode('');
            }, 120000);
        };
        document.addEventListener('visibilitychange', lock);
        return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', lock); };
    }, []);
    async function auth(passkey: boolean) {
        if (passkey) {
            const kind = register ? 'register' : 'login';
            // The service enrolls passkeys only into an authenticated account.
            const enrollment = register ? await call<SessionResponse>('/auth/password/register', { body: { email, password } }) : undefined;
            if (enrollment) setSession(enrollment);
            const authToken = enrollment?.token || token;
            const options = await call<PasskeyOptionsResponse>(`/auth/passkey/${kind}/options`, { body: { email }, token: authToken });
            const response = register ? await startRegistration({ optionsJSON: options.options as Parameters<typeof startRegistration>[0]['optionsJSON'] }) : await startAuthentication({ optionsJSON: options.options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
            setSession(await call<SessionResponse>(`/auth/passkey/${kind}/verify`, { body: { email, response, challengeId: options.challengeId }, token: authToken }));
        }
        else
            setSession(await call<SessionResponse>(`/auth/password/${register ? 'register' : 'login'}`, { body: { email, password } }));
        setPassword('');
        setNotice('Signed in. Your device key remains separately encrypted.');
    }
    async function confirmedAction(label: string, result: TransactionResponse, safeWallet?: Address): Promise<bigint> {
        setNotice('Submitted to the chain. Waiting for the receipt…');
        const block = await confirmed(result.transactionHash, safeWallet);
        setActivity(old => [{ label, hash: result.transactionHash, time: new Date().toLocaleTimeString() }, ...old]);
        setNotice(`${label} confirmed on chain.`);
        await refresh();
        return block;
    }
    async function exportKit(seed: string, target: Address, owner: Address, assertCurrent?: () => void) {
        assertCurrent?.();
        const code = await generateKitCode();
        assertCurrent?.();
        const file = await createKit(seed, code, { wallet: target, owner, chainId, modules: MODULES.map(m => m.address) });
        assertCurrent?.();
        setKit(file);
        setKitCode(code);
    }
    async function unlocked(assertCurrent?: () => void): Promise<string> {
        if (!device)
            throw new Error('No encrypted owner key is stored on this device. Use recovery.');
        if (mnemonic) {
            if (mnemonicToAddress(mnemonic).toLowerCase() !== device.owner.toLowerCase()) throw new Error('Unlock the current device key again.');
            return mnemonic;
        }
        const seed = await unlockDevice(device, passphrase);
        assertCurrent?.();
        setMnemonic(seed);
        setPassphrase('');
        return seed;
    }
    async function submitTx(tx: SafeTx, source: 'settings' | 'payment' | 'pay' | 'dapp' | 'recovery' = 'payment', seed?: string, relayOptions?: Parameters<FeatureContext['relay']>[1]): Promise<TransactionResponse> {
        if (!wallet || !token)
            throw new Error('Sign in and select your wallet first.');
        tx = { ...tx };
        relayOptions = relayOptions ? { ...relayOptions } : undefined;
        const generation = signingGeneration.current;
        const ownerSeed = seed || await unlocked();
        const signer = mnemonicToAddress(ownerSeed);
        const assertCurrent = async () => {
            const [currentOwners, currentNonce] = await Promise.all([owners(wallet), nonce(wallet)]);
            if (generation !== signingGeneration.current) throw new Error('Device locked or session changed. Unlock and review again.');
            if (currentOwners.length !== 1 || currentOwners[0].toLowerCase() !== signer.toLowerCase()) throw new Error('This key is not the current wallet owner. No transaction was signed.');
            if (currentNonce !== tx.nonce) throw new Error('Wallet nonce changed. Review this transaction again.');
        };
        await assertCurrent();
        const classification = classifyTransaction(wallet, tx);
        if (!classification.relayAllowed)
            throw new Error(classification.reason);
        let stepUpToken: string | undefined;
        if (classification.requiresPasskey) {
            const hash = hashSafeTx(wallet, tx, chainId);
            const options = await call<PasskeyOptionsResponse>('/auth/passkey/step-up/options', { token, body: { email, safeTxHash: hash } });
            const response = await startAuthentication({ optionsJSON: options.options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
            const step = await call<StepUpVerifyResponse>('/auth/passkey/step-up/verify', { token, body: { safeTxHash: hash, challengeId: options.challengeId, response } });
            if (step.safeTxHash.toLowerCase() !== hash.toLowerCase())
                throw new Error('The passkey approval does not match this transaction.');
            stepUpToken = step.stepUpToken;
        }
        await assertCurrent();
        const signature = await signSafeTx(mnemonicToPrivateKey(ownerSeed), wallet, tx, chainId);
        await assertCurrent();
        const result = await call<TransactionResponse>('/relay/safe-tx', { token, body: { wallet, tx: safeTxToWire(tx), signature, stepUpToken, source: relayOptions?.source ?? source, dappId: relayOptions?.dappId, effectsHash: relayOptions?.effectsHash, chainId } });
        await confirmedAction(classification.class === 'Protective' ? 'All pending recovery requests cancelled' : source === 'settings' ? 'Owner key replaced' : source === 'dapp' ? 'DeFi transaction' : 'Payment', result, wallet);
        return result;
    }
    async function createWallet() {
        if (!session)
            throw new Error('Sign in first.');
        if (!session.kycVerified)
            throw new Error('Complete MOCK identity verification first.');
        const generation = signingGeneration.current;
        const assertCurrent = () => assertRegistrationActivity(generation, session);
        const cardGuardian = validatedAddress(card);
        let seed: string;
        let record: DeviceRecord;
        if (device) {
            seed = await unlocked(assertCurrent);
            record = device;
        }
        else {
            seed = generateOwnerSeed();
            record = await saveDevice(session.clientId, seed, passphrase, mnemonicToAddress(seed));
            assertCurrent();
            setDevice(record);
            setMnemonic(seed);
            setPassphrase('');
        }
        const sq = await call<GuardianEnrollResponse>('/guardian/enroll', { token, body: {} });
        const partner = await call<GuardianEnrollResponse>('/enroll', { partner: true, body: { mockFace } });
        const setup: WalletSetup = { owner: record.owner, cardGuardian, partnerGuardian: partner.guardian, sqGuardian: sq.guardian, saltNonce: randomSaltNonce(), chainId };
        const proxyCode = await client.readContract({ address: ADDRESSES.factory, abi: factoryAbi, functionName: 'proxyCreationCode' });
        const predicted = computeWalletAddress(setup, proxyCode);
        const result = await call<DeployResponse>('/relay/deploy', { token, body: { ...setup, saltNonce: setup.saltNonce.toString(), initializer: buildWalletInitializer(setup), wallet: predicted } });
        if (result.wallet.toLowerCase() !== predicted.toLowerCase())
            throw new Error('The relayer returned a wallet address that does not match your recovery rules. Do not fund it.');
        const deploymentBlock = await confirmedAction('Wallet created', result);
        const code = encodeCode({ v: 1, kind: 'setup', chainId, wallet: predicted, owner: record.owner, partnerGuardian: partner.guardian, sqGuardian: sq.guardian, saltNonce: setup.saltNonce.toString() });
        const bound = await bindWallet(record, predicted, code, cardGuardian, deploymentBlock.toString());
        assertCurrent();
        setDevice(bound);
        setWallet(predicted);
        setSetupCode(code);
        setCard(cardGuardian);
        setVerified(false); setChecked(false); setReview(undefined);
        if (!await registerCurrent(bound, seed, session, deploymentBlock, generation)) return;
        const assertBound = () => assertRegistrationActivity(generation, session, bound);
        await exportKit(seed, predicted, record.owner, assertBound);
        assertBound();
        setNotice('Wallet created. Save your emergency kit and check the setup in the independent tool before depositing.');
    }
    async function registerExistingWallet() {
        if (!wallet || !device?.setupCode || !device.cardGuardian || !session) throw new Error('The saved wallet setup is missing. Restore the setup record before registering.');
        const generation = signingGeneration.current;
        const assertCurrent = () => assertRegistrationActivity(generation, session, device);
        const seed = await unlocked(assertCurrent);
        assertCurrent();
        setVerified(false); setChecked(false);
        const requests = await readPending(wallet, MODULES);
        assertCurrent();
        if (requests.length) await submitTx(buildCancelRecoveryTx(wallet, await nonce(wallet), requests.map(r => r.module)), 'settings', seed);
        assertCurrent();
        if (!await registerCurrent(device, seed, session, undefined, generation)) return;
        await exportKit(seed, wallet, device.owner, assertCurrent);
        assertCurrent();
        setNotice('Ownership registration complete. Independently check the wallet before funding.');
    }
    async function completeReplacement(seed: string, replacementRecord: DeviceRecord, generation = signingGeneration.current) {
        if (!wallet || !session) throw new Error('No saved replacement key is available.');
        const originalIdentity = { wallet, owner: device?.owner };
        const assertCurrent = () => assertRegistrationActivity(generation, session, originalIdentity);
        assertCurrent();
        setVerified(false); setChecked(false); setReview(undefined); setKit(undefined); setKitCode('');
        // Secure the recovered wallet before any optional service metadata/registration work.
        await exportKit(seed, wallet, replacementRecord.owner, assertCurrent);
        const requests = await readPending(wallet, MODULES);
        assertCurrent();
        if (requests.length) await submitTx(buildCancelRecoveryTx(wallet, await nonce(wallet), requests.map(r => r.module)), 'settings', seed);
        assertCurrent();
        // Preserve the original initializer even on a fresh device. Only public metadata is fetched.
        let pendingRecord = replacementRecord;
        if (!pendingRecord.setupCode || !pendingRecord.cardGuardian) {
            const metadata = device?.wallet?.toLowerCase() === wallet.toLowerCase() && device.setupCode && device.cardGuardian
                ? { wallet, owner: device.owner, verified: false, clientId: session.clientId, chainId, setupCode: device.setupCode, cardGuardian: device.cardGuardian }
                : await call<WalletMetadataResponse>(`/wallets/${wallet}`, { token });
            assertCurrent();
            const original = creationMetadata(pendingRecord, metadata);
            pendingRecord = await bindWallet(pendingRecord, wallet, original.setupCode, original.cardGuardian);
            assertCurrent();
            setReplacement(pendingRecord);
        }
        assertCurrent();
        const record = await promoteDevice(`${session.clientId}:replacement`, session.clientId, wallet);
        assertCurrent();
        setDevice(record); setMnemonic(seed); setSetupCode(record.setupCode || ''); setCard(record.cardGuardian || '');
        setReplacement(undefined); setReplacementMnemonic(''); setNewPassphrase(''); setRequest(undefined); setRequestCode(''); setApproval('');
        if (!await registerCurrent(record, seed, session, undefined, generation)) return;
        assertRegistrationActivity(generation, session, record);
        setNotice('New owner installed and freshly verified. Other pending requests cleared. Save the new kit and re-check the original setup with your independently confirmed current owner before funding.');
    }
    async function installReplacement() {
        if (!wallet || !replacement || !session) throw new Error('No saved replacement key is available.');
        const generation = signingGeneration.current;
        const assertCurrent = () => assertRegistrationActivity(generation, session, { wallet, owner: device?.owner });
        const seed = replacementMnemonic || await unlockDevice(replacement, newPassphrase);
        assertCurrent();
        const current = await owners(wallet);
        assertCurrent();
        if (current.length !== 1 || current[0].toLowerCase() !== replacement.owner.toLowerCase()) throw new Error('The saved replacement key is not the sole current on-chain owner.');
        await completeReplacement(seed, replacement, generation);
    }
    async function cancelAll() {
        if (!wallet)
            throw new Error('Choose a wallet first.');
        const requests = await readPending(wallet, MODULES);
        if (!requests.length)
            throw new Error('There are no pending recovery requests to cancel.');
        await submitTx(buildCancelRecoveryTx(wallet, await nonce(wallet), requests.map(r => r.module)), 'settings');
    }
    async function prepareRecovery() {
        if (!session)
            throw new Error('Sign in first.');
        const target = validatedAddress(recoverWallet || wallet || '');
        const seed = replacement ? await unlockDevice(replacement, newPassphrase) : generateOwnerSeed();
        const owner = mnemonicToAddress(seed);
        if (replacement?.wallet && replacement.wallet.toLowerCase() !== target.toLowerCase()) throw new Error('The saved replacement key belongs to another wallet. Use the saved wallet address.');
        let record = replacement || await saveDevice(`${session.clientId}:replacement`, seed, newPassphrase, owner, target);
        setReplacement(record);
        if (!record.setupCode || !record.cardGuardian) {
            const metadata = device?.wallet?.toLowerCase() === target.toLowerCase() && device.setupCode && device.cardGuardian
                ? { wallet: target, owner: device.owner, verified: false, clientId: session.clientId, chainId, setupCode: device.setupCode, cardGuardian: device.cardGuardian }
                : await call<WalletMetadataResponse>(`/wallets/${target}`, { token });
            const original = creationMetadata(record, metadata);
            record = await bindWallet(record, target, original.setupCode, original.cardGuardian);
            setReplacement(record);
        }
        setVerified(false); setChecked(false);
        setReplacementMnemonic(seed);
        setNewPassphrase('');
        setWallet(target);
        const selected = MODULES[moduleIndex];
        const recoveryNonce = await client.readContract({ address: selected.address, abi: moduleAbi, functionName: 'nonce', args: [target] });
        const req = { wallet: target, module: selected.address, newOwner: owner, nonce: recoveryNonce, chainId };
        setRequest(req);
        setRequestCode(encodeCode({ ...req, nonce: recoveryNonce.toString(), v: 1, kind: 'request' }));
    }
    async function beginRecovery() {
        if (!request || !session)
            throw new Error('Prepare a replacement device first.');
        const cardApproval = decodeApprovalCode(approval);
        if (cardApproval.chainId !== chainId)
            throw new Error('The approval code belongs to a different chain.');
        if (request.module.toLowerCase() !== MODULES[moduleIndex].address.toLowerCase()) throw new Error('Recovery path changed. Prepare a new request before importing the card approval.');
        const wire = { ...request, nonce: request.nonce.toString() };
        const helper = moduleIndex === 0 ? await call<RecoveryApproveResponse>('/recovery/approve', { partner: true, body: { ...wire, mockFace } }) : await call<RecoveryApproveResponse>('/recovery/approve', { token, body: { ...wire, mockVideoId: true } });
        await confirmedAction('Recovery waiting period started', await call<TransactionResponse>('/relay/recovery', { token, body: { ...wire, approvals: [{ signer: cardApproval.signer, signature: cardApproval.signature }, { signer: helper.signer, signature: helper.signature }] } }));
    }
    async function finalize(module: Address) {
        if (!wallet || !replacement || !session)
            throw new Error('The encrypted replacement key must be present on this device before finalizing.');
        const generation = signingGeneration.current;
        const assertCurrent = () => assertRegistrationActivity(generation, session, { wallet, owner: device?.owner });
        const seed = replacementMnemonic || await unlockDevice(replacement, newPassphrase);
        assertCurrent();
        const requests = await readPending(wallet, MODULES);
        assertCurrent();
        const selected = requests.find(r => r.module.toLowerCase() === module.toLowerCase());
        if (!selected || selected.executeAfter > BigInt(Math.floor(Date.now() / 1000)))
            throw new Error('The on-chain waiting period has not finished.');
        if (!selected.newOwners.some(owner => owner.toLowerCase() === replacement.owner.toLowerCase()))
            throw new Error('This recovery request is for a different replacement key.');
        await confirmedAction('Recovery finalized', await call<TransactionResponse>('/relay/finalize', { token, body: { wallet, module } }));
        const current = await owners(wallet);
        if (current.length !== 1 || current[0].toLowerCase() !== replacement.owner.toLowerCase())
            throw new Error('The chain did not confirm your replacement key as owner.');
        assertCurrent();
        await completeReplacement(seed, replacement, generation);
    }
    async function rotate() {
        if (!wallet || !device || !session)
            throw new Error('Unlock your existing wallet first.');
        const generation = signingGeneration.current;
        const assertCurrent = () => assertRegistrationActivity(generation, session, device);
        const seed = await unlocked(assertCurrent);
        const requests = await readPending(wallet, MODULES);
        assertCurrent();
        if (requests.length)
            await cancelAll();
        if (replacement?.wallet && replacement.wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error('The saved replacement key belongs to another wallet.');
        const nextSeed = replacement ? await unlockDevice(replacement, newPassphrase) : generateOwnerSeed();
        const next = replacement || await saveDevice(`${session.clientId}:replacement`, nextSeed, newPassphrase, mnemonicToAddress(nextSeed), wallet);
        setReplacement(next);
        setReplacementMnemonic(nextSeed);
        await submitTx(buildRotateOwnerTx(wallet, device.owner, next.owner, await nonce(wallet)), 'settings', seed);
        const current = await owners(wallet);
        if (current.length !== 1 || current[0].toLowerCase() !== next.owner.toLowerCase())
            throw new Error('Replacement key was not confirmed on chain. The old local key was preserved.');
        assertCurrent();
        await completeReplacement(nextSeed, next, generation);
    }
    function logout() { signingGeneration.current++; setSession(undefined); setMnemonic(''); setReplacementMnemonic(''); setPassphrase(''); setNewPassphrase(''); setDevice(undefined); setWallet(undefined); setKit(undefined); setKitCode(''); setReview(undefined); setSetupCode(''); setChecked(false); setPending([]); setAccount(undefined); setMailbox(undefined); setResetToken(''); setPassword(''); setReplacement(undefined); setRequest(undefined); setRequestCode(''); setApproval(''); setBalance(undefined); setEth(undefined); setVerified(false); setActivity([]); setNewPassword(''); setRecoverWallet(''); setNotice('Signed out and device key locked.'); }
    const classification = review && wallet ? classifyTransaction(wallet, review) : undefined;
    const locked = !mnemonic;
    const enabledFeatures = FEATURE_REGISTRY.filter(entry => featureEnabled(entry.flag));
    const selectedFeature = enabledFeatures.find(entry => entry.id === tab);
    const Feature = selectedFeature?.component;
    const featureContext: FeatureContext = {
        session, wallet, device, chainId, clients: featureClients, setupCode, mnemonic, busy: !!busy,
        refresh, run, notify: setNotice,
        recordTransaction: (label, hash) => setActivity(old => old.some(item => item.hash === hash) ? old : [{ label, hash, time: new Date().toLocaleTimeString() }, ...old]),
        relay: (tx, options) => submitTx(tx, options?.source ?? 'payment', undefined, options),
    };
    const navigation = ([{ id: 'overview', label: 'Overview', icon: '◈' }, { id: 'pay', label: 'Send money', icon: '↗' }, { id: 'recovery', label: 'Recovery', icon: '↻' }, { id: 'settings', label: 'Security & kit', icon: '⚙' }, { id: 'demo', label: 'MOCK demo lab', icon: '◇' }] as const);
    return <div className="app">
    <aside className="sidebar"><a className="brand" href="#"><span className="brand-mark">S<span>Q</span></span><span>swissquote<small>SELF-CUSTODY WALLET</small></span></a><div className="workspace-label">YOUR PERSONAL SPACE</div><nav aria-label="Wallet navigation">{navigation.map(item => <button key={item.id} onClick={() => { setTab(item.id); setReview(undefined); }} className={tab === item.id ? 'nav-item active' : 'nav-item'}><span className="nav-icon">{item.icon}</span>{enabledFeatures.find(entry => entry.id === item.id)?.label ?? item.label}{item.id === 'recovery' && pending.length > 0 && <span className="dot"/>}</button>)}{enabledFeatures.filter(entry => !navigation.some(item => item.id === entry.id)).map(entry => <button key={entry.id} onClick={() => { setTab(entry.id as Tab); setReview(undefined); }} className={tab === entry.id ? 'nav-item active' : 'nav-item'}><span className="nav-icon">◎</span>{entry.label}</button>)}</nav><div className="sidebar-bottom"><span className="network-dot"/>{chainId === 31337 ? 'Local development chain' : 'Sepolia test network'}<p>Test funds only. Not a bank product.</p><div className="trust-note">Your key moves money.<br />Your card protects recovery.</div></div></aside>
    <div className="main-shell"><header className="topbar"><span>Personal banking <span className="slash">/</span> <strong>My wallet</strong></span><div className="topbar-right"><span className="tag">{chainId === 31337 ? 'LOCAL' : 'TESTNET'}</span>{session && <button className="text-button" onClick={logout}>Sign out</button>}<span className="avatar">{email ? email.slice(0, 2).toUpperCase() : 'SQ'}</span></div></header>
    <main><div className="page-heading"><div className="eyebrow">YOUR MONEY. YOUR CONTROL.</div><h1>{!session ? 'A wallet that feels like home.' : tab === 'overview' ? 'Welcome to your wallet.' : selectedFeature ? selectedFeature.label : tab === 'pay' ? 'Send with confidence.' : tab === 'recovery' ? 'A new device. The same wallet.' : tab === 'settings' ? 'Security, on your terms.' : 'Put the safeguards to the test.'}</h1><p>{!session ? 'Everyday simplicity. Your own key. A way back if life happens.' : 'Connected to Swissquote. Controlled by you.'}</p></div>
    {busy && <div className="status info" role="status"><span className="spinner"/>{busy}… Please keep this page open.</div>}{error && <div className="status error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}{notice && <div className="status success" role="status">{notice}</div>}{pendingTx && <div className="status warning" role="status">Transaction pending — check Etherscan: <a href={pendingTx} target="_blank" rel="noreferrer">open transaction</a>. Wait for a result there before retrying.<button onClick={() => setPendingTx('')} aria-label="Dismiss pending notice">×</button></div>}{pollError && <div className="status warning" role="alert">{pollError} Recovery status is unknown, not clear.<button onClick={() => { void refresh(); }}>Retry public node checks</button></div>}
    {session && featureEnabled('recoveryWizard') && <RecoveryAlert context={featureContext}/>}
    {session && !featureEnabled('recoveryWizard') && pending.length > 0 && <section className="recovery-alert"><div><span className="eyebrow">RECOVERY ALERT</span><h3>Your wallet is moving to a new device.</h3><p>Not you? Cancel every pending request with your current owner key.</p>{pending.map(p => <div key={p.module} className="pending-line"><strong>{p.label}</strong><span>{countdown(p.executeAfter, now)}</span></div>)}</div><button disabled={!!busy} onClick={() => { void run('Cancelling both-module recovery', cancelAll); }}>Cancel all pending requests</button></section>}
    {!session ? <div className="auth-layout"><section className="panel auth-panel"><span className="section-label">{register ? 'GET STARTED' : 'WELCOME BACK'}</span><h2>{register ? 'Create your login' : 'Sign in to Swissquote'}</h2><p>Login opens your account. Your wallet key has its own device passphrase.</p><form onSubmit={e => { e.preventDefault(); void run(register ? 'Creating login' : 'Signing in', () => auth(false)); }}><Field label="Email address"><input type="email" value={email} autoComplete="username" required onChange={e => setEmail(e.target.value)}/></Field><Field label="Login password" hint="Password works for login only. Large payments and key changes require a passkey."><input type="password" value={password} autoComplete={register ? 'new-password' : 'current-password'} required onChange={e => setPassword(e.target.value)}/></Field><button className="primary full" disabled={!!busy}>{register ? 'Create login' : 'Sign in'}</button></form><div className="or">or use your device</div><button className="secondary full" disabled={!!busy || !email || (register && password.length < 12)} onClick={() => { void run('Confirming passkey', () => auth(true)); }}>◎ {register ? 'Create with a passkey' : 'Sign in with a passkey'}</button><div className="auth-links"><button className="text-button" onClick={() => setRegister(!register)}>{register ? 'Already a client? Sign in' : 'New here? Create a login'}</button><button className="text-button" disabled={!!busy || !email} onClick={() => { void run('Requesting MOCK password reset', async () => { await call('/auth/password/reset-request', { body: { email } }); setNotice('Reset requested. Open the MOCK demo mailbox to inspect the local reset message.'); setTab('demo'); }); }}>Forgot password?</button></div></section><section className="promise-panel"><div className="orb">◈</div><h2>Banking confidence.<br />Personal control.</h2><p>Day to day, only your key moves money. Replacing it needs your recovery card, one helper, and a wait your old device can cancel.</p><div className="promise-row"><span>01</span>Encrypted on your device</div><div className="promise-row"><span>02</span>No ETH needed for sponsored payments</div><div className="promise-row"><span>03</span>An emergency kit that works without services</div><small>Swissquote publishes this app. A malicious app update could copy an unlocked key. Independent checks verify wallet rules, not app integrity.</small></section></div> : <>
    {Feature && <Feature context={featureContext}/>}
    {device && wallet && locked && <div className="unlock-bar"><div><strong>Device key locked</strong><small>Login does not unlock your signing key.</small></div><input aria-label="Device passphrase" type="password" placeholder="Device passphrase" value={passphrase} onChange={e => setPassphrase(e.target.value)}/><button className="secondary" disabled={!!busy || !passphrase} onClick={() => { void run('Unlocking encrypted device key', async () => { await unlocked(); setNotice('Device key unlocked in memory. It locks after this page is hidden for two minutes.'); }); }}>Unlock device</button></div>}
    {tab === 'overview' && <>
      {enabledFeatures.filter(entry => entry.id === 'protection').map(entry => { const Protection = entry.component; return <Protection key={entry.id} context={featureContext}/>; })}
      {wallet ? <><div className="dashboard-grid"><section className="balance-card"><div className="balance-top"><span>SELF-CUSTODY WALLET</span><span className="pill">{verified ? 'Verified as yours' : 'Ownership not verified'}</span></div><div className="balance-value">{balance === undefined ? '—' : Number(balance).toLocaleString('en-CH', { maximumFractionDigits: 6 })}<span>USDC</span></div><div className="balance-sub">≈ CHF {balance === undefined ? '—' : Number(balance).toFixed(2)} <span>MOCK 1:1 rate</span></div><div className="balance-actions"><button onClick={() => setTab('pay')}>↗ Send money</button><Copy value={wallet} label="Copy wallet address"/></div><div className="wallet-address"><span>{short(wallet)}</span><span>{eth === undefined ? 'ETH balance unknown' : `${eth} ETH · network fees sponsored`}</span></div></section><section className="panel account-card"><span className="section-label">SWISSQUOTE ACCOUNT · MOCK</span><h3>One move closer to you.</h3><div className="account-balance">{account ? formatUnits(BigInt(account.balance), 6) : '—'} <small>USDC</small></div><p>Move test funds to your verified wallet. Your keys stay yours.</p><Field label="Amount in USDC"><input inputMode="decimal" value={fundAmount} onChange={e => setFundAmount(e.target.value)}/></Field><button className="primary full" disabled={!!busy || !verified || !checked} onClick={() => { void run('Moving MOCK account funds', async () => { await confirmedAction('Account transfer', await call<TransactionResponse>('/account/withdraw', { token, body: { to: wallet, amount: usdcAmount(fundAmount).toString() } })); setAccount(await call<AccountResponse>('/account', { token })); }); }}>Move to my wallet ↗</button>{!checked && <small className="warning-text">Check your wallet in the independent tool before depositing.</small>}<small>Other destinations: blocked until Swissquote verifies who owns them (Travel Rule).</small></section></div><section className="panel"><div className="section-header"><h3>Your safety net</h3><span className="tag">CARD REQUIRED ON BOTH PATHS</span></div><div className="safety-grid">{MODULES.map(m => <div key={m.address}><span className="safety-symbol">↻</span><h4>{m.label}</h4><p>{m.wait} waiting period in this demo. The old owner can cancel.</p></div>)}<div><span className="safety-symbol">▤</span><h4>Your emergency kit</h4><p>Encrypted owner backup. Keep the kit code separate from your card.</p><button className="text-button" onClick={() => setTab('settings')}>Manage kit →</button></div></div></section></> : <section className="panel setup-panel"><span className="section-label">MAKE IT YOURS</span><h2>Create your self-custody wallet</h2><div className="setup-steps"><span className="step">1 · Identity</span><span className="step">2 · Device key</span><span className="step">3 · Card address</span><span className="step">4 · Independent check</span></div><button className="secondary" disabled={!!busy || session.kycVerified} onClick={() => { void run('Verifying MOCK identity', async () => { await call('/kyc/mock-verify', { token, body: {} }); setSession({ ...session, kycVerified: true }); }); }}>{session.kycVerified ? '✓ MOCK KYC verified' : 'MOCK KYC: mark identity verified'}</button><div className="two-columns"><Field label={device ? 'Unlock existing device key' : 'Create a device passphrase'} hint="At least 12 characters. This encrypts your owner seed, not your login."><input type="password" value={passphrase} minLength={12} onChange={e => setPassphrase(e.target.value)}/></Field><Field label="Recovery card public address" hint="Only paste the 0x address. Never enter the card words here."><input placeholder="0x…" value={card} onChange={e => setCard(e.target.value)}/></Field></div><div className="tool-note"><strong>Make the card in the independent recovery tool.</strong><p>Open it from your bookmark or the printed address. Check the publisher yourself.</p><code>http://localhost:5174</code><p>Independent publisher: MOCK in this prototype.</p></div><Field label="Partner face template · MOCK"><input value={mockFace} onChange={e => setMockFace(e.target.value)}/></Field><button className="primary" disabled={!!busy || !session.kycVerified || !card || passphrase.length < 12} onClick={() => { void run('Creating wallet with both recovery modules', createWallet); }}>Create my wallet ↗</button><p className="fine-print">A 24-word owner seed is generated locally and encrypted in IndexedDB. The card seed stays in the independent tool.</p></section>}
      {setupCode && <section className="panel"><h3>Check before depositing</h3><p>Paste this original setup code into “Check my wallet” in the independent tool. Enter the 12-word Recovery Card there, never here. The advanced 24-word owner seed is different: it can directly spend funds. After recovery or rotation, supply the independently confirmed current owner from your saved replacement request or fresh kit; do not change the setup code.</p><textarea readOnly value={setupCode} aria-label="Wallet setup code"/><Copy value={setupCode}/><label className="check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/>I personally saw a green result in the independent tool.</label><small>This checkbox records your acknowledgement; it is not an automated verification result.</small></section>}
      {wallet && !setupCode && <section className="panel"><h3>Before depositing</h3><p>Re-check the saved setup code in the independent tool after signing in on a new page.</p><label className="check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/>I checked the wallet rules independently and saw green.</label></section>}
      <section className="panel"><div className="section-header"><h3>Recent activity</h3><button className="text-button" onClick={() => { void refresh(); }}>Refresh chain status ↻</button></div>{activity.length ? activity.map(a => <div className="activity" key={a.hash}><span className="activity-icon">↗</span><div><strong>{a.label}</strong><small>{a.time} · Confirmed receipt</small></div>{chainId === 11155111 ? <a href={`https://sepolia.etherscan.io/tx/${a.hash}`} target="_blank" rel="noreferrer">View transaction ↗</a> : <Copy value={a.hash} label="Copy transaction hash"/>}</div>) : <div className="empty"><span>↗</span><p>No confirmed transactions in this session.</p><small>Activity appears only after a successful chain receipt.</small></div>}</section>
    </>}
    {tab === 'pay' && !Feature && <div className="content-grid"><section className="panel"><span className="section-label">USDC PAYMENT</span><h2>{review ? 'Check before you sign' : 'Where should it go?'}</h2>{!wallet ? <p>Create or recover your wallet first.</p> : !review ? <form onSubmit={e => { e.preventDefault(); void run('Preparing payment', async () => { setReview(await paymentTx(wallet, recipient, amount)); }); }}><Field label="Recipient wallet address"><input placeholder="0x…" value={recipient} onChange={e => setRecipient(e.target.value)} required/></Field><Field label="Amount in USDC" hint="CHF estimate uses a fixed MOCK 1:1 rate."><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required/></Field><button className="primary full" disabled={!!busy}>Review payment ↗</button></form> : <><div className="payment-summary"><span>You send</span><strong>{amount} <small>USDC</small></strong><span>≈ CHF {Number(amount).toFixed(2)} · MOCK rate</span></div><dl className="review-details"><dt>Recipient</dt><dd className="address-wrap">{recipient}</dd><dt>Transaction class</dt><dd>{classification?.class}</dd><dt>Approval</dt><dd>{classification?.requiresPasskey ? 'Passkey bound to this transaction hash' : 'Owner signature · no step-up'}</dd><dt>Network fee</dt><dd>Paid by Swissquote</dd><dt>Checks</dt><dd>Relayer simulates and checks MOCK sanctions before submitting. Not yet completed.</dd></dl><p className="fine-print">You are the sender. Swissquote pays the fee; it does not sign your payment. It can refuse sponsorship, but cannot prevent an owner-funded submission. Legal interpretation needs counsel.</p><button className="primary full" disabled={!!busy || !classification?.relayAllowed} onClick={() => { void run('Signing and submitting payment', async () => { if (await nonce(wallet) !== review.nonce)
            throw new Error('Wallet nonce changed. Review this payment again.'); await submitTx(review); setReview(undefined); }); }}>{classification?.requiresPasskey ? 'Confirm with passkey & send' : 'Sign & send payment'} ↗</button><button className="text-button" onClick={() => setReview(undefined)}>Edit payment</button></>}</section><section className="side-explainer"><span className="large-icon">◎</span><h3>A little extra care for larger payments.</h3><p>Above 5 USDC, your passkey confirms the exact transaction hash. A password cannot approve a large payment.</p><div className="divider"/><h4>Zero ETH? No problem.</h4><p>The relayer pays the network fee. Your owner key still signs every payment.</p><small>Limits are sponsorship rules, not on-chain spending limits.</small></section></div>}
    {tab === 'recovery' && !Feature && <div className="content-grid"><section className="panel"><span className="section-label">RECOVER ACCESS</span><h2>Your card is the missing piece.</h2><p>A password reset cannot unlock your seed or replace your owner key. Recovery needs your card plus one helper.</p><Field label="Wallet to recover"><input placeholder="0x…" value={recoverWallet || wallet || ''} onChange={e => setRecoverWallet(e.target.value)}/></Field><Field label="Recovery path"><select value={moduleIndex} onChange={e => { setModuleIndex(Number(e.target.value)); setRequest(undefined); setRequestCode(''); setApproval(''); }}>{MODULES.map((m, i) => <option key={m.address} value={i}>{m.label} · {m.wait}</option>)}</select></Field><Field label={replacement ? 'Unlock replacement key passphrase' : 'New device passphrase'} hint="The replacement key is encrypted before recovery starts. Keep this device until you finish."><input type="password" minLength={12} value={newPassphrase} onChange={e => setNewPassphrase(e.target.value)}/></Field><button className="secondary" disabled={!!busy || newPassphrase.length < 12} onClick={() => { void run('Preparing encrypted replacement device', prepareRecovery); }}>Prepare replacement device</button>{request && <><div className="fingerprint"><small>NEW OWNER FINGERPRINT</small><strong>{ownerFingerprint(request.newOwner)}</strong><code>{request.newOwner}</code></div><Field label="Request code · paste into the independent tool"><textarea value={requestCode} readOnly/></Field><Copy value={requestCode}/><Field label="Approval code · paste back from the independent tool" hint="This is a signature code, not your card words."><textarea value={approval} onChange={e => setApproval(e.target.value)}/></Field><Field label={moduleIndex === 0 ? 'Partner face check · MOCK' : 'Swissquote video ID · MOCK'}><input value={mockFace} onChange={e => setMockFace(e.target.value)} disabled={moduleIndex === 1}/></Field><button className="primary full" disabled={!!busy || !approval} onClick={() => { void run('Requesting helper approval and on-chain recovery', beginRecovery); }}>Approve & start waiting period</button></>}{pending.map(p => <div className="finalize-box" key={p.module}><h4>{p.label}</h4><strong>{countdown(p.executeAfter, now)}</strong><p>The countdown comes from the chain. There is no bypass or accelerated demo clock.</p><button className="primary" disabled={!!busy || p.executeAfter > BigInt(Math.floor(now / 1000)) || !replacement} onClick={() => { void run('Finalizing recovery and clearing other requests', () => finalize(p.module)); }}>Finalize & install replacement key</button></div>)}</section><section className="side-explainer"><span className="large-icon">↻</span><h3>Time to notice. Time to cancel.</h3><p>The old device checks both recovery modules every 15 seconds using public nodes. It can cancel every pending request in one owner-signed batch.</p><h4>Partner unavailable?</h4><p>Use your card with Swissquote instead. That path waits 3 days in this demo, not 3 minutes.</p><h4>No services at all?</h4><p>Your emergency kit holds an encrypted copy of the owner seed. Open it in the saved independent tool.</p><small>A thief who also knows your device passphrase can spend before you recover. Key rotation is a race if the seed is already stolen.</small></section></div>}
    {tab === 'settings' && !Feature && <div className="content-grid"><div><section className="panel"><span className="section-label">DEVICE SECURITY</span><h2>Your key stays with you.</h2><dl className="review-details"><dt>Device storage</dt><dd>AES-GCM encrypted seed in IndexedDB</dd><dt>Key derivation</dt><dd>PBKDF2-SHA256 · 600,000 iterations</dd><dt>Owner address</dt><dd className="address-wrap">{device?.owner || 'No device key yet'}</dd><dt>Current state</dt><dd>{locked ? 'Locked' : 'Unlocked in memory'}</dd></dl><button className="secondary" onClick={() => { signingGeneration.current++; setMnemonic(''); setReplacementMnemonic(''); setPassphrase(''); setNewPassphrase(''); setKitCode(''); }}>Lock device now</button><button className="secondary" disabled={!!busy} onClick={() => { void run('Registering a passkey', async () => { const options = await call<PasskeyOptionsResponse>('/auth/passkey/register/options', { token, body: { email } }); const response = await startRegistration({ optionsJSON: options.options as Parameters<typeof startRegistration>[0]['optionsJSON'] }); setSession(await call<SessionResponse>('/auth/passkey/register/verify', { token, body: { email, response, challengeId: options.challengeId } })); setNotice('Passkey registered. Large payments and key changes can now request step-up.'); }); }}>Add a passkey</button></section><section className="panel"><span className="section-label">REPLACE MY KEY</span><h3>A fresh owner key. The same address.</h3><p>Pending requests are cancelled first. The old key signs the change, and a passkey approves its transaction hash. The old local key is replaced only after chain confirmation.</p><Field label="New key's device passphrase"><input type="password" value={newPassphrase} minLength={12} onChange={e => setNewPassphrase(e.target.value)}/></Field><button className="primary" disabled={!!busy || !wallet || !device || newPassphrase.length < 12} onClick={() => { void run('Replacing owner key', rotate); }}>Replace my key with passkey</button><small>If the seed is stolen, replacement is a race. This cannot undo past payments.</small></section></div><section className="panel kit-panel"><span className="section-label">YOUR WAY OUT</span><div className="kit-icon">▤</div><h2>The emergency kit.</h2><p>Even if Swissquote and the partner disappear, your owner key can still sign. Save the encrypted kit to your own cloud or email; keep the code somewhere separate.</p><button className="secondary full" disabled={!!busy || !wallet || !device} onClick={() => { void run('Encrypting emergency kit', async () => { if (!wallet || !device)
            return; await exportKit(await unlocked(), wallet, device.owner); }); }}>Create a fresh kit export</button>{kit && <><div className="kit-code"><small>KIT CODE · WRITE THIS DOWN SEPARATELY</small><strong>{kitCode || 'Code hidden when the page was locked. Create a fresh export if you did not save it.'}</strong></div><p className="warning-text">Anyone with both this code and the kit file can unlock your owner seed. Do not store them together or with your card.</p><button className="primary full" onClick={() => download(kit, `swissquote-emergency-kit-${short(wallet || '')}.json`)}>Download encrypted kit ↓</button><button className="text-button" onClick={() => { setKitCode(''); setKit(undefined); }}>I saved it · hide code</button></>}<small>Open the kit in the independently saved tool, not in this wallet. After recovery or rotation, export a new kit. The old seed no longer controls this wallet.</small></section></div>}
    {wallet && device?.setupCode && !verified && <section className="status warning"><div><strong>Wallet deployed, ownership registration incomplete.</strong><p>Retry registration without deploying another wallet.</p></div><button disabled={!!busy} onClick={() => { void run('Retrying ownership registration', registerExistingWallet); }}>Retry registration</button></section>}
    {replacement && wallet && <section className="panel"><h3>Saved replacement key</h3><p>If recovery or rotation completed but local installation was interrupted, unlock and install this saved key. The chain must confirm it is already the owner.</p><Field label="Replacement device passphrase"><input type="password" value={newPassphrase} onChange={e => setNewPassphrase(e.target.value)}/></Field><button disabled={!!busy || (!replacementMnemonic && !newPassphrase)} onClick={() => { void run('Installing saved replacement key', installReplacement); }}>Check chain and install replacement</button></section>}
    {tab === 'demo' && !Feature && renderDemo()}
    </>}
    {!session && tab === 'demo' && renderDemo()}
    {kit && tab !== 'settings' && <section className="status warning"><div><strong>Save your emergency kit now.</strong><p>The kit code is shown only in this session. Keep its kit code separate from the file and the Recovery Card.</p></div><button onClick={() => setTab('settings')}>Open kit export →</button></section>}
    <footer><span>Swissquote Wallet · Hackathon prototype</span><span>Real signatures & chain checks. Bank account, KYC, face checks and mailbox: MOCK.</span></footer>
    </main></div>
  </div>;
    function renderDemo() { return <div className="content-grid"><section className="panel"><span className="section-label">STOLEN PHONE + EMAIL · MOCK</span><h2>A login is not an owner key.</h2><p>Use the local mailbox to reset a login password. This does not decrypt the device seed.</p><Field label="Email for MOCK password reset"><input type="email" value={email} onChange={e => setEmail(e.target.value)}/></Field><div className="button-row"><button className="secondary" disabled={!!busy || !email} onClick={() => { void run('Sending MOCK reset message', async () => { await call('/auth/password/reset-request', { body: { email } }); setMailbox(await call<MockMailboxResponse>('/mock/mailbox', { token })); }); }}>Request reset · MOCK</button><button className="secondary" disabled={!!busy} onClick={() => { void run('Reading MOCK mailbox', async () => { setMailbox(await call<MockMailboxResponse>('/mock/mailbox', { token })); }); }}>Open MOCK mailbox</button></div>{mailbox?.messages.map(message => <div className="mail" key={message.id}><strong>{message.subject}</strong><small>{message.email} · MOCK</small><button className="text-button" onClick={() => setResetToken(message.resetToken)}>Use this local reset token</button></div>)}<Field label="Local reset token"><input value={resetToken} onChange={e => setResetToken(e.target.value)}/></Field><Field label="New login password"><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}/></Field><button className="primary" disabled={!!busy || !resetToken || !newPassword} onClick={() => { void run('Resetting login password only', async () => { await call('/auth/password/reset', { body: { token: resetToken, password: newPassword } }); setResetToken(''); setNewPassword(''); setNotice('Login password reset. Owner seed remains locked by its device passphrase.'); }); }}>Reset login password · MOCK</button></section><section className="panel"><span className="section-label">HELPER COLLUSION · MOCK INPUTS</span><h3>Suppose both helpers were fooled.</h3><p>This switch only changes MOCK identity checks. It does not create a card signature or change the contract threshold.</p><button className="secondary full" disabled={!!busy} onClick={() => { void run('Changing MOCK fooled switches', async () => { const next = !fooled; await call('/demo/fooled', { token, body: { enabled: next } }); await call('/demo/fooled', { partner: true, body: { enabled: next } }); setFooled(next); }); }}>{fooled ? 'Disable fooled helpers · MOCK' : 'Suppose both were fooled · MOCK'}</button><button className="primary full" disabled={!!busy || !session || !wallet} onClick={() => { void run('Testing both modules without a card signature', async () => { if (!session || !wallet)
        return; const attacker = mnemonicToAddress(generateOwnerSeed()); const failures: string[] = []; for (const module of MODULES) {
        const n = await client.readContract({ address: module.address, abi: moduleAbi, functionName: 'nonce', args: [wallet] });
        const body = { wallet, module: module.address, newOwner: attacker, nonce: n.toString(), chainId };
        let sq: RecoveryApproveResponse;
        let partner: RecoveryApproveResponse;
        try {
            const sqNonce = await client.readContract({ address: MODULES[1].address, abi: moduleAbi, functionName: 'nonce', args: [wallet] });
            const partnerNonce = await client.readContract({ address: MODULES[0].address, abi: moduleAbi, functionName: 'nonce', args: [wallet] });
            sq = await call('/recovery/approve', { token, body: { ...body, module: MODULES[1].address, nonce: sqNonce.toString(), mockVideoId: true } });
            partner = await call('/recovery/approve', { partner: true, body: { ...body, module: MODULES[0].address, nonce: partnerNonce.toString(), mockFace: 'thief-face' } });
        }
        catch (e) {
            throw new Error(`Helper policy refused the attacker before the contract test: ${errorMessage(e)}`);
        }
        try {
            await client.simulateContract({ address: module.address, abi: moduleAbi, functionName: 'multiConfirmRecovery', args: [wallet, [attacker], 1n, [{ signer: sq.signer, signature: sq.signature }, { signer: partner.signer, signature: partner.signature }].sort((a, b) => BigInt(a.signer) < BigInt(b.signer) ? -1 : 1), true] });
            throw new Error(`${module.label}: simulation unexpectedly succeeded. No transaction was submitted.`);
        }
        catch (e) {
            const text = errorMessage(e);
            if (!text.includes('SM:') || !/guardian|threshold|signature/i.test(text))
                throw e;
            failures.push(`${module.label}: refused by contract — recovery card missing.`);
        }
    } setNotice(failures.join(' ')); }); }}>Test helper-only recovery · eth_call only</button><small>No transaction is sent by this test. A claimed refusal appears only after the real public-node simulation rejects the helper signatures.</small><div className="divider"/><h4>Known limit</h4><p>A thief with your phone and email still needs your device passphrase to spend. If they know it, they can spend before you recover.</p></section></div>; }
}
