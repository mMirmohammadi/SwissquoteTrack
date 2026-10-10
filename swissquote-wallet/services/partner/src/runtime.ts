import { createPublicClient, fallback, http, keccak256, type PublicClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ADDRESSES, MODULE_CODE_HASHES, PUBLIC_RPC_URLS, moduleAbi, safeAbi, hashRecovery, signRecovery, encodeCode } from '@sq/protocol';
import { SqlitePartnerStore } from './storage.ts';
import { createPartnerService, type PartnerChainReader, type PartnerCrypto } from './service.ts';
import { createPartnerServer } from './server.ts';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const partnerCrypto: PartnerCrypto = {
  generateGuardian() { const privateKey = generatePrivateKey(); return { privateKey, address: privateKeyToAccount(privateKey).address }; },
  hashRecovery,
  signRecovery,
  encodeApproval(approval, chainId) { return encodeCode({ v: 1, kind: 'approval', chainId, ...approval }); },
};
/** All state reads use one block snapshot; the contract rechecks the nonce during submission. */
export function createViemChainReader(client: PublicClient): PartnerChainReader {
  return {
    async readRecovery({ wallet, module, newOwner, chainId }) {
      const observedChain = await client.getChainId();
      if (observedChain !== chainId) throw new Error('RPC chain mismatch');
      const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
      const [walletCode, moduleCode, enabled, nonce, guardians, threshold] = await Promise.all([
        client.getCode({ address: wallet, blockNumber }),
        client.getCode({ address: module, blockNumber }),
        client.readContract({ address: wallet, abi: safeAbi, functionName: 'isModuleEnabled', args: [module], blockNumber }),
        client.readContract({ address: module, abi: moduleAbi, functionName: 'nonce', args: [wallet], blockNumber }),
        client.readContract({ address: module, abi: moduleAbi, functionName: 'getGuardians', args: [wallet], blockNumber }),
        client.readContract({ address: module, abi: moduleAbi, functionName: 'threshold', args: [wallet], blockNumber }),
      ]);
      if (!walletCode || walletCode === '0x' || !enabled) throw new Error('Wallet/module unavailable');
      if (!moduleCode || keccak256(moduleCode).toLowerCase() !== MODULE_CODE_HASHES[module.toLowerCase()]?.toLowerCase()) throw new Error('Module code hash mismatch');
      const recoveryHash = await client.readContract({ address: module, abi: moduleAbi, functionName: 'getRecoveryHash', args: [wallet, [newOwner], 1n, nonce], blockNumber });
      return { chainId: observedChain, nonce, guardians, threshold, recoveryHash };
    },
  };
}
export interface PartnerRuntimeOptions { env?: NodeJS.ProcessEnv; client?: PublicClient; dataFile?: string }
export function createPartnerRuntime(options: PartnerRuntimeOptions = {}) {
  const env = options.env ?? process.env;
  const chain = env.CHAIN ?? 'local';
  if (chain !== 'local' && chain !== 'sepolia') throw new Error('CHAIN must be local or sepolia');
  const chainId = chain === 'local' ? 31337 : 11155111;
  const urls = env.RPC_URLS?.split(',').map(s => s.trim()).filter(Boolean) ?? (chain === 'local' ? ['http://127.0.0.1:8545', 'http://localhost:8545'] : [...PUBLIC_RPC_URLS]);
  if (urls.length < 2) throw new Error('RPC_URLS requires two endpoints for fallback');
  for (const url of urls) if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('RPC_URLS must use HTTP(S)');
  const client = options.client ?? createPublicClient({ transport: fallback(urls.map(url => http(url, { timeout: 8000, retryCount: 0 })), { rank: false, retryCount: 0 }) });
  const dataFile = options.dataFile ?? (env.PARTNER_DATA_DIR ? resolve(env.PARTNER_DATA_DIR, 'partner.sqlite') : fileURLToPath(new URL('../data/partner.sqlite', import.meta.url)));
  const store = new SqlitePartnerStore(dataFile);
  const service = createPartnerService({ store, chainReader: createViemChainReader(client), crypto: partnerCrypto, chainId, moduleA: ADDRESSES.moduleA, allowDemoFooled: env.PARTNER_DEMO_FOOLED === 'true' });
  const server = createPartnerServer({ service, allowedOrigins: env.PARTNER_ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) });
  return { server, service, store, chainId, close: () => { server.close(); store.close(); } };
}
