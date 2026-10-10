import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Store, opaque, digest, hashPassword, checkPassword, type User, type Session, type Challenge } from './store.ts';
import { address, hex, integer, normalizeTx, classifyTransaction, requireThat, ApiError, MODULES, ZERO, USDC } from './policy.ts';
import { hashMessage } from 'viem';
import { RegistrationError, registrationContext, withRegistrationReads, registrationRead, classifiedRegistrationRead, parseMinimumBlock, registrationUnavailable, assertRegistrationActive, recheckRegistrationBlock } from './registration-reads.ts';
import { strictSponsorship, strictClassification, transactionCalls, callAddresses, derivefreezeSubjects, refuse } from './policy.ts';
import { screenAddresses } from './screening.ts';
import { DAPP_REGISTRY, DAPP_ADDRESSES, checkDappBatch, describeEffects, simulateCalls, revalidateSimulation, DappSimulationError } from '@sq/protocol';
import { verifyWebAuthn } from './webauthn.ts';
import { decodeSetupCode, ownershipProofText, encodeCode, buildWalletInitializer } from '@sq/protocol';
import { ChainPrebroadcastError, type AppOptions, type Address, type Setup, type ChainOperation, type PasskeyCredential, type Recovery } from './types.ts';
export { classifyTransaction } from './policy.ts';
export type * from './types.ts';
export { createViemChain } from './chain.ts';
export { createWebAuthn } from './webauthn.ts';
interface LinkedWallet {clientId:string;setup:Setup & {wallet:Address};verified:boolean;currentOwner?:Address}
interface StepUp {userId:string;hash:string;expires:number}
class PreflightError extends ApiError {}
class BroadcastUncertainError extends Error {}
export function createApp(options:AppOptions={}) {
  const store=new Store(options.databasePath??join(options.dataDir??'data/swissquote','swissquote.sqlite'));
  const now=options.now??Date.now; const mock=options.allowMock??false; const modules=(options.modules??MODULES).map(v=>v.toLowerCase());
  const chain=()=> {requireThat(options.chain,'Chain adapter not configured',503); return options.chain;};
  const webauthn=()=> {requireThat(options.webauthn,'WebAuthn adapter not configured',503); return options.webauthn;};
  const credentials=(id:string)=>store.get<PasskeyCredential[]>('passkeys',id)??[];
  const getUser=(id:string)=> {const user=store.get<User>('user',id); requireThat(user,'Unknown account',401); return user;};
  const issueSession=(user:User,method:Session['method'])=> {const token=opaque(); store.put('session',digest(token),{userId:user.id,method,expires:now()+8*3600_000}); return {token,clientId:user.id,userRef:user.id,authMethod:method,kycVerified:user.kyc};};
  const session=(req:IncomingMessage)=> {const match=/^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization??''); requireThat(match,'Login required',401); const value=store.get<Session>('session',digest(match[1])); requireThat(value&&value.expires>now(),'Session expired',401); return {session:value,user:getUser(value.userId)};};
  const owned=(user:User,wallet:Address)=> {const linked=store.get<LinkedWallet>('wallet',wallet); requireThat(linked?.clientId===user.id&&linked.verified,'Wallet is not verified for this client',403); return linked;};
  const kyc=(user:User)=>requireThat(user.kyc,'MOCK KYC verification required',403);
  const challenge=(id:unknown,purpose:string,userId?:string)=> {requireThat(typeof id==='string','Missing challengeId'); const item=store.get<Challenge>('challenge',id); requireThat(item&&item.expires>now()&&item.purpose===purpose&&(!userId||item.userId===userId),'Challenge expired or invalid',401); store.delete('challenge',id); return item;};
  const flags=(options.features??(process.env.SQ_FEATURES??'').split(',')).map(v=>v.trim()).filter(Boolean);const strict=strictSponsorship({...options,features:flags});
  const screen=(addresses:readonly Address[],cancel=false,freezeSubjects?:readonly Address[])=>screenAddresses(addresses,cancel?(options.screeningSources??[]).filter(s=>s.kind!=='freeze'):options.screeningSources??[],options.sanctions??[],now(),freezeSubjects);
  const enforceScreen=async(addresses:readonly Address[],cancel=false,freezeSubjects?:readonly Address[])=> {const result=await screen(addresses,cancel,freezeSubjects);if(result.hits.length) refuse('SANCTIONS_BLOCK','Screening positive hit: sponsorship blocked');if(!cancel&&!result.ok) refuse('SCREENING_UNAVAILABLE','Required screening unavailable or stale');return result;};
  const dappCalls=(wallet:Address,tx:import('./types.ts').SafeTx,dappId:unknown)=> {const calls=transactionCalls(tx,options);const check=checkDappBatch(wallet,calls);if(!check.ok||typeof dappId!=='string'||check.dappId!==dappId) refuse('NOT_SPONSORED',check.reasons.join('; ')||'dApp registry mismatch');return calls;};
  const publicSepolia=options.chain?.chainId===11155111;
  interface SenderIntent {id:string;operation:ChainOperation;state:'uncertain'|'pending';txHash?:`0x${string}`;gas:string;createdAt:number}
  const senderKey='11155111:global';
  const reconcileSender=async()=> {
    const intent=store.get<SenderIntent>('sender-latch',senderKey);
    if(!intent) return;
    if(!intent.txHash||!chain().receiptStatus) return intent;
    let receipt:import('./types.ts').ReceiptStatus;
    try {receipt=await chain().receiptStatus!(intent.txHash);} catch {return intent;}
    if((receipt.status!=='confirmed'&&receipt.status!=='reverted')||typeof receipt.blockNumber!=='string'||!/^\d+$/.test(receipt.blockNumber)) return intent;
    store.transaction(()=> {
      // Another instance sharing this database may have reconciled and reserved a new send while RPC awaited.
      if(store.get<SenderIntent>('sender-latch',senderKey)?.id!==intent.id) return;
      store.put('sender-settlement',intent.id,{txHash:intent.txHash,...receipt});store.put('receipt-settlement',intent.txHash!,receipt);store.put('sender-status',senderKey,{txHash:intent.txHash,...receipt});store.delete('sender-latch',senderKey);
    });
    return store.get<SenderIntent>('sender-latch',senderKey);
  };
  const refreshResult=async(result:unknown)=> {
    const value=result as {txHash?:`0x${string}`;status?:string};
    if(!publicSepolia||!value.txHash||!chain().receiptStatus) return result;
    await serialize(reconcileSender);
    const settled=store.get<import('./types.ts').ReceiptStatus>('receipt-settlement',value.txHash);
    if(settled) return {...value,...settled};
    try {const receipt=await chain().receiptStatus!(value.txHash);return {...value,...(receipt.status==='confirmed'||receipt.status==='reverted'?receipt:{status:'pending'})};} catch {return {...value,status:'pending'};}
  };
  let queue:Promise<unknown>=Promise.resolve();
  const serialize=<T>(fn:()=>Promise<T>):Promise<T>=> {const result=queue.then(fn,fn); queue=result.catch(()=>undefined); return result;};
  const relay=async(operation:ChainOperation,user:User|undefined,protective=false,beforeSend?:()=>Promise<void>)=>serialize(async()=> {
    if(publicSepolia) {
      requireThat(chain().receiptStatus,'Sepolia receipt status API required; nothing broadcast',503);
      const pending=await reconcileSender();
      if(operation.kind!=='withdraw'&&pending?.txHash&&JSON.stringify(pending.operation)===JSON.stringify(operation)) return {txHash:pending.txHash,transactionHash:pending.txHash,gas:pending.gas,status:'pending'};
      requireThat(!pending,pending?.txHash?'Previous submission is pending; sender blocked until receipt':'Previous submission is uncertain; sender blocked until proven settlement',409);
    }
    const day=Math.floor(now()/86400_000).toString(); const globalKey=day; const accountKey=`${day}:${user?.id}`;
    const global=store.get<number>('global-budget',globalKey)??0; const account=store.get<number>('account-budget',accountKey)??0;
    // Exact owner cancel bypasses the normal global fee budget; finalization does not.
    const ownerCancel=protective&&operation.kind==='safe-tx';
    if(!ownerCancel) requireThat(global<(options.globalDailyLimit??1000),'Global relayer daily cap reached',429);
    if(!protective) {requireThat(user,'Login required',401); kyc(user); requireThat(account<(options.accountDailyLimit??50),'Account relayer daily budget reached',429);}
    if(strict&&operation.kind!=='safe-tx') {
      const addresses=operation.kind==='deploy'?[operation.setup.owner,operation.setup.cardGuardian,operation.setup.partnerGuardian,operation.setup.sqGuardian]:operation.kind==='withdraw'?[operation.to]:operation.kind==='recovery'?[operation.request.wallet,operation.request.module,operation.request.newOwner]:[operation.wallet,operation.module];
      await enforceScreen(addresses);
    }
    let estimate:bigint;
    try {await chain().simulate(operation);estimate=await chain().estimateGas(operation);} catch {throw new PreflightError(502,'Chain preflight refused transaction; nothing broadcast');}
    requireThat(estimate>0n,'Invalid gas estimate',502);
    const gas=(estimate*120n+99n)/100n; requireThat(gas<=(options.gasCap??15_000_000n),'Transaction gas cap exceeded',403);
    await beforeSend?.();
    // Charge the attempt before broadcast, conservatively retaining budget on uncertain RPC outcomes.
    const intent:SenderIntent={id:randomUUID(),operation,state:'uncertain',gas:gas.toString(),createdAt:now()};
    store.transaction(()=> {
      if(publicSepolia) {requireThat(!store.get('sender-latch',senderKey),'Previous submission is uncertain; sender blocked until proven settlement',409);store.put('sender-latch',senderKey,intent);}
      if(!ownerCancel) store.put('global-budget',globalKey,global+1); if(!protective) store.put('account-budget',accountKey,account+1);
    });
    let txHash:`0x${string}`;
    try {txHash=await chain().send(operation,gas);} catch(error) {
      if(error instanceof ChainPrebroadcastError) {
        if(publicSepolia) store.delete('sender-latch',senderKey);
        throw new PreflightError(error.status,error.message);
      }
      // Do NOT throw ApiError here: callers only roll back reservations for proven pre-broadcast failures.
      throw new BroadcastUncertainError('Uncertain chain broadcast outcome; sender blocked until proven settlement');
    }
    if(publicSepolia) {
      store.put('sender-latch',senderKey,{...intent,state:'pending',txHash});
      await reconcileSender();
      const settled=store.get<{status:'confirmed'|'reverted';blockNumber:string}>('sender-settlement',intent.id);
      return {txHash,transactionHash:txHash,gas:gas.toString(),...(settled??{status:'pending'})};
    }
    return {txHash,transactionHash:txHash,gas:gas.toString()};
  });
  async function route(req:IncomingMessage,path:string,body:Record<string,unknown>):Promise<unknown> {
    const post=req.method==='POST';
    if(req.method==='GET'&&path==='/health') return {ok:true,service:'swissquote',mock,chainId:options.chain?.chainId,features:flags,strictSponsorship:strict};
    if(req.method==='GET'&&path==='/relay/status') return serialize(async()=> {
      const pending=publicSepolia?await reconcileSender():undefined;
      const settled=store.get('sender-status',senderKey);
      return {chainId:chain().chainId,blocked:!!pending,status:pending?.state??'idle',...(pending?.txHash?{txHash:pending.txHash}:{}),lastSettlement:settled};
    });
    if(post&&path==='/screen') {requireThat(Array.isArray(body.addresses)&&body.addresses.length>0&&body.addresses.length<=64,'Expected 1–64 addresses');return screen(body.addresses.map(address));}
    if(req.method==='GET'&&path==='/dapps') return {dapps:DAPP_REGISTRY};
    if(post&&path==='/dapps/preview') {
      const user=session(req).user;kyc(user);const wallet=address(body.wallet);owned(user,wallet);requireThat(body.tx&&typeof body.tx==='object','Missing transaction');const tx=normalizeTx(body.tx as Record<string,unknown>);
      requireThat(tx.safeTxGas==='0'&&tx.baseGas==='0'&&tx.gasPrice==='0'&&tx.gasToken===ZERO&&tx.refundReceiver===ZERO,'Safe gas/refund fields must be zero');
      const calls=dappCalls(wallet,tx,body.dappId);const screening=await enforceScreen([...callAddresses(wallet,tx,options),...Object.values(DAPP_ADDRESSES)],false,derivefreezeSubjects(wallet,tx,options));
      const fresh=await simulateCalls(options.simulationClients??[],wallet,calls);
      store.put('audit',randomUUID(),{at:new Date(now()).toISOString(),path,decision:'preview',flags,wallet,safeTxHash:await chain().safeTxHash(wallet,tx),effectsHash:fresh.effectsHash,sources:screening.sources});
      return {summary:describeEffects(fresh.effects),effectsHash:fresh.effectsHash,blockNumber:fresh.blockNumber,dappId:body.dappId,warnings:DAPP_REGISTRY.filter(d=>d.id===body.dappId).map(d=>d.warning)};
    }
    if(post&&path==='/auth/password/register') {
      requireThat(typeof body.email==='string'&&body.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email),'Invalid email');
      requireThat(typeof body.password==='string'&&body.password.length>=12&&body.password.length<=1024,'Password must have 12–1024 characters');
      const email=body.email.trim().toLowerCase(); requireThat(!store.get('email',email),'Account already exists',409);
      const user:User={id:randomUUID(),email,password:hashPassword(body.password),kyc:false,resetAt:null,balance:options.initialMockBalance??(options.chain?.chainId===11155111?'1000000':'20000000')};
      store.transaction(()=>{store.put('user',user.id,user);store.put('email',email,user.id);}); return issueSession(user,'password');
    }
    if(post&&path==='/auth/password/login') {
      requireThat(typeof body.email==='string'&&typeof body.password==='string'&&body.password.length<=1024,'Invalid credentials',401);
      const id=store.get<string>('email',body.email.trim().toLowerCase()); const user=id?getUser(id):undefined;
      requireThat(user&&checkPassword(body.password,user.password),'Invalid credentials',401); return issueSession(user,'password');
    }
    if(post&&path==='/auth/password/reset-request') {
      requireThat(mock,'MOCK mailbox disabled',403); requireThat(typeof body.email==='string','Invalid email');
      const id=store.get<string>('email',body.email.trim().toLowerCase());
      if(id) {const token=opaque(); store.put('reset',digest(token),{userId:id,expires:now()+15*60_000}); const mailId=randomUUID(); store.put('mail',mailId,{email:body.email,token,resetToken:token,subject:'MOCK password reset',createdAt:new Date(now()).toISOString(),mock:true,label:'MOCK password reset mailbox'});}
      return {ok:true,mock:true,message:'If the account exists, a reset link was sent to the MOCK mailbox.'};
    }
    if(post&&path==='/auth/password/reset') {
      requireThat(typeof body.token==='string'&&typeof body.password==='string'&&body.password.length>=12&&body.password.length<=1024,'Invalid password reset');
      const key=digest(body.token); const reset=store.get<{userId:string;expires:number}>('reset',key); requireThat(reset&&reset.expires>now(),'Reset link expired or used',401);
      const user=getUser(reset.userId); user.password=hashPassword(body.password); user.resetAt=now();
      store.transaction(()=>{store.put('user',user.id,user);store.delete('reset',key);for(const row of store.all<Session>('session')) if(row.value.userId===user.id) store.delete('session',row.id); for(const row of store.all<StepUp>('stepup')) if(row.value.userId===user.id) store.delete('stepup',row.id);for(const row of store.all<Challenge>('challenge')) if(row.value.userId===user.id) store.delete('challenge',row.id);for(const row of store.all<{userId:string}>('reset')) if(row.value.userId===user.id) store.delete('reset',row.id);});
      return {ok:true,mock:true,recoveryHoldHours:72};
    }
    if(req.method==='GET'&&path==='/mock/mailbox') {requireThat(mock,'MOCK mailbox disabled',403); return {mock:true,label:'MOCK mailbox — local demo only',messages:store.all('mail').map(row=>({id:row.id,...row.value as object}))};}
    if(post&&path==='/auth/passkey/login/options') {
      requireThat(typeof body.email==='string','Email required'); const id=store.get<string>('email',body.email.toLowerCase()); requireThat(id,'Passkey account not found',401);
      const items=credentials(id);requireThat(items.length,'No registered passkey',401); const value=await webauthn().authenticationOptions(items); const challengeId=opaque();
      store.put('challenge',challengeId,{userId:id,purpose:'login',challenge:value.challenge,expires:now()+300_000}); return {...value,challengeId,options:value};
    }
    if(post&&path==='/auth/passkey/login/verify') {const item=challenge(body.challengeId,'login'); const verified=await verifyWebAuthn(()=>webauthn().verifyAuthentication(body.response,item.challenge,credentials(item.userId))); updateCredential(item.userId,verified);return issueSession(getUser(item.userId),'passkey');}
    // Cancellation and finalization do not depend on a session or a bank identity record.
    if(post&&path==='/relay/finalize') {const wallet=address(body.wallet);const module=address(body.module);requireThat(modules.includes(module),'Unknown recovery module');return relay({kind:'finalize',wallet,module},undefined,true);}
    if(post&&path==='/relay/safe-tx') {
      if(body.chainId!==undefined) requireThat(body.chainId===chain().chainId,'Request chain mismatch');
      const wallet=address(body.wallet);requireThat(body.tx&&typeof body.tx==='object','Missing transaction');const tx=normalizeTx(body.tx as Record<string,unknown>);const signature=hex(body.signature);
      requireThat(tx.safeTxGas==='0'&&tx.baseGas==='0'&&tx.gasPrice==='0'&&tx.gasToken===ZERO&&tx.refundReceiver===ZERO,'Safe gas/refund fields must be zero');
      const classification=strict?await strictClassification(wallet,tx,options):await classifyTransaction(wallet,tx,options);let user:User|undefined;
      if(classification!=='Protective') {user=session(req).user;kyc(user);owned(user,wallet);}
      const hash=await chain().safeTxHash(wallet,tx);
      const key=`${wallet}:${tx.nonce}`;const prior=store.get<{hash:string;result?:unknown}>('safe-submission',key);
      if(publicSepolia&&prior) {
        requireThat(prior.hash===hash,'Different transaction already submitted at this Safe nonce',409);
        if(prior.result) return refreshResult(prior.result);
        const pending=store.get<SenderIntent>('sender-latch',senderKey);
        if(pending?.txHash&&pending.operation.kind==='safe-tx'&&pending.operation.wallet===wallet&&pending.operation.tx.nonce===tx.nonce) return refreshResult({txHash:pending.txHash,transactionHash:pending.txHash,gas:pending.gas,status:'pending',hash,classification});
        throw new ApiError(409,'Previous submission is uncertain; inspect chain before retry');
      }
      requireThat(await chain().safeNonce(wallet)===tx.nonce,'Stale Safe nonce',409);requireThat(await chain().verifyOwnerSignature(wallet,tx,signature),'Invalid current owner signature',403);
      store.put('audit',randomUUID(),{at:new Date(now()).toISOString(),path,decision:'owner-signature-verified',flags,strictSponsorship:strict,wallet,safeTxHash:hash,effectsHash:body.effectsHash});
      if(classification==='Admin'||classification==='Large') {
        if(classification==='Admin') requireThat(body.source==='settings','Admin actions allowed only from Settings',403);
        requireThat(typeof body.stepUpToken==='string','Transaction-bound passkey required',403);const key=digest(body.stepUpToken);const approval=store.get<StepUp>('stepup',key);
        requireThat(approval&&approval.userId===user?.id&&approval.hash.toLowerCase()===hash.toLowerCase()&&approval.expires>now(),'Passkey approval expired, consumed or bound to another transaction',403);store.delete('stepup',key);
      }
      const isDapp=body.source==='dapp'||body.dappId!==undefined||body.effectsHash!==undefined;
      const calls=isDapp?dappCalls(wallet,tx,body.dappId):undefined;
      if(strict&&classification!=='Protective'&&classification!=='Admin'&&transactionCalls(tx,options).some(c=>!c.data.startsWith('0xa9059cbb'))&&!calls) refuse('NOT_SPONSORED','Listed dApp calls require reviewed effectsHash');
      if(calls) {requireThat(body.source==='dapp','dApp source required',403);requireThat(typeof body.effectsHash==='string'&&/^0x[0-9a-fA-F]{64}$/.test(body.effectsHash),'Reviewed effectsHash required',403);}
      const screening=(strict||classification==='Protective')?await enforceScreen(classification==='Protective'?[wallet]:[...callAddresses(wallet,tx,options),...(calls?Object.values(DAPP_ADDRESSES):[])],classification==='Protective',classification==='Protective'?undefined:derivefreezeSubjects(wallet,tx,options)):undefined;
      // Reserve this nonce before any asynchronous broadcast. Never retry an uncertain send automatically.
      // Recheck after asynchronous authorization: another request may have reserved this nonce.
      const raced=store.get<{hash:string;result?:unknown}>('safe-submission',key);
      if(raced) {requireThat(raced.hash===hash,'Different transaction already submitted at this Safe nonce',409);requireThat(raced.result,'Previous submission is uncertain; inspect chain before retry',409);return refreshResult(raced.result);}
      store.put('safe-submission',key,{hash});
      try {const result={...await relay({kind:'safe-tx',wallet,tx,signature},user,classification==='Protective',calls?async()=>{try {await revalidateSimulation(options.simulationClients??[],wallet,calls,body.effectsHash as `0x${string}`);} catch(error) {if(error instanceof DappSimulationError) refuse(error.code==='SIMULATION_UNAVAILABLE'?'NOT_SPONSORED':error.code,error.message);throw error;}}:undefined),classification,hash,screening};store.put('safe-submission',key,{hash,result});return result;} catch(error) { // A simulation failure is safe to retry; an uncertain send remains reserved.
        if(error instanceof ApiError) store.delete('safe-submission',key);throw error;
      }
    }
    const {user,session:auth}=session(req);
    if(post&&path==='/auth/passkey/register/options') { // First passkey requires the current password session; adding one later needs a passkey login.
      requireThat(credentials(user.id).length===0||auth.method==='passkey','Existing passkey login required to enroll another passkey',403);
      requireThat(user.resetAt===null||auth.method==='passkey'||now()-user.resetAt>=72*3600_000,'Passkey enrollment held after password reset',403);
      const value=await webauthn().registrationOptions(user,credentials(user.id));const challengeId=opaque();store.put('challenge',challengeId,{userId:user.id,purpose:'register',challenge:value.challenge,expires:now()+300_000});return {...value,challengeId,options:value};
    }
    if(post&&path==='/auth/passkey/register/verify') {const item=challenge(body.challengeId,'register',user.id); const credential=await verifyWebAuthn(()=>webauthn().verifyRegistration(body.response,item.challenge));requireThat(!store.all<PasskeyCredential[]>('passkeys').some(row=>row.value.some(c=>c.id===credential.id)),'Credential already enrolled',409);store.put('passkeys',user.id,[...credentials(user.id),credential]);return issueSession(user,'passkey');}
    if(post&&path==='/auth/passkey/step-up/options') {
      const hash=hex(body.safeTxHash??body.hash);requireThat(hash.length===66,'Safe transaction hash must be 32 bytes');requireThat(credentials(user.id).length,'Registered passkey required',403);
      const boundChallenge=Buffer.from(hash.slice(2),'hex').toString('base64url');const value=await webauthn().authenticationOptions(credentials(user.id),boundChallenge);requireThat(value.challenge===boundChallenge,'WebAuthn challenge must bind transaction hash',500);
      const challengeId=opaque();store.put('challenge',challengeId,{userId:user.id,purpose:'stepup',challenge:boundChallenge,hash,expires:now()+120_000});return {...value,challengeId,hash,safeTxHash:hash,options:value};
    }
    if(post&&path==='/auth/passkey/step-up/verify') {const item=challenge(body.challengeId,'stepup',user.id);const verified=await verifyWebAuthn(()=>webauthn().verifyAuthentication(body.response,item.challenge,credentials(user.id)));updateCredential(user.id,verified);requireThat(item.hash,'Missing bound transaction hash',403);if(body.safeTxHash!==undefined) requireThat(hex(body.safeTxHash)===item.hash,'Step-up hash mismatch',403);const stepUpToken=opaque();store.put('stepup',digest(stepUpToken),{userId:user.id,hash:item.hash,expires:now()+120_000});return {stepUpToken,hash:item.hash,safeTxHash:item.hash};}
    if(post&&path==='/kyc/mock-verify') {requireThat(mock,'MOCK KYC disabled',403);if((options.mockSecoBlockedEmails??[]).map(v=>v.toLowerCase()).includes(user.email.toLowerCase())) refuse('SANCTIONS_BLOCK','MOCK SECO client-name fixture hit (not a real SECO check)');user.kyc=true;store.put('user',user.id,user);return {verified:true,kycVerified:true,mock:true,label:'MOCK KYC + MOCK SECO name check (not real sanctions screening)'};}
    if(post&&path==='/demo/fooled') {requireThat(typeof body.enabled==='boolean','Expected enabled boolean');requireThat(body.enabled===false,'Signing-enabled fooled demo is disabled',403);requireThat(mock,'MOCK demo disabled',403);store.delete('fooled',user.id);return {enabled:false,mock:true};}
    if(post&&path==='/guardian/enroll') {kyc(user);if(!user.guardianKey) {const {generatePrivateKey,privateKeyToAccount}=await import('viem/accounts');user.guardianKey=generatePrivateKey();user.guardian=privateKeyToAccount(user.guardianKey).address.toLowerCase() as Address;store.put('user',user.id,user);}return {guardian:user.guardian,address:user.guardian,userRef:user.id,mock:true,label:'MOCK HSM: software guardian'};}
    if(post&&path==='/wallets/challenge') {kyc(user);const wallet=address(body.wallet);const nonce=opaque();const message=ownershipProofText(user.id,wallet,nonce,chain().chainId);store.put('challenge',nonce,{userId:user.id,purpose:'ownership',challenge:nonce,wallet,message,expires:now()+300_000});return {nonce,message};}
    if(post&&(path==='/wallets'||path==='/relay/deploy')) {
      if(path==='/wallets'&&!registrationContext()) return withRegistrationReads(()=>route(req,path,body),options.registrationClock);
      const minimumBlockNumber=path==='/wallets'?parseMinimumBlock(body.minimumBlockNumber):undefined;
      kyc(user);let input=body;
      if(typeof body.setupCode==='string') {const code=decodeSetupCode(body.setupCode);requireThat(code.chainId===chain().chainId,'Setup chain mismatch');const proof=body.ownershipProof as Record<string,unknown>|undefined;requireThat(proof&&typeof proof==='object','Ownership proof required');input={...code,cardGuardian:body.cardGuardian,nonce:proof.nonce,signature:proof.signature};}
      if(body.chainId!==undefined) requireThat(body.chainId===chain().chainId,'Request chain mismatch');
      const setup=normalizeSetup(input);requireThat(user.guardian&&setup.sqGuardian===user.guardian,'Guardian does not belong to this client',403);
      if(body.initializer!==undefined) requireThat(hex(body.initializer)===buildWalletInitializer({...setup,saltNonce:BigInt(setup.saltNonce)}).toLowerCase(),'Initializer does not match approved template',403);
      const predicted=address(await registrationRead(()=>chain().computeWallet(setup)));if(input.wallet) requireThat(address(input.wallet)===predicted,'Wallet address does not match template',403);setup.wallet=predicted;
      const existing=store.all<LinkedWallet>('wallet').find(row=>row.value.clientId===user.id);requireThat(!existing||existing.id===predicted,'One wallet per account',409);
      const deployed=store.get<string>('deployment',user.id);requireThat(!deployed||deployed===predicted,'One deployment per account',409);
      if(path==='/relay/deploy') {
        const reservation=store.get<{wallet:string;result?:object}>('deployment-reservation',user.id);
        if(reservation) {requireThat(reservation.wallet===predicted,'One deployment per account',409);requireThat(reservation.result,'Deployment already reserved; inspect chain before retry',409);return refreshResult(reservation.result);}
        store.put('deployment-reservation',user.id,{wallet:predicted});
        try {const result={...await relay({kind:'deploy',setup},user),wallet:predicted};store.put('deployment',user.id,predicted);store.put('deployment-reservation',user.id,{wallet:predicted,result});return result;}
        catch(error) {if(error instanceof ApiError) store.delete('deployment-reservation',user.id);throw error;}
      }
      const linked=store.get<LinkedWallet>('wallet',predicted);
      if(linked) requireThat(linked.clientId===user.id&&sameSetup(linked.setup,setup),'Original wallet setup is immutable',403);
      const currentOwner=body.expectedCurrentOwner===undefined?(linked?.currentOwner??setup.owner):address(body.expectedCurrentOwner);
      requireThat(currentOwner!==ZERO&&currentOwner!=='0x0000000000000000000000000000000000000001'&&currentOwner!==predicted&&![setup.cardGuardian,setup.partnerGuardian,setup.sqGuardian].includes(currentOwner),'Invalid expected current owner',403);
      const item=challenge(input.nonce,'ownership',user.id);requireThat(item.wallet===predicted,'Proof challenge is bound to another wallet',403);
      if(body.ownershipProof) {const proof=body.ownershipProof as Record<string,unknown>;requireThat(proof.message===item.message&&hex(proof.hash)===hashMessage(item.message!),'Ownership proof message/hash mismatch',403);}
      // Never derive the expectation from RPC owners or login. Exact rules and a
      // fresh current-owner EIP-1271 proof must both pass before persisting it.
      const originalSetup=linked?.setup??(setup as Setup & {wallet:Address});
      if(typeof chain().registrationBlock!=='function') throw registrationUnavailable('registration_capability_missing');
      let blockNumber:bigint;
      try {blockNumber=await registrationRead(()=>chain().registrationBlock(minimumBlockNumber));} catch(error) {if(error instanceof ApiError) throw error;throw registrationUnavailable();}
      if(typeof blockNumber!=='bigint'||blockNumber<0n||(minimumBlockNumber!==undefined&&blockNumber<minimumBlockNumber)) throw registrationUnavailable();
      const rules=await classifiedRegistrationRead(()=>chain().verifyWallet(originalSetup,{expectedCurrentOwner:currentOwner,blockNumber}));
      if(!rules) throw new RegistrationError(403,'Wallet rules do not match template','registration_rules_refused');
      const proof=await classifiedRegistrationRead(()=>chain().verifyOwnership(predicted,item.message!,hex(input.signature),{blockNumber}));
      if(!proof) throw new RegistrationError(403,'Invalid EIP-1271 ownership proof','registration_proof_refused');
      await recheckRegistrationBlock();
      assertRegistrationActive();
      store.transaction(()=> {
        assertRegistrationActive();
        const current=store.get<LinkedWallet>('wallet',predicted);
        requireThat(!current||(current.clientId===user.id&&sameSetup(current.setup,originalSetup)&&current.currentOwner===linked?.currentOwner),'Wallet verification changed; use a fresh challenge',409);
        store.put('wallet',predicted,{clientId:user.id,setup:current?.setup??originalSetup,verified:true,currentOwner});
      });
      return {wallet:predicted,owner:currentOwner,verified:true,clientId:user.id,chainId:chain().chainId};
    }
    if(req.method==='GET'&&path.startsWith('/wallets/')) {const wallet=address(path.slice('/wallets/'.length));const linked=owned(user,wallet);const setupCode=encodeCode({v:1,kind:'setup',chainId:chain().chainId,wallet,owner:linked.setup.owner,partnerGuardian:linked.setup.partnerGuardian,sqGuardian:linked.setup.sqGuardian,saltNonce:linked.setup.saltNonce.toString()});return {wallet,owner:linked.currentOwner??linked.setup.owner,verified:linked.verified,clientId:user.id,chainId:chain().chainId,setupCode,cardGuardian:linked.setup.cardGuardian};}
    if(req.method==='GET'&&path==='/account') return {clientId:user.id,balance:user.balance,token:options.usdc??USDC,address:options.accountAddress??ZERO,currency:'USDC',decimals:6,mock:true,label:'MOCK Swissquote account',verifiedWallets:store.all<LinkedWallet>('wallet').filter(row=>row.value.clientId===user.id).map(row=>row.id)};
    if(post&&path==='/account/withdraw') {
      requireThat(mock,'MOCK account disabled',403);kyc(user);const to=address(body.to);const linked=store.get<LinkedWallet>('wallet',to);
      requireThat(linked?.verified&&linked.clientId===user.id,'Blocked until Swissquote verifies who owns it (Travel Rule)',403);requireThat(await chain().verifyWallet(linked.setup,{expectedCurrentOwner:linked.currentOwner??linked.setup.owner}),'Wallet rules changed; verification required',403);
      const amount=integer(body.amount);requireThat(BigInt(amount)>0n,'Amount must be positive');
      if(strict) await enforceScreen([to]);
      // Reserve balance atomically before awaiting a chain call; restore only on definite preflight failures.
      store.transaction(()=>{const current=getUser(user.id);requireThat(BigInt(current.balance)>=BigInt(amount),'Insufficient MOCK account balance');const paid=BigInt(store.get<string>('mock-payout','total')??'0');requireThat(paid+BigInt(amount)<=BigInt(options.mockPayoutCap??'100000000'),'MOCK payout cap reached',429);store.put('mock-payout','total',(paid+BigInt(amount)).toString());current.balance=(BigInt(current.balance)-BigInt(amount)).toString();store.put('user',user.id,current);});
      try {const result=await relay({kind:'withdraw',to,amount},user);return {...result,mock:true,amount,to};}
      catch(error) {if(error instanceof ApiError) store.transaction(()=>{const current=getUser(user.id);current.balance=(BigInt(current.balance)+BigInt(amount)).toString();store.put('user',user.id,current);store.put('mock-payout','total',(BigInt(store.get<string>('mock-payout','total')??'0')-BigInt(amount)).toString());});throw error;}
    }
    if(post&&(path==='/recovery/approve'||path==='/relay/recovery')) {
      kyc(user);const request=normalizeRecovery(body);owned(user,request.wallet);
      if(path==='/relay/recovery') {requireThat(Array.isArray(body.approvals)&&body.approvals.length>0&&body.approvals.length<=10,'Missing recovery approvals');request.approvals=body.approvals.map(value=>{const item=value as Record<string,unknown>;return {signer:address(item.signer),signature:hex(item.signature)};}).sort((a,b)=>BigInt(a.signer)<BigInt(b.signer)?-1:1);requireThat(new Set(request.approvals.map(v=>v.signer)).size===request.approvals.length,'Duplicate approval signer');await chain().recoveryHash(request);return relay({kind:'recovery',request},user);}
      requireThat(request.module===modules[1],'Swissquote approves module B only',403);requireThat(user.guardianKey&&user.guardian,'Guardian enrollment required',403);
      if(auth.method!=='passkey') {requireThat(user.resetAt!==null&&now()-user.resetAt>=72*3600_000,'Password reset recently: recovery needs a passkey login, or a 72-hour hold plus video ID (MOCK)',403);requireThat(mock&&body.mockVideoId===true,'Recovery requires passkey login or video ID (MOCK)',403);}
      requireThat(await chain().isGuardian(request.wallet,request.module,user.guardian),'Swissquote key is not a guardian',403);const hash=await chain().recoveryHash(request);const signature=await chain().signRecovery(request,user.guardianKey);return {signer:user.guardian,signature,hash,mock:true,request:{...request,chainId:chain().chainId},approvalCode:encodeCode({v:1,kind:'approval',chainId:chain().chainId,signer:user.guardian,signature})};
    }
    throw new ApiError(404,'Route not found');
  }
  function updateCredential(id:string,verified:{id:string;counter:number}) {const items=credentials(id);const item=items.find(v=>v.id===verified.id);requireThat(item,'Unknown credential',403);requireThat((item.counter===0&&verified.counter===0)||verified.counter>item.counter,'Passkey counter did not advance',403);item.counter=verified.counter;store.put('passkeys',id,items);}
  function sameSetup(a:Setup,b:Setup):boolean {return a.owner===b.owner&&a.cardGuardian===b.cardGuardian&&a.partnerGuardian===b.partnerGuardian&&a.sqGuardian===b.sqGuardian&&a.saltNonce===b.saltNonce&&a.wallet===b.wallet;}
  function normalizeSetup(body:Record<string,unknown>):Setup {const setup:Setup={owner:address(body.owner),cardGuardian:address(body.cardGuardian),partnerGuardian:address(body.partnerGuardian),sqGuardian:address(body.sqGuardian),saltNonce:integer(body.saltNonce)};requireThat(new Set([setup.owner,setup.cardGuardian,setup.partnerGuardian,setup.sqGuardian]).size===4,'Owner and guardians must differ');requireThat(![setup.owner,setup.cardGuardian,setup.partnerGuardian,setup.sqGuardian].includes(ZERO),'Zero owner or guardian');return setup;}
  function normalizeRecovery(body:Record<string,unknown>):Recovery {if(body.chainId!==undefined) requireThat(body.chainId===chain().chainId,'Recovery chain mismatch');const request={wallet:address(body.wallet),module:address(body.module),newOwner:address(body.newOwner),nonce:integer(body.nonce)};requireThat(modules.includes(request.module),'Unknown recovery module');requireThat(request.newOwner!==ZERO,'Zero new owner');return request;}
  const attempts=new Map<string,{window:number;count:number}>();
  async function handler(req:IncomingMessage,res:ServerResponse):Promise<void> {
    const origin=req.headers.origin;const origins=options.allowedOrigins??['http://localhost:5173','http://127.0.0.1:5173'];
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(origin&&origins.includes(origin)) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
    let auditPath='';let auditBody:Record<string,unknown>={};
    try {
      requireThat(!origin||origins.includes(origin),'Origin not allowed',403);if(req.method==='OPTIONS') {res.statusCode=204;res.end();return;}
      const path=new URL(req.url??'/','http://localhost').pathname;
      if(path.startsWith('/auth/')) {const key=req.socket.remoteAddress??'local';const bucket=attempts.get(key);const value=!bucket||now()-bucket.window>=60_000?{window:now(),count:0}:bucket;value.count++;attempts.set(key,value);requireThat(value.count<=60,'Authentication rate limit',429);}
      let body:Record<string,unknown>={};if(req.method==='POST') {requireThat((req.headers['content-type']??'').startsWith('application/json'),'Content-Type application/json required',415);let length=0;const chunks:Buffer[]=[];for await(const chunk of req) {const bytes=Buffer.from(chunk);length+=bytes.length;requireThat(length<=128*1024,'Request too large',413);chunks.push(bytes);}try {body=JSON.parse(Buffer.concat(chunks).toString()||'{}') as Record<string,unknown>;} catch {throw new ApiError(400,'Invalid JSON');}requireThat(body&&typeof body==='object'&&!Array.isArray(body),'Expected JSON object');}
      auditPath=path;auditBody=body;const result=await route(req,path,body);store.put('audit',randomUUID(),{at:new Date(now()).toISOString(),path,decision:'allowed',flags,strictSponsorship:strict,wallet:body.wallet,effectsHash:body.effectsHash,safeTxHash:(result as {hash?:string})?.hash});res.statusCode=200;res.end(JSON.stringify(result));
    } catch(error) {const code=error instanceof RegistrationError?error.registrationCode:error instanceof ApiError?error.code:error instanceof DappSimulationError?(error.code==='SIMULATION_UNAVAILABLE'?'NOT_SPONSORED':error.code):undefined;const reason=error instanceof ApiError||error instanceof DappSimulationError||error instanceof BroadcastUncertainError?error.message:'Operation failed; inspect local service and chain configuration';store.put('audit',randomUUID(),{at:new Date(now()).toISOString(),path:auditPath,decision:'refused',flags,strictSponsorship:strict,code,reason,wallet:auditBody.wallet,effectsHash:auditBody.effectsHash});res.statusCode=error instanceof ApiError?error.status:error instanceof DappSimulationError?403:502;res.end(JSON.stringify({error:reason,code}));}
  }
  const server=createServer((req,res)=>{void handler(req,res);});
  return {server,handler,store,close:async()=>{if(server.listening) await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();}};
}
