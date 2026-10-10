import type { Address, Hex, PublicClient } from 'viem';
import type { SessionResponse, SafeTx, TransactionResponse } from '@sq/protocol';
import type { DeviceRecord } from '../storage';
export interface FeatureContext {
  session?: SessionResponse; wallet?: Address; device?: DeviceRecord; chainId: number;
  clients: readonly PublicClient[]; setupCode: string; mnemonic: string;
  busy: boolean; refresh: () => Promise<void>;
  run: (label: string, action: () => Promise<void>) => Promise<void>;
  notify: (message: string) => void;
  recordTransaction: (label: string, hash: Hex) => void;
  relay: (tx: SafeTx, options?: { source?: 'settings' | 'payment' | 'pay' | 'dapp' | 'recovery'; dappId?: string; effectsHash?: Hex }) => Promise<TransactionResponse>;
}
export interface FeatureProps { context: FeatureContext }
export const FEATURE_FLAGS = ['recoveryWizard', 'dapps', 'audit', 'protection', 'payPreview', 'strictSponsorship', 'partnerPrivacy'] as const;
export type FeatureFlag = typeof FEATURE_FLAGS[number];
export function featureEnabled(flag: FeatureFlag): boolean { return (import.meta.env?.VITE_FEATURES ?? '').split(',').includes(flag); }
