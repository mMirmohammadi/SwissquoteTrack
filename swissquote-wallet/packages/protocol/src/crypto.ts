import { base32nopad, base64urlnopad } from '@scure/base';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { bytesToHex, keccak256, hexToBytes, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID, DERIVATION_PATH, LOCAL_CHAIN_ID, MODULES } from './constants.js';
import type { EmergencyKit, EncryptedSeed, KitMetadata } from './types.js';
const encoder = new TextEncoder();
const KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 } as const;
const random = (length: number) => globalThis.crypto.getRandomValues(new Uint8Array(length));
function checkMnemonic(mnemonic: string): void { if (!validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid BIP39 mnemonic'); }
export function generateOwnerSeed(): string { return generateMnemonic(wordlist, 256); }
export function generateCardSeed(): string { return generateMnemonic(wordlist, 128); }
export function mnemonicToPrivateKey(mnemonic: string): Hex {
  checkMnemonic(mnemonic);
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(DERIVATION_PATH);
  try { if (!child.privateKey) throw new Error('No derived private key'); return bytesToHex(child.privateKey); }
  finally { seed.fill(0); root.wipePrivateData(); child.wipePrivateData(); }
}
export function mnemonicToAddress(mnemonic: string): Address { return privateKeyToAccount(mnemonicToPrivateKey(mnemonic)).address; }
export function randomSaltNonce(): bigint { return BigInt(bytesToHex(random(32))); }
export function ownerFingerprint(owner: Address): string {
  const digest = hexToBytes(keccak256(owner.toLowerCase() as Hex));
  return [0, 2, 4, 6].map(i => wordlist[((digest[i]! << 8) | digest[i + 1]!) % 2048]).join(' ');
}
function checkEnvelope(e: EncryptedSeed): void {
  if (e.v !== 1 || e.kdf?.name !== 'PBKDF2' || e.kdf.hash !== 'SHA-256' || e.kdf.iterations !== 600000) throw new Error('Unsupported encrypted seed format');
  if (base64urlnopad.decode(e.salt).length !== 16 || base64urlnopad.decode(e.iv).length !== 12 || base64urlnopad.decode(e.ciphertext).length < 16 || e.ciphertext.length > 8192) throw new Error('Invalid encrypted seed envelope');
}
async function deriveKey(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await globalThis.crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return globalThis.crypto.subtle.deriveKey({ ...KDF, salt }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const owned = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);
async function encrypt(mnemonic: string, secret: string, associatedData?: string): Promise<EncryptedSeed> {
  checkMnemonic(mnemonic);
  const salt = random(16), iv = random(12);
  const key = await deriveKey(secret, salt);
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, ...(associatedData ? { additionalData: encoder.encode(associatedData) } : {}) }, key, encoder.encode(mnemonic));
  return { v: 1, kdf: { ...KDF }, salt: base64urlnopad.encode(salt), iv: base64urlnopad.encode(iv), ciphertext: base64urlnopad.encode(new Uint8Array(ciphertext)) };
}
async function decrypt(e: EncryptedSeed, secret: string, associatedData?: string): Promise<string> {
  checkEnvelope(e);
  const key = await deriveKey(secret, owned(base64urlnopad.decode(e.salt)));
  const clear = new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: owned(base64urlnopad.decode(e.iv)), ...(associatedData ? { additionalData: encoder.encode(associatedData) } : {}) }, key, owned(base64urlnopad.decode(e.ciphertext))));
  try { const mnemonic = new TextDecoder('utf-8', { fatal: true }).decode(clear); checkMnemonic(mnemonic); return mnemonic; } finally { clear.fill(0); }
}
export async function encryptSeed(mnemonic: string, passphrase: string): Promise<EncryptedSeed> {
  if (passphrase.length < 12) throw new Error('Device passphrase must have at least 12 characters');
  return encrypt(mnemonic, passphrase);
}
export async function decryptSeed(envelope: EncryptedSeed, passphrase: string): Promise<string> { return decrypt(envelope, passphrase); }
const normalizeCode = (code: string) => code.replace(/[-\s]/g, '').toUpperCase();
async function kitChecksum(entropy: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', owned(entropy)));
  return base32nopad.encode(hash.slice(0, 3));
}
export async function generateKitCode(): Promise<string> {
  const entropy = random(20);
  const body = base32nopad.encode(entropy);
  return `${body.match(/.{8}/g)!.join('-')}-${await kitChecksum(entropy)}`;
}
export async function validateKitCode(code: string): Promise<boolean> {
  try {
    const normalized = normalizeCode(code);
    if (!/^[A-Z2-7]{37}$/.test(normalized)) return false;
    const entropy = base32nopad.decode(normalized.slice(0, 32));
    return normalized.slice(32) === await kitChecksum(entropy);
  } catch { return false; }
}
function kitAAD(kit: Pick<EmergencyKit, 'v' | 'chainId' | 'wallet' | 'owner' | 'modules' | 'path'>): string {
  return JSON.stringify({ v: kit.v, chainId: kit.chainId, wallet: kit.wallet.toLowerCase(), owner: kit.owner.toLowerCase(), modules: kit.modules.map(m => m.toLowerCase()), path: kit.path });
}
export async function createKit(mnemonic: string, code: string, metadata: KitMetadata): Promise<EmergencyKit> {
  if (!await validateKitCode(code)) throw new Error('Invalid kit code checksum');
  if (mnemonicToAddress(mnemonic).toLowerCase() !== metadata.owner.toLowerCase()) throw new Error('Kit owner does not match mnemonic');
  if (![CHAIN_ID, LOCAL_CHAIN_ID].includes(metadata.chainId)) throw new Error('Unsupported kit chain');
  const header = { v: 1 as const, ...metadata, modules: metadata.modules ?? MODULES, path: DERIVATION_PATH };
  const envelope = await encrypt(mnemonic, normalizeCode(code), kitAAD(header));
  return { ...envelope, ...header, instructions: 'Keep the kit code separate from the recovery card and kit file. Open with the independent recovery tool. Import the seed into a standard wallet and connect to Safe on the stated chain, or sign a Safe transaction and submit it with a funded account. If the owner was replaced, this kit can no longer control the wallet. Never send this seed or code to Swissquote or the partner.' };
}
export async function openKit(kit: EmergencyKit, code: string): Promise<{ mnemonic: string; owner: Address }> {
  if (!await validateKitCode(code)) throw new Error('Invalid kit code checksum');
  if (kit.path !== DERIVATION_PATH || ![CHAIN_ID, LOCAL_CHAIN_ID].includes(kit.chainId)) throw new Error('Unsupported kit path/chain');
  let mnemonic: string;
  try { mnemonic = await decrypt(kit, normalizeCode(code), kitAAD(kit)); }
  catch (error) {
    if (error instanceof Error && error.name === 'OperationError') throw new Error('Unable to decrypt kit: incorrect code or damaged kit');
    throw error;
  }
  const owner = mnemonicToAddress(mnemonic);
  if (owner.toLowerCase() !== kit.owner.toLowerCase()) throw new Error('Kit owner mismatch');
  return { mnemonic, owner };
}
