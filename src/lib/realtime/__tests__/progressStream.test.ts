import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Progress } from '@/api/schemas';

import { mergeEvents, type ProgressPatchEvent } from '../mergeEvents';
import { createPollingChannel, POLL_INTERVAL_MS } from '../pollingChannel';
import { createProgressStream, SSE_RETRY_INTERVAL_MS, type ProgressStreamEvent } from '../progressStream';

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  triggerError(): void {
    this.onerror?.(new Event('error'));
  }

  triggerMessage(data: Progress, lastEventId = ''): void {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(data),
        lastEventId,
      }),
    );
  }

  triggerOpen(): void {
    this.onopen?.(new Event('open'));
  }
}

class MockVisibilityTarget {
  hidden: boolean;

  private readonly listeners = new Set<() => void>();

  constructor(hidden: boolean) {
    this.hidden = hidden;
  }

  addEventListener(type: 'visibilitychange', listener: () => void): void {
    if (type === 'visibilitychange') {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: 'visibilitychange', listener: () => void): void {
    if (type === 'visibilitychange') {
      this.listeners.delete(listener);
    }
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.listeners.forEach((listener) => listener());
  }
}

const makeProgress = (overrides: Partial<Progress> = {}): Progress => ({
  id: 'progress-1',
  progressPercent: 10,
  status: 'running',
  step: 'doc ban ve',
  ...overrides,
});

const makePatchEvent = (eventId: string, sequence: number, patch: Partial<Progress>): ProgressPatchEvent<Progress> => ({
  eventId,
  patch,
  sequence,
});

describe('createProgressStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('switches to polling after 3 SSE failures and stops polling when SSE reconnects', async () => {
    const events: ProgressStreamEvent[] = [];
    const fetchEvents = vi.fn(async () => [
      makePatchEvent('poll-1', 1, makeProgress({ progressPercent: 1 })),
    ]);

    const stream = createProgressStream({
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
      fetchEvents,
      onEvent: (event) => events.push(event),
      random: () => 0,
      url: 'https://api.example.com/events',
    });

    MockEventSource.instances[0]?.triggerError();
    await vi.advanceTimersByTimeAsync(1_000);
    MockEventSource.instances[1]?.triggerError();
    await vi.advanceTimersByTimeAsync(2_000);
    MockEventSource.instances[2]?.triggerError();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchEvents).toHaveBeenCalledOnce();
    expect(events).toEqual([
      expect.objectContaining({
        eventId: 'poll-1',
        sequence: 1,
        source: 'polling',
      }),
    ]);

    await vi.advanceTimersByTimeAsync(SSE_RETRY_INTERVAL_MS);
    expect(MockEventSource.instances).toHaveLength(4);

    const retrySource = MockEventSource.instances[3];
    expect(retrySource).toBeDefined();
    retrySource?.triggerOpen();

    const fetchCountAfterSseOpen = fetchEvents.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fetchEvents).toHaveBeenCalledTimes(fetchCountAfterSseOpen);

    retrySource?.triggerMessage(makeProgress({ id: 'sse-1', progressPercent: 2 }), 'sse-event-1');
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        eventId: 'sse-1',
        sequence: 2,
        source: 'sse',
      }),
    );

    stream.close();
  });

  it('applies duplicate eventId only once', () => {
    const events: ProgressStreamEvent[] = [];
    const fetchEvents = vi.fn(async () => []);

    const stream = createProgressStream({
      EventSourceImpl: MockEventSource as unknown as typeof EventSource,
      fetchEvents,
      onEvent: (event) => events.push(event),
      random: () => 0,
      url: 'https://api.example.com/events',
    });

    MockEventSource.instances[0]?.triggerOpen();
    MockEventSource.instances[0]?.triggerMessage(makeProgress({ id: 'same-event', progressPercent: 10 }));
    MockEventSource.instances[0]?.triggerMessage(makeProgress({ id: 'same-event', progressPercent: 20 }));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        eventId: 'same-event',
        sequence: 10,
      }),
    );

    stream.close();
  });
});

describe('createPollingChannel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not poll while hidden and polls immediately when visible', async () => {
    const visibilityTarget = new MockVisibilityTarget(true);
    const fetchEvents = vi.fn(async () => []);

    const channel = createPollingChannel({
      fetchEvents,
      onEvent: vi.fn(),
      visibilityTarget,
    });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fetchEvents).not.toHaveBeenCalled();

    visibilityTarget.setHidden(false);
    expect(fetchEvents).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fetchEvents).toHaveBeenCalledTimes(2);

    visibilityTarget.setHidden(true);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fetchEvents).toHaveBeenCalledTimes(2);

    visibilityTarget.setHidden(false);
    expect(fetchEvents).toHaveBeenCalledTimes(3);

    channel.close();
  });
});

describe('mergeEvents', () => {
  it('sorts patches, drops older events, and keeps partial progress state', () => {
    const result = mergeEvents<Progress>({
      current: { id: 'progress-1', progressPercent: 20 },
      incoming: [
        makePatchEvent('event-3', 3, { status: 'running' }),
        makePatchEvent('event-1', 1, { progressPercent: 10 }),
        makePatchEvent('event-2', 2, { step: 'nhan dien tuong' }),
      ],
      lastAppliedSequence: 1,
    });

    expect(result.events.map((event) => event.eventId)).toEqual(['event-2', 'event-3']);
    expect(result.current).toEqual({
      id: 'progress-1',
      progressPercent: 20,
      status: 'running',
      step: 'nhan dien tuong',
    });
    expect(result.lastAppliedSequence).toBe(3);
  });
});
