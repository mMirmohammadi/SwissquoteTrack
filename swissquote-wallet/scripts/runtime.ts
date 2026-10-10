import { createPublicClient, createWalletClient, fallback, http, type Address, type Hex } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { pathToFileURL } from 'node:url';

export function isMain(url: string): boolean { return !!process.argv[1] && pathToFileURL(process.argv[1]).href === url; }
export function clients(rpcUrls: readonly string[], chainId = 31337) {
  if (!rpcUrls.length || rpcUrls.some(url => !/^https?:\/\//.test(url))) throw new Error('At least one HTTP RPC URL is required');
  const chain = chainId === 31337 ? hardhat : chainId === 11155111 ? sepolia : undefined;
  if (!chain) throw new Error('Unsupported chain');
  const transport = fallback(rpcUrls.map(url => http(url)));
  return { publicClient: createPublicClient({ chain, transport }), walletClient: createWalletClient({ chain, transport }) };
}
export async function assertLocal(rpcUrl: string) {
  const c = clients([rpcUrl]);
  if (await c.publicClient.getChainId() !== 31337) throw new Error('Local-only script: refusing any chain other than 31337');
  return c;
}
export async function localRpc(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  await assertLocal(rpcUrl);
  const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const data = await response.json() as { result?: unknown; error?: { message: string } };
  if (!response.ok || data.error) throw new Error(data.error?.message ?? `RPC HTTP ${response.status}`);
  return data.result;
}
export async function submit(rpcUrls: readonly string[], chainId: number, funderPrivateKey: Hex, to: Address, data: Hex) {
  const { publicClient, walletClient } = clients(rpcUrls, chainId);
  if (await publicClient.getChainId() !== chainId) throw new Error('RPC chain mismatch');
  const account = privateKeyToAccount(funderPrivateKey);
  await publicClient.call({ account: account.address, to, data });
  const gas = await publicClient.estimateGas({ account, to, data });
  const hash = await walletClient.sendTransaction({ account, to, data, gas });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted');
  return receipt;
}
