import { isAddress, type Address, type Hex } from 'viem';
import type { SafeTx } from './types.js';

export type SponsorshipRefusal = 'NOT_SPONSORED' | 'SANCTIONS_BLOCK' | 'SCREENING_UNAVAILABLE' | 'EFFECTS_MISMATCH';
export interface ApiError { error: string; code?: SponsorshipRefusal }
export interface ScreenRequest { addresses: Address[] }
export interface ScreenResult { ok: boolean; checkedAt: string; sources: string[]; hits: Address[]; warnings: string[]; mock: boolean }
export interface DappPreviewRequest { wallet: Address; tx: SafeTxWire; dappId: string }
export interface DappPreviewResponse { summary: string[]; effectsHash: Hex; blockNumber: string; dappId: string; warnings: string[] }
export interface SessionResponse { token: string; clientId: string; userRef: string; kycVerified: boolean }
export interface PasswordRegisterRequest { email: string; password: string }
export interface PasswordLoginRequest { email: string; password: string }
export interface PasswordResetRequest { email: string }
export interface PasswordResetConfirmRequest { token: string; password: string }
export interface PasskeyOptionsRequest { email: string; safeTxHash?: Hex }
export interface PasskeyVerifyRequest { email: string; response: unknown; challengeId: string }
export interface PasskeyOptionsResponse { challengeId: string; options: unknown }
export interface StepUpVerifyRequest { safeTxHash: Hex; challengeId: string; response: unknown }
export interface StepUpVerifyResponse { stepUpToken: string; safeTxHash: Hex }
export interface GuardianEnrollRequest { userRef?: string }
export interface GuardianEnrollResponse { guardian: Address; userRef: string }
export interface PartnerEnrollRequest { mockFace: string }
/** Partner stores only a guardian key and face-check mock data, not institution identity. */
export interface PartnerEnrollResponse { guardian: Address }
export interface OwnershipProofWire { message: string; hash: Hex; signature: Hex; nonce: string }
/** Current-owner expectation is authenticated by a fresh ownership proof, never by login alone. */
export interface RegisterWalletRequest { setupCode: string; cardGuardian: Address; ownershipProof: OwnershipProofWire; expectedCurrentOwner?: Address; minimumBlockNumber?: string }
/** Public original setup stays immutable across owner replacement. */
export interface WalletResponse { wallet: Address; owner: Address; verified: boolean; clientId: string; chainId: number; setupCode?: string; cardGuardian?: Address }
export interface AccountResponse { balance: string; token: Address; decimals: 6; mock: true; address: Address }
export interface AccountWithdrawRequest { to: Address; amount: string }
export interface TransactionResponse { transactionHash: Hex }
export interface DeployRequest { owner: Address; cardGuardian: Address; partnerGuardian: Address; sqGuardian: Address; saltNonce: string; chainId: number; initializer?: Hex; wallet?: Address }
export interface DeployResponse extends TransactionResponse { wallet: Address }
export interface SafeTxWire { to: Address; value: string; data: Hex; operation: 0 | 1; safeTxGas: string; baseGas: string; gasPrice: string; gasToken: Address; refundReceiver: Address; nonce: string }
export interface RelaySafeTxRequest { wallet: Address; tx: SafeTxWire; signature: Hex; stepUpToken?: string; source?: 'settings' | 'payment' | 'pay' | 'dapp' | 'recovery'; dappId?: string; effectsHash?: Hex; chainId?: number }
export interface ApprovalWire { signer: Address; signature: Hex }
export interface RecoveryWire { wallet: Address; module: Address; newOwner: Address; nonce: string; chainId: number }
export interface RelayRecoveryRequest extends RecoveryWire { approvals: ApprovalWire[] }
export interface FinalizeRecoveryRequest { wallet: Address; module: Address }
export interface SqRecoveryApproveRequest extends RecoveryWire { mockVideoId?: boolean }
export interface PartnerRecoveryApproveRequest { wallet: Address; newOwner: Address; mockFace: string; nonce?: string; chainId?: number; module?: Address }
export interface RecoveryApproveResponse extends ApprovalWire { approvalCode: string; request: RecoveryWire }
export interface MockMailboxMessage { id: string; email: string; subject: string; resetToken: string; createdAt: string; mock: true }
export interface MockMailboxResponse { messages: MockMailboxMessage[]; mock: true }
export interface MockFooledRequest { enabled: boolean }
export interface MockFooledResponse { enabled: boolean; mock: true }
export interface MockKycResponse { kycVerified: true; mock: true }

const integer = (value: string): bigint => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('Invalid unsigned decimal integer');
  const parsed = BigInt(value);
  if (parsed >= 2n ** 256n) throw new Error('Unsigned decimal integer exceeds uint256');
  return parsed;
};
export function safeTxToWire(tx: SafeTx): SafeTxWire {
  return { ...tx, value: tx.value.toString(), nonce: tx.nonce.toString(), safeTxGas: tx.safeTxGas.toString(), baseGas: tx.baseGas.toString(), gasPrice: tx.gasPrice.toString() };
}
export function safeTxFromWire(tx: SafeTxWire): SafeTx {
  if (tx.operation !== 0 && tx.operation !== 1) throw new Error('Invalid Safe operation');
  if (![tx.to, tx.gasToken, tx.refundReceiver].every(address => typeof address === 'string' && isAddress(address, { strict: false }))) throw new Error('Invalid Safe transaction address');
  if (typeof tx.data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(tx.data)) throw new Error('Invalid Safe transaction calldata');
  return { ...tx, value: integer(tx.value), nonce: integer(tx.nonce), safeTxGas: integer(tx.safeTxGas), baseGas: integer(tx.baseGas), gasPrice: integer(tx.gasPrice) };
}

/** HTTP registry; authorization is an opaque bearer session, never a private key. */
export interface HttpApi {
  'POST /screen': [ScreenRequest, ScreenResult];
  'POST /dapps/preview': [DappPreviewRequest, DappPreviewResponse];
  'POST /auth/password/register': [PasswordRegisterRequest, SessionResponse];
  'POST /auth/password/login': [PasswordLoginRequest, SessionResponse];
  'POST /auth/password/reset-request': [PasswordResetRequest, { ok: true; mock: true }];
  'POST /auth/password/reset': [PasswordResetConfirmRequest, { ok: true }];
  'POST /auth/passkey/register/options': [PasskeyOptionsRequest, PasskeyOptionsResponse];
  'POST /auth/passkey/register/verify': [PasskeyVerifyRequest, SessionResponse];
  'POST /auth/passkey/login/options': [PasskeyOptionsRequest, PasskeyOptionsResponse];
  'POST /auth/passkey/login/verify': [PasskeyVerifyRequest, SessionResponse];
  'POST /auth/passkey/step-up/options': [PasskeyOptionsRequest, PasskeyOptionsResponse];
  'POST /auth/passkey/step-up/verify': [StepUpVerifyRequest, StepUpVerifyResponse];
  'POST /kyc/mock-verify': [Record<string, never>, MockKycResponse];
  'GET /mock/mailbox': [undefined, MockMailboxResponse];
  'POST /demo/fooled': [MockFooledRequest, MockFooledResponse];
  'POST /guardian/enroll': [GuardianEnrollRequest, GuardianEnrollResponse];
  'POST /wallets': [RegisterWalletRequest, WalletResponse];
  'GET /wallets/:address': [undefined, WalletResponse];
  'GET /account': [undefined, AccountResponse];
  'POST /account/withdraw': [AccountWithdrawRequest, TransactionResponse];
  'POST /relay/deploy': [DeployRequest, DeployResponse];
  'POST /relay/safe-tx': [RelaySafeTxRequest, TransactionResponse];
  'POST /relay/recovery': [RelayRecoveryRequest, TransactionResponse];
  'POST /relay/finalize': [FinalizeRecoveryRequest, TransactionResponse];
  'POST /recovery/approve': [SqRecoveryApproveRequest, RecoveryApproveResponse];
}
export interface PartnerHttpApi {
  'POST /enroll': [PartnerEnrollRequest, PartnerEnrollResponse];
  'POST /recovery/approve': [PartnerRecoveryApproveRequest, RecoveryApproveResponse];
  'POST /demo/fooled': [MockFooledRequest, MockFooledResponse];
}
