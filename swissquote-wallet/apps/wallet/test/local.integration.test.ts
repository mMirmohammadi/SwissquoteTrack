import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { type Address, type Hex, formatUnits } from 'viem';
import { ADDRESSES, factoryAbi, erc20Abi, generateOwnerSeed, mnemonicToAddress, mnemonicToPrivateKey, randomSaltNonce, buildWalletInitializer, computeWalletAddress, encodeCode, signOwnershipProof, signSafeTx, safeTxToWire, buildRotateOwnerTx, type SessionResponse, type GuardianEnrollResponse, type DeployResponse, type WalletResponse, type TransactionResponse } from '@sq/protocol';
import { call } from '../src/api';
import { client, paymentTx, confirmed, nonce, readPending } from '../src/chain';

test('actual local service create → proof → fund → owner payment; admin cannot use password', {skip: process.env.RUN_LOCAL_WALLET_INTEGRATION !== '1'}, async () => {
  assert.equal(await client.getChainId(), 31337, 'Only local transactions are authorized for this test');
  const email = `wallet-lane-${Date.now()}@example.test`;
  const session = await call<SessionResponse>('/auth/password/register', {body:{email,password:'local-test-password-123'}}); const token=session.token;
  await call('/kyc/mock-verify',{token,body:{}});
  const sq = await call<GuardianEnrollResponse>('/guardian/enroll',{token,body:{}});
  const partner = await call<GuardianEnrollResponse>('/enroll',{partner:true,body:{userRef:session.userRef,mockFace:'wallet-lane-test-face'}});
  // The test passes only a public card address to the wallet, never card words.
  const cardGuardian = privateKeyToAccount(generatePrivateKey()).address;
  const seed = generateOwnerSeed(); const owner = mnemonicToAddress(seed);
  const setup={owner,cardGuardian,partnerGuardian:partner.guardian,sqGuardian:sq.guardian,saltNonce:randomSaltNonce(),chainId:31337};
  const proxy = await client.readContract({address:ADDRESSES.factory,abi:factoryAbi,functionName:'proxyCreationCode'});
  const wallet = computeWalletAddress(setup,proxy);
  const deployed=await call<DeployResponse>('/relay/deploy',{token,body:{...setup,saltNonce:setup.saltNonce.toString(),wallet,initializer:buildWalletInitializer(setup)}});
  assert.equal(deployed.wallet.toLowerCase(),wallet.toLowerCase()); await confirmed(deployed.transactionHash);
  const setupCode=encodeCode({v:1,kind:'setup',chainId:31337,wallet,owner,partnerGuardian:partner.guardian,sqGuardian:sq.guardian,saltNonce:setup.saltNonce.toString()});
  const challenge=await call<{nonce:string}>('/wallets/challenge',{token,body:{wallet}});
  const proof=await signOwnershipProof(mnemonicToPrivateKey(seed),session.clientId,wallet.toLowerCase() as Address,challenge.nonce,31337);
  const registered=await call<WalletResponse>('/wallets',{token,body:{setupCode,cardGuardian,ownershipProof:{...proof,nonce:challenge.nonce}}}); assert.equal(registered.verified,true);
  assert.equal((await readPending(wallet,[{address:ADDRESSES.moduleA,label:'A'},{address:ADDRESSES.moduleB,label:'B'}])).length,0);
  const funding=await call<TransactionResponse>('/account/withdraw',{token,body:{to:wallet,amount:'3000000'}}); await confirmed(funding.transactionHash);
  assert.equal(await client.getBalance({address:wallet}),0n);
  const recipient=privateKeyToAccount(generatePrivateKey()).address;
  const tx=await paymentTx(wallet,recipient,'2'); const signature=await signSafeTx(mnemonicToPrivateKey(seed),wallet,tx,31337);
  const payment=await call<TransactionResponse>('/relay/safe-tx',{token,body:{wallet,tx:safeTxToWire(tx),signature,source:'payment',chainId:31337}}); await confirmed(payment.transactionHash,wallet);
  assert.equal(formatUnits(await client.readContract({address:ADDRESSES.usdc,abi:erc20Abi,functionName:'balanceOf',args:[recipient]}),6),'2');
  const rotate=buildRotateOwnerTx(wallet,owner,privateKeyToAccount(generatePrivateKey()).address,await nonce(wallet));
  const rotateSig=await signSafeTx(mnemonicToPrivateKey(seed),wallet,rotate,31337);
  await assert.rejects(call('/relay/safe-tx',{token,body:{wallet,tx:safeTxToWire(rotate),signature:rotateSig,source:'settings'}}),/passkey required/i);
});
