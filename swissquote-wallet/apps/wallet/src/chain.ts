import { createPublicClient, fallback, http, encodeFunctionData, decodeEventLog, isAddress, parseUnits, type Address, type Hex } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import { ADDRESSES, safeAbi, moduleAbi, erc20Abi, makeSafeTx, type SafeTx } from '@sq/protocol';
export const chainId = import.meta.env?.VITE_CHAIN === 'sepolia' ? 11155111 : 31337;
// Two independent public Sepolia nodes (both allow browser CORS); rpc.sepolia.org is dead.
export const DEFAULT_SEPOLIA_RPC_URLS = 'https://ethereum-sepolia-rpc.publicnode.com,https://rpc.sepolia.ethpandaops.io';
const urls: string[] = (import.meta.env?.VITE_RPC_URLS || (chainId === 31337 ? 'http://127.0.0.1:8645,http://localhost:8645' : DEFAULT_SEPOLIA_RPC_URLS)).split(',').map((url: string) => url.trim()).filter(Boolean);
export const client = createPublicClient({ chain: chainId === 31337 ? hardhat : sepolia, transport: fallback(urls.map((url: string) => http(url, { timeout: 12000, retryCount: 1 }))) });
const recoveryClients = [...new Set(urls)].map(url => createPublicClient({ chain: chainId === 31337 ? hardhat : sepolia, transport: http(url, { timeout: 12000, retryCount: 1 }) }));
export interface PendingRecovery { module: Address; label: string; newOwners: readonly Address[]; executeAfter: bigint }
export function validatedAddress(value: string): Address {
  if (!isAddress(value)) throw new Error('Enter a valid Ethereum address, starting with 0x.');
  if (/^0x0{40}$/i.test(value)) throw new Error('The zero address cannot receive this action.');
  return value;
}
export function usdcAmount(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) throw new Error('Enter a positive USDC amount with at most 6 decimal places.');
  const amount = parseUnits(value, 6);
  if (amount <= 0n) throw new Error('The amount must be greater than zero.');
  return amount;
}
export async function nonce(wallet: Address): Promise<bigint> { const blockNumber = confirmedBlock === undefined ? undefined : await waitForBlockOn(client, confirmedBlock); return client.readContract({ address: wallet, abi: safeAbi, functionName: 'nonce', ...(blockNumber === undefined ? {} : { blockNumber }) }); }
export async function owners(wallet: Address): Promise<readonly Address[]> { const blockNumber = confirmedBlock === undefined ? undefined : await waitForBlockOn(client, confirmedBlock); return client.readContract({ address: wallet, abi: safeAbi, functionName: 'getOwners', ...(blockNumber === undefined ? {} : { blockNumber }) }); }
export async function paymentTx(wallet: Address, recipient: string, amount: string): Promise<SafeTx> {
  return makeSafeTx({ to: ADDRESSES.usdc, nonce: await nonce(wallet), data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [validatedAddress(recipient), usdcAmount(amount)] }) });
}
export const SEPOLIA_RECEIPT_TIMEOUT_MS = 180000;
export function etherscanTxUrl(hash: Hex): string { return `https://sepolia.etherscan.io/tx/${hash}`; }
/** Sepolia only: no receipt was seen in time. The transaction may still confirm, so this is neither success nor failure. */
export class PendingTransactionError extends Error {
  readonly hash: Hex; readonly explorerUrl: string;
  constructor(hash: Hex) { const explorerUrl = etherscanTxUrl(hash); super(`Transaction pending — check Etherscan: ${explorerUrl}`); this.name = 'PendingTransactionError'; this.hash = hash; this.explorerUrl = explorerUrl; }
}
let confirmedBlock: bigint | undefined;
export async function confirmed(hash: Hex, safeWallet?: Address): Promise<void> {
  await confirmedOn(client, chainId, hash, safeWallet, block => { confirmedBlock = block; });
}
/** Never follow a receipt with state from an older load-balanced node. */
export async function waitForBlockOn(rpc: { getBlockNumber(args?: { cacheTime: number }): Promise<bigint> }, minimum: bigint, timeoutMs = 30000): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  do {
    const head = await rpc.getBlockNumber({ cacheTime: 0 });
    if (head >= minimum) return head;
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(500, Math.max(0, deadline - Date.now()))));
  } while (Date.now() <= deadline);
  throw new Error('Public node has not caught up with the confirmed transaction; retry the wallet check.');
}
export async function confirmedOn(rpc: Pick<typeof client, 'waitForTransactionReceipt'>, network: number, hash: Hex, safeWallet?: Address, onConfirmed?: (block: bigint) => void): Promise<void> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('The service did not return a valid transaction hash.');
  let receipt: Awaited<ReturnType<typeof client.waitForTransactionReceipt>>;
  try { receipt = await rpc.waitForTransactionReceipt({ hash, timeout: network === 11155111 ? SEPOLIA_RECEIPT_TIMEOUT_MS : 90000 }); }
  catch (error) {
    // Sepolia: a missing receipt (timeout or public-node error) is reported as pending, never as failure or success.
    if (network === 11155111) throw new PendingTransactionError(hash);
    throw error;
  }
  // A receipt exists: keep the strict checks.
  if (receipt.status !== 'success') throw new Error('The chain transaction reverted. Wallet state was not changed.');
  if (safeWallet) {
    const events = receipt.logs.filter(log => log.address.toLowerCase() === safeWallet.toLowerCase()).flatMap(log => {
      try { return [decodeEventLog({ abi: safeAbi, data: log.data, topics: log.topics }).eventName]; } catch { return []; }
    });
    if (events.includes('ExecutionFailure')) throw new Error('Safe execution failed inside a successful network receipt. No successful payment was confirmed.');
    if (!events.includes('ExecutionSuccess')) throw new Error('The receipt does not prove successful Safe execution. Inspect chain state before retrying.');
  }
  onConfirmed?.(receipt.blockNumber);
}
// Recovery reads use public RPC transports, independent of the Swissquote service.
export async function readPending(wallet: Address, modules: readonly { address: Address; label: string }[]): Promise<PendingRecovery[]> {
  if (recoveryClients.length < 2) throw new Error('Configure two RPC URLs to check recovery independently.');
  // Pin one block so node lag cannot masquerade as a contradictory request.
  const blocks = await Promise.all(recoveryClients.slice(0, 2).map(rpc => confirmedBlock === undefined ? rpc.getBlockNumber({ cacheTime: 0 }) : waitForBlockOn(rpc, confirmedBlock)));
  const blockNumber = blocks.reduce((a, b) => a < b ? a : b);
  const snapshots = await Promise.all(recoveryClients.slice(0, 2).map(rpc => Promise.all(modules.map(async module => {
    const record = await rpc.readContract({ address: module.address, abi: moduleAbi, functionName: 'getRecoveryRequest', args: [wallet], blockNumber });
    return { module: module.address, label: module.label, newOwners: record.newOwners, executeAfter: record.executeAfter };
  }))));
  const serialize = (value: unknown) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item);
  if (serialize(snapshots[0]) !== serialize(snapshots[1])) throw new Error('Public nodes disagree about recovery. Status is unknown; do not assume requests are clear.');
  return snapshots[0].filter(value => value.executeAfter > 0n);
}
export function countdown(executeAfter: bigint, now = Date.now()): string {
  const seconds = Math.max(0, Number(executeAfter) - Math.floor(now / 1000));
  if (seconds === 0) return 'Ready to finalize';
  const days = Math.floor(seconds / 86400); const hours = Math.floor(seconds % 86400 / 3600); const minutes = Math.floor(seconds % 3600 / 60);
  return `${days ? `${days}d ` : ''}${hours ? `${hours}h ` : ''}${minutes}m ${seconds % 60}s`;
}
