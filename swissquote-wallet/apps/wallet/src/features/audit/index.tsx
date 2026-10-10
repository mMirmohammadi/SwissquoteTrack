import { useEffect, useRef, useState } from 'react';
import { auditWallet, type WalletAudit } from '@sq/protocol';
import type { FeatureProps } from '../context';
export default function Feature({ context }: FeatureProps) {
  const [report, setReport] = useState<WalletAudit>();
  const [checking, setChecking] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setReport(undefined); setChecking(false); return () => { generation.current++; }; }, [context.wallet, context.clients]);
  async function check() {
    if (!context.wallet || checking) return;
    const ticket = ++generation.current;
    setChecking(true);
    try {
      const result = await auditWallet(context.clients, context.wallet);
      if (ticket === generation.current) setReport(result);
    } finally { if (ticket === generation.current) setChecking(false); }
  }
  return <section data-testid="trust-check" aria-label="Wallet trust check">
    <h2>Can Swissquote move my money?</h2>
    <p>This checks current on-chain rules through two nodes at the same block. It cannot identify who holds an address's key or prove the app is safe.</p>
    <button disabled={!context.wallet || checking || context.busy} onClick={() => void check()}>{checking ? 'Checking…' : 'Check wallet rules'}</button>
    {context.setupCode && <p><a href={`http://localhost:5274/#check=${encodeURIComponent(context.setupCode)}`} target="_blank" rel="noopener noreferrer">MOCK independent tool · public wallet rules only</a>. The fragment contains a public wallet check code, not a key. In production, open your separately verified bookmark.</p>}
    {!context.wallet && <p>Select a deployed wallet first.</p>}
    {report && <div aria-live="polite">
      <h3>{report.facts.verified ? 'Recognised recovery rules at this block' : 'Rules not confirmed — do not assume protection'}</h3>
      {report.answers.map(item => <div key={item.question}><h4>{item.question} — {item.answer}</h4><p>{item.explanation}</p></div>)}
      <h3>Observed facts</h3><dl>{Object.entries(report.facts).map(([key, value]) => <div key={key}><dt>{key}</dt><dd style={{ overflowWrap: 'anywhere' }}>{String(value)}</dd></div>)}</dl>
      <h3>Limits and warnings</h3><ul>{report.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      <p>No collusion replay was run by this check. A contract-refusal claim needs the separate throwaway-wallet evidence, not a helper signature for this wallet.</p>
    </div>}
  </section>;
}
