import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toHex, type Address, type Hex, type PublicClient } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { ADDRESSES, GUARD_STORAGE_SLOT, FALLBACK_STORAGE_SLOT, computeWalletAddress } from '@sq/protocol';
import { createViemChain } from '../src/chain.ts';
import { createWebAuthn, verifyWebAuthn } from '../src/webauthn.ts';
import { ApiError } from '../src/policy.ts';

// In-process actual library adapter; no browser, server restart, or chain writes.
test('real WebAuthn options preserve decoded hash bytes and random login challenges', async()=> {
  const adapter=createWebAuthn({rpID:'localhost',origin:'http://localhost:5173'});
  const bytes=Buffer.from('ab'.repeat(32),'hex');const challenge=bytes.toString('base64url');
  const options=await adapter.authenticationOptions([],challenge);
  assert.equal(options.challenge,challenge);
  assert.deepEqual(Buffer.from(options.challenge as string,'base64url'),bytes);
  const first=await adapter.authenticationOptions([]);const second=await adapter.authenticationOptions([]);
  assert.notEqual(first.challenge,second.challenge);
});

test('WebAuthn validation refusals are 403 but adapter/configuration failures remain operational', async()=> {
  for(const error of [new Error('Credential ID was not base64url-encoded'),new Error('Unexpected credential type password, expected "public-key"'),new Error('Unexpected authentication response challenge "wrong", expected "issued"')]) {
    await assert.rejects(verifyWebAuthn(async()=>{throw error;}),e=>e instanceof ApiError&&e.status===403&&!e.message.includes(error.message));
  }
  const failure=new Error('WebCrypto unavailable: deployment configuration failure');
  await assert.rejects(verifyWebAuthn(async()=>{throw failure;}),e=>e===failure);
  const unavailable=new ApiError(503,'WebAuthn adapter not configured');
  await assert.rejects(verifyWebAuthn(async()=>{throw unavailable;}),e=>e===unavailable);
});

test('real chain adapter forwards current N independently of immutable creation O to exact verifier', async()=> {
  // Saved pinned contract bytes + labelled RPC state double; NOT a live recovery proof.
  const fixture=JSON.parse(readFileSync(new URL('../../../contracts/contracts/plan/sepolia-code.json',import.meta.url),'utf8'));
  const moduleB=JSON.parse(readFileSync(new URL('../../../contracts/contracts/plan/sepolia-module-b.json',import.meta.url),'utf8'));
  const artifact=JSON.parse(readFileSync(new URL('../../../contracts/node_modules/@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json',import.meta.url),'utf8'));
  const codes=new Map<string,Hex>(Object.values(fixture.contracts).map((item:any)=>[item.address.toLowerCase(),item.code]));codes.set(moduleB.address.toLowerCase(),moduleB.code);
  const original={owner:'0x1111111111111111111111111111111111111111' as Address,cardGuardian:'0x2222222222222222222222222222222222222222' as Address,partnerGuardian:'0x3333333333333333333333333333333333333333' as Address,sqGuardian:'0x4444444444444444444444444444444444444444' as Address,saltNonce:12n,chainId:11155111};
  const next='0x5555555555555555555555555555555555555555' as Address;const wallet=computeWalletAddress(original,artifact.bytecode);
  let owner=next;
  const client={
    getChainId:async()=>11155111,getBlockNumber:async()=>100n,getLogs:async()=>[],
    getCode:async({address}:{address:Address})=>address.toLowerCase()===wallet.toLowerCase()?artifact.deployedBytecode:codes.get(address.toLowerCase()),
    getStorageAt:async({slot}:{slot:Hex})=>toHex(slot===GUARD_STORAGE_SLOT?0n:slot===FALLBACK_STORAGE_SLOT?BigInt(ADDRESSES.fallbackHandler):BigInt(ADDRESSES.safeL2),{size:32}),
    readContract:async({functionName,address}:{functionName:string;address:Address})=> {
      const b=address.toLowerCase()===ADDRESSES.moduleB.toLowerCase();
      switch(functionName) {
        case 'proxyCreationCode':return artifact.bytecode;
        case 'nonce':return 0n;
        case 'getOwners':return [owner];
        case 'getThreshold':return 1n;
        case 'getModulesPaginated':return [[ADDRESSES.moduleA,ADDRESSES.moduleB],'0x0000000000000000000000000000000000000001'];
        case 'getGuardians':return [original.cardGuardian,b?original.sqGuardian:original.partnerGuardian];
        case 'threshold':case 'guardiansCount':return 2n;
        case 'getRecoveryRequest':return {executeAfter:0n};
        default:throw new Error(`Unexpected RPC fixture read ${functionName}`);
      }
    },
  } as unknown as PublicClient;
  const adapter=createViemChain({chainId:11155111,rpcUrls:['http://localhost:8545','http://127.0.0.1:8545'],relayerPrivateKey:generatePrivateKey(),publicClient:client});
  const setup={...original,wallet,saltNonce:'12'};
  assert.equal(await adapter.verifyWallet(setup),false);
  assert.equal(await adapter.verifyWallet(setup,{expectedCurrentOwner:next}),true);
  owner=original.owner;assert.equal(await adapter.verifyWallet(setup,{expectedCurrentOwner:next}),false);
  assert.equal(setup.owner,original.owner);
});
