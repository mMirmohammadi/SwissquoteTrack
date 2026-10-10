import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Address, Hex } from 'viem';

/** Only partner records belong in this store. Plain keys are a MOCK HSM, not production custody. */
export interface PartnerRecord { userRef: string; faceDigest: string; privateKey: Hex; guardian: Address }
export interface PartnerStore {
  get(userRef: string): PartnerRecord | undefined;
  insert(record: PartnerRecord): boolean;
  close?(): void;
}
export class MemoryPartnerStore implements PartnerStore {
  #records = new Map<string, PartnerRecord>();
  get(userRef: string): PartnerRecord | undefined { const r = this.#records.get(userRef); return r ? { ...r } : undefined; }
  insert(record: PartnerRecord): boolean {
    if (this.#records.has(record.userRef)) return false;
    this.#records.set(record.userRef, { ...record }); return true;
  }
}
export class SqlitePartnerStore implements PartnerStore {
  #db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    }
    this.#db = new DatabaseSync(filename);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    this.#db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS partner_guardians (user_ref TEXT PRIMARY KEY, face_digest TEXT NOT NULL, private_key TEXT NOT NULL, guardian TEXT NOT NULL) STRICT');
  }
  get(userRef: string): PartnerRecord | undefined {
    const r = this.#db.prepare('SELECT user_ref,face_digest,private_key,guardian FROM partner_guardians WHERE user_ref=?').get(userRef);
    if (!r) return undefined;
    return { userRef: String(r.user_ref), faceDigest: String(r.face_digest), privateKey: String(r.private_key) as Hex, guardian: String(r.guardian) as Address };
  }
  insert(r: PartnerRecord): boolean {
    return this.#db.prepare('INSERT OR IGNORE INTO partner_guardians VALUES (?,?,?,?)').run(r.userRef, r.faceDigest, r.privateKey, r.guardian).changes === 1;
  }
  close(): void { this.#db.close(); }
}
