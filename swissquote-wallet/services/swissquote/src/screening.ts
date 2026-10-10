import { createPublicClient, http, parseAbi } from 'viem';
import type { ScreenResult } from '@sq/protocol';
import type { Address, ScreeningSource } from './types.ts';

export const MOCK_LISTED: Address = '0x7f367cc41522ce07553e823bf3be79a889debe1b';
export async function screenAddresses(addresses: readonly Address[], sources: readonly ScreeningSource[], mockHits: readonly Address[], now: number, freezeSubjects?: readonly Address[]): Promise<ScreenResult> {
  const unique = [...new Set(addresses.map(a => a.toLowerCase() as Address))];
  // Only trusted server-derived signed-call roles may narrow issuer account checks.
  // Direct screens default to every address; sanctions and MOCK positives never narrow.
  const freezeAccounts = freezeSubjects === undefined ? unique : [...new Set(freezeSubjects.map(a => a.toLowerCase() as Address))];
  if (freezeAccounts.some(account => !unique.includes(account))) throw new Error('Freeze subjects must belong to screened addresses');
  const hits = new Set<Address>(unique.filter(a => [MOCK_LISTED, ...mockHits.map(a => a.toLowerCase())].includes(a)));
  const labels = ['MOCK sanctions list: ' + (hits.size ? 'listed' : 'clear')];
  const warnings: string[] = []; let available = true;
  if (!sources.length) { available = false; warnings.push('Required live screening sources are not configured.'); }
  await Promise.all(sources.map(async source => {
    try {
      const subjects = source.kind === 'freeze' ? freezeAccounts : unique;
      const result = await source.check(subjects);
      if (!Array.isArray(result.hits) || result.hits.some(a => !subjects.includes(a.toLowerCase() as Address))) throw new Error('Invalid screening result');
      const stale = result.updatedAt !== undefined && (!Number.isFinite(result.updatedAt) || result.updatedAt > now || now - result.updatedAt > 30 * 86400_000);
      for (const a of result.hits) hits.add(a.toLowerCase() as Address);
      labels.push(`${source.mock ? 'MOCK ' : ''}${source.label}: ${result.hits.length ? 'listed' : stale ? 'unavailable (stale)' : 'clear'}${result.updatedAt !== undefined ? ` (updated ${new Date(result.updatedAt).toISOString()})` : ''}`);
      if (stale && source.required) available = false;
      if (stale) warnings.push(`${source.label}: list older than 30 days or invalid update time.`);
      if (result.warning) warnings.push(result.warning);
    } catch {
      labels.push(`${source.mock ? 'MOCK ' : ''}${source.label}: unavailable`);
      warnings.push(`${source.label}: ${source.required ? 'required' : 'secondary'} source unavailable.`);
      if (source.required) available = false;
    }
  }));
  return {ok: available && hits.size === 0, checkedAt: new Date(now).toISOString(), sources: labels.sort(), hits: [...hits], warnings, mock: true};
}

/** Read-only oracle adapters. A hit still counts if a list is stale; outages never become clear. */
export function liveScreeningSources(mainnetUrls: readonly string[], tokenUrls: readonly string[], tokens: readonly Address[]): ScreeningSource[] {
  const oracleAbi = parseAbi(['function isSanctioned(address) view returns (bool)', 'function getLastUpdateBlockTimestamp() view returns (uint256)']);
  const freezeAbi = parseAbi(['function isBlacklisted(address) view returns (bool)']);
  async function failover<T>(urls: readonly string[], read: (client: ReturnType<typeof createPublicClient>) => Promise<T>): Promise<T> {
    for (const url of urls) { try { return await read(createPublicClient({transport: http(url, {timeout: 2000, retryCount: 0})})); } catch { /* Try the next independent endpoint. */ } }
    throw new Error('Screening nodes unavailable');
  }
  const sources: ScreeningSource[] = [
    {label: 'RedStone OFAC/EU/UN-derived sanctions oracle', required: true, mock: false, kind: 'sanctions', check: addresses => failover(mainnetUrls, async client => {
      const contract = '0x574Ad490fE8087B580DB227a8Ca7EfB7C19Dc8C4';
      const [updated, flags] = await Promise.all([client.readContract({address: contract, abi: oracleAbi, functionName: 'getLastUpdateBlockTimestamp'}), Promise.all(addresses.map(address => client.readContract({address: contract, abi: oracleAbi, functionName: 'isSanctioned', args: [address]})))]);
      return {hits: addresses.filter((_, i) => flags[i]), updatedAt: Number(updated) * 1000};
    })},
    {label: 'Chainalysis sanctions oracle (list dated 18 Mar 2026)', required: false, mock: false, kind: 'sanctions', check: addresses => failover(mainnetUrls, async client => {
      const flags = await Promise.all(addresses.map(address => client.readContract({address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', abi: oracleAbi, functionName: 'isSanctioned', args: [address]})));
      return {hits: addresses.filter((_, i) => flags[i]), warning: 'Chainalysis is a secondary, known-old list; a clear result does not establish current coverage.'};
    })},
    ...tokens.map(token => ({label: `Circle issuer freeze list ${token}`, required: true, mock: false, kind: 'freeze' as const, check: (addresses: readonly Address[]) => failover(tokenUrls, async client => {
      // Never subtract the issuer address here: it may be an explicit recipient
      // or spender. Account roles are derived from signed calls by the server.
      const flags = await Promise.all(addresses.map(address => client.readContract({address: token, abi: freezeAbi, functionName: 'isBlacklisted', args: [address]})));
      return {hits: addresses.filter((_, i) => flags[i])};
    })})),
  ];
  // Cache successful evidence only, per source + complete address set; stale timestamps remain enforced above.
  return sources.map(source=> {
    const cache=new Map<string,{expires:number;result:Awaited<ReturnType<ScreeningSource['check']>>}>();
    return {...source,check:async(addresses:readonly Address[])=> {
      const key=[...addresses].map(a=>a.toLowerCase()).sort().join(',');const old=cache.get(key);if(old&&old.expires>Date.now()) return old.result;
      const result=await source.check(addresses);cache.set(key,{expires:Date.now()+600_000,result});if(cache.size>1000) cache.delete(cache.keys().next().value!);return result;
    }};
  });
}
