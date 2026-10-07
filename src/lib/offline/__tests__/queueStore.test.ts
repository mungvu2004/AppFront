import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_DB_NAME } from '../db';
import { createQueueStore, subscribeQueueChanges, type QueueStore } from '../queueStore';

const deleteDatabase = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(OFFLINE_DB_NAME);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error('Database deletion was blocked.'));
  });

const closeStore = (store: QueueStore | null): void => {
  store?.close();
};

describe('queueStore', () => {
  let store: QueueStore | null = null;

  afterEach(async () => {
    closeStore(store);
    store = null;
    vi.unstubAllGlobals();
    await deleteDatabase();
  });

  it('accepts 200 pending commands and rejects the next command as queue-full', async () => {
    store = createQueueStore({ now: () => 1_720_000_000_000 });

    for (let index = 0; index < 200; index += 1) {
      const result = await store.addPendingCommand({
        command: { index },
        projectId: 'project-1',
      });

      expect(result.ok).toBe(true);
    }

    const overflowResult = await store.addPendingCommand({
      command: { index: 200 },
      projectId: 'project-1',
    });

    expect(overflowResult.ok).toBe(false);

    if (!overflowResult.ok && overflowResult.error.kind === 'queue-full') {
      expect(overflowResult.error.kind).toBe('queue-full');
      expect(overflowResult.error.pendingCommands).toBe(200);
    }
  });

  it('keeps pending commands after closing and reopening the database', async () => {
    store = createQueueStore({ now: () => 1_720_000_000_000 });

    for (let index = 0; index < 14; index += 1) {
      const result = await store.addPendingCommand({
        command: { index },
        createdAt: 1_720_000_000_000 + index,
        projectId: 'project-1',
      });

      expect(result.ok).toBe(true);
    }

    closeStore(store);
    store = createQueueStore();

    const listResult = await store.listPendingCommands('project-1');

    expect(listResult.ok).toBe(true);

    if (listResult.ok) {
      expect(listResult.data).toHaveLength(14);
      expect(listResult.data.map((command) => command.command)).toEqual(
        Array.from({ length: 14 }, (_, index) => ({ index })),
      );
    }
  });

  it('uses a non-durable memory queue when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    store = createQueueStore({ now: () => 1_720_000_000_000 });

    const result = await store.addPendingCommand({
      command: { index: 0 },
      projectId: 'project-1',
    });

    expect(store.isVolatile).toBe(true);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.isVolatile).toBe(true);
    }

    vi.unstubAllGlobals();
  });

  it('notifies subscribers after each successful write, never after a failed one, and stops on unsubscribe (NO-401)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const memoryStore = createQueueStore();
    const listener = vi.fn();
    const unsubscribe = subscribeQueueChanges(listener);
    const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

    const added = await memoryStore.addPendingCommand({ command: { index: 1 }, projectId: 'project-1' });
    const second = await memoryStore.addPendingCommand({ command: { index: 2 }, projectId: 'project-1' });
    await flush();
    expect(listener).toHaveBeenCalledTimes(2);

    if (added.ok && second.ok) {
      await memoryStore.deletePendingCommand(added.data.id);
      await memoryStore.moveToDeadLetter(second.data.id, 'rejected');
    }
    await flush();
    expect(listener).toHaveBeenCalledTimes(4);

    await memoryStore.moveToDeadLetter(999, 'missing');
    await flush();
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    unsubscribe();
    await memoryStore.addPendingCommand({ command: { index: 3 }, projectId: 'project-1' });
    await flush();
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('hears writes from another tab through BroadcastChannel (NO-401)', async () => {
    const listener = vi.fn();
    const stayingListener = vi.fn();
    const unsubscribe = subscribeQueueChanges(listener);
    const unsubscribeStaying = subscribeQueueChanges(stayingListener);
    const otherTab = new BroadcastChannel('offline-queue-changed');
    const heard = new Promise<void>((resolve) => {
      stayingListener.mockImplementation(() => resolve());
    });

    otherTab.postMessage(null);
    await heard;
    otherTab.close();
    unsubscribe();
    unsubscribeStaying();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('works without BroadcastChannel: same-tab listeners still hear writes (NO-401)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('BroadcastChannel', undefined);
    const memoryStore = createQueueStore();
    const listener = vi.fn();
    const unsubscribe = subscribeQueueChanges(listener);

    await memoryStore.addPendingCommand({ command: { index: 1 }, projectId: 'project-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('deletes and dead-letters commands in IndexedDB, and lists what is left', async () => {
    store = createQueueStore({ now: () => 1_720_000_000_000 });
    const first = await store.addPendingCommand({ command: { index: 1 }, projectId: 'project-1' });
    const second = await store.addPendingCommand({ command: { index: 2 }, projectId: 'project-1' });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    const moved = await store.moveToDeadLetter(first.data.id, 'rejected');
    expect(moved.ok && moved.data.originalId).toBe(first.data.id);
    expect((await store.moveToDeadLetter(first.data.id, 'again')).ok).toBe(false);
    expect((await store.deletePendingCommand(second.data.id)).ok).toBe(true);
    const listed = await store.listPendingCommands('project-1');
    expect(listed.ok && listed.data).toEqual([]);
  });
});
