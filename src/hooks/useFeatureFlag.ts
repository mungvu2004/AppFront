import { useCallback, useSyncExternalStore } from 'react';

import {
  getFeatureFlagsSnapshot,
  subscribeFeatureFlags,
  type FeatureFlagKey,
  type FeatureFlagResolution,
  type FeatureFlagsSnapshot,
} from '@/lib/telemetry/flags';

/**
 * Reading a feature flag from a component.
 *
 * The table, the read order and the store all live in
 * `src/lib/telemetry/flags.ts`; this file is the three lines of React that
 * subscribe to them. It sits in `src/hooks` rather than beside the store
 * because `.eslintrc.cjs` forbids `src/lib/**` from importing `react` at all
 * (rule 0.4, "lib TUYỆT ĐỐI không import React") — the same split as
 * `useSession` over `src/lib/auth/session`.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: a flag read during
 * the first render must be the same value the store holds, not the default
 * followed by a flash when an effect catches up.
 *
 * Nothing here can suspend, throw or wait. The store answers synchronously from
 * the table's defaults before any server has spoken, so a flag that cannot be
 * read costs its own feature and never the screen around it.
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const getSnapshot = useCallback((): boolean => getFeatureFlagsSnapshot().values[key], [key]);

  return useSyncExternalStore(subscribeFeatureFlags, getSnapshot, getSnapshot);
}

/**
 * The flag and where its value came from — override, server, or the default.
 *
 * For the places that have to say *why*, which is the dev panel and any screen
 * explaining to somebody that a feature is off because their group has not been
 * switched on yet. The resolution object is cached inside the store, so this is
 * safe to depend on.
 */
export function useFeatureFlagResolution(key: FeatureFlagKey): FeatureFlagResolution {
  const getSnapshot = useCallback((): FeatureFlagResolution => getFeatureFlagsSnapshot().resolutions[key], [key]);

  return useSyncExternalStore(subscribeFeatureFlags, getSnapshot, getSnapshot);
}

/** Every flag at once, for a panel that lists them. */
export function useFeatureFlags(): FeatureFlagsSnapshot {
  return useSyncExternalStore(subscribeFeatureFlags, getFeatureFlagsSnapshot, getFeatureFlagsSnapshot);
}
