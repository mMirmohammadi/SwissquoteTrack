import { parseAbi } from 'viem';
export const safeAbi = parseAbi([
  'function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address paymentReceiver)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function nonce() view returns (uint256)',
  'function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)',
  'function isModuleEnabled(address module) view returns (bool)',
  'function swapOwner(address prevOwner,address oldOwner,address newOwner)',
  'function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce) view returns (bytes32)',
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) payable returns (bool success)',
  'event SafeMultiSigTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures,bytes additionalInfo)',
  'event SafeModuleTransaction(address module,address to,uint256 value,bytes data,uint8 operation)',
  'event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)',
  'event ExecutionFailure(bytes32 indexed txHash,uint256 payment)',
]);
export const factoryAbi = parseAbi([
  'function proxyCreationCode() pure returns (bytes)',
  'function createProxyWithNonce(address singleton,bytes initializer,uint256 saltNonce) returns (address proxy)',
  'event ProxyCreation(address proxy,address singleton)',
]);
export const moduleAbi = parseAbi([
  'function addGuardianWithThreshold(address guardian,uint256 threshold)',
  'function revokeGuardianWithThreshold(address prevGuardian,address guardian,uint256 threshold)',
  'function threshold(address wallet) view returns (uint256)',
  'function guardiansCount(address wallet) view returns (uint256)',
  'function getGuardians(address wallet) view returns (address[])',
  'function isGuardian(address wallet,address guardian) view returns (bool)',
  'function nonce(address wallet) view returns (uint256)',
  'function getRecoveryHash(address wallet,address[] newOwners,uint256 newThreshold,uint256 nonce) view returns (bytes32)',
  'function getRecoveryRequest(address wallet) view returns ((uint256 guardiansApprovalCount,uint256 newThreshold,uint64 executeAfter,address[] newOwners) request)',
  'function multiConfirmRecovery(address wallet,address[] newOwners,uint256 newThreshold,(address signer,bytes signature)[] signatures,bool execute)',
  'function finalizeRecovery(address wallet)',
  'function cancelRecovery()',
  'function invalidateNonce()',
]);
export const multiSendAbi = parseAbi(['function multiSend(bytes transactions) payable']);
export const moduleSetupAbi = parseAbi(['function enableModules(address[] modules)']);
export const erc20Abi = parseAbi([
  'function transfer(address to,uint256 amount) returns (bool)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function transferFrom(address from,address to,uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);
export const fallbackHandlerAbi = parseAbi(['function isValidSignature(bytes32 hash,bytes signature) view returns (bytes4)']);
