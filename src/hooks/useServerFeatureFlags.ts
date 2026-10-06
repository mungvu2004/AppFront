import { useEffect, useRef } from 'react';

import {
  markServerFeatureFlagsUnavailable,
  resetServerFeatureFlags,
  setServerFeatureFlags,
  type FeatureFlagReader,
} from '@/lib/telemetry/flags';

import { useSession } from './useSession';

/** Lazy for the same reason as `useProjectSpatial`: keep the mock client out of the entry chunk. */
const readFromAppClient: FeatureFlagReader = async () =>
  (await import('@/api/appClient')).createAppApiClient().featureFlags.read();

/**
 * Pull the server's feature flags once per signed-in user.
 *
 * Anonymous → no request (the endpoint needs a session) and flags fall back to
 * their defaults. A different user → defaults, then a fresh load, because flags
 * are per role. A failed read never throws and leaves the defaults.
 *
 * Under `React.StrictMode` in development the effect runs twice, so two
 * requests go out and the first answer is dropped as stale. Production sends
 * one; do not "fix" this.
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

    // Not `loadServerFeatureFlags`: it writes whenever its read settles, and a
    // late answer for the previous user must not land on the next one's store.
    void Promise.resolve()
      .then(() => readRef.current())
      .then(
        (payload) => {
          if (!stale) setServerFeatureFlags(payload);
        },
        () => {
          if (!stale) markServerFeatureFlagsUnavailable();
        },
      );

    return () => {
      stale = true;
      resetServerFeatureFlags();
    };
  }, [userId]);
}
