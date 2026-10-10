import type { Hex } from 'viem';

/** Independently evaluated candidate semantics; not a deployed-source identity claim. */
export const COMPOUND_CONFIG = Object.freeze({
  baseScale: 1_000_000n, baseIndexScale: 10n ** 15n, factorScale: 10n ** 18n,
  supplyKink: 850_000_000_000_000_000n, supplyPerSecondInterestRateBase: 0n,
  supplyPerSecondInterestRateSlopeLow: 1_522_070_015n, supplyPerSecondInterestRateSlopeHigh: 50_735_667_174n,
  borrowKink: 850_000_000_000_000_000n, borrowPerSecondInterestRateBase: 475_646_879n,
  borrowPerSecondInterestRateSlopeLow: 1_680_618_975n, borrowPerSecondInterestRateSlopeHigh: 53_906_646_372n,
  baseTrackingSupplySpeed: 11_574_074_074n, baseTrackingBorrowSpeed: 1_145_833_333_333n,
  baseMinForRewards: 100_000_000n, trackingIndexScale: 10n ** 15n,
});
export type CompoundUser = readonly [bigint, bigint, bigint, bigint, bigint];
export type CompoundTotals = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
export function checkedUint(value: bigint, bits = 256): bigint {
  if (value < 0n || value >= 1n << BigInt(bits)) throw new Error(`Compound uint${bits} overflow/underflow`);
  return value;
}
const mul = (a: bigint, b: bigint) => checkedUint(a * b);
const add = (a: bigint, b: bigint, bits = 256) => checkedUint(a + b, bits);
/** Exact word count and canonical narrow integer/sign-extension encoding. */
export function parseCompoundWords(data: Hex, widths: readonly number[], signedFirst = false): bigint[] {
  if (typeof data !== 'string' || !new RegExp(`^0x[0-9a-f]{${widths.length * 64}}$`, 'i').test(data)) throw new Error('Malformed Compound tuple length');
  return widths.map((bits, i) => {
    const word = BigInt(`0x${data.slice(2 + i * 64, 66 + i * 64)}`);
    if (i === 0 && signedFirst) {
      const low = word & ((1n << BigInt(bits)) - 1n);
      const value = low >= 1n << BigInt(bits - 1) ? low - (1n << BigInt(bits)) : low;
      const encoded = value < 0n ? (1n << 256n) + value : value;
      if (encoded !== word) throw new Error('Noncanonical Compound signed integer');
      return value;
    }
    return checkedUint(word, bits);
  });
}
export const parseCompoundUser = (data: Hex): CompoundUser => parseCompoundWords(data, [104,64,64,16,8], true) as unknown as CompoundUser;
export const parseCompoundTotals = (data: Hex): CompoundTotals => parseCompoundWords(data, [64,64,64,64,104,104,40,8]) as unknown as CompoundTotals;
export function compoundRate(utilization: bigint, borrow = false): bigint {
  checkedUint(utilization);
  const c = COMPOUND_CONFIG;
  const kink = borrow ? c.borrowKink : c.supplyKink;
  const base = borrow ? c.borrowPerSecondInterestRateBase : c.supplyPerSecondInterestRateBase;
  const low = borrow ? c.borrowPerSecondInterestRateSlopeLow : c.supplyPerSecondInterestRateSlopeLow;
  const high = borrow ? c.borrowPerSecondInterestRateSlopeHigh : c.supplyPerSecondInterestRateSlopeHigh;
  return checkedUint(add(add(base, mul(low, utilization <= kink ? utilization : kink) / c.factorScale), utilization > kink ? mul(high, utilization - kink) / c.factorScale : 0n), 64);
}
export function compoundUtilization(t: CompoundTotals): bigint {
  const supply = mul(t[4], t[0]) / COMPOUND_CONFIG.baseIndexScale;
  const borrow = mul(t[5], t[1]) / COMPOUND_CONFIG.baseIndexScale;
  return supply === 0n ? 0n : mul(borrow, COMPOUND_CONFIG.factorScale) / supply;
}
export function modelCompound(before: CompoundUser, totals: CompoundTotals, timestamp: bigint, amount: bigint, action: 'supply' | 'withdraw') {
  const c = COMPOUND_CONFIG;
  before.forEach((v, i) => checkedUint(v, [103,64,64,16,8][i]));
  totals.forEach((v, i) => checkedUint(v, [64,64,64,64,104,104,40,8][i]));
  checkedUint(timestamp,40); checkedUint(amount,255);
  if (timestamp < totals[6] || totals[0] === 0n || totals[1] === 0n || amount === 0n) throw new Error('Unsupported Compound time/index/amount');
  if (totals[7] & (action === 'supply' ? 1n : 4n)) throw new Error('Compound action paused');
  const elapsed = timestamp - totals[6];
  const utilization = compoundUtilization(totals);
  const accrueIndex = (index: bigint, rate: bigint) => add(index, checkedUint(mul(index, mul(rate, elapsed)) / c.factorScale,64),64);
  const index = accrueIndex(totals[0], compoundRate(utilization));
  const borrowIndex = accrueIndex(totals[1], compoundRate(utilization,true));
  const tracking = (index: bigint, total: bigint, speed: bigint) => elapsed > 0n && total >= c.baseMinForRewards ? add(index, checkedUint(mul(mul(speed,elapsed),c.baseScale) / total,64),64) : index;
  const trackingSupply = tracking(totals[2],totals[4],c.baseTrackingSupplySpeed);
  const trackingBorrow = tracking(totals[3],totals[5],c.baseTrackingBorrowSpeed);
  const balanceBefore = checkedUint(mul(before[0],index) / c.baseIndexScale,255);
  const presentAfter = balanceBefore + (action === 'supply' ? amount : -amount);
  checkedUint(presentAfter,255);
  const principal = checkedUint(mul(presentAfter,c.baseIndexScale) / index,103);
  const difference = principal - before[0];
  if (action === 'supply' ? difference < 0n : difference > 0n || before[0] === 0n) throw new Error('Unsupported non-monotone Compound principal transition');
  const balanceAfter = mul(principal,index) / c.baseIndexScale;
  const totalSupply = checkedUint(totals[4]+difference,104);
  const accrued = add(before[2],checkedUint(mul(before[0],checkedUint(trackingSupply-before[1],64)) / c.trackingIndexScale,64),64);
  const userAfter: CompoundUser = [principal,trackingSupply,accrued,before[3],before[4]];
  const totalsAfter: CompoundTotals = [index,borrowIndex,trackingSupply,trackingBorrow,totalSupply,totals[5],elapsed ? timestamp : totals[6],totals[7]];
  const eventAmount = mul(difference < 0n ? -difference : difference,index) / c.baseIndexScale;
  return { index, utilization, principal, balanceBefore, balanceAfter, difference, eventAmount, userAfter, totalsAfter, postUtilization: compoundUtilization(totalsAfter) };
}
