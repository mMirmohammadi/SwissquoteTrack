import { createPublicClient, http } from 'viem';
import { liveScreeningSources } from './screening.ts';
import type { Address, AppOptions, ScreeningSource } from './types.ts';

interface ScreeningConfiguration {
  chainId: number;
  allowMock: boolean;
  mainnetUrls: readonly string[];
  simulationUrls: readonly string[];
  tokens: readonly Address[];
}

/** Local fixtures are never checked against unrelated public-chain lists. */
export function configureScreening(options: ScreeningConfiguration): Pick<AppOptions, 'screeningSources' | 'simulationClients'> & { screeningMode: string } {
  if (options.chainId === 31337) {
    if (!options.allowMock) return { screeningSources: [], simulationClients: [], screeningMode: 'unavailable (local MOCK disabled; no public RPC screening)' };
    const fixtureSource = (label: string, kind: 'sanctions' | 'freeze'): ScreeningSource => ({
      label, kind, required: true, mock: true,
      // MOCK_LISTED and caller-supplied fixture hits remain enforced by screenAddresses.
      check: async () => ({ hits: [], warning: 'MOCK local fixture screening only; no live sanctions or issuer-freeze coverage.' }),
    });
    return {
      screeningSources: [
        fixtureSource('local fixture sanctions adapter', 'sanctions'),
        ...options.tokens.map(token => fixtureSource(`local fixture issuer freeze adapter ${token}`, 'freeze')),
      ],
      // No public Sepolia simulation fallback for an offline local gate.
      simulationClients: [],
      screeningMode: 'MOCK local fixture screening (not live compliance; dApp simulation unavailable)',
    };
  }
  return {
    screeningSources: liveScreeningSources(options.mainnetUrls, options.simulationUrls, options.tokens),
    simulationClients: options.simulationUrls.map(url => createPublicClient({ transport: http(url, { timeout: 2000, retryCount: 0 }) })),
    screeningMode: 'live public-chain screening sources (availability and freshness enforced)',
  };
}
