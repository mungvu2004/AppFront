import { useEffect, useRef } from 'react';

import { loadServerFeatureFlags, markServerFeatureFlagsUnavailable, type FeatureFlagReader } from '@/lib/telemetry/flags';

import { useSession } from './useSession';

/** Lazy for the same reason as `useProjectSpatial`: keep the mock client out of the entry chunk. */
const readFromAppClient: FeatureFlagReader = async () =>
  (await import('@/api/appClient')).createAppApiClient().featureFlags.read();

/**
 * Pull the server's feature flags once per signed-in user.
 *
 * Anonymous → no request (the endpoint needs a session) and flags fall back to
 * their defaults. A different user → defaults, then a fresh load, because flags
 * are per role. `loadServerFeatureFlags` never rejects, so a network failure
 * just leaves the defaults.
 */
export function useServerFeatureFlags(read: FeatureFlagReader = readFromAppClient): void {
  const { status, user } = useSession();
  const userId = status === 'authenticated' ? (user?.id ?? null) : null;
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    if (userId === null) {
      return undefined;
    }

    let stale = false;

    void loadServerFeatureFlags(async () => {
      const payload = await readRef.current();

      // A newer user owns the store now; never let this answer land on top of theirs.
      return stale ? new Promise<never>(() => undefined) : payload;
    });

    return () => {
      stale = true;
      markServerFeatureFlagsUnavailable();
    };
  }, [userId]);
}
