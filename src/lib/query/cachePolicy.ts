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
/**
 * Phép đo đã ghim (LG-3) KHÔNG có mục ở đây, và đó là chủ ý chứ không phải bỏ
 * sót: nó rơi về bậc `'default'` (30 giây) — đúng cách phần lớn domain của
 * repo đã hoạt động (`floor`, `project`, `quality`, `template`, `version`,
 * `violation`… không domain nào trong số đó có mục riêng ở đây). Một hồ sơ
 * lưu kèm dự án đổi chậm hơn nhiều so với việc kéo tường trên canvas —
 * không cần bậc `spatialDraft` 10 giây của `room`/`space`.
 */
/**
 * Thông báo — T-09. Bậc `'default'` (30s stale / 10m gc) là bậc ĐÚNG cho miền
 * này: không tĩnh theo tuần như `library`/`user`, không đổi liên tục như tiến
 * trình AI, không phải nét vẽ tay đang sửa trên canvas — một thông báo mới
 * tới trong vòng 30 giây là chấp nhận được cho một trung tâm thông báo.
 *
 * Khác `measurement` ở trên, miền này ĐƯỢC khai một dòng ở đây dù bậc chọn
 * vẫn là `'default'`, và đó là chủ ý: chính chú thích của nhánh `user` trong
 * `queryKeys.ts` cảnh báo rằng một miền thiếu mục ở bảng này lặng lẽ rơi về
 * `'default'` — dòng dưới đây biến nó thành một quyết định đã xác nhận, không
 * phải một miền bị quên.
 */
const TIER_BY_DOMAIN: Readonly<Record<string, CachePolicyTier>> = Object.freeze({
  drawing: 'spatialDraft',
  library: 'static',
  notification: 'default',
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
