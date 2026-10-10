import { encodeFunctionData, formatUnits, keccak256, toHex, type Address, type Hex, type PublicClient } from 'viem';
import { COMPOUND_CONFIG, compoundRate, modelCompound, parseCompoundTotals, parseCompoundUser, parseCompoundWords } from './compound-math.js';
import { CHAIN_ID } from './constants.js';
import type { MultiSendCall } from './types.js';
import { compoundAbi, dappTokenAbi, decodeDappBatch, DAPP_ADDRESSES as A, quoterAbi, type CallEffect, type DappAction, type SimulationClients, type SimulationResult } from './dapps.js';

const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
const adminSlot = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103' as const;
const circleImplementationSlot = keccak256(toHex('org.zeppelinos.proxy.implementation'));
const circleAdminSlot = keccak256(toHex('org.zeppelinos.proxy.admin'));
interface Pin { address: Address; codeHash: Hex; slots?: readonly { slot: Hex; address: Address; codeHash?: Hex }[] }
/** Read-only snapshot at Sepolia block 11886641; upgrades deliberately fail closed. Not an audit. */
export const COMPOUND_EXTENSION = '0xdCbDb7306c6Ff46f77B349188dC18cEd9DF30299' as const;
export const DAPP_CODE_PINS: readonly Pin[] = [
  { address: COMPOUND_EXTENSION, codeHash: '0x462b212abc00fb7e835d516da02805a359663ee9dd1050a4f827f17b1185cab2' },
  { address: A.uniswap, codeHash: '0xe7f98ee73dfe6d5c96cbf8936920f496b1b82f24326d6a415b4144a2252271de' },
  { address: A.quoter, codeHash: '0xe4068c0e5f3f2d9980793dd4314d2222dca27d03fd999cb5dca580fd90ceea0e' },
  { address: A.pool, codeHash: '0xc9af061980f8ef529d0c016d56dbe503aad76161acc212fa861330764d5c2c0d' },
  { address: A.compound, codeHash: '0x64952234eab8f3aed74355c49119f627965640b1efeb6b28430b5a31b0d3b192', slots: [
    { slot: implementationSlot, address: '0xe3e0106227181958abfba960c13d0fe52c733265', codeHash: '0x210f4eb2374e25850607bdb9f4f41f183c1cc881e932a0e4f304279ef3f6e4f9' },
    { slot: adminSlot, address: '0x9e9fa093aa60db36c4e8a01ebf4718095b6e37f0', codeHash: '0x0ab24c1a16e07f4f7eaad8dd28d704a33dfdd73b3aa7cb178574b072741d649e' },
  ] },
  { address: A.usdc, codeHash: '0xcd3f29e2ea9c61dadd48bfeaf8b2884b6de9dfee7bf45329452c4c33d0868ceb', slots: [
    { slot: circleImplementationSlot, address: '0xda317c1d3e835dd5f1be459006471acaa1289068', codeHash: '0xf4898b096a273d86cda13cce6503404da4005565fae6026a94919b231229d85b' },
    { slot: circleAdminSlot, address: '0xd48f3032f64e3127883fda62bc2c47c698d6baf7' },
  ] },
  { address: A.eurc, codeHash: '0xc1295f71f0bd929d23a7cecad00759f4a7701483ac08e55bfb6117bebf01dc4c', slots: [
    { slot: circleImplementationSlot, address: '0x76a1b9e4712e45c4c3d0ac6e2c3028ee0ce4d3b0', codeHash: '0xe20f5a42bcde0a182a277bfe694acd95826306995618c35e209128021c979470' },
    { slot: circleAdminSlot, address: '0x05ef919a809ebbc1c308e8b0dccd1aaa98a1bbcb' },
  ] },
];
export class DappSimulationError extends Error {
  constructor(public readonly code: 'NOT_SPONSORED' | 'SIMULATION_UNAVAILABLE' | 'EFFECTS_MISMATCH', message: string) { super(message); }
}
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const mismatch = (message: string): never => { throw new DappSimulationError('EFFECTS_MISMATCH', message); };
export async function verifyDappCode(client: PublicClient, blockNumber: bigint): Promise<void> {
  for (const pin of DAPP_CODE_PINS) {
    const code = await client.getCode({ address: pin.address, blockNumber });
    if (!code || code === '0x' || keccak256(code) !== pin.codeHash) throw new DappSimulationError('NOT_SPONSORED', 'Pinned dApp code changed or is unavailable');
    for (const slot of pin.slots ?? []) {
      const value = await client.getStorageAt({ address: pin.address, slot: slot.slot, blockNumber });
      if (!value || !eq(value, `0x${slot.address.slice(2).padStart(64, '0')}`)) throw new DappSimulationError('NOT_SPONSORED', 'Pinned proxy implementation/admin changed');
      const logic = await client.getCode({ address: slot.address, blockNumber });
      if (slot.codeHash ? !logic || keccak256(logic) !== slot.codeHash : logic !== undefined && logic !== '0x') throw new DappSimulationError('NOT_SPONSORED', 'Pinned implementation/admin code changed');
    }
  }
}
/** Fresh canonical configuration reads, all at the explicit simulation base block. */
export async function verifyCompoundConfiguration(client: PublicClient, blockNumber: bigint): Promise<void> {
  const read = async (functionName: 'extensionDelegate' | 'baseToken' | keyof typeof COMPOUND_CONFIG): Promise<Hex> => {
    const response = await client.call({ to: A.compound, data: encodeFunctionData({ abi: compoundAbi, functionName }), blockNumber });
    if (!response.data) mismatch('Missing Compound configuration');
    return response.data!;
  };
  for (const [name, expected] of [['extensionDelegate', COMPOUND_EXTENSION], ['baseToken', A.usdc]] as const) {
    const data = await read(name);
    if (!/^0x0{24}[0-9a-f]{40}$/i.test(data) || !eq(data, `0x${expected.slice(2).padStart(64,'0')}`)) throw new DappSimulationError('NOT_SPONSORED', 'Compound delegation/token configuration changed');
  }
  for (const name of Object.keys(COMPOUND_CONFIG) as (keyof typeof COMPOUND_CONFIG)[]) {
    const data = await read(name);
    let value: bigint;
    try { value = parseCompoundWords(data, [64])[0]; } catch { mismatch('Malformed Compound configuration'); }
    if (value! !== COMPOUND_CONFIG[name]) throw new DappSimulationError('NOT_SPONSORED', 'Compound immutable configuration changed');
  }
}
export function validateSwapQuote(action: DappAction, quote: bigint): void {
  if (action.action !== 'swap') return;
  const forward = eq(action.token, A.usdc);
  if (quote <= 0n || (forward ? quote * 100n < action.amount * 80n || quote > action.amount : quote < action.amount || quote * 80n > action.amount * 100n)) throw new DappSimulationError('NOT_SPONSORED', 'Fresh quote outside fixed demo price range');
  if (!forward && quote > 5_000_000n) throw new DappSimulationError('NOT_SPONSORED', 'EURC input exceeds 5 USDC equivalent');
  if (action.minimumOutput! * 100n < quote * 99n) throw new DappSimulationError('NOT_SPONSORED', 'Minimum output is below fresh quote minus 1%');
}
export interface SimulationProbe { target: Address; data: Hex; key: string }
/** Stable named plan: swap 8; Compound 14; rate probe always uses approved known utilization. */
export const COMPOUND_RATE_ARGUMENT = 1002681548101469396n;
export function simulationProbes(wallet: Address, action: DappAction['action']): SimulationProbe[] {
  const result: SimulationProbe[] = [A.usdc, A.eurc, A.compound].map((target, i) => ({ target, data: encodeFunctionData({ abi: dappTokenAbi, functionName: 'balanceOf', args: [wallet] }), key: ['usdc', 'eurc', 'position'][i] }));
  result.push({ target: A.compound, data: encodeFunctionData({ abi: compoundAbi, functionName: 'borrowBalanceOf', args: [wallet] }), key: 'borrow' });
  for (const token of [A.usdc, A.eurc]) for (const spender of [A.uniswap, A.compound]) result.push({ target: token, data: encodeFunctionData({ abi: dappTokenAbi, functionName: 'allowance', args: [wallet, spender] }), key: `${token.toLowerCase()}:${spender.toLowerCase()}` });
  if (action !== 'swap') {
    result.push({ target: A.compound, key: 'userBasic', data: encodeFunctionData({ abi: compoundAbi, functionName: 'userBasic', args: [wallet] }) });
    for (const functionName of ['totalsBasic', 'getUtilization', 'baseIndexScale', 'factorScale'] as const) result.push({ target: A.compound, key: functionName, data: encodeFunctionData({ abi: compoundAbi, functionName }) });
    result.push({ target: A.compound, key: 'getSupplyRate', data: encodeFunctionData({ abi: compoundAbi, functionName: 'getSupplyRate', args: [COMPOUND_RATE_ARGUMENT] }) });
  }
  return result;
}
export interface SimCall { status: Hex; returnData: Hex; logs?: { address: Address; topics: Hex[]; data: Hex }[] }
function parseResponse(raw: unknown, count: number, compound: boolean): { calls: SimCall[]; number: bigint; timestamp?: bigint; parentHash?: Hex } {
  if (!Array.isArray(raw) || raw.length !== 1 || !raw[0] || !Array.isArray(raw[0].calls) || raw[0].calls.length !== count || typeof raw[0].number !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/.test(raw[0].number)) mismatch('Malformed or incomplete simulation response');
  const block = (raw as { calls: SimCall[]; number: Hex; timestamp?: Hex; parentHash?: Hex }[])[0];
  if (compound && (typeof block.timestamp !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]{0,9})$/.test(block.timestamp) || typeof block.parentHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(block.parentHash))) mismatch('Missing or noncanonical Compound timestamp/parent');
  const calls = block.calls;
  for (const call of calls) if (!call || call.status !== '0x1' || typeof call.returnData !== 'string' || call.returnData.length > 514 || !/^0x(?:[0-9a-f]{2})*$/i.test(call.returnData)) mismatch('Simulation reverted or omitted execution results');
  return { calls, number: BigInt(block.number), timestamp: compound ? BigInt(block.timestamp!) : undefined, parentHash: block.parentHash };
}
const scalar = (call: SimCall): bigint => {
  if (!/^0x[0-9a-f]{64}$/i.test(call.returnData)) mismatch('Simulation omitted balance/allowance evidence');
  return BigInt(call.returnData);
};
function effect(action: string, target: Address, token: Address, recipient: Address, amount: bigint, description: string): CallEffect {
  return { target, action, token, recipient, amount: amount.toString(), description };
}
function verifyCompoundEvidence(wallet: Address, action: DappAction, calls: SimCall[], probes: SimulationProbe[], timestamp: bigint, balanceBefore: bigint, balanceAfter: bigint, actionCount: number): void {
  try {
    const n = probes.length;
    const get = (key: string, after = false) => calls[(after ? n + actionCount : 0) + probes.findIndex(p => p.key === key)];
    for (const call of [...calls.slice(0,n), ...calls.slice(n+actionCount)]) if (!Array.isArray(call.logs) || call.logs.length !== 0) mismatch('Compound getter emitted or omitted logs');
    const user = parseCompoundUser(get('userBasic').returnData);
    const totals = parseCompoundTotals(get('totalsBasic').returnData);
    const model = modelCompound(user,totals,timestamp,action.amount,action.action as 'supply' | 'withdraw');
    const userAfter = parseCompoundUser(get('userBasic',true).returnData);
    const totalsAfter = parseCompoundTotals(get('totalsBasic',true).returnData);
    if (userAfter.some((v,i) => v !== model.userAfter[i]) || totalsAfter.some((v,i) => v !== model.totalsAfter[i]) || balanceBefore !== model.balanceBefore || balanceAfter !== model.balanceAfter) mismatch('Compound exact principal/index/balance/tracking mismatch');
    for (const after of [false,true]) {
      if (scalar(get('getUtilization',after)) !== (after ? model.postUtilization : model.utilization)) mismatch('Compound utilization getter mismatch');
      for (const key of ['baseIndexScale','factorScale','getSupplyRate'] as const) {
        const observed = parseCompoundWords(get(key,after).returnData,[64])[0];
        const expected = key === 'getSupplyRate' ? compoundRate(COMPOUND_RATE_ARGUMENT) : COMPOUND_CONFIG[key];
        if (observed !== expected) mismatch('Compound scale/rate getter mismatch');
      }
    }
    const zero = '0x0000000000000000000000000000000000000000' as Address;
    const log = (address: Address, name: string, from: Address, to: Address, amount: bigint) => ({ address, topics: [keccak256(toHex(`${name}(address,address,uint256)`)), `0x${from.slice(2).padStart(64,'0')}`, `0x${to.slice(2).padStart(64,'0')}`], data: toHex(amount,{size:32}) });
    const supply = action.action === 'supply';
    const events = [log(A.usdc,'Transfer',supply ? wallet : A.compound,supply ? A.compound : wallet,action.amount),log(A.compound,supply ? 'Supply' : 'Withdraw',wallet,wallet,action.amount)];
    if (model.difference !== 0n) events.push(log(A.compound,'Transfer',supply ? zero : wallet,supply ? wallet : zero,model.eventAmount));
    const expected = supply ? [[log(A.usdc,'Approval',wallet,A.compound,action.amount)],events,[log(A.usdc,'Approval',wallet,A.compound,0n)]] : [events];
    for (let i=0;i<actionCount;i++) {
      const execution = calls[n+i];
      if (execution.returnData !== (supply && i !== 1 ? toHex(1n,{size:32}) : '0x')) mismatch('Noncanonical Compound action return');
      if (!Array.isArray(execution.logs) || execution.logs.length !== expected[i].length) mismatch('Compound event cardinality mismatch');
      for (let j=0;j<expected[i].length;j++) {
        const actual = execution.logs![j], wanted = expected[i][j];
        if (!actual || typeof actual.address !== 'string' || !eq(actual.address,wanted.address) || typeof actual.data !== 'string' || !eq(actual.data,wanted.data) || !Array.isArray(actual.topics) || actual.topics.length !== 3 || actual.topics.some((v,k) => typeof v !== 'string' || !eq(v,wanted.topics[k]))) mismatch('Compound event grammar/order mismatch');
      }
    }
  } catch (error) {
    if (error instanceof DappSimulationError) throw error;
    mismatch(error instanceof Error ? error.message : 'Malformed Compound exact evidence');
  }
}
/** Hash binds chain, wallet, exact calls and observed numeric effects; block is intentionally excluded to allow revalidation. */
export function hashSimulationEffects(wallet: Address, calls: readonly MultiSendCall[], effects: readonly CallEffect[], chainId = CHAIN_ID): Hex {
  return keccak256(toHex(JSON.stringify({ v: 1, chainId, wallet: wallet.toLowerCase(), calls: calls.map(c => ({ to: c.to.toLowerCase(), data: c.data.toLowerCase(), value: String(c.value), operation: c.operation })), effects: effects.map(({ target, action, token, recipient, amount }) => ({ target: target.toLowerCase(), action, token: token?.toLowerCase(), recipient: recipient?.toLowerCase(), amount })) })));
}
async function simulateOn(client: PublicClient, wallet: Address, calls: readonly MultiSendCall[], action: DappAction): Promise<SimulationResult> {
  if (await client.getChainId() !== CHAIN_ID) throw new DappSimulationError('NOT_SPONSORED', 'Only Sepolia simulation is supported');
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const base = action.action !== 'swap' ? await client.getBlock({ blockNumber }) : undefined;
  if (base && (base.number !== blockNumber || !base.hash)) mismatch('Incoherent base block');
  await verifyDappCode(client, blockNumber);
  if (action.action !== 'swap') await verifyCompoundConfiguration(client, blockNumber);
  if (action.action === 'swap') {
    const quote = await client.readContract({ address: A.quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle', args: [{ tokenIn: action.token, tokenOut: action.tokenOut!, amountIn: action.amount, fee: 500, sqrtPriceLimitX96: 0n }], blockNumber });
    validateSwapQuote(action, quote[0]);
  }
  const checks = simulationProbes(wallet, action.action);
  const rpcCalls = [...checks.map(p => ({ from: wallet, to: p.target, data: p.data, value: '0x0' as Hex })), ...calls.map(c => ({ from: wallet, to: c.to, data: c.data, value: '0x0' as Hex })), ...checks.map(p => ({ from: wallet, to: p.target, data: p.data, value: '0x0' as Hex }))];
  // No balance, storage, nonce or bytecode overrides. validation:false skips EOA/signature/fee validation only.
  const raw = await client.request({ method: 'eth_simulateV1', params: [{ blockStateCalls: [{ calls: rpcCalls }], validation: false, traceTransfers: true }, toHex(blockNumber)] });
    const result = effectsFromSimulation(wallet, calls, raw, blockNumber, base ? { hash: base.hash!, timestamp: base.timestamp } : undefined);
  if (base) {
    const confirmed = await client.getBlock({ blockNumber });
    if (confirmed.hash !== base.hash || confirmed.timestamp !== base.timestamp) mismatch('Base block changed during simulation');
  }
  return result;
}
/** Interpret complete RPC evidence; useful for independent adapter verification, not a substitute for simulateCalls. */
export function effectsFromSimulation(wallet: Address, calls: readonly MultiSendCall[], raw: unknown, blockNumber: bigint, base?: { hash: Hex; timestamp: bigint }): SimulationResult {
  const action = decodeDappBatch(wallet, calls);
  const checks = simulationProbes(wallet, action.action);
  const response = parseResponse(raw, checks.length * 2 + calls.length, action.action !== 'swap');
  if (action.action !== 'swap' && (!base || !eq(response.parentHash!, base.hash) || response.timestamp! < base.timestamp)) mismatch('Compound simulation parent/time does not match base block');
  if (response.number !== blockNumber + 1n) mismatch('Simulation used an unexpected block');
  if (action.action !== 'withdraw' && (scalar(response.calls[checks.length]) !== 1n || scalar(response.calls[checks.length + 2]) !== 1n)) mismatch('Token approval returned false');
  const before = new Map(checks.slice(0,8).map((p, i) => [p.key, scalar(response.calls[i])]));
  const after = new Map(checks.slice(0,8).map((p, i) => [p.key, scalar(response.calls[checks.length + calls.length + i])]));
  const delta = (key: string) => after.get(key)! - before.get(key)!;
  if (delta('borrow') !== 0n || before.get('borrow') !== 0n) mismatch('Borrowing or repayment is not sponsored');
  for (const p of checks.slice(4,8)) {
    const selected = p.key === `${action.token.toLowerCase()}:${action.target.toLowerCase()}` && action.action !== 'withdraw';
    if (selected ? before.get(p.key) !== 0n || after.get(p.key) !== 0n : delta(p.key) !== 0n) mismatch('Unexpected or pre-existing token permission');
  }
  const spent = -delta(eq(action.token, A.usdc) ? 'usdc' : 'eurc');
  const effects: CallEffect[] = [];
  if (action.action === 'swap') {
    const received = delta(eq(action.tokenOut!, A.usdc) ? 'usdc' : 'eurc');
    if (spent !== action.amount || received < action.minimumOutput! || delta('position') !== 0n) mismatch('Swap balance effects do not match preview bounds');
    const execution = response.calls[checks.length + 1];
    if (scalar(execution) !== received) mismatch('Router output disagrees with observed wallet balance');
    effects.push(effect('spend', action.target, action.token, action.target, spent, `You give ${formatUnits(spent, 6)} ${eq(action.token, A.usdc) ? 'USDC' : 'EURC'} to Uniswap.`), effect('receive', action.target, action.tokenOut!, wallet, received, `You receive ${formatUnits(received, 6)} ${eq(action.tokenOut!, A.usdc) ? 'USDC' : 'EURC'}.`));
  } else {
    const position = delta('position');
    if (delta('eurc') !== 0n || spent !== (action.action === 'supply' ? action.amount : -action.amount)) mismatch('Compound token effects mismatch');
    verifyCompoundEvidence(wallet, action, response.calls, checks, response.timestamp!, before.get('position')!, after.get('position')!, calls.length);
    effects.push(effect(action.action === 'supply' ? 'spend' : 'receive', action.target, A.usdc, action.action === 'supply' ? action.target : wallet, action.amount, `You ${action.action === 'supply' ? 'give' : 'receive'} ${formatUnits(action.amount, 6)} USDC ${action.action === 'supply' ? 'to' : 'from'} Compound.`), effect('position', action.target, A.usdc, wallet, position, `Your Compound supply position changes by ${formatUnits(position, 6)} USDC; yield is variable and paid by the protocol.`));
  }
  // Require complete logs and reject events from any outside contract. This is not a universal storage-diff proof.
  const allowed = new Set([A.usdc, A.eurc, A.compound, A.pool, A.uniswap].map(a => a.toLowerCase()));
  const transferTopic = keccak256(toHex('Transfer(address,address,uint256)'));
  const approvalTopic = keccak256(toHex('Approval(address,address,uint256)'));
  for (const execution of action.action === 'swap' ? response.calls.slice(checks.length, checks.length + calls.length) : []) {
    if (!Array.isArray(execution.logs) || execution.logs.some(log => !log || !allowed.has(log.address?.toLowerCase()))) mismatch('Unexpected or missing simulation event evidence');
    for (const log of execution.logs!) {
      if (![A.usdc, A.eurc].some(token => eq(token, log.address))) continue;
      if (!Array.isArray(log.topics) || log.topics.length !== 3 || !/^0x[0-9a-f]{64}$/i.test(log.data) || log.topics.slice(1).some(topic => !/^0x0{24}[0-9a-f]{40}$/i.test(topic))) mismatch('Malformed token event');
      const from = `0x${log.topics[1].slice(-40)}`;
      const to = `0x${log.topics[2].slice(-40)}`;
      if (log.topics[0] === approvalTopic) {
        if (!eq(log.address, action.token) || !eq(from, wallet) || !eq(to, action.target) || ![0n, action.amount].includes(BigInt(log.data))) mismatch('Unexpected approval event');
      } else if (log.topics[0] === transferTopic) {
        const counterparty = action.action === 'swap' ? A.pool : A.compound;
        const spending = eq(log.address, action.token) && action.action !== 'withdraw';
        if (spending ? !eq(from, wallet) || !eq(to, counterparty) || BigInt(log.data) !== action.amount : !eq(from, counterparty) || !eq(to, wallet) || !eq(log.address, action.tokenOut ?? action.token)) mismatch('Unexpected token transfer event');
      } else mismatch('Unexpected token state-change event');
    }
  }
  if (action.action !== 'withdraw') effects.push(effect('allowance', action.token, action.token, action.target, 0n, 'Permission to spend your input token returns to 0.'));
  return { effects, effectsHash: hashSimulationEffects(wallet, calls, effects), blockNumber: blockNumber.toString() };
}
export async function simulateCalls(clients: SimulationClients, wallet: Address, calls: readonly MultiSendCall[]): Promise<SimulationResult> {
  let action: DappAction;
  try { action = decodeDappBatch(wallet, calls); } catch (error) { throw new DappSimulationError('NOT_SPONSORED', error instanceof Error ? error.message : 'Unsupported batch'); }
  for (const client of clients) {
    try { return await simulateOn(client, wallet, calls, action); }
    catch (error) { if (error instanceof DappSimulationError) throw error; /* RPC outage: fail over, never manufacture effects. */ }
  }
  throw new DappSimulationError('SIMULATION_UNAVAILABLE', 'Simulation unavailable; nothing may be sponsored.');
}
export async function revalidateSimulation(clients: SimulationClients, wallet: Address, calls: readonly MultiSendCall[], expectedEffectsHash: Hex): Promise<SimulationResult> {
  const fresh = await simulateCalls(clients, wallet, calls);
  if (!eq(fresh.effectsHash, expectedEffectsHash)) mismatch('EFFECTS_MISMATCH: observed effects changed since preview');
  return fresh;
}
