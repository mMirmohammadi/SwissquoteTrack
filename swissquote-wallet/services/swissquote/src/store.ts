import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export function opaque(): string { return randomBytes(32).toString('base64url'); }
export function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function hashPassword(password: string): string { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function checkPassword(password: string, encoded: string): boolean { const [salt,hash] = encoded.split(':'); const expected = Buffer.from(hash,'hex'); const actual = scryptSync(password,salt,64); return expected.length === actual.length && timingSafeEqual(expected,actual); }
export interface User { id:string; email:string; password:string; kyc:boolean; resetAt:number|null; guardianKey?:`0x${string}`; guardian?:`0x${string}`; balance:string }
export interface Session { userId:string; method:'password'|'passkey'; expires:number }
export interface Challenge { userId:string; purpose:string; challenge:string; expires:number; hash?:string; wallet?:string; message?:string }
export class Store {
  readonly db: DatabaseSync;
  constructor(path:string) { if(path !== ':memory:') mkdirSync(dirname(path),{recursive:true,mode:0o700}); this.db = new DatabaseSync(path); if(path !== ':memory:') chmodSync(path,0o600); this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind,id));'); }
  get<T>(kind:string,id:string): T|undefined { const row = this.db.prepare('SELECT value FROM records WHERE kind=? AND id=?').get(kind,id) as {value:string}|undefined; return row ? JSON.parse(row.value) as T : undefined; }
  put(kind:string,id:string,value:unknown): void { this.db.prepare('INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value').run(kind,id,JSON.stringify(value)); }
  delete(kind:string,id:string): void { this.db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,id); }
  all<T>(kind:string): Array<{id:string;value:T}> { return (this.db.prepare('SELECT id,value FROM records WHERE kind=?').all(kind) as Array<{id:string;value:string}>).map(row=>({id:row.id,value:JSON.parse(row.value) as T})); }
  transaction<T>(fn:()=>T):T { this.db.exec('BEGIN IMMEDIATE'); try { const result=fn(); this.db.exec('COMMIT'); return result; } catch(error) { this.db.exec('ROLLBACK'); throw error; } }
  close():void { this.db.close(); }
}
