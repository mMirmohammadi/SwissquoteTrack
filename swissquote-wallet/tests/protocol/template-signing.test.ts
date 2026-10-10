import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { concatHex, decodeFunctionData, encodeAbiParameters, encodeFunctionData, getCreate2Address, hashTypedData, keccak256, parseAbi, recoverTypedDataAddress, toHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { buildWalletInitializer, computeWalletAddress, makeSafeTx } from '../../packages/protocol/src/wallet.ts';
import { assertRecoveryHash, hashRecovery, hashSafeTx, safeTxTypedData, signRecovery, signSafeTx, sortApprovals } from '../../packages/protocol/src/signing.ts';
const protocol = { buildWalletInitializer, computeWalletAddress, makeSafeTx, assertRecoveryHash, hashRecovery, hashSafeTx, safeTxTypedData, signRecovery, signSafeTx, sortApprovals };

const owner = '0x1111111111111111111111111111111111111111' as Address;
const card = '0x2222222222222222222222222222222222222222' as Address;
const partner = '0x3333333333333333333333333333333333333333' as Address;
const sq = '0x4444444444444444444444444444444444444444' as Address;
const newOwner = '0x5555555555555555555555555555555555555555' as Address;
const zero = '0x0000000000000000000000000000000000000000' as Address;
const A = '0x949d01d424bE050D09C16025dd007CB59b3A8c66' as Address;
const B = '0x38275826E1933303E508433dD5f289315Da2541c' as Address;
const singleton = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762' as Address;
const factory = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address;
const multi = '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526' as Address;
const moduleSetup = '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47' as Address;
const handler = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99' as Address;
const setupAbi = parseAbi(['function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address paymentReceiver)']);
const multiAbi = parseAbi(['function multiSend(bytes transactions)']);
const guardiansAbi = parseAbi(['function addGuardianWithThreshold(address guardian,uint256 threshold)']);
const setup = { owner, cardGuardian: card, partnerGuardian: partner, sqGuardian: sq, saltNonce: 20261010n, chainId: 11155111 };
const key = `0x${'01'.repeat(32)}` as Hex; // Public deterministic test key only.
const request = { wallet: owner, module: A, newOwner, nonce: 7n, chainId: 11155111 };
const recoveryTypes = { ExecuteRecovery: [{ name: 'wallet', type: 'address' }, { name: 'newOwners', type: 'address[]' }, { name: 'newThreshold', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] } as const;

function packedCall(operation: number, to: Address, data: Hex): Hex {
  return concatHex([toHex(operation, { size: 1 }), to, toHex(0n, { size: 32 }), toHex((data.length - 2) / 2, { size: 32 }), data]);
}
function expectedInitializer(weakB = false): Hex {
  const enable = encodeFunctionData({ abi: parseAbi(['function enableModules(address[] modules)']), functionName: 'enableModules', args: [[A, B]] });
  const calls = [packedCall(1, moduleSetup, enable)];
  for (const [module, guardian, threshold] of [[A, card, 1n], [A, partner, 2n], [B, card, 1n], [B, sq, weakB ? 1n : 2n]] as const) {
    calls.push(packedCall(0, module, encodeFunctionData({ abi: guardiansAbi, functionName: 'addGuardianWithThreshold', args: [guardian, threshold] })));
  }
  const data = encodeFunctionData({ abi: multiAbi, functionName: 'multiSend', args: [concatHex(calls)] });
  return encodeFunctionData({ abi: setupAbi, functionName: 'setup', args: [[owner], 1n, multi, data, handler, zero, 0n, zero] });
}
function independentAddress(initializer: Hex, proxyCode: Hex): Address {
  const salt = keccak256(concatHex([keccak256(initializer), toHex(setup.saltNonce, { size: 32 })]));
  return getCreate2Address({ from: factory, salt, bytecodeHash: keccak256(concatHex([proxyCode, encodeAbiParameters([{ type: 'uint256' }], [BigInt(singleton)])])) });
}

test('template exactly implements five atomic calls and commits B threshold 2', () => {
  assert.equal(protocol.buildWalletInitializer(setup).toLowerCase(), expectedInitializer().toLowerCase());
  const decoded = decodeFunctionData({ abi: setupAbi, data: protocol.buildWalletInitializer(setup) });
  assert.equal(decoded.functionName, 'setup');
  assert.equal(decoded.args[2].toLowerCase(), multi.toLowerCase());
});

test('CREATE2 independently matches formula; guardian, owner, salt and weak threshold tampering change address', () => {
  // Any creation bytecode can exercise the hash formula; this is not deployed-runtime evidence.
  const proxyCode = '0x60006000f3' as Hex;
  const expected = independentAddress(expectedInitializer(), proxyCode);
  assert.equal(protocol.computeWalletAddress(setup, proxyCode).toLowerCase(), expected.toLowerCase());
  assert.notEqual(independentAddress(expectedInitializer(true), proxyCode), expected);
  for (const field of ['owner', 'cardGuardian', 'partnerGuardian', 'sqGuardian'] as const) {
    assert.notEqual(protocol.computeWalletAddress({ ...setup, [field]: newOwner }, proxyCode), expected);
  }
  assert.notEqual(protocol.computeWalletAddress({ ...setup, saltNonce: setup.saltNonce + 1n }, proxyCode), expected);
});

test('template rejects duplicate actors, zero and sentinel actor addresses', () => {
  for (const field of ['owner', 'cardGuardian', 'partnerGuardian', 'sqGuardian'] as const) {
    for (const bad of [zero, '0x0000000000000000000000000000000000000001' as Address]) {
      assert.throws(() => protocol.buildWalletInitializer({ ...setup, [field]: bad }), `${field}: ${bad}`);
    }
  }
  for (const [a, b] of [['owner', 'cardGuardian'], ['owner', 'partnerGuardian'], ['owner', 'sqGuardian'], ['cardGuardian', 'partnerGuardian'], ['cardGuardian', 'sqGuardian'], ['partnerGuardian', 'sqGuardian']] as const) {
    assert.throws(() => protocol.buildWalletInitializer({ ...setup, [b]: setup[a] }), `${a} = ${b}`);
  }
});

test('recovery digest agrees with independently pinned Sepolia eth_call vector', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../contracts/contracts/plan/sepolia-code.json', import.meta.url), 'utf8'));
  const [wallet, owners, threshold, nonce] = fixture.calls.getRecoveryHash.args;
  const expected = hashTypedData({ domain: { name: 'Social Recovery Module', version: '0.0.1', chainId: 11155111, verifyingContract: A }, types: recoveryTypes, primaryType: 'ExecuteRecovery', message: { wallet, newOwners: owners, newThreshold: BigInt(threshold), nonce: BigInt(nonce) } });
  assert.equal(expected, fixture.calls.getRecoveryHash.result[0]);
  assert.equal(protocol.hashRecovery({ wallet, module: A, newOwner: owners[0], nonce: BigInt(nonce), chainId: 11155111 }), expected);
});

test('recovery signature binds signer, chain, module, nonce, wallet and replacement owner', async () => {
  const approval = await protocol.signRecovery(key, request);
  assert.equal(approval.signer.toLowerCase(), privateKeyToAccount(key).address.toLowerCase());
  const td = { domain: { name: 'Social Recovery Module', version: '0.0.1', chainId: request.chainId, verifyingContract: A }, types: recoveryTypes, primaryType: 'ExecuteRecovery' as const, message: { wallet: request.wallet, newOwners: [newOwner], newThreshold: 1n, nonce: 7n } };
  assert.equal((await recoverTypedDataAddress({ ...td, signature: approval.signature })).toLowerCase(), approval.signer.toLowerCase());
  for (const mutation of [{ chainId: 31337 }, { module: B }, { nonce: 8n }, { wallet: partner }, { newOwner: sq }]) {
    assert.notEqual(protocol.hashRecovery({ ...request, ...mutation }), protocol.hashRecovery(request));
  }
  const fakeClient = (chainId: number, nonce: bigint, hash: Hex) => ({ getChainId: async () => chainId, readContract: async ({ functionName }: { functionName: string }) => functionName === 'nonce' ? nonce : hash });
  await protocol.assertRecoveryHash(fakeClient(11155111, 7n, protocol.hashRecovery(request)) as never, request);
  await assert.rejects(() => protocol.assertRecoveryHash(fakeClient(31337, 7n, protocol.hashRecovery(request)) as never, request), /Recovery chain mismatch/);
  await assert.rejects(() => protocol.assertRecoveryHash(fakeClient(11155111, 8n, protocol.hashRecovery(request)) as never, request), /Stale recovery nonce/);
  await assert.rejects(() => protocol.assertRecoveryHash(fakeClient(11155111, 7n, `0x${'00'.repeat(32)}`) as never, request), /On-chain recovery hash mismatch/);
});

test('approval sorting is numeric, does not mutate inputs and rejects same signer in mixed casing', () => {
  const signature = `0x${'11'.repeat(65)}` as Hex;
  const low = '0x000000000000000000000000000000000000000a' as Address;
  const high = '0x000000000000000000000000000000000000000B' as Address;
  const input = [{ signer: high, signature }, { signer: low, signature }];
  const sorted = protocol.sortApprovals(input);
  assert.deepEqual(sorted.map(x => BigInt(x.signer)), [10n, 11n]);
  assert.equal(input[0].signer, high);
  assert.throws(() => protocol.sortApprovals([{ signer: low, signature }, { signer: low.toUpperCase().replace('0X', '0x') as Address, signature }]));
});

test('Safe transaction hashes bind every field including chain, wallet and Safe nonce', async () => {
  const tx = protocol.makeSafeTx({ to: partner, nonce: 4n });
  const hash = protocol.hashSafeTx(owner, tx, 11155111);
  const td = protocol.safeTxTypedData(owner, tx, 11155111);
  assert.deepEqual(td.domain, { chainId: 11155111, verifyingContract: owner });
  assert.equal(td.primaryType, 'SafeTx');
  const signature = await protocol.signSafeTx(key, owner, tx, 11155111);
  assert.equal((await recoverTypedDataAddress({ ...td, signature })).toLowerCase(), privateKeyToAccount(key).address.toLowerCase());
  for (const mutation of [{ to: sq }, { value: 1n }, { data: '0x1234' as Hex }, { operation: 1 as const }, { safeTxGas: 1n }, { baseGas: 1n }, { gasPrice: 1n }, { gasToken: sq }, { refundReceiver: sq }, { nonce: 5n }]) {
    assert.notEqual(protocol.hashSafeTx(owner, { ...tx, ...mutation }, 11155111), hash);
  }
  assert.notEqual(protocol.hashSafeTx(owner, tx, 31337), hash);
  assert.notEqual(protocol.hashSafeTx(card, tx, 11155111), hash);
});
