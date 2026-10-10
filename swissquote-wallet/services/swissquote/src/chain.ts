import { setTimeout as sleep } from 'node:timers/promises';
import { createPublicClient, createWalletClient, fallback, http, defineChain, encodeFunctionData, decodeFunctionResult, hashMessage, recoverTypedDataAddress, formatGwei, type PublicClient, type WalletClient, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createNonceManager, jsonRpc } from 'viem/nonce';
import { ADDRESSES, HISTORY_RPC_URLS, factoryAbi, safeAbi, moduleAbi, erc20Abi, buildDeployCall, computeWalletAddress, hashSafeTx, classifyTransaction, safeTxTypedData, encodeExecTransaction, encodeRecoveryCall, assertRecoveryHash, signRecovery, verifyOwnershipProof, verifyWallet, safeTxFromWire, type WalletSetup, type RecoveryRequest } from '@sq/protocol';
import { ChainPrebroadcastError, type ChainAdapter, type ChainOperation, type Setup, type Recovery } from './types.ts';
import { ApiError, requireThat } from './policy.ts';
import { registrationClient, registrationContext, registrationRead, registrationUnavailable, setRegistrationRecheck, withRegistrationReads, pacedFetch, REGISTRATION_BARRIER_MS, REGISTRATION_POLL_MS, REGISTRATION_MAX_AHEAD, type RegistrationClock } from './registration-reads.ts';
export interface ViemChainOptions { chainId:number; rpcUrls:readonly string[]; relayerPrivateKey:Hex; accountPrivateKey?:Hex; allowSepoliaWrites?:boolean; publicClient?:PublicClient; historyClient?:PublicClient; walletClient?:WalletClient; simulationRetryDelayMs?:number; registrationClock?:RegistrationClock }
export const SEPOLIA_MIN_TIP=10_000_000n; // 0.01 gwei priority-fee floor
export const SEPOLIA_MAX_FEE_CAP=20_000_000_000n; // 20 gwei: refuse to send rather than drain the relayer
export const SEPOLIA_CANCEL_MAX_FEE_CAP=100_000_000_000n; // owner-signed protective cancels only
export function isProtectiveCancel(operation:ChainOperation):boolean {
  if(operation.kind!=='safe-tx') return false;
  try {
    const tx=safeTxFromWire({...operation.tx,operation:operation.tx.operation as 0|1});
    const classification=classifyTransaction(operation.wallet,tx);
    return classification.class==='Protective'&&classification.relayAllowed;
  } catch {return false;}
}
export const SIMULATION_RETRY_DELAY_MS=3000; // a load-balanced Sepolia RPC node can lag one block
/** Sepolia fee rule: tip = max(node suggestion, 0.01 gwei); max fee = 2 × base fee + tip; refuse above 20 gwei. */
export function sepoliaFees(baseFeePerGas:bigint,suggestedTip:bigint,protectiveCancel=false) {
   requireThat(baseFeePerGas>=0n&&suggestedTip>=0n,'Invalid Sepolia fee quote',503);
   const cap=protectiveCancel?SEPOLIA_CANCEL_MAX_FEE_CAP:SEPOLIA_MAX_FEE_CAP;
  const maxPriorityFeePerGas=suggestedTip>SEPOLIA_MIN_TIP?suggestedTip:SEPOLIA_MIN_TIP;const maxFeePerGas=2n*baseFeePerGas+maxPriorityFeePerGas;
  if(maxFeePerGas>cap) throw new ApiError(503,`Sepolia network fee too high: max fee ${formatGwei(maxFeePerGas)} gwei is above the ${formatGwei(cap)} gwei safety cap; nothing was sent`);
  return {maxFeePerGas,maxPriorityFeePerGas};
}
export function createViemChain(options:ViemChainOptions):ChainAdapter {
  requireThat(options.chainId===31337||options.chainId===11155111,'Unsupported chain');requireThat(options.rpcUrls.length>=2,'Two RPC URLs required');
  const network=defineChain({id:options.chainId,name:options.chainId===31337?'Local Hardhat':'Sepolia',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[...options.rpcUrls]}}});
  const transport=fallback(options.rpcUrls.map(url=>http(url)));
  // Sepolia only: one in-process nonce manager for RELAYER and SQ_ACCOUNT, so a lagging RPC node cannot hand out a used nonce.
  const sepolia=options.chainId===11155111;const nonceManager=sepolia?createNonceManager({source:jsonRpc()}):undefined;
  const endpointFetches=new Map<string,typeof fetch>();
  const readHttp=(url:string,history=false)=> {
    if(!sepolia) return http(url);
    const endpoint=new URL(url).href;
    let fetchFn=endpointFetches.get(endpoint);if(!fetchFn) {fetchFn=pacedFetch(fetch,options.registrationClock);endpointFetches.set(endpoint,fetchFn);}
    return http(url,{fetchFn,timeout:12000,retryCount:history?1:3});
  };
  const publicClient=options.publicClient??createPublicClient({chain:network,transport});
  const historyClient=options.historyClient??(sepolia&&!options.publicClient?createPublicClient({chain:network,transport:fallback(HISTORY_RPC_URLS.map(url=>http(url,{timeout:12000,retryCount:1})))}):publicClient);
  // Registration-only read transports: leave sender, simulation, fee and gas paths untouched.
  const publicReads=options.publicClient??(sepolia?createPublicClient({chain:network,transport:fallback(options.rpcUrls.map(url=>readHttp(url)))}):publicClient);
  const historyReads=options.historyClient??(sepolia&&!options.publicClient?createPublicClient({chain:network,transport:fallback(HISTORY_RPC_URLS.map(url=>readHttp(url,true)))}):publicReads);
  const registrationPublic=registrationClient(publicReads);const registrationHistory=historyReads===publicReads?registrationPublic:registrationClient(historyReads);
  const relayer=privateKeyToAccount(options.relayerPrivateKey,{nonceManager});const account=options.accountPrivateKey?privateKeyToAccount(options.accountPrivateKey,{nonceManager}):undefined;
  const walletClient:WalletClient=options.walletClient??createWalletClient({chain:network,transport});
  const quoteFees=async(operation:ChainOperation)=> {
    const [block,tip]=await Promise.all([publicClient.getBlock({blockTag:'latest'}),publicClient.estimateMaxPriorityFeePerGas().catch(()=>0n)]);
    requireThat(typeof block.baseFeePerGas==='bigint','Sepolia base fee unavailable; nothing was sent',503);
    try {return sepoliaFees(block.baseFeePerGas,tip,isProtectiveCancel(operation));} catch(error) {console.warn(`[swissquote] ${(error as Error).message}`);throw error;}
  };
  const setup=(input:Setup):WalletSetup=>({...input,saltNonce:BigInt(input.saltNonce),chainId:options.chainId});
  const recovery=(input:Recovery):RecoveryRequest=>({...input,nonce:BigInt(input.nonce),chainId:options.chainId});
  const verifyChain=async()=> {
    if(!registrationContext()) return requireThat(await publicClient.getChainId()===options.chainId,'RPC chain mismatch',502);
    try {if(await registrationPublic.getChainId()!==options.chainId) throw registrationUnavailable('registration_chain_mismatch');}
    catch(error) {if(error instanceof ApiError) throw error;throw registrationUnavailable();}
  };
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
  async function simulateOnce(operation:ChainOperation) {await verifyChain();const tx=await call(operation);const result=await publicClient.call(tx);
    if(operation.kind==='safe-tx') requireThat(result.data&&decodeFunctionResult({abi:safeAbi,functionName:'execTransaction',data:result.data})===true,'Safe simulation returned false',403);
    if(operation.kind==='withdraw') requireThat(result.data&&decodeFunctionResult({abi:erc20Abi,functionName:'transfer',data:result.data})===true,'Token transfer simulation returned false',403);
  }
  return {
    chainId:options.chainId,
    async computeWallet(input) {await verifyChain();let code:Hex;try {code=await (registrationContext()?registrationPublic:publicClient).readContract({address:ADDRESSES.factory,abi:factoryAbi,functionName:'proxyCreationCode'});} catch(error) {if(registrationContext()) throw registrationUnavailable();throw error;}return computeWalletAddress(setup(input),code);},
    async registrationBlock(minimumBlockNumber) {
      const barrier=async()=> {
        const context=registrationContext()!;
        const clients=historyReads===publicReads?[registrationPublic]:[registrationPublic,registrationHistory];
        const barrierDeadline=Math.min(context.deadline,context.clock.now()+REGISTRATION_BARRIER_MS);
        const bounded=<T>(fn:()=>Promise<T>)=>registrationRead(async()=> {const value=await fn();if(context.clock.now()>=barrierDeadline) throw registrationUnavailable('registration_deadline');return value;},barrierDeadline);
        try {
          const ids=await bounded(()=>Promise.all(clients.map(client=>client.getChainId())));
          if(ids.some(id=>id!==options.chainId)) throw registrationUnavailable('registration_chain_mismatch');
          const commonHead=async()=> {
            const heads=await bounded(()=>Promise.all(clients.map(client=>client.getBlockNumber({cacheTime:0}))));
            if(heads.some(head=>typeof head!=='bigint'||head<0n)) throw registrationUnavailable();
            return heads.reduce((a,b)=>a<b?a:b);
          };
          let blockNumber=await commonHead();
          if(minimumBlockNumber!==undefined&&(minimumBlockNumber<0n||minimumBlockNumber>(1n<<64n)-1n||minimumBlockNumber>blockNumber+REGISTRATION_MAX_AHEAD)) throw new ApiError(400,'minimumBlockNumber is too far ahead of the common head');
          while(minimumBlockNumber!==undefined&&blockNumber<minimumBlockNumber) {
            if(context.clock.now()+REGISTRATION_POLL_MS>=barrierDeadline) throw registrationUnavailable('registration_deadline');
            await bounded(()=>context.clock.sleep(REGISTRATION_POLL_MS));blockNumber=await commonHead();
          }
          const hashes=async()=> {
            const blocks=await registrationRead(()=>Promise.all(clients.map(client=>client.getBlock({blockNumber}))));
            const hashes=blocks.map(block=>block.hash?.toLowerCase());
            if(hashes.some(hash=>!hash||!/^0x[0-9a-f]{64}$/.test(hash))||hashes.some(hash=>hash!==hashes[0])) throw registrationUnavailable('registration_block_mismatch');
            return hashes[0]!;
          };
          const hash=await bounded(hashes);
          setRegistrationRecheck(async()=> {if(await hashes()!==hash) throw registrationUnavailable('registration_block_changed');});
          return blockNumber;
        } catch(error) {if(error instanceof ApiError) throw error;throw registrationUnavailable();}
      };
      return registrationContext()?barrier():withRegistrationReads(barrier,options.registrationClock);
    },
    async verifyWallet(input,verificationOptions) {await verifyChain();const client=registrationContext()?registrationHistory:historyClient;const result=await verifyWallet(client,setup(input),{...verificationOptions,expectedWallet:input.wallet});return result.ok;},
    async verifyOwnership(wallet,message,signature,verificationOptions) {await verifyChain();return verifyOwnershipProof(registrationContext()?registrationPublic:publicClient,wallet,hashMessage(message),signature,verificationOptions);},
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
    async simulate(operation) {
      if(!sepolia) return simulateOnce(operation);
      try {await simulateOnce(operation);} catch {
        console.warn('[swissquote] Sepolia pre-send simulation failed; retrying once in case the RPC node lags a block');
        await sleep(options.simulationRetryDelayMs??SIMULATION_RETRY_DELAY_MS);await simulateOnce(operation);
      }
    },
    // Sepolia: the fee cap is checked in preflight too, so a refusal is reported as "nothing broadcast".
    async estimateGas(operation) {await verifyChain();if(sepolia) await quoteFees(operation);return publicClient.estimateGas(await call(operation));},
    async receiptStatus(hash) {
      try {
        await verifyChain();const receipt=await publicClient.getTransactionReceipt({hash});
        if(receipt.transactionHash.toLowerCase()!==hash.toLowerCase()||typeof receipt.blockNumber!=='bigint'||receipt.blockNumber<0n||(receipt.status!=='success'&&receipt.status!=='reverted')) return {status:'unknown'};
        return {status:receipt.status==='success'?'confirmed':'reverted',blockNumber:receipt.blockNumber.toString()};
      } catch { // Not-found, transport failures and inconsistent nodes all leave the sender closed.
        return {status:'unknown'};
      }
    },
    async send(operation,gas) {
      let tx:Awaited<ReturnType<typeof call>>;let fees:Awaited<ReturnType<typeof quoteFees>>|undefined;
      try {
        await verifyChain();if(sepolia&&!options.allowSepoliaWrites) throw new ApiError(403,'Sepolia writes disabled; explicit authorization required');
        tx=await call(operation);if(sepolia) fees=await quoteFees(operation);
      } catch(error) {
        // The wallet send action has not been invoked: explicit proof this failure is pre-broadcast.
        throw new ChainPrebroadcastError(error instanceof ApiError?error.message:'Chain send preparation failed; nothing broadcast',error instanceof ApiError?error.status:503);
      }
      if(!sepolia) return walletClient.sendTransaction({...tx,chain:network,gas});
      // Never interpret a sendTransaction throw as proof of non-broadcast (viem may reset its nonce manager).
      return walletClient.sendTransaction({...tx,chain:network,chainId:network.id,gas,...fees});
    },
  };
}
