import { createPublicClient, createWalletClient, fallback, http, defineChain, encodeFunctionData, decodeFunctionResult, hashMessage, recoverTypedDataAddress, type PublicClient, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ADDRESSES, factoryAbi, safeAbi, moduleAbi, erc20Abi, buildDeployCall, computeWalletAddress, hashSafeTx, safeTxTypedData, encodeExecTransaction, encodeRecoveryCall, assertRecoveryHash, signRecovery, verifyOwnershipProof, verifyWallet, safeTxFromWire, type WalletSetup, type RecoveryRequest } from '@sq/protocol';
import type { ChainAdapter, ChainOperation, Setup, Recovery } from './types.ts';
import { ApiError, requireThat } from './policy.ts';
export interface ViemChainOptions { chainId:number; rpcUrls:readonly string[]; relayerPrivateKey:Hex; accountPrivateKey?:Hex; allowSepoliaWrites?:boolean; publicClient?:PublicClient }
export function createViemChain(options:ViemChainOptions):ChainAdapter {
  requireThat(options.chainId===31337||options.chainId===11155111,'Unsupported chain');requireThat(options.rpcUrls.length>=2,'Two RPC URLs required');
  const network=defineChain({id:options.chainId,name:options.chainId===31337?'Local Hardhat':'Sepolia',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[...options.rpcUrls]}}});
  const transport=fallback(options.rpcUrls.map(url=>http(url)));const publicClient=options.publicClient??createPublicClient({chain:network,transport});
  const relayer=privateKeyToAccount(options.relayerPrivateKey);const account=options.accountPrivateKey?privateKeyToAccount(options.accountPrivateKey):undefined;
  const walletClient=createWalletClient({chain:network,transport});
  const setup=(input:Setup):WalletSetup=>({...input,saltNonce:BigInt(input.saltNonce),chainId:options.chainId});
  const recovery=(input:Recovery):RecoveryRequest=>({...input,nonce:BigInt(input.nonce),chainId:options.chainId});
  const verifyChain=async()=>requireThat(await publicClient.getChainId()===options.chainId,'RPC chain mismatch',502);
  async function call(operation:ChainOperation) {
    let to:Hex;let data:Hex;let sender=relayer;
    switch(operation.kind) {
      case 'deploy': {const tx=buildDeployCall(setup(operation.setup));to=tx.address;data=encodeFunctionData(tx);break;}
      case 'safe-tx':to=operation.wallet;data=encodeExecTransaction(safeTxFromWire({...operation.tx,operation:operation.tx.operation as 0|1}),operation.signature);break;
      case 'recovery':to=operation.request.module;data=encodeRecoveryCall(recovery(operation.request),operation.request.approvals??[]);break;
      case 'finalize':to=operation.module;data=encodeFunctionData({abi:moduleAbi,functionName:'finalizeRecovery',args:[operation.wallet]});break;
      case 'withdraw':requireThat(account,'MOCK account key not configured',503);sender=account;to=ADDRESSES.usdc;data=encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[operation.to,BigInt(operation.amount)]});break;
    }
    return {account:sender,to,data,value:0n};
  }
  return {
    chainId:options.chainId,
    async computeWallet(input) {await verifyChain();const code=await publicClient.readContract({address:ADDRESSES.factory,abi:factoryAbi,functionName:'proxyCreationCode'});return computeWalletAddress(setup(input),code);},
    async verifyWallet(input,verificationOptions) {await verifyChain();const result=await verifyWallet(publicClient,setup(input),{...verificationOptions,expectedWallet:input.wallet});return result.ok;},
    async verifyOwnership(wallet,message,signature) {await verifyChain();return verifyOwnershipProof(publicClient,wallet,hashMessage(message),signature);},
    async safeTxHash(wallet,tx) {await verifyChain();return hashSafeTx(wallet,safeTxFromWire({...tx,operation:tx.operation as 0|1}),options.chainId);},
    async verifyOwnerSignature(wallet,tx,signature) {
      await verifyChain();try {
        requireThat(/^0x[0-9a-f]{130}$/i.test(signature),'Exactly one EIP-712 owner signature required');
        const signer=await recoverTypedDataAddress({...safeTxTypedData(wallet,safeTxFromWire({...tx,operation:tx.operation as 0|1}),options.chainId),signature});
        const owners=await publicClient.readContract({address:wallet,abi:safeAbi,functionName:'getOwners'});const threshold=await publicClient.readContract({address:wallet,abi:safeAbi,functionName:'getThreshold'});
        return threshold===1n&&owners.length===1&&owners[0].toLowerCase()===signer.toLowerCase();
      } catch {return false;}
    },
    async safeNonce(wallet) {await verifyChain();return (await publicClient.readContract({address:wallet,abi:safeAbi,functionName:'nonce'})).toString();},
    async recoveryHash(input) {await verifyChain();await assertRecoveryHash(publicClient,recovery(input));return publicClient.readContract({address:input.module,abi:moduleAbi,functionName:'getRecoveryHash',args:[input.wallet,[input.newOwner],1n,BigInt(input.nonce)]});},
    async isGuardian(wallet,module,guardian) {await verifyChain();return publicClient.readContract({address:module,abi:moduleAbi,functionName:'isGuardian',args:[wallet,guardian]});},
    async signRecovery(input,key) {await assertRecoveryHash(publicClient,recovery(input));return (await signRecovery(key,recovery(input))).signature;},
    async simulate(operation) {await verifyChain();const tx=await call(operation);const result=await publicClient.call(tx);
      if(operation.kind==='safe-tx') requireThat(result.data&&decodeFunctionResult({abi:safeAbi,functionName:'execTransaction',data:result.data})===true,'Safe simulation returned false',403);
      if(operation.kind==='withdraw') requireThat(result.data&&decodeFunctionResult({abi:erc20Abi,functionName:'transfer',data:result.data})===true,'Token transfer simulation returned false',403);
    },
    async estimateGas(operation) {await verifyChain();return publicClient.estimateGas(await call(operation));},
    async send(operation,gas) {await verifyChain();if(options.chainId===11155111&&!options.allowSepoliaWrites) throw new ApiError(403,'Sepolia writes disabled; explicit authorization required');const tx=await call(operation);return walletClient.sendTransaction({...tx,chain:network,gas});},
  };
}
