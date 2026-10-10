import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../../services/swissquote/src/app.ts';
import { digest } from '../../services/swissquote/src/store.ts';
import type { AppOptions, ChainAdapter, ChainOperation, Setup } from '../../services/swissquote/src/types.ts';
import { ADDRESSES, buildCancelRecoveryTx, hashSafeTx, safeTxFromWire, safeTxToWire, makeSafeTx } from '../../packages/protocol/src/index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const wallet='0x1111111111111111111111111111111111111111' as const;
const owner='0x2222222222222222222222222222222222222222' as const;
const card='0x3333333333333333333333333333333333333333' as const;
const partner='0x4444444444444444444444444444444444444444' as const;
const sq='0x5555555555555555555555555555555555555555' as const;
const newOwner='0x6666666666666666666666666666666666666666' as const;
const hash=`0x${'ab'.repeat(32)}` as const;
const token='public-test-session';
const now=1_800_000_000_000;
const setup={wallet,owner,cardGuardian:card,partnerGuardian:partner,sqGuardian:sq,saltNonce:'1'};
const transfer=()=>safeTxToWire(makeSafeTx({to:ADDRESSES.usdc,data:`0xa9059cbb${newOwner.slice(2).padStart(64,'0')}${(1_000_000n).toString(16).padStart(64,'0')}`}));
function fixture(t:TestContext,options:AppOptions={},chainId=11155111) {
  const sent:ChainOperation[]=[];const verifications:{setup:Setup;expected?:string}[]=[];let signed=0;
  const chain:ChainAdapter={chainId,computeWallet:async()=>wallet,
    verifyWallet:async(s,o)=>{verifications.push({setup:s,expected:o?.expectedCurrentOwner});return true;},
    verifyOwnership:async(_w,_m,s)=>s==='0x1234',
    safeTxHash:async(w,tx)=>hashSafeTx(w,safeTxFromWire({...tx,operation:tx.operation as 0|1}),11155111),
    verifyOwnerSignature:async(_w,_tx,s)=>s==='0x1234',safeNonce:async()=> '0',
    recoveryHash:async()=>hash,isGuardian:async()=>true,signRecovery:async()=>{signed++;return `0x${'ab'.repeat(65)}`;},
    simulate:async()=>{},estimateGas:async()=>100_000n,send:async(op)=>{sent.push(op);return hash;},
    // Confirmation is tied to an actual mock submission, never unconditional success.
    receiptStatus:async submittedHash=>submittedHash===hash&&sent.length>0?{status:'confirmed',blockNumber:'123'}:{status:'unknown'}};
  const appOptions:AppOptions={databasePath:':memory:',allowMock:true,now:()=>now,chain,features:['strictSponsorship'],screeningSources:[{label:'independent mock clear',required:true,mock:true,check:async()=>({hits:[],updatedAt:now})}],...options};
  let app=createApp(appOptions);
  app.store.put('user','test-user',{id:'test-user',email:'test@example.test',password:'unused',kyc:true,resetAt:null,guardian:sq,guardianKey:'0x01',balance:'1000000'});
  app.store.put('session',digest(token),{userId:'test-user',method:'password',expires:now+3600_000});
  app.store.put('wallet',wallet,{clientId:'test-user',setup,verified:true,currentOwner:owner});
  t.after(()=>app.close());
  // Invoke actual HTTP parsing/auth/policy/store in process: never listen or connect to any port.
  const request=async(path:string,body?:unknown,authenticated=true)=>{
    const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]) as IncomingMessage;
    Object.assign(req,{method:body===undefined?'GET':'POST',url:path,headers:{'content-type':'application/json',...(authenticated?{authorization:`Bearer ${token}`}:{})},socket:{remoteAddress:'offline-verifier'}});
    let responseBody='';const res={statusCode:200,setHeader(){},end(chunk?:string){responseBody=chunk??'';}};
    await app.handler(req,res as unknown as ServerResponse);
    return {status:res.statusCode,body:JSON.parse(responseBody) as Record<string,unknown>};
  };
  return {get app(){return app;},chain,sent,request,verifications,signed:()=>signed,
    restart:async()=>{assert.notEqual(appOptions.databasePath,':memory:','Restart check requires a durable database');await app.close();app=createApp(appOptions);}};
}

test('V3-I-S01 exact owner cancel alone bypasses down screening and exhausted global/account budgets',async t=>{
  const f=fixture(t,{globalDailyLimit:0,accountDailyLimit:0,screeningSources:[{label:'required outage',required:true,mock:true,check:async()=>{throw Error('offline outage');}}]});
  const cancel=safeTxToWire(buildCancelRecoveryTx(wallet,0n,[ADDRESSES.moduleA,ADDRESSES.moduleB]));
  assert.equal((await f.request('/relay/safe-tx',{wallet,tx:transfer(),signature:'0x1234'})).body.code,'SCREENING_UNAVAILABLE');
  assert.equal((await f.request('/relay/safe-tx',{wallet,tx:cancel,signature:'0xdead'},false)).status,403);
  const good=await f.request('/relay/safe-tx',{wallet,tx:cancel,signature:'0x1234'},false);
  assert.equal(good.status,200,JSON.stringify(good));assert.equal(good.body.classification,'Protective');assert.equal(f.sent.length,1);
});

test('V3-I-S02 protective cancellation still rejects positive sanctions hit',async t=>{
  const f=fixture(t,{sanctions:[wallet]});const cancel=safeTxToWire(buildCancelRecoveryTx(wallet,0n,[ADDRESSES.moduleA]));
  const r=await f.request('/relay/safe-tx',{wallet,tx:cancel,signature:'0x1234'},false);assert.equal(r.status,403);assert.equal(r.body.code,'SANCTIONS_BLOCK');assert.equal(f.sent.length,0);
});

test('V3-I-S03 unlisted selector returns NOT_SPONSORED and audit records strict flags',async t=>{
  const f=fixture(t);const tx=safeTxToWire(makeSafeTx({to:newOwner,data:'0x12345678'}));
  const r=await f.request('/relay/safe-tx',{wallet,tx,signature:'0x1234'});assert.equal(r.status,403);assert.equal(r.body.code,'NOT_SPONSORED');assert.equal(f.sent.length,0);
  const records=f.app.store.all<{code?:string;flags?:string[];strictSponsorship?:boolean}>('audit');
  assert.ok(records.some(a=>a.value.code==='NOT_SPONSORED'&&a.value.strictSponsorship===true&&a.value.flags?.includes('strictSponsorship')));
});

test('V3-I-S04 recovery registration preserves original CREATE2 setup but persists freshly proved current owner',async t=>{
  const f=fixture(t);const c=await f.request('/wallets/challenge',{wallet});
  const r=await f.request('/wallets',{...setup,expectedCurrentOwner:newOwner,nonce:c.body.nonce,signature:'0x1234'});
  assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.owner,newOwner);
  assert.equal(f.verifications.at(-1)?.setup.owner,owner);assert.equal(f.verifications.at(-1)?.expected,newOwner);
  const record=f.app.store.get<{setup:Setup;currentOwner:string}>('wallet',wallet);assert.equal(record?.setup.owner,owner);assert.equal(record?.currentOwner,newOwner);
  const next=await f.request('/wallets/challenge',{wallet});f.chain.verifyOwnership=async()=>false;
  assert.equal((await f.request('/wallets',{...setup,expectedCurrentOwner:owner,nonce:next.body.nonce,signature:'0x1234'})).status,403);
  assert.equal(f.app.store.get<{currentOwner:string}>('wallet',wallet)?.currentOwner,newOwner);
});

test('V3-I-S05 helper cannot sign without session or valid recovery authentication',async t=>{
  const f=fixture(t);const body={wallet,module:ADDRESSES.moduleB,newOwner,nonce:'0',chainId:11155111};
  assert.equal((await f.request('/recovery/approve',body,false)).status,401);
  assert.equal((await f.request('/recovery/approve',body)).status,403);assert.equal(f.signed(),0);
});

test('V3-I-S06 signing-enabled MOCK fooled switch rejects globally without helper authentication bypass',async t=>{
  for(const chainId of [11155111,31337]) {
    const f=fixture(t,{},chainId);
    const switched=await f.request('/demo/fooled',{enabled:true});
    const approval=await f.request('/recovery/approve',{wallet,module:ADDRESSES.moduleB,newOwner,nonce:'0',chainId});
    assert.equal(switched.status,403,JSON.stringify({chainId,...switched}));
    assert.equal(approval.status,403);assert.equal(f.signed(),0);
  }
});

test('V3-I-S07 uncertain Sepolia broadcast must keep shared relayer closed for another operation',async t=>{
  const f=fixture(t);let calls=0;let receiptCalls=0;
  f.chain.receiptStatus=async()=>{receiptCalls++;return {status:'unknown'};};
  f.chain.send=async()=>{calls++;throw Error('RPC timeout after acceptance');};
  const first=await f.request('/relay/safe-tx',{wallet,tx:transfer(),signature:'0x1234'});
  assert.equal(first.status,502,JSON.stringify(first));assert.match(String(first.body.error),/Uncertain chain broadcast/);assert.equal(calls,1);
  // An independent permissionless finalization still uses the same relayer account/nonce queue.
  const second=await f.request('/relay/finalize',{wallet,module:ADDRESSES.moduleA},false);
  assert.equal(calls,1,`Shared queue allowed another broadcast after uncertain outcome (HTTP ${second.status})`);
  assert.equal(second.status,409);assert.match(String(second.body.error),/uncertain/);assert.equal(receiptCalls,0,'No hash exists to query; uncertainty must not become fake confirmation');
});

function durableDatabase(t:TestContext) {
  const root=resolve(tmpdir());const dir=mkdtempSync(join(root,'sq-v3-independent-'));
  // Verify the absolute deletion target before registering cleanup; app cleanup is registered separately.
  assert.equal(dirname(resolve(dir)),root);assert.ok(dir.startsWith(join(root,'sq-v3-independent-')));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return join(dir,'test.sqlite');
}

test('V3-I-S08 hash pending survives restart, replays without send, blocks owner cancel, then confirmed receipt permits independent send',async t=>{
  const f=fixture(t,{databasePath:durableDatabase(t)});let confirmed=false;const queried:string[]=[];
  f.chain.receiptStatus=async submittedHash=>{queried.push(submittedHash);assert.equal(submittedHash,hash);return confirmed?{status:'confirmed',blockNumber:'456'}:{status:'pending'};};
  const body={wallet,tx:transfer(),signature:'0x1234'};
  const first=await f.request('/relay/safe-tx',body);
  assert.equal(first.status,200);assert.equal(first.body.status,'pending');assert.equal(first.body.txHash,hash);assert.equal(f.sent.length,1);
  await f.restart();
  const state=await f.request('/relay/status',undefined,false);
  assert.equal(state.body.blocked,true);assert.equal(state.body.status,'pending');assert.equal(state.body.txHash,hash);
  const retry=await f.request('/relay/safe-tx',body);
  assert.equal(retry.status,200);assert.equal(retry.body.status,'pending');assert.equal(retry.body.txHash,hash);assert.equal(f.sent.length,1);
  // A different wallet avoids relying on the original wallet:Safe nonce reservation.
  const otherWallet='0x7777777777777777777777777777777777777777' as const;
  const cancel=safeTxToWire(buildCancelRecoveryTx(otherWallet,0n,[ADDRESSES.moduleA]));
  const cancellation=await f.request('/relay/safe-tx',{wallet:otherWallet,tx:cancel,signature:'0x1234'},false);
  assert.equal(cancellation.status,409);assert.match(String(cancellation.body.error),/pending/);assert.equal(f.sent.length,1);
  const blocked=await f.request('/relay/finalize',{wallet:otherWallet,module:ADDRESSES.moduleB},false);
  assert.equal(blocked.status,409);assert.match(String(blocked.body.error),/pending/);assert.equal(f.sent.length,1);
  confirmed=true;
  const allowed=await f.request('/relay/finalize',{wallet:otherWallet,module:ADDRESSES.moduleB},false);
  assert.equal(allowed.status,200,JSON.stringify(allowed));assert.equal(allowed.body.status,'confirmed');assert.equal(allowed.body.blockNumber,'456');assert.equal(f.sent.length,2);
  assert.ok(queried.length>=4);assert.equal((await f.request('/relay/status',undefined,false)).body.blocked,false);
});

test('V3-I-S09 no-hash uncertainty survives real SQLite close/reopen and blocks another wallet and owner cancel',async t=>{
  const f=fixture(t,{databasePath:durableDatabase(t)});let calls=0;let receiptCalls=0;
  f.chain.send=async()=>{calls++;throw Error('RPC timeout after acceptance');};
  f.chain.receiptStatus=async()=>{receiptCalls++;return {status:'confirmed',blockNumber:'999'};};
  assert.equal((await f.request('/relay/safe-tx',{wallet,tx:transfer(),signature:'0x1234'})).status,502);assert.equal(calls,1);
  await f.restart();
  const state=await f.request('/relay/status',undefined,false);
  assert.equal(state.body.blocked,true);assert.equal(state.body.status,'uncertain');assert.equal(state.body.txHash,undefined);
  const next=await f.request('/relay/finalize',{wallet:'0x7777777777777777777777777777777777777777',module:ADDRESSES.moduleA},false);
  assert.equal(next.status,409);assert.match(String(next.body.error),/uncertain/);
  const otherWallet='0x8888888888888888888888888888888888888888' as const;
  const cancel=safeTxToWire(buildCancelRecoveryTx(otherWallet,0n,[ADDRESSES.moduleA]));
  const cancellation=await f.request('/relay/safe-tx',{wallet:otherWallet,tx:cancel,signature:'0x1234'},false);
  assert.equal(cancellation.status,409);assert.match(String(cancellation.body.error),/uncertain/);
  assert.equal(calls,1);assert.equal(receiptCalls,0,'Even an overoptimistic adapter cannot settle a no-hash uncertainty');
});

test('V3-I-S10 genuinely missing Sepolia receipt API fails closed before any send, including owner cancel',async t=>{
  const f=fixture(t);delete f.chain.receiptStatus;
  const cancel=safeTxToWire(buildCancelRecoveryTx(wallet,0n,[ADDRESSES.moduleA]));
  for(const [path,body] of [['/relay/safe-tx',{wallet,tx:cancel,signature:'0x1234'}],['/relay/finalize',{wallet,module:ADDRESSES.moduleA}]] as const) {
    const result=await f.request(path,body,false);
    assert.equal(result.status,503);assert.match(String(result.body.error),/receipt status API required; nothing broadcast/);
  }
  assert.equal(f.sent.length,0);assert.equal(f.app.store.all('sender-latch').length,0);
});

for(const receiptState of ['unknown','throws','reverted'] as const) test(`V3-I-S11 ${receiptState} receipt ${receiptState==='reverted'?'settles':'does not release'} pending global sender`,async t=>{
  const f=fixture(t);let receiptCalls=0;
  f.chain.receiptStatus=async submittedHash=>{assert.equal(submittedHash,hash);receiptCalls++;if(receiptState==='throws') throw Error('Receipt endpoint unavailable');return receiptState==='reverted'?{status:'reverted',blockNumber:'789'}:{status:'unknown'};};
  const first=await f.request('/relay/safe-tx',{wallet,tx:transfer(),signature:'0x1234'});
  assert.equal(first.status,200);assert.equal(first.body.status,receiptState==='reverted'?'reverted':'pending');
  const next=await f.request('/relay/finalize',{wallet:'0x7777777777777777777777777777777777777777',module:ADDRESSES.moduleA},false);
  assert.equal(next.status,receiptState==='reverted'?200:409);assert.equal(f.sent.length,receiptState==='reverted'?2:1);assert.ok(receiptCalls>=2);
});
