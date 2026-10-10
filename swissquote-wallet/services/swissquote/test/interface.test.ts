import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { encodeCode } from '@sq/protocol';
import { hashMessage } from 'viem';
import type { Address, ChainAdapter } from '../src/types.ts';
const wallet='0x1111111111111111111111111111111111111111' as Address;
test('shared setupCode/proof contract links only matching challenge and initializer',async()=> {
 const chain={chainId:31337,registrationBlock: async () => 1n, computeWallet:async()=>wallet,verifyWallet:async()=>true,verifyOwnership:async()=>true} as unknown as ChainAdapter;
 const app=createApp({databasePath:':memory:',chain,allowMock:true});await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));const info=app.server.address();assert.ok(info&&typeof info==='object');const url=`http://127.0.0.1:${info.port}`;
 async function post(path:string,body:unknown,token?:string) {const r=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json() as Record<string,any>};}
 try {const registered=await post('/auth/password/register',{email:'integration@example.com',password:'correct-horse-123'});assert.equal(registered.body.kycVerified,false);const token=registered.body.token;await post('/kyc/mock-verify',{},token);const guardian=await post('/guardian/enroll',{},token);
 const setup={owner:'0x2222222222222222222222222222222222222222' as Address,partnerGuardian:'0x4444444444444444444444444444444444444444' as Address,sqGuardian:guardian.body.guardian as Address,saltNonce:'1'};const cardGuardian='0x3333333333333333333333333333333333333333';
 const bad=await post('/relay/deploy',{...setup,cardGuardian,wallet,initializer:'0x00'},token);assert.equal(bad.status,403);
 const code=encodeCode({v:1,kind:'setup',chainId:31337,wallet,...setup});const challenge=await post('/wallets/challenge',{wallet},token);const body={setupCode:code,cardGuardian,ownershipProof:{nonce:challenge.body.nonce,message:challenge.body.message,hash:hashMessage(challenge.body.message),signature:'0x11'}};
 const linked=await post('/wallets',body,token);assert.equal(linked.status,200);assert.equal(linked.body.chainId,31337);assert.equal(linked.body.owner,setup.owner);assert.equal((await post('/wallets',body,token)).status,401);
 }finally{await app.close();}
});
