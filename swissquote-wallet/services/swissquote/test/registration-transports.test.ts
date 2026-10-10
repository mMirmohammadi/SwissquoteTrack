import test from 'node:test';
import assert from 'node:assert/strict';
import { hashMessage, type Hex } from 'viem';
import { HISTORY_RPC_URLS } from '@sq/protocol';
import { createViemChain } from '../src/chain.ts';
const key=`0x${'01'.repeat(32)}` as Hex;
const hash=hashMessage('block');
function clock() {let time=0;return {now:()=>time,sleep:async(ms:number)=>{time+=ms;}};}
function rpcResult(method:string) {
  if(method==='eth_chainId') return '0xaa36a7';
  if(method==='eth_blockNumber') return '0x64';
  if(method==='eth_getBlockByNumber') return {hash,number:'0x64',transactions:[],timestamp:'0x1',gasLimit:'0x1',gasUsed:'0x0',difficulty:'0x0',totalDifficulty:'0x0',size:'0x0',baseFeePerGas:'0x0'};
  throw new Error('Unexpected read');
}
test('actual shared-URL role transports deduplicate pacing and preserve finite retries',async t=> {
  const c=clock();const starts:{url:string;at:number;method:string}[]=[];let failed=false;
  t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=> {
    const request=JSON.parse(init!.body as string);const url=input instanceof Request?input.url:String(input);starts.push({url,at:c.now(),method:request.method});
    if(!failed) {failed=true;return new Response('rate limited',{status:429});}
    return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:rpcResult(request.method)}),{headers:{'content-type':'application/json'}});
  });
  const adapter=createViemChain({chainId:11155111,rpcUrls:HISTORY_RPC_URLS,relayerPrivateKey:key,registrationClock:c});
  assert.equal(await adapter.registrationBlock(),100n);
  assert.ok(failed);assert.ok(starts.length>=7);
  assert.ok(starts.filter(x=>new URL(x.url).href===new URL(HISTORY_RPC_URLS[0]).href).length>=7);
  for(const url of HISTORY_RPC_URLS) {const endpoint=starts.filter(x=>new URL(x.url).href===new URL(url).href);for(let i=1;i<endpoint.length;i++) assert.ok(endpoint[i].at-endpoint[i-1].at>=150);}
  assert.ok(starts.every(x=>HISTORY_RPC_URLS.some(url=>new URL(url).href===new URL(x.url).href)));
});
test('local registration transports have no Sepolia pacing delay',async t=> {
  const c=clock();let calls=0;
  t.mock.method(globalThis,'fetch',async(_input:RequestInfo|URL,init?:RequestInit)=> {
    calls++;const request=JSON.parse(init!.body as string);return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:request.method==='eth_chainId'?'0x7a69':rpcResult(request.method)}),{headers:{'content-type':'application/json'}});
  });
  const adapter=createViemChain({chainId:31337,rpcUrls:['http://first.invalid','http://second.invalid'],relayerPrivateKey:key,registrationClock:c});
  assert.equal(await adapter.registrationBlock(),100n);assert.equal(c.now(),0);assert.equal(calls,3);
});
