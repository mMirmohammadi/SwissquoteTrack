import type { Address, Hex } from 'viem';
export const CHAIN_ID = 11155111;
export const LOCAL_CHAIN_ID = 31337;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const SENTINEL_ADDRESS = '0x0000000000000000000000000000000000000001' as const;
export const DERIVATION_PATH = "m/44'/60'/0'/0/0";
export const ADDRESSES = {
  safeL2: '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762',
  factory: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
  fallbackHandler: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
  multiSend: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
  multiSendCallOnly: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
  moduleSetup: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
  moduleA: '0x949d01d424bE050D09C16025dd007CB59b3A8c66',
  moduleB: '0x38275826E1933303E508433dD5f289315Da2541c',
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
} as const satisfies Record<string, Address>;
export const MODULES = [ADDRESSES.moduleA, ADDRESSES.moduleB] as const;
export const MODULE_WAITS = { A: 180, B: 259200 } as const;
export const MODULE_CODE_HASHES: Readonly<Record<string, Hex>> = {
  [ADDRESSES.moduleA.toLowerCase()]: '0x1a5e700fbb0533685dc9f9b28fc89bb496d480990e6c292f2abdd3e97485d245',
  [ADDRESSES.moduleB.toLowerCase()]: '0xdbebd5942589cb48bc55fd0d804e2a825ae485fa4eb771ec030e0ec4c330ae03',
};
export const CONTRACT_CODE_HASHES: Readonly<Record<string, Hex>> = {
  [ADDRESSES.safeL2.toLowerCase()]: '0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff',
  [ADDRESSES.factory.toLowerCase()]: '0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317',
  [ADDRESSES.fallbackHandler.toLowerCase()]: '0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9',
  [ADDRESSES.multiSendCallOnly.toLowerCase()]: '0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939',
  [ADDRESSES.multiSend.toLowerCase()]: '0x0e4f7fc66550a322d1e7688e181b75e217e662a4f3f4d6a29b22bc61217c4b77',
  [ADDRESSES.moduleSetup.toLowerCase()]: '0xaf2d170bb766d2773c3fa88717f5b3599827478074d3767d1dee55e5c2f3fbcb',
  ...MODULE_CODE_HASHES,
};
export const PROXY_RUNTIME_CODE_HASH = '0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c' as const;
export const PROXY_CREATION_CODE_HASH = '0x1856e0ee08399d74e0ea0b03adca210aeade6f748969ac023cdcb4dd62dcaf5f' as const;
export const GUARD_STORAGE_SLOT = '0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8' as const;
export const FALLBACK_STORAGE_SLOT = '0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5' as const;
export const USDC_LIMIT = 5_000_000n;
export const ETH_LIMIT = 10_000_000_000_000_000n;
/**
 * First Sepolia block the wallet-history check reads: shortly before our first Sepolia deployment.
 * At head 11,886,175 (10 Oct 2026, 17:58 UTC) RELAYER and TREASURY had sent no transaction, so no wallet of ours is older.
 */
export const SEPOLIA_HISTORY_START = 11_886_000n;
/** Largest block range per eth_getLogs request (publicnode allows 50,000 blocks, ethpandaops 30,000). */
export const LOG_CHUNK_BLOCKS = 10_000n;
/**
 * Sepolia RPCs that keep full eth_getLogs history: two independent operators for wallet verification.
 * publicnode drops logs older than about 10,000 blocks (~33 h), so it cannot verify older wallets.
 */
export const HISTORY_RPC_URLS = ['https://sepolia.gateway.tenderly.co', 'https://rpc.sepolia.ethpandaops.io'] as const;
/**
 * General Sepolia RPCs: publicnode first for sends, receipts and current reads; the history RPCs follow as fallbacks.
 * drpc was removed: its free tier refuses eth_getLogs ranges of more than about 100 blocks.
 */
export const PUBLIC_RPC_URLS = ['https://ethereum-sepolia-rpc.publicnode.com', ...HISTORY_RPC_URLS] as const;
