import { useCallback, useSyncExternalStore } from 'react';

import { prefersReducedMotion, subscribeReducedMotion, type MediaMatcher } from '@/lib/motion';

/**
 * The operating system's "reduce motion" setting, kept current.
 *
 * `useSyncExternalStore` rather than `useState` plus an effect, because the
 * preference is read during the first render and an effect would let one
 * animated frame through before it took hold — which is exactly the frame the
 * setting exists to prevent. The server snapshot is `false`: a static render has
 * no motion to reduce, and claiming otherwise would make the markup disagree
 * with the client on hydration.
 *
 * Most callers want {@link useTransition}, which consults this already. Reach
 * for it directly when the decision is not a duration — swapping an animated
 * illustration for a still, say.
 *
 * @param matcher Test seam. Must be referentially stable across renders;
 * remounting the subscription every render would be the only visible effect of
 * passing a fresh object each time.
 */
export function useReducedMotion(matcher?: MediaMatcher): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeReducedMotion(onStoreChange, matcher),
    [matcher],
  );

  const getSnapshot = useCallback(() => prefersReducedMotion(matcher), [matcher]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
