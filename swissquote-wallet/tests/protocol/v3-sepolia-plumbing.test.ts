import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, type Address, type Hex, type PublicClient } from 'viem';
import { sepoliaLaunchConfig, assertSafeSepoliaEnv, SEPOLIA_PORTS } from '../../sepolia-demo.mjs';
import { relayerStatus } from '../../scripts/sepolia-relayer-status.mjs';
import { sepoliaFees, isProtectiveCancel, createViemChain } from '../../services/swissquote/src/chain.ts';
import { ADDRESSES, moduleAbi, buildCancelRecoveryTx, makeSafeTx, safeTxToWire } from '../../packages/protocol/src/index.ts';
import { ownershipProofText } from '../../packages/protocol/src/signing.ts';
import { waitForBlockOn } from '../../apps/wallet/src/chain.ts';
const wallet = '0x1111111111111111111111111111111111111111' as Address;
const key = `0x${'11'.repeat(32)}` as Hex; // public TEST DOUBLE key, never a funded service key
const cancel = { kind: 'safe-tx' as const, wallet, tx: safeTxToWire(buildCancelRecoveryTx(wallet, 0n, [ADDRESSES.moduleA, ADDRESSES.moduleB])), signature: '0x' as Hex };

test('TEST DOUBLE: launcher pins isolated v3 ports/origins/storage and strips inherited keys', () => {
  const inherited = { PORT: '4001', SQ_PORT: '4001', PARTNER_PORT: '4002', VITE_SQ_URL: 'http://localhost:4001', RELAYER_PRIVATE_KEY: 'not-a-key', EXTRA_PRIVATE_KEY: 'not-a-key', SQ_FEATURES: 'audit' };
  const { env, commands } = sepoliaLaunchConfig(inherited, '/isolated/v3', 'unit-run');
  assert.deepEqual(SEPOLIA_PORTS.map(([port]) => port), [5273, 5274, 4101, 4102]);
  assert.equal(env.PORT, '4101'); assert.equal(env.PARTNER_PORT, '4102');
  assert.equal(env.WEBAUTHN_ORIGINS, 'http://localhost:5273');
  assert.equal(env.VITE_SQ_URL, 'http://localhost:4101');
  assert.equal(env.SQ_DATA_DIR, '/isolated/v3/.sepolia-runs/unit-run/swissquote');
  assert.match(env.SQ_FEATURES, /strictSponsorship/); assert.match(env.SQ_FEATURES, /audit/);
  assert.equal(env.RELAYER_PRIVATE_KEY, undefined); assert.equal(env.EXTRA_PRIVATE_KEY, undefined);
  assert.ok(commands.slice(2).every(([, args]) => args.includes('--strictPort')));
  assert.throws(() => assertSafeSepoliaEnv({ PARTNER_DEMO_FOOLED: ' TRUE ' }), /not allowed/);
  assert.throws(() => sepoliaLaunchConfig({}, '/v3', '../v2'), /run ID/);
});
test('TEST DOUBLE: 20gwei ordinary cap, 100gwei protective cap, no caller-selected admin escalation', () => {
  assert.throws(() => sepoliaFees(20_000_000_000n, 0n), /20 gwei safety cap/);
  assert.equal(sepoliaFees(20_000_000_000n, 0n, true).maxFeePerGas, 40_010_000_000n);
  assert.throws(() => sepoliaFees(50_000_000_000n, 0n, true), /100 gwei safety cap/);
  assert.throws(() => sepoliaFees(-1n, 0n), /Invalid/);
  assert.equal(isProtectiveCancel(cancel), true);
  const direct = { ...cancel, tx: { ...cancel.tx, to: ADDRESSES.moduleA, operation: 0, data: encodeFunctionData({ abi: moduleAbi, functionName: 'cancelRecovery' }) } };
  assert.equal(isProtectiveCancel(direct), true);
  for (const tx of [{ ...direct.tx, value: '1' }, { ...direct.tx, to: wallet }, { ...direct.tx, gasPrice: '1' }, { ...direct.tx, data: `${direct.tx.data}00` }]) assert.equal(isProtectiveCancel({ ...cancel, tx }), false);
  assert.equal(isProtectiveCancel({ kind: 'finalize', wallet, module: ADDRESSES.moduleA }), false);
});
test('TEST DOUBLE: fee quote and send both derive the cancel cap from transaction semantics', async () => {
  const sent: any[] = [];
  const rpc = { getChainId: async () => 11155111, getBlock: async () => ({ baseFeePerGas: 20_000_000_000n }), estimateMaxPriorityFeePerGas: async () => 0n, estimateGas: async () => 100000n } as unknown as PublicClient;
  const chain = createViemChain({ chainId: 11155111, rpcUrls: ['https://one.invalid', 'https://two.invalid'], relayerPrivateKey: key, allowSepoliaWrites: true, publicClient: rpc, walletClient: { sendTransaction: async (args: any) => { sent.push(args); return `0x${'22'.repeat(32)}`; } } as any });
  const payment = { ...cancel, tx: safeTxToWire(makeSafeTx({ to: wallet, value: 1n })) };
  await assert.rejects(chain.estimateGas(payment), /20 gwei safety cap/);
  await assert.rejects(chain.send(payment, 100000n), /20 gwei safety cap/);
  assert.equal(sent.length, 0);
  assert.equal(await chain.estimateGas(cancel), 100000n);
  await chain.send(cancel, 100000n);
  assert.equal(sent[0].maxFeePerGas, 40_010_000_000n); assert.equal(sent[0].chainId, 11155111);
});
test('ownership proof text is honest about local versus Sepolia chain', () => {
  assert.match(ownershipProofText('client', wallet, 'nonce'), /Sepolia \(chain 11155111\)/);
  assert.match(ownershipProofText('client', wallet, 'nonce', 31337), /Local Hardhat \(chain 31337\)/);
  assert.throws(() => ownershipProofText('client', wallet, 'nonce', NaN), /Invalid/);
});
test('TEST DOUBLE: post-receipt read waits for fresh RPC and fails closed on stale head', async () => {
  assert.equal(await waitForBlockOn({ getBlockNumber: async () => 101n }, 100n, 0), 101n);
  await assert.rejects(waitForBlockOn({ getBlockNumber: async () => 99n }, 100n, 0), /not caught up/);
});
test('TEST DOUBLE: relayer diagnostic is read-only and requires public address plus Sepolia', async () => {
  const rpc = { getChainId: async () => 11155111, getTransactionCount: async ({ blockTag }: any) => blockTag === 'latest' ? 3 : 4, getTransactionReceipt: async () => ({ status: 'success' }) };
  const result = await relayerStatus(rpc, wallet, `0x${'33'.repeat(32)}`);
  assert.equal(result.latest, 3); assert.equal(result.pending, 4); assert.equal(result.lastTransactionStatus, 'success');
  await assert.rejects(relayerStatus(rpc, key), /public relayer address/);
  await assert.rejects(relayerStatus({ ...rpc, getChainId: async () => 31337 }, wallet), /chain mismatch/);
});
