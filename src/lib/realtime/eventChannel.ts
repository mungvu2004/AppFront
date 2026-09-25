import type { z } from 'zod';

import { ProgressSchema } from '@/api/schemas';
import type { Progress } from '@/api/schemas';

import { createBackoff } from './backoff';

const STABLE_RESET_DELAY_MS = 30_000;
/** Số lỗi liên tiếp thì coi cookie luồng đã hết hạn và xin refresh (một lần mỗi chuỗi). */
const AUTH_REFRESH_FAILURE_THRESHOLD = 3;

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
  /**
   * Cookie luồng hết hạn thì `EventSource` chỉ thấy lỗi kết nối, không có mã trạng thái.
   * Đủ `AUTH_REFRESH_FAILURE_THRESHOLD` lỗi liên tiếp thì gọi hàm này một lần; trả `true`
   * thì nối lại ngay thay vì chờ lượt lùi. Bỏ trống: hành vi không đổi.
   */
  refreshAuth?: () => Promise<boolean>;
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
    refreshAuth,
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
  let consecutiveFailures = 0;

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

    /*
     * Đóng lượt cũ TRƯỚC khi mở lượt mới — `connect()` có hơn một người gọi.
     *
     * Lượt lùi và lượt gia hạn thành công đều gọi hàm này, và hai đường ấy
     * chồng nhau được: hẹn giờ lùi nổ ở giây thứ 4, còn cửa sổ chờ gia hạn rộng
     * tới `REFRESH_TIMEOUT_MS` (15 s). Gia hạn về SAU khi hẹn giờ đã bắn thì
     * `clearReconnectTimer()` là lệnh rỗng, và nếu không có dòng này thì
     * `source` cũ bị gán đè mà không ai đóng nó: trình duyệt tự nối lại cái bị
     * bỏ rơi ấy mãi, cộng dồn tới trần 6 kết nối/host rồi chặn mọi request
     * cùng origin. Dòng này làm `connect()` an toàn với MỌI người gọi, không
     * riêng ca ấy.
     */
    closeCurrentSource();

    emit('dang-noi');

    const nextSource = new EventSourceImpl(appendLastEventId(url, lastEventId));
    source = nextSource;

    nextSource.onopen = () => {
      if (closed || source !== nextSource) return;

      consecutiveFailures = 0;
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

      consecutiveFailures += 1;
      if (refreshAuth !== undefined && consecutiveFailures === AUTH_REFRESH_FAILURE_THRESHOLD) {
        void refreshAuth().then(
          (ok) => {
            if (!ok || closed) return;
            clearReconnectTimer();
            connect();
          },
          () => undefined,
        );
      }
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
