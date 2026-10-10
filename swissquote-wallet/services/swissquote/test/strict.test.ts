import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashMessage,encodeFunctionData,parseAbi} from 'viem';
import {createApp} from '../src/app.ts';
import {ZERO,MODULES,USDC,strictClassification} from '../src/policy.ts';
import {screenAddresses,MOCK_LISTED} from '../src/screening.ts';
import {DAPP_ADDRESSES,compoundAbi} from '@sq/protocol';
import type {Address,AppOptions,ChainAdapter} from '../src/types.ts';
const wallet='0x1111111111111111111111111111111111111111' as Address;
const recipient='0x5555555555555555555555555555555555555555' as Address;
const tx=(to:Address,data:`0x${string}`='0x',value='0')=>({to,data,value,operation:0,safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:ZERO,refundReceiver:ZERO,nonce:'0'});
const cancel=tx(MODULES[0],encodeFunctionData({abi:parseAbi(['function cancelRecovery()']),functionName:'cancelRecovery'}));
const clear={label:'MOCK test oracle',required:true,mock:true,check:async()=>({hits:[]})};
async function fixture(options:AppOptions={}) {
 const events:string[]=[];let valid=true;let fail=false;
 const chain:ChainAdapter={chainId:11155111,registrationBlock: async () => 1n, computeWallet:async()=>wallet,verifyWallet:async()=>true,verifyOwnership:async()=>true,safeTxHash:async()=>hashMessage('tx'),verifyOwnerSignature:async()=>valid,safeNonce:async()=> '0',recoveryHash:async()=>hashMessage('recovery'),isGuardian:async()=>true,signRecovery:async()=> '0x11',simulate:async()=>{events.push('simulate');if(fail)throw new Error('GS026');},estimateGas:async()=>100n,send:async()=>{events.push('send');return hashMessage('sent');},receiptStatus:async()=>({status:'confirmed',blockNumber:'1'})};
 const app=createApp({databasePath:':memory:',chain,allowMock:true,features:['strictSponsorship'],screeningSources:[clear],...options});
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));const info=app.server.address();assert.ok(info&&typeof info==='object');const port=info.port;
 async function call(path:string,body?:unknown,token?:string){const response=await fetch(`http://127.0.0.1:${port}${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
 const registered=await call('/auth/password/register',{email:'strict@example.com',password:'correct-horse-123'});const token=registered.body.token as string;await call('/kyc/mock-verify',{},token);
 app.store.put('wallet',wallet,{clientId:registered.body.clientId,verified:true,setup:{wallet,owner:recipient,cardGuardian:recipient,partnerGuardian:recipient,sqGuardian:recipient,saltNonce:'1'}});
 return {app,call,token,events,setValid:(v:boolean)=>{valid=v;},setFail:(v:boolean)=>{fail=v;}};
}
test('strict unknown/native/approval calls refuse and preserve legacy fallback when flag is off',async()=>{
 for(const transaction of [tx(recipient,'0x12345678'),tx(recipient,'0x','1'),tx(USDC,encodeFunctionData({abi:parseAbi(['function approve(address spender,uint256 amount)']),functionName:'approve',args:[recipient,1n]}))]) await assert.rejects(strictClassification(wallet,transaction,{}),/supported|Unsupported|Unlisted|Expected/);
 const f=await fixture();try {const result=await f.call('/relay/safe-tx',{wallet,tx:tx(recipient,'0x12345678'),signature:'0x11'},f.token);assert.equal(result.status,403);assert.equal(result.body.code,'NOT_SPONSORED');assert.deepEqual(f.events,[]);const refused=f.app.store.all<{flags:string[];reason:string;decision:string}>('audit').filter(r=>r.value.decision==='refused');assert.ok(refused.some(r=>r.value.flags.includes('strictSponsorship')&&r.value.reason));}finally{await f.app.close();}
});
test('required outage blocks payment; exact cancel bypasses global/account caps and outages but still verifies owner',async()=>{
 const f=await fixture({globalDailyLimit:0,accountDailyLimit:0,screeningSources:[{...clear,mock:false,kind:'sanctions',check:async()=>{throw new Error('offline');}}]});try {
  const screen=await f.call('/screen',{addresses:[wallet]});assert.equal(screen.body.ok,false);assert.ok(screen.body.sources.some((s:string)=>s.includes('unavailable')));
  const payment=tx(USDC,encodeFunctionData({abi:parseAbi(['function transfer(address to,uint256 amount)']),functionName:'transfer',args:[recipient,1n]}));assert.equal((await f.call('/relay/safe-tx',{wallet,tx:payment,signature:'0x11'},f.token)).body.code,'SCREENING_UNAVAILABLE');
  f.setValid(false);assert.equal((await f.call('/relay/safe-tx',{wallet,tx:cancel,signature:'0x11'})).status,403);f.setValid(true);assert.equal((await f.call('/relay/safe-tx',{wallet,tx:cancel,signature:'0x11'})).status,200);assert.deepEqual(f.events,['simulate','send']);assert.equal((await f.call('/relay/finalize',{wallet,module:MODULES[0]})).status,429);
 }finally{await f.app.close();}
});
test('wallet positive sanctions blocks cancel; module-only hit cannot block it',async()=>{
 for(const [hits,status] of [[[wallet],403],[[MODULES[0]],200]] as const){const f=await fixture({sanctions:hits});try{const result=await f.call('/relay/safe-tx',{wallet,tx:cancel,signature:'0x11'});assert.equal(result.status,status);if(status===403){assert.equal(result.body.code,'SANCTIONS_BLOCK');assert.deepEqual(f.events,[]);}}finally{await f.app.close();}}
});
test('stale required sources fail closed and MOCK listed address always blocks',async()=>{
 const now=Date.now();const result=await screenAddresses([wallet],[{...clear,mock:false,check:async()=>({hits:[],updatedAt:now-31*86400_000})}],[],now);assert.equal(result.ok,false);assert.ok(result.sources.some(s=>s.includes('stale')));assert.deepEqual((await screenAddresses([MOCK_LISTED],[],[],now)).hits,[MOCK_LISTED]);
});
test('listed dApp preview/relay refuse unavailable simulation; effects hash is mandatory',async()=>{
 const f=await fixture();try{const transaction=tx(DAPP_ADDRESSES.compound,encodeFunctionData({abi:compoundAbi,functionName:'withdraw',args:[DAPP_ADDRESSES.usdc,1n]}));assert.equal((await f.call('/dapps')).body.dapps.length,2);const preview=await f.call('/dapps/preview',{wallet,tx:transaction,dappId:'compound'},f.token);assert.equal(preview.status,403);assert.equal(preview.body.code,'NOT_SPONSORED');assert.equal((await f.call('/relay/safe-tx',{wallet,tx:transaction,signature:'0x11',source:'dapp',dappId:'compound'},f.token)).status,403);const result=await f.call('/relay/safe-tx',{wallet,tx:transaction,signature:'0x11',source:'dapp',dappId:'compound',effectsHash:hashMessage('fake')},f.token);assert.equal(result.body.code,'NOT_SPONSORED');assert.ok(!f.events.includes('send'));}finally{await f.app.close();}
});
test('Sepolia mock account starts at 1 USDC; payout reservation restores on preflight failure then caps total',async()=>{
 const f=await fixture({mockPayoutCap:'1000000'});try {assert.equal((await f.call('/account',undefined,f.token)).body.balance,'1000000');f.setFail(true);assert.equal((await f.call('/account/withdraw',{to:wallet,amount:'1000000'},f.token)).status,502);assert.equal((await f.call('/account',undefined,f.token)).body.balance,'1000000');f.setFail(false);assert.equal((await f.call('/account/withdraw',{to:wallet,amount:'1000000'},f.token)).status,200);assert.equal(f.app.store.get('mock-payout','total'),'1000000');}finally{await f.app.close();}
});
