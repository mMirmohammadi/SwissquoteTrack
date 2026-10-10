import type { ComponentType } from 'react';
import type { FeatureFlag, FeatureProps } from './context';
import Recovery from './recovery';
import Alert from './alert';
import Dapps from './dapps';
import Audit from './audit';
import Protection from './protection';
import Pay from './pay';
import Settings from './settings';
import DemoLab from './demoLab';
export { featureEnabled } from './context';
export type { FeatureContext, FeatureProps } from './context';
export interface FeatureEntry { id: string; label: string; flag: FeatureFlag; component: ComponentType<FeatureProps> }
export const FEATURE_REGISTRY: readonly FeatureEntry[] = [
 { id: 'recovery', label: 'Recover access', flag: 'recoveryWizard', component: Recovery },
 { id: 'dapps', label: 'DeFi', flag: 'dapps', component: Dapps },
 { id: 'audit', label: 'Trust check', flag: 'audit', component: Audit },
 { id: 'protection', label: 'Protection', flag: 'protection', component: Protection },
 { id: 'pay', label: 'Pay', flag: 'payPreview', component: Pay },
 { id: 'settings', label: 'Settings', flag: 'protection', component: Settings },
 { id: 'demo', label: 'Demo lab', flag: 'audit', component: DemoLab },
];
export const RecoveryAlert = Alert;
