import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON, AuthenticatorTransport } from '@simplewebauthn/server';
import type { WebAuthnAdapter } from './types.ts';
import { ApiError, requireThat } from './policy.ts';

// SimpleWebAuthn throws ordinary Errors for expected assertion validation failures.
// Keep this mapping local to verification: options/RPC/configuration errors stay operational errors.
export async function verifyWebAuthn<T>(verify:()=>Promise<T>):Promise<T> {
  try {return await verify();} catch(error) {
    if(error instanceof ApiError) throw error;
    if(error instanceof Error && (error.name==='AssertionError' || error.name==='UnexpectedRPIDHash' || error.name==='InvalidBackupFlags' || error instanceof SyntaxError || /^(Missing credential ID|Credential ID was not base64url-encoded|Unexpected credential type.*|Credential missing response|Credential response .*|Unexpected (authentication|registration) response .*|Custom challenge verifier returned false.*|User not present during .*|User verification required.*|Response counter value .*|Authenticator data was .*|Leftover bytes detected while parsing authenticator data|Error decoding authenticator extensions:.*|Invalid signature component length .*|Single-device credential indicated .*|Detected cross-origin .*|Unexpected (cross-origin|top origin|tokenBinding) .*)$/.test(error.message))) throw new ApiError(403,'Passkey verification refused; use a fresh challenge and try again');
    throw error;
  }
}
export function createWebAuthn(options:{rpID:string;origin:string|string[];rpName?:string}):WebAuthnAdapter {
  return {
    async registrationOptions(user,credentials) {return generateRegistrationOptions({rpName:options.rpName??'Swissquote Wallet MOCK',rpID:options.rpID,userName:user.email,userID:new TextEncoder().encode(user.id),attestationType:'none',excludeCredentials:credentials.map(c=>({id:c.id})),authenticatorSelection:{residentKey:'preferred',userVerification:'required'}}) as unknown as Record<string,unknown>;},
    async authenticationOptions(credentials,challenge) {return generateAuthenticationOptions({rpID:options.rpID,challenge:challenge===undefined?undefined:new Uint8Array(Buffer.from(challenge,'base64url')),userVerification:'required',allowCredentials:credentials.map(c=>({id:c.id,transports:c.transports as AuthenticatorTransport[]|undefined}))}) as unknown as Record<string,unknown>;},
    async verifyRegistration(response,challenge) {const result=await verifyRegistrationResponse({response:response as RegistrationResponseJSON,expectedChallenge:challenge,expectedOrigin:options.origin,expectedRPID:options.rpID,requireUserVerification:true});requireThat(result.verified&&result.registrationInfo,'Passkey registration refused',403);const c=result.registrationInfo.credential;return {id:c.id,publicKey:Buffer.from(c.publicKey).toString('base64url'),counter:c.counter,transports:c.transports};},
    async verifyAuthentication(response,challenge,credentials) {const r=response as AuthenticationResponseJSON;const c=credentials.find(item=>item.id===r?.id);requireThat(c,'Unknown passkey',403);const result=await verifyAuthenticationResponse({response:r,expectedChallenge:challenge,expectedOrigin:options.origin,expectedRPID:options.rpID,requireUserVerification:true,credential:{id:c.id,publicKey:new Uint8Array(Buffer.from(c.publicKey,'base64url')),counter:c.counter,transports:c.transports as AuthenticatorTransport[]|undefined}});requireThat(result.verified,'Passkey authentication refused',403);return {id:c.id,counter:result.authenticationInfo.newCounter};},
  };
}
