import type { QueryKey } from './queryKeys';

/**
 * Cache policy tiers. Each tier describes a different data change rate.
 */
export const CACHE_POLICY_TIERS = ['default', 'static', 'aiProgress', 'spatialDraft'] as const;

export type CachePolicyTier = (typeof CACHE_POLICY_TIERS)[number];

export interface CachePolicyEntry {
  /** How long data is still considered fresh, in milliseconds. */
  staleTime: number;
  /** How long data is kept in memory after the last observer unmounts, in milliseconds. */
  gcTime: number;
}

export interface ResolvedCachePolicy extends CachePolicyEntry {
  tier: CachePolicyTier;
}

/**
 * SINGLE SOURCE OF TRUTH for every timing number and retry count of the query layer.
 * No cache timing number may be declared anywhere else.
 */
export const CACHE_POLICY = {
  /**
   * Default for business data that changes at a moderate rate
   * (projects, floors, versions, compliance violations).
   * staleTime 30s: enough to move between screens without refetching,
   * still short enough that one editor's change reaches others within half a minute.
   * gcTime 10m: keeps data across a short QC session so returning is instant,
   * without growing memory on workstations that open many floors.
   */
  default: {
    gcTime: 600_000,
    staleTime: 30_000,
  },

  /**
   * Per-branch overrides. Only staleTime differs because only the change rate differs;
   * gcTime stays shared with the default tier.
   */
  branches: {
    /**
     * Static data: component library, user list.
     * 5m because admins change these tables weekly, so frequent refetching is waste.
     */
    static: 300_000,
    /**
     * AI progress: always treated as stale, every subscription refetches immediately.
     * 0s because percentage and current step change constantly; showing a cached value misleads.
     */
    aiProgress: 0,
    /**
     * Spatial data under edit: drawings, spaces, rooms.
     * 10s because the user edits directly on the canvas and needs a teammate's change
     * almost immediately, without refetching on every drag.
     */
    spatialDraft: 10_000,
  },

  /**
   * Retry counts.
   * Read queries: 1, enough to survive a momentary network blip without a long wait.
   * Mutations: 0, because writes are not idempotent and a retry can create duplicates.
   */
  retry: {
    query: 1,
    mutation: 0,
  },
} as const;

/**
 * Maps a query domain (the first query key segment) to its policy tier.
 * Domains not listed here fall back to the 'default' tier.
 */
const TIER_BY_DOMAIN: Readonly<Record<string, CachePolicyTier>> = Object.freeze({
  drawing: 'spatialDraft',
  library: 'static',
  progress: 'aiProgress',
  room: 'spatialDraft',
  space: 'spatialDraft',
  user: 'static',
});

const staleTimeOfTier = (tier: CachePolicyTier): number =>
  tier === 'default' ? CACHE_POLICY.default.staleTime : CACHE_POLICY.branches[tier];

/**
 * Lists per-domain defaults to register with queryClient.setQueryDefaults.
 * Domains missing here use the client defaultOptions directly.
 */
export function listCachePolicyDefaults(): ReadonlyArray<{ queryKey: QueryKey } & ResolvedCachePolicy> {
  return Object.entries(TIER_BY_DOMAIN).map(([domain, tier]) => ({
    gcTime: CACHE_POLICY.default.gcTime,
    queryKey: [domain] as const,
    staleTime: staleTimeOfTier(tier),
    tier,
  }));
}

/**
 * Returns the policy tier of a query key.
 */
export function resolveCachePolicyTier(queryKey: QueryKey): CachePolicyTier {
  const domain = queryKey[0];

  if (typeof domain !== 'string') {
    return 'default';
  }

  return TIER_BY_DOMAIN[domain] ?? 'default';
}

/**
 * Looks up the full cache policy for a query key.
 */
export function resolveCachePolicy(queryKey: QueryKey): ResolvedCachePolicy {
  const tier = resolveCachePolicyTier(queryKey);

  return {
    gcTime: CACHE_POLICY.default.gcTime,
    staleTime: staleTimeOfTier(tier),
    tier,
  };
}
