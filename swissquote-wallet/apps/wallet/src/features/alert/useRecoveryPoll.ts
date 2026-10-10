import { useEffect, useState } from 'react';
import type { Address, PublicClient } from 'viem';
import { POLL_MS, pollRecovery, type Snapshot } from '../recovery/core';
export function useRecoveryPoll(clients: readonly PublicClient[], wallet: Address | undefined, chainId: number) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true; let checking = false;
    setSnapshot(undefined); setError('');
    async function check() {
      if (!wallet || checking) return;
      checking = true;
      try { const next = await pollRecovery(clients, wallet, chainId); if (live) { setSnapshot(next); setError(next.warning); } }
      catch { if (live) setError('Recovery polling failed. Last known requests may still be active; countdown and clear status cannot be confirmed. Retry when both public nodes are available.'); }
      finally { checking = false; }
    }
    void check(); const timer = setInterval(() => { void check(); }, POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, [clients, wallet, chainId]);
  return { snapshot, error };
}
