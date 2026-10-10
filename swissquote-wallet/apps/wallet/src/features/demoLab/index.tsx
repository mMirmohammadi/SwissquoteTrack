import { useState } from 'react';
import type { FeatureProps } from '../context';
import { DEMO_CASES, DEMO_SAFETY_NOTICE } from './model';

export default function DemoLab(_props: FeatureProps) {
  const [selected, setSelected] = useState<(typeof DEMO_CASES)[number]['id']>('helper-only');
  const scenario = DEMO_CASES.find(item => item.id === selected)!;
  return <section className="panel" data-testid="feature-demo-lab">
    <h2>Why helpers still need your Recovery Card</h2>
    <p>{DEMO_SAFETY_NOTICE}</p>
    <label className="field">Explore an approval pair
      <select value={selected} onChange={event => setSelected(event.target.value as typeof selected)}>
        {DEMO_CASES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>
    <h3>{scenario.outcome}</h3><p role="status">{scenario.explanation}</p>
    <h3>Check both routes independently</h3>
    <ul><li>Recovery Card + partner — module A.</li><li>Recovery Card + Swissquote — module B.</li></ul>
    <p>Keep card words only in your independently saved offline tool. Compare every group of the replacement owner address there before approving.</p>
    <p>Partner face matching and Swissquote video ID are MOCK checks in this demo, not biometric authentication. Face mismatch stays refused; this screen cannot turn on a bypass.</p>
    <p>Evidence boundary: the lead-gated throwaway local contract replay must separately show helper-only rejection and card-plus-helper acceptance. That replay has not been run by this screen. A compromised wallet UI can mislead; this is not a promise of complete security.</p>
  </section>;
}
