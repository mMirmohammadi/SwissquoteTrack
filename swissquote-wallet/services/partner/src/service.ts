import { createHash, timingSafeEqual } from 'node:crypto';
import type { Address, Hex } from 'viem';
import type { PartnerEnrollResponse, PartnerEnrollRequest, PartnerRecoveryApproveRequest, RecoveryApproveResponse, RecoveryRequest } from '@sq/protocol';
import type { PartnerStore } from './storage.ts';

export class PartnerError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.name = 'PartnerError'; this.status = status; }
}
export interface RecoverySnapshot { chainId: number; nonce: bigint; guardians: readonly Address[]; threshold: bigint; recoveryHash: Hex }
export interface PartnerChainReader {
  readRecovery(request: { wallet: Address; module: Address; newOwner: Address; chainId: number }): Promise<RecoverySnapshot>;
}
export interface PartnerCrypto {
  generateGuardian(): { privateKey: Hex; address: Address };
  hashRecovery(request: RecoveryRequest): Hex;
  signRecovery(privateKey: Hex, request: RecoveryRequest): Promise<{ signer: Address; signature: Hex }>;
  encodeApproval(approval: { signer: Address; signature: Hex }, chainId: number): string;
}
export interface PartnerServiceOptions {
  store: PartnerStore;
  chainReader: PartnerChainReader;
  crypto: PartnerCrypto;
  chainId: number;
  moduleA: Address;
  allowDemoFooled?: boolean;
}
export function validateObject(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PartnerError(400, 'Expected a JSON object');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new PartnerError(400, 'Unexpected request field; do not send private keys or account data');
  return body;
}
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) throw new PartnerError(400, `Invalid ${label}`);
  return value;
}
function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || BigInt(value) <= 1n) throw new PartnerError(400, `Invalid ${label}`);
  return value as Address;
}
const sameAddress = (a: Address, b: Address): boolean => a.toLowerCase() === b.toLowerCase();
const faceDigest = (face: string): string => createHash('sha256').update('MOCK-partner-face-v1\0').update(face).digest('hex');
const faceMatches = (digest: string, face: string): boolean => timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(faceDigest(face), 'hex'));

export function createPartnerService(options: PartnerServiceOptions) {
  if (![31337, 11155111].includes(options.chainId)) throw new Error('Partner supports only local or Sepolia chain');
  const { store, crypto, chainReader, moduleA, chainId } = options;
  function enroll(input: PartnerEnrollRequest | unknown): PartnerEnrollResponse {
    const body = validateObject(input, ['mockFace']);
    const mockFace = text(body.mockFace, 'MOCK face', 1024);
    const digest = faceDigest(mockFace);
    let existing = store.getByFaceDigest(digest);
    if (!existing) {
      const key = crypto.generateGuardian();
      store.insert({ faceDigest: digest, privateKey: key.privateKey, guardian: key.address });
      existing = store.getByFaceDigest(digest);
    }
    if (!existing) throw new PartnerError(503, 'Partner enrollment storage unavailable');
    return { guardian: existing.guardian };
  }
  async function approve(input: PartnerRecoveryApproveRequest | unknown): Promise<RecoveryApproveResponse> {
    const body = validateObject(input, ['wallet', 'newOwner', 'mockFace', 'nonce', 'chainId', 'module']);
    const mockFace = text(body.mockFace, 'MOCK face', 1024);
    const wallet = address(body.wallet, 'wallet');
    const newOwner = address(body.newOwner, 'newOwner');
    if (body.chainId !== undefined && body.chainId !== chainId) throw new PartnerError(400, 'Recovery chain does not match configured chain');
    if (body.module !== undefined && !sameAddress(address(body.module, 'module'), moduleA)) throw new PartnerError(400, 'Partner approves module A only');
    if (body.nonce !== undefined && (typeof body.nonce !== 'string' || !/^(0|[1-9][0-9]*)$/.test(body.nonce) || body.nonce.length > 78 || BigInt(body.nonce) >= 2n ** 256n)) throw new PartnerError(400, 'Invalid recovery nonce');
    if (sameAddress(wallet, newOwner)) throw new PartnerError(400, 'New owner must differ from wallet');
    let snapshot: RecoverySnapshot;
    try { snapshot = await chainReader.readRecovery({ wallet, newOwner, module: moduleA, chainId }); }
    catch { throw new PartnerError(503, 'Chain verification unavailable; no approval signed'); }
    if (snapshot.chainId !== chainId) throw new PartnerError(409, 'RPC chain id mismatch');
    if (snapshot.threshold !== 2n || snapshot.guardians.length !== 2 || new Set(snapshot.guardians.map(g => g.toLowerCase())).size !== 2) throw new PartnerError(409, 'Partner is not a guardian of the required 2-of-2 module A');
    // Match only the public configured guardian set; no bank identity or request-supplied key selector.
    const records = snapshot.guardians.flatMap(g => { const record = store.get(g); return record ? [record] : []; });
    if (records.length !== 1) throw new PartnerError(409, 'Required module A must contain exactly one enrolled partner guardian');
    const record = records[0];
    if (!faceMatches(record.faceDigest, mockFace)) throw new PartnerError(403, 'MOCK face mismatch');
    if (snapshot.guardians.some(g => sameAddress(g, newOwner))) throw new PartnerError(400, 'New owner cannot be a recovery guardian');
    if (snapshot.nonce < 0n || snapshot.nonce >= 2n ** 256n) throw new PartnerError(409, 'Invalid on-chain recovery nonce');
    if (body.nonce !== undefined && BigInt(body.nonce as string) !== snapshot.nonce) throw new PartnerError(409, 'Stale recovery nonce');
    const request: RecoveryRequest = { wallet, module: moduleA, newOwner, nonce: snapshot.nonce, chainId };
    const localHash = crypto.hashRecovery(request);
    if (snapshot.recoveryHash.toLowerCase() !== localHash.toLowerCase()) throw new PartnerError(409, 'On-chain recovery hash mismatch; no approval signed');
    const approval = await crypto.signRecovery(record.privateKey, request);
    if (!sameAddress(approval.signer, record.guardian)) throw new PartnerError(503, 'Partner guardian storage integrity failure');
    return {
      ...approval,
      approvalCode: crypto.encodeApproval(approval, chainId),
      request: { wallet, module: moduleA, newOwner, nonce: snapshot.nonce.toString(), chainId },
    };
  }
  function setDemoFooled(input: unknown): { enabled: boolean; mock: true } {
    const body = validateObject(input, ['enabled']);
    if (typeof body.enabled !== 'boolean') throw new PartnerError(400, 'enabled must be boolean');
    if (body.enabled) throw new PartnerError(403, 'MOCK fooled signing disabled; use a throwaway fixture or explanatory demo');
    return { enabled: false, mock: true };
  }
  return { enroll, approve, setDemoFooled, getDemoFooled: () => false };
}
export type PartnerService = ReturnType<typeof createPartnerService>;
