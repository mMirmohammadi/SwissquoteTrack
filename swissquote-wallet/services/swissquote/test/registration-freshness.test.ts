import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { hashMessage, toHex, HttpRequestError, type Address, type Hex, type PublicClient } from 'viem';
import { ADDRESSES, GUARD_STORAGE_SLOT, FALLBACK_STORAGE_SLOT, computeWalletAddress, encodeCode, ownershipProofText } from '@sq/protocol';
import { createApp } from '../src/app.ts';
import { createViemChain } from '../src/chain.ts';
import { digest } from '../src/store.ts';
import type { ChainAdapter } from '../src/types.ts';
import { parseMinimumBlock, pacedFetch, registrationClient, classifiedRegistrationRead, withRegistrationReads, registrationRead, registrationContext, recheckRegistrationBlock, type RegistrationClock } from '../src/registration-reads.ts';

const owner='0x1111111111111111111111111111111111111111' as Address;
const card='0x2222222222222222222222222222222222222222' as Address;
const partner='0x3333333333333333333333333333333333333333' as Address;
const guardian='0x4444444444444444444444444444444444444444' as Address;
const setup={owner,cardGuardian:card,partnerGuardian:partner,sqGuardian:guardian,saltNonce:'12'};
const hash=hashMessage('selected block');
const key=`0x${'01'.repeat(32)}` as Hex; // Public deterministic fixture, never used to sign/send.
const urls=['https://first.invalid','https://second.invalid'];
function clock() {let time=0;return {now:()=>time,sleep:async(ms:number)=>{time+=ms;},advance:(ms:number)=>{time+=ms;}};}
function fixture() {
  const pinned=JSON.parse(readFileSync(new URL('../../../contracts/contracts/plan/sepolia-code.json',import.meta.url),'utf8'));
  const moduleB=JSON.parse(readFileSync(new URL('../../../contracts/contracts/plan/sepolia-module-b.json',import.meta.url),'utf8'));
  const artifact=JSON.parse(readFileSync(new URL('../../../contracts/node_modules/@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json',import.meta.url),'utf8'));
  const codes=new Map<string,Hex>(Object.values(pinned.contracts).map((item:any)=>[item.address.toLowerCase(),item.code]));codes.set(moduleB.address.toLowerCase(),moduleB.code);
  const wallet=computeWalletAddress({...setup,saltNonce:12n,chainId:11155111},artifact.bytecode).toLowerCase() as Address;
  const calls:{role:string;method:string;args:any}[]=[];
  const make=(role:string,heads:bigint[])=> {
    let i=0;const state={hash:hash as Hex|null,owner,chainId:11155111,transportError:false};
    const capture=(method:string,args?:any)=>calls.push({role,method,args});
    const client={
      getChainId:async()=>{capture('getChainId');return state.chainId;},
      getBlockNumber:async(args:any)=>{capture('getBlockNumber',args);return heads[Math.min(i++,heads.length-1)];},
      getBlock:async(args:any)=>{capture('getBlock',args);return {hash:state.hash};},
      getLogs:async(args:any)=>{capture('getLogs',args);return [];},
      getCode:async(args:any)=>{capture('getCode',args);if(state.transportError) throw new HttpRequestError({url:'https://secret.invalid',body:{proof:'DO_NOT_LEAK'},cause:new Error('DO_NOT_LEAK')});return args.address.toLowerCase()===wallet?artifact.deployedBytecode:codes.get(args.address.toLowerCase());},
      getStorageAt:async(args:any)=>{capture('getStorageAt',args);return toHex(args.slot===GUARD_STORAGE_SLOT?0n:args.slot===FALLBACK_STORAGE_SLOT?BigInt(ADDRESSES.fallbackHandler):BigInt(ADDRESSES.safeL2),{size:32});},
      readContract:async(args:any)=>{capture('readContract',args);const b=args.address.toLowerCase()===ADDRESSES.moduleB.toLowerCase();switch(args.functionName) {
        case 'proxyCreationCode':return artifact.bytecode;case 'isValidSignature':return '0x1626ba7e';case 'nonce':return 0n;case 'getOwners':return [state.owner];case 'getThreshold':return 1n;
        case 'getModulesPaginated':return [[ADDRESSES.moduleA,ADDRESSES.moduleB],'0x0000000000000000000000000000000000000001'];
        case 'getGuardians':return [card,b?guardian:partner];case 'threshold':case 'guardiansCount':return 2n;case 'getRecoveryRequest':return {executeAfter:0n};default:throw new Error('Unexpected fixture action');
      }},
    } as unknown as PublicClient;
    return {client,state};
  };
  return {wallet,calls,make};
}
function appFixture(chain:ChainAdapter,wallet:Address,registrationClock?:RegistrationClock) {
  const app=createApp({databasePath:':memory:',chain,registrationClock,allowMock:true});
  app.store.put('user','client',{id:'client',email:'fixture@example.com',password:'unused',kyc:true,resetAt:null,balance:'1000000',guardian});
  app.store.put('session',digest('session'),{userId:'client',method:'password',expires:Number.MAX_SAFE_INTEGER});
  let nonce=0;
  async function post(path:string,body:unknown) {
    const req=Readable.from([Buffer.from(JSON.stringify(body))]) as IncomingMessage;
    Object.assign(req,{method:'POST',url:path,headers:{'content-type':'application/json',authorization:'Bearer session'},socket:{remoteAddress:'fixture'}});
    let output='';const res={statusCode:0,setHeader(){},end(value:string){output=value;}} as unknown as ServerResponse;
    await app.handler(req,res);return {status:res.statusCode,body:JSON.parse(output)};
  }
  function request(minimumBlockNumber?:unknown) {
    const n=`nonce-${nonce++}`;const message=ownershipProofText('client',wallet,n,chain.chainId);
    app.store.put('challenge',n,{userId:'client',purpose:'ownership',wallet,message,expires:Number.MAX_SAFE_INTEGER});
    return {setupCode:encodeCode({v:1,kind:'setup',chainId:chain.chainId,wallet,owner,partnerGuardian:partner,sqGuardian:guardian,saltNonce:'12'}),cardGuardian:card,minimumBlockNumber,ownershipProof:{nonce:n,message,hash:hashMessage(message),signature:'0x11'}};
  }
  return {app,post,request};
}
test('separate lagging roles catch up, pin real verifier and proof to common 102, keep full history',async()=> {
  const f=fixture();const p=f.make('public',[101n,103n]);const h=f.make('history',[99n,102n]);const c=clock();
  const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client,historyClient:h.client,registrationClock:c});
  const a=appFixture(adapter,f.wallet,c);
  try {
    const result=await a.post('/wallets',a.request('100'));assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(c.now(),500);
    const heads=f.calls.filter(x=>x.method==='getBlockNumber');assert.equal(heads.length,4);assert.ok(heads.every(x=>x.args.cacheTime===0));
    const verification=f.calls.filter(x=>['getCode','getStorageAt','getLogs'].includes(x.method)||x.method==='readContract'&&x.args.functionName!=='proxyCreationCode');
    assert.ok(verification.length>10);assert.ok(verification.every(x=>x.method==='getLogs'?x.args.toBlock===102n&&x.args.fromBlock===0n:x.args.blockNumber===102n));
    assert.ok(f.calls.findIndex(x=>x.method==='getCode')>f.calls.map(x=>x.method).lastIndexOf('getBlockNumber'));
    assert.equal(f.calls.filter(x=>x.method==='getBlock').length,4);assert.equal(a.app.store.get<{verified:boolean}>('wallet',f.wallet)?.verified,true);
  } finally {await a.app.close();}
});
test('same-client no-minimum and older minimum select fresh head, not caller snapshot',async()=> {
  const f=fixture();const p=f.make('same',[101n]);const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client});
  assert.equal(await adapter.registrationBlock(),101n);assert.equal(await adapter.registrationBlock(1n),101n);
  assert.equal(f.calls.filter(x=>x.method==='getBlockNumber').length,2);
});
test('maximum-ahead boundary accepted; boundary+1 rejected before polling',async()=> {
  const f=fixture();const p=f.make('public',[100n,164n]);const c=clock();const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client,registrationClock:c});
  assert.equal(await adapter.registrationBlock(164n),164n);
  const q=f.make('new',[100n]);const other=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:q.client});
  await assert.rejects(other.registrationBlock(165n),(error:any)=>error.status===400);
});
test('chain mismatch, missing hash and unequal role hashes fail closed',async()=> {
  for(const failure of ['chain','missing','mismatch']) {
    const f=fixture();const p=f.make('public',[100n]);const h=f.make('history',[100n]);
    if(failure==='chain') h.state.chainId=31337;if(failure==='missing') h.state.hash=null;if(failure==='mismatch') h.state.hash=hashMessage('different');
    const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client,historyClient:h.client});
    const a=appFixture(adapter,f.wallet);try {assert.equal((await a.post('/wallets',a.request())).status,503);assert.equal(a.app.store.get('wallet',f.wallet),undefined);} finally {await a.app.close();}
  }
});
test('changed hash after proof refuses before persistence',async()=> {
  const f=fixture();const p=f.make('public',[100n]);const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client});
  const proof=adapter.verifyOwnership;adapter.verifyOwnership=async(...args)=>{const result=await proof(...args);p.state.hash=hashMessage('reorg');return result;};
  const a=appFixture(adapter,f.wallet);try {const r=await a.post('/wallets',a.request());assert.equal(r.status,503);assert.equal(r.body.code,'registration_block_changed');assert.equal(a.app.store.get('wallet',f.wallet),undefined);} finally {await a.app.close();}
});
test('canonical uint64 minimum validation precedes RPC, including decoded setup requests',async()=> {
  assert.equal(parseMinimumBlock('0'),0n);assert.equal(parseMinimumBlock('18446744073709551615'),(1n<<64n)-1n);
  const wallet='0x5555555555555555555555555555555555555555' as Address;let calls=0;
  const chain={chainId:31337,computeWallet:async()=>{calls++;return wallet;},registrationBlock:async()=>1n} as unknown as ChainAdapter;
  const a=appFixture(chain,wallet);try {
    for(const bad of [0,-1,'','01','+1','-1',' 1','1 ','1e2','0x1','18446744073709551616','9'.repeat(21),null,{}]) assert.equal((await a.post('/wallets',a.request(bad))).status,400);
    assert.equal(calls,0);
  } finally {await a.app.close();}
});
test('missing barrier refuses, does not call rules/proof or allow withdrawal',async()=> {
  const wallet='0x5555555555555555555555555555555555555555' as Address;let reads=0;
  const chain={chainId:31337,computeWallet:async()=>wallet,verifyWallet:async()=>{reads++;return true;},verifyOwnership:async()=>{reads++;return true;}} as unknown as ChainAdapter;
  const a=appFixture(chain,wallet);try {const r=await a.post('/wallets',a.request());assert.equal(r.status,503);assert.equal(r.body.code,'registration_capability_missing');assert.equal(reads,0);assert.equal((await a.post('/account/withdraw',{to:wallet,amount:'1'})).status,403);} finally {await a.app.close();}
});
test('permanent lag stops at barrier budget without verification',async()=> {
  const f=fixture();const p=f.make('public',[100n]);const c=clock();const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client,registrationClock:c});
  await assert.rejects(adapter.registrationBlock(101n),(error:any)=>error.status===503);assert.ok(c.now()<=20000);assert.equal(f.calls.filter(x=>x.method==='getCode').length,0);
});
test('verification keeps existing concurrent-store owner/setup recheck',async()=> {
  const f=fixture();const p=f.make('public',[100n]);const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client});const a=appFixture(adapter,f.wallet);
  const proof=adapter.verifyOwnership;adapter.verifyOwnership=async(...args)=>{const result=await proof(...args);a.app.store.put('wallet',f.wallet,{clientId:'client',setup:{...setup,wallet:f.wallet},verified:false,currentOwner:partner});return result;};
  try {const r=await a.post('/wallets',a.request());assert.equal(r.status,409);assert.equal(a.app.store.get<{verified:boolean}>('wallet',f.wallet)?.verified,false);} finally {await a.app.close();}
});
test('deadline includes compute and late successful reads cannot persist verified state',async()=> {
  for(const stage of ['compute','rules','proof']) {
    const wallet='0x5555555555555555555555555555555555555555' as Address;const c=clock();let release!:()=>void;let started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve;});
    const slow=async()=>{started();await new Promise<void>(resolve=>{release=resolve;});return true;};
    const chain={chainId:31337,computeWallet:async()=>{if(stage==='compute') await slow();return wallet;},registrationBlock:async()=>1n,verifyWallet:stage==='rules'?slow:async()=>true,verifyOwnership:stage==='proof'?slow:async()=>true} as unknown as ChainAdapter;
    const a=appFixture(chain,wallet,c);try {
      const pending=a.post('/wallets',a.request());await ready;c.advance(25001);release();const r=await pending;assert.equal(r.status,503);assert.equal(r.body.code,'registration_deadline');assert.equal(a.app.store.get('wallet',wallet),undefined);
      await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(a.app.store.get('wallet',wallet),undefined);
    } finally {await a.app.close();}
  }
});
test('handler timeout returns 503 before late rules success and never stores a verified wallet',async()=> {
  const wallet='0x5555555555555555555555555555555555555555' as Address;const c=clock();let release!:()=>void;
  const chain={chainId:31337,computeWallet:async()=>{c.advance(24990);return wallet;},registrationBlock:async()=>1n,verifyWallet:async()=>new Promise<boolean>(resolve=>{release=()=>resolve(true);}),verifyOwnership:async()=>true} as unknown as ChainAdapter;
  const a=appFixture(chain,wallet,c);try {
    const r=await a.post('/wallets',a.request());assert.equal(r.status,503);assert.equal(r.body.code,'registration_deadline');assert.equal(a.app.store.get('wallet',wallet),undefined);
    release();await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(a.app.store.get('wallet',wallet),undefined);
  } finally {await a.app.close();}
});
test('hanging read and late rejection use one remaining absolute deadline',async()=> {
  const c=clock();let reject!:(error:Error)=>void;
  await assert.rejects(withRegistrationReads(async()=>{c.advance(24995);await registrationRead(()=>new Promise((_,r)=>{reject=r;}));},c),(error:any)=>error.registrationCode==='registration_deadline');
  reject(new Error('late rejection observed'));await new Promise<void>(resolve=>setImmediate(resolve));
});
test('terminal demonstrable transport failure gets safe 503; invalid wallet remains template 403',async()=> {
  for(const transport of [false,true]) {
    const f=fixture();const p=f.make('public',[100n]);p.state.transportError=transport;p.state.owner=partner;
    const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:key,publicClient:p.client});const a=appFixture(adapter,f.wallet);
    try {const r=await a.post('/wallets',a.request());assert.equal(r.status,transport?503:403);assert.equal(r.body.code,transport?'registration_rpc_unavailable':'registration_rules_refused');assert.ok(!JSON.stringify(r.body).includes('DO_NOT_LEAK'));assert.ok(!JSON.stringify(a.app.store.all('audit')).includes('DO_NOT_LEAK'));} finally {await a.app.close();}
  }
});
test('failure classification is request-local and generic errors are not guessed transport failures',async()=> {
  const failing=registrationClient({readContract:async()=>{throw new HttpRequestError({url:'https://private.invalid',cause:new Error('raw')});}} as unknown as PublicClient);
  const generic=registrationClient({readContract:async()=>{throw new Error('arbitrary RPC-looking error');}} as unknown as PublicClient);
  const readFalse=(client:PublicClient)=>classifiedRegistrationRead(async()=>{try {await client.readContract({} as never);} catch {}return false;});
  const results=await Promise.allSettled([withRegistrationReads(()=>readFalse(failing)),withRegistrationReads(()=>readFalse(generic))]);
  assert.equal(results[0].status,'rejected');assert.deepEqual(results[1],{status:'fulfilled',value:false});
});
test('actual fetch starts paced including retries; rejected/aborted queued attempts never poison queue',async()=> {
  const c=clock();const starts:number[]=[];let attempts=0;
  const fetchFn=pacedFetch((async()=>{starts.push(c.now());if(attempts++===0) throw new Error('first failed');return new Response('{}');}) as typeof fetch,c);
  await assert.rejects(fetchFn('https://one.invalid'));await fetchFn('https://one.invalid');await fetchFn('https://one.invalid');assert.deepEqual(starts,[0,150,300]);
  const abort=new AbortController();abort.abort();await assert.rejects(fetchFn('https://one.invalid',{signal:abort.signal}));assert.equal(starts.length,3);await fetchFn('https://one.invalid');assert.equal(starts.length,4);
});
test('expired registration aborts queued fetch before actual network start',async()=> {
  let release!:()=>void;let firstStarted!:()=>void;const ready=new Promise<void>(r=>{firstStarted=r;});let starts=0;
  const fetchFn=pacedFetch((async()=>{starts++;if(starts===1) {firstStarted();await new Promise<void>(r=>{release=r;});}return new Response('{}');}) as typeof fetch);
  const first=fetchFn('https://one.invalid');await ready;
  await assert.rejects(withRegistrationReads(async()=>{const ctx=registrationContext()!;ctx.deadline=ctx.clock.now()+5;await registrationRead(()=>fetchFn('https://one.invalid'));}));
  release();await first;await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(starts,1);
});
