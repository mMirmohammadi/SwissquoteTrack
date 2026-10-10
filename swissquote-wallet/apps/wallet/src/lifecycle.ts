import type { Address } from 'viem';
import { decodeSetupCode, mnemonicToAddress, mnemonicToPrivateKey, signOwnershipProof, type WalletResponse } from '@sq/protocol';
import { call } from './api';
import type { DeviceRecord } from './storage';

/** Public creation metadata, never a seed or recovery-card words. */
export type WalletMetadataResponse = WalletResponse & { setupCode?: string; cardGuardian?: Address };
export function creationMetadata(record: DeviceRecord, metadata: WalletMetadataResponse): { setupCode: string; cardGuardian: Address } {
  if (!record.wallet || metadata.wallet.toLowerCase() !== record.wallet.toLowerCase()) throw new Error('Saved setup belongs to another wallet.');
  const setupCode = record.setupCode ?? metadata.setupCode;
  const cardGuardian = record.cardGuardian ?? metadata.cardGuardian;
  if (!setupCode || !cardGuardian) throw new Error('Original recovery setup is unavailable. Keep the encrypted replacement key and restore the setup before registering.');
  const setup = decodeSetupCode(setupCode);
  if (setup.wallet.toLowerCase() !== record.wallet.toLowerCase()) throw new Error('Saved setup belongs to another wallet.');
  return { setupCode, cardGuardian };
}
export async function registerDeviceOwnership(record: DeviceRecord, seed: string, clientId: string, token: string, chainId: number, minimumBlockNumber?: bigint, assertCurrent?: () => void | Promise<void>): Promise<WalletResponse> {
  const minimum = minimumBlockNumber === undefined ? record.deploymentBlock : minimumBlockNumber.toString();
  if (minimum !== undefined && (typeof minimum !== 'string' || !/^(?:0|[1-9]\d{0,19})$/.test(minimum) || BigInt(minimum) > 18446744073709551615n)) throw new Error('The deployment block must be a canonical unsigned 64-bit decimal.');
  if (!record.wallet || !record.setupCode || !record.cardGuardian) throw new Error('The original wallet setup is missing. Restore it before registering.');
  if (mnemonicToAddress(seed).toLowerCase() !== record.owner.toLowerCase()) throw new Error('Unlocked seed does not match the device owner.');
  const setup = decodeSetupCode(record.setupCode);
  if (setup.chainId !== chainId || setup.wallet.toLowerCase() !== record.wallet.toLowerCase()) throw new Error('Saved setup wallet or chain mismatch.');
  await assertCurrent?.();
  const { nonce } = await call<{ nonce: string }>('/wallets/challenge', { token, body: { wallet: record.wallet } });
  await assertCurrent?.();
  const proof = await signOwnershipProof(mnemonicToPrivateKey(seed), clientId, record.wallet.toLowerCase() as Address, nonce, chainId);
  await assertCurrent?.();
  const result = await call<WalletResponse>('/wallets', { token, body: { ...(minimum === undefined ? {} : { minimumBlockNumber: minimum }), setupCode: record.setupCode, cardGuardian: record.cardGuardian, expectedCurrentOwner: record.owner, ownershipProof: { ...proof, nonce } } });
  await assertCurrent?.();
  if (!result.verified || result.wallet.toLowerCase() !== record.wallet.toLowerCase() || result.owner.toLowerCase() !== record.owner.toLowerCase()) throw new Error('Service did not verify this current owner. Retry ownership registration before funding.');
  return result;
}
