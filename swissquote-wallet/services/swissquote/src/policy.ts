import type { Address, AppOptions, SafeTx } from './types.ts';
import { DAPP_ADDRESSES } from '@sq/protocol';
export const ZERO = '0x0000000000000000000000000000000000000000' as Address;
export const MODULES: readonly Address[] = ['0x949d01d424bE050D09C16025dd007CB59b3A8c66','0x38275826E1933303E508433dD5f289315Da2541c'];
export const USDC:Address='0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const MULTISEND:Address='0x9641d764fc13c8B624c04430C7356C1C7C8102e2';
export class ApiError extends Error { constructor(public status:number,message:string,public code?: import('@sq/protocol').SponsorshipRefusal) { super(message); } }
export function refuse(code: import('@sq/protocol').SponsorshipRefusal, reason:string):never { throw new ApiError(403,reason,code); }
export const strictSponsorship=(options:AppOptions)=> (options.features??(process.env.SQ_FEATURES??'').split(',')).map(v=>v.trim()).includes('strictSponsorship');
export function requireThat(condition:unknown,message:string,status=400): asserts condition { if(!condition) throw new ApiError(status,message); }
export function address(value:unknown):Address { requireThat(typeof value==='string' && /^0x[0-9a-fA-F]{40}$/.test(value),'Invalid address'); return value.toLowerCase() as Address; }
export function hex(value:unknown):`0x${string}` { requireThat(typeof value==='string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(value),'Invalid hex'); return value.toLowerCase() as `0x${string}`; }
export function integer(value:unknown):string { requireThat(typeof value==='string' && /^(0|[1-9][0-9]*)$/.test(value) && value.length<=78,'Expected unsigned decimal string'); requireThat(BigInt(value)<2n**256n,'Integer overflow'); return value; }
export function normalizeTx(value:Record<string,unknown>):SafeTx { return {to:address(value.to),value:integer(value.value??'0'),data:hex(value.data??'0x'),operation:Number(value.operation??0),safeTxGas:integer(value.safeTxGas??'0'),baseGas:integer(value.baseGas??'0'),gasPrice:integer(value.gasPrice??'0'),gasToken:address(value.gasToken??ZERO),refundReceiver:address(value.refundReceiver??ZERO),nonce:integer(value.nonce)}; }
export type Classification = 'Protective'|'Admin'|'Large'|'Small';
interface Call {to:Address;value:string;data:`0x${string}`;operation:number}
export function decodeBatch(data:string):Call[] {
  requireThat(data.startsWith('0x8d80ff0a'),'Invalid MultiSend selector'); const abi=data.slice(10);
  requireThat(abi.length>=128 && BigInt('0x'+abi.slice(0,64))===32n,'Invalid MultiSend offset');
  const size=Number(BigInt('0x'+abi.slice(64,128))); requireThat(Number.isSafeInteger(size) && size<=65536,'Batch too large');
  const packed=abi.slice(128,128+size*2); requireThat(packed.length===size*2 && abi.length===128+Math.ceil(size/32)*64 && /^0*$/.test(abi.slice(128+size*2)),'Invalid MultiSend encoding');
  const calls:Call[]=[]; let p=0;
  while(p<packed.length) { requireThat(packed.length-p>=170,'Truncated batch'); const operation=parseInt(packed.slice(p,p+2),16); const to=address('0x'+packed.slice(p+2,p+42)); const value=BigInt('0x'+packed.slice(p+42,p+106)).toString(); const length=Number(BigInt('0x'+packed.slice(p+106,p+170))); requireThat(Number.isSafeInteger(length)&&length<=65536,'Invalid inner length'); p+=170; requireThat(p+length*2<=packed.length,'Truncated inner data'); calls.push({operation,to,value,data:hex('0x'+packed.slice(p,p+length*2))}); p+=length*2; requireThat(calls.length<=64,'Too many batch calls'); }
  requireThat(calls.length>0,'Empty batch'); return calls;
}
export async function classifyTransaction(wallet:Address,tx:SafeTx,options:AppOptions={}):Promise<Classification> {
  // Derive the established contract selector with viem, never trust a client-provided class.
  const {toFunctionSelector}=await import('viem'); const cancel=toFunctionSelector('cancelRecovery()');
  const modules=(options.modules??MODULES).map(v=>v.toLowerCase()); const usdc=(options.usdc??USDC).toLowerCase();
  const sanctioned=(options.sanctions??[]).map(v=>v.toLowerCase()); const approved=(options.approvedSpenders??[]).map(v=>v.toLowerCase());
  const one=(input:Call):Classification=> {
    const call={...input,to:input.to.toLowerCase() as Address,data:input.data.toLowerCase() as `0x${string}`};
    requireThat(call.operation===0,'Inner delegatecall forbidden'); requireThat(!sanctioned.includes(call.to),'MOCK sanctions: target blocked',403);
    if(modules.includes(call.to)&&call.data===cancel&&call.value==='0') return 'Protective';
    if(call.to===wallet||modules.includes(call.to)) return 'Admin';
    if(call.to===usdc) {
      requireThat(call.value==='0','Native value with token call forbidden'); const selector=call.data.slice(0,10);
      requireThat((selector==='0xa9059cbb'||selector==='0x095ea7b3')&&call.data.length===138,'Unsupported token operation requires explicit policy',403);
      requireThat(/^0{24}$/.test(call.data.slice(10,34)),'Invalid ABI address'); const recipient=address('0x'+call.data.slice(34,74)); const amount=BigInt('0x'+call.data.slice(74,138));
      requireThat(!sanctioned.includes(recipient),'MOCK sanctions: decoded recipient blocked',403);
      if(selector==='0x095ea7b3') requireThat(approved.includes(recipient),'Unlisted token spender blocked',403);
      return amount>5_000_000n?'Large':'Small';
    }
    // Unknown contract effects must not silently become small payments.
    return call.data!=='0x'||BigInt(call.value)>10_000_000_000_000_000n?'Large':'Small';
  };
  requireThat(tx.operation===0||tx.operation===1,'Invalid operation');
  if(tx.operation===1) { requireThat(tx.to.toLowerCase()===(options.multiSendCallOnly??MULTISEND).toLowerCase(),'Delegatecall target forbidden',403); requireThat(tx.value==='0','Batch value must be zero'); const classes=decodeBatch(tx.data).map(one); if(classes.every(v=>v==='Protective')) return 'Protective'; if(classes.includes('Admin')) return 'Admin'; return classes.includes('Large')?'Large':'Small'; }
  return one(tx);
}
export function transactionCalls(tx:SafeTx,options:AppOptions={}) {
  requireThat(tx.operation===0||tx.operation===1,'Invalid operation');
  if(tx.operation===1) {requireThat(tx.to.toLowerCase()===(options.multiSendCallOnly??MULTISEND).toLowerCase()&&tx.value==='0','Unauthorized batch',403);return decodeBatch(tx.data).map(c=>{requireThat(c.operation===0,'Inner delegatecall forbidden',403);return {...c,value:BigInt(c.value),operation:0 as const};});}
  return [{to:tx.to,value:BigInt(tx.value),data:tx.data,operation:0 as const}];
}
export function callAddresses(wallet:Address,tx:SafeTx,options:AppOptions={}) {
  const addresses:Address[]=[wallet,tx.to];
  for(const call of transactionCalls(tx,options)) {
    addresses.push(call.to);
    if(['0xa9059cbb','0x095ea7b3'].includes(call.data.slice(0,10))&&call.data.length===138) addresses.push(address('0x'+call.data.slice(34,74)));
  }
  return [...new Set(addresses)];
}
/** Derive issuer freeze subjects from call roles; never subtract a token's account role. */
export function derivefreezeSubjects(wallet: Address, tx: SafeTx, options: AppOptions = {}): Address[] {
  const subjects = new Set<Address>([address(wallet)]);
  const tokens = new Set([options.usdc ?? USDC, DAPP_ADDRESSES.usdc, DAPP_ADDRESSES.eurc].map(address));
  // Validating first ensures only the authorized CALL-only wrapper can enter this set.
  const calls = transactionCalls(tx, options);
  if (tx.operation === 1) subjects.add(address(tx.to));
  for (const call of calls) {
    const target = address(call.to);
    const data = call.data.toLowerCase();
    const canonicalAccountCall = call.operation === 0 && call.value === 0n &&
      (data.slice(0, 10) === '0xa9059cbb' || data.slice(0, 10) === '0x095ea7b3') &&
      data.length === 138 && /^0x[0-9a-f]+$/.test(data) && /^0{24}$/.test(data.slice(10, 34));
    if (canonicalAccountCall) subjects.add(address('0x' + data.slice(34, 74)));
    // Only a known token's canonical target role is omitted. Its recipient/spender
    // role (including revoke0), native value and unsupported methods stay covered.
    if (!tokens.has(target) || !canonicalAccountCall) subjects.add(target);
  }
  return [...subjects];
}
export async function strictClassification(wallet:Address,tx:SafeTx,options:AppOptions):Promise<Classification> {
  const {checkDappBatch}=await import('@sq/protocol');
  const {decodeFunctionData,encodeFunctionData}=await import('viem');
  const {moduleAbi,safeAbi}=await import('@sq/protocol');
  const modules=(options.modules??MODULES).map(a=>a.toLowerCase());
  const classes=transactionCalls(tx,options).map(call=> {
    if(call.value!==0n) return refuse('NOT_SPONSORED','Only zero-value supported calls are sponsored');
    if(call.to.toLowerCase()===wallet||modules.includes(call.to.toLowerCase())) {
      try {
        if(call.to.toLowerCase()===wallet) {
          const decoded=decodeFunctionData({abi:safeAbi,data:call.data});
          if(decoded.functionName!=='swapOwner'||encodeFunctionData({abi:safeAbi,functionName:decoded.functionName,args:decoded.args}).toLowerCase()!==call.data) return refuse('NOT_SPONSORED','Unsupported wallet admin call');
        } else {
          const decoded=decodeFunctionData({abi:moduleAbi,data:call.data});
          if(!['cancelRecovery','invalidateNonce','addGuardianWithThreshold','revokeGuardianWithThreshold'].includes(decoded.functionName)||encodeFunctionData({abi:moduleAbi,functionName:decoded.functionName,args:decoded.args}).toLowerCase()!==call.data) return refuse('NOT_SPONSORED','Unsupported recovery admin call');
          if(decoded.functionName==='cancelRecovery') return 'Protective' as const;
        }
        return 'Admin' as const;
      } catch {return refuse('NOT_SPONSORED','Unsupported or malformed admin call');}
    }
    if(call.to.toLowerCase()===(options.usdc??USDC).toLowerCase()&&call.data.startsWith('0xa9059cbb')&&call.data.length===138&&/^0{24}$/.test(call.data.slice(10,34))) return BigInt('0x'+call.data.slice(74))>5_000_000n?'Large' as const:'Small' as const;
    return 'Dapp' as const;
  });
  if(classes.every(c=>c==='Protective')) return 'Protective';
  if(classes.includes('Dapp')) {const check=checkDappBatch(wallet,transactionCalls(tx,options));if(!check.ok) refuse('NOT_SPONSORED',check.reasons.join('; '));return 'Small';}
  if(classes.includes('Admin')) return 'Admin';
  return classes.includes('Large')?'Large':'Small';
}
