import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { MemoryPartnerStore } from '../../services/partner/src/storage.ts';
import { createPartnerService, type RecoverySnapshot } from '../../services/partner/src/service.ts';
import { createPartnerServer } from '../../services/partner/src/server.ts';
import { hashRecovery, signRecovery, encodeCode } from '../../packages/protocol/src/index.ts';
import { createRequire } from 'node:module';
const { privateKeyToAccount } = createRequire(new URL('../../packages/protocol/package.json',import.meta.url))('viem/accounts');
// Explicit synthetic unfunded key; never connects to an RPC or sends a transaction.
const privateKey=`0x${'11'.repeat(32)}` as const;
const guardian=privateKeyToAccount(privateKey).address as `0x${string}`;
const wallet='0x1111111111111111111111111111111111111111' as const;
const newOwner='0x2222222222222222222222222222222222222222' as const;
const card='0x3333333333333333333333333333333333333333' as const;
const moduleA='0x949d01d424bE050D09C16025dd007CB59b3A8c66' as const;
const moduleB='0x38275826E1933303E508433dD5f289315Da2541c' as const;
const body={userRef:'victim-reference',mockFace:'victim-face',wallet,newOwner,module:moduleA,chainId:31337,nonce:'0'};
async function fixture(t:any,override:Partial<RecoverySnapshot>={}) {
  const store=new MemoryPartnerStore();let signed=0,reads=0;
  const service=createPartnerService({store,chainId:31337,moduleA,chainReader:{readRecovery:async request=>{
    reads++;return {chainId:31337,nonce:0n,guardians:[guardian,card],threshold:2n,recoveryHash:hashRecovery({...request,nonce:0n}),...override};
  }},crypto:{generateGuardian:()=>({privateKey,address:guardian}),hashRecovery,signRecovery:async(key,request)=>{signed++;return signRecovery(key,request);},encodeApproval:(approval,chainId)=>encodeCode({v:1,kind:'approval',chainId,...approval})}});
  const server=createPartnerServer({service});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const request=async(path:string,value:unknown)=>{
    const response=await fetch(`http://127.0.0.1:${address.port}${path}`,{signal:AbortSignal.timeout(5000),method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
    return {status:response.status,body:await response.json() as any};
  };
  assert.equal((await request('/enroll',{userRef:body.userRef,mockFace:body.mockFace})).status,200);
  return {request,store,signed:()=>signed,reads:()=>reads};
}
test('SEC-PARTNER-01 wrong face cannot overwrite enrollment; original face remains usable',async t=>{
  const f=await fixture(t);const original=f.store.get(body.userRef);
  const denied=await f.request('/enroll',{userRef:body.userRef,mockFace:'attacker-face'});
  assert.equal(denied.status,403);assert.deepEqual(f.store.get(body.userRef),original);
  const valid=await f.request('/enroll',{userRef:body.userRef,mockFace:body.mockFace});assert.equal(valid.status,200);assert.equal(valid.body.guardian,guardian);
});
test('SEC-PARTNER-02 wrong face refuses before chain read or signing; valid face signs',async t=>{
  const f=await fixture(t);assert.equal((await f.request('/recovery/approve',{...body,mockFace:'attacker-face'})).status,403);
  assert.equal(f.signed(),0);assert.equal(f.reads(),0);
  const valid=await f.request('/recovery/approve',body);assert.equal(valid.status,200,JSON.stringify(valid));assert.equal(f.signed(),1);assert.equal(valid.body.signer,guardian);assert.match(valid.body.signature,/^0x[0-9a-f]{130}$/i);
});
for (const [label,change,status] of [
  ['wrong module',{module:moduleB},400],['request chain mismatch',{chainId:11155111},400],['stale nonce',{nonce:'1'},409],
] as const) {
  test(`SEC-PARTNER request ${label} never signs`,async t=>{
    const f=await fixture(t);const result=await f.request('/recovery/approve',{...body,...change});
    assert.equal(result.status,status,JSON.stringify(result));assert.equal(f.signed(),0);
  });
}
for (const [label,override] of [
  ['RPC chain mismatch',{chainId:11155111}],['guardian missing',{guardians:[card,newOwner]}],['wrong threshold',{threshold:1n}],
  ['duplicate guardians',{guardians:[guardian,guardian]}],['hash mismatch',{recoveryHash:`0x${'00'.repeat(32)}` as `0x${string}`}],
] as const) {
  test(`SEC-PARTNER snapshot ${label} never signs`,async t=>{
    const f=await fixture(t,override);const result=await f.request('/recovery/approve',body);
    assert.equal(result.status,409,JSON.stringify(result));assert.equal(f.signed(),0);
  });
}
test('SEC-PARTNER-03 demo bypass is disabled by default',async t=>{
  const f=await fixture(t);assert.equal((await f.request('/demo/fooled',{enabled:true})).status,403);
  assert.equal((await f.request('/recovery/approve',{...body,mockFace:'attacker-face'})).status,403);assert.equal(f.signed(),0);
});
