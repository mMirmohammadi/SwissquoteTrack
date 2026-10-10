# Swissquote service integration checkpoint

Exports from `src/app.ts`: `createApp(options)` returns `{server, handler, store, close}`; `server.listen(4001)` starts HTTP. Tests inject `chain` and WebAuthn adapters. JSON bigint values are decimal strings. Errors are `{error:string}`. Authorization is `Bearer <opaque session token>`.

Auth: POST `/auth/password/register` `{email,password}`; `/auth/password/login`; `/auth/password/reset-request` `{email}`; `/auth/password/reset` `{token,password}`. Registration/login return `{token,clientId,userRef,authMethod}`. POST `/auth/passkey/register/options`, `/verify`; `/auth/passkey/login/options`, `/verify`; `/auth/passkey/step-up/options` `{hash}` and `/verify` `{response}`. Options return standard WebAuthn options plus `challengeId`; verification accepts `{challengeId,response}`. Step-up verification returns `{stepUpToken,hash}`.

POST `/kyc/mock-verify`; GET `/mock/mailbox` (local MOCK only); POST `/demo/fooled` `{enabled}`. POST `/guardian/enroll` returns `{guardian,address,userRef,mock:true}`. POST `/wallets/challenge` `{wallet}` returns `{nonce,message}`; POST `/wallets` `{wallet,owner,cardGuardian,partnerGuardian,sqGuardian,saltNonce,nonce,signature}`. GET `/wallets/:address`. GET `/account`; POST `/account/withdraw` `{to,amount}` (USDC integer base units).

POST `/relay/deploy` `{owner,cardGuardian,partnerGuardian,sqGuardian,saltNonce,wallet?}`; `/relay/safe-tx` `{wallet,tx,signature,stepUpToken?,source?:'settings'|'wallet'|'dapp'}`; `/relay/recovery` `{wallet,module,newOwner,nonce,approvals}`; `/relay/finalize` `{wallet,module}`. Safe tx fields: to,value,data,operation,safeTxGas,baseGas,gasPrice,gasToken,refundReceiver,nonce. POST `/recovery/approve` `{wallet,module,newOwner,nonce,mockVideoId?}`.

Protective cancellation has no account budget/session ownership requirement, but requires a valid current owner signature. Finalization is permissionless and outside account budget. All chain writes simulate and estimate before send; gas caps/global safety cap remain. No default mock chain success. Adapter will be exported with exact types in `src/types.ts`; production adapter consumes protocol exports after they land.

MOCK features: mailbox, KYC, account balance, software guardian key storage and video ID. Password never substitutes for transaction-bound WebAuthn step-up.
