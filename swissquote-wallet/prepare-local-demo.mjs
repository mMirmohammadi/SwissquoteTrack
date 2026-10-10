// Local-only MOCK bank liquidity. Never run against a public chain.
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
const transport = http('http://127.0.0.1:8545');
const client = createPublicClient({ chain: hardhat, transport });
if (await client.getChainId() !== 31337) throw new Error('Local chain 31337 required');
const account = privateKeyToAccount(keccak256(stringToHex('sq-local-only/account')));
const relayer = privateKeyToAccount(keccak256(stringToHex('sq-local-only/relayer')));
const token = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
];
const balance = await client.readContract({ address: token, abi, functionName: 'balanceOf', args: [account.address] });
const target = 1_000_000_000n;
if (balance < target) {
  const wallet = createWalletClient({ account: relayer, chain: hardhat, transport });
  const hash = await wallet.writeContract({ address: token, abi, functionName: 'mint', args: [account.address, target - balance] });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('MOCK liquidity mint failed');
}
console.log('LOCAL MOCK bank has at least 1000 test USDC; no public-chain transaction sent.');
