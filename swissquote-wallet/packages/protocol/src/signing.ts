import { encodeFunctionData, hashMessage, hashTypedData, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID, MODULES } from './constants.js';
import { fallbackHandlerAbi, moduleAbi, safeAbi } from './abis.js';
import type { GuardianApproval, RecoveryRequest, SafeTx } from './types.js';
export const SAFE_TX_TYPES = { SafeTx: [
  { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }, { name: 'operation', type: 'uint8' },
  { name: 'safeTxGas', type: 'uint256' }, { name: 'baseGas', type: 'uint256' }, { name: 'gasPrice', type: 'uint256' },
  { name: 'gasToken', type: 'address' }, { name: 'refundReceiver', type: 'address' }, { name: 'nonce', type: 'uint256' },
] } as const;
export function safeTxTypedData(wallet: Address, tx: SafeTx, chainId = CHAIN_ID) {
  return { domain: { chainId, verifyingContract: wallet }, types: SAFE_TX_TYPES, primaryType: 'SafeTx' as const, message: tx };
}
export function hashSafeTx(wallet: Address, tx: SafeTx, chainId = CHAIN_ID): Hex { return hashTypedData(safeTxTypedData(wallet, tx, chainId)); }
export async function signSafeTx(privateKey: Hex, wallet: Address, tx: SafeTx, chainId = CHAIN_ID): Promise<Hex> { return privateKeyToAccount(privateKey).signTypedData(safeTxTypedData(wallet, tx, chainId)); }
export function encodeExecTransaction(tx: SafeTx, signatures: Hex): Hex {
  return encodeFunctionData({ abi: safeAbi, functionName: 'execTransaction', args: [tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, signatures] });
}
export function recoveryTypedData(request: RecoveryRequest) {
  if (!MODULES.some(m => m.toLowerCase() === request.module.toLowerCase())) throw new Error('Unknown recovery module');
  return {
    domain: { name: 'Social Recovery Module', version: '0.0.1', chainId: request.chainId, verifyingContract: request.module },
    types: { ExecuteRecovery: [{ name: 'wallet', type: 'address' }, { name: 'newOwners', type: 'address[]' }, { name: 'newThreshold', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] } as const,
    primaryType: 'ExecuteRecovery' as const, message: { wallet: request.wallet, newOwners: [request.newOwner], newThreshold: 1n, nonce: request.nonce },
  };
}
export function hashRecovery(request: RecoveryRequest): Hex { return hashTypedData(recoveryTypedData(request)); }
export async function signRecovery(privateKey: Hex, request: RecoveryRequest): Promise<GuardianApproval> {
  const account = privateKeyToAccount(privateKey);
  return { signer: account.address, signature: await account.signTypedData(recoveryTypedData(request)) };
}
export function sortApprovals(approvals: readonly GuardianApproval[]): GuardianApproval[] {
  if (new Set(approvals.map(a => a.signer.toLowerCase())).size !== approvals.length) throw new Error('Duplicate guardian approvals');
  return [...approvals].sort((a, b) => BigInt(a.signer) < BigInt(b.signer) ? -1 : 1);
}
export async function assertRecoveryHash(client: PublicClient, request: RecoveryRequest): Promise<void> {
  const chainId = await client.getChainId();
  if (chainId !== request.chainId) throw new Error('Recovery chain mismatch');
  const nonce = await client.readContract({ address: request.module, abi: moduleAbi, functionName: 'nonce', args: [request.wallet] });
  if (nonce !== request.nonce) throw new Error('Stale recovery nonce');
  const hash = await client.readContract({ address: request.module, abi: moduleAbi, functionName: 'getRecoveryHash', args: [request.wallet, [request.newOwner], 1n, request.nonce] });
  if (hash.toLowerCase() !== hashRecovery(request).toLowerCase()) throw new Error('On-chain recovery hash mismatch');
}
export function encodeRecoveryCall(request: RecoveryRequest, approvals: readonly GuardianApproval[]): Hex {
  return encodeFunctionData({ abi: moduleAbi, functionName: 'multiConfirmRecovery', args: [request.wallet, [request.newOwner], 1n, sortApprovals(approvals), true] });
}
export function ownershipProofText(clientId: string, wallet: Address, nonce: string, chainId = CHAIN_ID): string {
  if (!clientId || !nonce || /[\r\n]/.test(clientId + nonce)) throw new Error('Invalid ownership proof identity/nonce');
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('Invalid ownership proof chain');
  const network = chainId === CHAIN_ID ? 'Sepolia' : chainId === 31337 ? 'Local Hardhat' : 'Ethereum-compatible network';
  return `Swissquote client ${clientId} controls wallet ${wallet} on ${network} (chain ${chainId}). This does not authorise any transfer. Nonce ${nonce}.`;
}
export function safeMessageTypedData(wallet: Address, messageHash: Hex, chainId = CHAIN_ID) {
  return { domain: { chainId, verifyingContract: wallet }, types: { SafeMessage: [{ name: 'message', type: 'bytes' }] } as const, primaryType: 'SafeMessage' as const, message: { message: messageHash } };
}
export async function signOwnershipProof(privateKey: Hex, clientId: string, wallet: Address, nonce: string, chainId = CHAIN_ID): Promise<{ message: string; hash: Hex; signature: Hex }> {
  const message = ownershipProofText(clientId, wallet, nonce, chainId);
  const hash = hashMessage(message);
  const signature = await privateKeyToAccount(privateKey).signTypedData(safeMessageTypedData(wallet, hash, chainId));
  return { message, hash, signature };
}
export async function verifyOwnershipProof(client: PublicClient, wallet: Address, hash: Hex, signature: Hex, options: { blockNumber?: bigint } = {}): Promise<boolean> {
  try { return await client.readContract({ ...options, address: wallet, abi: fallbackHandlerAbi, functionName: 'isValidSignature', args: [hash, signature] }) === '0x1626ba7e'; } catch { return false; }
}
