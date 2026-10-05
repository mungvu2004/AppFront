/**
 * Hỏi theo con trỏ của **máy chủ** — N36/N37 (F-12): số đo và nhật ký của lượt huấn luyện.
 *
 * Vì sao không dùng `./pollingChannel.ts`: kênh ấy tự tính con trỏ ở client
 * (`Math.max(sequence)`) và không bao giờ tự dừng. Ở đây `since` lượt sau là **đúng**
 * `nextCursor` server trả, và chỉ server biết lúc nào hết: vắng `nextCursor` (lượt đã kết
 * thúc quá cửa sổ muộn 600 s và đã đọc hết). Trang rỗng hay lượt vừa kết thúc **không**
 * phải lý do dừng.
 *
 * Luật:
 * - trang đầy (`items.length >= pageSize`) gọi tiếp ngay; chưa đầy (kể cả rỗng) chờ `intervalMs()`;
 * - dừng chỉ khi vắng `nextCursor` (`onDone`), `stop()`, hoặc `onError` trả `'stop'`;
 *   lỗi khác giữ nguyên `since`, thử ở nhịp sau;
 * - tab ẩn thì không hẹn giờ; hiện lại thì gọi ngay;
 * - `stop()` huỷ lượt đang chạy, bỏ kết quả về muộn, gỡ listener; gọi lặp vô hại.
 *
 * Thuần (`src/lib`): không biết `ApiResult` — nơi gọi tự đổi lỗi thành `throw`.
 */

import type { ChannelClock } from './eventChannel';
import type { PollingVisibilityTarget } from './pollingChannel';

export type { PollingVisibilityTarget } from './pollingChannel';

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export interface CursorPollingOptions<T> {
  /** Ném = lỗi. */
  fetchPage(input: { since: string | undefined; signal: AbortSignal }): Promise<CursorPage<T>>;
  pageSize: number;
  /** Đọc lại ở mỗi nhịp, nên nơi gọi đổi nhịp được khi lượt kết thúc. */
  intervalMs(): number;
  onItems(items: readonly T[]): void;
  onError?(error: unknown): 'stop' | 'retry' | void;
  onDone?(): void;
  since?: string | undefined;
  clock?: ChannelClock;
  visibilityTarget?: PollingVisibilityTarget;
}

export interface CursorPollingHandle {
  stop(): void;
}

type TimerId = ReturnType<ChannelClock['setTimeout']>;

const defaultClock: ChannelClock = {
  clearTimeout: (id) => clearTimeout(id),
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
};

export function startCursorPolling<T>({
  clock = defaultClock,
  fetchPage,
  intervalMs,
  onDone,
  onError,
  onItems,
  pageSize,
  since: initialSince,
  visibilityTarget = typeof document === 'undefined' ? undefined : document,
}: CursorPollingOptions<T>): CursorPollingHandle {
  let stopped = false;
  let since = initialSince;
  let inFlight: AbortController | null = null;
  let timer: TimerId | null = null;

  const isHidden = (): boolean => visibilityTarget?.hidden ?? false;

  function clearTimer(): void {
    if (timer === null) return;

    clock.clearTimeout(timer);
    timer = null;
  }

  function finish(): void {
    if (stopped) return;

    stopped = true;
    clearTimer();
    inFlight?.abort();
    inFlight = null;
    visibilityTarget?.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  function schedule(): void {
    clearTimer();

    if (stopped || isHidden()) return;

    timer = clock.setTimeout(() => {
      timer = null;
      void poll();
    }, intervalMs());
  }

  async function poll(): Promise<void> {
    if (stopped || isHidden() || inFlight !== null) return;

    const controller = new AbortController();
    inFlight = controller;

    let page: CursorPage<T>;

    try {
      page = await fetchPage({ signal: controller.signal, since });
    } catch (error) {
      if (inFlight !== controller) return;

      inFlight = null;

      if (onError?.(error) === 'stop') {
        finish();
        return;
      }

      schedule();
      return;
    }

    if (inFlight !== controller) return;

    inFlight = null;

    if (page.items.length > 0) onItems(page.items);

    if (page.nextCursor === undefined) {
      finish();
      onDone?.();
      return;
    }

    since = page.nextCursor;

    if (page.items.length >= pageSize) {
      void poll();
    } else {
      schedule();
    }
  }

  function handleVisibilityChange(): void {
    // Ẩn: bỏ hẹn giờ (`poll` tự từ chối khi ẩn). Hiện lại: gọi ngay, không chờ nhịp.
    clearTimer();
    void poll();
  }

  visibilityTarget?.addEventListener('visibilitychange', handleVisibilityChange);
  void poll();

  return { stop: finish };
}
