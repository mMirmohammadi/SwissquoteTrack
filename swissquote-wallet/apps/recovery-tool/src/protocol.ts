// Single integration boundary: only documented @sq/protocol exports.
export {
  ADDRESSES, CHAIN_ID, LOCAL_CHAIN_ID, MODULES, MODULE_CODE_HASHES, PUBLIC_RPC_URLS,
  DERIVATION_PATH, generateCardSeed, mnemonicToAddress, mnemonicToPrivateKey,
  ownerFingerprint, decodeSetupCode, decodeRequestCode, encodeCode,
  verifyWalletIndependent, assertRecoveryHash, signRecovery, moduleAbi, openKit,
} from '@sq/protocol';
export type { WalletSetup, RecoveryRequest, EmergencyKit } from '@sq/protocol';
