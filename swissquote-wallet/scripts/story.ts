import assert from 'node:assert/strict';
import { encodeFunctionData, type Address, type Hex } from 'viem';
import {
  ADDRESSES, MODULES, LOCAL_CHAIN_ID, safeAbi, factoryAbi, moduleAbi, erc20Abi,
  generateOwnerSeed, generateCardSeed, mnemonicToPrivateKey, mnemonicToAddress, randomSaltNonce,
  buildDeployCall, computeWalletAddress, verifyWallet, signOwnershipProof, verifyOwnershipProof,
  makeSafeTx, signSafeTx, encodeExecTransaction, classifyTransaction, signRecovery, assertRecoveryHash,
  encodeRecoveryCall, buildCancelRecoveryTx, buildRotateOwnerTx, createKit, openKit, generateKitCode,
  type SafeTx, type WalletSetup, type RecoveryRequest,
} from '@sq/protocol';
import { DEV_RPC, DEV_KEYS, DEV_ADDRESSES, USDC_ADDRESS, setupDevnet } from './devnet.js';
import { assertLocal, isMain, localRpc, submit } from './runtime.js';
import { sweepKit } from './kit-sweep.js';

const MODULE_A: Address = '0x949d01d424bE050D09C16025dd007CB59b3A8c66';
const MODULE_B: Address = '0x38275826E1933303E508433dD5f289315Da2541c';
const mintAbi = [{ type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{name:'to',type:'address'},{name:'amount',type:'uint256'}], outputs: [] }] as const;
export async function runStory(rpcUrl = DEV_RPC): Promise<{wallet: Address; checks: string[]}> {
  await setupDevnet(rpcUrl);
  const { publicClient } = await assertLocal(rpcUrl);
  const checks: string[] = [];
  const mark = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };
  const send = (to: Address, data: Hex) => submit([rpcUrl], LOCAL_CHAIN_ID, DEV_KEYS.relayer, to, data);
  const ownerSeed = generateOwnerSeed(), cardSeed = generateCardSeed(), newSeed = generateOwnerSeed(), rotatedSeed = generateOwnerSeed();
  const owner = mnemonicToAddress(ownerSeed), newOwner = mnemonicToAddress(newSeed), rotatedOwner = mnemonicToAddress(rotatedSeed);
  const setup: WalletSetup = { owner, cardGuardian: mnemonicToAddress(cardSeed), partnerGuardian: DEV_ADDRESSES.partner, sqGuardian: DEV_ADDRESSES.sq, saltNonce: randomSaltNonce(), chainId: LOCAL_CHAIN_ID };
  const deploy = buildDeployCall(setup);
  const proxyCode = await publicClient.readContract({address:deploy.address,abi:factoryAbi,functionName:'proxyCreationCode'});
  const wallet = computeWalletAddress(setup, proxyCode);
  await send(deploy.address, encodeFunctionData({abi:deploy.abi,functionName:deploy.functionName,args:deploy.args}));
  const verification = await verifyWallet(publicClient, setup, {expectedWallet:wallet});
  assert.equal(verification.ok, true, verification.reasons.join('; '));
  assert.equal(await publicClient.getBalance({address:wallet}), 0n);
  mark('one-transaction create, pinned rules verification, wallet has 0 ETH');
  const proof = await signOwnershipProof(mnemonicToPrivateKey(ownerSeed), 'MOCK-client', wallet, 'story-nonce', LOCAL_CHAIN_ID);
  assert.equal(await verifyOwnershipProof(publicClient,wallet,proof.hash,proof.signature),true);
  mark('EIP-1271 ownership proof');
  await send(USDC_ADDRESS, encodeFunctionData({abi:mintAbi,functionName:'mint',args:[DEV_ADDRESSES.account,15_000_000n]}));
  await submit([rpcUrl],LOCAL_CHAIN_ID,DEV_KEYS.account,USDC_ADDRESS,encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[wallet,15_000_000n]}));
  mark('MOCK account funding: actual token transfer');
  const nonce = () => publicClient.readContract({address:wallet,abi:safeAbi,functionName:'nonce'});
  const exec = async (seed:string,tx:SafeTx) => send(wallet,encodeExecTransaction(tx,await signSafeTx(mnemonicToPrivateKey(seed),wallet,tx,LOCAL_CHAIN_ID)));
  const payment = async (seed:string,amount:bigint) => makeSafeTx({to:USDC_ADDRESS,nonce:await nonce(),data:encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[DEV_ADDRESSES.recipient,amount]})});
  const recipientBefore=await publicClient.readContract({address:USDC_ADDRESS,abi:erc20Abi,functionName:'balanceOf',args:[DEV_ADDRESSES.recipient]});
  for (const [amount, expected] of [[2_000_000n,'Small'],[8_000_000n,'Large']] as const) {
    const tx=await payment(ownerSeed,amount); const classification=classifyTransaction(wallet,tx);
    assert.equal(classification.class,expected); assert.equal(classification.requiresPasskey,expected==='Large');
    await exec(ownerSeed,tx);
  }
  assert.equal(await publicClient.readContract({address:USDC_ADDRESS,abi:erc20Abi,functionName:'balanceOf',args:[DEV_ADDRESSES.recipient]}),recipientBefore+10_000_000n);
  assert.equal(await publicClient.readContract({address:USDC_ADDRESS,abi:erc20Abi,functionName:'balanceOf',args:[wallet]}),5_000_000n);
  assert.equal(await publicClient.getBalance({address:wallet}),0n);
  mark('small/large classification and owner-signed gasless payments (passkey enforcement belongs to service lane)');
  const request = async (module:Address):Promise<RecoveryRequest> => ({wallet,module,newOwner,nonce:await publicClient.readContract({address:module,abi:moduleAbi,functionName:'nonce',args:[wallet]}),chainId:LOCAL_CHAIN_ID});
  const start = async (module:Address,helper:Hex) => {
    const req=await request(module); await assertRecoveryHash(publicClient,req);
    const approvals=await Promise.all([signRecovery(mnemonicToPrivateKey(cardSeed),req),signRecovery(helper,req)]);
    return send(module,encodeRecoveryCall(req,approvals));
  };
  const getRequest = (module:Address) => publicClient.readContract({address:module,abi:moduleAbi,functionName:'getRecoveryRequest',args:[wallet]});
  await start(MODULE_A,DEV_KEYS.partner);
  const bStarted=await start(MODULE_B,DEV_KEYS.sq);
  const bBlock=await publicClient.getBlock({blockNumber:bStarted.blockNumber});
  assert.equal((await getRequest(MODULE_B)).executeAfter-bBlock.timestamp,259_200n);
  const cancel=buildCancelRecoveryTx(wallet,await nonce(),[MODULE_A,MODULE_B]);
  assert.equal(classifyTransaction(wallet,cancel).class,'Protective'); await exec(ownerSeed,cancel);
  for (const module of [MODULE_A,MODULE_B]) assert.equal((await getRequest(module)).executeAfter,0n);
  mark('both-module pending requests cancelled in one owner-signed protective batch');
  for (const module of [MODULE_A,MODULE_B]) {
    const req=await request(module);
    const helpers=await Promise.all([signRecovery(DEV_KEYS.partner,req),signRecovery(DEV_KEYS.sq,req)]);
    await assert.rejects(publicClient.call({account:DEV_ADDRESSES.relayer,to:module,data:encodeRecoveryCall(req,helpers)}),/Signer not a guardian|confirmed signatures less than threshold/);
  }
  mark('partner + Swissquote without card refused by both contracts');
  const started=await start(MODULE_A,DEV_KEYS.partner); const pending=await getRequest(MODULE_A);
  const block=await publicClient.getBlock({blockNumber:started.blockNumber});
  assert.equal(pending.executeAfter-block.timestamp,180n);
  const finalize=encodeFunctionData({abi:moduleAbi,functionName:'finalizeRecovery',args:[wallet]});
  await assert.rejects(publicClient.call({account:DEV_ADDRESSES.relayer,to:MODULE_A,data:finalize}),/recovery period still pending/);
  await localRpc(rpcUrl,'evm_setNextBlockTimestamp',[Number(pending.executeAfter-1n)]); await localRpc(rpcUrl,'evm_mine');
  await assert.rejects(publicClient.call({account:DEV_ADDRESSES.relayer,to:MODULE_A,data:finalize}),/recovery period still pending/);
  await localRpc(rpcUrl,'evm_setNextBlockTimestamp',[Number(pending.executeAfter)]); await localRpc(rpcUrl,'evm_mine'); await send(MODULE_A,finalize);
  assert.deepEqual((await publicClient.readContract({address:wallet,abi:safeAbi,functionName:'getOwners'})).map(a=>a.toLowerCase()),[newOwner.toLowerCase()]);
  await assert.rejects(exec(ownerSeed,await payment(ownerSeed,1n)),/GS026/);
  mark('genuine 180-second contract delay via EVM time advance, recovered owner, old key GS026');
  const oldCode=await generateKitCode(); const oldKit=await createKit(ownerSeed,oldCode,{wallet,owner,chainId:LOCAL_CHAIN_ID});
  await assert.rejects(sweepKit({kit:oldKit,code:oldCode,destination:DEV_ADDRESSES.recipient,rpcUrls:[rpcUrl],funderPrivateKey:DEV_KEYS.relayer}),/no longer controls/);
  const kitCode=await generateKitCode(); const kit=await createKit(newSeed,kitCode,{wallet,owner:newOwner,chainId:LOCAL_CHAIN_ID});
  assert.equal((await openKit(kit,kitCode)).mnemonic,newSeed);
  await assert.rejects(openKit(kit,await generateKitCode()));
  const sweep=await sweepKit({kit,code:kitCode,destination:DEV_ADDRESSES.recipient,rpcUrls:[rpcUrl],funderPrivateKey:DEV_KEYS.relayer}); assert.equal(sweep.amount,'5000000');
  mark('kit authenticated encryption/decryption, stale kit refused, public-RPC-only sweep with no services');
  const rotate=buildRotateOwnerTx(wallet,newOwner,rotatedOwner,await nonce()); assert.equal(classifyTransaction(wallet,rotate).class,'Admin'); await exec(newSeed,rotate);
  await assert.rejects(exec(newSeed,await payment(newSeed,1n)),/GS026/);
  const rotatedCode=await generateKitCode(); const rotatedKit=await createKit(rotatedSeed,rotatedCode,{wallet,owner:rotatedOwner,chainId:LOCAL_CHAIN_ID}); assert.equal((await openKit(rotatedKit,rotatedCode)).owner,rotatedOwner);
  mark('owner rotation and replacement kit; previous owner GS026');
  return {wallet,checks};
}
if(isMain(import.meta.url)) runStory(process.env.RPC_URLS?.split(',')[0]??DEV_RPC).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
