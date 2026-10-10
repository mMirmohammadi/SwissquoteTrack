import { decodeFunctionData, encodeFunctionData, isAddress, parseAbi, type Address, type Hex, type PublicClient } from 'viem';
import { ADDRESSES, CHAIN_ID, USDC_LIMIT } from './constants.js';
import type { MultiSendCall } from './types.js';

export interface DappEntry { id: string; name: string; address: Address; chainId: number; warning: string }
export interface DappCheck { ok: boolean; dappId?: string; code?: string; reasons: string[] }
export interface CallEffect { target: Address; action: string; token?: Address; recipient?: Address; amount?: string; description: string }
export interface SimulationResult { effects: CallEffect[]; effectsHash: Hex; blockNumber: string }
export type SimulationClients = readonly PublicClient[];
export const DAPP_ADDRESSES = {
  uniswap: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  quoter: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
  pool: '0x68adf381B8F9e9e100bb6E13d50b14094e3b6a9d',
  compound: '0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e',
  usdc: ADDRESSES.usdc,
  eurc: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
} as const satisfies Record<string, Address>;
const warning = 'Not a bank deposit. Not covered by depositor protection. Smart-contract risk: you can lose this amount. Swissquote does not advise on this.';
export const DAPP_REGISTRY: readonly DappEntry[] = Object.freeze([
  Object.freeze({ id: 'uniswap', name: 'Uniswap v3 USDC/EURC', address: DAPP_ADDRESSES.uniswap, chainId: CHAIN_ID, warning }),
  Object.freeze({ id: 'compound', name: 'Compound III — third-party test deployment', address: DAPP_ADDRESSES.compound, chainId: CHAIN_ID, warning }),
]);
export const dappTokenAbi = parseAbi([
  'function approve(address spender,uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
]);
export const compoundAbi = parseAbi([
  'function supply(address asset,uint256 amount)',
  'function withdraw(address asset,uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
  'function borrowBalanceOf(address account) view returns (uint256)',
  'function collateralBalanceOf(address account,address asset) view returns (uint128)',
  'function userBasic(address) view returns (int104 principal,uint64 baseTrackingIndex,uint64 baseTrackingAccrued,uint16 assetsIn,uint8 reserved)',
  'function totalsBasic() view returns ((uint64 baseSupplyIndex,uint64 baseBorrowIndex,uint64 trackingSupplyIndex,uint64 trackingBorrowIndex,uint104 totalSupplyBase,uint104 totalBorrowBase,uint40 lastAccrualTime,uint8 pauseFlags))',
  'function getUtilization() view returns (uint256)',
  'function getSupplyRate(uint256) view returns (uint64)',
  'function baseIndexScale() view returns (uint64)',
  'function factorScale() view returns (uint64)',
  'function extensionDelegate() view returns (address)',
  'function baseToken() view returns (address)',
  'function baseScale() view returns (uint256)',
  'function supplyKink() view returns (uint256)',
  'function supplyPerSecondInterestRateBase() view returns (uint256)',
  'function supplyPerSecondInterestRateSlopeLow() view returns (uint256)',
  'function supplyPerSecondInterestRateSlopeHigh() view returns (uint256)',
  'function borrowKink() view returns (uint256)',
  'function borrowPerSecondInterestRateBase() view returns (uint256)',
  'function borrowPerSecondInterestRateSlopeLow() view returns (uint256)',
  'function borrowPerSecondInterestRateSlopeHigh() view returns (uint256)',
  'function baseTrackingSupplySpeed() view returns (uint256)',
  'function baseTrackingBorrowSpeed() view returns (uint256)',
  'function baseMinForRewards() view returns (uint256)',
  'function trackingIndexScale() view returns (uint256)',
  'event Supply(address indexed from,address indexed dst,uint256 amount)',
  'event Withdraw(address indexed src,address indexed to,uint256 amount)',
  'event Transfer(address indexed from,address indexed to,uint256 amount)',
]);
export const routerAbi = parseAbi(['function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)']);
export const quoterAbi = parseAbi(['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)']);
export interface DappAction {
  dappId: 'uniswap' | 'compound'; action: 'swap' | 'supply' | 'withdraw';
  target: Address; token: Address; amount: bigint; tokenOut?: Address; minimumOutput?: bigint;
}
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
function requirePolicy(condition: boolean, reason: string): asserts condition { if (!condition) throw new Error(reason); }
/** Static shape check only. Fresh quote, pinned code and observed effects are mandatory in simulateCalls. */
export function decodeDappBatch(wallet: Address, calls: readonly MultiSendCall[]): DappAction {
  requirePolicy(isAddress(wallet, { strict: false }) && BigInt(wallet) > 1n, 'Invalid wallet');
  requirePolicy(calls.length === 1 || calls.length === 3, 'Expected a lone withdrawal or exactly approve/action/revoke0');
  for (const call of calls) {
    requirePolicy(isAddress(call.to, { strict: false }) && call.operation === 0 && call.value === 0n, 'Only zero-value CALL operations are supported');
    requirePolicy(/^0x(?:[0-9a-fA-F]{2})+$/.test(call.data), 'Malformed calldata');
  }
  const call = calls[calls.length === 3 ? 1 : 0];
  let action: DappAction;
  if (eq(call.to, DAPP_ADDRESSES.compound)) {
    const decoded = decodeFunctionData({ abi: compoundAbi, data: call.data });
    requirePolicy(decoded.functionName === 'supply' || decoded.functionName === 'withdraw', 'Unsupported Compound function');
    const [token, amount] = decoded.args as readonly [Address, bigint];
    requirePolicy(eq(token, ADDRESSES.usdc), 'Compound supports USDC only');
    requirePolicy(amount > 0n && amount <= USDC_LIMIT, 'Compound amount must be positive and at most 5 USDC');
    requirePolicy(eq(call.data, encodeFunctionData({ abi: compoundAbi, functionName: decoded.functionName, args: [token, amount] })), 'Noncanonical Compound calldata');
    action = { dappId: 'compound', action: decoded.functionName, target: call.to, token, amount };
  } else if (eq(call.to, DAPP_ADDRESSES.uniswap)) {
    const decoded = decodeFunctionData({ abi: routerAbi, data: call.data });
    const p = decoded.args[0];
    requirePolicy((eq(p.tokenIn, ADDRESSES.usdc) && eq(p.tokenOut, DAPP_ADDRESSES.eurc)) || (eq(p.tokenIn, DAPP_ADDRESSES.eurc) && eq(p.tokenOut, ADDRESSES.usdc)), 'Only USDC/EURC swaps are supported');
    requirePolicy(p.fee === 500, 'Swap fee must be 500');
    requirePolicy(eq(p.recipient, wallet), 'Swap recipient must be the wallet');
    requirePolicy(p.sqrtPriceLimitX96 === 0n, 'Price limit must be zero');
    requirePolicy(p.amountIn > 0n && p.amountIn <= USDC_LIMIT, 'Swap exceeds 5 USDC or EURC equivalent limit');
    requirePolicy(p.amountOutMinimum > 0n, 'Minimum output must be positive');
    // A reverse swap may cost up to 1.25 USDC per EURC. A fresh quote below checks its exact USDC equivalent.
    const floor = eq(p.tokenIn, ADDRESSES.usdc) ? (p.amountIn * 80n * 99n + 9999n) / 10000n : (p.amountIn * 99n + 99n) / 100n;
    requirePolicy(p.amountOutMinimum >= floor, 'Minimum output below demo range');
    requirePolicy(eq(call.data, encodeFunctionData({ abi: routerAbi, functionName: 'exactInputSingle', args: [p] })), 'Noncanonical router calldata');
    action = { dappId: 'uniswap', action: 'swap', target: call.to, token: p.tokenIn, tokenOut: p.tokenOut, amount: p.amountIn, minimumOutput: p.amountOutMinimum };
  } else throw new Error('Unlisted action target');
  if (action.action === 'withdraw') {
    requirePolicy(calls.length === 1, 'Withdrawal must not include token approvals');
  } else {
    requirePolicy(calls.length === 3, 'Missing exact approval or final revoke0');
    for (const [index, expected] of [[0, action.amount], [2, 0n]] as const) {
      const approval = calls[index];
      requirePolicy(eq(approval.to, action.token), 'Approval token differs from action input');
      const decoded = decodeFunctionData({ abi: dappTokenAbi, data: approval.data });
      requirePolicy(decoded.functionName === 'approve', 'Expected approve');
      const [spender, amount] = decoded.args as readonly [Address, bigint];
      requirePolicy(eq(spender, action.target) && amount === expected, 'Approval spender/amount must exactly match action and end at zero');
      requirePolicy(eq(approval.data, encodeFunctionData({ abi: dappTokenAbi, functionName: 'approve', args: [spender, amount] })), 'Noncanonical approval calldata');
    }
  }
  return action;
}
export function checkDappBatch(wallet: Address, calls: readonly MultiSendCall[]): DappCheck {
  try { return { ok: true, dappId: decodeDappBatch(wallet, calls).dappId, reasons: [] }; }
  catch (error) { return { ok: false, code: 'NOT_SPONSORED', reasons: [error instanceof Error ? error.message : 'Unsupported batch'] }; }
}
export function describeEffects(effects: readonly CallEffect[]): string[] { return effects.map(effect => effect.description); }
