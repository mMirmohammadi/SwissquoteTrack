// Read-only. Supply a PUBLIC relayer address and optional last-submission hash; no key files are read.
import { createPublicClient, fallback, http, isAddress } from 'viem';
import { sepolia } from 'viem/chains';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function relayerStatus(client, address, lastHash) {
  if (!isAddress(address)) throw new Error('Provide the public relayer address, not a private key.');
  if (lastHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(lastHash)) throw new Error('Invalid last transaction hash.');
  if (await client.getChainId() !== 11155111) throw new Error('RPC chain mismatch: expected Sepolia.');
  const [latest, pending] = await Promise.all([
    client.getTransactionCount({ address, blockTag: 'latest' }),
    client.getTransactionCount({ address, blockTag: 'pending' }),
  ]);
  const receipt = lastHash ? await client.getTransactionReceipt({ hash: lastHash }).catch(() => undefined) : undefined;
  return { address, latest, pending, lastTransactionHash: lastHash ?? null, lastTransactionStatus: receipt?.status ?? (lastHash ? 'pending-or-unknown' : 'not-supplied') };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const urls = (process.env.SEPOLIA_RPC_URLS ?? 'https://ethereum-sepolia-rpc.publicnode.com,https://rpc.sepolia.ethpandaops.io').split(',').map(url => url.trim()).filter(Boolean);
  const client = createPublicClient({ chain: sepolia, transport: fallback(urls.map(url => http(url, { timeout: 10000, retryCount: 1 }))) });
  await relayerStatus(client, process.argv[2], process.argv[3]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
