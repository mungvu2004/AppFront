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
});
