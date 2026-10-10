import type { Address } from 'viem';
import { encryptSeed, decryptSeed } from '@sq/protocol';

export interface DeviceRecord {
  id: string;
  wallet?: Address;
  owner: Address;
  envelope: Awaited<ReturnType<typeof encryptSeed>>;
  createdAt: string;
  setupCode?: string;
  cardGuardian?: Address;
  kitSavedAt?: string;
  independentCheckedAt?: string;
  passkeyRegisteredAt?: string;
  pastRecipients?: Address[];
}
const DB = 'sq-wallet-device-v1';
const STORE = 'keys';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Device storage is unavailable. Use a browser with IndexedDB enabled.'));
  });
}
async function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = run(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(result.result); };
    tx.onerror = () => { db.close(); reject(new Error('Could not save the encrypted device key. No key change has been confirmed.')); };
    tx.onabort = () => { db.close(); reject(new Error('Device storage operation was interrupted.')); };
  });
}
export async function saveDevice(id: string, mnemonic: string, passphrase: string, owner: Address, wallet?: Address): Promise<DeviceRecord> {
  if (passphrase.length < 12) throw new Error('Use a device passphrase of at least 12 characters.');
  const record: DeviceRecord = { id, owner, wallet, envelope: await encryptSeed(mnemonic, passphrase), createdAt: new Date().toISOString() };
  await request('readwrite', store => store.put(record));
  return record;
}
export async function updateDeviceEvidence(id: string, patch: Pick<Partial<DeviceRecord>, 'kitSavedAt' | 'independentCheckedAt' | 'passkeyRegisteredAt' | 'pastRecipients'>): Promise<DeviceRecord> {
  const record = await loadDevice(id);
  if (!record) throw new Error('No encrypted device record is available.');
  const next = { ...record, ...patch };
  await request('readwrite', store => store.put(next));
  return next;
}
export async function loadDevice(id: string): Promise<DeviceRecord | undefined> { return request('readonly', store => store.get(id)); }
export async function bindWallet(record: DeviceRecord, wallet: Address, setupCode?: string, cardGuardian?: Address): Promise<DeviceRecord> {
  const next = { ...record, wallet, setupCode: setupCode ?? record.setupCode, cardGuardian: cardGuardian ?? record.cardGuardian }; await request('readwrite', store => store.put(next)); return next;
}
export async function promoteDevice(pendingId: string, currentId: string, wallet: Address): Promise<DeviceRecord> {
  const pending = await loadDevice(pendingId);
  if (!pending) throw new Error('The encrypted replacement key is missing. Do not finalize on this device.');
  if (pendingId === currentId) throw new Error('Replacement and current device records must differ.');
  if (pending.wallet && pending.wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error('The replacement key belongs to another wallet.');
  const current = await loadDevice(currentId);
  const original = current?.wallet?.toLowerCase() === wallet.toLowerCase() ? current : undefined;
  const next = { ...pending, id: currentId, wallet,
    setupCode: original?.setupCode ?? pending.setupCode,
    cardGuardian: original?.cardGuardian ?? pending.cardGuardian };
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'); const store = tx.objectStore(STORE);
    store.put(next); store.delete(pendingId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(new Error('Key changed on chain, but local promotion failed. The replacement key remains in encrypted storage; retry installation.')); };
    tx.onabort = () => { db.close(); reject(new Error('Replacement installation was interrupted. The encrypted replacement key remains saved; retry installation.')); };
  });
  return next;
}
export async function unlockDevice(record: DeviceRecord, passphrase: string): Promise<string> {
  try { return await decryptSeed(record.envelope, passphrase); }
  catch { throw new Error('Could not unlock this device. Check the device passphrase; resetting your login password does not unlock your wallet.'); }
}
