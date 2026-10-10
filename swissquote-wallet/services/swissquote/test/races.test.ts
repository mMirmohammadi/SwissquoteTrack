import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import type { Address, ChainAdapter } from '../src/types.ts';
import { hashMessage } from 'viem';
const wallet='0x1111111111111111111111111111111111111111' as Address;
test('global budget serializes concurrent finalizations and rejected origins fail closed',async()=> {let sends=0;const chain={chainId:31337,simulate:async()=>{},estimateGas:async()=>100n,send:async()=>{sends++;return hashMessage('sent');}} as unknown as ChainAdapter;const app=createApp({databasePath:':memory:',chain,globalDailyLimit:1});await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));const info=app.server.address();assert.ok(info&&typeof info==='object');const url=`http://127.0.0.1:${info.port}`;
 try {const send=()=>fetch(url+'/relay/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet,module:'0x949d01d424bE050D09C16025dd007CB59b3A8c66'})});const results=await Promise.all([send(),send()]);assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);assert.equal(sends,1);assert.equal((await fetch(url+'/health',{headers:{Origin:'https://attacker.invalid'}})).status,403);}finally{await app.close();}
});
