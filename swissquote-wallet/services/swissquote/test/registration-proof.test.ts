import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpRequestError, type Address, type PublicClient } from 'viem';
import { verifyOwnershipProof } from '@sq/protocol';
import { registrationClient, withRegistrationReads, classifiedRegistrationRead } from '../src/registration-reads.ts';
const wallet='0x1111111111111111111111111111111111111111' as Address;
test('proof terminal transport failure classified safely but invalid magic and unknown failures remain false',async()=> {
  for(const kind of ['transport','magic','unknown']) {
    const client=registrationClient({readContract:async()=>{
      if(kind==='transport') throw new HttpRequestError({url:'https://private.invalid',cause:new Error('secret provider detail')});
      if(kind==='unknown') throw new Error('not evidence of transport');
      return '0xffffffff';
    }} as unknown as PublicClient);
    const result=withRegistrationReads(()=>classifiedRegistrationRead(()=>verifyOwnershipProof(client,wallet,'0x11','0x11',{blockNumber:102n})));
    if(kind==='transport') await assert.rejects(result,(e:any)=>e.status===503&&!e.message.includes('secret'));
    else assert.equal(await result,false);
  }
});
