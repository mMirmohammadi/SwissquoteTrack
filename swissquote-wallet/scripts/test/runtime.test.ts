import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { assertLocal, clients, localRpc } from '../runtime.js';

test('refuses invalid RPC lists and unsupported chains before network access',()=>{
  assert.throws(()=>clients([]),/RPC URL/);
  assert.throws(()=>clients(['file:///tmp/rpc']),/RPC URL/);
  assert.throws(()=>clients(['http://127.0.0.1:1'],1),/Unsupported chain/);
});
test('local-only mutation refuses a Sepolia RPC before hardhat_setCode',async()=>{
  const methods:string[]=[];
  const server=createServer(async(req,res)=>{
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);
    const message=JSON.parse(Buffer.concat(chunks).toString());methods.push(message.method);
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result:'0xaa36a7'}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert(address&&typeof address==='object');
  const url=`http://127.0.0.1:${address.port}`;
  try{
    await assert.rejects(assertLocal(url),/refusing any chain other than 31337/);
    await assert.rejects(localRpc(url,'hardhat_setCode',['0x00','0x00']),/refusing any chain other than 31337/);
    assert.deepEqual(methods,['eth_chainId','eth_chainId']);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
