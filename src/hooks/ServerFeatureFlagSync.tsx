import { useServerFeatureFlags } from './useServerFeatureFlags';

/** Draws nothing; loads the server's feature flags once a session exists. */
export function ServerFeatureFlagSync() {
  useServerFeatureFlags();

  return null;
}
