import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, classifyTransaction } from '../src/app.ts';
import { MODULES, ZERO, USDC, MULTISEND } from '../src/policy.ts';
import type { ChainAdapter, ChainOperation, AppOptions, WebAuthnAdapter, Hex, Address } from '../src/types.ts';
import { encodeFunctionData, parseAbi, hashMessage } from 'viem';
import { encodeCode } from '@sq/protocol';
const wallet='0x1111111111111111111111111111111111111111' as Address;
const owner='0x2222222222222222222222222222222222222222' as Address;
const card='0x3333333333333333333333333333333333333333' as Address;
const partner='0x4444444444444444444444444444444444444444' as Address;
const recipient='0x5555555555555555555555555555555555555555' as Address;
const signature=('0x'+'11'.repeat(65)) as Hex;
function adapter() {const events:string[]=[];let valid=true;let fail=false;let gas=100n;
 const chain:ChainAdapter={chainId:31337,computeWallet:async()=>wallet,verifyWallet:async()=>true,verifyOwnership:async()=>valid,safeTxHash:async(_wallet,tx)=>hashMessage(JSON.stringify(Object.entries(tx).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,typeof v==='string'?v.toLowerCase():v]))),verifyOwnerSignature:async()=>valid,safeNonce:async()=> '0',recoveryHash:async()=>hashMessage('recovery'),isGuardian:async()=>true,signRecovery:async()=>signature,simulate:async()=>{events.push('simulate');if(fail) throw new Error('GS026');},estimateGas:async()=>{events.push('estimate');return gas;},send:async()=>{events.push('send');return hashMessage('sent');}};
 return {chain,events,setValid:(value:boolean)=>{valid=value;},setFail:(value:boolean)=>{fail=value;},setGas:(value:bigint)=>{gas=value;}};
}
const passkey:WebAuthnAdapter={registrationOptions:async()=>({challenge:'register'}),authenticationOptions:async(_c,challenge)=>({challenge:challenge??'login'}),verifyRegistration:async()=>({id:'credential',publicKey:'AA',counter:0}),verifyAuthentication:async()=>({id:'credential',counter:0})};
async function fixture(options:AppOptions={}) {const mock=adapter();const app=createApp({databasePath:':memory:',chain:mock.chain,webauthn:passkey,allowMock:true,...options});await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));const info=app.server.address();assert.ok(info&&typeof info==='object');const url=`http://127.0.0.1:${info.port}`;
 async function call(path:string,body?:unknown,token?:string) {const result=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:result.status,body:await result.json() as Record<string,any>};}
 const registration=await call('/auth/password/register',{email:'client@example.com',password:'correct-horse-123'});const token=registration.body.token as string;
 await call('/kyc/mock-verify',{},token);const guardian=await call('/guardian/enroll',{},token);const setup={owner,cardGuardian:card,partnerGuardian:partner,sqGuardian:guardian.body.guardian,saltNonce:'1',wallet};
 const challenge=await call('/wallets/challenge',{wallet},token);const link=await call('/wallets',{...setup,nonce:challenge.body.nonce,signature},token);assert.equal(link.status,200);
 return {app,call,token,setup,mock};
}
function tx(to:Address=recipient,data:Hex='0x',value='0') {return {to,data,value,operation:0,safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:ZERO,refundReceiver:ZERO,nonce:'0'};}
function transfer(amount:bigint) {return encodeFunctionData({abi:parseAbi(['function transfer(address to,uint256 amount)']),functionName:'transfer',args:[recipient,amount]});}
test('health and password/verified wallet support a simulated owner-signed small relay',async()=> {const f=await fixture();try {const response=await f.call('/relay/safe-tx',{wallet,tx:tx(USDC,transfer(2_000_000n)),signature},f.token);assert.equal(response.status,200);assert.equal(response.body.classification,'Small');assert.ok(response.body.transactionHash);assert.deepEqual(f.mock.events,['simulate','estimate','send']);}finally{await f.app.close();}});
test('large/admin never use password fallback; passkey binds exact Safe hash and is single use',async()=> {const f=await fixture();try {const transaction=tx(USDC,transfer(8_000_000n));assert.equal((await f.call('/relay/safe-tx',{wallet,tx:transaction,signature},f.token)).status,403);
 const reg=await f.call('/auth/passkey/register/options',{},f.token);assert.equal(reg.status,200);const credential=await f.call('/auth/passkey/register/verify',{challengeId:reg.body.challengeId,response:{}},f.token);assert.equal(credential.status,200);
 const hash=await f.mock.chain.safeTxHash(wallet,transaction);const options=await f.call('/auth/passkey/step-up/options',{safeTxHash:hash},f.token);assert.equal(options.body.options.challenge,Buffer.from(hash.slice(2),'hex').toString('base64url'));
 const approve=await f.call('/auth/passkey/step-up/verify',{challengeId:options.body.challengeId,response:{}},f.token);const stepUpToken=approve.body.stepUpToken;
 assert.equal((await f.call('/relay/safe-tx',{wallet,tx:tx(USDC,transfer(9_000_000n)),signature,stepUpToken},f.token)).status,403);
 const paid=await f.call('/relay/safe-tx',{wallet,tx:transaction,signature,stepUpToken},f.token);assert.equal(paid.status,200,JSON.stringify(paid.body));
 assert.equal((await f.call('/relay/safe-tx',{wallet,tx:transaction,signature,stepUpToken},f.token)).status,403);
 }finally{await f.app.close();}});
test('cancel and finalize bypass identity/account budget but not owner signature or simulation',async()=> {const f=await fixture({accountDailyLimit:0});try {const data=encodeFunctionData({abi:parseAbi(['function cancelRecovery()']),functionName:'cancelRecovery'});
 f.mock.setValid(false);assert.equal((await f.call('/relay/safe-tx',{wallet,tx:tx(MODULES[0],data),signature})).status,403);assert.equal(f.mock.events.length,0);
 f.mock.setValid(true);assert.equal((await f.call('/relay/safe-tx',{wallet,tx:tx(MODULES[0],data),signature})).status,200);assert.equal((await f.call('/relay/finalize',{wallet,module:MODULES[0]})).status,200);
 assert.equal((await f.call('/relay/deploy',f.setup,f.token)).status,429);
 }finally{await f.app.close();}});
test('simulation and gas cap failures never broadcast',async()=> {const f=await fixture({gasCap:100n});try {f.mock.setFail(true);assert.equal((await f.call('/relay/finalize',{wallet,module:MODULES[0]})).status,502);assert.deepEqual(f.mock.events,['simulate']);f.mock.setFail(false);assert.equal((await f.call('/relay/finalize',{wallet,module:MODULES[0]})).status,403);assert.deepEqual(f.mock.events,['simulate','simulate','estimate']);}finally{await f.app.close();}});
test('MOCK Travel Rule gate rejects arbitrary destination and accepts verified same-client wallet',async()=> {const f=await fixture();try {const denied=await f.call('/account/withdraw',{to:recipient,amount:'1000000'},f.token);assert.equal(denied.status,403);assert.match(denied.body.error,/Travel Rule/);assert.equal((await f.call('/account/withdraw',{to:wallet,amount:'1000000'},f.token)).status,200);const account=await f.call('/account',undefined,f.token);assert.equal(account.body.balance,'19000000');}finally{await f.app.close();}});
test('reset mailbox token is single-use, invalidates sessions, holds recovery and new passkey enrollment',async()=> {let time=1_000_000;const f=await fixture({now:()=>time});try {assert.equal((await f.call('/auth/password/reset-request',{email:'client@example.com'})).status,200);const mail=await f.call('/mock/mailbox');const resetToken=mail.body.messages[0].resetToken;
 assert.equal((await f.call('/auth/password/reset',{token:resetToken,password:'new-correct-horse'})).status,200);assert.equal((await f.call('/account',undefined,f.token)).status,401);assert.equal((await f.call('/auth/password/reset',{token:resetToken,password:'new-correct-horse'})).status,401);
 const login=await f.call('/auth/password/login',{email:'client@example.com',password:'new-correct-horse'});const token=login.body.token;
 const request={wallet,module:MODULES[1],newOwner:recipient,nonce:'0',mockVideoId:true};const denied=await f.call('/recovery/approve',request,token);assert.equal(denied.status,403);assert.match(denied.body.error,/72-hour/);assert.equal((await f.call('/auth/passkey/register/options',{},token)).status,403);
 time+=73*3600_000;const later=await f.call('/auth/password/login',{email:'client@example.com',password:'new-correct-horse'});assert.equal((await f.call('/recovery/approve',request,later.body.token)).status,200);
 }finally{await f.app.close();}});
test('classification rejects forbidden delegatecalls, unknown token methods and sanctioned decoded recipients',async()=> {await assert.rejects(classifyTransaction(wallet,{...tx(recipient),operation:1}),/Delegatecall target forbidden/);await assert.rejects(classifyTransaction(wallet,tx(USDC,'0x12345678')),/Unsupported token operation/);await assert.rejects(classifyTransaction(wallet,tx(USDC,transfer(1n)),{sanctions:[recipient]}),/decoded recipient blocked/);assert.equal(await classifyTransaction(wallet,tx(recipient,'0x12345678')),'Large');
 const cancel=encodeFunctionData({abi:parseAbi(['function cancelRecovery()']),functionName:'cancelRecovery'});const packed=MODULES.map(module=>'00'+module.slice(2).toLowerCase()+'0'.repeat(64)+(cancel.length/2-1).toString(16).padStart(64,'0')+cancel.slice(2)).join('');const data=encodeFunctionData({abi:parseAbi(['function multiSend(bytes transactions)']),functionName:'multiSend',args:[('0x'+packed) as Hex]});assert.equal(await classifyTransaction(wallet,{...tx(MULTISEND,data),operation:1}),'Protective');
 });
