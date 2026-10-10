import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Address, Hex } from 'viem';

/** Plain local keys and exact-string face digests are MOCK custody/authentication only. */
export interface PartnerRecord { faceDigest: string; privateKey: Hex; guardian: Address }
export interface PartnerStore {
  get(guardian: Address): PartnerRecord | undefined;
  getByFaceDigest(digest: string): PartnerRecord | undefined;
  insert(record: PartnerRecord): boolean;
  close?(): void;
}
export class MemoryPartnerStore implements PartnerStore {
  #records = new Map<string, PartnerRecord>();
  get(guardian: Address): PartnerRecord | undefined { const r = this.#records.get(guardian.toLowerCase()); return r ? { ...r } : undefined; }
  getByFaceDigest(digest: string): PartnerRecord | undefined {
    const r = [...this.#records.values()].find(record => record.faceDigest === digest); return r ? { ...r } : undefined;
  }
  insert(record: PartnerRecord): boolean {
    if (this.get(record.guardian) || this.getByFaceDigest(record.faceDigest)) return false;
    this.#records.set(record.guardian.toLowerCase(), { ...record }); return true;
  }
}
export class SqlitePartnerStore implements PartnerStore {
  #db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.#db = new DatabaseSync(filename);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    // Separate v3 schema: do not read/migrate identity-bearing legacy records automatically.
    this.#db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS partner_guardians_v3 (guardian TEXT PRIMARY KEY, face_digest TEXT NOT NULL UNIQUE, private_key TEXT NOT NULL) STRICT');
  }
  #record(r: Record<string, unknown> | undefined): PartnerRecord | undefined {
    return r ? { faceDigest: String(r.face_digest), privateKey: String(r.private_key) as Hex, guardian: String(r.guardian) as Address } : undefined;
  }
  get(guardian: Address): PartnerRecord | undefined {
    return this.#record(this.#db.prepare('SELECT face_digest,private_key,guardian FROM partner_guardians_v3 WHERE guardian=?').get(guardian.toLowerCase()));
  }
  getByFaceDigest(digest: string): PartnerRecord | undefined {
    return this.#record(this.#db.prepare('SELECT face_digest,private_key,guardian FROM partner_guardians_v3 WHERE face_digest=?').get(digest));
  }
  insert(r: PartnerRecord): boolean {
    return this.#db.prepare('INSERT OR IGNORE INTO partner_guardians_v3 (guardian,face_digest,private_key) VALUES (?,?,?)').run(r.guardian.toLowerCase(), r.faceDigest, r.privateKey).changes === 1;
  }
  close(): void { this.#db.close(); }
}
