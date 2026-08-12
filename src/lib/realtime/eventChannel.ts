/**
 * eventChannel.ts — Kênh SSE với tự động nối lại và theo dõi tiến độ.
 *
 * Mở EventSource đến `url`, giải mã từng sự kiện bằng ProgressSchema (Zod),
 * bỏ qua sự kiện không hợp lệ và ghi cảnh báo.
 * Tự nối lại theo bậc mũ khi mất kết nối, gửi kèm lastEventId để server phát bù.
 * Phát trạng thái kênh qua onStateChange.
 *
 * Không phụ thuộc React.
 * Clock và EventSourceImpl có thể inject để kiểm thử đồng hồ giả.
 */

import { ProgressSchema } from '@/api/schemas';
import type { Progress } from '@/api/schemas';

import { createBackoff } from './backoff';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Trạng thái kênh SSE được phát qua onStateChange. */
export type ChannelState =
  | { status: 'dang-noi'; attemptIndex: number; nextRetryAt: number }
  | { status: 'da-noi' }
  | { status: 'mat-ket-noi'; attemptIndex: number; nextRetryAt: number }
  | { status: 'da-dong' };

/** Sự kiện đã giải mã được phát qua onEvent. */
export type ChannelEvent = { type: 'progress'; data: Progress };

/** Timer ID — dùng kiểu gốc của môi trường để tránh xung đột Node/DOM. */
type TimerId = ReturnType<typeof setTimeout>;

/**
 * Đồng hồ có thể inject để kiểm thử đồng hồ giả.
 * Mặc định sử dụng Date.now() và globalThis.setTimeout/clearTimeout.
 */
export interface ChannelClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerId;
  clearTimeout(id: TimerId): void;
}

export interface CreateEventChannelOptions {
  /** URL của SSE endpoint. */
  url: string;
  /** lastEventId khôi phục từ ngoài (ví dụ: storage). Gắn vào URL lần kết nối đầu. */
  lastEventId?: string;
  /** Callback khi nhận sự kiện hợp lệ đã giải mã. */
  onEvent: (event: ChannelEvent) => void;
  /** Callback khi trạng thái kênh thay đổi. */
  onStateChange: (state: ChannelState) => void;
  /** Inject cho kiểm thử. Mặc định: Date.now() + globalThis timer. */
  clock?: ChannelClock;
  /** Inject cho kiểm thử. Mặc định: globalThis.EventSource. */
  EventSourceImpl?: typeof EventSource;
  /** Inject cho kiểm thử backoff. Mặc định: Math.random. */
  random?: () => number;
}

export interface EventChannelHandle {
  /**
   * Đóng kênh vĩnh viễn.
   * Gỡ bỏ mọi hẹn giờ; sau lời gọi này không còn lần nối lại nào.
   */
  close(): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Thời gian chờ trước khi gọi resetIfStable() (phải bằng STABLE_THRESHOLD_MS trong backoff). */
const STABLE_RESET_DELAY_MS = 30_000;

// ---------------------------------------------------------------------------
// Default clock
// ---------------------------------------------------------------------------

const defaultClock: ChannelClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Thêm lastEventId vào URL dưới dạng query param.
 * Hỗ trợ cả URL tuyệt đối và tương đối.
 */
function buildConnectUrl(baseUrl: string, lastEventId: string): string {
  if (!lastEventId) return baseUrl;

  try {
    // URL tuyệt đối
    const u = new URL(baseUrl);
    u.searchParams.set('lastEventId', lastEventId);
    return u.toString();
  } catch {
    // URL tương đối — ghép query param thủ công
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}lastEventId=${encodeURIComponent(lastEventId)}`;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEventChannel(options: CreateEventChannelOptions): EventChannelHandle {
  const {
    url,
    onEvent,
    onStateChange,
    clock = defaultClock,
    EventSourceImpl = EventSource,
    random,
  } = options;

  let closed = false;
  let lastEventId = options.lastEventId ?? '';
  let currentEs: EventSource | null = null;
  let reconnectTimer: TimerId | null = null;
  let stableTimer: TimerId | null = null;

  const backoff = createBackoff({
    clock: { now: () => clock.now() },
    ...(random !== undefined ? { random } : {}),
  });

  // ── Timer helpers ──────────────────────────────────────────────────────────

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clock.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearStableTimer(): void {
    if (stableTimer !== null) {
      clock.clearTimeout(stableTimer);
      stableTimer = null;
    }
  }

  // ── EventSource helpers ────────────────────────────────────────────────────

  /** Gỡ tất cả handler rồi đóng EventSource để ngăn callback stale. */
  function detachAndClose(es: EventSource): void {
    es.onopen = null;
    es.onmessage = null;
    es.onerror = null;
    es.close();
  }

  // ── Core connect ───────────────────────────────────────────────────────────

  function connect(): void {
    if (closed) return;

    const connectUrl = buildConnectUrl(url, lastEventId);

    onStateChange({
      status: 'dang-noi',
      attemptIndex: backoff.attemptIndex(),
      nextRetryAt: clock.now(),
    });

    const es = new EventSourceImpl(connectUrl);
    currentEs = es;

    // ── onopen ──────────────────────────────────────────────────────────────

    es.onopen = () => {
      // Có thể race với close() nếu close() được gọi ngay trước khi onopen kịp chạy
      if (closed) {
        detachAndClose(es);
        return;
      }

      backoff.markConnected();
      onStateChange({ status: 'da-noi' });

      // Lên lịch kiểm tra reset sau 30 giây ổn định
      clearStableTimer();
      stableTimer = clock.setTimeout(() => {
        stableTimer = null;
        backoff.resetIfStable();
      }, STABLE_RESET_DELAY_MS);
    };

    // ── onmessage ───────────────────────────────────────────────────────────

    es.onmessage = (event: MessageEvent) => {
      if (closed) return;

      // Ghi nhớ lastEventId để gửi kèm khi nối lại
      if (event.lastEventId) {
        lastEventId = event.lastEventId;
      }

      // Giải mã JSON
      let raw: unknown;
      try {
        const dataStr = event.data as string;
        raw = JSON.parse(dataStr) as unknown;
      } catch {
        console.warn('[eventChannel] Không thể parse dữ liệu sự kiện SSE:', event.data);
        return;
      }

      // Xác thực schema
      const result = ProgressSchema.safeParse(raw);
      if (!result.success) {
        console.warn(
          '[eventChannel] Sự kiện SSE không khớp ProgressSchema:',
          result.error.issues,
        );
        return;
      }

      onEvent({ type: 'progress', data: result.data });
    };

    // ── onerror ─────────────────────────────────────────────────────────────

    es.onerror = () => {
      if (closed) return;

      // Đóng kết nối hiện tại và gỡ handler để tránh sự kiện stale
      detachAndClose(es);
      if (currentEs === es) {
        currentEs = null;
      }
      clearStableTimer();

      // Tính khoảng chờ (có jitter) trước khi advance() để dùng bậc hiện tại
      const delayMs = backoff.nextDelayMs();
      const nextRetryAt = clock.now() + delayMs;
      const attemptIndex = backoff.attemptIndex();

      backoff.advance();

      onStateChange({ status: 'mat-ket-noi', attemptIndex, nextRetryAt });

      reconnectTimer = clock.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };
  }

  // Khởi động ngay
  connect();

  // ── Handle ─────────────────────────────────────────────────────────────────

  return {
    close(): void {
      if (closed) return;
      closed = true;

      clearReconnectTimer();
      clearStableTimer();

      if (currentEs !== null) {
        detachAndClose(currentEs);
        currentEs = null;
      }

      onStateChange({ status: 'da-dong' });
    },
  };
}
