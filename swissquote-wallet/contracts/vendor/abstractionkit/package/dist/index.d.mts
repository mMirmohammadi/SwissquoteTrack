//#region src/transport/Transport.d.ts
interface RequestArgs {
  readonly method: string;
  readonly params?: readonly unknown[] | object;
}
interface RequestOptions {
  readonly signal?: AbortSignal;
}
interface ProviderRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;
}
declare class TransportRpcError extends Error implements ProviderRpcError {
  readonly code: number;
  readonly data?: unknown;
  constructor(code: number, message: string, data?: unknown);
}
interface Transport {
  request<T = unknown>(args: RequestArgs, options?: RequestOptions): Promise<T>;
}
interface EventfulTransport extends Transport {
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}
declare function isEventfulTransport(transport: Transport): transport is EventfulTransport;
//#endregion
//#region src/transport/BaseRpcTransport.d.ts
interface JsonRpcEnvelope {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly method: string;
  readonly params?: unknown;
}
declare abstract class BaseRpcTransport implements Transport {
  private nextId;
  request<T = unknown>(args: RequestArgs, options?: RequestOptions): Promise<T>;
  protected abstract send(envelope: JsonRpcEnvelope, options?: RequestOptions): Promise<unknown>;
  protected static serializeEnvelope(envelope: JsonRpcEnvelope): string;
  private static parseResponse;
}
//#endregion
//#region src/transport/HttpTransport.d.ts
interface HttpTransportOptions {
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}
declare class HttpTransport extends BaseRpcTransport {
  readonly url: string;
  readonly options: HttpTransportOptions;
  constructor(url: string, options?: HttpTransportOptions);
  protected send(envelope: JsonRpcEnvelope, options?: RequestOptions): Promise<unknown>;
}
declare function isHttpTransport(transport: Transport): transport is HttpTransport;
//#endregion
//#region src/utils7702.d.ts
type Authorization7702 = {
  chainId: bigint;
  address: string;
  nonce: bigint;
  yParity: 0 | 1;
  r: bigint;
  s: bigint;
};
type Authorization7702Hex = {
  chainId: string;
  address: string;
  nonce: string;
  yParity: string;
  r: string;
  s: string;
};
declare function createAndSignLegacyRawTransaction(chainId: bigint, nonce: bigint, gas_price: bigint, gas_limit: bigint, destination: string, value: bigint, data: string, eoaPrivateKey: string): string;
declare function createAndSignEip7702DelegationAuthorization(chainId: bigint, address: string, nonce: bigint, signer: string): Authorization7702Hex;
declare function createAndSignEip7702DelegationAuthorization(chainId: bigint, address: string, nonce: bigint, signer: (hash: string) => Promise<string>): Promise<Authorization7702Hex>;
declare function createEip7702DelegationAuthorizationHash(chainId: bigint, address: string, nonce: bigint): string;
declare function signHash(authHash: string, eoaPrivateKey: string): {
  yParity: 0 | 1;
  r: bigint;
  s: bigint;
};
declare function createAndSignEip7702RawTransaction(chainId: bigint, nonce: bigint, max_priority_fee_per_gas: bigint, max_fee_per_gas: bigint, gas_limit: bigint, destination: string, value: bigint, data: string, access_list: [string, string[]][], authorization_list: Authorization7702[], eoaPrivateKey: string): string;
declare function createEip7702TransactionHash(chainId: bigint, nonce: bigint, max_priority_fee_per_gas: bigint, max_fee_per_gas: bigint, gas_limit: bigint, destination: string, value: bigint, data: string, access_list: [string, string[]][], authorization_list: Authorization7702[]): string;
//#endregion
//#region src/types.d.ts
interface BaseUserOperation {
  sender: string;
  nonce: bigint;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  signature: string;
}
interface UserOperationV6 extends BaseUserOperation {
  initCode: string;
  paymasterAndData: string;
}
interface UserOperationV7 extends BaseUserOperation {
  factory: string | null;
  factoryData: string | null;
  paymaster: string | null;
  paymasterVerificationGasLimit: bigint | null;
  paymasterPostOpGasLimit: bigint | null;
  paymasterData: string | null;
}
interface UserOperationV8 extends BaseUserOperation {
  factory: string | null;
  factoryData: string | null;
  paymaster: string | null;
  paymasterVerificationGasLimit: bigint | null;
  paymasterPostOpGasLimit: bigint | null;
  paymasterData: string | null;
  eip7702Auth: Authorization7702Hex | null;
}
interface UserOperationV9 extends UserOperationV8 {}
type AbiInputValue = string | bigint | number | boolean | AbiInputValue[];
type JsonRpcParam = string | bigint | boolean | object | JsonRpcParam[];
type JsonRpcResponse = {
  id: number | null;
  jsonrpc: string;
  result?: JsonRpcResult;
  simulation_results?: JsonRpcResult;
  error?: JsonRpcError;
};
type ChainIdResult = string;
type SupportedEntryPointsResult = string[];
type SingleTransactionTenderlySimulationResult = {
  transaction: Record<string, unknown>;
  simulation: {
    id: string;
  } & Record<string, unknown>;
};
type TenderlySimulationResult = SingleTransactionTenderlySimulationResult[];
type JsonRpcResult = ChainIdResult | SupportedEntryPointsResult | GasEstimationResult | UserOperationByHashResult | UserOperationReceipt | UserOperationReceiptResult | SupportedERC20TokensAndMetadata | PmUserOperationV7Result | PmUserOperationV6Result | TenderlySimulationResult;
type JsonRpcError = {
  code: number;
  message: string;
  data: object;
};
type GasEstimationResult = {
  callGasLimit: bigint;
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
  paymasterVerificationGasLimit?: bigint;
  paymasterPostOpGasLimit?: bigint;
};
type UserOperationByHashResult = {
  userOperation: UserOperationV6 | UserOperationV7 | UserOperationV8 | UserOperationV9;
  entryPoint: string;
  blockNumber: bigint | null;
  blockHash: string | null;
  transactionHash: string | null;
} | null;
type Log = {
  address: string;
  topics: string[];
  data: string;
  blockNumber?: string;
  blockHash?: string;
  transactionHash?: string;
  transactionIndex?: string;
  logIndex?: string;
  removed?: boolean;
};
type UserOperationReceipt = {
  blockHash: string;
  blockNumber: bigint;
  from: string;
  cumulativeGasUsed: bigint;
  gasUsed: bigint;
  logs: Log[];
  logsBloom: string;
  transactionHash: string;
  transactionIndex: bigint;
  effectiveGasPrice?: bigint;
};
type UserOperationReceiptResult = {
  userOpHash: string;
  entryPoint: string;
  sender: string;
  nonce: bigint;
  paymaster: string;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  success: boolean;
  logs: Log[];
  receipt: UserOperationReceipt;
} | null;
type SponsorMetadata = {
  name: string;
  description: string;
  url: string;
  icons: string[];
};
type TokenQuote = {
  token: string;
  exchangeRate: bigint;
  tokenCost: bigint;
  paymaster: string;
  approveAmount: bigint;
};
type SponsorInfo = {
  name: string;
  icon?: string;
};
type PmUserOperationV7Result = {
  paymaster: string;
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
  paymasterData: string;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  sponsor?: SponsorInfo;
};
type PmUserOperationV6Result = {
  paymasterAndData: string;
  callGasLimit?: bigint;
  preVerificationGas?: bigint;
  verificationGasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  sponsor?: SponsorInfo;
};
declare enum Operation {
  Call = 0,
  Delegate = 1
}
interface MetaTransaction {
  to: string;
  value: bigint;
  data: string;
  operation?: Operation;
}
interface ERC20Token {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}
interface ERC20TokenWithExchangeRate extends ERC20Token {
  exchangeRate: bigint;
}
interface PaymasterMetadata {
  name: string;
  description: string;
  icons: string[];
  address: string;
  sponsoredEventTopic: string;
  dummyPaymasterAndData: {
    paymaster: string;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
    paymasterData: string;
  } | string;
}
interface SupportedERC20TokensAndMetadata {
  paymasterMetadata: PaymasterMetadata;
  tokens: ERC20Token[];
}
interface SupportedERC20TokensAndMetadataWithExchangeRate {
  paymasterMetadata: PaymasterMetadata;
  tokens: ERC20TokenWithExchangeRate[];
}
interface Dictionary<T> {
  [Key: string]: T;
}
type AddressToState = {
  balance?: bigint;
  nonce?: bigint;
  code?: string;
  state?: Dictionary<string>;
  stateDiff?: Dictionary<string>;
};
type StateOverrideSet = {
  [key: string]: AddressToState;
};
declare enum GasOption {
  Slow = 1,
  Medium = 1.2,
  Fast = 1.5
}
declare enum PolygonChain {
  Mainnet = "v2",
  ZkMainnet = "zkevm",
  Amoy = "amoy",
  Cardona = "cardona"
}
type OnChainIdentifierParamsType = {
  project: string;
  platform?: "Web" | "Mobile" | "Safe App" | "Widget";
  tool?: string;
  toolVersion?: string;
};
interface ParallelPaymasterInitValues {
  paymaster: string;
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
  paymasterData: string;
}
//#endregion
//#region src/signer/types.d.ts
interface TypedData {
  domain: {
    name?: string;
    version?: string;
    chainId?: number | bigint;
    verifyingContract?: `0x${string}`;
    salt?: `0x${string}`;
  };
  types: Record<string, Array<{
    name: string;
    type: string;
  }>>;
  primaryType: string;
  message: Record<string, unknown>;
}
type SigningScheme = "hash" | "typedData";
interface SignContext<T extends BaseUserOperation = BaseUserOperation> {
  readonly userOperation: T;
  readonly chainId: bigint;
  readonly entryPoint: string;
}
interface MultiOpSignContext<T extends BaseUserOperation = BaseUserOperation> {
  readonly userOperations: ReadonlyArray<{
    readonly userOperation: T;
    readonly chainId: bigint;
  }>;
  readonly entryPoint: string;
}
interface ExternalSignerBase {
  readonly address: `0x${string}`;
  readonly type?: "ecdsa" | "contract";
}
type SignHashFn<C = SignContext> = (hash: `0x${string}`, context: C) => `0x${string}` | Promise<`0x${string}`>;
type SignTypedDataFn<C = SignContext> = (data: TypedData, context: C) => `0x${string}` | Promise<`0x${string}`>;
type ExternalSigner<C = SignContext> = ExternalSignerBase & ({
  signHash: SignHashFn<C>;
  signTypedData?: SignTypedDataFn<C>;
} | {
  signHash?: SignHashFn<C>;
  signTypedData: SignTypedDataFn<C>;
});
//#endregion
//#region src/utils.d.ts
declare function createUserOperationHash(useroperation: UserOperationV6 | UserOperationV7 | UserOperationV8 | UserOperationV9, entrypointAddress: string, chainId: bigint): string;
declare function createCallData(functionSelector: string, functionInputAbi: string[], functionInputParameters: AbiInputValue[]): string;
declare function sendJsonRpcRequest(rpc: string | Transport | JsonRpcNode, method: string, params: JsonRpcParam, headers?: Record<string, string>, paramsKeyName?: string): Promise<JsonRpcResult>;
declare function getFunctionSelector(functionSignature: string): string;
declare function fetchAccountNonce(rpc: string | Transport | JsonRpcNode, entryPoint: string, account: string, key?: number | bigint): Promise<bigint>;
declare function calculateUserOperationMaxGasCost(useroperation: UserOperationV6 | UserOperationV7): bigint;
type DepositInfo = {
  deposit: bigint;
  staked: boolean;
  stake: bigint;
  unstakeDelaySec: bigint;
  withdrawTime: bigint;
};
//#endregion
//#region src/transport/JsonRpcNode.d.ts
type EthCallTransaction = {
  from?: string;
  to: string;
  gas?: bigint;
  gasPrice?: bigint;
  value?: bigint;
  data?: string;
};
declare class JsonRpcNode implements Transport {
  readonly transport: Transport;
  private readonly outbound;
  constructor(rpc: string | Transport);
  static from(input: string | Transport | JsonRpcNode): JsonRpcNode;
  request<T = unknown>(args: RequestArgs, options?: RequestOptions): Promise<T>;
  chainId(options?: RequestOptions): Promise<string>;
  blockNumber(options?: RequestOptions): Promise<bigint>;
  getCode(address: string, blockTag?: string | bigint, options?: RequestOptions): Promise<string>;
  getStorageAt(address: string, slot: string, blockTag?: string | bigint, options?: RequestOptions): Promise<string>;
  call(tx: EthCallTransaction, blockTag?: string | bigint, stateOverrides?: object, options?: RequestOptions): Promise<string>;
  getTransactionCount(address: string, blockTag?: string | bigint, options?: RequestOptions): Promise<bigint>;
  getFeeData(gasLevel?: GasOption, options?: RequestOptions): Promise<[bigint, bigint]>;
  getDelegatedAddress(accountAddress: string, options?: RequestOptions): Promise<string | null>;
  getEntryPointNonce(entryPoint: string, account: string, key?: bigint, options?: RequestOptions): Promise<bigint>;
  getEntryPointDeposit(address: string, entryPoint: string, options?: RequestOptions): Promise<bigint>;
  getEntryPointDepositInfo(address: string, entryPoint: string, options?: RequestOptions): Promise<DepositInfo>;
}
//#endregion
//#region src/Bundler.d.ts
declare class Bundler implements Transport {
  readonly transport: Transport;
  private readonly outbound;
  constructor(rpc: string | Transport);
  static from(input: string | Transport | Bundler): Bundler;
  request<T = unknown>(args: RequestArgs, options?: RequestOptions): Promise<T>;
  chainId(): Promise<string>;
  supportedEntryPoints(): Promise<string[]>;
  estimateUserOperationGas(useroperation: UserOperationV6 | UserOperationV7 | UserOperationV8 | UserOperationV9, entrypointAddress: string, state_override_set?: StateOverrideSet): Promise<GasEstimationResult>;
  sendUserOperation(useroperation: UserOperationV6 | UserOperationV7 | UserOperationV8 | UserOperationV9, entrypointAddress: string): Promise<string>;
  getUserOperationReceipt(useroperationhash: string): Promise<UserOperationReceiptResult>;
  getUserOperationByHash(useroperationhash: string): Promise<UserOperationByHashResult>;
}
//#endregion
//#region src/paymaster/types.d.ts
type AnyUserOperation = UserOperationV9 | UserOperationV8 | UserOperationV7 | UserOperationV6;
type SameUserOp<T extends AnyUserOperation> = T extends UserOperationV9 ? UserOperationV9 : T extends UserOperationV8 ? UserOperationV8 : T extends UserOperationV7 ? UserOperationV7 : UserOperationV6;
interface CandidePaymasterContext {
  token?: string;
  sponsorshipPolicyId?: string;
  signingPhase?: "commit" | "finalize";
}
interface SmartAccountWithEntrypoint {
  readonly entrypointAddress: string;
}
interface PrependTokenPaymasterApproveAccount extends SmartAccountWithEntrypoint {
  prependTokenPaymasterApproveToCallData(callData: string, tokenAddress: string, paymasterAddress: string, approveAmount: bigint): string;
}
type Erc7677Provider = "pimlico" | "candide" | null;
interface Erc7677PaymasterConstructorOptions {
  chainId?: bigint;
  provider?: "auto" | Erc7677Provider;
}
interface BasePaymasterUserOperationOverrides {
  entrypoint?: string;
  resetApproval?: boolean;
}
interface GasPaymasterUserOperationOverrides extends BasePaymasterUserOperationOverrides {
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  callGasLimitPercentageMultiplier?: number;
  verificationGasLimitPercentageMultiplier?: number;
  preVerificationGasPercentageMultiplier?: number;
  state_override_set?: StateOverrideSet;
}
//#endregion
//#region src/account/SendUseroperationResponse.d.ts
declare class SendUseroperationResponse {
  readonly userOperationHash: string;
  readonly bundler: Bundler;
  readonly entrypointAddress: string;
  constructor(userOperationHash: string, bundler: Bundler, entrypointAddress: string);
  private delay;
  included(timeoutInSeconds?: number, requestIntervalInSeconds?: number): Promise<UserOperationReceiptResult>;
}
//#endregion
//#region src/account/SmartAccount.d.ts
declare abstract class SmartAccount {
  readonly accountAddress: string;
  static readonly proxyByteCode: string;
  static readonly initializerFunctionSelector: string;
  static readonly initializerFunctionInputAbi: string[];
  static readonly executorFunctionSelector: string;
  static readonly executorFunctionInputAbi: string[];
  constructor(accountAddress: string);
}
//#endregion
//#region src/account/simple/Simple7702Account.d.ts
interface SimpleMetaTransaction {
  to: string;
  value: bigint;
  data: string;
}
interface CreateUserOperationOverrides {
  nonce?: bigint;
  callData?: string;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimitPercentageMultiplier?: number;
  verificationGasLimitPercentageMultiplier?: number;
  preVerificationGasPercentageMultiplier?: number;
  maxFeePerGasPercentageMultiplier?: number;
  maxPriorityFeePerGasPercentageMultiplier?: number;
  state_override_set?: StateOverrideSet;
  skipGasEstimation?: boolean;
  dummySignature?: string;
  gasLevel?: GasOption;
  polygonGasStation?: PolygonChain;
  eip7702Auth?: {
    chainId: bigint;
    address?: string;
    nonce?: bigint;
    yParity?: string;
    r?: string;
    s?: string;
  };
  parallelPaymasterInitValues?: {
    paymaster: string;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
    paymasterData: string;
  };
}
declare class BaseSimple7702Account extends SmartAccount {
  static readonly executorFunctionSelector = "0xb61d27f6";
  static readonly executorFunctionInputAbi: string[];
  static readonly batchExecutorFunctionSelector = "0x34fcd5be";
  static readonly batchExecutorFunctionInputAbi: string[];
  static readonly dummySignature = "0xd2614025fc173b86704caf37b2fb447f7618101a0d31f5f304c777024cef38a060a29ee43fcf0c46f9107d4f670b8a85c2c017a1fe9e4af891f24f0be6ba5d671c";
  readonly entrypointAddress: string;
  readonly delegateeAddress: string;
  constructor(accountAddress: string, entrypointAddress: string, delegateeAddress: string);
  isDelegatedToThisAccount(providerRpc: string | Transport | JsonRpcNode): Promise<boolean>;
  createRevokeDelegationTransaction(eoaPrivateKey: string, providerRpc: string | Transport | JsonRpcNode, overrides?: {
    nonce?: bigint;
    authorizationNonce?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    gasLimit?: bigint;
    chainId?: bigint;
  }): Promise<string>;
  static createAccountCallData(to: string, value: bigint, data: string): string;
  static createAccountCallDataSingleTransaction(metaTransaction: SimpleMetaTransaction): string;
  static createAccountCallDataBatchTransactions(transactions: SimpleMetaTransaction[]): string;
  protected baseCreateUserOperation(transactions: SimpleMetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateUserOperationOverrides): Promise<UserOperationV8 | UserOperationV9>;
  protected baseEstimateUserOperationGas(userOperation: UserOperationV8 | UserOperationV9, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignature?: string;
  }): Promise<[bigint, bigint, bigint]>;
  protected baseSignUserOperation(useroperation: UserOperationV8 | UserOperationV9, privateKey: string, chainId: bigint): string;
  static readonly ACCEPTED_SIGNING_SCHEMES: readonly SigningScheme[];
  static getUserOperationEip712Data(userOperation: UserOperationV8 | UserOperationV9, chainId: bigint, overrides?: {
    entrypointAddress?: string;
  }): TypedData;
  static getUserOperationEip712Hash(userOperation: UserOperationV8 | UserOperationV9, chainId: bigint, overrides?: {
    entrypointAddress?: string;
  }): string;
  protected baseSignUserOperationWithSigner<T extends UserOperationV8 | UserOperationV9>(useroperation: T, signer: ExternalSigner, chainId: bigint): Promise<string>;
  protected baseSendUserOperation(userOperation: UserOperationV8 | UserOperationV9, bundlerRpc: string | Transport | Bundler): Promise<SendUseroperationResponse>;
  prependTokenPaymasterApproveToCallData(callData: string, tokenAddress: string, paymasterAddress: string, approveAmount: bigint): string;
  static prependTokenPaymasterApproveToCallDataStatic(callData: string, tokenAddress: string, paymasterAddress: string, approveAmount: bigint): string;
}
declare class Simple7702Account extends BaseSimple7702Account {
  static readonly DEFAULT_DELEGATEE_ADDRESS = "0xe6Cae83BdE06E4c305530e199D7217f42808555B";
  constructor(accountAddress: string, overrides?: {
    entrypointAddress?: string;
    delegateeAddress?: string;
  });
  createUserOperation(transactions: SimpleMetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateUserOperationOverrides): Promise<UserOperationV8>;
  estimateUserOperationGas(userOperation: UserOperationV8, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignature?: string;
  }): Promise<[bigint, bigint, bigint]>;
  signUserOperation(useroperation: UserOperationV8, privateKey: string, chainId: bigint): string;
  signUserOperationWithSigner(useroperation: UserOperationV8, signer: ExternalSigner, chainId: bigint): Promise<string>;
  sendUserOperation(userOperation: UserOperationV8, bundlerRpc: string | Transport | Bundler): Promise<SendUseroperationResponse>;
}
//#endregion
//#region src/account/Calibur/types.d.ts
declare enum CaliburKeyType {
  P256 = 0,
  WebAuthnP256 = 1,
  Secp256k1 = 2
}
interface CaliburKey {
  keyType: CaliburKeyType;
  publicKey: string;
}
interface CaliburKeySettings {
  hook?: string;
  expiration?: number;
  isAdmin?: boolean;
}
interface CaliburKeySettingsResult {
  hook: string;
  expiration: number;
  isAdmin: boolean;
}
interface WebAuthnSignatureData {
  authenticatorData: string;
  clientDataJSON: string;
  challengeIndex: bigint;
  typeIndex: bigint;
  r: bigint;
  s: bigint;
}
interface CaliburCreateUserOperationOverrides {
  nonce?: bigint;
  callData?: string;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimitPercentageMultiplier?: number;
  verificationGasLimitPercentageMultiplier?: number;
  preVerificationGasPercentageMultiplier?: number;
  maxFeePerGasPercentageMultiplier?: number;
  maxPriorityFeePerGasPercentageMultiplier?: number;
  state_override_set?: StateOverrideSet;
  skipGasEstimation?: boolean;
  dummySignature?: string;
  gasLevel?: GasOption;
  polygonGasStation?: PolygonChain;
  revertOnFailure?: boolean;
  paymasterFields?: ParallelPaymasterInitValues;
  eip7702Auth?: {
    chainId: bigint;
    address?: string;
    nonce?: bigint;
    yParity?: string;
    r?: string;
    s?: string;
  };
}
interface CaliburSignatureOverrides {
  hookData?: string;
  keyHash?: string;
}
//#endregion
//#region src/account/Calibur/Calibur7702Account.d.ts
declare class Calibur7702Account extends SmartAccount implements PrependTokenPaymasterApproveAccount {
  static readonly executorFunctionSelector = "0x8dd7712f";
  static readonly dummySignature: string;
  static createDummyWebAuthnSignature(keyHash: string): string;
  static wrapSignature(keyHash: string, rawSignature: string, hookData?: string): string;
  static formatEip712SingleSignatureToUseroperationSignature(signature: string, overrides?: CaliburSignatureOverrides): string;
  readonly entrypointAddress: string;
  readonly delegateeAddress: string;
  constructor(accountAddress: string, overrides?: {
    entrypointAddress?: string;
    delegateeAddress?: string;
  });
  getUserOperationHash(userOperation: UserOperationV8, chainId: bigint): string;
  static getUserOperationEip712Data(userOperation: UserOperationV8 | UserOperationV9, chainId: bigint, overrides?: {
    entrypointAddress?: string;
  }): TypedData;
  static getUserOperationEip712Hash(userOperation: UserOperationV8 | UserOperationV9, chainId: bigint, overrides?: {
    entrypointAddress?: string;
  }): string;
  static createAccountCallData(transactions: SimpleMetaTransaction[], revertOnFailure?: boolean): string;
  createUserOperation(transactions: SimpleMetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CaliburCreateUserOperationOverrides): Promise<UserOperationV8>;
  signUserOperation(userOperation: UserOperationV8, privateKey: string, chainId: bigint, overrides?: CaliburSignatureOverrides): string;
  static readonly ACCEPTED_SIGNING_SCHEMES: readonly SigningScheme[];
  signUserOperationWithSigner(userOperation: UserOperationV8, signer: ExternalSigner, chainId: bigint, overrides?: CaliburSignatureOverrides): Promise<string>;
  formatWebAuthnSignature(keyHash: string, webAuthnAuth: WebAuthnSignatureData, overrides?: CaliburSignatureOverrides): string;
  sendUserOperation(userOperation: UserOperationV8, bundlerRpc: string | Transport | Bundler): Promise<SendUseroperationResponse>;
  static createSecp256k1Key(address: string): CaliburKey;
  static createWebAuthnP256Key(x: bigint, y: bigint): CaliburKey;
  static createP256Key(x: bigint, y: bigint): CaliburKey;
  static getKeyHash(key: CaliburKey): string;
  static packKeySettings(settings: CaliburKeySettings): bigint;
  static unpackKeySettings(packed: bigint): CaliburKeySettingsResult;
  static createRegisterKeyMetaTransactions(key: CaliburKey, settings?: CaliburKeySettings): [SimpleMetaTransaction, SimpleMetaTransaction];
  static createRevokeKeyMetaTransaction(keyHash: string): SimpleMetaTransaction;
  createRevokeAllKeysMetaTransactions(providerRpc: string | Transport | JsonRpcNode): Promise<SimpleMetaTransaction[]>;
  createRevokeDelegationRawTransaction(chainId: bigint, eoaPrivateKey: string, providerRpc: string | Transport | JsonRpcNode, overrides?: {
    nonce?: bigint;
    authorizationNonce?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    gasLimit?: bigint;
  }): Promise<string>;
  static createUpdateKeySettingsMetaTransaction(keyHash: string, settings: CaliburKeySettings): SimpleMetaTransaction;
  static createInvalidateNonceMetaTransaction(newNonce: bigint): SimpleMetaTransaction;
  isDelegatedToThisAccount(providerRpc: string | Transport | JsonRpcNode): Promise<boolean>;
  getNonce(providerRpc: string | Transport | JsonRpcNode, sequenceKey?: number): Promise<bigint>;
  isKeyRegistered(providerRpc: string | Transport | JsonRpcNode, keyHash: string): Promise<boolean>;
  getKeySettings(providerRpc: string | Transport | JsonRpcNode, keyHash: string): Promise<CaliburKeySettingsResult>;
  getKey(providerRpc: string | Transport | JsonRpcNode, keyHash: string): Promise<CaliburKey>;
  getKeys(providerRpc: string | Transport | JsonRpcNode, overrides?: {
    blockNumber?: bigint;
  }): Promise<CaliburKey[]>;
  prependTokenPaymasterApproveToCallData(callData: string, tokenAddress: string, paymasterAddress: string, approveAmount: bigint): string;
  static prependTokenPaymasterApproveToCallDataStatic(callData: string, tokenAddress: string, paymasterAddress: string, approveAmount: bigint): string;
}
//#endregion
//#region src/account/Safe/modules/SafeModule.d.ts
declare abstract class SafeModule {
  readonly moduleAddress: string;
  constructor(moduleAddress: string);
  createEnableModuleMetaTransaction(accountAddress: string): MetaTransaction;
  checkForEmptyResultAndRevert(result: string, requestName: string): void;
}
//#endregion
//#region src/account/Safe/modules/AllowanceModule.d.ts
declare const ALLOWANCE_MODULE_V0_1_0_ADDRESS = "0xAA46724893dedD72658219405185Fb0Fc91e091C";
declare class AllowanceModule extends SafeModule {
  static readonly DEFAULT_ALLOWANCE_MODULE_ADDRESS = "0x691f59471Bfd2B7d639DCF74671a2d648ED1E331";
  constructor(moduleAddress?: string);
  createOneTimeAllowanceMetaTransaction(delegate: string, token: string, allowanceAmount: bigint): MetaTransaction;
  createRecurringAllowanceMetaTransaction(delegate: string, token: string, allowanceAmount: bigint, recurringAllowanceValidityPeriodInMinutes: bigint, inThePastPeriodStartBaseTimeStamp?: bigint): MetaTransaction;
  createBaseSetAllowanceMetaTransaction(delegate: string, token: string, allowanceAmount: bigint, resetTimeMin: bigint, resetBaseMin: bigint): MetaTransaction;
  createRenewAllowanceMetaTransaction(delegate: string, token: string): MetaTransaction;
  createDeleteAllowanceMetaTransaction(delegate: string, token: string): MetaTransaction;
  createAllowanceTransferMetaTransaction(allowanceSourceSafeAddress: string, token: string, to: string, amount: bigint, delegate: string, overrides?: {
    delegateSignature?: string;
    paymentToken?: string;
    paymentAmount?: bigint;
  }): MetaTransaction;
  createBaseExecuteAllowanceTransferMetaTransaction(safeAddress: string, token: string, to: string, amount: bigint, paymentToken: string, payment: bigint, delegate: string, delegateSignature: string): MetaTransaction;
  createAddDelegateMetaTransaction(delegate: string): MetaTransaction;
  createRemoveDelegateMetaTransaction(delegate: string, removeAllowances: boolean): MetaTransaction;
  getTokens(nodeRpcUrl: string | Transport | JsonRpcNode, safeAddress: string, delegate: string): Promise<string[]>;
  getTokensAllowance(nodeRpcUrl: string | Transport | JsonRpcNode, safeAddress: string, delegate: string, token: string): Promise<Allowance>;
  getDelegates(nodeRpcUrl: string | Transport | JsonRpcNode, safeAddress: string, overrides?: {
    start?: bigint;
    maxNumberOfResults?: bigint;
  }): Promise<string[]>;
  baseGetDelegates(nodeRpcUrl: string | Transport | JsonRpcNode, safeAddress: string, start: bigint, pageSize: bigint): Promise<{
    results: string[];
    next: bigint;
  }>;
}
type Allowance = {
  amount: bigint;
  spent: bigint;
  resetTimeMin: bigint;
  lastResetMin: bigint;
  nonce: bigint;
};
//#endregion
//#region src/account/Safe/modules/SocialRecoveryModule.d.ts
declare enum SocialRecoveryModuleGracePeriodSelector {
  After3Minutes = "0x949d01d424bE050D09C16025dd007CB59b3A8c66",
  After3Days = "0x38275826E1933303E508433dD5f289315Da2541c",
  After7Days = "0x088f6cfD8BB1dDb1BB069CCb3fc1A98927D233f2",
  After14Days = "0x9BacD92F4687Db306D7ded5d4513a51EA05df25b"
}
declare class SocialRecoveryModule extends SafeModule {
  static readonly DEFAULT_SOCIAL_RECOVERY_ADDRESS = SocialRecoveryModuleGracePeriodSelector.After3Days;
  constructor(moduleAddress?: string);
  createConfirmRecoveryMetaTransaction(accountAddress: string, newOwners: string[], newThreshold: number, execute: boolean): MetaTransaction;
  createMultiConfirmRecoveryMetaTransaction(accountAddress: string, newOwners: string[], newThreshold: number, signaturePairList: RecoverySignaturePair[], execute: boolean): MetaTransaction;
  createExecuteRecoveryMetaTransaction(accountAddress: string, newOwners: string[], newThreshold: number): MetaTransaction;
  createFinalizeRecoveryMetaTransaction(accountAddress: string): MetaTransaction;
  createCancelRecoveryMetaTransaction(): MetaTransaction;
  createAddGuardianWithThresholdMetaTransaction(guardianAddress: string, threshold: bigint): MetaTransaction;
  createRevokeGuardianWithThresholdMetaTransaction(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string, guardianAddress: string, threshold: bigint, overrides?: {
    prevGuardianAddress?: string;
  }): Promise<MetaTransaction>;
  createStandardRevokeGuardianWithThresholdMetaTransaction(prevGuardianAddress: string, guardianAddress: string, threshold: bigint): MetaTransaction;
  createChangeThresholdMetaTransaction(threshold: bigint): MetaTransaction;
  getRecoveryHash(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string, newOwners: string[], newThreshold: number, nonce: bigint): Promise<string>;
  getRecoveryRequest(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string): Promise<RecoveryRequest>;
  getRecoveryApprovals(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string, newOwners: string[], newThreshold: number): Promise<bigint>;
  hasGuardianApproved(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string, guardian: string, newOwners: string[], newThreshold: number): Promise<boolean>;
  isGuardian(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string, guardian: string): Promise<boolean>;
  guardiansCount(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string): Promise<bigint>;
  threshold(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string): Promise<bigint>;
  getGuardians(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string): Promise<string[]>;
  nonce(nodeRpcUrl: string | Transport | JsonRpcNode, accountAddress: string): Promise<bigint>;
  getRecoveryRequestEip712Data(rpcNode: string | Transport | JsonRpcNode, chainId: bigint, accountAddress: string, newOwners: string[], newThreshold: bigint, overrides?: {
    recoveryNonce?: bigint;
  }): Promise<{
    domain: RecoveryRequestTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: RecoveryRequestTypedMessageValue;
  }>;
}
type RecoveryRequest = {
  guardiansApprovalCount: bigint;
  newThreshold: bigint;
  executeAfter: bigint;
  newOwners: string[];
};
type RecoverySignaturePair = {
  signer: string;
  signature: string;
};
declare const EXECUTE_RECOVERY_PRIMARY_TYPE = "ExecuteRecovery";
type RecoveryRequestTypedDataDomain = {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
};
type RecoveryRequestTypedMessageValue = {
  wallet: string;
  newOwners: string[];
  newThreshold: bigint;
  nonce: bigint;
};
declare const EIP712_RECOVERY_MODULE_TYPE: {
  ExecuteRecovery: {
    type: string;
    name: string;
  }[];
};
//#endregion
//#region src/account/Safe/safeMessage.d.ts
declare const SAFE_MESSAGE_PRIMARY_TYPE = "SafeMessage";
declare const SAFE_MESSAGE_MODULE_TYPE: {
  SafeMessage: {
    type: string;
    name: string;
  }[];
};
type SafeMessageTypedDataDomain = {
  chainId: number;
  verifyingContract: string;
};
type SafeMessageTypedMessageValue = {
  message: string;
};
declare function getSafeMessageEip712Data(accountAddress: string, chainId: bigint, message: string): {
  domain: SafeMessageTypedDataDomain;
  types: Record<string, {
    name: string;
    type: string;
  }[]>;
  messageValue: SafeMessageTypedMessageValue;
};
//#endregion
//#region src/account/Safe/types.d.ts
interface CreateBaseUserOperationOverrides {
  nonce?: bigint;
  callData?: string;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimitPercentageMultiplier?: number;
  verificationGasLimitPercentageMultiplier?: number;
  preVerificationGasPercentageMultiplier?: number;
  maxFeePerGasPercentageMultiplier?: number;
  maxPriorityFeePerGasPercentageMultiplier?: number;
  state_override_set?: StateOverrideSet;
  skipGasEstimation?: boolean;
  dummySignerSignaturePairs?: SignerSignaturePair[];
  webAuthnSharedSigner?: string;
  webAuthnSignerFactory?: string;
  webAuthnSignerSingleton?: string;
  webAuthnSignerProxyCreationCode?: string;
  eip7212WebAuthnPrecompileVerifier?: string;
  eip7212WebAuthnContractVerifier?: string;
  safeModuleExecutorFunctionSelector?: SafeModuleExecutorFunctionSelector;
  multisendContractAddress?: string;
  gasLevel?: GasOption;
  polygonGasStation?: PolygonChain;
  expectedSigners?: Signer[];
  isMultiChainSignature?: boolean;
  parallelPaymasterInitValues?: {
    paymaster: string;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
    paymasterData: string;
  };
}
interface CreateUserOperationV6Overrides extends CreateBaseUserOperationOverrides {
  initCode?: string;
}
interface CreateUserOperationV7Overrides extends CreateBaseUserOperationOverrides {
  factory?: string;
  factoryData?: string;
}
interface CreateUserOperationV9Overrides extends CreateUserOperationV7Overrides {}
interface SafeAccountSingleton {
  singletonAddress: string;
  singletonInitHash: string;
}
interface InitCodeOverrides {
  threshold?: number;
  c2Nonce?: bigint;
  safe4337ModuleAddress?: string;
  safeModuleSetupAddress?: string;
  entrypointAddress?: string;
  safeAccountSingleton?: SafeAccountSingleton;
  safeAccountFactoryAddress?: string;
  multisendContractAddress?: string;
  webAuthnSharedSigner?: string;
  eip7212WebAuthnPrecompileVerifierForSharedSigner?: string;
  eip7212WebAuthnContractVerifierForSharedSigner?: string;
  onChainIdentifierParams?: OnChainIdentifierParamsType;
  onChainIdentifier?: string;
}
interface BaseInitOverrides {
  threshold?: number;
  c2Nonce?: bigint;
  safeAccountSingleton?: SafeAccountSingleton;
  safeAccountFactoryAddress?: string;
  multisendContractAddress?: string;
  webAuthnSharedSigner?: string;
  eip7212WebAuthnPrecompileVerifierForSharedSigner?: string;
  eip7212WebAuthnContractVerifierForSharedSigner?: string;
}
interface WebAuthnSignatureOverrides {
  isInit?: boolean;
  webAuthnSharedSigner?: string;
  eip7212WebAuthnPrecompileVerifier?: string;
  eip7212WebAuthnContractVerifier?: string;
  webAuthnSignerFactory?: string;
  webAuthnSignerSingleton?: string;
  webAuthnSignerProxyCreationCode?: string;
}
interface SafeSignatureOptions {
  validAfter?: bigint;
  validUntil?: bigint;
  isMultiChainSignature?: boolean;
  multiChainMerkleProof?: string;
  safe4337ModuleAddress?: string;
}
declare enum SafeModuleExecutorFunctionSelector {
  executeUserOpWithErrorString = "0x541d63c8",
  executeUserOp = "0x7bb37428"
}
interface SafeUserOperationTypedDataDomain {
  chainId: number;
  verifyingContract: string;
}
interface SafeUserOperationV6TypedMessageValue {
  safe: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  validAfter: bigint;
  validUntil: bigint;
  entryPoint: string;
}
interface SafeUserOperationV7TypedMessageValue {
  safe: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  verificationGasLimit: bigint;
  callGasLimit: bigint;
  preVerificationGas: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  paymasterAndData: string;
  validAfter: bigint;
  validUntil: bigint;
  entryPoint: string;
}
interface SafeUserOperationV9TypedMessageValue extends SafeUserOperationV7TypedMessageValue {}
type ECDSAPublicAddress = string;
interface WebauthnPublicKey {
  x: bigint;
  y: bigint;
}
type Signer = ECDSAPublicAddress | WebauthnPublicKey;
interface WebauthnSignatureData {
  authenticatorData: ArrayBuffer;
  clientDataFields: string;
  rs: [bigint, bigint];
}
interface SignerSignaturePair {
  signer: Signer;
  signature: string;
  isContractSignature?: boolean;
}
declare const EOADummySignerSignaturePair: SignerSignaturePair;
declare const WebauthnDummySignerSignaturePair: SignerSignaturePair;
interface UserOperationToSign {
  chainId: bigint;
  userOperation: UserOperationV9;
  validAfter?: bigint;
  validUntil?: bigint;
}
interface UserOperationToSignWithOverrides extends UserOperationToSign {
  options?: SafeSignatureOptions;
  webAuthnSignatureOverrides?: WebAuthnSignatureOverrides;
}
interface MultiChainSignatureMerkleTreeRootTypedDataDomain {
  verifyingContract: string;
}
interface MultiChainSignatureMerkleTreeRootTypedMessageValue {
  merkleTreeRoot: string;
}
//#endregion
//#region src/account/Safe/SafeAccount.d.ts
declare class SafeAccount extends SmartAccount {
  static readonly DEFAULT_WEB_AUTHN_SHARED_SIGNER: string;
  static readonly DEFAULT_WEB_AUTHN_SIGNER_SINGLETON: string;
  static readonly DEFAULT_WEB_AUTHN_SIGNER_FACTORY: string;
  static readonly DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER: string;
  static readonly DEFAULT_WEB_AUTHN_PRECOMPILE: string;
  static readonly DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE: string;
  static readonly DEFAULT_MULTISEND_CONTRACT_ADDRESS = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526";
  static readonly initializerFunctionSelector: string;
  static readonly initializerFunctionInputAbi: string[];
  static readonly DEFAULT_EXECUTOR_FUCNTION_SELECTOR = SafeModuleExecutorFunctionSelector.executeUserOpWithErrorString;
  static readonly executorFunctionInputAbi: string[];
  protected isInitWebAuthn: boolean;
  protected x: bigint | null;
  protected y: bigint | null;
  readonly safeAccountSingleton: SafeAccountSingleton;
  readonly entrypointAddress: string;
  readonly safe4337ModuleAddress: string;
  protected factoryAddress: string | null;
  protected factoryData: string | null;
  readonly onChainIdentifier: string | null;
  constructor(accountAddress: string, safe4337ModuleAddress: string, entrypointAddress: string, overrides?: {
    onChainIdentifierParams?: OnChainIdentifierParamsType;
    onChainIdentifier?: string;
    safeAccountSingleton?: SafeAccountSingleton;
  });
  static createProxyAddress(initializerCallData: string, overrides?: {
    c2Nonce?: bigint;
    safeFactoryAddress?: string;
    singletonInitHash?: string;
  }): string;
  static isDeployed(accountAddress: string, nodeRpcUrl: string | Transport | JsonRpcNode): Promise<boolean>;
  static createAccountCallDataSingleTransaction(metaTransaction: MetaTransaction, overrides?: {
    safeModuleExecutorFunctionSelector?: SafeModuleExecutorFunctionSelector;
  }): string;
  static createAccountCallDataBatchTransactions(metaTransactions: MetaTransaction[], overrides?: {
    safeModuleExecutorFunctionSelector?: SafeModuleExecutorFunctionSelector;
    multisendContractAddress?: string;
  }): string;
  static createAccountCallData(to: string, value: bigint, data: string, operation: Operation, overrides?: {
    safeModuleExecutorFunctionSelector?: SafeModuleExecutorFunctionSelector;
  }): string;
  static decodeAccountCallData(callData: string): [MetaTransaction, SafeModuleExecutorFunctionSelector];
  static prependTokenPaymasterApproveToCallDataStatic(callData: string, tokenAddress: string, paymasterAddress: string, approveAmount: bigint, overrides?: {
    multisendContractAddress?: string;
  }): string;
  static formatEip712SignaturesToUseroperationSignature(signersAddresses: string[], signatures: string[], overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    isMultiChainSignature?: boolean;
    merkleProof?: string;
  }): string;
  getUserOperationEip712Data(useroperation: UserOperationV6 | UserOperationV7 | UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV6TypedMessageValue | SafeUserOperationV7TypedMessageValue | SafeUserOperationV9TypedMessageValue;
  };
  getUserOperationEip712Hash(useroperation: UserOperationV6 | UserOperationV7 | UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  formatUserOperationSignature(signerSignaturePairs: SignerSignaturePair[], options?: SafeSignatureOptions & WebAuthnSignatureOverrides): string;
  protected static getUserOperationEip712Hash(useroperation: UserOperationV6 | UserOperationV7 | UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  protected static getUserOperationEip712Data(useroperation: UserOperationV6 | UserOperationV7 | UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV6TypedMessageValue | SafeUserOperationV7TypedMessageValue | SafeUserOperationV9TypedMessageValue;
  };
  static getUserOperationEip712Data_V6(useroperation: UserOperationV6, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV6TypedMessageValue;
  };
  static getUserOperationEip712Hash_V6(useroperation: UserOperationV6, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  private static baseGetUserOperationEip712DataV7V8V9;
  static getUserOperationEip712Data_V7(useroperation: UserOperationV7, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV6TypedMessageValue;
  };
  static getUserOperationEip712Hash_V7(useroperation: UserOperationV7, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  static getUserOperationEip712Data_V9(useroperation: UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV9TypedMessageValue;
  };
  static getUserOperationEip712Hash_V9(useroperation: UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  static formatEip712SingleSignatureToUseroperationSignature(signature: string, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    isMultiChainSignature?: boolean;
  }): string;
  sendUserOperation(userOperation: UserOperationV6 | UserOperationV7 | UserOperationV9, bundlerRpc: string | Transport | Bundler): Promise<SendUseroperationResponse>;
  protected static createAccountAddressAndFactoryAddressAndData(owners: Signer[], overrides: BaseInitOverrides, safe4337ModuleAddress: string, safeModuleSetupAddress: string): [string, string, string];
  protected static createBaseInitializerCallData(owners: Signer[], threshold: number, safe4337ModuleAddress: string, safeModuleSetupAddress: string, multisendContractAddress?: string, webAuthnSharedSigner?: string, eip7212WebAuthnPrecompileVerifierForSharedSigner?: string, eip7212WebAuthnContractVerifierForSharedSigner?: string): string;
  protected static createFactoryAddressAndData(owners: Signer[], overrides: BaseInitOverrides | undefined, safe4337ModuleAddress: string, safeModuleSetupAddress: string): [string, string];
  prependTokenPaymasterApproveToCallData(callData: string, tokenAddress: string, paymasterAddress: string, approveAmount: bigint, overrides?: {
    multisendContractAddress?: string;
  }): string;
  baseEstimateUserOperationGas(userOperation: UserOperationV6 | UserOperationV7, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignerSignaturePairs?: SignerSignaturePair[];
    expectedSigners?: Signer[];
    webAuthnSharedSigner?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    isMultiChainSignature?: boolean;
  }): Promise<[bigint, bigint, bigint]>;
  protected createBaseUserOperationAndFactoryAddressAndFactoryData(transactions: MetaTransaction[], isV06: boolean, providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateBaseUserOperationOverrides): Promise<[BaseUserOperation, string | null, string | null]>;
  protected static baseSignSingleUserOperation(useroperation: UserOperationV6 | UserOperationV7, privateKeys: string[], chainId: bigint, entrypointAddress: string, safe4337ModuleAddress: string, options?: SafeSignatureOptions): string;
  static readonly ACCEPTED_SIGNING_SCHEMES: readonly SigningScheme[];
  protected static baseSignUserOperationWithSigners<T extends UserOperationV6 | UserOperationV7 | UserOperationV9, C>(useroperation: T, signers: ReadonlyArray<ExternalSigner<C>>, chainId: bigint, params: {
    entrypointAddress: string;
    safe4337ModuleAddress: string;
    context: C;
    options?: SafeSignatureOptions;
  }): Promise<string>;
  static createWebAuthnSignerVerifierAddress(x: bigint, y: bigint, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
  }): string;
  static formatSignaturesToUseroperationSignature(signerSignaturePairs: SignerSignaturePair[], options?: SafeSignatureOptions & WebAuthnSignatureOverrides): string;
  static getSignerLowerCaseAddress(signer: Signer, overrides?: WebAuthnSignatureOverrides): string;
  static sortSignatures(signerSignaturePairs: SignerSignaturePair[], overrides?: WebAuthnSignatureOverrides): void;
  static buildSignaturesFromSingerSignaturePairs(signerSignaturePairs: SignerSignaturePair[], webAuthnSignatureOverrides?: WebAuthnSignatureOverrides): string;
  static createWebAuthnSignature(signatureData: WebauthnSignatureData): string;
  createSwapOwnerMetaTransactions(nodeRpcUrl: string | Transport | JsonRpcNode, newOwner: Signer, oldOwner: Signer, overrides?: {
    prevOwner?: string;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
  }): Promise<MetaTransaction[]>;
  createRemoveOwnerMetaTransaction(nodeRpcUrl: string | Transport | JsonRpcNode, ownerToDelete: Signer, threshold: number, overrides?: {
    prevOwner?: string;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
  }): Promise<MetaTransaction>;
  createAddOwnerWithThresholdMetaTransactions(newOwner: Signer, threshold: number, overrides?: {
    nodeRpcUrl?: string | Transport | JsonRpcNode;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
  }): Promise<MetaTransaction[]>;
  createStandardAddOwnerWithThresholdMetaTransaction(newOwner: string, threshold: number): MetaTransaction;
  createStandardSwapOwnerMetaTransaction(newOwner: string, oldOwner: string, prevOwner: string): MetaTransaction;
  createStandardRemoveOwnerMetaTransaction(ownerToDelete: string, threshold: number, prevOwner: string): MetaTransaction;
  createChangeThresholdMetaTransaction(threshold: number): MetaTransaction;
  createApproveHashMetaTransaction(hashToApprove: string): MetaTransaction;
  static createDeployWebAuthnVerifierMetaTransaction(x: bigint, y: bigint, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
  }): MetaTransaction;
  getOwners(nodeRpcUrl: string | Transport | JsonRpcNode): Promise<string[]>;
  getThreshold(nodeRpcUrl: string | Transport | JsonRpcNode): Promise<number>;
  getModules(nodeRpcUrl: string | Transport | JsonRpcNode, overrides?: {
    start?: string;
    pageSize?: bigint;
  }): Promise<[string[], string]>;
  isModuleEnabled(nodeRpcUrl: string | Transport | JsonRpcNode, moduleAddress: string): Promise<boolean>;
  getFallbackHandler(nodeRpcUrl: string | Transport | JsonRpcNode): Promise<string>;
  getSafeVersion(nodeRpcUrl: string | Transport | JsonRpcNode): Promise<string>;
  static createDummySignerSignaturePairForExpectedSigners(expectedSigners: Signer[], webAuthnSignatureOverrides?: WebAuthnSignatureOverrides): SignerSignaturePair[];
  static verifyWebAuthnSignatureForMessageHash(nodeRpcUrl: string | Transport | JsonRpcNode, signer: WebauthnPublicKey, messageHash: string, signature: string, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerSingleton?: string;
  }): Promise<boolean>;
  private static createSafeWebAuthnSignerProxyDeployedByteCode;
  static createEnableModuleMetaTransaction(moduleAddress: string, accountAddress: string): MetaTransaction;
  createDisableModuleMetaTransaction(nodeRpcUrl: string | Transport | JsonRpcNode, moduleToDisableAddress: string, accountAddress: string, overrides?: {
    prevModuleAddress?: string;
    modulesStart?: string;
    modulesPageSize?: bigint;
  }): Promise<MetaTransaction>;
  static createStandardDisableModuleMetaTransaction(moduleAddress: string, prevModuleAddress: string, accountAddress: string): MetaTransaction;
  protected createModuleMigrationMetaTransactions(nodeRpcUrl: string | Transport | JsonRpcNode, oldModuleAddress: string, newModuleAddress: string, overrides?: {
    prevModuleAddress?: string;
    modulesStart?: string;
    modulesPageSize?: bigint;
    skipPreflight?: boolean;
  }): Promise<MetaTransaction[]>;
  private static readonly MIN_SAFE_4337_VERSION;
  private assertMigratableFromModule;
  private static isVersionAtLeast;
  simulateCallDataWithTenderlyAndCreateShareLink(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, nodeRpcUrl: (string | Transport | JsonRpcNode | null) | undefined, chainId: bigint, metaTransactions: MetaTransaction[], blockNumber?: number | null, overrides?: {
    safeModuleExecutorFunctionSelector?: SafeModuleExecutorFunctionSelector;
    multisendContractAddress?: string;
    callData?: string;
    createShareLink?: boolean;
    isInit?: boolean;
  }): Promise<{
    simulation: TenderlySimulationResult;
    callDataSimulationShareLink?: string;
    accountDeploymentSimulationShareLink?: string;
  }>;
  getSafeMessageEip712Data(chainId: bigint, message: string): {
    domain: SafeMessageTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeMessageTypedMessageValue;
  };
}
//#endregion
//#region src/account/Safe/SafeAccountV0_2_0.d.ts
declare class SafeAccountV0_2_0 extends SafeAccount {
  static readonly DEFAULT_ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  static readonly DEFAULT_SAFE_4337_MODULE_ADDRESS = "0xa581c4A4DB7175302464fF3C06380BC3270b4037";
  static readonly DEFAULT_SAFE_MODULE_SETUP_ADDRESS = "0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb";
  constructor(accountAddress: string, overrides?: {
    safe4337ModuleAddress?: string;
    entrypointAddress?: string;
    onChainIdentifierParams?: OnChainIdentifierParamsType;
    onChainIdentifier?: string;
  });
  static createAccountAddress(owners: Signer[], overrides?: {
    threshold?: number;
    c2Nonce?: bigint;
    safe4337ModuleAddress?: string;
    safeModuleSetupAddress?: string;
    safeAccountSingleton?: SafeAccountSingleton;
    safeAccountFactoryAddress?: string;
    multisendContractAddress?: string;
    webAuthnSharedSigner?: string;
    eip7212WebAuthnPrecompileVerifierForSharedSigner?: string;
    eip7212WebAuthnContractVerifierForSharedSigner?: string;
  }): string;
  static initializeNewAccount(owners: Signer[], overrides?: InitCodeOverrides): SafeAccountV0_2_0;
  static getUserOperationEip712Hash(useroperation: UserOperationV6, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  static getUserOperationEip712Data(useroperation: UserOperationV6, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV6TypedMessageValue;
  };
  static createAccountAddressAndInitCode(owners: Signer[], overrides?: InitCodeOverrides): [string, string];
  static createInitializerCallData(owners: Signer[], threshold: number, overrides?: {
    safe4337ModuleAddress?: string;
    safeModuleSetupAddress?: string;
    multisendContractAddress?: string;
    webAuthnSharedSigner?: string;
    eip7212WebAuthnPrecompileVerifierForSharedSigner?: string;
    eip7212WebAuthnContractVerifierForSharedSigner?: string;
  }): string;
  static createInitCode(owners: Signer[], overrides?: InitCodeOverrides): string;
  createUserOperation(transactions: MetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateUserOperationV6Overrides): Promise<UserOperationV6>;
  createMigrateToSafeAccountV0_3_0MetaTransactions(nodeRpcUrl: string | Transport | JsonRpcNode, overrides?: {
    safeV06ModuleAddress?: string;
    safeV07ModuleAddress?: string;
    prevModuleAddress?: string;
    pageSize?: bigint;
    modulesStart?: string;
    skipPreflight?: boolean;
  }): Promise<MetaTransaction[]>;
  estimateUserOperationGas(userOperation: UserOperationV6, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignerSignaturePairs?: SignerSignaturePair[];
    expectedSigners?: Signer[];
    webAuthnSharedSigner?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
  }): Promise<[bigint, bigint, bigint]>;
  signUserOperation(useroperation: UserOperationV6, privateKeys: string[], chainId: bigint, options?: SafeSignatureOptions): string;
  signUserOperationWithSigners(useroperation: UserOperationV6, signers: ReadonlyArray<ExternalSigner>, chainId: bigint, options?: SafeSignatureOptions): Promise<string>;
}
//#endregion
//#region src/account/Safe/SafeAccountV0_3_0.d.ts
declare class SafeAccountV0_3_0 extends SafeAccount {
  static readonly DEFAULT_ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  static readonly DEFAULT_SAFE_4337_MODULE_ADDRESS = "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226";
  static readonly DEFAULT_SAFE_MODULE_SETUP_ADDRESS = "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47";
  constructor(accountAddress: string, overrides?: {
    safe4337ModuleAddress?: string;
    entrypointAddress?: string;
    onChainIdentifierParams?: OnChainIdentifierParamsType;
    onChainIdentifier?: string;
    safeAccountSingleton?: SafeAccountSingleton;
  });
  static createAccountAddress(owners: Signer[], overrides?: InitCodeOverrides): string;
  static initializeNewAccount<T extends typeof SafeAccountV0_3_0>(this: T, owners: Signer[], overrides?: InitCodeOverrides): InstanceType<T>;
  static getUserOperationEip712Hash(useroperation: UserOperationV7, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  static getUserOperationEip712Data(useroperation: UserOperationV7, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV7TypedMessageValue;
  };
  static createInitializerCallData(owners: Signer[], threshold: number, overrides?: {
    safe4337ModuleAddress?: string;
    safeModuleSetupAddress?: string;
    multisendContractAddress?: string;
    webAuthnSharedSigner?: string;
    eip7212WebAuthnPrecompileVerifierForSharedSigner?: string;
    eip7212WebAuthnContractVerifierForSharedSigner?: string;
  }): string;
  static createFactoryAddressAndData(owners: Signer[], overrides?: InitCodeOverrides): [string, string];
  createUserOperation(transactions: MetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateUserOperationV7Overrides): Promise<UserOperationV7>;
  estimateUserOperationGas(userOperation: UserOperationV7, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignerSignaturePairs?: SignerSignaturePair[];
    expectedSigners?: Signer[];
    webAuthnSharedSigner?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
  }): Promise<[bigint, bigint, bigint]>;
  signUserOperation(useroperation: UserOperationV7, privateKeys: string[], chainId: bigint, options?: SafeSignatureOptions): string;
  signUserOperationWithSigners(useroperation: UserOperationV7, signers: ReadonlyArray<ExternalSigner>, chainId: bigint, options?: SafeSignatureOptions): Promise<string>;
  createMigrateToSafeMultiChainSigAccountV1MetaTransactions(nodeRpcUrl: string | Transport | JsonRpcNode, overrides?: {
    safeV07ModuleAddress?: string;
    safeV09ModuleAddress?: string;
    prevModuleAddress?: string;
    modulesStart?: string;
    modulesPageSize?: bigint;
    skipPreflight?: boolean;
  }): Promise<MetaTransaction[]>;
}
//#endregion
//#region src/account/Safe/SafeAccountV1_5_0_M_0_3_0.d.ts
declare class SafeAccountV1_5_0_M_0_3_0 extends SafeAccountV0_3_0 {
  static readonly DEFAULT_WEB_AUTHN_PRECOMPILE: string;
  static readonly DEFAULT_WEB_AUTHN_DAIMO_VERIFIER: string;
  static readonly DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER: string;
  constructor(accountAddress: string, overrides?: {
    safe4337ModuleAddress?: string;
    entrypointAddress?: string;
    onChainIdentifierParams?: OnChainIdentifierParamsType;
    onChainIdentifier?: string;
    safeAccountSingleton?: SafeAccountSingleton;
  });
  static createProxyAddress(initializerCallData: string, overrides?: {
    c2Nonce?: bigint;
    safeFactoryAddress?: string;
    singletonInitHash?: string;
  }): string;
  static initializeNewAccount<T extends typeof SafeAccountV0_3_0>(this: T, owners: Signer[], overrides?: InitCodeOverrides): InstanceType<T>;
  static createAccountAddress(owners: Signer[], overrides?: InitCodeOverrides): string;
  static createFactoryAddressAndData(owners: Signer[], overrides?: InitCodeOverrides): [string, string];
  createUserOperation(transactions: MetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateUserOperationV7Overrides): Promise<UserOperationV7>;
  estimateUserOperationGas(userOperation: UserOperationV7, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignerSignaturePairs?: SignerSignaturePair[];
    expectedSigners?: Signer[];
    webAuthnSharedSigner?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
  }): Promise<[bigint, bigint, bigint]>;
  static createWebAuthnSignerVerifierAddress(x: bigint, y: bigint, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
  }): string;
  static createDeployWebAuthnVerifierMetaTransaction(x: bigint, y: bigint, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
  }): MetaTransaction;
  static createDummySignerSignaturePairForExpectedSigners(expectedSigners: Signer[], webAuthnSignatureOverrides?: WebAuthnSignatureOverrides): SignerSignaturePair[];
  static verifyWebAuthnSignatureForMessageHash(nodeRpcUrl: string | Transport | JsonRpcNode, signer: WebauthnPublicKey, messageHash: string, signature: string, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerSingleton?: string;
  }): Promise<boolean>;
}
//#endregion
//#region src/account/Safe/SafeMultiChainSigAccount.d.ts
declare class SafeMultiChainSigAccountV1 extends SafeAccount {
  static readonly DEFAULT_ENTRYPOINT_ADDRESS = "0x433709009B8330FDa32311DF1C2AFA402eD8D009";
  static readonly DEFAULT_SAFE_4337_MODULE_ADDRESS = "0x22939E839e3c0F479B713eAF95e0df128554AEAd";
  static readonly DEFAULT_SAFE_MODULE_SETUP_ADDRESS = "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47";
  static readonly DEFAULT_WEB_AUTHN_SHARED_SIGNER: string;
  static readonly DEFAULT_WEB_AUTHN_SIGNER_SINGLETON: string;
  static readonly DEFAULT_WEB_AUTHN_SIGNER_FACTORY: string;
  static readonly DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE = "0x610100346100ad57601f6101b538819003918201601f19168301916001600160401b038311848410176100b2578084926080946040528339810103126100ad578051906001600160a01b03821682036100ad5760208101516040820151606090920151926001600160b01b03841684036100ad5760805260a05260c05260e05260405160ec90816100c98239608051816082015260a05181604d015260c051816027015260e0518160010152f35b600080fd5b634e487b7160e01b600052604160045260246000fdfe7f000000000000000000000000000000000000000000000000000000000000000060b63601527f000000000000000000000000000000000000000000000000000000000000000060a03601527f000000000000000000000000000000000000000000000000000000000000000036608001523660006080376000806056360160807f00000000000000000000000000000000000000000000000000000000000000005af43d600060803e60b1573d6080fd5b3d6080f3fea26469706673582212201660515548d15702d720bbc046b457ca85e941a4559ab9f9518488e4c82e5ee964736f6c634300081a0033";
  static readonly DEFAULT_WEB_AUTHN_PRECOMPILE: string;
  static readonly DEFAULT_WEB_AUTHN_DAIMO_VERIFIER: string;
  static readonly DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER: string;
  constructor(accountAddress: string, overrides?: {
    safe4337ModuleAddress?: string;
    entrypointAddress?: string;
    onChainIdentifierParams?: OnChainIdentifierParamsType;
    onChainIdentifier?: string;
    safeAccountSingleton?: SafeAccountSingleton;
  });
  static createAccountAddress(owners: Signer[], overrides?: InitCodeOverrides): string;
  static initializeNewAccount(owners: Signer[], overrides?: InitCodeOverrides): SafeMultiChainSigAccountV1;
  static getUserOperationEip712Hash(useroperation: UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  static getUserOperationEip712Data(useroperation: UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV9TypedMessageValue;
  };
  static createInitializerCallData(owners: Signer[], threshold: number, overrides?: {
    safe4337ModuleAddress?: string;
    safeModuleSetupAddress?: string;
    multisendContractAddress?: string;
    webAuthnSharedSigner?: string;
    eip7212WebAuthnPrecompileVerifierForSharedSigner?: string;
    eip7212WebAuthnContractVerifierForSharedSigner?: string;
  }): string;
  static createFactoryAddressAndData(owners: Signer[], overrides?: InitCodeOverrides): [string, string];
  createUserOperation(transactions: MetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateUserOperationV9Overrides): Promise<UserOperationV9>;
  estimateUserOperationGas(userOperation: UserOperationV9, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignerSignaturePairs?: SignerSignaturePair[];
    expectedSigners?: Signer[];
    webAuthnSharedSigner?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
  }): Promise<[bigint, bigint, bigint]>;
  getUserOperationEip712Data(useroperation: UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): {
    domain: SafeUserOperationTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: SafeUserOperationV9TypedMessageValue;
  };
  getUserOperationEip712Hash(useroperation: UserOperationV9, chainId: bigint, overrides?: {
    validAfter?: bigint;
    validUntil?: bigint;
    entrypointAddress?: string;
    safe4337ModuleAddress?: string;
  }): string;
  formatUserOperationSignature(signerSignaturePairs: SignerSignaturePair[], options?: SafeSignatureOptions & WebAuthnSignatureOverrides): string;
  signUserOperation(userOperation: UserOperationV9, privateKeys: string[], chainId: bigint, options?: SafeSignatureOptions): string;
  signUserOperationWithSigners(userOperation: UserOperationV9, signers: ReadonlyArray<ExternalSigner>, chainId: bigint, options?: SafeSignatureOptions): Promise<string>;
  signUserOperations(userOperationsToSign: UserOperationToSign[], privateKeys: string[]): string[];
  signUserOperationsWithSigners(userOperationsToSign: UserOperationToSign[], signers: ReadonlyArray<ExternalSigner<MultiOpSignContext<UserOperationV9>>>): Promise<string[]>;
  static getMultiChainSingleSignatureUserOperationsEip712Hash(userOperationsToSignsToSign: UserOperationToSign[], overrides?: {
    safe4337ModuleAddress?: string;
    entrypointAddress?: string;
  }): string;
  static getMultiChainSingleSignatureUserOperationsEip712Data(userOperationsToSign: UserOperationToSign[], overrides?: {
    safe4337ModuleAddress?: string;
    entrypointAddress?: string;
  }): {
    domain: MultiChainSignatureMerkleTreeRootTypedDataDomain;
    types: Record<string, {
      name: string;
      type: string;
    }[]>;
    messageValue: MultiChainSignatureMerkleTreeRootTypedMessageValue;
  };
  private static formatSingleUserOperationSignature;
  static formatSignaturesToUseroperationsSignatures(userOperationsToSign: UserOperationToSignWithOverrides[], signerSignaturePairs: SignerSignaturePair[]): string[];
  static createWebAuthnSignerVerifierAddress(x: bigint, y: bigint, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
    webAuthnSignerSingleton?: string;
    webAuthnSignerProxyCreationCode?: string;
  }): string;
  static createDeployWebAuthnVerifierMetaTransaction(x: bigint, y: bigint, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerFactory?: string;
  }): MetaTransaction;
  static createDummySignerSignaturePairForExpectedSigners(expectedSigners: Signer[], webAuthnSignatureOverrides?: WebAuthnSignatureOverrides): SignerSignaturePair[];
  static verifyWebAuthnSignatureForMessageHash(nodeRpcUrl: string | Transport | JsonRpcNode, signer: WebauthnPublicKey, messageHash: string, signature: string, overrides?: {
    eip7212WebAuthnPrecompileVerifier?: string;
    eip7212WebAuthnContractVerifier?: string;
    webAuthnSignerSingleton?: string;
  }): Promise<boolean>;
}
//#endregion
//#region src/account/simple/Simple7702AccountV09.d.ts
declare class Simple7702AccountV09 extends BaseSimple7702Account {
  static readonly DEFAULT_DELEGATEE_ADDRESS = "0xa46cc63eBF4Bd77888AA327837d20b23A63a56B5";
  static getUserOperationEip712Data(userOperation: UserOperationV9, chainId: bigint, overrides?: {
    entrypointAddress?: string;
  }): TypedData;
  static getUserOperationEip712Hash(userOperation: UserOperationV9, chainId: bigint, overrides?: {
    entrypointAddress?: string;
  }): string;
  constructor(accountAddress: string, overrides?: {
    entrypointAddress?: string;
    delegateeAddress?: string;
  });
  createUserOperation(transactions: SimpleMetaTransaction[], providerRpc?: string | Transport | JsonRpcNode, bundlerRpc?: string | Transport | Bundler, overrides?: CreateUserOperationOverrides): Promise<UserOperationV9>;
  estimateUserOperationGas(userOperation: UserOperationV9, bundlerRpc: string | Transport | Bundler, overrides?: {
    stateOverrideSet?: StateOverrideSet;
    dummySignature?: string;
  }): Promise<[bigint, bigint, bigint]>;
  signUserOperation(useroperation: UserOperationV9, privateKey: string, chainId: bigint): string;
  signUserOperationWithSigner(useroperation: UserOperationV9, signer: ExternalSigner, chainId: bigint): Promise<string>;
  sendUserOperation(userOperation: UserOperationV9, bundlerRpc: string | Transport | Bundler): Promise<SendUseroperationResponse>;
}
//#endregion
//#region src/constants.d.ts
declare const ZeroAddress = "0x0000000000000000000000000000000000000000";
declare const ENTRYPOINT_V9 = "0x433709009B8330FDa32311DF1C2AFA402eD8D009";
declare const ENTRYPOINT_V8 = "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108";
declare const ENTRYPOINT_V7 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
declare const ENTRYPOINT_V6 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
declare const SAFE_FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";
declare const BaseUserOperationDummyValues: {
  sender: string;
  nonce: bigint;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  signature: string;
};
declare const EIP712_SAFE_OPERATION_PRIMARY_TYPE = "SafeOp";
declare const EIP712_SAFE_OPERATION_V6_TYPE: {
  SafeOp: {
    type: string;
    name: string;
  }[];
};
declare const EIP712_SAFE_OPERATION_V7_TYPE: {
  SafeOp: {
    type: string;
    name: string;
  }[];
};
declare const EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE = "MerkleTreeRoot";
declare const EIP712_MULTI_CHAIN_OPERATIONS_TYPE: {
  MerkleTreeRoot: {
    type: string;
    name: string;
  }[];
};
declare const DEFAULT_SECP256R1_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000100";
declare const CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS = "0x000000009B1D0aF20D8C6d0A44e162d11F9b8f00";
//#endregion
//#region src/errors.d.ts
type BasicErrorCode = "UNKNOWN_ERROR" | "TIMEOUT" | "BAD_DATA" | "BUNDLER_ERROR" | "PAYMASTER_ERROR" | "NODE_ERROR";
type BundlerErrorCode = "INVALID_FIELDS" | "SIMULATE_VALIDATION" | "SIMULATE_PAYMASTER_VALIDATION" | "OPCODE_VALIDATION" | "EXPIRE_SHORTLY" | "REPUTATION" | "INSUFFICIENT_STAKE" | "UNSUPPORTED_SIGNATURE_AGGREGATOR" | "INVALID_SIGNATURE" | "PAYMASTER_DEPOSIT_TOO_LOW" | "EXECUTION_REVERTED";
type JsonRpcErrorCode = "PARSE_ERROR" | "INVALID_REQUEST" | "METHOD_NOT_FOUND" | "INVALID_PARAMS" | "INTERNAL_ERROR" | "SERVER_ERROR" | "TENDERLY_SIMULATION_ERROR" | "TENDERLY_HTTP_ERROR" | "TENDERLY_INVALID_JSON" | "TENDERLY_NETWORK_ERROR";
type Jsonable = string | number | boolean | null | undefined | readonly Jsonable[] | {
  readonly [key: string]: Jsonable;
} | {
  toJSON(): Jsonable;
};
declare class AbstractionKitError extends Error {
  readonly code: BundlerErrorCode | BasicErrorCode | JsonRpcErrorCode;
  readonly context?: Jsonable;
  readonly errno?: number;
  readonly aaCode?: string;
  constructor(code: BundlerErrorCode | BasicErrorCode | JsonRpcErrorCode, message: string, options?: {
    cause?: Error;
    errno?: number;
    context?: Jsonable;
    aaCode?: string;
  });
  stringify(): string;
}
declare function parseAaCode(message: string): string | undefined;
//#endregion
//#region src/factory/SmartAccountFactory.d.ts
declare class SmartAccountFactory {
  readonly address: string;
  readonly generatorFunctionSelector: string;
  readonly generatorFunctionInputAbi: string[];
  constructor(address: string, generatorFunctionSelector: string, generatorFunctionInputAbi: string[]);
  getFactoryGeneratorFunctionCallData(generatorFunctionInputParameters: AbiInputValue[]): string;
}
//#endregion
//#region src/factory/SafeAccountFactory.d.ts
declare class SafeAccountFactory extends SmartAccountFactory {
  static readonly DEFAULT_FACTORY_ADDRESS = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
  constructor(address?: string);
}
//#endregion
//#region src/paymaster/Paymaster.d.ts
declare abstract class Paymaster {}
//#endregion
//#region src/paymaster/AllowAllPaymaster.d.ts
declare class ExperimentalAllowAllParallelPaymaster extends Paymaster {
  readonly address: string;
  constructor(address?: string);
  getPaymasterFieldsInitValues(_chainId: bigint): Promise<ParallelPaymasterInitValues>;
  getApprovedPaymasterData(_userOperation: UserOperationV9): Promise<string>;
}
//#endregion
//#region src/paymaster/decodeTokenQuote.d.ts
type TokenPaymasterProvider = "candide" | "pimlico";
type KnownTokenPaymaster = {
  provider: TokenPaymasterProvider;
  hasTrustedBundlersFlag?: boolean;
};
type DecodedTokenQuote = {
  provider: TokenPaymasterProvider;
  paymaster: string;
  token: string;
  exchangeRate: bigint;
  maxTokenCost: bigint;
  validUntil: number;
  validAfter?: number;
};
type DecodeTokenQuoteOverrides = {
  paymasterAddresses?: Record<string, KnownTokenPaymaster>;
};
//#endregion
//#region src/paymaster/CandidePaymaster.d.ts
declare class CandidePaymaster extends Paymaster implements Transport {
  readonly transport: Transport;
  private readonly outbound;
  private entrypointData;
  private initPromises;
  private chainId;
  private chainIdPromise;
  constructor(rpc: string | Transport);
  static from(input: string | Transport | CandidePaymaster): CandidePaymaster;
  static decodeTokenQuote(userOperation: AnyUserOperation, nodeRpcUrl: string | Transport | JsonRpcNode, overrides?: DecodeTokenQuoteOverrides): Promise<DecodedTokenQuote | null>;
  request<T = unknown>(args: RequestArgs, options?: RequestOptions): Promise<T>;
  private static extractChainIdFromUrl;
  private getChainId;
  private fetchChainId;
  private resolveEntrypoint;
  private getEntrypointData;
  private static mapTokens;
  private static mapTokensWithExchangeRate;
  private static normalizePaymasterMetadata;
  private ensureInitialized;
  private doInitialize;
  private fetchAndTransformTokenData;
  private fetchSupportedTokensRpc;
  getSupportedEntrypoints(): Promise<string[]>;
  getPaymasterMetaData(entrypoint: string): Promise<PaymasterMetadata | null>;
  isSupportedERC20Token(erc20TokenAddress: string, entrypoint?: string): Promise<boolean>;
  getSupportedERC20TokenData(erc20TokenAddress: string, entrypoint?: string): Promise<ERC20Token | null>;
  private setDummyPaymasterFields;
  private estimateAndApplyGasLimits;
  private applyPaymasterResult;
  private createPaymasterUserOperation;
  createSponsorPaymasterUserOperation<T extends AnyUserOperation>(smartAccount: SmartAccountWithEntrypoint, userOperation: T, bundlerRpc: string | Transport | Bundler, sponsorshipPolicyId?: string, context?: CandidePaymasterContext, overrides?: GasPaymasterUserOperationOverrides): Promise<{
    userOperation: SameUserOp<T>;
    sponsorMetadata?: SponsorMetadata;
  }>;
  createTokenPaymasterUserOperation<T extends AnyUserOperation>(smartAccount: PrependTokenPaymasterApproveAccount, userOperation: T, tokenAddress: string, bundlerRpc: string | Transport | Bundler, context?: CandidePaymasterContext, overrides?: GasPaymasterUserOperationOverrides): Promise<{
    userOperation: SameUserOp<T>;
    tokenQuote?: TokenQuote;
  }>;
  calculateUserOperationErc20TokenMaxGasCost(smartAccount: SmartAccountWithEntrypoint, userOperation: AnyUserOperation, erc20TokenAddress: string, overrides?: {
    entrypoint?: string | null;
  }): Promise<bigint>;
  fetchTokenPaymasterExchangeRate(erc20TokenAddress: string, entrypoint?: string): Promise<bigint>;
  fetchSupportedERC20TokensAndPaymasterMetadata(entrypoint?: string): Promise<SupportedERC20TokensAndMetadataWithExchangeRate>;
}
//#endregion
//#region src/paymaster/Erc7677Paymaster.d.ts
type Erc7677Context = Record<string, unknown>;
interface Erc7677PaymasterFields {
  paymaster?: string;
  paymasterData?: string;
  paymasterVerificationGasLimit?: bigint | string;
  paymasterPostOpGasLimit?: bigint | string;
  paymasterAndData?: string;
}
interface Erc7677StubDataResult extends Erc7677PaymasterFields {
  isFinal?: boolean;
  [key: string]: unknown;
}
declare class Erc7677Paymaster extends Paymaster implements Transport {
  readonly transport: Transport;
  private readonly outbound;
  private chainId;
  readonly provider: Erc7677Provider;
  private candideCache;
  static detectProvider(rpcUrl: string): Erc7677Provider;
  constructor(rpc: string | Transport, options?: Erc7677PaymasterConstructorOptions);
  static from(input: string | Transport | Erc7677Paymaster, options?: Erc7677PaymasterConstructorOptions): Erc7677Paymaster;
  static decodeTokenQuote(userOperation: AnyUserOperation, nodeRpcUrl: string | Transport | JsonRpcNode, overrides?: DecodeTokenQuoteOverrides): Promise<DecodedTokenQuote | null>;
  request<T = unknown>(args: RequestArgs, options?: RequestOptions): Promise<T>;
  private getChainId;
  private resolveEntrypoint;
  getPaymasterStubData(userOperation: AnyUserOperation, entrypoint: string, chainIdHex: string, context?: Erc7677Context): Promise<Erc7677StubDataResult>;
  getPaymasterData(userOperation: AnyUserOperation, entrypoint: string, chainIdHex: string, context?: Erc7677Context): Promise<Erc7677PaymasterFields>;
  sendRPCRequest(method: string, params?: unknown[]): Promise<unknown>;
  createPaymasterUserOperation<T extends AnyUserOperation>(smartAccount: SmartAccountWithEntrypoint, userOperation: T, bundlerRpc: string | Transport | Bundler, context?: Erc7677Context, overrides?: GasPaymasterUserOperationOverrides): Promise<{
    userOperation: SameUserOp<T>;
    tokenQuote?: TokenQuote;
  }>;
  private applyPaymasterFields;
  private estimateAndApplyGasLimits;
  private fetchPimlicoTokenQuote;
  private fetchCandideSupportedTokens;
  private fetchCandideTokenQuote;
  private candideStubFromMetadata;
  private getStubData;
  private fetchProviderTokenQuote;
  private tokenPaymasterFlow;
  private sponsoredFlow;
}
//#endregion
//#region src/paymaster/WorldIdPermissionlessPaymaster.d.ts
declare class WorldIdPermissionlessPaymaster extends Paymaster {
  readonly address: string;
  constructor(address: string);
  createPaymasterUserOperation(userOperation: UserOperationV8, bundlerRpc: string | Transport | Bundler, nullifierHash: bigint, root: bigint, proof: string, overrides?: {
    entrypoint?: string;
    state_override_set?: StateOverrideSet;
  }): Promise<UserOperationV8>;
  createPaymasterUserOperation(userOperation: UserOperationV7, bundlerRpc: string | Transport | Bundler, nullifierHash: bigint, root: bigint, proof: string, overrides?: {
    entrypoint?: string;
    state_override_set?: StateOverrideSet;
  }): Promise<UserOperationV7>;
}
declare function createWorldIdSignal(accountAddress: string, accountNonce: bigint, chainId: bigint): string;
//#endregion
//#region src/account/Safe/adapters.d.ts
type WebauthnAssertionFetcher = (challenge: Uint8Array) => Promise<WebauthnSignatureData>;
interface FromSafeWebauthnParams {
  publicKey: WebauthnPublicKey;
  isInit: boolean;
  getAssertion: WebauthnAssertionFetcher;
  accountClass: Pick<typeof SafeAccount, "DEFAULT_WEB_AUTHN_SHARED_SIGNER" | "DEFAULT_WEB_AUTHN_SIGNER_FACTORY" | "DEFAULT_WEB_AUTHN_SIGNER_SINGLETON" | "DEFAULT_WEB_AUTHN_SIGNER_PROXY_CREATION_CODE" | "DEFAULT_WEB_AUTHN_PRECOMPILE" | "DEFAULT_WEB_AUTHN_CONTRACT_VERIFIER">;
  webAuthnSharedSigner?: string;
  webAuthnSignerFactory?: string;
  webAuthnSignerSingleton?: string;
  webAuthnSignerProxyCreationCode?: string;
  eip7212WebAuthnPrecompileVerifier?: string;
  eip7212WebAuthnContractVerifier?: string;
}
declare function fromSafeWebauthn(params: FromSafeWebauthnParams): ExternalSigner<unknown>;
declare function pubkeyCoordinatesToJson(pubkey: WebauthnPublicKey): string;
declare function pubkeyCoordinatesFromJson(input: string | {
  x: bigint | string | number;
  y: bigint | string | number;
}): WebauthnPublicKey;
interface AuthenticatorAssertionLike {
  authenticatorData: ArrayBuffer | Uint8Array | string;
  clientDataJSON: ArrayBuffer | Uint8Array | string;
  signature: ArrayBuffer | Uint8Array | {
    r: bigint;
    s: bigint;
  };
}
declare function webauthnSignatureFromAssertion(response: AuthenticatorAssertionLike): WebauthnSignatureData;
//#endregion
//#region src/signer/adapters.d.ts
interface ViemLocalAccountLike {
  address: `0x${string}`;
  sign: (args: {
    hash: `0x${string}`;
  }) => Promise<`0x${string}`>;
  signTypedData: (args: {
    domain: TypedData["domain"];
    types: Record<string, Array<{
      name: string;
      type: string;
    }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<`0x${string}`>;
}
interface ViemWalletClientLike {
  account?: {
    address: `0x${string}`;
  } | undefined;
  signTypedData: unknown;
}
interface EthersWalletLike {
  address: string;
  signingKey: {
    sign: (hash: string) => {
      serialized: string;
    };
  };
  signTypedData: (domain: {
    name?: string;
    version?: string;
    chainId?: number | bigint;
    verifyingContract?: string;
    salt?: string;
  }, types: Record<string, Array<{
    name: string;
    type: string;
  }>>, message: Record<string, unknown>) => Promise<string>;
}
declare function fromPrivateKey(privateKey: string): ExternalSigner<unknown>;
declare function fromViem(account: ViemLocalAccountLike): ExternalSigner<unknown>;
declare function fromViemWalletClient(client: ViemWalletClientLike): ExternalSigner<unknown>;
declare function fromEthersWallet(wallet: EthersWalletLike): ExternalSigner<unknown>;
//#endregion
//#region src/userOperationRevert.d.ts
type UserOperationRevert = {
  reverted: boolean;
  outOfGas: boolean;
  errorMessage?: string;
  panicCode?: number;
  revertData: string;
};
declare function decodeUserOperationRevertReason(receipt: NonNullable<UserOperationReceiptResult>): UserOperationRevert;
//#endregion
//#region src/utilsTenderly.d.ts
type OverrideType = Record<string, Record<string, string | Record<string, string>>>;
declare function shareTenderlySimulationAndCreateLink(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, tenderlySimulationId: string): Promise<void>;
declare function simulateUserOperationWithTenderlyAndCreateShareLink(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, chainId: bigint, entrypointAddress: string, userOperation: UserOperationV6 | UserOperationV7 | UserOperationV8 | UserOperationV9, blockNumber?: number | null, stateOverrides?: OverrideType | null): Promise<{
  simulation: SingleTransactionTenderlySimulationResult;
  simulationShareLink: string;
}>;
declare function simulateUserOperationWithTenderly(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, chainId: bigint, entrypointAddress: string, userOperation: UserOperationV6 | UserOperationV7 | UserOperationV8 | UserOperationV9, blockNumber?: number | null, stateOverrides?: OverrideType | null): Promise<SingleTransactionTenderlySimulationResult>;
interface BaseUserOperationToSimulate {
  sender: string;
  callData: string;
  nonce: bigint;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  signature: string;
}
interface UserOperationV6ToSimulate extends BaseUserOperationToSimulate {
  initCode: string | null;
  paymasterAndData: string;
}
interface UserOperationV7ToSimulate extends BaseUserOperationToSimulate {
  factory: string | null;
  factoryData: string | null;
  paymaster: string | null;
  paymasterVerificationGasLimit: bigint | null;
  paymasterPostOpGasLimit: bigint | null;
  paymasterData: string | null;
}
interface UserOperationV8ToSimulate extends BaseUserOperationToSimulate {
  factory: string | null;
  factoryData: string | null;
  paymaster: string | null;
  paymasterVerificationGasLimit: bigint | null;
  paymasterPostOpGasLimit: bigint | null;
  paymasterData: string | null;
  eip7702Auth: Authorization7702Hex | null;
}
interface UserOperationV9ToSimulate extends UserOperationV8ToSimulate {}
declare function simulateUserOperationCallDataWithTenderlyAndCreateShareLink(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, chainId: bigint, entrypointAddress: string, userOperation: UserOperationV6ToSimulate | UserOperationV7ToSimulate | UserOperationV8ToSimulate | UserOperationV9ToSimulate, blockNumber?: number | null, stateOverrides?: OverrideType | null): Promise<{
  simulation: TenderlySimulationResult;
  callDataSimulationShareLink: string;
  accountDeploymentSimulationShareLink?: string;
}>;
declare function simulateUserOperationCallDataWithTenderly(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, chainId: bigint, entrypointAddress: string, userOperation: UserOperationV6ToSimulate | UserOperationV7ToSimulate | UserOperationV8ToSimulate | UserOperationV9ToSimulate, blockNumber?: number | null, stateOverrides?: OverrideType | null): Promise<TenderlySimulationResult>;
declare function simulateSenderCallDataWithTenderlyAndCreateShareLink(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, chainId: bigint, entrypointAddress: string, sender: string, callData: string, factory?: string | null, factoryData?: string | null, blockNumber?: number | null, stateOverrides?: OverrideType | null): Promise<{
  simulation: TenderlySimulationResult;
  callDataSimulationShareLink: string;
  accountDeploymentSimulationShareLink?: string;
}>;
declare function simulateSenderCallDataWithTenderly(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, chainId: bigint, entrypointAddress: string, sender: string, callData: string, factory?: string | null, factoryData?: string | null, blockNumber?: number | null, stateOverrides?: OverrideType | null): Promise<TenderlySimulationResult>;
declare function callTenderlySimulateBundle(tenderlyAccountSlug: string, tenderlyProjectSlug: string, tenderlyAccessKey: string, transactions: {
  chainId: bigint;
  from: string;
  to: string;
  data: string;
  gas?: number | null;
  gasPrice?: bigint | number | null;
  value?: bigint | number | null;
  blockNumber?: number | null;
  simulationType?: "full" | "quick" | "abi";
  stateOverrides?: OverrideType | null;
  transactionIndex?: number;
  save?: boolean;
  saveIfFails?: boolean;
  estimateGas?: boolean;
  generateAccessList?: boolean;
  accessList?: {
    address: string;
  }[];
}[]): Promise<TenderlySimulationResult>;
declare namespace abstractionkit_d_exports {
  export { ALLOWANCE_MODULE_V0_1_0_ADDRESS, AbiInputValue, AbstractionKitError, Allowance, AllowanceModule, AnyUserOperation, Authorization7702, Authorization7702Hex, BaseRpcTransport, BaseUserOperationDummyValues, Bundler, CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS, Calibur7702Account, CaliburCreateUserOperationOverrides, CaliburKey, CaliburKeySettings, CaliburKeySettingsResult, CaliburKeyType, CaliburSignatureOverrides, CandidePaymaster, CandidePaymasterContext, CreateUserOperationV6Overrides, CreateUserOperationV7Overrides, CreateUserOperationV9Overrides, DEFAULT_SECP256R1_PRECOMPILE_ADDRESS, DecodeTokenQuoteOverrides, DecodedTokenQuote, DepositInfo, ECDSAPublicAddress, EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE, EIP712_MULTI_CHAIN_OPERATIONS_TYPE, EIP712_RECOVERY_MODULE_TYPE, EIP712_SAFE_OPERATION_PRIMARY_TYPE, EIP712_SAFE_OPERATION_V6_TYPE, EIP712_SAFE_OPERATION_V7_TYPE, ENTRYPOINT_V6, ENTRYPOINT_V7, ENTRYPOINT_V8, ENTRYPOINT_V9, EOADummySignerSignaturePair, EXECUTE_RECOVERY_PRIMARY_TYPE, Erc7677Context, Erc7677Paymaster, Erc7677PaymasterConstructorOptions, Erc7677PaymasterFields, Erc7677Provider, Erc7677StubDataResult, EthCallTransaction, EventfulTransport, ExperimentalAllowAllParallelPaymaster, ExternalSigner, FromSafeWebauthnParams, GasEstimationResult, GasOption, GasPaymasterUserOperationOverrides, HttpTransport, HttpTransportOptions, InitCodeOverrides, JsonRpcEnvelope, JsonRpcError, JsonRpcNode, JsonRpcParam, JsonRpcResponse, JsonRpcResult, KnownTokenPaymaster, Log, MetaTransaction, MultiOpSignContext, Operation, ParallelPaymasterInitValues, PolygonChain, PrependTokenPaymasterApproveAccount, ProviderRpcError, RecoveryRequest, RecoveryRequestTypedDataDomain, RecoveryRequestTypedMessageValue, RecoverySignaturePair, RequestArgs, RequestOptions, SAFE_FALLBACK_HANDLER_STORAGE_SLOT, SAFE_MESSAGE_MODULE_TYPE, SAFE_MESSAGE_PRIMARY_TYPE, SafeAccountFactory, SafeAccountV0_2_0, SafeAccountV0_3_0, SafeAccountV1_5_0_M_0_3_0, SafeMessageTypedDataDomain, SafeMessageTypedMessageValue, SafeModuleExecutorFunctionSelector, SafeMultiChainSigAccountV1, SafeUserOperationTypedDataDomain, SameUserOp, SendUseroperationResponse, SignContext, SignHashFn, SignTypedDataFn, Signer, SignerSignaturePair, SigningScheme, Simple7702Account, Simple7702AccountV09, SmartAccount, SmartAccountFactory, SocialRecoveryModule, SocialRecoveryModuleGracePeriodSelector, SponsorInfo, SponsorMetadata, StateOverrideSet, TokenPaymasterProvider, TokenQuote, Transport, TransportRpcError, TypedData, UserOperationByHashResult, UserOperationReceipt, UserOperationReceiptResult, UserOperationRevert, UserOperationV6, UserOperationV7, UserOperationV8, UserOperationV9, WebAuthnSignatureData, WebauthnAssertionFetcher, WebauthnDummySignerSignaturePair, WebauthnPublicKey, WebauthnSignatureData, WorldIdPermissionlessPaymaster, ZeroAddress, calculateUserOperationMaxGasCost, callTenderlySimulateBundle, createAndSignEip7702DelegationAuthorization, createAndSignEip7702RawTransaction, createAndSignLegacyRawTransaction, createCallData, createEip7702DelegationAuthorizationHash, createEip7702TransactionHash, createUserOperationHash, createWorldIdSignal, decodeUserOperationRevertReason, fetchAccountNonce, fromEthersWallet, fromPrivateKey, fromSafeWebauthn, fromViem, fromViemWalletClient, getFunctionSelector, getSafeMessageEip712Data, isEventfulTransport, isHttpTransport, parseAaCode, pubkeyCoordinatesFromJson, pubkeyCoordinatesToJson, sendJsonRpcRequest, shareTenderlySimulationAndCreateLink, signHash, simulateSenderCallDataWithTenderly, simulateSenderCallDataWithTenderlyAndCreateShareLink, simulateUserOperationCallDataWithTenderly, simulateUserOperationCallDataWithTenderlyAndCreateShareLink, simulateUserOperationWithTenderly, simulateUserOperationWithTenderlyAndCreateShareLink, webauthnSignatureFromAssertion };
}
//#endregion
export { ALLOWANCE_MODULE_V0_1_0_ADDRESS, type AbiInputValue, AbstractionKitError, type Allowance, AllowanceModule, type AnyUserOperation, type Authorization7702, type Authorization7702Hex, BaseRpcTransport, BaseUserOperationDummyValues, Bundler, CALIBUR_UNISWAP_V1_0_0_SINGLETON_ADDRESS, Calibur7702Account, type CaliburCreateUserOperationOverrides, type CaliburKey, type CaliburKeySettings, type CaliburKeySettingsResult, CaliburKeyType, type CaliburSignatureOverrides, CandidePaymaster, type CandidePaymasterContext, type CreateUserOperationV6Overrides, type CreateUserOperationV7Overrides, type CreateUserOperationV9Overrides, DEFAULT_SECP256R1_PRECOMPILE_ADDRESS, type DecodeTokenQuoteOverrides, type DecodedTokenQuote, type DepositInfo, type ECDSAPublicAddress, EIP712_MULTI_CHAIN_OPERATIONS_PRIMARY_TYPE, EIP712_MULTI_CHAIN_OPERATIONS_TYPE, EIP712_RECOVERY_MODULE_TYPE, EIP712_SAFE_OPERATION_PRIMARY_TYPE, EIP712_SAFE_OPERATION_V6_TYPE, EIP712_SAFE_OPERATION_V7_TYPE, ENTRYPOINT_V6, ENTRYPOINT_V7, ENTRYPOINT_V8, ENTRYPOINT_V9, EOADummySignerSignaturePair, EXECUTE_RECOVERY_PRIMARY_TYPE, type Erc7677Context, Erc7677Paymaster, type Erc7677PaymasterConstructorOptions, type Erc7677PaymasterFields, type Erc7677Provider, type Erc7677StubDataResult, type EthCallTransaction, type EventfulTransport, ExperimentalAllowAllParallelPaymaster, type ExternalSigner, type FromSafeWebauthnParams, type GasEstimationResult, GasOption, type GasPaymasterUserOperationOverrides, HttpTransport, type HttpTransportOptions, type InitCodeOverrides, type JsonRpcEnvelope, type JsonRpcError, JsonRpcNode, type JsonRpcParam, type JsonRpcResponse, type JsonRpcResult, type KnownTokenPaymaster, type Log, type MetaTransaction, type MultiOpSignContext, Operation, type ParallelPaymasterInitValues, PolygonChain, type PrependTokenPaymasterApproveAccount, type ProviderRpcError, type RecoveryRequest, type RecoveryRequestTypedDataDomain, type RecoveryRequestTypedMessageValue, type RecoverySignaturePair, type RequestArgs, type RequestOptions, SAFE_FALLBACK_HANDLER_STORAGE_SLOT, SAFE_MESSAGE_MODULE_TYPE, SAFE_MESSAGE_PRIMARY_TYPE, SafeAccountFactory, SafeAccountV0_2_0, SafeAccountV0_3_0, SafeAccountV1_5_0_M_0_3_0, type SafeMessageTypedDataDomain, type SafeMessageTypedMessageValue, SafeModuleExecutorFunctionSelector, SafeMultiChainSigAccountV1, type SafeUserOperationTypedDataDomain, type SameUserOp, SendUseroperationResponse, type SignContext, type SignHashFn, type SignTypedDataFn, type Signer, type SignerSignaturePair, type SigningScheme, Simple7702Account, Simple7702AccountV09, SmartAccount, SmartAccountFactory, SocialRecoveryModule, SocialRecoveryModuleGracePeriodSelector, type SponsorInfo, type SponsorMetadata, type StateOverrideSet, type TokenPaymasterProvider, type TokenQuote, type Transport, TransportRpcError, type TypedData, type UserOperationByHashResult, type UserOperationReceipt, type UserOperationReceiptResult, type UserOperationRevert, type UserOperationV6, type UserOperationV7, type UserOperationV8, type UserOperationV9, type WebAuthnSignatureData, type WebauthnAssertionFetcher, WebauthnDummySignerSignaturePair, type WebauthnPublicKey, type WebauthnSignatureData, WorldIdPermissionlessPaymaster, ZeroAddress, abstractionkit_d_exports as abstractionkit, calculateUserOperationMaxGasCost, callTenderlySimulateBundle, createAndSignEip7702DelegationAuthorization, createAndSignEip7702RawTransaction, createAndSignLegacyRawTransaction, createCallData, createEip7702DelegationAuthorizationHash, createEip7702TransactionHash, createUserOperationHash, createWorldIdSignal, decodeUserOperationRevertReason, fetchAccountNonce, fromEthersWallet, fromPrivateKey, fromSafeWebauthn, fromViem, fromViemWalletClient, getFunctionSelector, getSafeMessageEip712Data, isEventfulTransport, isHttpTransport, parseAaCode, pubkeyCoordinatesFromJson, pubkeyCoordinatesToJson, sendJsonRpcRequest, shareTenderlySimulationAndCreateLink, signHash, simulateSenderCallDataWithTenderly, simulateSenderCallDataWithTenderlyAndCreateShareLink, simulateUserOperationCallDataWithTenderly, simulateUserOperationCallDataWithTenderlyAndCreateShareLink, simulateUserOperationWithTenderly, simulateUserOperationWithTenderlyAndCreateShareLink, webauthnSignatureFromAssertion };
//# sourceMappingURL=index.d.mts.map