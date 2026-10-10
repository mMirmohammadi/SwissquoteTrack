import { decodeEventLog, encodeFunctionData, parseUnits, type Address, type Hex, type PublicClient } from 'viem';
import { ADDRESSES, DAPP_ADDRESSES, USDC_LIMIT, checkDappBatch, compoundAbi, dappTokenAbi, encodeMultiSend, erc20Abi, makeSafeTx, multiSendAbi, routerAbi, safeAbi, type DappEntry, type DappPreviewResponse, type MultiSendCall, type SafeTx } from '@sq/protocol';

export type DappOperation = 'swap' | 'supply' | 'withdraw';
export function buildDappTx(wallet: Address, operation: DappOperation, amount: bigint, nonce: bigint, quote?: bigint): SafeTx {
  if (amount <= 0n || amount > USDC_LIMIT) throw new Error('This test demo supports at most 5 USDC per action.');
  const spender = operation === 'swap' ? DAPP_ADDRESSES.uniswap : DAPP_ADDRESSES.compound;
  let action: MultiSendCall;
  if (operation === 'swap') {
    if (quote === undefined || quote * 100n < amount * 80n || quote > amount) {
      throw new Error('Fresh quote unavailable or outside the demo range (0.80–1.00 EURC per USDC). Signing is disabled.');
    }
    const minimumOutput = (quote * 99n + 99n) / 100n;
    action = { to: spender, value: 0n, operation: 0, data: encodeFunctionData({ abi: routerAbi, functionName: 'exactInputSingle', args: [{ tokenIn: DAPP_ADDRESSES.usdc, tokenOut: DAPP_ADDRESSES.eurc, fee: 500, recipient: wallet, amountIn: amount, amountOutMinimum: minimumOutput, sqrtPriceLimitX96: 0n }] }) };
  } else {
    action = { to: spender, value: 0n, operation: 0, data: encodeFunctionData({ abi: compoundAbi, functionName: operation, args: [DAPP_ADDRESSES.usdc, amount] }) };
  }
  const approval = (value: bigint): MultiSendCall => ({ to: DAPP_ADDRESSES.usdc, value: 0n, operation: 0, data: encodeFunctionData({ abi: dappTokenAbi, functionName: 'approve', args: [spender, value] }) });
  const calls = operation === 'withdraw' ? [action] : [approval(amount), action, approval(0n)];
  const check = checkDappBatch(wallet, calls);
  if (!check.ok) throw new Error(check.reasons.join(' ') || 'This batch is not sponsored.');
  return makeSafeTx({ to: ADDRESSES.multiSendCallOnly, nonce, operation: 1, data: encodeFunctionData({ abi: multiSendAbi, functionName: 'multiSend', args: [encodeMultiSend(calls)] }) });
}

export const RISK_NOTICE = 'Not a bank deposit. Not covered by depositor protection. Smart-contract risk: you can lose this amount. Swissquote does not advise on this.';
export const SEPOLIA_CHAIN_ID = 11155111;

export function parseAmount(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
    throw new Error('Enter a positive USDC amount with at most 6 decimal places.');
  }
  const amount = parseUnits(value, 6);
  if (amount <= 0n || amount >= 2n ** 256n) throw new Error('Enter a positive amount within the token limit.');
  return amount;
}

/** Never treat arbitrary HTTP data or an empty summary as an authorization to sign. */
export function checkedPreview(value: unknown, dappId: string): DappPreviewResponse {
  if (!value || typeof value !== 'object') throw new Error('Preview unavailable. Nothing was signed.');
  const preview = value as Partial<DappPreviewResponse>;
  if (preview.dappId !== dappId || !Array.isArray(preview.summary) || !preview.summary.length ||
      !preview.summary.every(line => typeof line === 'string' && line.trim().length > 0) ||
      typeof preview.effectsHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(preview.effectsHash) ||
      typeof preview.blockNumber !== 'string' || !/^(0|[1-9]\d*)$/.test(preview.blockNumber) ||
      !Array.isArray(preview.warnings) || !preview.warnings.every(line => typeof line === 'string')) {
    throw new Error('The service returned an incomplete or mismatched preview. Nothing was signed.');
  }
  return preview as DappPreviewResponse;
}

/** Server availability is not enough: intersect it with this build's pinned registry. */
export function checkedRegistry(value: unknown, pinned: readonly DappEntry[], chainId: number): DappEntry[] {
  const entries = Array.isArray(value) ? value : value && typeof value === 'object' && 'dapps' in value ? value.dapps : undefined;
  if (!Array.isArray(entries)) throw new Error('The dApp registry is unavailable. Signing is disabled.');
  return pinned.filter(local => local.chainId === chainId && entries.some(remote =>
    remote && typeof remote === 'object' && remote.id === local.id && remote.chainId === local.chainId &&
    typeof remote.address === 'string' && remote.address.toLowerCase() === local.address.toLowerCase()));
}

export function verifySafeReceipt(receipt: { status: string; logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[] }, wallet: Address): void {
  if (receipt.status !== 'success') throw new Error('The network transaction reverted. No successful DeFi action was confirmed.');
  const events = receipt.logs.filter(log => log.address.toLowerCase() === wallet.toLowerCase()).flatMap(log => {
    try { return [decodeEventLog({ abi: safeAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] }).eventName]; }
    catch { return []; }
  });
  if (events.includes('ExecutionFailure') || !events.includes('ExecutionSuccess')) {
    throw new Error('The receipt does not prove successful Safe execution. Inspect chain state before retrying.');
  }
}

export async function confirmedPermission(client: PublicClient, wallet: Address, token: Address, spender: Address, blockNumber: bigint): Promise<bigint> {
  // Reading at the receipt block prevents a lagging node from reporting the pre-transaction allowance.
  return client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [wallet, spender], blockNumber });
}
