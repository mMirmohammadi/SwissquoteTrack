import { base64urlnopad } from '@scure/base';
import { isAddress } from 'viem';
import { CHAIN_ID, LOCAL_CHAIN_ID, MODULES, SENTINEL_ADDRESS, ZERO_ADDRESS } from './constants.js';
import type { ApprovalCode, RequestCode, SetupCode } from './types.js';
type Code = SetupCode | RequestCode | ApprovalCode;
const address = (v: unknown): boolean => typeof v === 'string' && isAddress(v, { strict: false });
const decimal = (v: unknown): boolean => typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v) && BigInt(v) < 2n ** 256n;
function validate(value: unknown): Code {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid code object');
  const c = value as Record<string, unknown>;
  if (c.v !== 1 || (c.chainId !== CHAIN_ID && c.chainId !== LOCAL_CHAIN_ID)) throw new Error('Unsupported code version/chain');
  let keys: string[];
  switch (c.kind) {
    case 'setup':
      if (![c.wallet, c.owner, c.partnerGuardian, c.sqGuardian].every(address) || !decimal(c.saltNonce)) throw new Error('Invalid setup code');
      keys = ['wallet', 'owner', 'partnerGuardian', 'sqGuardian', 'saltNonce']; break;
    case 'request':
      if (![c.wallet, c.module, c.newOwner].every(address) || [c.wallet, c.newOwner].some(v => String(v).toLowerCase() === ZERO_ADDRESS) || String(c.newOwner).toLowerCase() === SENTINEL_ADDRESS || !decimal(c.nonce) || !MODULES.some(m => m.toLowerCase() === String(c.module).toLowerCase())) throw new Error('Invalid request code');
      keys = ['wallet', 'module', 'newOwner', 'nonce']; break;
    case 'approval':
      if (!address(c.signer) || typeof c.signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(c.signature)) throw new Error('Invalid approval code');
      keys = ['signer', 'signature']; break;
    default: throw new Error('Unknown code kind');
  }
  if (Object.keys(c).some(k => !['v', 'chainId', 'kind', ...keys].includes(k))) throw new Error('Unexpected code field');
  return value as Code;
}
export function encodeCode(code: Code): string { return base64urlnopad.encode(new TextEncoder().encode(JSON.stringify(validate(code)))); }
export function decodeCode(value: string): Code {
  if (value.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid code encoding');
  return validate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64urlnopad.decode(value))));
}
export function decodeSetupCode(value: string): SetupCode { const c = decodeCode(value); if (c.kind !== 'setup') throw new Error('Expected setup code'); return c; }
export function decodeRequestCode(value: string): RequestCode { const c = decodeCode(value); if (c.kind !== 'request') throw new Error('Expected request code'); return c; }
export function decodeApprovalCode(value: string): ApprovalCode { const c = decodeCode(value); if (c.kind !== 'approval') throw new Error('Expected approval code'); return c; }
