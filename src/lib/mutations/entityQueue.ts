export type EntityQueueTask<TResult> = () => Promise<TResult>;

const queueTails = new Map<string, Promise<void>>();

/**
 * Runs `task` after every previously queued task for the same `entityId` has
 * settled (resolved or rejected), so same-entity mutations never overlap.
 * A different `entityId` has its own tail and runs immediately, in parallel.
 */
export function runExclusive<TResult>(entityId: string, task: EntityQueueTask<TResult>): Promise<TResult> {
  const previousTail = queueTails.get(entityId) ?? Promise.resolve();
  const result = previousTail.then(task);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );

  queueTails.set(entityId, tail);

  void tail.finally(() => {
    if (queueTails.get(entityId) === tail) {
      queueTails.delete(entityId);
    }
  });

  return result;
}
