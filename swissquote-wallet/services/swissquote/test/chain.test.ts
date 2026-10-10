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
