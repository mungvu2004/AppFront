import type { QueryClient, UseMutationOptions } from '@tanstack/react-query';

import { toAppError, type AppError } from '@/lib/errors';
import type { QueryKey } from '@/lib/query/queryKeys';

import { runExclusive } from './entityQueue';

export interface OptimisticMutationConfig<TVariables, TResult> {
  /** Query keys this mutation touches; cancelled, snapshotted, and restorable on failure. */
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  /** Runs once the server call succeeds, e.g. to invalidate `affectedKeys` per the read model. */
  afterSuccess: (result: TResult, variables: TVariables) => void;
  /** Applies the change immediately so it is visible before the server confirms it. */
  applyOptimistic: (variables: TVariables) => void;
  /** Sends the change to the server. */
  callServer: (variables: TVariables) => Promise<TResult>;
  /** Identifies the entity being mutated, used to serialize overlapping mutations. */
  entityId: (variables: TVariables) => string;
  /** Undoes whatever `applyOptimistic` did outside the query cache when the server call fails. */
  rollback: (variables: TVariables) => void;
}

interface QuerySnapshotEntry {
  data: unknown;
  queryKey: QueryKey;
}

const takeSnapshot = (queryClient: QueryClient, keys: readonly QueryKey[]): QuerySnapshotEntry[] =>
  keys.map((queryKey) => ({ data: queryClient.getQueryData(queryKey), queryKey }));

const restoreSnapshot = (queryClient: QueryClient, snapshot: readonly QuerySnapshotEntry[]): void => {
  for (const { data, queryKey } of snapshot) {
    queryClient.setQueryData(queryKey, data);
  }
};

async function runOptimisticLifecycle<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
  variables: TVariables,
): Promise<TResult> {
  const affectedKeys = config.affectedKeys(variables);

  await Promise.all(affectedKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })));

  const snapshot = takeSnapshot(queryClient, affectedKeys);

  config.applyOptimistic(variables);

  try {
    const result = await config.callServer(variables);
    config.afterSuccess(result, variables);
    return result;
  } catch (error) {
    restoreSnapshot(queryClient, snapshot);
    config.rollback(variables);
    throw toAppError(error);
  }
}

/**
 * Builds `useMutation` options for an optimistic write: apply immediately,
 * call the server, then either invalidate on success or roll back to the
 * pre-mutation snapshot on failure. Mutations sharing an entityId (per
 * `config.entityId`) are queued so they never run concurrently.
 */
export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables> {
  return {
    mutationFn: (variables) =>
      runExclusive(config.entityId(variables), () => runOptimisticLifecycle(queryClient, config, variables)),
  };
}
