import React, { useEffect, useRef, useState } from 'react';
import { ADDRESSES, type AccountResponse, type WalletResponse } from '@sq/protocol';
import type { Address } from 'viem';
import { call } from '../../api';
import { chainId, validatedAddress } from '../../chain';
import type { FeatureContext } from '../context';

// These fields exist in the authenticated service response, but not its shared type.
// Keep the extra capability check local; missing fields mean no shortcut.
type LinkedAccount = AccountResponse & { clientId?: string; verifiedWallets?: unknown };
const FRESH_MS = 15_000;
export function MoveBack({ context, onRecipient }: { context: FeatureContext; onRecipient: (address: Address) => void }) {
  const { session, wallet, device } = context;
  const key = JSON.stringify([session?.token, session?.clientId, session?.kycVerified, wallet, device?.id, device?.wallet, device?.owner, context.chainId]);
  const currentKey = useRef(key);
  const mounted = useRef(false);
  const readGeneration = useRef(0);
  currentKey.current = key;
  const [destination, setDestination] = useState<{ key: string; address: Address; expires: number }>();
  const [checking, setChecking] = useState(false);
  const supported = (context.chainId === 31337 || context.chainId === 11155111) && context.chainId === chainId;
  const eligible = supported && !!session?.token && session.kycVerified && !!wallet && !!device && device.id === session.clientId && device.wallet?.toLowerCase() === wallet.toLowerCase();

  async function readDestination(): Promise<Address | undefined> {
    if (!eligible || !session || !wallet || !device) return;
    try {
      const [account, linked] = await Promise.all([
        call<LinkedAccount>('/account', { token: session.token }),
        call<WalletResponse>(`/wallets/${wallet}`, { token: session.token }),
      ]);
      if (currentKey.current !== key || !account || !linked || account.clientId !== session.clientId ||
          account.mock !== true || account.decimals !== 6 || account.token?.toLowerCase() !== ADDRESSES.usdc.toLowerCase() ||
          !Array.isArray(account.verifiedWallets) || !account.verifiedWallets.some(value => typeof value === 'string' && value.toLowerCase() === wallet.toLowerCase()) ||
          linked.verified !== true || linked.clientId !== session.clientId || linked.chainId !== context.chainId ||
          linked.wallet?.toLowerCase() !== wallet.toLowerCase() || linked.owner?.toLowerCase() !== device.owner.toLowerCase()) return;
      return validatedAddress(account.address);
    } catch { return; } // Unsupported/malformed responses and outages must not expose an address.
  }

  useEffect(() => {
    let live = true;
    mounted.current = true;
    setDestination(undefined);
    setChecking(false);
    if (!eligible) return () => { mounted.current = false; };
    const check = async () => {
      const generation = ++readGeneration.current;
      setChecking(false);
      setDestination(undefined);
      const address = await readDestination();
      if (live && generation === readGeneration.current && currentKey.current === key && address) setDestination({ key, address, expires: Date.now() + FRESH_MS });
    };
    void check();
    const timer = setInterval(() => { void check(); }, FRESH_MS);
    return () => { live = false; mounted.current = false; clearInterval(timer); };
  }, [key, eligible]);

  if (!eligible || destination?.key !== key || destination.expires <= Date.now()) return null;
  return <div className="pay-moveback"><span className="pay-or">or</span><button type="button" className="secondary" disabled={context.busy || checking} onClick={() => {
    // Recheck on selection; never prefill from a stale cached account or session.
    const generation = ++readGeneration.current;
    setChecking(true);
    void readDestination().then(address => {
      if (!mounted.current || currentKey.current !== key || generation !== readGeneration.current) return;
      setChecking(false);
      if (address) onRecipient(address);
      else setDestination(undefined);
    });
  }}>Move back to my Swissquote account · MOCK</button><small>Test-token transfer only. This demo does not credit a bank balance.</small></div>;
}
