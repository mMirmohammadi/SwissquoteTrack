import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeFunctionData, encodeAbiParameters, encodeFunctionData, hashMessage, keccak256, recoverTypedDataAddress, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ADDRESSES, CHAIN_ID, CONTRACT_CODE_HASHES, FALLBACK_STORAGE_SLOT, GUARD_STORAGE_SLOT, MODULES, PROXY_CREATION_CODE_HASH, PROXY_RUNTIME_CODE_HASH, SENTINEL_ADDRESS,
  buildWalletInitializer, computeWalletAddress, buildDeployCall, decodeMultiSendCall, decodeMultiSend, encodeMultiSend, buildCancelRecoveryTx, buildRotateOwnerTx, makeSafeTx,
  safeAbi, erc20Abi, moduleAbi, classifyTransaction, hashSafeTx, signSafeTx, safeTxTypedData, signRecovery, recoveryTypedData, hashRecovery, sortApprovals, assertRecoveryHash,
  signOwnershipProof, safeMessageTypedData, verifyOwnershipProof, encodeCode, decodeCode, decodeSetupCode, decodeRequestCode, safeTxToWire, safeTxFromWire,
  generateOwnerSeed, generateCardSeed, mnemonicToAddress, mnemonicToPrivateKey, encryptSeed, decryptSeed, generateKitCode, validateKitCode, createKit, openKit,
  verifyWallet, verifyWalletIndependent, type WalletSetup,
} from '../src/index.js';
const key = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const owner = privateKeyToAccount(key(1)).address;
const setup: WalletSetup = { owner, cardGuardian: privateKeyToAccount(key(2)).address, partnerGuardian: privateKeyToAccount(key(3)).address, sqGuardian: privateKeyToAccount(key(4)).address, saltNonce: 99n };
const wallet = '0x1234567890123456789012345678901234567890' as Address;
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
test('one-transaction initializer pins owners, modules and every guardian threshold', () => {
  const init = decodeFunctionData({ abi: safeAbi, data: buildWalletInitializer(setup) });
  assert.equal(init.functionName, 'setup');
  const args = init.args!;
  assert.deepEqual(args[0], [owner]); assert.equal(args[1], 1n); assert.equal(args[2], ADDRESSES.multiSend);
  const calls = decodeMultiSendCall(args[3] as Hex);
  assert.equal(calls.length, 5); assert.equal(calls[0].operation, 1); assert.equal(calls[0].to.toLowerCase(), ADDRESSES.moduleSetup.toLowerCase());
  assert.deepEqual(calls.slice(1).map(c => decodeFunctionData({ abi: moduleAbi, data: c.data }).args), [[setup.cardGuardian, 1n], [setup.partnerGuardian, 2n], [setup.cardGuardian, 1n], [setup.sqGuardian, 2n]]);
  assert.equal(buildDeployCall(setup).args[1], buildWalletInitializer(setup));
  assert.throws(() => buildWalletInitializer({ ...setup, sqGuardian: owner }), /must differ/);
  assert.notEqual(computeWalletAddress(setup, '0x1234'), computeWalletAddress({ ...setup, saltNonce: 100n }, '0x1234'));
});
test('packed MultiSend parser rejects truncation and invalid operations', () => {
  const calls = [{ to: wallet, value: 7n, operation: 0 as const, data: '0xabcdef' as Hex }];
  assert.deepEqual(decodeMultiSend(encodeMultiSend(calls)), calls);
  assert.throws(() => decodeMultiSend('0x00'), /Truncated/);
  assert.throws(() => decodeMultiSend(`0x02${encodeMultiSend(calls).slice(4)}`), /operation/);
  assert.throws(() => decodeMultiSend(encodeMultiSend(calls).slice(0, -2) as Hex), /Truncated/);
});
test('classifier protects cancel, inherits strictest batch class and refuses delegatecalls/refunds', () => {
  const cancel = buildCancelRecoveryTx(wallet, 0n, MODULES);
  assert.equal(classifyTransaction(wallet, cancel).class, 'Protective');
  assert.throws(() => buildCancelRecoveryTx(wallet, 0n, []));
  assert.equal(classifyTransaction(wallet, buildRotateOwnerTx(wallet, owner, setup.cardGuardian, 0n)).class, 'Admin');
  const transfer = (amount: bigint) => makeSafeTx({ to: ADDRESSES.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [wallet, amount] }) });
  assert.equal(classifyTransaction(wallet, transfer(5_000_000n)).class, 'Small');
  assert.equal(classifyTransaction(wallet, transfer(5_000_001n)).class, 'Large');
  const approval = makeSafeTx({ to: ADDRESSES.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [wallet, 2n ** 256n - 1n] }) });
  assert.equal(classifyTransaction(wallet, approval).requiresPasskey, true);
  assert.equal(classifyTransaction(wallet, makeSafeTx({ to: wallet, operation: 1 })).relayAllowed, false);
  assert.equal(classifyTransaction(wallet, { ...cancel, gasPrice: 1n }).relayAllowed, false);
  const calls = decodeMultiSendCall(cancel.data); calls.push({ to: transfer(8_000_000n).to, data: transfer(8_000_000n).data, operation: 0, value: 0n });
  const batch = { ...cancel, data: encodeFunctionData({ abi: [{ type: 'function', name: 'multiSend', inputs: [{ name: 'transactions', type: 'bytes' }], outputs: [], stateMutability: 'payable' }], functionName: 'multiSend', args: [encodeMultiSend(calls)] }) };
  assert.equal(classifyTransaction(wallet, batch).class, 'Large');
});
test('SafeTx and recovery signatures recover expected signer and bind nonce/chain', async () => {
  const tx = makeSafeTx({ to: ADDRESSES.usdc, nonce: 5n });
  const signature = await signSafeTx(key(1), wallet, tx);
  assert.equal(await recoverTypedDataAddress({ ...safeTxTypedData(wallet, tx), signature }), owner);
  assert.notEqual(hashSafeTx(wallet, tx), hashSafeTx(wallet, { ...tx, nonce: 6n }));
  assert.notEqual(hashSafeTx(wallet, tx), hashSafeTx(wallet, tx, 31337));
  const request = { wallet, module: ADDRESSES.moduleA, newOwner: owner, nonce: 0n, chainId: CHAIN_ID };
  const approval = await signRecovery(key(2), request);
  assert.equal(await recoverTypedDataAddress({ ...recoveryTypedData(request), signature: approval.signature }), setup.cardGuardian);
  assert.deepEqual(sortApprovals([{ signer: setup.sqGuardian, signature }, approval]).map(a => BigInt(a.signer)), [BigInt(setup.sqGuardian), BigInt(setup.cardGuardian)].sort((a,b) => a < b ? -1 : 1));
  assert.throws(() => sortApprovals([approval, approval]), /Duplicate/);
  const client = { getChainId: async () => CHAIN_ID, readContract: async ({ functionName }: { functionName: string }) => functionName === 'nonce' ? 0n : hashRecovery(request) } as unknown as PublicClient;
  await assertRecoveryHash(client, request);
  await assert.rejects(assertRecoveryHash(client, { ...request, nonce: 1n }), /Stale/);
});
test('ownership proof uses SafeMessage wrapping and EIP1271 magic value', async () => {
  const proof = await signOwnershipProof(key(1), 'client-1', wallet, 'challenge');
  assert.equal(proof.hash, hashMessage(proof.message));
  assert.equal(await recoverTypedDataAddress({ ...safeMessageTypedData(wallet, proof.hash), signature: proof.signature }), owner);
  const client = { readContract: async () => '0x1626ba7e' } as unknown as PublicClient;
  assert.equal(await verifyOwnershipProof(client, wallet, proof.hash, proof.signature), true);
  assert.equal(await verifyOwnershipProof({ readContract: async () => { throw Error('revert'); } } as unknown as PublicClient, wallet, proof.hash, proof.signature), false);
});
test('strict codes and unsigned HTTP integer roundtrips', () => {
  const code = { v: 1 as const, chainId: CHAIN_ID, kind: 'setup' as const, wallet, owner, partnerGuardian: setup.partnerGuardian, sqGuardian: setup.sqGuardian, saltNonce: '99' };
  assert.deepEqual(decodeSetupCode(encodeCode(code)), code);
  assert.throws(() => decodeRequestCode(encodeCode(code)), /Expected/);
  assert.throws(() => encodeCode({ ...code, chainId: 1 }), /Unsupported/);
  assert.throws(() => encodeCode({ ...code, saltNonce: '-1' }), /Invalid/);
  assert.throws(() => decodeCode('%%%'));
  const tx = makeSafeTx({ to: wallet, value: 7n, nonce: 10n });
  assert.deepEqual(safeTxFromWire(safeTxToWire(tx)), tx);
  assert.throws(() => safeTxFromWire({ ...safeTxToWire(tx), nonce: '1e10' }));
});
test('scure standard derivation, device encryption and authenticated emergency kit', async () => {
  assert.equal(mnemonicToAddress(mnemonic), '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  assert.match(mnemonicToPrivateKey(mnemonic), /^0x[0-9a-f]{64}$/);
  assert.equal(generateOwnerSeed().split(' ').length, 24); assert.equal(generateCardSeed().split(' ').length, 12);
  await assert.rejects(encryptSeed(mnemonic, 'short'), /12 characters/);
  const encrypted = await encryptSeed(mnemonic, 'a long passphrase');
  assert.equal(await decryptSeed(encrypted, 'a long passphrase'), mnemonic);
  await assert.rejects(decryptSeed(encrypted, 'wrong passphrase'));
  const code = await generateKitCode(); assert.equal(await validateKitCode(code), true); assert.equal(await validateKitCode(code.slice(0,-1) + '!'), false);
  const kit = await createKit(mnemonic, code, { wallet, owner: mnemonicToAddress(mnemonic), chainId: CHAIN_ID });
  assert.equal((await openKit(kit, code)).mnemonic, mnemonic);
  await assert.rejects(openKit({ ...kit, wallet: owner }, code));
  await assert.rejects(createKit(mnemonic, code, { wallet, owner, chainId: CHAIN_ID }), /owner/);
});

// Use actual contract bytecode as hash-pinned test fixtures; no crypto/RPC bypass in implementation.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/contracts.json', import.meta.url), 'utf8')) as { contracts: { address: Address; code: Hex }[]; proxyCreationCode: Hex; proxyRuntimeCode: Hex };
const proxyArtifact = { bytecode: fixture.proxyCreationCode, deployedBytecode: fixture.proxyRuntimeCode };
const codes = new Map<string, Hex>(fixture.contracts.map(c => [c.address.toLowerCase(), c.code]));
function verificationClient(overrides: { owners?: Address[]; modules?: Address[]; guard?: Hex; nonce?: bigint; logs?: unknown[]; pending?: bigint; threshold?: bigint } = {}): PublicClient {
  return {
    getChainId: async () => CHAIN_ID,
    getCode: async ({ address }: { address: Address }) => codes.get(address.toLowerCase()) ?? proxyArtifact.deployedBytecode,
    getStorageAt: async ({ slot }: { slot: string }) => slot === GUARD_STORAGE_SLOT ? overrides.guard ?? '0x' + '0'.repeat(64) : encodeAbiParameters([{ type: 'uint256' }], [BigInt(slot === FALLBACK_STORAGE_SLOT ? ADDRESSES.fallbackHandler : ADDRESSES.safeL2)]),
    readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
      switch(functionName) {
        case 'proxyCreationCode': return proxyArtifact.bytecode;
        case 'nonce': return overrides.nonce ?? 0n;
        case 'getOwners': return overrides.owners ?? [owner];
        case 'getThreshold': return 1n;
        case 'getModulesPaginated': return [overrides.modules ?? MODULES, SENTINEL_ADDRESS];
        case 'getGuardians': return [setup.cardGuardian, address.toLowerCase() === ADDRESSES.moduleA.toLowerCase() ? setup.partnerGuardian : setup.sqGuardian];
        case 'threshold': return overrides.threshold ?? 2n;
        case 'guardiansCount': return 2n;
        case 'getRecoveryRequest': return { executeAfter: overrides.pending ?? 0n };
        default: throw Error('Unexpected test read');
      }
    },
    getBlockNumber: async () => 100n,
    getLogs: async ({ event }: { event: { name: string } }) => event.name === 'SafeMultiSigTransaction' ? overrides.logs ?? [] : [],
  } as unknown as PublicClient;
}
test('pinned fixture hashes agree with protocol constants', () => {
  for (const [address, hash] of Object.entries(CONTRACT_CODE_HASHES)) assert.equal(keccak256(codes.get(address)!), hash, address);
  assert.equal(keccak256(proxyArtifact.bytecode), PROXY_CREATION_CODE_HASH);
  assert.equal(keccak256(proxyArtifact.deployedBytecode), PROXY_RUNTIME_CODE_HASH);
});
test('wallet verification rejects hidden owners/modules/guard, pending recovery and weak threshold', async () => {
  assert.equal((await verifyWallet(verificationClient(), setup)).ok, true);
  for (const override of [{ owners: [owner, setup.cardGuardian] }, { modules: [...MODULES, owner] }, { guard: encodeAbiParameters([{ type: 'uint256' }], [1n]) }, { pending: 100n }, { threshold: 1n }]) {
    const result = await verifyWallet(verificationClient(override), setup);
    assert.equal(result.ok, false); assert.ok(result.reasons.length);
  }
  const a = verificationClient(), b = verificationClient();
  assert.equal((await verifyWalletIndependent([a,b], setup)).ok, true);
  assert.equal((await verifyWalletIndependent([a,a], setup)).ok, false);
});
test('wallet verifier rejects wrong address, code, fallback, chain and RPC failure', async () => {
  const expected = await verifyWallet(verificationClient(), setup, { expectedWallet: wallet });
  assert.equal(expected.ok, false); assert.ok(expected.reasons.some(r => r.includes('deterministic')));
  const badCode = { ...verificationClient(), getCode: async () => '0x' } as unknown as PublicClient;
  assert.equal((await verifyWallet(badCode, setup)).ok, false);
  const badChain = { ...verificationClient(), getChainId: async () => 1 } as unknown as PublicClient;
  assert.equal((await verifyWallet(badChain, setup)).ok, false);
  const unavailable = { ...verificationClient(), getCode: async () => { throw Error('public RPC unavailable'); } } as unknown as PublicClient;
  assert.deepEqual((await verifyWallet(unavailable, setup)).reasons, ['public RPC unavailable']);
  const duplicateUrl = [verificationClient(), verificationClient()].map(c => ({ ...c, transport: { url: 'https://same.example' } }) as unknown as PublicClient);
  assert.equal((await verifyWalletIndependent(duplicateUrl, setup)).ok, false);
});
test('nonce > 0 requires complete history and rejects hidden delegatecall execution', async () => {
  const additionalInfo = encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'uint256' }], [0n, owner, 1n]);
  const log = { args: { additionalInfo, operation: 0, to: owner, data: '0x' } };
  assert.equal((await verifyWallet(verificationClient({ nonce: 1n, logs: [log] }), setup)).ok, true);
  const absent = await verifyWallet(verificationClient({ nonce: 1n }), setup);
  assert.equal(absent.ok, false); assert.ok(absent.reasons.includes('Incomplete Safe transaction history'));
  const forbidden = await verifyWallet(verificationClient({ nonce: 1n, logs: [{ args: { ...log.args, operation: 1 } }] }), setup);
  assert.equal(forbidden.ok, false); assert.ok(forbidden.reasons.includes('Forbidden delegatecall in wallet history'));
});
