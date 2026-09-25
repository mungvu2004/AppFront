import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { Progress } from '@/api/schemas';
import {
  __resetAuthForTests,
  bootstrapSession,
  configureAuth,
  getSession,
  onAuthSignedOut,
  refreshSingleFlight,
} from '@/lib/auth';
import { __resetLastKnownUserForTests } from '@/lib/auth/bootstrap';
import type { AuthFetch } from '@/lib/auth/types';

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

  describe('refreshAuth', () => {
    beforeEach(() => {
      MockEventSource.instances = [];
    });

    // Đồng hồ giả: hẹn giờ chỉ chạy khi test gọi `flush`, nên "nối ngay" và "chờ lùi" phân biệt được.
    function makeManualClock(): ChannelClock & { flush(): void; pending(): number } {
      const timers = new Map<number, () => void>();
      let nextId = 0;
      return {
        now: () => 0,
        setTimeout: (fn) => {
          nextId += 1;
          timers.set(nextId, fn);
          return nextId as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimeout: (id) => {
          timers.delete(id as unknown as number);
        },
        flush: () => {
          const fns = [...timers.values()];
          timers.clear();
          fns.forEach((fn) => fn());
        },
        pending: () => timers.size,
      };
    }

    function failThrice(clock: { flush(): void }): void {
      last().triggerError();
      clock.flush();
      last().triggerError();
      clock.flush();
      last().triggerError();
    }

    function last(): MockEventSource {
      const source = MockEventSource.instances.at(-1);
      if (source === undefined) throw new Error('no source');
      return source;
    }

    it('calls refreshAuth once on the 3rd consecutive failure, not on 4th and 5th', () => {
      const clock = makeManualClock();
      const refreshAuth = vi.fn(() => new Promise<boolean>(() => undefined));
      const { handle } = makeChannel({ clock, refreshAuth });

      last().triggerError();
      clock.flush();
      last().triggerError();
      clock.flush();
      expect(refreshAuth).not.toHaveBeenCalled();
      last().triggerError();
      expect(refreshAuth).toHaveBeenCalledTimes(1);

      clock.flush();
      last().triggerError();
      clock.flush();
      last().triggerError();
      expect(refreshAuth).toHaveBeenCalledTimes(1);

      handle.close();
    });

    it('starts a new chain after an open', () => {
      const clock = makeManualClock();
      const refreshAuth = vi.fn(() => new Promise<boolean>(() => undefined));
      const { handle } = makeChannel({ clock, refreshAuth });

      for (let index = 0; index < 3; index += 1) {
        last().triggerError();
        clock.flush();
      }
      expect(refreshAuth).toHaveBeenCalledTimes(1);

      last().triggerOpen();
      for (let index = 0; index < 3; index += 1) {
        last().triggerError();
        clock.flush();
      }
      expect(refreshAuth).toHaveBeenCalledTimes(2);

      handle.close();
    });

    it('reconnects immediately when refreshAuth resolves true', async () => {
      const clock = makeManualClock();
      const { handle } = makeChannel({ clock, refreshAuth: () => Promise.resolve(true) });

      failThrice(clock);
      expect(MockEventSource.instances).toHaveLength(3);

      await Promise.resolve();
      await Promise.resolve();

      expect(MockEventSource.instances).toHaveLength(4);
      expect(clock.pending()).toBe(0);

      handle.close();
    });

    it.each([
      ['resolves false', () => Promise.resolve(false)],
      ['rejects', () => Promise.reject(new Error('boom'))],
    ])('only waits for the backoff when refreshAuth %s', async (_label, refreshAuth) => {
      const clock = makeManualClock();
      const { handle } = makeChannel({ clock, refreshAuth });

      failThrice(clock);
      await Promise.resolve();
      await Promise.resolve();

      expect(MockEventSource.instances).toHaveLength(3);
      expect(clock.pending()).toBe(1);
      clock.flush();
      expect(MockEventSource.instances).toHaveLength(4);

      handle.close();
    });

    it('does not reconnect when the channel is closed while refreshAuth is in flight', async () => {
      const clock = makeManualClock();
      let resolveRefresh: (ok: boolean) => void = () => undefined;
      const refreshAuth = () => new Promise<boolean>((resolve) => (resolveRefresh = resolve));
      const { handle } = makeChannel({ clock, refreshAuth });

      failThrice(clock);
      handle.close();
      resolveRefresh(true);
      await Promise.resolve();
      await Promise.resolve();

      expect(MockEventSource.instances).toHaveLength(3);
    });

    /**
     * Lượt lùi và lượt gia hạn CHỒNG nhau — đúng cái khe mà CON-01 sống trong đó.
     *
     * Mọi ca `refreshAuth` khác giải quyết promise trước `flush()` hoặc sau
     * `flush()`, nên hai đường gọi `connect()` không bao giờ gặp nhau. Ca này
     * cho hẹn giờ lùi NỔ TRƯỚC rồi mới để lượt gia hạn thành công về — tình
     * huống thật khi máy chủ chậm mà còn sống, và cửa sổ ấy rộng 11 giây
     * (`REFRESH_TIMEOUT_MS` 15 s trừ lượt lùi thứ ba 4 s).
     *
     * Đếm kết nối còn SỐNG chứ không đếm số lần dựng: số lần dựng vẫn tăng
     * đúng, thứ rò ra là cái không ai đóng.
     */
    it('leaves exactly one live EventSource when a slow refresh lands after the backoff fired', async () => {
      const clock = makeManualClock();
      let resolveRefresh: (ok: boolean) => void = () => undefined;
      const refreshAuth = () => new Promise<boolean>((resolve) => (resolveRefresh = resolve));
      const { handle } = makeChannel({ clock, refreshAuth });

      failThrice(clock);

      /* Hẹn giờ lùi nổ TRƯỚC — lượt gia hạn vẫn đang bay. */
      clock.flush();
      const afterBackoff = MockEventSource.instances.length;

      resolveRefresh(true);
      await Promise.resolve();
      await Promise.resolve();

      const live = MockEventSource.instances.filter((source) => !source.closed);
      expect(live).toHaveLength(1);
      expect(live[0]).toBe(MockEventSource.instances.at(-1));

      /* Lượt do gia hạn dựng thêm đúng một kết nối, và kết nối của lượt lùi đã đóng. */
      expect(MockEventSource.instances).toHaveLength(afterBackoff + 1);
      expect(MockEventSource.instances[afterBackoff - 1]?.closed).toBe(true);

      handle.close();
    });

    it('behaves as before when refreshAuth is absent', () => {
      const clock = makeManualClock();
      const { handle } = makeChannel({ clock });

      for (let index = 0; index < 5; index += 1) {
        last().triggerError();
        clock.flush();
      }

      expect(MockEventSource.instances).toHaveLength(6);

      handle.close();
    });

    /**
     * Mối nối giữa kênh này và tầng phiên thật — không giả `refreshAuth`.
     *
     * Đây là P1 mà review DEBT-01 bác FIX-097: trước khi tầng phiên biết phân
     * loại lỗi, một chuỗi lỗi SSE (cookie luồng hết hạn, máy chủ đang ốm) đi
     * thẳng thành một lượt ĐĂNG XUẤT phát ra mọi thẻ. Ca này nối đúng thứ
     * `notificationCenterGateway.ts` nối — `refreshSingleFlight({ source:
     * 'local' })` — và bắt lượt gia hạn ấy gặp 502.
     */
    describe('nối với tầng phiên thật', () => {
      let signedOut: ReturnType<typeof vi.fn>;
      let unsubscribe: () => void;

      beforeEach(() => {
        __resetAuthForTests();
        __resetLastKnownUserForTests();
        signedOut = vi.fn();
        unsubscribe = onAuthSignedOut(signedOut);
      });

      afterEach(() => {
        unsubscribe();
        __resetAuthForTests();
        __resetLastKnownUserForTests();
      });

      it('keeps the session signed in when the refresh behind three SSE failures hits a 502', async () => {
        const broadcast: unknown[] = [];
        let refreshCalls = 0;
        const fetchImpl: AuthFetch = async () => {
          refreshCalls += 1;

          if (refreshCalls === 1) {
            return new Response(
              JSON.stringify({
                accessToken: 'token-1',
                expiresAt: '2026-08-03T00:10:00.000Z',
                roles: ['engineer'],
                user: { id: 'u1' },
              }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          }

          return new Response(JSON.stringify({ code: 'DEPENDENCY_UNAVAILABLE' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 502,
          });
        };

        configureAuth({ baseUrl: 'https://api.example.com/api', fetchImpl });
        await bootstrapSession();
        expect(getSession().status).toBe('authenticated');

        const listenChannel = new BroadcastChannel('auth');
        listenChannel.addEventListener('message', (event: MessageEvent<unknown>) => {
          broadcast.push(event.data);
        });

        const clock = makeManualClock();
        const { handle } = makeChannel({
          clock,
          refreshAuth: () => refreshSingleFlight({ source: 'local' }),
        });

        failThrice(clock);
        // Ba lần nhường để lượt gia hạn và các `then` của nó chạy hết.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(refreshCalls).toBe(2);
        expect(getSession().status).toBe('authenticated');
        expect(getSession().serverUnreachable).toBe(true);
        expect(getSession().user?.id).toBe('u1');
        expect(signedOut).not.toHaveBeenCalled();
        expect(broadcast).toEqual([]);

        handle.close();
        listenChannel.close();
      });
    });
  });
});
