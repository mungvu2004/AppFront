import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { reportError, toAppError, type AppError } from '@/lib/errors';
import { CACHE_POLICY, listCachePolicyDefaults } from './cachePolicy';

/**
 * Normalizes every query-layer error into AppError so the UI only ever handles one shape.
 */
export function normalizeQueryError(error: unknown): AppError {
  return toAppError(error);
}

const shouldRetry = (limit: number) => (failureCount: number, error: unknown): boolean =>
  failureCount < limit && normalizeQueryError(error).retryable;

/**
 * Creates the app's single QueryClient.
 * Only used in this file and in tests; do not call `new QueryClient()` anywhere else.
 */
function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: CACHE_POLICY.retry.mutation,
      },
      queries: {
        gcTime: CACHE_POLICY.default.gcTime,
        refetchOnWindowFocus: false,
        retry: shouldRetry(CACHE_POLICY.retry.query),
        staleTime: CACHE_POLICY.default.staleTime,
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        reportError(error, { source: 'mutation' });
      },
    }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, { domain: String(query.queryKey[0] ?? ''), source: 'query' });
      },
    }),
  });

  for (const { queryKey, gcTime, staleTime } of listCachePolicyDefaults()) {
    client.setQueryDefaults(queryKey, { gcTime, staleTime });
  }

  return client;
}

/**
 * Shared instance for the whole app.
 */
export const queryClient = createQueryClient();
