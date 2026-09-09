import type { z } from 'zod';

import { ProgressSchema } from '@/api/schemas';
import type { Progress } from '@/api/schemas';

import { createBackoff } from './backoff';

const STABLE_RESET_DELAY_MS = 30_000;

type TimerId = ReturnType<typeof setTimeout>;

export type ChannelStatus = 'dang-noi' | 'da-noi' | 'mat-ket-noi' | 'da-dong';

export interface ChannelState {
  status: ChannelStatus;
  attemptIndex: number;
  nextRetryAt: number | null;
}

export interface ChannelEvent<TData extends object = Progress> {
  type: string;
  data: TData;
}

export interface ChannelClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerId;
  clearTimeout(id: TimerId): void;
}

export interface CreateEventChannelOptions<TData extends object = Progress> {
  url: string;
  lastEventId?: string;
  onEvent: (event: ChannelEvent<TData>) => void;
  onStateChange: (state: ChannelState) => void;
  /**
   * Lược đồ dùng để đọc gói tin. Bỏ trống thì vẫn là `ProgressSchema`, nên mọi nơi gọi cũ
   * không đổi một chữ. `.strict()` của `ProgressSchema` không bị nới.
   *
   * Chú thích phải là `z.ZodType<TData, z.ZodTypeDef, unknown>` chứ không phải
   * `z.ZodType<TData>`: `ProgressSchema` là một `ZodEffects` (có `.transform()`) nên đầu
   * vào khác đầu ra, và dạng một tham số không biên dịch được với nó.
   */
  schema?: z.ZodType<TData, z.ZodTypeDef, unknown>;
  /** Nhãn gắn vào `ChannelEvent.type`. Bỏ trống thì vẫn là `'progress'`. */
  eventType?: string;
  clock?: ChannelClock;
  EventSourceImpl?: typeof EventSource;
  random?: () => number;
}

export interface EventChannelHandle {
  close(): void;
}

const defaultClock: ChannelClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

function appendLastEventId(baseUrl: string, lastEventId: string): string {
  if (lastEventId.length === 0) return baseUrl;

  try {
    const parsedUrl = new URL(baseUrl);
    parsedUrl.searchParams.set('lastEventId', lastEventId);
    return parsedUrl.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}lastEventId=${encodeURIComponent(lastEventId)}`;
  }
}

function warnInvalidEvent(reason: string, detail: unknown): void {
  console.warn(`[eventChannel] ${reason}`, detail);
}

export function createEventChannel<TData extends object = Progress>(
  options: CreateEventChannelOptions<TData>,
): EventChannelHandle {
  const {
    url,
    onEvent,
    onStateChange,
    // `ProgressSchema` chỉ hợp kiểu khi `TData` là `Progress`; ở dạng generic chưa giải,
    // trình biên dịch không biết điều đó, nên mặc định phải ép kiểu một lần tại đây.
    schema = ProgressSchema as unknown as z.ZodType<TData, z.ZodTypeDef, unknown>,
    eventType = 'progress',
    clock = defaultClock,
    EventSourceImpl = EventSource,
    random,
  } = options;

  const backoff = createBackoff({
    clock: { now: () => clock.now() },
    ...(random !== undefined ? { random } : {}),
  });

  let closed = false;
  let source: EventSource | null = null;
  let reconnectTimer: TimerId | null = null;
  let stableTimer: TimerId | null = null;
  let lastEventId = options.lastEventId ?? '';

  function emit(status: ChannelStatus, nextRetryAt: number | null = null): void {
    onStateChange({
      status,
      attemptIndex: backoff.attemptIndex(),
      nextRetryAt,
    });
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer === null) return;

    clock.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function clearStableTimer(): void {
    if (stableTimer === null) return;

    clock.clearTimeout(stableTimer);
    stableTimer = null;
  }

  function detachAndClose(target: EventSource): void {
    target.onopen = null;
    target.onmessage = null;
    target.onerror = null;
    target.close();
  }

  function closeCurrentSource(): void {
    if (source === null) return;

    detachAndClose(source);
    source = null;
  }

  function scheduleReconnect(): void {
    const delayMs = backoff.nextDelayMs();
    const nextRetryAt = clock.now() + delayMs;

    emit('mat-ket-noi', nextRetryAt);
    backoff.advance();

    reconnectTimer = clock.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
  }

  function connect(): void {
    if (closed) return;

    emit('dang-noi');

    const nextSource = new EventSourceImpl(appendLastEventId(url, lastEventId));
    source = nextSource;

    nextSource.onopen = () => {
      if (closed || source !== nextSource) return;

      backoff.markConnected();
      emit('da-noi');
      clearStableTimer();
      stableTimer = clock.setTimeout(() => {
        stableTimer = null;
        backoff.resetIfStable();
      }, STABLE_RESET_DELAY_MS);
    };

    nextSource.onmessage = (event: MessageEvent) => {
      if (closed || source !== nextSource) return;

      if (event.lastEventId.length > 0) {
        lastEventId = event.lastEventId;
      }

      let rawEvent: unknown;
      try {
        rawEvent = JSON.parse(String(event.data)) as unknown;
      } catch {
        warnInvalidEvent('invalid JSON event skipped', event.data);
        return;
      }

      const parsedEvent = schema.safeParse(rawEvent);
      if (!parsedEvent.success) {
        warnInvalidEvent('schema-invalid event skipped', parsedEvent.error.issues);
        return;
      }

      onEvent({ type: eventType, data: parsedEvent.data });
    };

    nextSource.onerror = () => {
      if (closed || source !== nextSource) return;

      clearStableTimer();
      closeCurrentSource();
      scheduleReconnect();
    };
  }

  connect();

  return {
    close(): void {
      if (closed) return;

      closed = true;
      clearReconnectTimer();
      clearStableTimer();
      closeCurrentSource();
      emit('da-dong');
    },
  };
}
