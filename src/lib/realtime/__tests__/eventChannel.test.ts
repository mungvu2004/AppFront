import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { Progress } from '@/api/schemas';

import { createBackoff } from '../backoff';
import { createEventChannel } from '../eventChannel';
import type {
  ChannelClock,
  ChannelEvent,
  ChannelState,
  CreateEventChannelOptions,
} from '../eventChannel';

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  triggerOpen(): void {
    this.onopen?.(new Event('open'));
  }

  triggerError(): void {
    this.onerror?.(new Event('error'));
  }

  triggerMessage(data: unknown, lastEventId = ''): void {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(data),
        lastEventId,
      }),
    );
  }

  triggerRawMessage(data: string, lastEventId = ''): void {
    this.onmessage?.(new MessageEvent('message', { data, lastEventId }));
  }
}

const VALID_PROGRESS = {
  id: 'progress-1',
  progressPercent: 42,
  status: 'running',
  step: 'doc ban ve',
} as const;

function makeClock(): ChannelClock {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
}

function makeChannel(
  overrides: Partial<CreateEventChannelOptions<Progress>> = {},
): {
  handle: ReturnType<typeof createEventChannel>;
  states: ChannelState[];
  events: ChannelEvent[];
} {
  const states: ChannelState[] = [];
  const events: ChannelEvent[] = [];

  const handle = createEventChannel({
    url: 'https://api.example.com/events',
    onEvent: (event) => events.push(event),
    onStateChange: (state) => states.push(state),
    clock: makeClock(),
    EventSourceImpl: MockEventSource as unknown as typeof EventSource,
    random: () => 0,
    ...overrides,
  });

  return { handle, states, events };
}

describe('createBackoff', () => {
  it('returns the required delay sequence without jitter', () => {
    const backoff = createBackoff({ random: () => 0 });
    const delays: number[] = [];

    for (let index = 0; index < 7; index += 1) {
      delays.push(backoff.nextDelayMs());
      backoff.advance();
    }

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });

  it('adds jitter from 0 to 200ms', () => {
    const backoff = createBackoff({ random: () => 0.999 });

    expect(backoff.nextDelayMs()).toBe(1_200);
  });

  it('resets the attempt index after a stable 30 second connection', () => {
    let now = 0;
    const backoff = createBackoff({ clock: { now: () => now }, random: () => 0 });

    backoff.advance();
    backoff.advance();
    expect(backoff.nextDelayMs()).toBe(4_000);

    backoff.markConnected();
    now = 30_000;
    backoff.resetIfStable();

    expect(backoff.attemptIndex()).toBe(0);
    expect(backoff.nextDelayMs()).toBe(1_000);
  });

  it('does not reset before the stable threshold', () => {
    let now = 0;
    const backoff = createBackoff({ clock: { now: () => now }, random: () => 0 });

    backoff.advance();
    backoff.markConnected();
    now = 29_999;
    backoff.resetIfStable();

    expect(backoff.attemptIndex()).toBe(1);
  });
});

describe('createEventChannel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emits the expected channel state sequence', async () => {
    const { states } = makeChannel();

    expect(states).toEqual([{ status: 'dang-noi', attemptIndex: 0, nextRetryAt: null }]);

    MockEventSource.instances[0]?.triggerOpen();
    expect(states.at(-1)).toEqual({ status: 'da-noi', attemptIndex: 0, nextRetryAt: null });

    MockEventSource.instances[0]?.triggerError();
    expect(states.at(-1)).toEqual({
      status: 'mat-ket-noi',
      attemptIndex: 0,
      nextRetryAt: 1_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(states.at(-1)).toEqual({ status: 'dang-noi', attemptIndex: 1, nextRetryAt: null });

    MockEventSource.instances[1]?.triggerOpen();
    expect(states.at(-1)).toEqual({ status: 'da-noi', attemptIndex: 1, nextRetryAt: null });
  });

  it('decodes valid progress events', () => {
    const { events } = makeChannel();

    MockEventSource.instances[0]?.triggerOpen();
    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS, 'event-1');

    expect(events).toEqual([
      {
        type: 'progress',
        data: {
          id: 'progress-1',
          progressPercent: 42,
          status: 'running',
          step: 'doc ban ve',
        },
      },
    ]);
  });

  it('skips invalid JSON events and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events } = makeChannel();

    MockEventSource.instances[0]?.triggerRawMessage('not-json');

    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('skips schema-invalid events and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events } = makeChannel();

    MockEventSource.instances[0]?.triggerMessage({ invalid: true }, 'invalid-event');

    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('uses the id of a received invalid event as the reconnect cursor', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    makeChannel();

    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS, 'event-10');
    MockEventSource.instances[0]?.triggerMessage({ invalid: true }, 'event-11');
    MockEventSource.instances[0]?.triggerError();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(MockEventSource.instances[1]?.url).toContain('lastEventId=event-11');
  });

  it('reconnects with the last valid event id', async () => {
    const { events } = makeChannel();

    MockEventSource.instances[0]?.triggerOpen();
    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS, 'event-42');
    MockEventSource.instances[0]?.triggerError();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(events).toHaveLength(1);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1]?.url).toContain('lastEventId=event-42');
  });

  it('uses the initial lastEventId on the first connection', () => {
    makeChannel({ lastEventId: 'restored-7' });

    expect(MockEventSource.instances[0]?.url).toContain('lastEventId=restored-7');
  });

  it('keeps the last valid id when a later message has no id', async () => {
    makeChannel();

    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS, 'event-10');
    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS);
    MockEventSource.instances[0]?.triggerError();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(MockEventSource.instances[1]?.url).toContain('lastEventId=event-10');
  });

  it('does not reconnect after close even if the clock advances 60 seconds', async () => {
    const { handle, states } = makeChannel();

    MockEventSource.instances[0]?.triggerOpen();
    MockEventSource.instances[0]?.triggerError();
    handle.close();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(MockEventSource.instances).toHaveLength(1);
    expect(states.at(-1)).toEqual({ status: 'da-dong', attemptIndex: 1, nextRetryAt: null });
  });

  it('ignores stale events after close', () => {
    const { handle, states } = makeChannel();

    handle.close();
    MockEventSource.instances[0]?.triggerOpen();
    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS, 'late-event');

    expect(states).toEqual([
      { status: 'dang-noi', attemptIndex: 0, nextRetryAt: null },
      { status: 'da-dong', attemptIndex: 0, nextRetryAt: null },
    ]);
  });

  it('resets reconnect delay after 30 stable seconds', async () => {
    const { states } = makeChannel();

    MockEventSource.instances[0]?.triggerOpen();
    MockEventSource.instances[0]?.triggerError();
    await vi.advanceTimersByTimeAsync(1_000);

    MockEventSource.instances[1]?.triggerOpen();
    await vi.advanceTimersByTimeAsync(30_000);
    MockEventSource.instances[1]?.triggerError();

    expect(states.at(-1)).toEqual({
      status: 'mat-ket-noi',
      attemptIndex: 0,
      nextRetryAt: 32_000,
    });
  });
});

/**
 * Kênh phải chở được gói tin KHÔNG phải `Progress`: lược đồ tiêm vào quyết định kiểu dữ
 * liệu, và nhãn tiêm vào quyết định `type`. Trước phương án A, cả hai đều bị khoá cứng.
 */
const NotificationSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['moi-du-an', 'binh-luan']),
    unread: z.boolean(),
  })
  .strict()
  .transform((wireNotification) => ({
    id: wireNotification.id,
    isUnread: wireNotification.unread,
    kind: wireNotification.kind,
  }));

type NotificationPayload = z.infer<typeof NotificationSchema>;

const VALID_NOTIFICATION = {
  id: 'notif-1',
  kind: 'moi-du-an',
  unread: true,
} as const;

function makeNotificationChannel(
  overrides: Partial<CreateEventChannelOptions<NotificationPayload>> = {},
): {
  handle: ReturnType<typeof createEventChannel>;
  states: ChannelState[];
  events: ChannelEvent<NotificationPayload>[];
} {
  const states: ChannelState[] = [];
  const events: ChannelEvent<NotificationPayload>[] = [];

  const handle = createEventChannel<NotificationPayload>({
    url: 'https://api.example.com/notifications',
    schema: NotificationSchema,
    eventType: 'notification',
    onEvent: (event) => events.push(event),
    onStateChange: (state) => states.push(state),
    clock: makeClock(),
    EventSourceImpl: MockEventSource as unknown as typeof EventSource,
    random: () => 0,
    ...overrides,
  });

  return { handle, states, events };
}

describe('createEventChannel with an injected schema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('decodes a non-progress packet into the injected schema output type', () => {
    const { handle, events } = makeNotificationChannel();

    MockEventSource.instances[0]?.triggerOpen();
    MockEventSource.instances[0]?.triggerMessage(VALID_NOTIFICATION, 'notif-event-1');

    expect(events).toEqual([
      {
        type: 'notification',
        data: { id: 'notif-1', isUnread: true, kind: 'moi-du-an' },
      },
    ]);

    // Kiểm ở mức kiểu: `data` phải là đầu ra của lược đồ tiêm vào, không phải `Progress`.
    const received: NotificationPayload | undefined = events[0]?.data;
    expect(received?.isUnread).toBe(true);

    handle.close();
  });

  it('labels the event with the injected eventType instead of progress', () => {
    const { handle, events } = makeNotificationChannel({ eventType: 'thong-bao' });

    MockEventSource.instances[0]?.triggerMessage(VALID_NOTIFICATION, 'notif-event-2');

    expect(events.map((event) => event.type)).toEqual(['thong-bao']);

    handle.close();
  });

  it('rejects a progress packet on a notification channel instead of letting it through', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handle, events } = makeNotificationChannel();

    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS, 'progress-on-notif');

    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();

    handle.close();
  });

  it('keeps the strict check of the injected schema for unknown fields', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handle, events } = makeNotificationChannel();

    MockEventSource.instances[0]?.triggerMessage(
      { ...VALID_NOTIFICATION, unexpected: 'x' },
      'notif-event-3',
    );

    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();

    handle.close();
  });

  it('still uses ProgressSchema and the progress label when both fields are omitted', () => {
    const { handle, events } = makeChannel();

    MockEventSource.instances[0]?.triggerMessage(VALID_PROGRESS, 'event-1');

    expect(events.map((event) => event.type)).toEqual(['progress']);
    expect(events[0]?.data.progressPercent).toBe(42);

    handle.close();
  });
});
