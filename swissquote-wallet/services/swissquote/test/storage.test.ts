import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, hashPassword, checkPassword } from '../src/store.ts';
test('SQLite stores are isolated and transactions roll back',()=> {const sq=new Store(':memory:');const partner=new Store(':memory:');try {sq.put('key','guardian',{secret:'private'});assert.equal(partner.get('key','guardian'),undefined);assert.throws(()=>sq.transaction(()=>{sq.put('key','other',1);throw new Error('rollback');}));assert.equal(sq.get('key','other'),undefined);const password=hashPassword('correct horse battery');assert.ok(checkPassword('correct horse battery',password));assert.equal(checkPassword('wrong',password),false);}finally{sq.close();partner.close();}});
