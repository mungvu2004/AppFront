import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_DB_NAME } from '../db';
import { createQueueStore, type QueueStore } from '../queueStore';

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
});
