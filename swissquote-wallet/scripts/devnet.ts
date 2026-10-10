import { readFile } from 'node:fs/promises';
import { keccak256, parseEther, stringToHex, toHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { assertLocal, isMain, localRpc } from './runtime.js';

export const DEV_RPC = 'http://127.0.0.1:8545';
// Explicit local development fixture only. Never use these keys on a public chain.
export const DEV_KEYS = Object.fromEntries(['relayer', 'account', 'partner', 'sq', 'recipient', 'attacker'].map(role => [role, keccak256(stringToHex(`sq-local-only/${role}`))])) as Record<'relayer'|'account'|'partner'|'sq'|'recipient'|'attacker', Hex>;
export const DEV_ADDRESSES = Object.fromEntries(Object.entries(DEV_KEYS).map(([role, key]) => [role, privateKeyToAccount(key).address])) as Record<keyof typeof DEV_KEYS, Address>;
export const USDC_ADDRESS: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
type CodeFixture = { address: Address; code: Hex; nonZeroStorage0to8: Record<string, Hex> };
async function json(relative: string) { return JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8')); }
export async function setupDevnet(rpcUrl = DEV_RPC): Promise<{ rpcUrl: string; addresses: typeof DEV_ADDRESSES }> {
  const { publicClient } = await assertLocal(rpcUrl);
  const fx = await json('../contracts/contracts/plan/sepolia-code.json') as { contracts: Record<string, CodeFixture & { codeHash: Hex }> };
  const b = await json('../contracts/contracts/plan/sepolia-module-b.json') as CodeFixture & { expectedCodeHash: Hex };
  const codeFixtures = [...Object.values(fx.contracts).map(c => ({...c, expectedCodeHash:c.codeHash})), b];
  // Validate the entire fixture before making any mutations. Never patch recovery bytecode.
  for (const c of codeFixtures) if (keccak256(c.code) !== c.expectedCodeHash) throw new Error(`Fixture hash mismatch at ${c.address}`);
  const token = await json('../contracts/artifacts/contracts/fixtures/DemoUSDC.sol/DemoUSDC.json') as { deployedBytecode: Hex };
  for (const c of codeFixtures) {
    await localRpc(rpcUrl, 'hardhat_setCode', [c.address, c.code]);
    for (const [slot, value] of Object.entries(c.nonZeroStorage0to8)) await localRpc(rpcUrl, 'hardhat_setStorageAt', [c.address, toHex(BigInt(slot)), value]);
    if (await publicClient.getCode({ address: c.address }) !== c.code) throw new Error('Placed runtime code mismatch');
  }
  await localRpc(rpcUrl, 'hardhat_setCode', [USDC_ADDRESS, token.deployedBytecode]);
  for (const address of Object.values(DEV_ADDRESSES)) await localRpc(rpcUrl, 'hardhat_setBalance', [address, toHex(parseEther('100'))]);
  return { rpcUrl, addresses: DEV_ADDRESSES };
}
if (isMain(import.meta.url)) setupDevnet(process.env.RPC_URLS?.split(',')[0] ?? DEV_RPC).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
