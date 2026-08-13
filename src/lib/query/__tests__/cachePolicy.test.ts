import { describe, expect, it } from 'vitest';

import {
  CACHE_POLICY,
  CACHE_POLICY_TIERS,
  listCachePolicyDefaults,
  resolveCachePolicy,
  resolveCachePolicyTier,
  type CachePolicyTier,
} from '../cachePolicy';
import { queryKeys } from '../queryKeys';

describe('CACHE_POLICY', () => {
  it('keeps every timing number in one place', () => {
    expect(CACHE_POLICY.default.staleTime).toBe(30_000);
    expect(CACHE_POLICY.default.gcTime).toBe(600_000);
    expect(CACHE_POLICY.branches.static).toBe(300_000);
    expect(CACHE_POLICY.branches.aiProgress).toBe(0);
    expect(CACHE_POLICY.branches.spatialDraft).toBe(10_000);
  });

  it('retries read queries once and mutations zero times', () => {
    expect(CACHE_POLICY.retry.query).toBe(1);
    expect(CACHE_POLICY.retry.mutation).toBe(0);
  });

  it('declares all policy tiers', () => {
    expect([...CACHE_POLICY_TIERS]).toEqual(['default', 'static', 'aiProgress', 'spatialDraft']);
  });
});

describe('resolveCachePolicy', () => {
  it('returns staleTime 0 for the AI progress key', () => {
    const policy = resolveCachePolicy(queryKeys.progress.byFloor('floor-21'));

    expect(policy.tier).toBe<CachePolicyTier>('aiProgress');
    expect(policy.staleTime).toBe(0);
  });

  const cases: ReadonlyArray<{ key: readonly unknown[]; name: string; staleTime: number; tier: CachePolicyTier }> = [
    { key: queryKeys.library.list(), name: 'library.list', staleTime: 300_000, tier: 'static' },
    { key: queryKeys.library.detail('library-34'), name: 'library.detail', staleTime: 300_000, tier: 'static' },
    { key: queryKeys.user.current(), name: 'user.current', staleTime: 300_000, tier: 'static' },
    { key: queryKeys.user.list(), name: 'user.list', staleTime: 300_000, tier: 'static' },
    { key: queryKeys.progress.byFloor('floor-21'), name: 'progress.byFloor', staleTime: 0, tier: 'aiProgress' },
    { key: queryKeys.space.byFloor('floor-21'), name: 'space.byFloor', staleTime: 10_000, tier: 'spatialDraft' },
    { key: queryKeys.room.byFloor('floor-21'), name: 'room.byFloor', staleTime: 10_000, tier: 'spatialDraft' },
    { key: queryKeys.drawing.byFloor('floor-21'), name: 'drawing.byFloor', staleTime: 10_000, tier: 'spatialDraft' },
    { key: queryKeys.project.list(), name: 'project.list', staleTime: 30_000, tier: 'default' },
    { key: queryKeys.floor.list('project-48'), name: 'floor.list', staleTime: 30_000, tier: 'default' },
    { key: queryKeys.version.byFloor('floor-21'), name: 'version.byFloor', staleTime: 30_000, tier: 'default' },
    {
      key: queryKeys.violation.byProject('project-48'),
      name: 'violation.byProject',
      staleTime: 30_000,
      tier: 'default',
    },
  ];

  it.each(cases)('assigns $name to tier $tier', ({ key, staleTime, tier }) => {
    expect(resolveCachePolicyTier(key)).toBe(tier);
    expect(resolveCachePolicy(key).staleTime).toBe(staleTime);
  });

  it('shares the default gcTime across every tier', () => {
    for (const { key } of cases) {
      expect(resolveCachePolicy(key).gcTime).toBe(CACHE_POLICY.default.gcTime);
    }
  });

  it('falls back to the default tier for a key from an undeclared domain', () => {
    expect(resolveCachePolicy(['unknown-domain', 'list'])).toEqual({
      gcTime: CACHE_POLICY.default.gcTime,
      staleTime: CACHE_POLICY.default.staleTime,
      tier: 'default',
    });
  });

  it('falls back to the default tier when the first segment is not a string', () => {
    expect(resolveCachePolicyTier([42])).toBe('default');
    expect(resolveCachePolicyTier([])).toBe('default');
  });
});

describe('listCachePolicyDefaults', () => {
  it('lists only overridden domains, one key prefix per domain', () => {
    const defaults = listCachePolicyDefaults();
    const domains = defaults.map((entry) => entry.queryKey[0]).sort();

    expect(domains).toEqual(['drawing', 'library', 'progress', 'room', 'space', 'user']);
    expect(defaults.every((entry) => entry.queryKey.length === 1)).toBe(true);
  });

  it('matches direct lookup for every default', () => {
    for (const entry of listCachePolicyDefaults()) {
      expect(resolveCachePolicy(entry.queryKey)).toEqual({
        gcTime: entry.gcTime,
        staleTime: entry.staleTime,
        tier: entry.tier,
      });
    }
  });
});
