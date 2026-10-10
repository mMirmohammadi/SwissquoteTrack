import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseGwei, type PublicClient, type WalletClient } from 'viem';
import { createViemChain, sepoliaFees, SEPOLIA_MIN_TIP, SEPOLIA_MAX_FEE_CAP, SIMULATION_RETRY_DELAY_MS } from '../src/chain.ts';
import type { ChainOperation, Address } from '../src/types.ts';

// Every client below is a mock: these URLs are only there to satisfy the two-RPC rule and are never contacted.
const urls=['http://127.0.0.1:9','http://localhost:9'];
const wallet='0x1111111111111111111111111111111111111111' as Address;
const finalize:ChainOperation={kind:'finalize',wallet,module:wallet};
const warnings:string[]=[];console.warn=(message:unknown)=> {warnings.push(String(message));};
interface Sent {account:{address:Address;nonceManager?:unknown};gas:bigint;chainId?:number;maxFeePerGas?:bigint;maxPriorityFeePerGas?:bigint}
function publicClient(chainId:number,extra:Record<string,unknown>={}) {
  const counts={call:0};
  const client={getChainId:async()=>chainId,estimateGas:async()=>100_000n,call:async()=> {counts.call++;return {data:'0x'};},...extra} as unknown as PublicClient;
  return {client,counts};
}
function sepoliaClient(baseFeePerGas:bigint|undefined,tip=parseGwei('0.001'),extra:Record<string,unknown>={}) {
  return publicClient(11155111,{getBlock:async()=>({baseFeePerGas}),estimateMaxPriorityFeePerGas:async()=>tip,...extra});
}
function recordingWallet() {const sent:Sent[]=[];return {sent,client:{sendTransaction:async(args:Sent)=> {sent.push(args);return '0xabc';}} as unknown as WalletClient};}

test('Sepolia fee rule: tip floor 0.01 gwei and max fee = 2 x base fee + tip',()=> {
  assert.equal(SEPOLIA_MIN_TIP,parseGwei('0.01'));assert.equal(SEPOLIA_MAX_FEE_CAP,parseGwei('20'));
  // publicnode suggests 0.001 gwei: raised to the floor.
  assert.deepEqual(sepoliaFees(15n,parseGwei('0.001')),{maxPriorityFeePerGas:parseGwei('0.01'),maxFeePerGas:30n+parseGwei('0.01')});
  assert.deepEqual(sepoliaFees(15n,0n),{maxPriorityFeePerGas:parseGwei('0.01'),maxFeePerGas:30n+parseGwei('0.01')});
  // A higher node suggestion is kept.
  assert.deepEqual(sepoliaFees(parseGwei('1'),parseGwei('2')),{maxPriorityFeePerGas:parseGwei('2'),maxFeePerGas:parseGwei('4')});
});

test('Sepolia fee rule: exactly 20 gwei is allowed, anything above is refused with a clear error',()=> {
  const edge=(parseGwei('20')-parseGwei('0.01'))/2n;
  assert.equal(sepoliaFees(edge,0n).maxFeePerGas,parseGwei('20'));
  assert.throws(()=>sepoliaFees(edge+1n,0n),(error:Error&{status?:number})=>error.status===503&&error.message==='Sepolia network fee too high: max fee 20.000000002 gwei is above the 20 gwei safety cap; nothing was sent');
  assert.throws(()=>sepoliaFees(0n,parseGwei('21')),/Sepolia network fee too high/);
});

test('Sepolia adapter refuses over-cap fees in preflight and in send, never reaching broadcast',async()=> {
  const {client}=sepoliaClient(parseGwei('15'));const {sent,client:walletClient}=recordingWallet();warnings.length=0;
  const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:generatePrivateKey(),allowSepoliaWrites:true,publicClient:client,walletClient});
  await assert.rejects(adapter.estimateGas(finalize),/Sepolia network fee too high: max fee 30.01 gwei/);
  await assert.rejects(adapter.send(finalize,100_000n),/Sepolia network fee too high/);
  assert.equal(sent.length,0);assert.ok(warnings.some(line=>line.includes('safety cap; nothing was sent')));
  const missing=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:generatePrivateKey(),allowSepoliaWrites:true,publicClient:sepoliaClient(undefined).client,walletClient});
  await assert.rejects(missing.send(finalize,100_000n),/Sepolia base fee unavailable/);assert.equal(sent.length,0);
});

test('Sepolia adapter broadcasts with the capped EIP-1559 fees and a shared nonce manager for RELAYER and SQ_ACCOUNT',async()=> {
  const relayerKey=generatePrivateKey();const accountKey=generatePrivateKey();
  const {client}=sepoliaClient(15n,parseGwei('0.001'),{estimateMaxPriorityFeePerGas:async()=> {throw new Error('method not supported');}});
  const {sent,client:walletClient}=recordingWallet();
  const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:relayerKey,accountPrivateKey:accountKey,allowSepoliaWrites:true,publicClient:client,walletClient});
  assert.equal(await adapter.estimateGas(finalize),100_000n);
  await adapter.send(finalize,120_000n);await adapter.send({kind:'withdraw',to:wallet,amount:'1'},60_000n);
  assert.equal(sent.length,2);
  for(const tx of sent) {assert.equal(tx.maxPriorityFeePerGas,parseGwei('0.01'));assert.equal(tx.maxFeePerGas,30n+parseGwei('0.01'));assert.equal(tx.chainId,11155111);assert.ok(tx.account.nonceManager);}
  assert.equal(sent[0].gas,120_000n);assert.equal(sent[0].account.address,privateKeyToAccount(relayerKey).address);
  assert.equal(sent[1].gas,60_000n);assert.equal(sent[1].account.address,privateKeyToAccount(accountKey).address);
  assert.equal(sent[0].account.nonceManager,sent[1].account.nonceManager);
});

test('local chain keeps its previous path: no fee policy, no nonce manager, no simulation retry',async()=> {
  // No getBlock / estimateMaxPriorityFeePerGas on this mock: calling either would fail the test.
  const {client,counts}=publicClient(31337,{call:async()=> {counts.call++;throw new Error('execution reverted');}});const {sent,client:walletClient}=recordingWallet();
  const adapter=createViemChain({chainId:31337,rpcUrls:urls,relayerPrivateKey:generatePrivateKey(),publicClient:client,walletClient,simulationRetryDelayMs:1});
  assert.equal(await adapter.estimateGas(finalize),100_000n);
  await adapter.send(finalize,90_000n);
  assert.equal(sent.length,1);assert.equal(sent[0].gas,90_000n);assert.equal(sent[0].maxFeePerGas,undefined);assert.equal(sent[0].maxPriorityFeePerGas,undefined);assert.equal(sent[0].chainId,undefined);assert.equal(sent[0].account.nonceManager,undefined);
  await assert.rejects(adapter.simulate(finalize),/execution reverted/);assert.equal(counts.call,1);
});

test('Sepolia pre-send simulation retries exactly once after the delay (default about 3 s)',async()=> {
  assert.equal(SIMULATION_RETRY_DELAY_MS,3000);
  let failures=1;const {client,counts}=sepoliaClient(15n,0n,{call:async()=> {counts.call++;if(failures-->0) throw new Error('header not found');return {data:'0x'};}});
  const adapter=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:generatePrivateKey(),publicClient:client,simulationRetryDelayMs:40});
  const started=Date.now();await adapter.simulate(finalize);
  assert.equal(counts.call,2);assert.ok(Date.now()-started>=35,'waits before the retry');
  failures=Infinity;counts.call=0;
  await assert.rejects(adapter.simulate(finalize),/header not found/);assert.equal(counts.call,2,'gives up after one retry');
  // The boolean check still applies to the retried simulation.
  const {client:falseClient,counts:falseCounts}=sepoliaClient(15n,0n,{call:async()=> {falseCounts.call++;return {data:`0x${'0'.repeat(64)}`};}});
  const strict=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:generatePrivateKey(),publicClient:falseClient,simulationRetryDelayMs:1});
  await assert.rejects(strict.simulate({kind:'withdraw',to:wallet,amount:'1'}),/MOCK account key not configured/);
  const withAccount=createViemChain({chainId:11155111,rpcUrls:urls,relayerPrivateKey:generatePrivateKey(),accountPrivateKey:generatePrivateKey(),publicClient:falseClient,simulationRetryDelayMs:1});
  falseCounts.call=0;await assert.rejects(withAccount.simulate({kind:'withdraw',to:wallet,amount:'1'}),/Token transfer simulation returned false/);assert.equal(falseCounts.call,2);
});
