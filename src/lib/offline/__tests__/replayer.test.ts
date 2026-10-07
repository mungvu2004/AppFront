import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HttpError, Result } from '@/lib/http';
import { createQueueStore, type QueueStore } from '../queueStore';
import { createReplayer } from '../replayer';

interface BroadcastMessage { data: unknown }

class MockBroadcastChannel {
  private static channels = new Map<string, Set<MockBroadcastChannel>>();

  static reset(): void {
    MockBroadcastChannel.channels.clear();
  }

  readonly name: string;
  private listeners = new Set<(event: BroadcastMessage) => void>();

  constructor(name: string) {
    this.name = name;
    const channels = MockBroadcastChannel.channels.get(name) ?? new Set<MockBroadcastChannel>();
    channels.add(this);
    MockBroadcastChannel.channels.set(name, channels);
  }

  addEventListener(_type: 'message', listener: (event: BroadcastMessage) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: BroadcastMessage) => void): void {
    this.listeners.delete(listener);
  }

  postMessage(data: unknown): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    channels?.forEach((channel) => {
      if (channel === this) {
        return;
      }

      channel.listeners.forEach((listener) => listener({ data }));
    });
  }

  close(): void {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

const ok = <T>(data: T): Result<T, never> => ({ data, ok: true });

const httpError = (status: number): HttpError => ({
  kind: 'http',
  raw: { status },
  requestId: `request-${status}`,
  retryable: false,
  status,
});

const err = (status: number): Result<never, HttpError> => ({
  error: httpError(status),
  ok: false,
});

const createStoreWithCommands = async (): Promise<QueueStore> => {
  vi.stubGlobal('indexedDB', undefined);
  const store = createQueueStore({ now: () => 1_720_000_000_000 });
  const commands = [
    { createdAt: 3, index: 3 },
    { createdAt: 1, index: 1 },
    { createdAt: 2, index: 2 },
  ];

  for (const command of commands) {
    const result = await store.addPendingCommand({
      command: { index: command.index },
      createdAt: command.createdAt,
      projectId: 'project-1',
    });

    expect(result.ok).toBe(true);
  }

  return store;
};

describe('replayer', () => {
  afterEach(() => {
    MockBroadcastChannel.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('replays queued commands in createdAt order when the network is online', async () => {
    const store = await createStoreWithCommands();
    const sentCommands: unknown[] = [];
    const idempotencyKeys: string[] = [];
    const sendCommand = vi.fn(async (command: unknown, context: { idempotencyKey: string }) => {
      sentCommands.push(command);
      idempotencyKeys.push(context.idempotencyKey);

      return ok({ synced: true });
    });
    const replayer = createReplayer({
      broadcastChannelFactory: (name) => new MockBroadcastChannel(name) as never,
      electionWindowMs: 0,
      isOnline: () => true,
      projectId: 'project-1',
      queueStore: store,
      sendCommand,
    });

    const status = await replayer.replayNow();
    const listResult = await store.listPendingCommands('project-1');

    expect(sendCommand).toHaveBeenCalledTimes(3);
    expect(sentCommands).toEqual([{ index: 1 }, { index: 2 }, { index: 3 }]);
    expect(new Set(idempotencyKeys).size).toBe(3);
    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.data).toHaveLength(0);
    }
    expect(status.pendingCommands).toBe(0);
    expect(status.lastSuccessfulSyncAt).not.toBeNull();
  });

  it('moves permanent 400 failures to deadLetter and keeps 429 failures pending', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createQueueStore({ now: () => 1_720_000_000_000 });
    await store.addPendingCommand({
      command: { index: 1 },
      createdAt: 1,
      projectId: 'project-1',
    });
    await store.addPendingCommand({
      command: { index: 2 },
      createdAt: 2,
      projectId: 'project-1',
    });
    const sendCommand = vi
      .fn<Parameters<typeof createReplayer>[0]['sendCommand']>()
      .mockResolvedValueOnce(err(400))
      .mockResolvedValueOnce(err(429));
    const replayer = createReplayer({
      broadcastChannelFactory: (name) => new MockBroadcastChannel(name) as never,
      electionWindowMs: 0,
      isOnline: () => true,
      projectId: 'project-1',
      queueStore: store,
      sendCommand,
    });

    const status = await replayer.replayNow();
    const listResult = await store.listPendingCommands('project-1');

    expect(sendCommand).toHaveBeenCalledTimes(2);
    expect(status.failedCommands).toBe(1);
    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.data.map((command) => command.command)).toEqual([{ index: 2 }]);
    }
  });

  it('allows only one simultaneous replayer to send commands across tabs', async () => {
    const store = await createStoreWithCommands();
    const firstSender = vi.fn(async () => ok({ synced: true }));
    const secondSender = vi.fn(async () => ok({ synced: true }));
    const firstReplayer = createReplayer({
      broadcastChannelFactory: (name) => new MockBroadcastChannel(name) as never,
      electionWindowMs: 0,
      idempotencyKeyFactory: (command) => `first-${command.id}`,
      isOnline: () => true,
      projectId: 'project-1',
      queueStore: store,
      sendCommand: firstSender,
    });
    const secondReplayer = createReplayer({
      broadcastChannelFactory: (name) => new MockBroadcastChannel(name) as never,
      electionWindowMs: 0,
      idempotencyKeyFactory: (command) => `second-${command.id}`,
      isOnline: () => true,
      projectId: 'project-1',
      queueStore: store,
      sendCommand: secondSender,
    });

    await Promise.all([firstReplayer.replayNow(), secondReplayer.replayNow()]);
    const listResult = await store.listPendingCommands('project-1');

    expect(firstSender.mock.calls.length + secondSender.mock.calls.length).toBe(3);
    expect([firstSender, secondSender].filter((sender) => sender.mock.calls.length > 0)).toHaveLength(1);
    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.data).toHaveLength(0);
    }
  });

  it('skips uploadDrawing marker commands: not sent, not dead-lettered, left in the queue (NO-402)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createQueueStore();
    const marker = { kind: 'uploadDrawing', fileName: 'tang-2.pdf', floorId: 'L2', projectId: 'project-1', sizeBytes: 4 };

    await store.addPendingCommand({ command: { index: 1 }, createdAt: 1, projectId: 'project-1' });
    await store.addPendingCommand({ command: marker, createdAt: 2, projectId: 'project-1' });
    await store.addPendingCommand({ command: { index: 3 }, createdAt: 3, projectId: 'project-1' });

    // Đường gửi thật không biết `uploadDrawing` (lệnh không mang `File`) nên trả 400.
    const sendCommand = vi.fn(async (command: unknown) =>
      (command as { kind?: string }).kind === 'uploadDrawing' ? err(400) : ok({ synced: true }),
    );
    const replayer = createReplayer({
      broadcastChannelFactory: (name) => new MockBroadcastChannel(name) as never,
      electionWindowMs: 0,
      isOnline: () => true,
      projectId: 'project-1',
      queueStore: store,
      sendCommand,
    });

    const status = await replayer.replayNow();
    const listResult = await store.listPendingCommands('project-1');

    expect(sendCommand.mock.calls.map(([command]) => command)).toEqual([{ index: 1 }, { index: 3 }]);
    expect(listResult.ok && listResult.data.map((pending) => pending.command)).toEqual([marker]);
    expect(status.deadLetterCommands).toBe(0);
    expect(status.pendingCommands).toBe(1);
  });

  it('offline: start only refreshes the count; network back online replays; stop unsubscribes', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('BroadcastChannel', undefined);
    const store = createQueueStore();
    await store.addPendingCommand({ command: { index: 1 }, createdAt: 1, projectId: 'project-1' });

    let online = false;
    let emitNetwork: (isOnline: boolean) => void = () => undefined;
    const unsubscribeNetwork = vi.fn();
    const sendCommand = vi.fn(async () => ok({ synced: true }));
    const statuses: number[] = [];
    const replayer = createReplayer({
      networkMonitor: {
        getStatus: () => ({ browserOnline: online, checkedAt: 0, online, pingOnline: online }),
        subscribe: (listener) => {
          emitNetwork = (isOnline) => listener({ browserOnline: isOnline, checkedAt: 0, online: isOnline, pingOnline: isOnline });
          return unsubscribeNetwork;
        },
      },
      projectId: 'project-1',
      queueStore: store,
      sendCommand,
    });
    const unsubscribe = replayer.subscribe((status) => statuses.push(status.pendingCommands));

    replayer.start();
    replayer.start();
    expect((await replayer.replayNow()).pendingCommands).toBe(1);
    expect(sendCommand).not.toHaveBeenCalled();

    online = true;
    emitNetwork(false);
    emitNetwork(true);
    await vi.waitFor(() => expect(replayer.getStatus().pendingCommands).toBe(0));
    expect(sendCommand).toHaveBeenCalledTimes(1);

    unsubscribe();
    const seen = statuses.length;
    await replayer.replayNow();
    expect(statuses).toHaveLength(seen);

    replayer.stop();
    expect(unsubscribeNetwork).toHaveBeenCalledTimes(1);
  });

  it('answers candidates while replaying and yields to an active runner in another tab', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createQueueStore();
    await store.addPendingCommand({ command: { index: 1 }, createdAt: 1, projectId: 'project-1' });

    const otherTab = new MockBroadcastChannel('offline-sync');
    const heard: unknown[] = [];
    otherTab.addEventListener('message', (event) => heard.push(event.data));

    let release: () => void = () => undefined;
    const sendCommand = vi.fn(
      () =>
        new Promise<Result<unknown, HttpError>>((resolve) => {
          release = () => resolve(ok({ synced: true }));
        }),
    );
    const replayer = createReplayer({
      broadcastChannelFactory: (name) => new MockBroadcastChannel(name) as never,
      electionWindowMs: 1,
      isOnline: () => true,
      projectId: 'project-1',
      queueStore: store,
      sendCommand,
    });

    const running = replayer.replayNow();
    await vi.waitFor(() => expect(sendCommand).toHaveBeenCalledTimes(1));

    otherTab.postMessage('noise');
    otherTab.postMessage({ ownerId: 'other', projectId: 'project-2', type: 'replay-candidate' });
    otherTab.postMessage({ ownerId: 'other', projectId: 'project-1', type: 'replay-candidate' });
    expect(heard).toContainEqual(expect.objectContaining({ projectId: 'project-1', type: 'replay-active' }));

    release();
    await running;

    // Một tab khác báo đang phát lại trong lúc bầu: tab này nhường.
    await store.addPendingCommand({ command: { index: 2 }, createdAt: 2, projectId: 'project-1' });
    otherTab.addEventListener('message', (event) => {
      const data = event.data as { type?: string };
      if (data.type === 'replay-candidate') {
        otherTab.postMessage({ ownerId: 'other', projectId: 'project-1', type: 'replay-active' });
        otherTab.postMessage({ ownerId: 'other', projectId: 'project-2', type: 'replay-active' });
      }
    });
    const status = await replayer.replayNow();

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(status.pendingCommands).toBe(1);
    replayer.stop();
    otherTab.close();
  });

  it('stops without losing commands when the queue fails or the error is not a permanent 4xx', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const base = createQueueStore();
    await base.addPendingCommand({ command: { index: 1 }, createdAt: 1, projectId: 'project-1' });
    const storageError = { isVolatile: true, kind: 'queue-storage' as const, message: 'hỏng' };
    const failing = (method: 'deletePendingCommand' | 'listPendingCommands' | 'moveToDeadLetter'): QueueStore => ({
      ...base,
      [method]: async () => ({ error: storageError, ok: false }),
    });
    const rejectWithoutStatus = async (): Promise<Result<never, HttpError>> => ({
      error: { ...httpError(400), status: undefined } as unknown as HttpError,
      ok: false,
    });
    const replayWith = (queueStore: QueueStore, sendCommand: () => Promise<Result<unknown, HttpError>>) =>
      createReplayer({
        broadcastChannelFactory: (name) => new MockBroadcastChannel(name) as never,
        electionWindowMs: 0,
        isOnline: () => true,
        projectId: 'project-1',
        queueStore,
        sendCommand,
      }).replayNow();

    expect((await replayWith(failing('listPendingCommands'), async () => ok(null))).pendingCommands).toBe(0);
    expect((await replayWith(failing('deletePendingCommand'), async () => ok(null))).pendingCommands).toBe(1);
    expect((await replayWith(failing('moveToDeadLetter'), async () => err(400))).deadLetterCommands).toBe(0);
    expect((await replayWith(base, async () => err(503))).pendingCommands).toBe(1);

    const status = await replayWith(base, rejectWithoutStatus);
    const remaining = await base.listPendingCommands('project-1');

    expect(status.deadLetterCommands).toBe(0);
    expect(remaining.ok && remaining.data).toHaveLength(1);
  });
});
