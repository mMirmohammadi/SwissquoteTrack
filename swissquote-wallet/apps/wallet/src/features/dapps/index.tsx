import React, { useEffect, useRef, useState } from 'react';
import { formatUnits, type Hex } from 'viem';
import { DAPP_ADDRESSES, DAPP_REGISTRY, quoterAbi, safeAbi, safeTxToWire, type DappEntry, type DappPreviewResponse, type SafeTx } from '@sq/protocol';
import { call, errorMessage } from '../../api';
import { PendingTransactionError } from '../../chain';
import type { FeatureProps } from '../context';
import { TEST_IDS } from '../test-ids';
import { buildDappTx, checkedPreview, checkedRegistry, confirmedPermission, parseAmount, RISK_NOTICE, SEPOLIA_CHAIN_ID, verifySafeReceipt, type DappOperation } from './helpers';

type Prepared = { tx: SafeTx; response: DappPreviewResponse; operation: DappOperation; identity: string };
type Result = { hash: Hex; status: string; permission?: string; unresolved?: boolean };

export default function Feature({ context }: FeatureProps) {
  const [registry, setRegistry] = useState<DappEntry[]>([]);
  const [registryError, setRegistryError] = useState('');
  const [operation, setOperation] = useState<DappOperation>('swap');
  const [amount, setAmount] = useState('1');
  const [prepared, setPrepared] = useState<Prepared>();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result>();
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const identity = `${context.chainId}:${context.wallet ?? ''}:${context.session?.token ?? ''}:${operation}:${amount}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const availableNetwork = context.chainId === SEPOLIA_CHAIN_ID;
  const client = context.clients[0];
  const dappId = operation === 'swap' ? 'uniswap' : 'compound';
  const listed = registry.find(entry => entry.id === dappId);
  const canPreview = availableNetwork && !!context.wallet && !!context.session && !!client && !!listed && !context.busy && !working && !result?.unresolved;

  useEffect(() => {
    let cancelled = false;
    setRegistry([]);
    setRegistryError('');
    if (!availableNetwork) return;
    call<unknown>('/dapps', { token: context.session?.token }).then(value => {
      if (cancelled) return;
      const entries = checkedRegistry(value, DAPP_REGISTRY, context.chainId);
      setRegistry(entries);
      if (!entries.length) setRegistryError('No locally pinned dApps are available from the service. Signing is disabled.');
    }).catch(reason => { if (!cancelled) setRegistryError(errorMessage(reason)); });
    return () => { cancelled = true; };
  }, [availableNetwork, context.chainId, context.session?.token]);

  useEffect(() => { setPrepared(undefined); setAccepted(false); setError(''); }, [identity]);

  async function preview() {
    if (!canPreview || !context.wallet || !client || inFlight.current) return;
    const wallet = context.wallet;
    const requestIdentity = identity;
    inFlight.current = true;
    setWorking(true);
    setPrepared(undefined);
    setAccepted(false);
    setError('');
    try {
      await context.run('Preview DeFi action', async () => {
        try {
          const units = parseAmount(amount);
          const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
          const nonce = await client.readContract({ address: wallet, abi: safeAbi, functionName: 'nonce', blockNumber });
          let quote: bigint | undefined;
          if (operation === 'swap') {
            const quoted = await client.simulateContract({ address: DAPP_ADDRESSES.quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle', blockNumber, args: [{ tokenIn: DAPP_ADDRESSES.usdc, tokenOut: DAPP_ADDRESSES.eurc, amountIn: units, fee: 500, sqrtPriceLimitX96: 0n }] });
            quote = quoted.result[0];
          }
          const tx = buildDappTx(wallet, operation, units, nonce, quote);
          const response = checkedPreview(await call<unknown>('/dapps/preview', { token: context.session?.token, body: { wallet, tx: safeTxToWire(tx), dappId } }), dappId);
          if (currentIdentity.current !== requestIdentity) return;
          setPrepared({ tx, response, operation, identity: requestIdentity });
        } catch (reason) {
          if (currentIdentity.current === requestIdentity) setError(errorMessage(reason));
        }
      });
    } catch (reason) { setError(errorMessage(reason)); }
    finally { inFlight.current = false; setWorking(false); }
  }

  async function execute() {
    if (!prepared || prepared.identity !== identity || !accepted || !canPreview || !context.wallet || !client || inFlight.current) return;
    const review = prepared;
    const wallet = context.wallet;
    inFlight.current = true;
    setWorking(true);
    setPrepared(undefined); // A preview can authorize one attempt only, including a rejected or uncertain send.
    setAccepted(false);
    setError('');
    try {
      await context.run('Confirm DeFi action', async () => {
        let submitted = false;
        try {
          const nonce = await client.readContract({ address: wallet, abi: safeAbi, functionName: 'nonce' });
          if (nonce !== review.tx.nonce || currentIdentity.current !== review.identity) throw new Error('The wallet or action changed. Get a new preview before signing.');
          // The shell owns signing and any passkey step-up; never access the device key here.
          const response = await context.relay(review.tx, { source: 'dapp', dappId: review.response.dappId, effectsHash: review.response.effectsHash });
          if (!/^0x[0-9a-fA-F]{64}$/.test(response.transactionHash)) throw new Error('The service did not return a valid transaction hash. Check wallet history before retrying.');
          submitted = true;
          setResult({ hash: response.transactionHash, status: 'Submitted; not yet confirmed. Do not repeat this action until its status is known.', unresolved: true });
          context.recordTransaction(`DeFi ${review.operation}`, response.transactionHash);
          let receipt;
          try { receipt = await client.waitForTransactionReceipt({ hash: response.transactionHash, timeout: 180000 }); }
          catch { setResult({ hash: response.transactionHash, status: 'Pending or receipt unavailable. No successful action has been confirmed; check Etherscan before retrying.', unresolved: true }); return; }
          verifySafeReceipt(receipt, wallet);
          setResult({ hash: response.transactionHash, status: 'Safe execution confirmed on chain. Permission verification is still pending.' });
          const spender = review.operation === 'swap' ? DAPP_ADDRESSES.uniswap : DAPP_ADDRESSES.compound;
          try {
            const allowance = await confirmedPermission(client, wallet, DAPP_ADDRESSES.usdc, spender, receipt.blockNumber);
            setResult({ hash: response.transactionHash, status: 'Safe execution confirmed on chain.', permission: allowance === 0n ? 'Permission now 0 (read from the chain at the receipt block).' : `Permission is not zero: ${formatUnits(allowance, 6)} USDC. Do not repeat; inspect this allowance.` });
          } catch { setResult({ hash: response.transactionHash, status: 'Safe execution confirmed on chain.', permission: 'Permission could not be verified. No zero-permission claim is made.' }); }
          context.notify('DeFi Safe execution confirmed on chain.');
          await context.refresh();
        } catch (reason) {
          if (reason instanceof PendingTransactionError) {
            setResult({ hash: reason.hash, status: 'Pending or receipt unavailable. No successful action has been confirmed; check Etherscan before retrying.', unresolved: true });
          }
          setError(`${errorMessage(reason)}${submitted ? ' A transaction was submitted; inspect its receipt before retrying.' : ''}`);
        }
      });
    } catch (reason) { setError(errorMessage(reason)); }
    finally { inFlight.current = false; setWorking(false); }
  }

  async function checkPending() {
    if (!result?.unresolved || !client || !context.wallet || inFlight.current || context.busy) return;
    const hash = result.hash;
    inFlight.current = true;
    setWorking(true);
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      verifySafeReceipt(receipt, context.wallet);
      setResult({ hash, status: 'Safe execution confirmed on chain.', permission: 'Permission has not been verified by this status check.' });
      await context.refresh();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { inFlight.current = false; setWorking(false); }
  }

  const activePreview = prepared?.identity === identity ? prepared : undefined;
  return <section data-testid={TEST_IDS.dapps} aria-label="Allow-listed DeFi">
    <h2>Allow-listed by Swissquote (security checks only)</h2>
    <p>Allow-listed means on Swissquote’s fee-sponsorship list after technical checks of pinned contracts. It is not investment advice or a guarantee of safety.</p>
    <p>Sepolia test network only. Uniswap’s test pool is shallow; prices can move. Compound III is a third-party test deployment, not an official Compound Sepolia deployment. Test tokens have no cash value.</p>
    <p>{RISK_NOTICE}</p>
    {!availableNetwork && <p role="alert">DeFi signing is unavailable on this network. A Sepolia fork cannot be identified safely from the current feature context.</p>}
    {!context.wallet && <p>Unlock and register your wallet before previewing an action.</p>}
    {registryError && <p role="alert">Registry unavailable: {registryError}</p>}
    <label>Action <select value={operation} disabled={working || context.busy} onChange={event => setOperation(event.target.value as DappOperation)}>
      <option value="swap">Swap USDC → EURC on Uniswap</option>
      <option value="supply">Supply USDC to Compound (third-party test deployment)</option>
      <option value="withdraw">Withdraw USDC from Compound (third-party test deployment)</option>
    </select></label>
    <label>Amount (USDC, at most 5) <input inputMode="decimal" value={amount} disabled={working || context.busy} onChange={event => setAmount(event.target.value)} /></label>
    <p>{operation === 'withdraw' ? 'Withdrawal has no token approval. The service must verify that you are withdrawing supplied USDC, not borrowing.' : 'The batch approves exactly this amount, performs the action, then resets permission to 0. No unlimited approval.'}</p>
    {!listed && availableNetwork && <p>This action is not available from the checked registry. Nothing can be signed.</p>}
    <button data-testid={TEST_IDS.dappPreview} disabled={!canPreview} onClick={() => void preview()}>{working ? 'Checking…' : 'Preview with Swissquote'}</button>
    {error && <p role="alert">{error}</p>}
    {activePreview && <section aria-label="Swissquote simulation preview">
      <h3>Swissquote’s preview — not an executed transaction</h3>
      <ul>{activePreview.response.summary.map((line, index) => <li key={index}>{line}</li>)}</ul>
      <p>Simulation block: {activePreview.response.blockNumber}. The relayer checks the effects again before sending; unavailable or changed effects block sponsorship.</p>
      <p>Effects hash: <code>{activePreview.response.effectsHash}</code></p>
      {activePreview.response.warnings.length > 0 && <ul>{activePreview.response.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      <p>{RISK_NOTICE}</p>
      <label><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /> I reviewed the service’s summary and understand the risks.</label>
      <button data-testid={TEST_IDS.dappExecute} disabled={!accepted || !canPreview} onClick={() => void execute()}>Confirm this exact action</button>
    </section>}
    {result && <section aria-live="polite"><h3>Transaction status</h3><p>{result.status}</p><a href={`https://sepolia.etherscan.io/tx/${result.hash}`} target="_blank" rel="noreferrer">View submitted transaction on Etherscan</a>{result.permission && <p>{result.permission}</p>}{result.unresolved && <button disabled={working || context.busy} onClick={() => void checkPending()}>Check pending receipt (read-only)</button>}</section>}
    <p>Unlisted contracts are not offered here: Swissquote has not checked them and does not pay their fee. This screen cannot prove a service refusal without a real refusal response.</p>
  </section>;
}
