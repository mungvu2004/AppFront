import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from '@tanstack/react-query';

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
 * Creates a QueryClient carrying this application's cache policy.
 *
 * The one place `new QueryClient()` is called. Everything else — the shared
 * instance below, the per-render client the test harness builds — comes through
 * here, so the cache policy, the retry rule and the error reporting are decided
 * once. A caller that needs different behaviour overrides the defaults it means
 * to change rather than rebuilding the client from scratch; a test turning
 * retries off should still be exercising the real `CACHE_POLICY`, or it is
 * testing a client the product does not have.
 *
 * @param overrides Merged over the defaults, one group at a time. Per-key
 *   defaults from {@link listCachePolicyDefaults} are applied afterwards and are
 *   not affected.
 */
export function createQueryClient(overrides: DefaultOptions = {}): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: CACHE_POLICY.retry.mutation,
        ...overrides.mutations,
      },
      queries: {
        gcTime: CACHE_POLICY.default.gcTime,
        refetchOnWindowFocus: false,
        retry: shouldRetry(CACHE_POLICY.retry.query),
        staleTime: CACHE_POLICY.default.staleTime,
        ...overrides.queries,
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
