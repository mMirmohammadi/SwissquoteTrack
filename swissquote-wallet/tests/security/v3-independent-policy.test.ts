import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeFunctionData, encodeFunctionData } from 'viem';
import { ADDRESSES, buildWalletInitializer, decodeMultiSendCall, moduleAbi, safeAbi, makeSafeTx, hashSafeTx, signRecovery, recoveryTypedData, hashSimulationEffects, compoundAbi, routerAbi, dappTokenAbi, DAPP_ADDRESSES as A, checkDappBatch } from '../../packages/protocol/src/index.ts';
import { verifyTypedData } from 'viem';
import { strictClassification, ApiError } from '../../services/swissquote/src/policy.ts';
import { safeTxToWire } from '../../packages/protocol/src/api.ts';
import { helperApproval } from '../../apps/wallet/src/features/recovery/core.ts';
import { createPartnerService } from '../../services/partner/src/service.ts';
import { MemoryPartnerStore } from '../../services/partner/src/storage.ts';

const wallet='0x1111111111111111111111111111111111111111' as const;
const recipient='0x2222222222222222222222222222222222222222' as const;
const owner='0x3333333333333333333333333333333333333333' as const;
const card='0x4444444444444444444444444444444444444444' as const;
const partner='0x5555555555555555555555555555555555555555' as const;
const sq='0x6666666666666666666666666666666666666666' as const;
const call=(to:typeof wallet|string,data:`0x${string}`)=>({to:to as `0x${string}`,data,operation:0 as const,value:0n});
const approve=(spender:`0x${string}`,amount:bigint)=>call(A.usdc,encodeFunctionData({abi:dappTokenAbi,functionName:'approve',args:[spender,amount]}));
const supply=()=>[approve(A.compound,1_000_000n),call(A.compound,encodeFunctionData({abi:compoundAbi,functionName:'supply',args:[A.usdc,1_000_000n]})),approve(A.compound,0n)];

test('V3-I-P01 initializer has owner-only Safe and card mandatory in both exact 2-of-2 guardian sets',()=>{
  const decoded=decodeFunctionData({abi:safeAbi,data:buildWalletInitializer({owner,cardGuardian:card,partnerGuardian:partner,sqGuardian:sq,saltNonce:1n,chainId:11155111})});
  assert.equal(decoded.functionName,'setup'); if(decoded.functionName!=='setup')throw Error('setup expected');
  assert.deepEqual(decoded.args[0],[owner]);assert.equal(decoded.args[1],1n);
  const guardians=decodeMultiSendCall(decoded.args[3]).slice(1).map(c=>({module:c.to.toLowerCase(),...decodeFunctionData({abi:moduleAbi,data:c.data})}));
  assert.deepEqual(guardians.map(g=>[g.module,g.args]),[[ADDRESSES.moduleA.toLowerCase(),[card,1n]],[ADDRESSES.moduleA.toLowerCase(),[partner,2n]],[ADDRESSES.moduleB.toLowerCase(),[card,1n]],[ADDRESSES.moduleB.toLowerCase(),[sq,2n]]]);
});

for(const [name,mutate] of [
  ['unlisted spender',(c:ReturnType<typeof supply>)=>{c[0]=approve(recipient,1_000_000n);}],
  ['overapproval',(c:ReturnType<typeof supply>)=>{c[0]=approve(A.compound,2_000_000n);}],
  ['missing revoke',(c:ReturnType<typeof supply>)=>{c.pop();}],
  ['nonzero final approval',(c:ReturnType<typeof supply>)=>{c[2]=approve(A.compound,1n);}],
  ['extra call',(c:ReturnType<typeof supply>)=>{c.push(call(recipient,'0x1234'));}],
  ['inner delegatecall',(c:ReturnType<typeof supply>)=>{Object.assign(c[1],{operation:1});}],
  ['trailing calldata',(c:ReturnType<typeof supply>)=>{c[1].data=`${c[1].data}00`;}],
] as const) test(`V3-I-P02 strict dapp rejects ${name}`,()=>{const c=supply();mutate(c);const result=checkDappBatch(wallet,c);assert.equal(result.ok,false);assert.equal(result.code,'NOT_SPONSORED');});

test('V3-I-P03 strict swap rejects recipient, fee and minimum-output mutation',()=>{
  const p={tokenIn:A.usdc,tokenOut:A.eurc,fee:500,recipient:wallet,amountIn:1_000_000n,amountOutMinimum:800_000n,sqrtPriceLimitX96:0n};
  const batch=(params:typeof p)=>[approve(A.uniswap,p.amountIn),call(A.uniswap,encodeFunctionData({abi:routerAbi,functionName:'exactInputSingle',args:[params]})),approve(A.uniswap,0n)];
  assert.equal(checkDappBatch(wallet,batch(p)).ok,true);
  for(const mutation of [{recipient},{fee:3000},{amountOutMinimum:1n}])assert.equal(checkDappBatch(wallet,batch({...p,...mutation} as typeof p)).ok,false);
});

test('V3-I-P04 protective class requires exact cancel; trailing bytes/value/target do not bypass',async()=>{
  const cancel=encodeFunctionData({abi:moduleAbi,functionName:'cancelRecovery'});
  const tx=makeSafeTx({to:ADDRESSES.moduleA,data:cancel});
  assert.equal(await strictClassification(wallet,safeTxToWire(tx),{}),'Protective');
  for(const mutation of [{data:`${cancel}00` as `0x${string}`},{value:1n},{to:recipient}])await assert.rejects(strictClassification(wallet,safeTxToWire({...tx,...mutation}),{}),ApiError);
});

test('V3-I-P05 exact Safe hash binds amount, recipient, nonce, wallet and chain',()=>{
  const data=(to:`0x${string}`,amount:bigint)=>`0xa9059cbb${to.slice(2).padStart(64,'0')}${amount.toString(16).padStart(64,'0')}` as const;
  const tx=makeSafeTx({to:A.usdc,data:data(recipient,1_000_000n)});const h=hashSafeTx(wallet,tx);
  for(const changed of [{...tx,data:data(owner,1_000_000n)},{...tx,data:data(recipient,2_000_000n)},{...tx,nonce:1n}])assert.notEqual(hashSafeTx(wallet,changed),h);
  assert.notEqual(hashSafeTx(recipient,tx),h);assert.notEqual(hashSafeTx(wallet,tx,31337),h);
});

test('V3-I-P06 recovery signatures and helper UI validation bind newOwner nonce module wallet chain',async()=>{
  // Fixed public test-only scalar, not a deployment key; never leaves this process.
  const key=`0x${'00'.repeat(31)}01` as const;
  const request={wallet,module:ADDRESSES.moduleA,newOwner:recipient,nonce:0n,chainId:11155111};const approval=await signRecovery(key,request);
  assert.equal(await verifyTypedData({...recoveryTypedData(request),address:approval.signer,signature:approval.signature}),true);
  for(const mutation of [{newOwner:owner},{nonce:1n},{module:ADDRESSES.moduleB},{wallet:recipient},{chainId:31337}]){
    const changed={...request,...mutation};
    assert.equal(await verifyTypedData({...recoveryTypedData(changed),address:approval.signer,signature:approval.signature}),false);
    await assert.rejects(helperApproval(changed,{...approval,request:{...request,nonce:'0'}} as never,approval.signer),/different recovery/);
  }
});

test('V3-I-P08 partner enforces face, nonce/hash and privacy allowlist before any signature',async()=>{
  let signed=0;let snapshotHash=`0x${'ab'.repeat(32)}` as `0x${string}`;
  const service=createPartnerService({store:new MemoryPartnerStore(),chainId:11155111,moduleA:ADDRESSES.moduleA,
    chainReader:{readRecovery:async()=>({chainId:11155111,nonce:0n,guardians:[card,partner],threshold:2n,recoveryHash:snapshotHash})},
    crypto:{generateGuardian:()=>({privateKey:'0x01',address:partner}),hashRecovery:()=>`0x${'ab'.repeat(32)}`,signRecovery:async()=>{signed++;return {signer:partner,signature:'0x1234'};},encodeApproval:()=> 'public-test-approval'}});
  assert.deepEqual(service.enroll({mockFace:'independent face'}),{guardian:partner});
  const request={wallet,newOwner:recipient,module:ADDRESSES.moduleA,chainId:11155111,nonce:'0',mockFace:'independent face'};
  assert.throws(()=>service.enroll({mockFace:'independent face',userRef:'bank-account'}),/Unexpected request field/);
  for(const mutation of [{mockFace:'wrong face'},{nonce:'1'},{module:ADDRESSES.moduleB},{chainId:31337},{userRef:'bank-account'},{privateKey:'not-a-real-key'}])await assert.rejects(service.approve({...request,...mutation}));
  snapshotHash=`0x${'cd'.repeat(32)}`;await assert.rejects(service.approve(request),/hash mismatch/);assert.equal(signed,0);
  assert.throws(()=>service.setDemoFooled({enabled:true}),/signing disabled/);
  snapshotHash=`0x${'ab'.repeat(32)}`;await service.approve(request);assert.equal(signed,1);
});

test('V3-I-P07 reviewed effects hash binds exact calls and observed amounts',()=>{
  const c=supply();const effects=[{target:A.compound,action:'spend',token:A.usdc,recipient:A.compound,amount:'1000000',description:'test'}];
  const h=hashSimulationEffects(wallet,c,effects);assert.notEqual(hashSimulationEffects(wallet,[...c.slice(0,2),approve(A.compound,1n)],effects),h);
  assert.notEqual(hashSimulationEffects(wallet,c,[{...effects[0],amount:'999999'}]),h);
});
