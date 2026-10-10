import { decodeFunctionData, encodeFunctionData, type Address } from 'viem';
import { ADDRESSES, ETH_LIMIT, MODULES, USDC_LIMIT, ZERO_ADDRESS } from './constants.js';
import { erc20Abi, moduleAbi } from './abis.js';
import { decodeMultiSendCall, makeSafeTx } from './wallet.js';
import type { SafeTx, TransactionClassification } from './types.js';
import { checkDappBatch, DAPP_ADDRESSES } from './dapps.js';
const eq = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();
const cancelData = encodeFunctionData({ abi: moduleAbi, functionName: 'cancelRecovery' });
function result(kind: TransactionClassification['class'], reason: string, relayAllowed = true, recipients: Address[] = []): TransactionClassification {
  return { class: kind, reason, relayAllowed, recipients, requiresPasskey: kind === 'Admin' || kind === 'Large' };
}
export function classifyTransaction(wallet: Address, tx: SafeTx): TransactionClassification {
  if (tx.safeTxGas !== 0n || tx.baseGas !== 0n || tx.gasPrice !== 0n || !eq(tx.gasToken, ZERO_ADDRESS) || !eq(tx.refundReceiver, ZERO_ADDRESS)) return result('Admin', 'Nonzero Safe refund or gas fields are outside the sponsored template', false);
  return classify(wallet, tx, 0);
}
function classify(wallet: Address, tx: SafeTx, depth: number): TransactionClassification {
  if (depth > 8) return result('Admin', 'Batch nesting limit exceeded', false);
  if (tx.operation !== 0 && tx.operation !== 1) return result('Admin', 'Invalid operation', false);
  if (tx.operation === 1) {
    if (!eq(tx.to, ADDRESSES.multiSendCallOnly)) return result('Admin', 'Forbidden delegatecall target', false);
    if (tx.value !== 0n) return result('Admin', 'Batch must not send outer value', false);
    try {
      const calls = decodeMultiSendCall(tx.data);
      if (!calls.length) return result('Admin', 'Empty batch', false);
      if (calls.some(c => c.operation !== 0)) return result('Admin', 'Call-only batch contains delegatecall', false);
      const dapp = checkDappBatch(wallet, calls);
      if (dapp.ok) return result('Small', `Allow-listed ${dapp.dappId} batch; fresh simulation and screening required`, true, [wallet, ...calls.map(c => c.to)]);
      // Keep legacy payment/admin classifications; any batch containing DeFi or approvals must match the exact policy.
      const involvesDapp = calls.some(c => [DAPP_ADDRESSES.uniswap, DAPP_ADDRESSES.compound].some(a => eq(a, c.to)) || c.data.slice(0, 10).toLowerCase() === '0x095ea7b3');
      if (involvesDapp) return result('Admin', dapp.reasons.join('; '), false);
      const classes = calls.map(c => classify(wallet, makeSafeTx(c), depth + 1));
      if (classes.every(c => c.class === 'Protective')) return result('Protective', 'Cancel every selected pending recovery');
      const rank = { Protective: 0, Small: 1, Large: 2, Admin: 3 };
      const strictest = classes.reduce((a, b) => rank[a.class] >= rank[b.class] ? a : b);
      return { ...strictest, reason: `Batch: ${strictest.reason}`, relayAllowed: classes.every(c => c.relayAllowed), recipients: classes.flatMap(c => c.recipients) };
    } catch { return result('Admin', 'Malformed call-only batch', false); }
  }
  if ([DAPP_ADDRESSES.uniswap, DAPP_ADDRESSES.compound].some(a => eq(a, tx.to))) {
    const dapp = checkDappBatch(wallet, [{ to: tx.to, value: tx.value, operation: tx.operation, data: tx.data }]);
    return dapp.ok ? result('Small', 'Allow-listed Compound withdrawal; fresh simulation and screening required', true, [wallet, tx.to]) : result('Admin', dapp.reasons.join('; '), false);
  }
  if (MODULES.some(m => eq(m, tx.to)) && tx.value === 0n && tx.data.toLowerCase() === cancelData.toLowerCase()) return result('Protective', 'Cancel pending recovery');
  if (eq(wallet, tx.to) || MODULES.some(m => eq(m, tx.to))) return result('Admin', 'Wallet or recovery settings change');
  if (eq(tx.to, ADDRESSES.multiSendCallOnly) || eq(tx.to, ADDRESSES.multiSend)) return result('Admin', 'Batch must use authorized call-only delegatecall', false);
  if (tx.value > ETH_LIMIT) return result('Large', 'Native value exceeds demo limit', true, [tx.to]);
  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
    if (decoded.functionName === 'transfer') {
      const [recipient, amount] = decoded.args;
      const large = !eq(tx.to, ADDRESSES.usdc) || amount > USDC_LIMIT;
      return result(large ? 'Large' : 'Small', large ? 'Token amount exceeds limit or token is unknown' : 'USDC payment within demo limit', true, [recipient]);
    }
    if (decoded.functionName === 'transferFrom') {
      const [, recipient, amount] = decoded.args;
      return result(!eq(tx.to, ADDRESSES.usdc) || amount > USDC_LIMIT ? 'Large' : 'Small', 'Token transferFrom', true, [recipient]);
    }
    if (decoded.functionName === 'approve') {
      const [spender, amount] = decoded.args;
      return result(!eq(tx.to, ADDRESSES.usdc) || amount > USDC_LIMIT ? 'Large' : 'Small', 'Standalone spending approvals are not sponsored', false, [spender]);
    }
  } catch { /* Unrecognized contract calls are classified conservatively below. */ }
  if (tx.data !== '0x') return result('Large', 'Unrecognized contract call requires review', true, [tx.to]);
  return result('Small', 'Payment within demo limit', true, [tx.to]);
}
