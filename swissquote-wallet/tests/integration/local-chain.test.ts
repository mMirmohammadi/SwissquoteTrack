import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublicClient, createWalletClient, encodeFunctionData, hashTypedData, http, parseAbi, zeroAddress, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import * as p from '../../packages/protocol/src/index.ts';

// Explicit opt-in prevents these state-changing tests from racing builders' shared devnet.
// Point this at a dedicated, already initialized local Hardhat node, never Sepolia.
const rpc = process.env.INTEGRATION_RPC_URL;
const enabled = !!rpc;
const local = { id: 31337, name: 'Independent integration devnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc ?? 'http://127.0.0.1:8545'] } } } as const;
const reader = createPublicClient({ chain: local, transport: http(rpc ?? 'http://127.0.0.1:8545') });
const safe = parseAbi([
  'function nonce() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns (bytes32)',
]);
const module = parseAbi([
  'function nonce(address) view returns (uint256)',
  'function threshold(address) view returns (uint256)',
  'function getGuardians(address) view returns (address[])',
  'function getRecoveryHash(address,address[],uint256,uint256) view returns (bytes32)',
  'function getRecoveryRequest(address) view returns ((uint256 guardiansApprovalCount,uint256 newThreshold,uint64 executeAfter,address[] newOwners) request)',
  'function finalizeRecovery(address)',
]);
const recoveryTypes = { ExecuteRecovery: [
  { name: 'wallet', type: 'address' }, { name: 'newOwners', type: 'address[]' },
  { name: 'newThreshold', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
] } as const;
const keys = Object.fromEntries(['owner', 'card', 'partner', 'sq', 'next', 'thief', 'relayer'].map(name => [name, generatePrivateKey()])) as Record<string, Hex>;
const accounts = Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, privateKeyToAccount(key)]));
let wallet: Address;
let sender: ReturnType<typeof createWalletClient>;
const A = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as Address;
const B = '0x38275826E1933303E508433dD5f289315Da2541c' as Address;
const factory = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address;
const readNonce = () => reader.readContract({ address: wallet, abi: safe, functionName: 'nonce' });
const request = async (address: Address, newOwner = accounts.next.address): Promise<p.RecoveryRequest> => ({ wallet, module: address, newOwner, nonce: await reader.readContract({ address, abi: module, functionName: 'nonce', args: [wallet] }), chainId: 31337 });
const pending = (address: Address) => reader.readContract({ address, abi: module, functionName: 'getRecoveryRequest', args: [wallet] });
async function send(to: Address, data: Hex) {
  const gas = await reader.estimateGas({ account: accounts.relayer, to, data });
  const hash = await sender.sendTransaction({ account: accounts.relayer, chain: local, to, data, gas });
  const receipt = await reader.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success', 'transaction must execute, not merely be submitted');
  return receipt;
}
async function exec(tx: p.SafeTx, key = keys.owner) {
  const signature = await p.signSafeTx(key, wallet, tx, 31337);
  return send(wallet, p.encodeExecTransaction(tx, signature));
}
async function submitRecovery(address: Address, guardian: 'partner' | 'sq') {
  const req = await request(address);
  const approvals = await Promise.all([keys.card, keys[guardian]].map(key => p.signRecovery(key, req)));
  const receipt = await send(address, p.encodeRecoveryCall(req, approvals));
  const block = await reader.getBlock({ blockNumber: receipt.blockNumber });
  const state = await pending(address);
  assert.equal(state.executeAfter - block.timestamp, address === A ? 180n : 259200n, 'real contract waiting period');
  return { req, approvals, state };
}
async function mustRevert(to: Address, data: Hex, reason: RegExp) {
  await assert.rejects(() => reader.call({ account: accounts.relayer, to, data }), reason);
}

test('independent protocol integration on real local contract code', { skip: !enabled ? 'INTEGRATION_RPC_URL is required for an isolated initialized local chain' : false }, async t => {
  const url = new URL(rpc!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'local loopback RPC only');
  assert.equal(await reader.getChainId(), 31337, 'never submit to a public chain');
  await reader.request({ method: 'hardhat_setBalance' as never, params: [accounts.relayer.address, '0x56bc75e2d63100000'] as never });
  sender = createWalletClient({ account: accounts.relayer, chain: local, transport: http(rpc!) });
  const setup: p.WalletSetup = { owner: accounts.owner.address, cardGuardian: accounts.card.address, partnerGuardian: accounts.partner.address, sqGuardian: accounts.sq.address, saltNonce: p.randomSaltNonce(), chainId: 31337 };
  const creation = await reader.readContract({ address: factory, abi: p.factoryAbi, functionName: 'proxyCreationCode' });
  wallet = p.computeWalletAddress(setup, creation);
  const deployment = p.buildDeployCall(setup);
  await send(deployment.address, encodeFunctionData({ abi: deployment.abi, functionName: deployment.functionName, args: deployment.args }));

  await t.test('atomic enrollment binds both guardian sets to the predicted zero-ETH wallet', async () => {
    assert.notEqual(await reader.getCode({ address: wallet }), undefined);
    assert.equal(await reader.getBalance({ address: wallet }), 0n);
    assert.equal(await readNonce(), 0n);
    assert.deepEqual((await reader.readContract({ address: wallet, abi: safe, functionName: 'getOwners' })).map(x => x.toLowerCase()), [accounts.owner.address.toLowerCase()]);
    for (const [address, other] of [[A, accounts.partner.address], [B, accounts.sq.address]] as const) {
      assert.deepEqual((await reader.readContract({ address, abi: module, functionName: 'getGuardians', args: [wallet] })).map(x => x.toLowerCase()).sort(), [accounts.card.address, other].map(x => x.toLowerCase()).sort());
      assert.equal(await reader.readContract({ address, abi: module, functionName: 'threshold', args: [wallet] }), 2n);
    }
    const checked = await p.verifyWallet(reader, setup, { expectedWallet: wallet });
    assert.equal(checked.ok, true, checked.reasons.join('; '));
  });

  await t.test('ownership proof passes EIP-1271; different client, nonce and thief fail', async () => {
    const proof = await p.signOwnershipProof(keys.owner, 'independent-client', wallet, 'one-use-nonce', 31337);
    assert.equal(await p.verifyOwnershipProof(reader, wallet, proof.hash, proof.signature), true);
    for (const [key, client, nonce] of [[keys.thief, 'independent-client', 'one-use-nonce'], [keys.owner, 'another-client', 'one-use-nonce'], [keys.owner, 'independent-client', 'another-nonce']]) {
      const other = await p.signOwnershipProof(key as Hex, client, wallet, nonce, 31337);
      assert.equal(await p.verifyOwnershipProof(reader, wallet, proof.hash, other.signature), false);
    }
  });

  await t.test('funded USDC owner payment executes while wallet holds zero ETH', async () => {
    const token = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
    const tokenAbi = parseAbi(['function mint(address,uint256)', 'function transfer(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)']);
    // Explicit MOCK token fixture. Real transfer execution, not real bank funding.
    await send(token, encodeFunctionData({ abi: tokenAbi, functionName: 'mint', args: [wallet, 10_000_000n] }));
    const before = await reader.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [accounts.thief.address] });
    const tx = p.makeSafeTx({ to: token, nonce: await readNonce(), data: encodeFunctionData({ abi: tokenAbi, functionName: 'transfer', args: [accounts.thief.address, 2_000_000n] }) });
    await exec(tx);
    assert.equal(await reader.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [accounts.thief.address] }), before + 2_000_000n);
    assert.equal(await reader.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [wallet] }), 8_000_000n);
    assert.equal(await reader.getBalance({ address: wallet }), 0n);
  });

  await t.test('recovery digest equals independent EIP-712 and on-chain hash; owner/module/nonce/chain mutations invalidate', async () => {
    const req = await request(A);
    const independent = hashTypedData({ domain: { name: 'Social Recovery Module', version: '0.0.1', chainId: 31337, verifyingContract: A }, types: recoveryTypes, primaryType: 'ExecuteRecovery', message: { wallet, newOwners: [req.newOwner], newThreshold: 1n, nonce: req.nonce } });
    assert.equal(p.hashRecovery(req), independent);
    assert.equal(independent, await reader.readContract({ address: A, abi: module, functionName: 'getRecoveryHash', args: [wallet, [req.newOwner], 1n, req.nonce] }));
    await p.assertRecoveryHash(reader, req);
    const approvals = await Promise.all([keys.card, keys.partner].map(key => p.signRecovery(key, req)));
    for (const altered of [{ ...req, newOwner: accounts.thief.address }, { ...req, nonce: req.nonce + 1n }, { ...req, chainId: 11155111 }, { ...req, module: B }]) {
      // Nonce and chain are NOT calldata fields. Mutate the signed digest, then
      // submit at the current on-chain nonce; changing the JS request alone proves nothing.
      const signedMutation = altered.chainId !== req.chainId || altered.nonce !== req.nonce;
      const sigs = signedMutation ? await Promise.all([keys.card, keys.partner].map(key => p.signRecovery(key, altered))) : approvals;
      await mustRevert(altered.module, p.encodeRecoveryCall(signedMutation ? req : altered, sigs), /Invalid guardian signature|Signer not a guardian/);
    }
  });

  await t.test('partner + Swissquote without the card cannot start either recovery', async () => {
    for (const address of [A, B]) {
      const req = await request(address, accounts.thief.address);
      const approvals = await Promise.all([keys.partner, keys.sq].map(key => p.signRecovery(key, req)));
      await mustRevert(address, p.encodeRecoveryCall(req, approvals), /Signer not a guardian|confirmed signatures less than threshold/);
      assert.equal((await pending(address)).executeAfter, 0n);
    }
  });

  await t.test('one owner-signed protective batch clears BOTH requests and makes captured signatures stale', async () => {
    const startedA = await submitRecovery(A, 'partner');
    await submitRecovery(B, 'sq');
    const tx = p.buildCancelRecoveryTx(wallet, await readNonce(), [A, B]);
    const classification = p.classifyTransaction(wallet, tx);
    assert.equal(classification.class, 'Protective');
    assert.equal(classification.requiresPasskey, false);
    await exec(tx);
    for (const address of [A, B]) {
      const state = await pending(address);
      assert.equal(state.guardiansApprovalCount, 0n); assert.equal(state.executeAfter, 0n); assert.deepEqual(state.newOwners, []);
      await mustRevert(address, encodeFunctionData({ abi: module, functionName: 'finalizeRecovery', args: [wallet] }), /no ongoing recovery/);
    }
    await mustRevert(A, p.encodeRecoveryCall(startedA.req, startedA.approvals), /Invalid guardian signature/);
  });

  await t.test('180-second delay is enforced; new owner succeeds and old owner fails GS026', async () => {
    const started = await submitRecovery(A, 'partner');
    const finalize = encodeFunctionData({ abi: module, functionName: 'finalizeRecovery', args: [wallet] });
    await mustRevert(A, finalize, /recovery period still pending/);
    await reader.request({ method: 'evm_setNextBlockTimestamp' as never, params: [Number(started.state.executeAfter)] as never });
    await reader.request({ method: 'evm_mine' as never, params: [] as never });
    await send(A, finalize);
    assert.deepEqual((await reader.readContract({ address: wallet, abi: safe, functionName: 'getOwners' })).map(x => x.toLowerCase()), [accounts.next.address.toLowerCase()]);
    const tx = p.makeSafeTx({ to: accounts.thief.address, value: 0n, nonce: await readNonce() });
    const signature = await p.signSafeTx(keys.owner, wallet, tx, 31337);
    await mustRevert(wallet, p.encodeExecTransaction(tx, signature), /GS026/);
    await exec(tx, keys.next);
    assert.equal(await reader.getBalance({ address: wallet }), 0n);
  });
});
