import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/queryKeys';
import { createOptimisticMutation, type OptimisticMutationConfig } from '../createOptimisticMutation';

interface WallVariables {
  id: string;
  thicknessMm: number;
}

interface Deferred<TValue> {
  promise: Promise<TValue>;
  reject: (error: unknown) => void;
  resolve: (value: TValue) => void;
}

const createDeferred = <TValue>(): Deferred<TValue> => {
  let resolve!: (value: TValue) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<TValue>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
};

const floorId = 'floor-21';
const wallKey = queryKeys.space.byFloor(floorId);

describe('createOptimisticMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('cancels in-flight queries on the affected keys before applying the optimistic update', async () => {
    const callOrder: string[] = [];
    const cancelQueriesSpy = vi.spyOn(queryClient, 'cancelQueries').mockImplementation(async () => {
      callOrder.push('cancel');
    });

    const config: OptimisticMutationConfig<WallVariables, WallVariables> = {
      affectedKeys: () => [wallKey],
      afterSuccess: () => {},
      applyOptimistic: () => {
        callOrder.push('apply');
      },
      callServer: async (variables) => variables,
      entityId: (variables) => variables.id,
      rollback: () => {},
    };

    const options = createOptimisticMutation(queryClient, config);
    await options.mutationFn?.({ id: 'wall-1', thicknessMm: 120 });

    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: wallKey });
    expect(callOrder).toEqual(['cancel', 'apply']);
  });

  it('applies the change immediately, then invalidates via afterSuccess once the server confirms it', async () => {
    const afterSuccess = vi.fn();
    const applied: WallVariables[] = [];

    const config: OptimisticMutationConfig<WallVariables, WallVariables> = {
      affectedKeys: () => [wallKey],
      afterSuccess,
      applyOptimistic: (variables) => {
        applied.push(variables);
        queryClient.setQueryData(wallKey, variables);
      },
      callServer: async (variables) => variables,
      entityId: (variables) => variables.id,
      rollback: () => {},
    };

    const options = createOptimisticMutation(queryClient, config);
    const variables = { id: 'wall-1', thicknessMm: 150 };
    const result = await options.mutationFn?.(variables);

    expect(applied).toEqual([variables]);
    expect(queryClient.getQueryData(wallKey)).toEqual(variables);
    expect(afterSuccess).toHaveBeenCalledWith(variables, variables);
    expect(result).toEqual(variables);
  });

  it('restores the exact pre-mutation snapshot and forwards an AppError when the server call fails', async () => {
    const original: WallVariables = { id: 'wall-1', thicknessMm: 100 };
    queryClient.setQueryData(wallKey, original);

    const rollback = vi.fn();
    const afterSuccess = vi.fn();
    const serverError = new Error('máy chủ từ chối yêu cầu');

    const config: OptimisticMutationConfig<WallVariables, WallVariables> = {
      affectedKeys: () => [wallKey],
      afterSuccess,
      applyOptimistic: (variables) => {
        queryClient.setQueryData(wallKey, variables);
      },
      callServer: () => Promise.reject(serverError),
      entityId: (variables) => variables.id,
      rollback,
    };

    const options = createOptimisticMutation(queryClient, config);
    const variables = { id: 'wall-1', thicknessMm: 250 };

    await expect(options.mutationFn?.(variables)).rejects.toMatchObject({
      code: expect.any(String),
      kind: expect.any(String),
    });

    expect(queryClient.getQueryData(wallKey)).toEqual(original);
    expect(rollback).toHaveBeenCalledWith(variables);
    expect(afterSuccess).not.toHaveBeenCalled();
  });

  it('never swallows the server error: it always rejects, never resolves silently', async () => {
    const config: OptimisticMutationConfig<WallVariables, WallVariables> = {
      affectedKeys: () => [],
      afterSuccess: () => {},
      applyOptimistic: () => {},
      callServer: () => Promise.reject(new Error('timeout')),
      entityId: (variables) => variables.id,
      rollback: () => {},
    };

    const options = createOptimisticMutation(queryClient, config);

    await expect(options.mutationFn?.({ id: 'wall-1', thicknessMm: 10 })).rejects.toBeDefined();
  });

  it('runs mutations for the same entityId sequentially, and different entityIds in parallel', async () => {
    const order: string[] = [];
    const deferredA1 = createDeferred<void>();
    const deferredB1 = createDeferred<void>();

    const config: OptimisticMutationConfig<{ id: string; label: string }, void> = {
      affectedKeys: () => [],
      afterSuccess: () => {},
      applyOptimistic: () => {},
      callServer: async (variables) => {
        order.push(`start:${variables.label}`);

        if (variables.label === 'a1') {
          await deferredA1.promise;
        }

        if (variables.label === 'b1') {
          await deferredB1.promise;
        }

        order.push(`end:${variables.label}`);
      },
      entityId: (variables) => variables.id,
      rollback: () => {},
    };

    const options = createOptimisticMutation(queryClient, config);

    const runA1 = options.mutationFn?.({ id: 'entity-a', label: 'a1' });
    const runA2 = options.mutationFn?.({ id: 'entity-a', label: 'a2' });
    const runB1 = options.mutationFn?.({ id: 'entity-b', label: 'b1' });

    // b1 belongs to a different entity, so it starts even while a1 is pending.
    await vi.waitFor(() => expect(order).toContain('start:b1'));
    expect(order).not.toContain('start:a2');

    deferredB1.resolve();
    await vi.waitFor(() => expect(order).toContain('end:b1'));
    expect(order).not.toContain('start:a2');

    deferredA1.resolve();
    await Promise.all([runA1, runA2, runB1]);

    expect(order).toEqual(['start:a1', 'start:b1', 'end:b1', 'end:a1', 'start:a2', 'end:a2']);
  });
});
