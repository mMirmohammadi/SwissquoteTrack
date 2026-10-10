/**
 * Live Sepolia counterpart of story.ts (change C4). story.ts stays local-only.
 *
 * - Sends nothing unless ALLOW_SEPOLIA_STORY=yes. `--dry-run` is read-only: chain id per RPC, code hashes of the
 *   8 pinned contracts, TREASURY/FUNDER balances against the estimated needs. It signs and sends nothing.
 * - Reads swissquote-wallet/.env.sepolia at runtime. TREASURY sends and pays for every transaction (the gas
 *   sponsor); FUNDER pays only the kit-sweep gas. Keys are never printed.
 * - Each live run generates fresh throwaway keys and saves them, with the wallet and step progress, to
 *   .sepolia-runs/<UTC>-<mode>.json (mode 600, git-ignored) so test funds can be recovered after a stop.
 * - Commit-safe evidence (no secrets): evidence/sepolia/<mode>-<UTC>.json, one entry per step.
 *
 * Usage (from swissquote-wallet/scripts/): pnpm story:sepolia [full|b-pending] [--dry-run]
 * Live runs: ALLOW_SEPOLIA_STORY=yes pnpm story:sepolia [full|b-pending]. Optional SEPOLIA_RPC_URLS=url1,url2.
 */
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeFunctionData, formatEther, formatGwei, formatUnits, getAddress, isAddress, keccak256, parseAbi, parseEventLogs, parseGwei,
  type Address, type Hash, type Hex, type TransactionReceipt,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { createNonceManager, jsonRpc, type NonceManager } from 'viem/nonce';
import {
  ADDRESSES, CHAIN_ID, CONTRACT_CODE_HASHES, MODULE_WAITS, PROXY_RUNTIME_CODE_HASH, safeAbi, factoryAbi, moduleAbi, erc20Abi,
  generateOwnerSeed, generateCardSeed, mnemonicToPrivateKey, mnemonicToAddress, randomSaltNonce,
  buildDeployCall, computeWalletAddress, verifyWallet, signOwnershipProof, verifyOwnershipProof,
  makeSafeTx, signSafeTx, encodeExecTransaction, classifyTransaction, signRecovery, assertRecoveryHash,
  encodeRecoveryCall, buildCancelRecoveryTx, buildRotateOwnerTx, createKit, openKit, generateKitCode,
  type SafeTx, type WalletSetup, type RecoveryRequest,
} from '@sq/protocol';
import { clients, isMain } from './runtime.js';
import { sweepKit } from './kit-sweep.js';

// ---------------------------------------------------------------------------------------------------------------
// Constants and pure helpers (unit-tested in test/story-sepolia.test.ts)

export const SEPOLIA_CHAIN_ID = 11155111;
export const CIRCLE_USDC: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const MIN_PRIORITY_FEE = parseGwei('0.01');
export const MAX_FEE_CAP = parseGwei('20');
export const RECEIPT_TIMEOUT_MS = 180_000;
export const DEFAULT_RPC_URLS = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.ethpandaops.io'] as const;
/**
 * Per-transaction gas upper bounds, used for funding estimates only (gas limits come from eth_estimateGas x 1.2).
 * Measured with a read-only eth_simulateV1 of the whole full-mode flow on publicnode (block 11,886,330): deploy
 * 2,650,279; USDC funding 151,779; pay 1 USDC 297,221; pay 6 USDC 101,381; start A 934,723; start B 934,747;
 * cancel both 162,274; start A again 836,815; finalize 197,620; kit sweep 89,765; rotate 186,268. Bounds are the
 * per-kind maximum plus about 25%. sepolia.md section 4 assumed far less (deploy 700k, recovery start 300k).
 */
export const GAS_BOUNDS = {
  deploy: 3_400_000n, usdcTransfer: 200_000n, safePayment: 380_000n, recoveryStart: 1_200_000n,
  cancelBatch: 220_000n, finalize: 260_000n, rotation: 250_000n, kitSweep: 150_000n,
} as const;
export const MODES = ['full', 'b-pending'] as const;
export type Mode = typeof MODES[number];
export const USDC_FUNDING: Readonly<Record<Mode, bigint>> = { full: 10_000_000n, 'b-pending': 1_000_000n };
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = join(SCRIPT_DIR, '..', '.env.sepolia');
export const RUNS_DIR = join(SCRIPT_DIR, '..', '.sepolia-runs');
export const EVIDENCE_DIR = join(SCRIPT_DIR, '..', 'evidence', 'sepolia');
const transferEvent = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);

export interface CliOptions { mode: Mode; dryRun: boolean }
/** Accepts `full` | `b-pending` (positional, `--mode x` or `--mode=x`) and `--dry-run`. Default mode: full. */
export function parseArgs(argv: readonly string[]): CliOptions {
  let mode: Mode | undefined;
  let dryRun = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === '--') continue;
    if (arg === '--dry-run') { dryRun = true; continue; }
    let value: string | undefined;
    if (arg === '--mode') value = argv[++index];
    else if (arg.startsWith('--mode=')) value = arg.slice('--mode='.length);
    else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    else value = arg;
    if (!MODES.includes(value as Mode)) throw new Error(`Unknown mode ${value ?? '(missing)'}; use full or b-pending`);
    if (mode && mode !== value) throw new Error('Choose a single mode');
    mode = value as Mode;
  }
  return { mode: mode ?? 'full', dryRun };
}

export interface Fees { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
/** Fee rule: tip = max(0.01 gwei, RPC suggestion); max fee = 2 x base fee + tip; refuse above the 20 gwei cap. */
export function computeFees(baseFeePerGas: bigint, suggestedTip = 0n): Fees {
  if (baseFeePerGas < 0n || suggestedTip < 0n) throw new Error('Fee inputs must be non-negative');
  const maxPriorityFeePerGas = suggestedTip > MIN_PRIORITY_FEE ? suggestedTip : MIN_PRIORITY_FEE;
  const maxFeePerGas = 2n * baseFeePerGas + maxPriorityFeePerGas;
  if (maxFeePerGas > MAX_FEE_CAP) throw new Error(`Max fee ${formatGwei(maxFeePerGas)} gwei is above the ${formatGwei(MAX_FEE_CAP)} gwei cap; refusing to send`);
  return { maxFeePerGas, maxPriorityFeePerGas };
}

export interface Needs { treasuryGas: bigint; funderGas: bigint; treasuryWei: bigint; funderWei: bigint; treasuryUsdc: bigint }
/** Upper-bound ETH/USDC needs of one run at a given max fee per gas. */
export function estimateNeeds(mode: Mode, maxFeePerGas: bigint): Needs {
  const g = GAS_BOUNDS;
  const treasuryGas = mode === 'full'
    ? g.deploy + g.usdcTransfer + 2n * g.safePayment + 3n * g.recoveryStart + g.cancelBatch + g.finalize + g.rotation
    : g.deploy + g.usdcTransfer + g.recoveryStart;
  const funderGas = mode === 'full' ? g.kitSweep : 0n;
  return { treasuryGas, funderGas, treasuryWei: treasuryGas * maxFeePerGas, funderWei: funderGas * maxFeePerGas, treasuryUsdc: USDC_FUNDING[mode] };
}

export interface Balances { treasuryEth: bigint; treasuryUsdc: bigint; funderEth: bigint }
/** Human-readable list of what is missing; empty when the balances cover the needs. */
export function shortfalls(needs: Needs, balances: Balances): string[] {
  const missing: string[] = [];
  if (balances.treasuryEth < needs.treasuryWei) missing.push(`TREASURY ETH: has ${formatEther(balances.treasuryEth)}, needs ${formatEther(needs.treasuryWei)}`);
  if (balances.treasuryUsdc < needs.treasuryUsdc) missing.push(`TREASURY USDC: has ${formatUnits(balances.treasuryUsdc, 6)}, needs ${formatUnits(needs.treasuryUsdc, 6)}`);
  if (balances.funderEth < needs.funderWei) missing.push(`FUNDER ETH: has ${formatEther(balances.funderEth)}, needs ${formatEther(needs.funderWei)}`);
  return missing;
}

/** 2025-10-10T17:34:05.123Z -> 2025-10-10T17-34-05Z (file-name safe). */
export function utcStamp(date = new Date()): string { return date.toISOString().replace(/\.\d+Z$/, 'Z').replaceAll(':', '-'); }
export const etherscanTx = (hash: Hash): string => `https://sepolia.etherscan.io/tx/${hash}`;
export const etherscanAddress = (address: Address): string => `https://sepolia.etherscan.io/address/${address}`;
export const evidenceFile = (dir: string, mode: Mode, stamp: string): string => join(dir, `${mode}-${stamp}.json`);
export const runStateFile = (dir: string, mode: Mode, stamp: string): string => join(dir, `${stamp}-${mode}.json`);

const secretForms = (secret: string): string[] => {
  const value = secret.trim().toLowerCase();
  if (value.length < 16) return [];
  return value.startsWith('0x') ? [value, value.slice(2)] : [value];
};
/** Throws when the text contains any of the secrets (case-insensitive, with or without 0x). */
export function assertNoSecrets(text: string, secrets: readonly string[]): void {
  const lower = text.toLowerCase();
  if (secrets.some(secret => secretForms(secret).some(form => lower.includes(form)))) throw new Error('Refusing to write output that contains secret material');
}
export function redact(text: string, secrets: readonly string[]): string {
  let result = text;
  for (const secret of secrets) for (const form of secretForms(secret)) result = result.replace(new RegExp(form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[redacted]');
  return result;
}

export type EvidenceValue = string | number | boolean | bigint | readonly string[];
export interface EvidenceStep { name: string; status: 'success' | 'failed'; txHash?: Hash; etherscan?: string; blockNumber?: string; gasUsed?: string; values?: Record<string, EvidenceValue>; error?: string }
export interface Evidence {
  kind: 'swissquote-wallet-sepolia-story'; mode: Mode; runId: string; chainId: number; status: 'running' | 'success' | 'failed';
  startedAt: string; finishedAt?: string; wallet?: Address; walletEtherscan?: string; deploymentBlock?: string;
  addresses: Record<string, Address>; steps: EvidenceStep[]; failedStep?: string; note?: string;
}
export function createEvidence(mode: Mode, runId: string, startedAt = new Date()): Evidence {
  return { kind: 'swissquote-wallet-sepolia-story', mode, runId, chainId: SEPOLIA_CHAIN_ID, status: 'running', startedAt: startedAt.toISOString(), addresses: {}, steps: [] };
}
const toJson = (value: unknown): string => `${JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`;
/** Writes commit-safe evidence; refuses if any secret would end up in the file. */
export function writeEvidence(path: string, evidence: Evidence, secrets: readonly string[]): void {
  const text = toJson(evidence);
  assertNoSecrets(text, secrets);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
/** Writes the secret run-state file with mode 600 (directory 700). `create` refuses to overwrite an existing file. */
export function writeRunState(path: string, state: unknown, options: { create?: boolean } = {}): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const text = toJson(state);
  if (options.create) writeFileSync(path, text, { mode: 0o600, flag: 'wx' });
  else {
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, text, { mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, path);
  }
  chmodSync(path, 0o600);
}

/** Parses KEY=value lines (comments, blanks and other lines ignored; value split at the first '='). */
export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(raw.trim());
    if (!match) continue;
    let value = match[2]!.trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1);
    env[match[1]!] = value;
  }
  return env;
}
export function rpcUrlsFrom(value: string | undefined): string[] {
  const urls = (value ?? '').split(',').map(url => url.trim()).filter(Boolean);
  const list = urls.length ? urls : [...DEFAULT_RPC_URLS];
  if (list.some(url => !/^https?:\/\//.test(url))) throw new Error('SEPOLIA_RPC_URLS must be comma-separated HTTP(S) URLs');
  return list;
}

/**
 * viem nonce manager whose source never answers below (last confirmed nonce + 1). A load-balanced RPC can report a
 * stale pending count right after a receipt; viem alone only guards nonces above 0 against that.
 */
export function createStoryNonceManager(): { nonceManager: NonceManager; confirm(address: Address, chainId: number, nonce: number): void } {
  const floors = new Map<string, number>();
  const key = (address: string, chainId: number) => `${address.toLowerCase()}.${chainId}`;
  const rpc = jsonRpc();
  const nonceManager = createNonceManager({
    source: {
      async get(parameters) { return Math.max(await rpc.get(parameters), floors.get(key(parameters.address, parameters.chainId)) ?? 0); },
      set() {},
    },
  });
  return {
    nonceManager,
    confirm(address, chainId, nonce) { const k = key(address, chainId); floors.set(k, Math.max(floors.get(k) ?? 0, nonce + 1)); },
  };
}

export function errorText(error: unknown): string {
  if (error && typeof error === 'object') {
    const { shortMessage, details, message } = error as { shortMessage?: string; details?: string; message?: string };
    const parts = [shortMessage, details, message].filter((part): part is string => !!part);
    if (parts.length) return [...new Set(parts)].join(' | ');
  }
  return String(error);
}
const firstLine = (text: string, max = 300): string => (text.split('\n').find(line => line.trim()) ?? text).slice(0, max);

// ---------------------------------------------------------------------------------------------------------------
// Runtime plumbing

const secrets: string[] = [];
const log = (text: string): void => console.log(redact(text, secrets));
const logError = (text: string): void => console.error(redact(text, secrets));
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const lower = (values: readonly string[]) => values.map(value => value.toLowerCase());
const usdc = (amount: bigint) => formatUnits(amount, 6);
const utc = (seconds: bigint) => new Date(Number(seconds) * 1000).toISOString();

/** Retries reads and pre-broadcast work: public RPC back ends can answer one block behind right after a receipt. */
async function retry<T>(label: string, fn: () => Promise<T>, attempts = 5, delayMs = 4_000): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (error) {
      if (attempt >= attempts) throw error;
      log(`  retry ${attempt}/${attempts - 1} ${label}: ${firstLine(errorText(error), 160)}`);
      await sleep(delayMs);
    }
  }
}
/** Resolves to the matched revert text; throws if the call succeeds or fails for another reason. */
async function expectRevert(pending: Promise<unknown>, pattern: RegExp): Promise<string> {
  let failure: { error: unknown } | undefined;
  try { await pending; } catch (error) { failure = { error }; }
  if (!failure) throw new Error(`Expected a revert matching ${pattern}, but the call succeeded`);
  const match = pattern.exec(errorText(failure.error));
  if (!match) throw new Error(`Expected a revert matching ${pattern}; got: ${firstLine(errorText(failure.error))}`);
  return match[0];
}

type Clients = ReturnType<typeof clients>;
type Client = Clients['publicClient'];
interface Sender { label: string; address: Address; account: PrivateKeyAccount; nonceManager: NonceManager }
interface Role { address: Address; privateKey?: Hex; keyPresent: boolean }
interface Ctx {
  publicClient: Client; walletClient: Clients['walletClient']; rpcUrls: string[];
  /** Block that reads and simulations pin to: never older than the last receipt, so a lagging back end cannot feed stale nonces into a signature. */
  head: bigint;
  nonces: ReturnType<typeof createStoryNonceManager>;
  onBroadcast(label: string, hash: Hash, nonce: number, sender: Address): void;
}
interface TxRequest { to: Address; data: Hex; value?: bigint }

function loadRole(env: Record<string, string>, role: 'TREASURY' | 'FUNDER', requireKey: boolean): Role {
  const key = env[`${role}_PRIVATE_KEY`];
  const stated = env[`${role}_ADDRESS`];
  if (key !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`${role}_PRIVATE_KEY in .env.sepolia is malformed`);
  if (key) secrets.push(key);
  if (!key && requireKey) throw new Error(`${role}_PRIVATE_KEY is missing from .env.sepolia`);
  const derived = key ? privateKeyToAccount(key as Hex).address : undefined;
  if (stated !== undefined && !isAddress(stated)) throw new Error(`${role}_ADDRESS in .env.sepolia is malformed`);
  if (derived && stated && getAddress(stated) !== derived) throw new Error(`${role}_ADDRESS does not match ${role}_PRIVATE_KEY`);
  const address = derived ?? (stated ? getAddress(stated) : undefined);
  if (!address) throw new Error(`${role} address not found in .env.sepolia`);
  return { address, ...(key ? { privateKey: key as Hex } : {}), keyPresent: !!key };
}

/**
 * Sends one transaction from a story account: simulate + estimate at ctx.head (retried; nothing broadcast yet),
 * fee rule, viem nonce manager, local signing, one broadcast, receipt within 180 s, success (+ Safe ExecutionSuccess).
 */
async function sendTx(ctx: Ctx, sender: Sender, label: string, build: () => Promise<TxRequest>, safeWallet?: Address): Promise<TransactionReceipt> {
  if (process.env.ALLOW_SEPOLIA_STORY !== 'yes') throw new Error('ALLOW_SEPOLIA_STORY=yes is required to send');
  const { publicClient } = ctx;
  if (await publicClient.getChainId() !== SEPOLIA_CHAIN_ID) throw new Error('RPC is not Sepolia (11155111); refusing to send');
  const { request, gas } = await retry(`${label} simulation`, async () => {
    const request = await build();
    const call = { account: sender.address, to: request.to, data: request.data, value: request.value ?? 0n, blockNumber: ctx.head };
    await publicClient.call(call);
    const estimate = await publicClient.estimateGas(call);
    return { request, gas: (estimate * 6n) / 5n + 10_000n };
  });
  const latest = await retry('latest block', () => publicClient.getBlock({ blockTag: 'latest' }));
  const suggestedTip = await publicClient.estimateMaxPriorityFeePerGas().catch(() => 0n);
  const fees = computeFees(latest.baseFeePerGas ?? 0n, suggestedTip);
  const balance = await retry('sender balance', () => publicClient.getBalance({ address: sender.address }));
  if (balance < gas * fees.maxFeePerGas + (request.value ?? 0n)) throw new Error(`${sender.label} holds ${formatEther(balance)} ETH; ${label} needs up to ${formatEther(gas * fees.maxFeePerGas)} ETH`);
  const nonceKey = { address: sender.address, chainId: SEPOLIA_CHAIN_ID };
  const nonce = await sender.nonceManager.consume({ ...nonceKey, client: publicClient });
  const serializedTransaction = await sender.account.signTransaction({
    chainId: SEPOLIA_CHAIN_ID, type: 'eip1559', to: request.to, data: request.data, value: request.value ?? 0n, nonce, gas, ...fees,
  });
  const hash = keccak256(serializedTransaction);
  ctx.onBroadcast(label, hash, nonce, sender.address);
  try {
    await ctx.walletClient.sendRawTransaction({ serializedTransaction });
  } catch (error) {
    // A fallback transport may report "already known"/"nonce too low" for a transaction the first RPC accepted.
    const seen = await retry('broadcast check', () => publicClient.getTransaction({ hash }), 3, 3_000).then(() => true, () => false);
    if (!seen) { sender.nonceManager.reset(nonceKey); throw error; }
  }
  log(`  sent ${label} (${sender.label}, nonce ${nonce}, max fee ${formatGwei(fees.maxFeePerGas)} gwei): ${etherscanTx(hash)}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS, pollingInterval: 3_000 });
  ctx.nonces.confirm(sender.address, SEPOLIA_CHAIN_ID, nonce);
  if (receipt.blockNumber > ctx.head) ctx.head = receipt.blockNumber;
  if (receipt.status !== 'success') throw new Error(`${label} reverted on chain: ${etherscanTx(hash)}`);
  if (safeWallet) {
    const events = parseEventLogs({ abi: safeAbi, logs: receipt.logs, eventName: ['ExecutionSuccess', 'ExecutionFailure'] })
      .filter(event => getAddress(event.address) === getAddress(safeWallet));
    if (!events.some(event => event.eventName === 'ExecutionSuccess') || events.some(event => event.eventName === 'ExecutionFailure')) throw new Error(`${label}: Safe did not emit ExecutionSuccess`);
  }
  return receipt;
}

/** Sum of USDC Transfer(from -> to) values in a receipt. */
function usdcTransferred(receipt: TransactionReceipt, from: Address, to: Address): bigint {
  return parseEventLogs({ abi: transferEvent, logs: receipt.logs, eventName: 'Transfer' })
    .filter(event => getAddress(event.address) === getAddress(CIRCLE_USDC) && getAddress(event.args.from) === getAddress(from) && getAddress(event.args.to) === getAddress(to))
    .reduce((sum, event) => sum + event.args.value, 0n);
}

interface PreflightReport {
  chainIds: { url: string; chainId?: number; error?: string }[];
  code: { name: string; address: Address; ok: boolean }[];
  usdcHasCode: boolean; baseFee: bigint; suggestedTip: bigint; fees?: Fees; feeError?: string; balances: Balances; head: bigint;
}
async function preflight(publicClient: Client, rpcUrls: readonly string[], treasury: Role, funder: Role | undefined): Promise<PreflightReport> {
  const chainIds = await Promise.all(rpcUrls.map(async url => {
    try { return { url, chainId: await clients([url], SEPOLIA_CHAIN_ID).publicClient.getChainId() }; } catch (error) { return { url, error: firstLine(errorText(error), 160) }; }
  }));
  const names = new Map(Object.entries(ADDRESSES).map(([name, address]) => [address.toLowerCase(), name]));
  const code = await Promise.all(Object.entries(CONTRACT_CODE_HASHES).map(async ([address, expected]) => {
    const bytecode = (await retry(`code of ${address}`, () => publicClient.getCode({ address: address as Address }))) ?? '0x';
    return { name: names.get(address.toLowerCase()) ?? address, address: getAddress(address), ok: keccak256(bytecode) === expected.toLowerCase() };
  }));
  const usdcCode = (await retry('USDC code', () => publicClient.getCode({ address: CIRCLE_USDC }))) ?? '0x';
  const latest = await retry('latest block', () => publicClient.getBlock({ blockTag: 'latest' }));
  const suggestedTip = await publicClient.estimateMaxPriorityFeePerGas().catch(() => 0n);
  let fees: Fees | undefined;
  let feeError: string | undefined;
  try { fees = computeFees(latest.baseFeePerGas ?? 0n, suggestedTip); } catch (error) { feeError = errorText(error); }
  const [treasuryEth, treasuryUsdc, funderEth] = await Promise.all([
    retry('TREASURY ETH', () => publicClient.getBalance({ address: treasury.address })),
    retry('TREASURY USDC', () => publicClient.readContract({ address: CIRCLE_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [treasury.address] })),
    funder ? retry('FUNDER ETH', () => publicClient.getBalance({ address: funder.address })) : Promise.resolve(0n),
  ]);
  return {
    chainIds, code, usdcHasCode: usdcCode !== '0x', baseFee: latest.baseFeePerGas ?? 0n, suggestedTip,
    ...(fees ? { fees } : {}), ...(feeError ? { feeError } : {}), balances: { treasuryEth, treasuryUsdc, funderEth }, head: latest.number,
  };
}
/** Problems that must stop a live run (chain, pinned code, fee cap). Funding is checked separately. */
function preflightProblems(report: PreflightReport): string[] {
  const problems: string[] = [];
  for (const entry of report.chainIds) if (entry.chainId !== undefined && entry.chainId !== SEPOLIA_CHAIN_ID) problems.push(`${entry.url} is chain ${entry.chainId}, not Sepolia`);
  if (report.chainIds[0]?.chainId !== SEPOLIA_CHAIN_ID) problems.push(`primary RPC ${report.chainIds[0]?.url} did not confirm Sepolia`);
  if (report.code.length !== 8) problems.push(`expected 8 pinned contracts, found ${report.code.length}`);
  for (const entry of report.code) if (!entry.ok) problems.push(`code hash mismatch: ${entry.name} ${entry.address}`);
  if (!report.usdcHasCode) problems.push(`no contract code at Circle USDC ${CIRCLE_USDC}`);
  if (report.feeError) problems.push(report.feeError);
  return problems;
}
function printPreflight(report: PreflightReport, treasury: Role, funder: Role | undefined): void {
  for (const entry of report.chainIds) log(`RPC ${entry.url}: ${entry.chainId !== undefined ? `chain ${entry.chainId}${entry.chainId === SEPOLIA_CHAIN_ID ? ' OK' : ' WRONG CHAIN'}` : `unreachable (${entry.error})`}`);
  log(`Pinned contracts: ${report.code.filter(entry => entry.ok).length}/${report.code.length} code hashes match`);
  for (const entry of report.code) log(`  ${entry.ok ? 'OK      ' : 'MISMATCH'} ${entry.name} ${entry.address}`);
  log(`Circle USDC ${CIRCLE_USDC}: ${report.usdcHasCode ? 'contract code present' : 'NO CODE'}`);
  log(`Fees now: base ${formatGwei(report.baseFee)} gwei, RPC tip ${formatGwei(report.suggestedTip)} gwei -> ${report.fees ? `tip ${formatGwei(report.fees.maxPriorityFeePerGas)} gwei, max ${formatGwei(report.fees.maxFeePerGas)} gwei (cap ${formatGwei(MAX_FEE_CAP)})` : report.feeError}`);
  log(`TREASURY ${treasury.address} (key ${treasury.keyPresent ? 'present' : 'absent'}): ${formatEther(report.balances.treasuryEth)} ETH, ${usdc(report.balances.treasuryUsdc)} USDC`);
  if (funder) log(`FUNDER   ${funder.address} (key ${funder.keyPresent ? 'present' : 'absent'}): ${formatEther(report.balances.funderEth)} ETH`);
}

// ---------------------------------------------------------------------------------------------------------------
// Story steps

interface KeyPair { address: Address; privateKey: Hex; mnemonic?: string }
type KeyName = 'owner' | 'card' | 'partner' | 'sq' | 'newOwner' | 'rotatedOwner';
type StoryKeys = Record<KeyName, KeyPair>;
function generateKeys(): StoryKeys {
  const seeded = (mnemonic: string): KeyPair => ({ address: mnemonicToAddress(mnemonic), privateKey: mnemonicToPrivateKey(mnemonic), mnemonic });
  const plain = (): KeyPair => { const privateKey = generatePrivateKey(); return { address: privateKeyToAccount(privateKey).address, privateKey }; };
  return { owner: seeded(generateOwnerSeed()), card: seeded(generateCardSeed()), partner: plain(), sq: plain(), newOwner: seeded(generateOwnerSeed()), rotatedOwner: seeded(generateOwnerSeed()) };
}

interface RunState {
  warning: string; runId: string; mode: Mode; chainId: number; createdAt: string; rpcUrls: string[];
  keys: StoryKeys; saltNonce: string; wallet?: Address; deploymentBlock?: string;
  controllingKey: KeyName; walletUsdcExpected?: string; evidenceFile: string;
  steps: { name: string; status: 'success' | 'failed'; txHash?: Hash; at: string }[];
  lastTransaction?: { label: string; hash: Hash; nonce: number; sender: Address };
  status: 'running' | 'success' | 'failed'; failedStep?: string; error?: string;
}
interface StepOutcome { receipt?: TransactionReceipt; hash?: Hash; blockNumber?: bigint; values?: Record<string, EvidenceValue> }

class Story {
  current = 'setup';
  constructor(readonly ctx: Ctx, readonly keys: StoryKeys, readonly treasury: Sender, readonly evidence: Evidence, readonly state: RunState, readonly files: { runState: string; evidence: string }) {}
  persist(): void { writeRunState(this.files.runState, this.state); writeEvidence(this.files.evidence, this.evidence, secrets); }
  async step(name: string, fn: () => Promise<StepOutcome | void>): Promise<void> {
    this.current = name;
    log(`\n- ${name}`);
    const outcome = (await fn()) ?? {};
    const hash = outcome.receipt?.transactionHash ?? outcome.hash;
    const blockNumber = outcome.receipt?.blockNumber ?? outcome.blockNumber;
    this.evidence.steps.push({
      name, status: 'success', ...(hash ? { txHash: hash, etherscan: etherscanTx(hash) } : {}),
      ...(blockNumber !== undefined ? { blockNumber: blockNumber.toString() } : {}),
      ...(outcome.receipt ? { gasUsed: outcome.receipt.gasUsed.toString() } : {}), ...(outcome.values ? { values: outcome.values } : {}),
    });
    this.state.steps.push({ name, status: 'success', ...(hash ? { txHash: hash } : {}), at: new Date().toISOString() });
    this.persist();
    log(`PASS ${name}${hash ? `  ${etherscanTx(hash)}` : ''}`);
  }
  finish(status: 'success' | 'failed', error?: string): void {
    this.evidence.status = status; this.evidence.finishedAt = new Date().toISOString();
    this.state.status = status;
    if (status === 'failed') {
      this.evidence.failedStep = this.current; this.state.failedStep = this.current; this.state.error = error;
      this.evidence.steps.push({ name: this.current, status: 'failed', ...(error ? { error } : {}) });
      this.state.steps.push({ name: this.current, status: 'failed', at: new Date().toISOString() });
    }
    this.persist();
  }
}

const safeNonce = (ctx: Ctx, wallet: Address) => retry('Safe nonce', () => ctx.publicClient.readContract({ address: wallet, abi: safeAbi, functionName: 'nonce', blockNumber: ctx.head }));
const owners = (ctx: Ctx, wallet: Address) => retry('owners', () => ctx.publicClient.readContract({ address: wallet, abi: safeAbi, functionName: 'getOwners', blockNumber: ctx.head }));
const usdcBalance = (ctx: Ctx, address: Address) => retry('USDC balance', () => ctx.publicClient.readContract({ address: CIRCLE_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [address], blockNumber: ctx.head }));
const ethBalance = (ctx: Ctx, address: Address) => retry('ETH balance', () => ctx.publicClient.getBalance({ address, blockNumber: ctx.head }));
const pendingRequest = (ctx: Ctx, module: Address, wallet: Address) => retry('recovery request', () => ctx.publicClient.readContract({ address: module, abi: moduleAbi, functionName: 'getRecoveryRequest', args: [wallet], blockNumber: ctx.head }));
const recoveryRequest = async (ctx: Ctx, wallet: Address, module: Address, newOwner: Address): Promise<RecoveryRequest> => ({
  wallet, module, newOwner, chainId: CHAIN_ID,
  nonce: await retry('module nonce', () => ctx.publicClient.readContract({ address: module, abi: moduleAbi, functionName: 'nonce', args: [wallet], blockNumber: ctx.head })),
});
const finalizeData = (wallet: Address) => encodeFunctionData({ abi: moduleAbi, functionName: 'finalizeRecovery', args: [wallet] });
const usdcTransfer = (to: Address, amount: bigint) => encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] });

/** Owner-signed Safe transaction relayed and paid by TREASURY. The builder re-runs if the simulation is retried. */
function execSafe(story: Story, wallet: Address, label: string, signer: Hex, buildTx: () => Promise<SafeTx>): Promise<TransactionReceipt> {
  return sendTx(story.ctx, story.treasury, label, async () => {
    const tx = await buildTx();
    return { to: wallet, data: encodeExecTransaction(tx, await signSafeTx(signer, wallet, tx, CHAIN_ID)) };
  }, wallet);
}
/** Card + helper guardian signatures, submitted by TREASURY; returns the receipt and the measured delay. */
async function startRecovery(story: Story, wallet: Address, module: Address, helper: KeyPair, label: string) {
  const { ctx, keys } = story;
  const receipt = await sendTx(ctx, story.treasury, label, async () => {
    const request = await recoveryRequest(ctx, wallet, module, keys.newOwner.address);
    await assertRecoveryHash(ctx.publicClient, request);
    const approvals = await Promise.all([signRecovery(keys.card.privateKey, request), signRecovery(helper.privateKey, request)]);
    return { to: module, data: encodeRecoveryCall(request, approvals) };
  });
  const request = await pendingRequest(ctx, module, wallet);
  const block = await retry('receipt block', () => ctx.publicClient.getBlock({ blockNumber: receipt.blockNumber }));
  assert.deepEqual(lower(request.newOwners), lower([keys.newOwner.address]), 'pending request names the wrong new owner');
  return { receipt, request, executeAfter: request.executeAfter, delay: request.executeAfter - block.timestamp };
}

async function deployAndVerify(story: Story, setup: WalletSetup): Promise<{ wallet: Address; deploymentBlock: bigint }> {
  const { ctx } = story;
  story.current = 'deploy-wallet';
  const deploy = buildDeployCall(setup);
  const proxyCode = await retry('proxyCreationCode', () => ctx.publicClient.readContract({ address: deploy.address, abi: factoryAbi, functionName: 'proxyCreationCode', blockNumber: ctx.head }));
  const wallet = computeWalletAddress(setup, proxyCode);
  story.state.wallet = wallet; story.evidence.wallet = wallet; story.evidence.walletEtherscan = etherscanAddress(wallet);
  story.persist();
  log(`Wallet (CREATE2): ${wallet}  ${etherscanAddress(wallet)}`);
  let deploymentBlock = 0n;
  await story.step('deploy-wallet', async () => {
    const receipt = await sendTx(ctx, story.treasury, 'deploy-wallet', async () => ({ to: deploy.address, data: encodeFunctionData({ abi: deploy.abi, functionName: deploy.functionName, args: deploy.args }) }));
    const code = (await retry('wallet code', () => ctx.publicClient.getCode({ address: wallet, blockNumber: receipt.blockNumber }))) ?? '0x';
    assert.equal(keccak256(code), PROXY_RUNTIME_CODE_HASH, 'deployed wallet code is not the pinned Safe proxy');
    deploymentBlock = receipt.blockNumber;
    story.state.deploymentBlock = deploymentBlock.toString(); story.evidence.deploymentBlock = deploymentBlock.toString();
    return { receipt, values: { wallet, factory: deploy.address, singleton: ADDRESSES.safeL2 } };
  });
  await story.step('verify-wallet', async () => {
    const verification = await retry('verifyWallet', async () => {
      const result = await verifyWallet(ctx.publicClient, setup, { fromBlock: deploymentBlock, expectedWallet: wallet });
      if (!result.ok) throw new Error(`verifyWallet: ${result.reasons.join('; ')}`);
      return result;
    }, 6, 5_000);
    assert.equal(await ethBalance(ctx, wallet), 0n, 'wallet must hold 0 ETH');
    return { values: { ok: verification.ok, fromBlock: deploymentBlock, walletEth: '0' } };
  });
  return { wallet, deploymentBlock };
}

async function fundWallet(story: Story, wallet: Address, amount: bigint): Promise<void> {
  const { ctx, treasury } = story;
  const name = `fund-wallet-${usdc(amount)}-usdc`;
  await story.step(name, async () => {
    const receipt = await sendTx(ctx, treasury, name, async () => ({ to: CIRCLE_USDC, data: usdcTransfer(wallet, amount) }));
    assert.equal(usdcTransferred(receipt, treasury.address, wallet), amount, 'USDC Transfer event missing');
    assert.equal(await usdcBalance(ctx, wallet), amount, 'wallet USDC balance after funding');
    story.state.walletUsdcExpected = usdc(amount);
    return { receipt, values: { from: treasury.address, amountUsdc: usdc(amount), walletUsdc: usdc(amount) } };
  });
}

/** Polls the latest block until its timestamp reaches executeAfter, simulating finalize at every earlier block. */
async function waitForMaturity(ctx: Ctx, caller: Address, module: Address, wallet: Address, executeAfter: bigint) {
  let lastRefused: { number: bigint; timestamp: bigint } | undefined;
  let lastLog = 0;
  const deadline = Math.max(Date.now(), Number(executeAfter) * 1000) + 15 * 60_000;
  for (;;) {
    const block = await retry('latest block', () => ctx.publicClient.getBlock({ blockTag: 'latest' }));
    if (block.number >= ctx.head) {
      if (block.timestamp >= executeAfter) { ctx.head = block.number; return { matured: block, lastRefused }; }
      if (!lastRefused || block.number > lastRefused.number) {
        const outcome = await ctx.publicClient.call({ account: caller, to: module, data: finalizeData(wallet), blockNumber: block.number })
          .then(() => 'succeeded' as const, (error: unknown) => (/recovery period still pending/.test(errorText(error)) ? 'refused' as const : 'unknown' as const));
        if (outcome === 'succeeded') throw new Error(`finalizeRecovery simulation succeeded at block ${block.number}, before executeAfter`);
        if (outcome === 'refused') lastRefused = { number: block.number, timestamp: block.timestamp };
      }
      if (Date.now() - lastLog > 30_000) { log(`  waiting: ${executeAfter - block.timestamp} s until executeAfter (block ${block.number})`); lastLog = Date.now(); }
    }
    if (Date.now() > deadline) throw new Error('Timed out waiting for the recovery delay');
    await sleep(5_000);
  }
}

async function expectGs026(story: Story, wallet: Address, signer: KeyPair): Promise<string> {
  const { ctx, treasury } = story;
  return retry('GS026 simulation', async () => {
    const tx = makeSafeTx({ to: CIRCLE_USDC, nonce: await safeNonce(ctx, wallet), data: usdcTransfer(treasury.address, 1n) });
    const data = encodeExecTransaction(tx, await signSafeTx(signer.privateKey, wallet, tx, CHAIN_ID));
    return expectRevert(ctx.publicClient.call({ account: treasury.address, to: wallet, data, blockNumber: ctx.head }), /GS026/);
  });
}

async function runFull(story: Story, setup: WalletSetup, funder: Role & { privateKey: Hex }): Promise<void> {
  const { ctx, keys, treasury } = story;
  const { moduleA, moduleB } = ADDRESSES;
  const { wallet } = await deployAndVerify(story, setup);

  await story.step('ownership-proof-eip1271', async () => {
    const nonce = `sepolia-story-${story.state.runId}`;
    const proof = await signOwnershipProof(keys.owner.privateKey, 'SEPOLIA-story', wallet, nonce, CHAIN_ID);
    await retry('verifyOwnershipProof', async () => { assert.equal(await verifyOwnershipProof(ctx.publicClient, wallet, proof.hash, proof.signature), true, 'EIP-1271 proof not accepted'); });
    return { values: { clientId: 'SEPOLIA-story', nonce, messageHash: proof.hash, verified: true } };
  });

  await fundWallet(story, wallet, USDC_FUNDING.full);

  for (const [amount, expected] of [[1_000_000n, 'Small'], [6_000_000n, 'Large']] as const) {
    const name = `pay-${usdc(amount)}-usdc-${expected.toLowerCase()}`;
    await story.step(name, async () => {
      const receipt = await execSafe(story, wallet, name, keys.owner.privateKey, async () => {
        const tx = makeSafeTx({ to: CIRCLE_USDC, nonce: await safeNonce(ctx, wallet), data: usdcTransfer(treasury.address, amount) });
        const classification = classifyTransaction(wallet, tx);
        assert.equal(classification.class, expected); assert.equal(classification.requiresPasskey, expected === 'Large');
        return tx;
      });
      assert.equal(usdcTransferred(receipt, wallet, treasury.address), amount, 'USDC Transfer event missing');
      return { receipt, values: { amountUsdc: usdc(amount), class: expected, requiresPasskey: expected === 'Large', recipient: treasury.address } };
    });
  }
  await story.step('balances-after-payments', async () => {
    assert.equal(await usdcBalance(ctx, wallet), 3_000_000n, 'wallet should hold 10 - 1 - 6 = 3 USDC');
    assert.equal(await ethBalance(ctx, wallet), 0n, 'wallet must hold 0 ETH (TREASURY paid the gas)');
    story.state.walletUsdcExpected = '3';
    return { values: { walletUsdc: '3', walletEth: '0', paidToTreasuryUsdc: '7', atBlock: ctx.head } };
  });

  await story.step('start-recovery-a', async () => {
    const { receipt, executeAfter, delay } = await startRecovery(story, wallet, moduleA, keys.partner, 'start-recovery-a');
    assert.equal(delay, BigInt(MODULE_WAITS.A));
    return { receipt, values: { module: moduleA, guardians: ['card', 'partner'], executeAfter, delaySeconds: delay } };
  });
  await story.step('start-recovery-b', async () => {
    const { receipt, executeAfter, delay } = await startRecovery(story, wallet, moduleB, keys.sq, 'start-recovery-b');
    assert.equal(delay, 259_200n, 'module B must wait exactly 259,200 s');
    return { receipt, values: { module: moduleB, guardians: ['card', 'swissquote'], executeAfter, executeAfterUtc: utc(executeAfter), delaySeconds: delay } };
  });
  await story.step('cancel-both-recoveries', async () => {
    const receipt = await execSafe(story, wallet, 'cancel-both-recoveries', keys.owner.privateKey, async () => {
      const tx = buildCancelRecoveryTx(wallet, await safeNonce(ctx, wallet), [moduleA, moduleB]);
      assert.equal(classifyTransaction(wallet, tx).class, 'Protective');
      return tx;
    });
    for (const module of [moduleA, moduleB]) assert.equal((await pendingRequest(ctx, module, wallet)).executeAfter, 0n, `${module} still pending`);
    return { receipt, values: { class: 'Protective', modules: [moduleA, moduleB], executeAfterA: '0', executeAfterB: '0' } };
  });
  for (const [module, suffix] of [[moduleA, 'a'], [moduleB, 'b']] as const) {
    await story.step(`no-card-refused-${suffix}`, async () => {
      const refusedWith = await retry('no-card simulation', async () => {
        const request = await recoveryRequest(ctx, wallet, module, keys.newOwner.address);
        const helpers = await Promise.all([signRecovery(keys.partner.privateKey, request), signRecovery(keys.sq.privateKey, request)]);
        return expectRevert(ctx.publicClient.call({ account: treasury.address, to: module, data: encodeRecoveryCall(request, helpers), blockNumber: ctx.head }), /Signer not a guardian|confirmed signatures less than threshold/);
      });
      return { values: { module, signers: ['partner', 'swissquote'], readOnly: true, refusedWith } };
    });
  }

  let executeAfterA = 0n;
  await story.step('start-recovery-a-again', async () => {
    const { receipt, executeAfter, delay } = await startRecovery(story, wallet, moduleA, keys.partner, 'start-recovery-a-again');
    assert.equal(delay, 180n, 'module A must wait exactly 180 s');
    const refusedWith = await retry('early finalize simulation', () => expectRevert(ctx.publicClient.call({ account: treasury.address, to: moduleA, data: finalizeData(wallet), blockNumber: receipt.blockNumber }), /recovery period still pending/));
    executeAfterA = executeAfter;
    return { receipt, values: { module: moduleA, executeAfter, executeAfterUtc: utc(executeAfter), delaySeconds: delay, finalizeAtStartBlock: refusedWith } };
  });
  await story.step('wait-recovery-delay', async () => {
    const { matured, lastRefused } = await waitForMaturity(ctx, treasury.address, moduleA, wallet, executeAfterA);
    return {
      values: {
        executeAfter: executeAfterA, maturedBlock: matured.number, maturedTimestamp: matured.timestamp,
        ...(lastRefused ? { lastRefusedBlock: lastRefused.number, lastRefusedTimestamp: lastRefused.timestamp, refusedSecondsBeforeMaturity: executeAfterA - lastRefused.timestamp } : {}),
      },
    };
  });
  await story.step('finalize-recovery-a', async () => {
    const receipt = await sendTx(ctx, treasury, 'finalize-recovery-a', async () => ({ to: moduleA, data: finalizeData(wallet) }));
    const current = await owners(ctx, wallet);
    assert.deepEqual(lower(current), lower([keys.newOwner.address]), 'owner after recovery');
    story.state.controllingKey = 'newOwner';
    return { receipt, values: { module: moduleA, owners: [...current] } };
  });
  await story.step('old-key-rejected-gs026', async () => ({ values: { signer: keys.owner.address, readOnly: true, refusedWith: await expectGs026(story, wallet, keys.owner) } }));

  const kitRpcUrls = ctx.rpcUrls.slice(0, 2);
  await story.step('stale-kit-refused', async () => {
    const code = await generateKitCode(); secrets.push(code);
    const staleKit = await createKit(keys.owner.mnemonic!, code, { wallet, owner: keys.owner.address, chainId: CHAIN_ID });
    // Never-funded decoy payer: sweepKit refuses before sending; even a stale RPC read could not get a transaction mined.
    const decoy = generatePrivateKey(); secrets.push(decoy);
    const refusedWith = await retry('stale kit', () => expectRevert(sweepKit({ kit: staleKit, code, destination: treasury.address, rpcUrls: kitRpcUrls, funderPrivateKey: decoy, allowSepolia: true }), /no longer controls/), 3, 5_000);
    return { values: { kitOwner: keys.owner.address, readOnly: true, refusedWith } };
  });
  let kitCode = '';
  let kit!: Awaited<ReturnType<typeof createKit>>;
  await story.step('kit-encrypt-decrypt', async () => {
    kitCode = await generateKitCode(); secrets.push(kitCode);
    kit = await createKit(keys.newOwner.mnemonic!, kitCode, { wallet, owner: keys.newOwner.address, chainId: CHAIN_ID });
    assert.equal((await openKit(kit, kitCode)).mnemonic, keys.newOwner.mnemonic);
    await assert.rejects(openKit(kit, await generateKitCode()));
    return { values: { kitOwner: keys.newOwner.address, roundTrip: true, wrongCodeRejected: true } };
  });
  await story.step('kit-sweep', async () => {
    const latest = await retry('latest block', () => ctx.publicClient.getBlock({ blockTag: 'latest' }));
    const fees = computeFees(latest.baseFeePerGas ?? 0n, await ctx.publicClient.estimateMaxPriorityFeePerGas().catch(() => 0n));
    const funderEth = await retry('FUNDER ETH', () => ctx.publicClient.getBalance({ address: funder.address }));
    if (funderEth < GAS_BOUNDS.kitSweep * fees.maxFeePerGas) throw new Error(`FUNDER holds ${formatEther(funderEth)} ETH; the sweep needs up to ${formatEther(GAS_BOUNDS.kitSweep * fees.maxFeePerGas)} ETH`);
    // sweepKit reads at "latest": wait until the latest state shows the recovered owner.
    await retry('owner visible at latest', async () => {
      const latestOwners = await ctx.publicClient.readContract({ address: wallet, abi: safeAbi, functionName: 'getOwners' });
      assert.deepEqual(lower(latestOwners), lower([keys.newOwner.address]));
    });
    const fromBlock = ctx.head;
    let result: { amount: string; transactionHash: Hash } | undefined;
    for (let attempt = 1; !result; attempt++) {
      try {
        result = await sweepKit({ kit, code: kitCode, destination: treasury.address, rpcUrls: kitRpcUrls, funderPrivateKey: funder.privateKey, allowSepolia: true });
      } catch (error) {
        const text = errorText(error);
        const timedOut = /Timed out while waiting for transaction with hash "(0x[0-9a-fA-F]{64})"/.exec(text);
        if (timedOut) {
          // kit-sweep.ts sends with viem's default fees (a low tip); give the broadcast transaction a second window.
          const hash = timedOut[1] as Hash;
          log(`  kit-sweep receipt not seen within ${RECEIPT_TIMEOUT_MS / 1000} s; waiting once more: ${etherscanTx(hash)}`);
          const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS, pollingInterval: 3_000 });
          result = { amount: usdcTransferred(receipt, wallet, treasury.address).toString(), transactionHash: hash };
        } else if (/Sweep did not empty wallet/.test(text)) {
          // Raised after the receipt when the re-read hit a lagging back end; confirm from the Transfer log instead.
          const logs = await retry('sweep Transfer log', async () => {
            const found = await ctx.publicClient.getLogs({ address: CIRCLE_USDC, event: transferEvent[0], args: { from: wallet, to: treasury.address }, fromBlock, toBlock: 'latest' });
            if (!found.length) throw new Error('sweep transfer not visible yet');
            return found;
          }, 6, 5_000);
          const found = logs.at(-1)!;
          result = { amount: found.args.value!.toString(), transactionHash: found.transactionHash };
          log('  kit-sweep post-check read a stale block; confirmed from the Transfer log');
        } else if (attempt < 3 && /no longer controls|No USDC to sweep/.test(text)) {
          log(`  retry ${attempt}/2 kit-sweep (refused before sending, stale read?): ${firstLine(text, 120)}`);
          await sleep(5_000);
        } else throw error;
      }
    }
    assert.equal(result.amount, '3000000', 'sweep amount');
    const receipt = await retry('sweep receipt', () => ctx.publicClient.getTransactionReceipt({ hash: result.transactionHash }));
    assert.equal(receipt.status, 'success');
    assert.equal(getAddress(receipt.from), funder.address, 'FUNDER must pay the sweep gas');
    assert.equal(usdcTransferred(receipt, wallet, treasury.address), 3_000_000n, 'sweep Transfer event');
    if (receipt.blockNumber > ctx.head) ctx.head = receipt.blockNumber;
    assert.equal(await usdcBalance(ctx, wallet), 0n, 'wallet empty after sweep');
    story.state.walletUsdcExpected = '0';
    return { receipt, values: { amountUsdc: '3', destination: treasury.address, gasPaidBy: funder.address, services: 'none (RPC only)', walletUsdcAfter: '0' } };
  });
  await story.step('rotate-owner', async () => {
    const receipt = await execSafe(story, wallet, 'rotate-owner', keys.newOwner.privateKey, async () => {
      const tx = buildRotateOwnerTx(wallet, keys.newOwner.address, keys.rotatedOwner.address, await safeNonce(ctx, wallet));
      assert.equal(classifyTransaction(wallet, tx).class, 'Admin');
      return tx;
    });
    const current = await owners(ctx, wallet);
    assert.deepEqual(lower(current), lower([keys.rotatedOwner.address]), 'owner after rotation');
    story.state.controllingKey = 'rotatedOwner';
    return { receipt, values: { class: 'Admin', owners: [...current] } };
  });
  await story.step('previous-owner-rejected-gs026', async () => ({ values: { signer: keys.newOwner.address, readOnly: true, refusedWith: await expectGs026(story, wallet, keys.newOwner) } }));
  await story.step('replacement-kit', async () => {
    const code = await generateKitCode(); secrets.push(code);
    const replacement = await createKit(keys.rotatedOwner.mnemonic!, code, { wallet, owner: keys.rotatedOwner.address, chainId: CHAIN_ID });
    assert.equal((await openKit(replacement, code)).owner, keys.rotatedOwner.address);
    return { values: { kitOwner: keys.rotatedOwner.address } };
  });
}

async function runBPending(story: Story, setup: WalletSetup): Promise<void> {
  const { ctx, keys, treasury } = story;
  const { moduleB } = ADDRESSES;
  const { wallet } = await deployAndVerify(story, setup);
  await fundWallet(story, wallet, USDC_FUNDING['b-pending']);
  let executeAfterB = 0n;
  let startBlock = 0n;
  await story.step('start-recovery-b', async () => {
    const { receipt, executeAfter, delay } = await startRecovery(story, wallet, moduleB, keys.sq, 'start-recovery-b');
    assert.equal(delay, 259_200n, 'module B must wait exactly 259,200 s');
    executeAfterB = executeAfter; startBlock = receipt.blockNumber;
    return { receipt, values: { module: moduleB, guardians: ['card', 'swissquote'], executeAfter, executeAfterUtc: utc(executeAfter), delaySeconds: delay } };
  });
  await story.step('recovery-b-pending', async () => {
    const request = await pendingRequest(ctx, moduleB, wallet);
    assert.equal(request.executeAfter, executeAfterB);
    const refusedWith = await retry('finalize simulation', () => expectRevert(ctx.publicClient.call({ account: treasury.address, to: moduleB, data: finalizeData(wallet), blockNumber: ctx.head }), /recovery period still pending/));
    return {
      values: {
        guardiansApprovalCount: request.guardiansApprovalCount, newThreshold: request.newThreshold, executeAfter: request.executeAfter,
        executeAfterUtc: utc(request.executeAfter), newOwners: [...request.newOwners], startBlock, finalizeNow: refusedWith,
        finalizeLater: `after ${utc(request.executeAfter)} anyone may call finalizeRecovery(${wallet}) on ${moduleB}; no key needed`,
        finalizeCalldata: finalizeData(wallet),
      },
    };
  });
  story.evidence.note = `Recovery through module B is pending, not finished. It can be finalized after ${utc(executeAfterB)} by anyone calling finalizeRecovery(${wallet}) on ${moduleB}.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Entry points

function readEnvFile(): Record<string, string> {
  if (!existsSync(ENV_FILE)) throw new Error(`${ENV_FILE} not found; create it with scripts/sepolia-keys.mjs first`);
  return parseEnv(readFileSync(ENV_FILE, 'utf8'));
}

async function dryRun(mode: Mode, env: Record<string, string>, rpcUrls: string[]): Promise<number> {
  log(`Sepolia story dry run (${mode}): read-only, nothing is signed or sent.`);
  const treasury = loadRole(env, 'TREASURY', false);
  const funder = loadRole(env, 'FUNDER', false);
  const report = await preflight(clients(rpcUrls, SEPOLIA_CHAIN_ID).publicClient, rpcUrls, treasury, funder);
  printPreflight(report, treasury, funder);
  const fee = report.fees?.maxFeePerGas ?? MAX_FEE_CAP;
  const plans: [string, Needs, Needs][] = MODES.map(m => [m, estimateNeeds(m, fee), estimateNeeds(m, MAX_FEE_CAP)]);
  const sum = (a: Needs, b: Needs): Needs => ({ treasuryGas: a.treasuryGas + b.treasuryGas, funderGas: a.funderGas + b.funderGas, treasuryWei: a.treasuryWei + b.treasuryWei, funderWei: a.funderWei + b.funderWei, treasuryUsdc: a.treasuryUsdc + b.treasuryUsdc });
  plans.push(['both', sum(plans[0]![1], plans[1]![1]), sum(plans[0]![2], plans[1]![2])]);
  log(`Estimated needs (gas upper bounds x max fee now; [at the ${formatGwei(MAX_FEE_CAP)} gwei cap]):`);
  for (const [name, now, cap] of plans) {
    const missing = shortfalls(now, report.balances);
    log(`  ${name.padEnd(9)} TREASURY ${now.treasuryGas} gas = ${formatEther(now.treasuryWei)} ETH [${formatEther(cap.treasuryWei)}] + ${usdc(now.treasuryUsdc)} USDC; FUNDER ${now.funderGas} gas = ${formatEther(now.funderWei)} ETH [${formatEther(cap.funderWei)}] -> ${missing.length ? `INSUFFICIENT (${missing.join('; ')})` : 'sufficient'}`);
  }
  const problems = preflightProblems(report);
  const ready = !problems.length && !shortfalls(estimateNeeds(mode, fee), report.balances).length && treasury.keyPresent && (mode !== 'full' || funder.keyPresent);
  if (problems.length) logError(`Problems: ${problems.join('; ')}`);
  log(`Ready for a live ${mode} run: ${ready ? 'yes' : 'no'}`);
  return problems.length ? 1 : 0;
}

async function liveRun(mode: Mode, env: Record<string, string>, rpcUrls: string[]): Promise<number> {
  const treasuryRole = loadRole(env, 'TREASURY', true);
  const funderRole = mode === 'full' ? loadRole(env, 'FUNDER', true) : undefined;
  const { publicClient, walletClient } = clients(rpcUrls, SEPOLIA_CHAIN_ID);
  log(`Sepolia story (${mode}): live run, TREASURY sends and pays${mode === 'full' ? ', FUNDER pays the kit sweep' : ''}.`);
  const report = await preflight(publicClient, rpcUrls, treasuryRole, funderRole);
  printPreflight(report, treasuryRole, funderRole);
  const problems = [...preflightProblems(report), ...(report.fees ? shortfalls(estimateNeeds(mode, report.fees.maxFeePerGas), report.balances) : [])];
  if (problems.length) { logError(`Refusing to start: ${problems.join('; ')}`); return 1; }

  const nonces = createStoryNonceManager();
  const account = privateKeyToAccount(treasuryRole.privateKey!, { nonceManager: nonces.nonceManager });
  const treasury: Sender = { label: 'TREASURY', address: account.address, account, nonceManager: nonces.nonceManager };
  const keys = generateKeys();
  for (const pair of Object.values(keys)) secrets.push(pair.privateKey, ...(pair.mnemonic ? [pair.mnemonic] : []));
  const startedAt = new Date();
  const runId = utcStamp(startedAt);
  const files = { runState: runStateFile(RUNS_DIR, mode, runId), evidence: evidenceFile(EVIDENCE_DIR, mode, runId) };
  const saltNonce = randomSaltNonce();
  const state: RunState = {
    warning: 'Throwaway Sepolia test keys. Never reuse them, never commit this file.', runId, mode, chainId: SEPOLIA_CHAIN_ID,
    createdAt: startedAt.toISOString(), rpcUrls, keys, saltNonce: saltNonce.toString(), controllingKey: 'owner', evidenceFile: files.evidence, steps: [], status: 'running',
  };
  writeRunState(files.runState, state, { create: true });
  const evidence = createEvidence(mode, runId, startedAt);
  evidence.addresses = {
    treasury: treasury.address, ...(funderRole ? { funder: funderRole.address } : {}),
    owner: keys.owner.address, cardGuardian: keys.card.address, partnerGuardian: keys.partner.address, swissquoteGuardian: keys.sq.address,
    recoveryNewOwner: keys.newOwner.address, rotationOwner: keys.rotatedOwner.address,
    moduleA: ADDRESSES.moduleA, moduleB: ADDRESSES.moduleB, usdc: CIRCLE_USDC, factory: ADDRESSES.factory,
  };
  const ctx: Ctx = {
    publicClient, walletClient, rpcUrls, head: report.head, nonces,
    onBroadcast(label, hash, nonce, sender) { state.lastTransaction = { label, hash, nonce, sender }; writeRunState(files.runState, state); },
  };
  const story = new Story(ctx, keys, treasury, evidence, state, files);
  story.persist();
  log(`Run state (throwaway keys, mode 600, git-ignored): ${files.runState}`);
  log(`Evidence: ${files.evidence}`);
  for (const [name, address] of Object.entries(evidence.addresses)) log(`  ${name.padEnd(18)} ${address}`);
  const setup: WalletSetup = {
    owner: keys.owner.address, cardGuardian: keys.card.address, partnerGuardian: keys.partner.address, sqGuardian: keys.sq.address, saltNonce, chainId: CHAIN_ID,
  };
  story.current = 'preflight';
  try {
    await story.step('preflight', async () => ({
      blockNumber: report.head,
      values: {
        chainId: SEPOLIA_CHAIN_ID, rpcUrls, pinnedCodeHashes: `${report.code.filter(entry => entry.ok).length}/8 match`,
        treasuryEth: formatEther(report.balances.treasuryEth), treasuryUsdc: usdc(report.balances.treasuryUsdc),
        ...(funderRole ? { funderEth: formatEther(report.balances.funderEth) } : {}), maxFeeGwei: formatGwei(report.fees!.maxFeePerGas),
      },
    }));
    if (mode === 'full') await runFull(story, setup, { ...funderRole!, privateKey: funderRole!.privateKey! });
    else await runBPending(story, setup);
    story.finish('success');
  } catch (error) {
    const message = redact(firstLine(errorText(error), 600), secrets);
    try { story.finish('failed', message); } catch (writeError) { logError(`Could not record the failure: ${firstLine(errorText(writeError))}`); }
    logError(`\nFAILED at step "${story.current}": ${message}`);
    logError(`Run state with the throwaway keys to recover test funds: ${files.runState}`);
    logError(`Evidence so far: ${files.evidence}`);
    return 1;
  }
  log(`\nAll ${evidence.steps.length} steps passed. Wallet ${state.wallet}`);
  if (mode === 'b-pending') log(evidence.note ?? '');
  log(`Evidence: ${files.evidence}`);
  return 0;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(argv);
  if (!options.dryRun && process.env.ALLOW_SEPOLIA_STORY !== 'yes') {
    logError('Refusing to send: set ALLOW_SEPOLIA_STORY=yes for the live Sepolia story, or pass --dry-run for read-only checks.');
    return 1;
  }
  const env = readEnvFile();
  const rpcUrls = rpcUrlsFrom(process.env.SEPOLIA_RPC_URLS ?? env.SEPOLIA_RPC_URLS);
  return options.dryRun ? dryRun(options.mode, env, rpcUrls) : liveRun(options.mode, env, rpcUrls);
}

if (isMain(import.meta.url)) {
  main().then(code => { process.exitCode = code; }, error => { logError(`story-sepolia: ${firstLine(errorText(error), 600)}`); process.exitCode = 1; });
}
