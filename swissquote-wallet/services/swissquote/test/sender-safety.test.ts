import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {hashMessage,toFunctionSelector} from 'viem';
import {ownershipProofText} from '@sq/protocol';
import {createApp} from '../src/app.ts';
import {MODULES,ZERO,USDC,ApiError} from '../src/policy.ts';
import {digest} from '../src/store.ts';
import {ChainPrebroadcastError,type ChainAdapter,type ReceiptStatus,type ChainOperation,type Address} from '../src/types.ts';
const wallet='0x1111111111111111111111111111111111111111' as Address;
const other='0x2222222222222222222222222222222222222222' as Address;
const hash=hashMessage('test transaction');
function adapter(chainId=11155111) {
  let sends=0;let receipt:ReceiptStatus={status:'pending'};let failure:Error|undefined;
  const chain:ChainAdapter={chainId,registrationBlock: async () => 1n, computeWallet:async()=>wallet,verifyWallet:async()=>true,verifyOwnership:async()=>true,safeTxHash:async(_w,tx)=>hashMessage(JSON.stringify(tx)),verifyOwnerSignature:async()=>true,safeNonce:async()=> '0',recoveryHash:async()=>hash,isGuardian:async()=>true,signRecovery:async()=> '0x11',simulate:async()=>{},estimateGas:async()=>100n,send:async()=>{sends++;if(failure)throw failure;return hash;},receiptStatus:async()=>receipt};
  return {chain,get sends(){return sends;},settle:(value:ReceiptStatus)=>{receipt=value;},fail:(value:Error|undefined)=>{failure=value;}};
}
async function call(app:ReturnType<typeof createApp>,path:string,body?:unknown,token?:string) {
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]) as IncomingMessage;
  Object.assign(req,{method:body===undefined?'GET':'POST',url:path,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},socket:{remoteAddress:'offline'}});
  let status=0;let payload='';
  const res={setHeader(){},set statusCode(value:number){status=value;},end(value:string){payload=value;}} as unknown as ServerResponse;
  await app.handler(req,res);return {status,body:JSON.parse(payload)};
}
const finalize=(app:ReturnType<typeof createApp>,address=wallet)=>call(app,'/relay/finalize',{wallet:address,module:MODULES[0]});
const cancel={to:MODULES[0],data:toFunctionSelector('cancelRecovery()'),value:'0',operation:0,safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:ZERO,refundReceiver:ZERO,nonce:'0'};

test('public pending hash blocks all next sends, including cancel, until success or revert receipt',async()=> {
  for(const status of ['confirmed','reverted'] as const) {
    const mock=adapter();const app=createApp({databasePath:':memory:',chain:mock.chain});
    try {
      const first=await finalize(app);assert.equal(first.status,200);assert.equal(first.body.status,'pending');assert.equal(first.body.txHash,hash);
      const pending=await call(app,'/relay/status');assert.equal(pending.body.blocked,true);assert.equal(pending.body.txHash,hash);
      assert.equal((await finalize(app,other)).status,409);
      const protective=await call(app,'/relay/safe-tx',{wallet,tx:cancel,signature:'0x11'});assert.equal(protective.status,409);assert.match(protective.body.error,/sender blocked/);assert.equal(mock.sends,1);
      mock.settle({status,blockNumber:'42'});const reconciled=await call(app,'/relay/status');assert.equal(reconciled.body.blocked,false);assert.equal(reconciled.body.lastSettlement.status,status);const next=await finalize(app,other);assert.equal(next.status,200);assert.equal(next.body.status,status);assert.equal(mock.sends,2);
    } finally {await app.close();}
  }
});
test('unknown receipt/API outage and generic send errors never unlock; explicit preparation proof allows retry',async()=> {
  for(const failure of [new Error('RPC timeout after acceptance'),new ApiError(503,'ambiguous RPC error')]) {
    const mock=adapter();mock.fail(failure);const app=createApp({databasePath:':memory:',chain:mock.chain});
    try {const first=await finalize(app);assert.equal(first.status,502);assert.match(first.body.error,/Uncertain chain broadcast outcome/);mock.fail(undefined);assert.equal((await finalize(app,other)).status,409);assert.equal(mock.sends,1);}finally{await app.close();}
  }
  const mock=adapter();const app=createApp({databasePath:':memory:',chain:mock.chain});
  try {await finalize(app);mock.settle({status:'unknown'});assert.equal((await finalize(app,other)).status,409);mock.chain.receiptStatus=async()=>{throw new Error('offline');};assert.equal((await finalize(app,other)).status,409);assert.equal(mock.sends,1);}finally{await app.close();}
  const proven=adapter();proven.fail(new ChainPrebroadcastError('fees exceeded; nothing broadcast'));
  const safe=createApp({databasePath:':memory:',chain:proven.chain});try {assert.equal((await finalize(safe)).status,503);proven.fail(undefined);assert.equal((await finalize(safe)).status,200);}finally{await safe.close();}
});
test('persisted intent precedes send and blocks after restart, including crash before returned hash is saved',async()=> {
  const root=fileURLToPath(new URL('./',import.meta.url));const dir=mkdtempSync(join(root,'.sender-safety-'));const databasePath=join(dir,'test.sqlite');
  const mock=adapter();let app=createApp({databasePath,chain:mock.chain});
  const original=mock.chain.send;
  mock.chain.send=async(op:ChainOperation,gas:bigint)=>{assert.equal(app.store.get<{state:string}>('sender-latch','11155111:global')?.state,'uncertain');return original(op,gas);};
  try {
    await finalize(app);await app.close();app=createApp({databasePath,chain:mock.chain});assert.equal((await finalize(app,other)).status,409);assert.equal((await finalize(app)).body.txHash,hash);assert.equal(mock.sends,1);
    const intent=app.store.get<Record<string,unknown>>('sender-latch','11155111:global')!;delete intent.txHash;app.store.put('sender-latch','11155111:global',intent);
    await app.close();app=createApp({databasePath,chain:mock.chain});mock.settle({status:'confirmed',blockNumber:'1'});assert.equal((await finalize(app,other)).status,409);assert.equal(mock.sends,1);
  }finally{await app.close();assert.ok(resolve(dir).startsWith(resolve(root)+ '/.sender-safety-'));rmSync(dir,{recursive:true});}
});
test('Safe hash retries return receipt result after nonce changes without a second send; withdrawals never double debit pending intent',async()=> {
  const mock=adapter();const app=createApp({databasePath:':memory:',chain:mock.chain,allowMock:true});const token='offline-token';
  app.store.put('user','client',{id:'client',email:'test@example.com',password:'unused',kyc:true,resetAt:null,balance:'3000000'});
  app.store.put('session',digest(token),{userId:'client',method:'password',expires:Date.now()+100000});
  app.store.put('wallet',wallet,{clientId:'client',verified:true,setup:{wallet,owner:other,cardGuardian:other,partnerGuardian:other,sqGuardian:other,saltNonce:'1'}});
  try {
    const tx={...cancel,to:USDC,data:`0xa9059cbb${other.slice(2).padStart(64,'0')}${'1'.padStart(64,'0')}`};
    const first=await call(app,'/relay/safe-tx',{wallet,tx,signature:'0x11'},token);assert.equal(first.body.status,'pending');
    mock.chain.safeNonce=async()=> '1';assert.equal((await call(app,'/relay/safe-tx',{wallet,tx,signature:'0x11'},token)).body.txHash,hash);assert.equal(mock.sends,1);
    mock.settle({status:'confirmed',blockNumber:'1'});assert.equal((await call(app,'/relay/safe-tx',{wallet,tx,signature:'0x11'},token)).body.status,'confirmed');
    mock.settle({status:'pending'});const debit=await call(app,'/account/withdraw',{to:wallet,amount:'1000000'},token);assert.equal(debit.status,200);assert.equal(debit.body.status,'pending');
    assert.equal((await call(app,'/account/withdraw',{to:wallet,amount:'1000000'},token)).status,409);assert.equal(app.store.get<{balance:string}>('user','client')!.balance,'2000000');assert.equal(mock.sends,2);
  }finally{await app.close();}
});
test('public adapters need receipt status; legacy local adapters retain no-receipt compatibility',async()=> {
  for(const chainId of [11155111,31337]) {const mock=adapter(chainId);delete mock.chain.receiptStatus;const app=createApp({databasePath:':memory:',chain:mock.chain});try{assert.equal((await finalize(app)).status,chainId===31337?200:503);assert.equal(mock.sends,chainId===31337?1:0);}finally{await app.close();}}
});
test('fooled true is forbidden globally, stale stored bypass never signs, resetfalse remains available; ownership text names actual chain',async()=> {
  for(const chainId of [31337,11155111]) {
    const mock=adapter(chainId);let signatures=0;mock.chain.signRecovery=async()=>{signatures++;return '0x11';};const app=createApp({databasePath:':memory:',chain:mock.chain,allowMock:true});
    try {
      const registered=await call(app,'/auth/password/register',{email:'offline@example.com',password:'correct-horse-123'});const token=registered.body.token;const id=registered.body.clientId;
      await call(app,'/kyc/mock-verify',{},token);const guardian=await call(app,'/guardian/enroll',{},token);
      app.store.put('wallet',wallet,{clientId:id,verified:true,setup:{wallet,owner:other,cardGuardian:other,partnerGuardian:other,sqGuardian:guardian.body.guardian,saltNonce:'1'}});
      assert.equal((await call(app,'/demo/fooled',{enabled:true},token)).status,403);app.store.put('fooled',id,true);
      const refused=await call(app,'/recovery/approve',{wallet,module:MODULES[1],newOwner:other,nonce:'0'},token);assert.equal(refused.status,403);assert.match(refused.body.error,/72-hour/);assert.equal(signatures,0);
      assert.equal((await call(app,'/demo/fooled',{enabled:false},token)).status,200);assert.equal(app.store.get('fooled',id),undefined);
      const challenge=await call(app,'/wallets/challenge',{wallet},token);assert.equal(challenge.body.message,ownershipProofText(id,wallet,challenge.body.nonce,chainId));
    } finally {await app.close();}
  }
});
