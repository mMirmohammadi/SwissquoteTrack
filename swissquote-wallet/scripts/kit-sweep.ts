import { readFile } from 'node:fs/promises';
import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem';
import { openKit, mnemonicToPrivateKey, makeSafeTx, signSafeTx, encodeExecTransaction, safeAbi, erc20Abi, type EmergencyKit } from '@sq/protocol';
import { clients, isMain, submit } from './runtime.js';
import { USDC_ADDRESS } from './devnet.js';

export interface SweepOptions { kit: EmergencyKit; code: string; destination: Address; rpcUrls: readonly string[]; funderPrivateKey: Hex; allowSepolia?: boolean }
/** Uses RPC only. Does not import or depend on a running wallet/bank/partner service. */
export async function sweepKit(options: SweepOptions) {
  const { kit, code, destination, rpcUrls, funderPrivateKey } = options;
  if (kit.chainId !== 31337 && !(kit.chainId === 11155111 && options.allowSepolia)) throw new Error('Sepolia sends disabled; explicit allowSepolia required outside this implementation session');
  const opened = await openKit(kit, code);
  const { publicClient } = clients(rpcUrls, kit.chainId);
  if (await publicClient.getChainId() !== kit.chainId) throw new Error('Kit/RPC chain mismatch');
  const owners = await publicClient.readContract({ address: kit.wallet, abi: safeAbi, functionName: 'getOwners' });
  if (owners.length !== 1 || getAddress(owners[0]) !== getAddress(opened.owner)) throw new Error('Kit owner no longer controls this wallet');
  if (getAddress(destination) === getAddress(kit.wallet)) throw new Error('Sweep destination must differ from wallet');
  const amount = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [kit.wallet] });
  if (!amount) throw new Error('No USDC to sweep');
  const nonce = await publicClient.readContract({ address: kit.wallet, abi: safeAbi, functionName: 'nonce' });
  const tx = makeSafeTx({ to: USDC_ADDRESS, nonce, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [destination, amount] }) });
  const signature = await signSafeTx(mnemonicToPrivateKey(opened.mnemonic), kit.wallet, tx, kit.chainId);
  const receipt = await submit(rpcUrls, kit.chainId, funderPrivateKey, kit.wallet, encodeExecTransaction(tx, signature));
  const remaining = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [kit.wallet] });
  if (remaining !== 0n) throw new Error('Sweep did not empty wallet');
  return { wallet: kit.wallet, destination, amount: amount.toString(), transactionHash: receipt.transactionHash };
}
if (isMain(import.meta.url)) {
  const [kitPath, destination] = process.argv.slice(2);
  if (!kitPath || !destination || !process.env.KIT_CODE || !process.env.FUNDER_PRIVATE_KEY || !process.env.RPC_URLS) {
    console.error('Usage: kit-sweep <kit.json> <destination>; env KIT_CODE, FUNDER_PRIVATE_KEY, RPC_URLS required. Public-chain sends are disabled by default.'); process.exitCode = 1;
  } else {
    readFile(kitPath, 'utf8').then(text => sweepKit({ kit: JSON.parse(text), code: process.env.KIT_CODE!, destination: getAddress(destination), rpcUrls: process.env.RPC_URLS!.split(','), funderPrivateKey: process.env.FUNDER_PRIVATE_KEY as Hex, allowSepolia: process.env.ALLOW_SEPOLIA_SWEEP === 'yes' })).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('Kit sweep failed; check kit/code, current ownership, RPC chain and funder gas. No secrets were logged.'); process.exitCode = 1; });
  }
}
