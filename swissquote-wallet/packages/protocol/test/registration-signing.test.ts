import test from 'node:test';
import assert from 'node:assert/strict';
import { type PublicClient, type Address, type Hex } from 'viem';
import { verifyOwnershipProof } from '../src/signing.ts';
const wallet='0x1111111111111111111111111111111111111111' as Address;
const hash=`0x${'11'.repeat(32)}` as Hex;
test('ownership proof pins selected block while old callers remain unpinned',async()=> {
  const calls:Record<string,unknown>[]=[];
  const client={readContract:async(args:Record<string,unknown>)=>{calls.push(args);return '0x1626ba7e';}} as unknown as PublicClient;
  assert.equal(await verifyOwnershipProof(client,wallet,hash,'0x11',{blockNumber:102n}),true);
  assert.equal(await verifyOwnershipProof(client,wallet,hash,'0x11'),true);
  assert.equal(calls[0].blockNumber,102n);assert.equal('blockNumber' in calls[1],false);
  assert.deepEqual(calls[0].args,[hash,'0x11']);assert.equal(calls[0].functionName,'isValidSignature');
});
test('wrong magic and RPC failure still fail closed at selected block',async()=> {
  for(const value of ['0xffffffff',new Error('private RPC response')]) {
    const client={readContract:async(args:{blockNumber?:bigint})=>{assert.equal(args.blockNumber,102n);if(value instanceof Error) throw value;return value;}} as unknown as PublicClient;
    assert.equal(await verifyOwnershipProof(client,wallet,hash,'0x11',{blockNumber:102n}),false);
  }
});
