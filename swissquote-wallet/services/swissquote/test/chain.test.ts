import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { encodeAbiParameters, type PublicClient } from 'viem';
import { makeSafeTx, safeTxToWire, signSafeTx } from '@sq/protocol';
import { createViemChain } from '../src/chain.ts';
import type { ChainOperation, Address } from '../src/types.ts';
const wallet='0x1111111111111111111111111111111111111111' as Address;
test('production adapter checks current owner EIP-712 signature, chain and simulation boolean',async()=> {
 const ownerKey=generatePrivateKey();const oldKey=generatePrivateKey();const owner=privateKeyToAccount(ownerKey).address;
 let currentChain=31337;let success=true;
 const publicClient={getChainId:async()=>currentChain,readContract:async(input:{functionName:string})=>input.functionName==='getOwners'?[owner]:input.functionName==='getThreshold'?1n:0n,call:async()=>({data:encodeAbiParameters([{type:'bool'}],[success])})} as unknown as PublicClient;
 const adapter=createViemChain({chainId:31337,rpcUrls:['http://127.0.0.1:8545','http://localhost:8545'],relayerPrivateKey:generatePrivateKey(),publicClient});
 const tx=makeSafeTx({to:wallet});const wire=safeTxToWire(tx);const valid=await signSafeTx(ownerKey,wallet,tx,31337);const old=await signSafeTx(oldKey,wallet,tx,31337);
 assert.equal(await adapter.verifyOwnerSignature(wallet,wire,valid),true);assert.equal(await adapter.verifyOwnerSignature(wallet,wire,old),false);
 const operation:ChainOperation={kind:'safe-tx',wallet,tx:wire,signature:valid};await adapter.simulate(operation);success=false;await assert.rejects(adapter.simulate(operation),/Safe simulation returned false/);
 currentChain=11155111;await assert.rejects(adapter.safeTxHash(wallet,wire),/RPC chain mismatch/);
});
test('Sepolia adapter refuses broadcast without explicit authorization',async()=> {const publicClient={getChainId:async()=>11155111} as unknown as PublicClient;const adapter=createViemChain({chainId:11155111,rpcUrls:['http://localhost:8545','http://127.0.0.1:8545'],relayerPrivateKey:generatePrivateKey(),publicClient});await assert.rejects(adapter.send({kind:'finalize',wallet,module:wallet},100n),/Sepolia writes disabled/);});
test('receipt status checks chain/hash and never treats missing, malformed or unavailable receipt as settlement',async()=> {
 const hash=('0x'+'ab'.repeat(32)) as `0x${string}`;let currentChain=11155111;let receipt:Record<string,unknown>={transactionHash:hash,status:'success',blockNumber:42n};let fail=false;
 const publicClient={getChainId:async()=>currentChain,getTransactionReceipt:async()=>{if(fail)throw Error('not found');return receipt;}} as unknown as PublicClient;
 const adapter=createViemChain({chainId:11155111,rpcUrls:['http://localhost:8545','http://127.0.0.1:8545'],relayerPrivateKey:generatePrivateKey(),publicClient});
 assert.deepEqual(await adapter.receiptStatus!(hash),{status:'confirmed',blockNumber:'42'});receipt.status='reverted';assert.deepEqual(await adapter.receiptStatus!(hash),{status:'reverted',blockNumber:'42'});
 for(const mutation of [{status:'pending'},{transactionHash:'0x00'},{blockNumber:null},{blockNumber:-1n}]) {receipt={transactionHash:hash,status:'success',blockNumber:42n,...mutation};assert.deepEqual(await adapter.receiptStatus!(hash),{status:'unknown'});}
 fail=true;assert.deepEqual(await adapter.receiptStatus!(hash),{status:'unknown'});fail=false;currentChain=31337;assert.deepEqual(await adapter.receiptStatus!(hash),{status:'unknown'});
});
