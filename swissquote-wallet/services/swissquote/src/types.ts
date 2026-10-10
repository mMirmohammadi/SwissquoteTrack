import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import type { VerificationOptions } from '@sq/protocol';
export type { VerificationOptions } from '@sq/protocol';
export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export interface SafeTx { to: Address; value: string; data: Hex; operation: number; safeTxGas: string; baseGas: string; gasPrice: string; gasToken: Address; refundReceiver: Address; nonce: string }
export interface Setup { wallet?: Address; owner: Address; cardGuardian: Address; partnerGuardian: Address; sqGuardian: Address; saltNonce: string }
export interface Approval { signer: Address; signature: Hex }
export interface Recovery { wallet: Address; module: Address; newOwner: Address; nonce: string; approvals?: Approval[] }
export type ChainOperation = { kind: 'deploy'; setup: Setup } | { kind: 'safe-tx'; wallet: Address; tx: SafeTx; signature: Hex } | { kind: 'recovery'; request: Recovery } | { kind: 'finalize'; wallet: Address; module: Address } | { kind: 'withdraw'; to: Address; amount: string };
export type ReceiptStatus = {status:'pending'|'unknown'} | {status:'confirmed'|'reverted';blockNumber:string};
/** Only this error proves send never reached the broadcast boundary. */
export class ChainPrebroadcastError extends Error {
  constructor(message:string, public status=503) {super(message);}
}
export interface ChainAdapter {
  chainId: number;
  computeWallet(setup: Setup): Promise<Address>;
  verifyWallet(setup: Setup & {wallet: Address}, options?: VerificationOptions): Promise<boolean>;
  verifyOwnership(wallet: Address, message: string, signature: Hex): Promise<boolean>;
  safeTxHash(wallet: Address, tx: SafeTx): Promise<Hex>;
  verifyOwnerSignature(wallet: Address, tx: SafeTx, signature: Hex): Promise<boolean>;
  safeNonce(wallet: Address): Promise<string>;
  recoveryHash(request: Recovery): Promise<Hex>;
  isGuardian(wallet: Address, module: Address, guardian: Address): Promise<boolean>;
  signRecovery(request: Recovery, guardianPrivateKey: Hex): Promise<Hex>;
  simulate(operation: ChainOperation): Promise<void>;
  estimateGas(operation: ChainOperation): Promise<bigint>;
  send(operation: ChainOperation, gas: bigint): Promise<Hex>;
  /** Required on public Sepolia; unknown/not-found never proves non-broadcast. */
  receiptStatus?(hash: Hex): Promise<ReceiptStatus>;
}
export interface PasskeyCredential { id: string; publicKey: string; counter: number; transports?: string[] }
export interface WebAuthnAdapter {
  registrationOptions(user: {id:string;email:string}, credentials: PasskeyCredential[]): Promise<Record<string, unknown>>;
  authenticationOptions(credentials: PasskeyCredential[], challenge?: string): Promise<Record<string, unknown>>;
  verifyRegistration(response: unknown, challenge: string): Promise<PasskeyCredential>;
  verifyAuthentication(response: unknown, challenge: string, credentials: PasskeyCredential[]): Promise<{id:string;counter:number}>;
}
export interface AppOptions {
  dataDir?: string; databasePath?: string; chain?: ChainAdapter; webauthn?: WebAuthnAdapter;
  now?: () => number; allowMock?: boolean; allowedOrigins?: string[];
  accountAddress?: Address;
  accountDailyLimit?: number; globalDailyLimit?: number; gasCap?: bigint; initialMockBalance?: string;
  modules?: readonly Address[]; usdc?: Address; multiSendCallOnly?: Address;
  sanctions?: readonly Address[]; approvedSpenders?: readonly Address[];
  features?: readonly string[];
  screeningSources?: readonly ScreeningSource[];
  simulationClients?: import('@sq/protocol').SimulationClients;
  mockPayoutCap?: string;
  mockSecoBlockedEmails?: readonly string[];
}
export interface ScreeningSource {
  label: string; required: boolean; mock: boolean; kind?: 'sanctions' | 'freeze';
  check(addresses: readonly Address[]): Promise<{hits: readonly Address[]; updatedAt?: number; warning?: string}>;
}
export interface TestableApp { server: Server; handler(req: IncomingMessage,res: ServerResponse): Promise<void>; close(): Promise<void> }
