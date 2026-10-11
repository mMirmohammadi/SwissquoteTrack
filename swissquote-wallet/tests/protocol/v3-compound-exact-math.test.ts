import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeFunctionData, encodeFunctionData, keccak256, toHex, type Address, type Hex, type PublicClient } from 'viem';
import { COMPOUND_CONFIG as C, checkedUint, compoundRate, compoundUtilization, modelCompound, parseCompoundUser, parseCompoundTotals, type CompoundTotals, type CompoundUser } from '../../packages/protocol/src/compound-math.js';
import { effectsFromSimulation, simulationProbes, verifyCompoundConfiguration, COMPOUND_EXTENSION, DAPP_CODE_PINS, type SimCall } from '../../packages/protocol/src/simulate.js';
import { compoundAbi, dappTokenAbi, DAPP_ADDRESSES as A } from '../../packages/protocol/src/dapps.js';
import type { MultiSendCall } from '../../packages/protocol/src/types.js';
const wallet: Address = '0x1a9E01F4C170c4674F02C6b85A9205D09132492d';
const word = (n: bigint) => toHex(n < 0n ? (1n<<256n)+n : n,{size:32});
const tuple = (v: readonly bigint[]): Hex => `0x${v.map(n=>word(n).slice(2)).join('')}`;
const empty: CompoundUser = [0n,0n,0n,0n,0n];
const stored: CompoundTotals = [1437404818773468n,1533718315546426n,74341550762472n,4491939236158804n,1636868415756n,1538191064853n,1791652656n,0n];
const base = {hash:'0xa006f4e35ba55f0b867c92f1ed02e21090352febc6a8ed04e8d113b2d785b0cc' as Hex,timestamp:1791672120n};
const calls = (action: 'supply'|'withdraw',amount: bigint): MultiSendCall[] => {
 const call = (to: Address,data: Hex): MultiSendCall => ({to,data,value:0n,operation:0});
 const execute = call(A.compound,encodeFunctionData({abi:compoundAbi,functionName:action,args:[A.usdc,amount]}));
 return action === 'withdraw' ? [execute] : [call(A.usdc,encodeFunctionData({abi:dappTokenAbi,functionName:'approve',args:[A.compound,amount]})),execute,call(A.usdc,encodeFunctionData({abi:dappTokenAbi,functionName:'approve',args:[A.compound,0n]}))];
};
const event = (address: Address,name: string,from: Address,to: Address,amount: bigint) => ({address,topics:[keccak256(toHex(`${name}(address,address,uint256)`)),word(BigInt(from)),word(BigInt(to))],data:word(amount)});
const zero = '0x0000000000000000000000000000000000000000' as Address;
/** Synthetic canonical fixture builder for migration; expectations in dedicated vectors below are hand-derived. */
export function compoundFixture(action: 'supply'|'withdraw'='supply',amount=1000000n,user: CompoundUser=empty,totals: CompoundTotals=stored,time=1791672132n) {
 const m=modelCompound(user,totals,time,amount,action),plan=simulationProbes(wallet,action);
 const snapshot=(after: boolean): SimCall[] => {
  const values: Record<string,Hex>={usdc:word(after ? action==='supply'?5000000n-amount:5000000n+amount:5000000n),eurc:word(0n),position:word(after?m.balanceAfter:m.balanceBefore),borrow:word(0n),userBasic:tuple(after?m.userAfter:user),totalsBasic:tuple(after?m.totalsAfter:totals),getUtilization:word(after?m.postUtilization:m.utilization),baseIndexScale:word(C.baseIndexScale),factorScale:word(C.factorScale),getSupplyRate:word(9040159720n)};
  return plan.map(p=>({status:'0x1',returnData:values[p.key]??word(0n),logs:[]}));
 };
 const supply=action==='supply';
 const logs=[event(A.usdc,'Transfer',supply?wallet:A.compound,supply?A.compound:wallet,amount),event(A.compound,supply?'Supply':'Withdraw',wallet,wallet,amount)];
 if(m.difference!==0n)logs.push(event(A.compound,'Transfer',supply?zero:wallet,supply?wallet:zero,m.eventAmount));
 const execute: SimCall={status:'0x1',returnData:'0x',logs};
 const approval=(n: bigint): SimCall=>({status:'0x1',returnData:word(1n),logs:[event(A.usdc,'Approval',wallet,A.compound,n)]});
 const execution=supply?[approval(amount),execute,approval(0n)]:[execute];
 return {raw:[{number:'0xb563ea',timestamp:toHex(time),parentHash:base.hash,calls:[...snapshot(false),...execution,...snapshot(true)]}],calls:calls(action,amount),model:m,plan};
}
const evaluate=(f=compoundFixture())=>effectsFromSimulation(wallet,f.calls,f.raw,11887593n,base);
for(const [time,index,balance] of [[1791672132n,1437657897106916n,999998n],[1791672252n,1437659456431214n,999999n]])test(`recorded exact vector ${balance}`,()=>{const m=modelCompound(empty,stored,time,1000000n,'supply');assert.equal(m.index,index);assert.equal(m.principal,695575n);assert.equal(m.balanceAfter,balance);assert.equal(evaluate(compoundFixture('supply',1000000n,empty,stored,time)).effects[1].amount,String(balance));});
// Public recorded vectors are versioned with the tests, not another attempt's ignored scratch.
const { recorded, funding } = JSON.parse(readFileSync(new URL('./fixtures/compound-exact-recorded.json',import.meta.url),'utf8'));
for(let i=0;i<2;i++)test(`saved node ${i} raw tuples and events accepted`,()=>{
 const raw=structuredClone(recorded[i].raw),old=raw[0].calls;
 // Saved diagnostic order: user/totals/util/rate/index/factor. Production: user/totals/util/index/factor/rate.
 raw[0].calls=[...old.slice(0,11),old[12],old[13],old[11],...old.slice(14,28),old[29],old[30],old[28]];
 const cs=funding[i].calls.map((c: MultiSendCall)=>({...c,value:BigInt(c.value)}));
 assert.equal(effectsFromSimulation(wallet,cs,raw,11887593n,base).effects[1].amount,'999998');
 assert.equal(parseCompoundUser(old[25].returnData)[0],695575n);
});
for(const delta of [-1n,1n])for(const key of ['position','userBasic','totalsBasic'])test(`exact ${key} mutation ${delta} rejects`,()=>{const f=compoundFixture(),i=f.plan.findIndex(p=>p.key===key)+17;const vals=key==='position'?[f.model.balanceAfter+delta]:key==='userBasic'?[f.model.principal+delta,...f.model.userAfter.slice(1)]:[f.model.index+delta,...f.model.totalsAfter.slice(1)];f.raw[0].calls[i].returnData=tuple(vals);assert.throws(()=>evaluate(f));});
for(const [action,amount] of [['supply',1000000n],['withdraw',1000000n],['withdraw',1437657n]] as const)test(`positive principal ${action} ${amount}`,()=>{const f=compoundFixture(action,amount,[1000000n,stored[2],9n,3n,1n]);assert.doesNotThrow(()=>evaluate(f));if(action==='withdraw'&&amount===1437657n)assert.equal(f.model.principal,0n);});
test('mint amount is principal difference, not displayed delta',()=>{const f=compoundFixture('supply',3n,[1000000n,stored[2],0n,0n,0n]);assert.notEqual(f.model.eventAmount,f.model.balanceAfter-f.model.balanceBefore);assert.doesNotThrow(()=>evaluate(f));});
test('tiny no principal change omits mint and preserves exact zero credit',()=>{const t: CompoundTotals=[2000000000000001n,C.baseIndexScale,0n,0n,100n,0n,1791672132n,0n];const f=compoundFixture('supply',1n,empty,t);assert.equal(f.model.principal,0n);assert.equal(f.raw[0].calls[15].logs!.length,2);assert.doesNotThrow(()=>evaluate(f));});
for(const index of [C.baseIndexScale,C.baseIndexScale+1n,2n*C.baseIndexScale,2n*C.baseIndexScale+1n])test(`index boundary ${index}`,()=>{const t: CompoundTotals=[index,C.baseIndexScale,0n,0n,0n,0n,1791672132n,0n];const m=modelCompound(empty,t,1791672132n,3n,'supply');assert.equal(m.principal,3n*C.baseIndexScale/index);assert.equal(m.balanceAfter,m.principal*index/C.baseIndexScale);});
test('zero utilization and both kink branches',()=>{assert.equal(compoundUtilization([C.baseIndexScale,C.baseIndexScale,0n,0n,0n,1n,0n,0n]),0n);assert.equal(compoundRate(0n),0n);assert.equal(compoundRate(C.supplyKink),1522070015n*C.supplyKink/C.factorScale);assert.equal(compoundRate(1002681548101469396n),9040159720n);});
for(const [name,run] of Object.entries({negative:()=>modelCompound([-1n,0n,0n,0n,0n],stored,1791672132n,1n,'supply'),crossing:()=>modelCompound(empty,stored,1791672132n,1n,'withdraw'),past:()=>modelCompound(empty,stored,1n,1n,'supply'),uint40:()=>modelCompound(empty,stored,1n<<40n,1n,'supply'),uint256:()=>checkedUint(1n<<256n),uint64:()=>checkedUint(1n<<64n,64),signed104:()=>modelCompound([1n<<103n,0n,0n,0n,0n],stored,1791672132n,1n,'supply')}))test(`bounded math rejects ${name}`,()=>assert.throws(run));
for(const [name,data] of [['trailing',`${tuple(empty)}${'00'.repeat(32)}`],['bad sign',tuple([(1n<<104n)-1n,0n,0n,0n,0n])],['uint16',tuple([0n,0n,0n,65536n,0n])]] as const)test(`canonical tuple rejects ${name}`,()=>assert.throws(()=>parseCompoundUser(data as Hex)));
test('canonical negative signed principal parses but model rejects hidden debt',()=>{assert.equal(parseCompoundUser(tuple([-1n,0n,0n,0n,0n]))[0],-1n);assert.throws(()=>modelCompound(parseCompoundUser(tuple([-1n,0n,0n,0n,0n])),stored,1791672132n,1n,'supply'));assert.throws(()=>parseCompoundTotals(tuple([...stored,0n])));});
for(const [name,mutate] of Object.entries({empty:(f: ReturnType<typeof compoundFixture>)=>{f.raw[0].calls[15].logs=[];},duplicate:f=>{f.raw[0].calls[15].logs!.push(f.raw[0].calls[15].logs![0]);},wrongAmount:f=>{f.raw[0].calls[15].logs![0].data=word(999999n);},diversion:f=>{f.raw[0].calls[15].logs![0].topics[2]=word(2n);},order:f=>{f.raw[0].calls[15].logs!.reverse();},getterLog:f=>{f.raw[0].calls[0].logs=[f.raw[0].calls[15].logs![0]];},revert:f=>{f.raw[0].calls[15].status='0x0';},allowance:f=>{f.raw[0].calls[23].returnData=word(1n);},eurc:f=>{f.raw[0].calls[18].returnData=word(1n);},missingCall:f=>{f.raw[0].calls.pop();},time:f=>{f.raw[0].timestamp='0x00';},parent:f=>{f.raw[0].parentHash=word(1n);}}))test(`strict evidence rejects ${name}`,()=>{const f=compoundFixture();mutate(f);assert.throws(()=>evaluate(f));});
test('withdraw wrong transfer amount rejects',()=>{const f=compoundFixture('withdraw',1000000n,[1000000n,stored[2],0n,0n,0n]);f.raw[0].calls[14].logs![0].data=word(1n);assert.throws(()=>evaluate(f));});
test('unrelated nonzero permission remains unchanged and accepted',()=>{const f=compoundFixture();f.raw[0].calls[4].returnData=word(7n);f.raw[0].calls[21].returnData=word(7n);assert.doesNotThrow(()=>evaluate(f));});
test('raw P0 hash retains lawful drift and stable equivalent observations',()=>{const first=evaluate(),later=evaluate(compoundFixture('supply',1000000n,empty,stored,1791672252n));assert.equal(first.effectsHash,evaluate().effectsHash);assert.notEqual(first.effectsHash,later.effectsHash);});
test('hand-derived positive principal mint and partial/full withdrawal',()=>{
 const t: CompoundTotals=[1500000000000000n,C.baseIndexScale,10n,20n,100n,0n,1791672132n,0n];
 const u: CompoundUser=[3n,10n,7n,2n,1n];
 const supply=modelCompound(u,t,1791672132n,2n,'supply');
 assert.deepEqual([supply.balanceBefore,supply.principal,supply.balanceAfter,supply.eventAmount],[4n,4n,6n,1n]);
 const partial=modelCompound(u,t,1791672132n,1n,'withdraw');
 assert.deepEqual([partial.principal,partial.balanceAfter,partial.eventAmount],[2n,3n,1n]);
 const full=modelCompound(u,t,1791672132n,4n,'withdraw');
 assert.deepEqual([full.principal,full.balanceAfter,full.eventAmount],[0n,0n,4n]);
 assert.throws(()=>modelCompound(u,t,1791672132n,5n,'withdraw'));
});
test('overflowing accrued uint64 index and supply rate reject',()=>{
 assert.throws(()=>modelCompound(empty,[(1n<<64n)-1n,stored[1],...stored.slice(2)] as unknown as CompoundTotals,1791672132n,1n,'supply'));
 assert.throws(()=>compoundRate((1n<<256n)-1n));
});
test('missing base and noncanonical numeric timestamp refuse',()=>{
 const f=compoundFixture();assert.throws(()=>effectsFromSimulation(wallet,f.calls,f.raw,11887593n));
 (f.raw[0] as unknown as {timestamp: unknown}).timestamp=1791672132;assert.throws(()=>evaluate(f));
});
test('fresh configuration reads bind base and reject address/constants/encoding changes',async()=>{
 const run=(patch: Record<string,Hex>={})=>verifyCompoundConfiguration({call:async(args: {blockNumber: bigint;data: Hex})=>{
  assert.equal(args.blockNumber,11887593n);
  const name=decodeFunctionData({abi:compoundAbi,data:args.data}).functionName;
  const expected=name==='extensionDelegate'?word(BigInt(COMPOUND_EXTENSION)):name==='baseToken'?word(BigInt(A.usdc)):word(C[name as keyof typeof C]);
  return {data:patch[name]??expected};
 }} as unknown as PublicClient,11887593n);
 await assert.doesNotReject(run());
 await assert.rejects(run({extensionDelegate:word(2n)}),/configuration changed/);
 await assert.rejects(run({baseToken:word(2n)}),/configuration changed/);
 await assert.rejects(run({supplyKink:word(C.supplyKink+1n)}),/configuration changed/);
 await assert.rejects(run({baseIndexScale:'0x'}),/Malformed/);
});
test('named probe counts and pinned extension interface',()=>{assert.equal(simulationProbes(wallet,'swap').length,8);assert.equal(simulationProbes(wallet,'supply').length,14);assert.equal(simulationProbes(wallet,'withdraw').length*2+1,29);assert.equal(DAPP_CODE_PINS.find(p=>p.address===COMPOUND_EXTENSION)?.codeHash,'0x462b212abc00fb7e835d516da02805a359663ee9dd1050a4f827f17b1185cab2');});
