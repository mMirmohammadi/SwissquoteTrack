import type { Address } from 'viem';
import type { DeviceRecord } from './storage';

/** A saved acknowledgement is evidence of a user's action, never a live chain audit. */
export function hasIndependentCheck(record: DeviceRecord | undefined, wallet: Address | undefined, chainId: number): boolean {
  const check = record?.independentCheck;
  return !!(record && wallet && check?.checkedAt && check.chainId === chainId
    && record.wallet?.toLowerCase() === wallet.toLowerCase()
    && check.wallet.toLowerCase() === wallet.toLowerCase()
    && check.owner.toLowerCase() === record.owner.toLowerCase()
    && check.setupCode === record.setupCode
    && check.cardGuardian?.toLowerCase() === record.cardGuardian?.toLowerCase());
}

export function independentCheckEvidence(record: DeviceRecord, chainId: number, checked: boolean): Pick<DeviceRecord, 'independentCheck' | 'independentCheckedAt'> {
  if (!checked) return { independentCheck: undefined, independentCheckedAt: undefined };
  if (!record.wallet) throw new Error('Create or recover your wallet before acknowledging its check.');
  const checkedAt = new Date().toISOString();
  return { independentCheckedAt: checkedAt, independentCheck: {
    chainId, wallet: record.wallet, owner: record.owner, setupCode: record.setupCode,
    cardGuardian: record.cardGuardian, checkedAt,
  } };
}
