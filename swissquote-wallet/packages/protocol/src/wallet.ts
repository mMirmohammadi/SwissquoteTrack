import { concatHex, decodeFunctionData, encodeAbiParameters, encodeFunctionData, encodePacked, getCreate2Address, isAddress, keccak256, size, sliceHex, toHex, type Address, type Hex } from 'viem';
import { ADDRESSES, MODULES, SENTINEL_ADDRESS, ZERO_ADDRESS } from './constants.js';
import { factoryAbi, moduleAbi, moduleSetupAbi, multiSendAbi, safeAbi } from './abis.js';
import type { MultiSendCall, SafeTx, WalletSetup } from './types.js';
export function assertWalletSetup(setup: WalletSetup): void {
  const addresses = [setup.owner, setup.cardGuardian, setup.partnerGuardian, setup.sqGuardian];
  if (addresses.some(a => !isAddress(a, { strict: false }) || a.toLowerCase() === ZERO_ADDRESS || a.toLowerCase() === SENTINEL_ADDRESS)) throw new Error('Invalid owner/guardian address');
  if (new Set(addresses.map(a => a.toLowerCase())).size !== 4) throw new Error('Owner and every guardian must differ');
  if (setup.saltNonce < 0n || setup.saltNonce >= 2n ** 256n) throw new Error('Invalid salt nonce');
}
/** Packed Safe MultiSend payload, not the enclosing function calldata. */
export function encodeMultiSend(calls: readonly MultiSendCall[]): Hex {
  return concatHex(calls.map(c => {
    if (c.operation !== 0 && c.operation !== 1) throw new Error('Invalid MultiSend operation');
    return encodePacked(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [c.operation, c.to, c.value, BigInt(size(c.data)), c.data]);
  }));
}
export function decodeMultiSend(data: Hex): MultiSendCall[] {
  const result: MultiSendCall[] = [];
  let offset = 0;
  const length = size(data);
  while (offset < length) {
    if (length - offset < 85) throw new Error('Truncated MultiSend header');
    const operation = Number(BigInt(sliceHex(data, offset, offset + 1)));
    if (operation !== 0 && operation !== 1) throw new Error('Invalid MultiSend operation');
    const to = sliceHex(data, offset + 1, offset + 21) as Address;
    const value = BigInt(sliceHex(data, offset + 21, offset + 53));
    const n = BigInt(sliceHex(data, offset + 53, offset + 85));
    if (n > BigInt(length - offset - 85)) throw new Error('Truncated MultiSend data');
    const end = offset + 85 + Number(n);
    result.push({ operation, to, value, data: sliceHex(data, offset + 85, end) });
    offset = end;
    if (result.length > 256) throw new Error('Too many MultiSend calls');
  }
  return result;
}
export function buildWalletInitializer(setup: WalletSetup): Hex {
  assertWalletSetup(setup);
  const calls: MultiSendCall[] = [{ operation: 1, value: 0n, to: ADDRESSES.moduleSetup, data: encodeFunctionData({ abi: moduleSetupAbi, functionName: 'enableModules', args: [MODULES] }) }];
  for (const [module, guardian, threshold] of [[ADDRESSES.moduleA, setup.cardGuardian, 1n], [ADDRESSES.moduleA, setup.partnerGuardian, 2n], [ADDRESSES.moduleB, setup.cardGuardian, 1n], [ADDRESSES.moduleB, setup.sqGuardian, 2n]] as const) {
    calls.push({ operation: 0, value: 0n, to: module, data: encodeFunctionData({ abi: moduleAbi, functionName: 'addGuardianWithThreshold', args: [guardian, threshold] }) });
  }
  const data = encodeFunctionData({ abi: multiSendAbi, functionName: 'multiSend', args: [encodeMultiSend(calls)] });
  return encodeFunctionData({ abi: safeAbi, functionName: 'setup', args: [[setup.owner], 1n, ADDRESSES.multiSend, data, ADDRESSES.fallbackHandler, ZERO_ADDRESS, 0n, ZERO_ADDRESS] });
}
export function computeWalletAddress(setup: WalletSetup, proxyCreationCode: Hex): Address {
  const initializer = buildWalletInitializer(setup);
  const salt = keccak256(concatHex([keccak256(initializer), toHex(setup.saltNonce, { size: 32 })]));
  const initCode = concatHex([proxyCreationCode, encodeAbiParameters([{ type: 'uint256' }], [BigInt(ADDRESSES.safeL2)])]);
  return getCreate2Address({ from: ADDRESSES.factory, salt, bytecode: initCode });
}
export function buildDeployCall(setup: WalletSetup) {
  return { address: ADDRESSES.factory, abi: factoryAbi, functionName: 'createProxyWithNonce' as const, args: [ADDRESSES.safeL2, buildWalletInitializer(setup), setup.saltNonce] as const };
}
export function makeSafeTx(input: Pick<SafeTx, 'to'> & Partial<SafeTx>): SafeTx {
  return { value: 0n, data: '0x', operation: 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: ZERO_ADDRESS, refundReceiver: ZERO_ADDRESS, nonce: 0n, ...input };
}
export function buildCancelRecoveryTx(_wallet: Address, nonce: bigint, pendingModules: readonly Address[]): SafeTx {
  if (!pendingModules.length || new Set(pendingModules.map(m => m.toLowerCase())).size !== pendingModules.length || pendingModules.some(m => !MODULES.some(p => p.toLowerCase() === m.toLowerCase()))) throw new Error('Cancel requires distinct pending recovery modules');
  const calls = pendingModules.map(to => ({ to, operation: 0 as const, value: 0n, data: encodeFunctionData({ abi: moduleAbi, functionName: 'cancelRecovery' }) }));
  return makeSafeTx({ to: ADDRESSES.multiSendCallOnly, operation: 1, nonce, data: encodeFunctionData({ abi: multiSendAbi, functionName: 'multiSend', args: [encodeMultiSend(calls)] }) });
}
export function buildRotateOwnerTx(wallet: Address, oldOwner: Address, newOwner: Address, nonce: bigint): SafeTx {
  if (!isAddress(newOwner, { strict: false }) || [ZERO_ADDRESS, SENTINEL_ADDRESS, oldOwner.toLowerCase(), wallet.toLowerCase()].includes(newOwner.toLowerCase())) throw new Error('Invalid new owner');
  return makeSafeTx({ to: wallet, nonce, data: encodeFunctionData({ abi: safeAbi, functionName: 'swapOwner', args: [SENTINEL_ADDRESS, oldOwner, newOwner] }) });
}
export function decodeMultiSendCall(data: Hex): MultiSendCall[] {
  const decoded = decodeFunctionData({ abi: multiSendAbi, data });
  return decodeMultiSend(decoded.args[0]);
}
