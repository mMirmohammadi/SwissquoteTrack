import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { once } from 'node:events';

import { createApp } from '../../services/swissquote/src/app.ts';
import { createWebAuthn } from '../../services/swissquote/src/webauthn.ts';
import type { ChainAdapter, ChainOperation, SafeTx, WebAuthnAdapter } from '../../services/swissquote/src/types.ts';
import { buildCancelRecoveryTx, safeTxToWire } from '../../packages/protocol/src/index.ts';

const wallet = '0x1111111111111111111111111111111111111111' as const;
const otherWallet = '0x2222222222222222222222222222222222222222' as const;
const recipient = '0x3333333333333333333333333333333333333333' as const;
const owner = '0x4444444444444444444444444444444444444444' as const;
const card = '0x5555555555555555555555555555555555555555' as const;
const partner = '0x6666666666666666666666666666666666666666' as const;
const moduleA = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as const;
const moduleB = '0x38275826E1933303E508433dD5f289315Da2541c' as const;
const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
const hexHash = (x: unknown) => `0x${createHash('sha256').update(JSON.stringify(x)).digest('hex')}` as `0x${string}`;
// Canonicalize ONLY the injected JSON hash double. Actual EIP-712 hashing is unchanged.
const canonicalTx = (transaction: SafeTx): SafeTx => ({...transaction,to:transaction.to.toLowerCase() as `0x${string}`,data:transaction.data.toLowerCase() as `0x${string}`,gasToken:transaction.gasToken.toLowerCase() as `0x${string}`,refundReceiver:transaction.refundReceiver.toLowerCase() as `0x${string}`});
const transfer = (amount: bigint) => `0xa9059cbb${recipient.slice(2).padStart(64,'0')}${amount.toString(16).padStart(64,'0')}` as `0x${string}`;
const tx = (amount = 1_000_000n): SafeTx => ({to:usdc,value:'0',data:transfer(amount),operation:0,safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:'0x0000000000000000000000000000000000000000',refundReceiver:'0x0000000000000000000000000000000000000000',nonce:'0'});

// Only external chain/WebAuthn boundaries are doubles. The exported real app,
// HTTP handler, policy, opaque token store and classifier remain under test.
async function fixture(t: any, options: Record<string,unknown> = {}, linkWallet = true) {
  let now = 1_800_000_000_000;
  const sent: ChainOperation[] = [];
  const chain: ChainAdapter = {
    chainId:31337, computeWallet:async()=>wallet, verifyWallet:async()=>true,
    verifyOwnership:async(_w,_m,sig)=>sig==='0x1234',
    safeTxHash:async(w,transaction)=>hexHash([w.toLowerCase(),canonicalTx(transaction)]),
    verifyOwnerSignature:async(_w,_tx,sig)=>sig==='0x1234', safeNonce:async()=> '0',
    recoveryHash:async(request)=>hexHash(request), isGuardian:async()=>true,
    signRecovery:async()=> '0x1234', simulate:async()=>{}, estimateGas:async()=>100_000n,
    send:async(operation)=>{sent.push(operation);return hexHash(operation);},
  };
  const webauthn: WebAuthnAdapter = {
    registrationOptions:async()=>({challenge:'registration-challenge'}),
    authenticationOptions:async(_credentials,challenge)=>({challenge:challenge ?? 'login-challenge'}),
    verifyRegistration:async(response:any,challenge)=>{
      assert.equal(response.challenge,challenge);assert.equal(response.valid,true);
      return {id:'credential-1',publicKey:'dGVzdA==',counter:0};
    },
    verifyAuthentication:async(response:any,challenge)=>{
      assert.equal(response.challenge,challenge);assert.equal(response.valid,true);
      return {id:'credential-1',counter:response.counter ?? 1};
    },
  };
  const app = createApp({databasePath:':memory:',chain,webauthn,now:()=>now,allowMock:true,...options});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>app.close());
  const address = app.server.address();assert.ok(address && typeof address!=='string');
  const base = `http://127.0.0.1:${address.port}`;
  const request = async(path:string,body?:unknown,token?:string) => {
    const response = await fetch(base+path,{signal:AbortSignal.timeout(5000),method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json() as any};
  };
  const user = await request('/auth/password/register',{email:'security@example.test',password:'correct horse battery staple'});
  assert.equal(user.status,200,JSON.stringify(user));
  const token = user.body.token; assert.equal(typeof token,'string');
  assert.equal((await request('/kyc/mock-verify',{},token)).status,200);
  const guardian = await request('/guardian/enroll',{},token);assert.equal(guardian.status,200);
  if (linkWallet) {
    const challenge = await request('/wallets/challenge',{wallet},token);assert.equal(challenge.status,200);
    const registration = await request('/wallets',{wallet,owner,cardGuardian:card,partnerGuardian:partner,sqGuardian:guardian.body.guardian,saltNonce:'1',nonce:challenge.body.nonce,signature:'0x1234',chainId:31337},token);
    assert.equal(registration.status,200,JSON.stringify(registration));
  }
  const registerPasskey = async()=>{
    const opts=await request('/auth/passkey/register/options',{},token);assert.equal(opts.status,200);
    const verified=await request('/auth/passkey/register/verify',{challengeId:opts.body.challengeId,response:{valid:true,challenge:opts.body.options.challenge}},token);
    assert.equal(verified.status,200,JSON.stringify(verified));return verified.body.token as string;
  };
  const stepUp = async(transaction:SafeTx)=>{
    const hash=await chain.safeTxHash(wallet,transaction);
    const opts=await request('/auth/passkey/step-up/options',{safeTxHash:hash},token);assert.equal(opts.status,200,JSON.stringify(opts));
    const verified=await request('/auth/passkey/step-up/verify',{safeTxHash:hash,challengeId:opts.body.challengeId,response:{valid:true,challenge:opts.body.options.challenge}},token);
    assert.equal(verified.status,200,JSON.stringify(verified));return verified.body.stepUpToken as string;
  };
  return {request,token,sent,chain,registerPasskey,stepUp,setup:{wallet,owner,cardGuardian:card,partnerGuardian:partner,sqGuardian:guardian.body.guardian,saltNonce:'1',chainId:31337},advance:(ms:number)=>{now+=ms;}};
}
function refused(result:{status:number;body:any}) {assert.ok(result.status>=400 && result.status<500,JSON.stringify(result));assert.equal(typeof result.body.error,'string');}

test('SEC-S01 wrong session wallet cannot relay a small owner-signed tx',async t=>{
  const f=await fixture(t);const attacker=await f.request('/auth/password/register',{email:'attacker@example.test',password:'another long password'});
  refused(await f.request('/relay/safe-tx',{wallet,tx:tx(),signature:'0x1234'},attacker.body.token));assert.equal(f.sent.length,0);
});
test('SEC-S02 unregistered wallet cannot relay',async t=>{
  const f=await fixture(t);refused(await f.request('/relay/safe-tx',{wallet:otherWallet,tx:tx(),signature:'0x1234'},f.token));assert.equal(f.sent.length,0);
});
test('SEC-S03 large transaction without passkey is refused',async t=>{
  const f=await fixture(t);refused(await f.request('/relay/safe-tx',{wallet,tx:tx(8_000_000n),signature:'0x1234'},f.token));assert.equal(f.sent.length,0);
});
test('SEC-S04 forged step-up token is refused',async t=>{
  const f=await fixture(t);refused(await f.request('/relay/safe-tx',{wallet,tx:tx(8_000_000n),signature:'0x1234',stepUpToken:'forged-token'},f.token));assert.equal(f.sent.length,0);
});
test('SEC-S05 genuine step-up cannot authorize a different tx hash',async t=>{
  const f=await fixture(t);await f.registerPasskey();const stepUpToken=await f.stepUp(tx(8_000_000n));
  refused(await f.request('/relay/safe-tx',{wallet,tx:tx(9_000_000n),signature:'0x1234',stepUpToken},f.token));assert.equal(f.sent.length,0);
});
test('SEC-S06 expired genuine step-up token is refused',async t=>{
  const f=await fixture(t);await f.registerPasskey();const stepUpToken=await f.stepUp(tx(8_000_000n));f.advance(60*60*1000);
  refused(await f.request('/relay/safe-tx',{wallet,tx:tx(8_000_000n),signature:'0x1234',stepUpToken},f.token));assert.equal(f.sent.length,0);
});
test('SEC-S07 genuine step-up is one-use even with unchanged injected chain nonce',async t=>{
  const f=await fixture(t);await f.registerPasskey();const stepUpToken=await f.stepUp(tx(8_000_000n));const body={wallet,tx:tx(8_000_000n),signature:'0x1234',stepUpToken};
  assert.equal((await f.request('/relay/safe-tx',body,f.token)).status,200);
  refused(await f.request('/relay/safe-tx',body,f.token));assert.equal(f.sent.length,1);
});
test('SEC-S08 invalid WebAuthn assertion cannot mint step-up, regardless of UX status',async t=>{
  const f=await fixture(t);await f.registerPasskey();const opts=await f.request('/auth/passkey/step-up/options',{safeTxHash:await f.chain.safeTxHash(wallet,tx(8_000_000n))},f.token);
  const body={challengeId:opts.body.challengeId,response:{valid:false,challenge:opts.body.options.challenge}};
  const result=await f.request('/auth/passkey/step-up/verify',body,f.token);
  assert.ok(result.status>=400&&result.status<600,JSON.stringify(result));
  assert.equal(typeof result.body.error,'string');assert.equal(result.body.stepUpToken,undefined);
  t.diagnostic(`Invalid injected assertion UX: HTTP ${result.status}; ${result.body.error}`);
  refused(await f.request('/auth/passkey/step-up/verify',{...body,response:{valid:true,challenge:opts.body.options.challenge}},f.token));
  refused(await f.request('/relay/safe-tx',{wallet,tx:tx(8_000_000n),signature:'0x1234'},f.token));
  assert.equal(f.sent.length,0);
});
test('SEC-S09 SQ recent password reset hold refuses guardian recovery',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/auth/password/reset-request',{email:'security@example.test'})).status,200);
  const mailbox=await f.request('/mock/mailbox');
  // Exact mailbox field is adapted once real app is available; do not silently skip.
  const messages=Array.isArray(mailbox.body)?mailbox.body:(mailbox.body.messages ?? mailbox.body.mailbox);
  assert.ok(Array.isArray(messages),'mailbox must expose MOCK reset evidence');
  const last=messages.at(-1);assert.ok(last);
  const resetToken=last.token ?? last.resetToken;
  assert.equal(typeof resetToken,'string','adapt token extraction to real MOCK mailbox contract');
  assert.equal((await f.request('/auth/password/reset',{token:resetToken,password:'new correct horse battery staple'})).status,200);
  const login=await f.request('/auth/password/login',{email:'security@example.test',password:'new correct horse battery staple'});assert.equal(login.status,200);
  refused(await f.request('/recovery/approve',{wallet,module:moduleB,newOwner:recipient,nonce:'0',mockVideoId:true},login.body.token));assert.equal(f.sent.length,0);
});
test('SEC-S10 only valid owner-signed cancel bypasses account budget',async t=>{
  const f=await fixture(t,{accountDailyLimit:0});
  refused(await f.request('/relay/safe-tx',{wallet,tx:tx(),signature:'0x1234'},f.token));
  const cancelTx=safeTxToWire(buildCancelRecoveryTx(wallet,0n,[moduleA,moduleB]));
  refused(await f.request('/relay/safe-tx',{wallet,tx:cancelTx,signature:'0xdead'}));
  assert.equal((await f.request('/relay/safe-tx',{wallet,tx:cancelTx,signature:'0x1234'})).status,200);
  assert.equal(f.sent.length,1);
});
test('SEC-S11 unsupported delegatecall fails even with a valid step-up',async t=>{
  const f=await fixture(t);await f.registerPasskey();const transaction={...tx(),to:recipient,operation:1};const stepUpToken=await f.stepUp(transaction);
  refused(await f.request('/relay/safe-tx',{wallet,tx:transaction,signature:'0x1234',stepUpToken,source:'settings'},f.token));assert.equal(f.sent.length,0);
});
test('SEC-S12 failed owner signature never reaches send',async t=>{
  const f=await fixture(t);refused(await f.request('/relay/safe-tx',{wallet,tx:tx(),signature:'0xdead'},f.token));assert.equal(f.sent.length,0);
});

function gate() {
  let release!:()=>void;let enter!:()=>void;
  const blocked=new Promise<void>(resolve=>{release=resolve;});
  const entered=new Promise<void>(resolve=>{enter=resolve;});
  return {release,entered,wait:async()=>{enter();await blocked;}};
}

test('SEC-S13 concurrent use of one genuine step-up broadcasts only once',async t=>{
  const f=await fixture(t);await f.registerPasskey();const stepUpToken=await f.stepUp(tx(8_000_000n));
  const g=gate();const send=f.chain.send;f.chain.send=async(op,gas)=>{await g.wait();return send(op,gas);};
  const body={wallet,tx:tx(8_000_000n),signature:'0x1234',stepUpToken};
  const first=f.request('/relay/safe-tx',body,f.token);
  try {await g.entered;const replay=await f.request('/relay/safe-tx',body,f.token);refused(replay);assert.equal(replay.status,403);}
  finally {g.release();}
  assert.equal((await first).status,200);assert.equal(f.sent.length,1);
});

test('SEC-S14 concurrent deployment reserves one wallet and broadcasts once',async t=>{
  const f=await fixture(t,{},false);f.chain.computeWallet=async setup=>setup.saltNonce==='1'?wallet:otherWallet;
  const g=gate();const send=f.chain.send;f.chain.send=async(op,gas)=>{await g.wait();return send(op,gas);};
  const first=f.request('/relay/deploy',f.setup,f.token);
  try {
    await g.entered;
    const [same,different]=await Promise.all([
      f.request('/relay/deploy',f.setup,f.token),
      f.request('/relay/deploy',{...f.setup,wallet:otherWallet,saltNonce:'2'},f.token),
    ]);
    assert.equal(same.status,409,JSON.stringify(same));assert.equal(different.status,409,JSON.stringify(different));
  } finally {g.release();}
  const completed=await first;assert.equal(completed.status,200,JSON.stringify(completed));
  assert.equal((await f.request('/relay/deploy',f.setup,f.token)).status,200);
  assert.equal((await f.request('/relay/deploy',{...f.setup,wallet:otherWallet,saltNonce:'2'},f.token)).status,409);
  assert.equal(f.sent.length,1);
});

test('SEC-S15 definite withdraw simulation failure restores balance and allows retry',async t=>{
  const f=await fixture(t);const before=await f.request('/account',undefined,f.token);assert.equal(before.status,200);
  f.chain.simulate=async operation=>{if(operation.kind==='withdraw')throw new Error('Synthetic definite simulation refusal');};
  const failed=await f.request('/account/withdraw',{to:wallet,amount:'1000000'},f.token);
  assert.equal(failed.status,502,JSON.stringify(failed));assert.match(failed.body.error,/nothing broadcast/);
  assert.equal((await f.request('/account',undefined,f.token)).body.balance,before.body.balance);assert.equal(f.sent.length,0);
  f.chain.simulate=async()=>{};assert.equal((await f.request('/account/withdraw',{to:wallet,amount:'1000000'},f.token)).status,200);
  assert.equal((await f.request('/account',undefined,f.token)).body.balance,(BigInt(before.body.balance)-1_000_000n).toString());assert.equal(f.sent.length,1);
});

test('SEC-S16 mismatched recovery chain cannot sign or broadcast; matching chain succeeds',async t=>{
  const f=await fixture(t);const passkeySession=await f.registerPasskey();let signed=0,hashed=0;
  f.chain.signRecovery=async()=>{signed++;return `0x${'ab'.repeat(65)}`;};f.chain.recoveryHash=async request=>{hashed++;return hexHash(request);};
  const request={wallet,module:moduleB,newOwner:recipient,nonce:'0',mockVideoId:true};
  const approve=await f.request('/recovery/approve',{...request,chainId:11155111},f.token);
  assert.equal(approve.status,400,JSON.stringify(approve));assert.match(approve.body.error,/chain mismatch/i);
  const relay=await f.request('/relay/recovery',{wallet,module:moduleB,newOwner:recipient,nonce:'0',chainId:11155111,approvals:[{signer:partner,signature:'0x1234'}]},f.token);
  assert.equal(relay.status,400,JSON.stringify(relay));assert.equal(signed,0);assert.equal(hashed,0);assert.equal(f.sent.length,0);
  const valid=await f.request('/recovery/approve',{...request,chainId:31337},passkeySession);
  assert.equal(valid.status,200,JSON.stringify(valid));assert.equal(signed,1);assert.equal(valid.body.request.chainId,31337);
});

test('SEC-S17 concurrent verification consumes a WebAuthn challenge once',async t=>{
  const f=await fixture(t);await f.registerPasskey();const hash=await f.chain.safeTxHash(wallet,tx(8_000_000n));
  const opts=await f.request('/auth/passkey/step-up/options',{safeTxHash:hash},f.token);
  const body={safeTxHash:hash,challengeId:opts.body.challengeId,response:{valid:true,challenge:opts.body.options.challenge}};
  const results=await Promise.all([f.request('/auth/passkey/step-up/verify',body,f.token),f.request('/auth/passkey/step-up/verify',body,f.token)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);assert.equal(results.filter(r=>typeof r.body.stepUpToken==='string').length,1);
});

test('SEC-S18 concurrent withdrawals cannot exceed available balance',async t=>{
  const f=await fixture(t,{initialMockBalance:'1000000'});const results=await Promise.all([
    f.request('/account/withdraw',{to:wallet,amount:'1000000'},f.token),f.request('/account/withdraw',{to:wallet,amount:'1000000'},f.token),
  ]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);assert.equal(f.sent.length,1);
  assert.equal((await f.request('/account',undefined,f.token)).body.balance,'0');
});

test('SEC-S20 real WebAuthn adapter rejects malformed authentication without minting approval',async t=>{
  const real=createWebAuthn({rpID:'localhost',origin:'http://localhost:5173'});
  let signed=0;
  const f=await fixture(t,{webauthn:{...real,registrationOptions:async()=>({challenge:'registration-challenge'}),verifyRegistration:async()=>({id:'credential-1',publicKey:'dGVzdA==',counter:0})}});
  await f.registerPasskey();const hash=await f.chain.safeTxHash(wallet,tx(8_000_000n));
  const opts=await f.request('/auth/passkey/step-up/options',{safeTxHash:hash},f.token);assert.equal(opts.status,200,JSON.stringify(opts));
  const invalid=await f.request('/auth/passkey/step-up/verify',{safeTxHash:hash,challengeId:opts.body.challengeId,response:{id:'credential-1',type:'public-key',response:{}}},f.token);
  assert.ok(invalid.status>=400&&invalid.status<600,JSON.stringify(invalid));assert.equal(invalid.body.stepUpToken,undefined);
  t.diagnostic(`Malformed real WebAuthn adapter UX: HTTP ${invalid.status}; ${invalid.body.error}`);
  f.chain.send=async()=>{signed++;return hexHash('unexpected-send');};
  refused(await f.request('/relay/safe-tx',{wallet,tx:tx(8_000_000n),signature:'0x1234'},f.token));assert.equal(signed,0);
});

for (const [label,limits] of [['account',{accountDailyLimit:1}],['global',{globalDailyLimit:1}]] as const) {
  test(`SEC-S21 concurrent withdrawals respect ${label} budget and restore refused debit`,async t=>{
    const f=await fixture(t,limits);const before=(await f.request('/account',undefined,f.token)).body.balance;
    const results=await Promise.all([f.request('/account/withdraw',{to:wallet,amount:'1000000'},f.token),f.request('/account/withdraw',{to:wallet,amount:'1000000'},f.token)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);assert.equal(f.sent.length,1);
    assert.equal((await f.request('/account',undefined,f.token)).body.balance,(BigInt(before)-1_000_000n).toString());
  });
}

test('SEC-S19 uncertain withdraw send retains debit instead of granting unsafe retry credit',async t=>{
  const f=await fixture(t);const before=(await f.request('/account',undefined,f.token)).body.balance;let attempts=0;
  f.chain.send=async()=>{attempts++;throw new Error('Synthetic ambiguous RPC result after send');};
  const result=await f.request('/account/withdraw',{to:wallet,amount:'1000000'},f.token);
  assert.equal(result.status,502);assert.equal(attempts,1);
  assert.equal((await f.request('/account',undefined,f.token)).body.balance,(BigInt(before)-1_000_000n).toString());
});
