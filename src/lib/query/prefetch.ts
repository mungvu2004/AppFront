import type { QueryClient, QueryFunction } from '@tanstack/react-query';

import type { QueryKey } from './queryKeys';

export interface PrefetchOnHoverHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * Starts a prefetch only after the pointer stays on the target for `delayMs`
 * and only when the key holds no data yet. Leaving before the delay cancels
 * the pending timer so a quick pass-over never triggers a fetch.
 */
export function prefetchOnHover<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  fetcher: QueryFunction<TData>,
  delayMs = 200,
): PrefetchOnHoverHandlers {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const onPointerEnter = () => {
    if (timeoutId !== undefined) {
      return;
    }

    timeoutId = setTimeout(() => {
      timeoutId = undefined;

      if (queryClient.getQueryData(queryKey) !== undefined) {
        return;
      }

      void queryClient.prefetchQuery({ queryFn: fetcher, queryKey });
    }, delayMs);
  };

  const onPointerLeave = () => {
    if (timeoutId === undefined) {
      return;
    }

    clearTimeout(timeoutId);
    timeoutId = undefined;
  };

  return { onPointerEnter, onPointerLeave };
}
