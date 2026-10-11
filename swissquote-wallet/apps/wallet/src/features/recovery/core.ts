import { getAddress, verifyTypedData, type Address, type PublicClient } from 'viem';
import { ADDRESSES, decodeApprovalCode, moduleAbi, recoveryTypedData, type GuardianApproval, type RecoveryApproveResponse, type RecoveryRequest } from '@sq/protocol';

export const RECOVERY_MODULES = [
  { address: ADDRESSES.moduleA, label: 'Recovery Card + partner', wait: '3 minutes in this demo' },
  { address: ADDRESSES.moduleB, label: 'Recovery Card + Swissquote', wait: '3 days' },
] as const;
export const POLL_MS = 15000;
export const SAFETY_MARGIN = 15n;
export interface Pending { module: Address; newOwners: readonly Address[]; newThreshold: bigint; executeAfter: bigint }
export interface Snapshot { pending: Pending[]; timestamp: bigint; blockNumber: bigint; certain: boolean; warning: string }
const same = (a: unknown, b: unknown) => JSON.stringify(a, (_, v) => typeof v === 'bigint' ? v.toString() : v) === JSON.stringify(b, (_, v) => typeof v === 'bigint' ? v.toString() : v);
export function addressGroups(address: Address): string { return `0x${getAddress(address).slice(2).match(/.{1,4}/g)!.join(' ')}`; }
export function remaining(deadline: bigint, timestamp: bigint): string {
  const seconds = deadline + SAFETY_MARGIN > timestamp ? deadline + SAFETY_MARGIN - timestamp : 0n;
  if (!seconds) return 'Waiting period complete on the last checked block';
  return `${seconds / 86400n ? `${seconds / 86400n}d ` : ''}${seconds % 86400n / 3600n}h ${seconds % 3600n / 60n}m ${seconds % 60n}s (includes 15-second safety margin)`;
}
export function secondsLeft(deadline: bigint, timestamp: bigint): bigint {
  return deadline + SAFETY_MARGIN > timestamp ? deadline + SAFETY_MARGIN - timestamp : 0n;
}
export function clock(seconds: bigint): string {
  const value = seconds > 0n ? seconds : 0n;
  if (value >= 86400n) return `${value / 86400n}d ${value % 86400n / 3600n}h ${value % 3600n / 60n}m`;
  if (value >= 3600n) return `${value / 3600n}h ${value % 3600n / 60n}m ${value % 60n}s`;
  return `${value / 60n}:${(value % 60n).toString().padStart(2, '0')}`;
}
/** Positive reports survive disagreement/outage; only two matching pinned reads can say clear/ready. */
export async function pollRecovery(clients: readonly PublicClient[], wallet: Address, chainId: number): Promise<Snapshot> {
  if (clients.length < 2) throw new Error('Recovery status unknown: configure two independent RPC clients.');
  const rpcs = clients.slice(0, 2);
  const heads = await Promise.allSettled(rpcs.map(async rpc => {
    if (await rpc.getChainId() !== chainId) throw new Error('RPC chain mismatch');
    return rpc.getBlockNumber({ cacheTime: 0 });
  }));
  const available = heads.flatMap((head, index) => head.status === 'fulfilled' ? [{ rpc: rpcs[index], head: head.value }] : []);
  if (!available.length) throw new Error('Recovery polling failed on both nodes. Status and countdown are unknown; retry the check.');
  const blockNumber = available.reduce((min, node) => node.head < min ? node.head : min, available[0].head);
  const reads = await Promise.allSettled(available.map(async ({ rpc }) => {
    const block = await rpc.getBlock({ blockNumber });
    const pending = await Promise.all(RECOVERY_MODULES.map(async module => {
      const record = await rpc.readContract({ address: module.address, abi: moduleAbi, functionName: 'getRecoveryRequest', args: [wallet], blockNumber });
      return { module: module.address, newOwners: record.newOwners, newThreshold: record.newThreshold, executeAfter: record.executeAfter };
    }));
    return { pending, timestamp: block.timestamp };
  }));
  const good = reads.flatMap(read => read.status === 'fulfilled' ? [read.value] : []);
  if (!good.length) throw new Error('Recovery polling failed. Last known requests may still be active; countdown is unavailable.');
  const certain = good.length === 2 && same(good[0], good[1]);
  const pending = good.flatMap(read => read.pending).filter(record => record.executeAfter > 0n).filter((record, index, all) => all.findIndex(other => same(other, record)) === index);
  return { pending, timestamp: good.reduce((min, read) => read.timestamp < min ? read.timestamp : min, good[0].timestamp), blockNumber, certain,
    warning: certain ? '' : 'Recovery status uncertain: a node failed or nodes disagree. Pending reports are shown, but clear status and finalization cannot be confirmed.' };
}
export function assertReady(snapshot: Snapshot, request: RecoveryRequest): Pending {
  if (!snapshot.certain) throw new Error('Cannot finalize while public nodes disagree or polling fails. Retry the chain check.');
  const pending = snapshot.pending.find(record => record.module.toLowerCase() === request.module.toLowerCase());
  if (!pending || pending.newThreshold !== 1n || pending.newOwners.length !== 1 || pending.newOwners[0].toLowerCase() !== request.newOwner.toLowerCase()) throw new Error('The pending recovery does not match this encrypted replacement key. Do not finalize.');
  if (snapshot.timestamp < pending.executeAfter + SAFETY_MARGIN) throw new Error('The latest block has not passed the waiting period plus the 15-second safety margin.');
  return pending;
}
export async function checkApproval(request: RecoveryRequest, approval: GuardianApproval, expected: Address): Promise<void> {
  if (approval.signer.toLowerCase() !== expected.toLowerCase()) throw new Error('Approval signer does not match the required guardian.');
  if (!await verifyTypedData({ ...recoveryTypedData(request), address: expected, signature: approval.signature })) throw new Error('Approval does not sign this exact wallet, chain, module, new owner and nonce. Return to your saved offline tool with the current public request.');
}
export async function cardApproval(request: RecoveryRequest, code: string, expected: Address): Promise<GuardianApproval> {
  const approval = decodeApprovalCode(code.trim());
  if (approval.chainId !== request.chainId) throw new Error('Card approval belongs to another chain.');
  await checkApproval(request, approval, expected);
  return { signer: approval.signer, signature: approval.signature };
}
export async function helperApproval(request: RecoveryRequest, helper: RecoveryApproveResponse, expected: Address): Promise<GuardianApproval> {
  const wire = { ...request, nonce: request.nonce.toString() };
  if (!helper.request || helper.request.wallet.toLowerCase() !== wire.wallet.toLowerCase() || helper.request.module.toLowerCase() !== wire.module.toLowerCase() || helper.request.newOwner.toLowerCase() !== wire.newOwner.toLowerCase() || helper.request.nonce !== wire.nonce || helper.request.chainId !== wire.chainId) throw new Error('Helper approved a different recovery request. Nothing was submitted.');
  await checkApproval(request, helper, expected);
  return { signer: helper.signer, signature: helper.signature };
}
