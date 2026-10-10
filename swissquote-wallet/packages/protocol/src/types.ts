import type { Address, Hex } from 'viem';
export interface WalletSetup { owner: Address; cardGuardian: Address; partnerGuardian: Address; sqGuardian: Address; saltNonce: bigint; chainId?: number }
export interface SafeTx { to: Address; value: bigint; data: Hex; operation: 0 | 1; safeTxGas: bigint; baseGas: bigint; gasPrice: bigint; gasToken: Address; refundReceiver: Address; nonce: bigint }
export interface MultiSendCall { to: Address; data: Hex; value: bigint; operation: 0 | 1 }
export interface RecoveryRequest { wallet: Address; module: Address; newOwner: Address; nonce: bigint; chainId: number }
export interface GuardianApproval { signer: Address; signature: Hex }
interface CodeBase { v: 1; chainId: number }
export interface SetupCode extends CodeBase { kind: 'setup'; wallet: Address; owner: Address; partnerGuardian: Address; sqGuardian: Address; saltNonce: string }
export interface RequestCode extends CodeBase { kind: 'request'; wallet: Address; module: Address; newOwner: Address; nonce: string }
export interface ApprovalCode extends CodeBase, GuardianApproval { kind: 'approval' }
export interface TransactionClassification { class: 'Protective' | 'Admin' | 'Large' | 'Small'; requiresPasskey: boolean; relayAllowed: boolean; reason: string; recipients: Address[] }
export interface EncryptedSeed { v: 1; kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: 600000 }; salt: string; iv: string; ciphertext: string }
export interface KitMetadata { wallet: Address; owner: Address; chainId: number; modules?: readonly Address[] }
export interface EmergencyKit extends EncryptedSeed { chainId: number; wallet: Address; owner: Address; modules: readonly Address[]; path: string; instructions: string }
export interface WalletVerification { ok: boolean; wallet: Address; reasons: string[]; nonce?: bigint }
