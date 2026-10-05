/**
 * `startCursorPolling` — mỗi luật của F-12 [6] mục 3 một test. Đồng hồ giả của vitest,
 * `visibilityTarget` giả; `fetchPage` trả lần lượt các trang trong hàng đợi.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelClock } from '../eventChannel';
import { startCursorPolling, type CursorPage, type PollingVisibilityTarget } from '../cursorPolling';

const INTERVAL_MS = 5_000;
const PAGE_SIZE = 3;

interface FakeVisibility extends PollingVisibilityTarget {
  hidden: boolean;
  listeners: Set<() => void>;
  set(hidden: boolean): void;
}

function createVisibility(hidden = false): FakeVisibility {
  const listeners = new Set<() => void>();
  const target: FakeVisibility = {
    addEventListener: (_type, listener) => listeners.add(listener),
    hidden,
    listeners,
    removeEventListener: (_type, listener) => listeners.delete(listener),
    set(next) {
      target.hidden = next;
      listeners.forEach((listener) => listener());
    },
  };

  return target;
}

type Step = CursorPage<number> | Error;

/** `fetchPage` giả: mỗi lượt lấy một bước; hết bước thì trả trang rỗng giữ con trỏ. */
function createFetch(steps: Step[]) {
  const calls: { since: string | undefined; signal: AbortSignal }[] = [];
  const fetchPage = vi.fn(async (input: { since: string | undefined; signal: AbortSignal }) => {
    calls.push(input);
    const step = steps.shift() ?? { items: [], nextCursor: input.since ?? 'c0' };

    if (step instanceof Error) throw step;

    return step;
  });

  return { calls, fetchPage };
}

const full = (from: number, nextCursor?: string): CursorPage<number> => ({
  items: Array.from({ length: PAGE_SIZE }, (_, index) => from + index),
  ...(nextCursor !== undefined ? { nextCursor } : {}),
});

describe('startCursorPolling', () => {
  let visibility: FakeVisibility;

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = createVisibility();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('since lượt sau = đúng nextCursor server trả; lượt đầu vắng since', async () => {
    const { calls, fetchPage } = createFetch([
      { items: [1], nextCursor: 'opaque-A' },
      { items: [], nextCursor: 'opaque-B' },
    ]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(calls.map((call) => call.since)).toEqual([undefined, 'opaque-A', 'opaque-B']);
    handle.stop();
  });

  it('since ban đầu từ tuỳ chọn được gửi ở lượt đầu', async () => {
    const { calls, fetchPage } = createFetch([]);

    startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, since: 'resume', visibilityTarget: visibility }).stop();
    await vi.advanceTimersByTimeAsync(0);

    expect(calls[0]?.since).toBe('resume');
  });

  it('trang đầy (items.length >= pageSize) gọi tiếp ngay, không chờ nhịp', async () => {
    const onItems = vi.fn();
    const { calls, fetchPage } = createFetch([full(0, 'p1'), full(3, 'p2'), { items: [6], nextCursor: 'p3' }]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems, pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);

    expect(calls.map((call) => call.since)).toEqual([undefined, 'p1', 'p2']);
    expect(onItems.mock.calls).toEqual([[[0, 1, 2]], [[3, 4, 5]], [[6]]]);
    handle.stop();
  });

  it('pageSize 200: trang 200 mục gọi tiếp ngay', async () => {
    const page200: CursorPage<number> = { items: Array.from({ length: 200 }, (_, index) => index), nextCursor: 'n1' };
    const { calls, fetchPage } = createFetch([page200]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: 200, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toHaveLength(2);
    handle.stop();
  });

  it('trang chưa đầy hoặc rỗng chờ intervalMs() rồi mới gọi; rỗng không gọi onItems', async () => {
    const onItems = vi.fn();
    const intervalMs = vi.fn(() => INTERVAL_MS);
    const { fetchPage } = createFetch([{ items: [], nextCursor: 'e1' }, { items: [1], nextCursor: 'e2' }]);

    const handle = startCursorPolling({ fetchPage, intervalMs, onItems, pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(onItems).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS - 1);
    expect(fetchPage).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(onItems).toHaveBeenCalledWith([1]);
    expect(intervalMs).toHaveBeenCalled();
    handle.stop();
  });

  it('vắng nextCursor → onDone, gỡ listener, 60 s giả sau không gọi thêm', async () => {
    const onDone = vi.fn();
    const onItems = vi.fn();
    const { fetchPage } = createFetch([{ items: [1, 2] }]);

    startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onDone, onItems, pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);
    expect(onItems).toHaveBeenCalledWith([1, 2]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(visibility.listeners.size).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('trang đầy nhưng vắng nextCursor vẫn dừng', async () => {
    const onDone = vi.fn();
    const { fetchPage } = createFetch([full(0)]);

    startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onDone, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('không dừng vì trang rỗng: rỗng nhiều nhịp liền vẫn hỏi tiếp', async () => {
    const onDone = vi.fn();
    const { fetchPage } = createFetch([]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onDone, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 4);
    expect(fetchPage).toHaveBeenCalledTimes(5);
    expect(onDone).not.toHaveBeenCalled();
    handle.stop();
  });

  it('lỗi khác (onError không trả stop) giữ nguyên since, thử ở nhịp sau', async () => {
    const onError = vi.fn(() => 'retry' as const);
    const { calls, fetchPage } = createFetch([{ items: [1], nextCursor: 'k1' }, new Error('mạng'), { items: [], nextCursor: 'k2' }]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onError, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(calls.map((call) => call.since)).toEqual([undefined, 'k1', 'k1']);
    handle.stop();
  });

  it('lỗi khi không có onError (hoặc onError trả void) cũng thử lại ở nhịp sau', async () => {
    const { fetchPage } = createFetch([new Error('503')]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    handle.stop();
  });

  it("onError trả 'stop' thì dừng hẳn, không onDone, gỡ listener", async () => {
    const onDone = vi.fn();
    const failure = new Error('403');
    const onError = vi.fn(() => 'stop' as const);
    const { fetchPage } = createFetch([failure]);

    startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onDone, onError, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(visibility.listeners.size).toBe(0);
  });

  it('tab ẩn lúc khởi động: không gọi, không hẹn giờ; hiện lại gọi ngay', async () => {
    visibility = createVisibility(true);
    const { fetchPage } = createFetch([]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchPage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    visibility.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it('ẩn giữa chừng: bỏ hẹn giờ đang chờ; hiện lại gọi ngay với since đang giữ', async () => {
    const { calls, fetchPage } = createFetch([{ items: [1], nextCursor: 'h1' }]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);
    visibility.set(true);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchPage).toHaveBeenCalledTimes(1);

    visibility.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.map((call) => call.since)).toEqual([undefined, 'h1']);
    handle.stop();
  });

  it('ẩn trong lúc lượt đang chạy: nhận kết quả nhưng không hẹn nhịp sau, kể cả trang đầy', async () => {
    let release: (page: CursorPage<number>) => void = () => undefined;
    const onItems = vi.fn();
    const fetchPage = vi.fn(
      () =>
        new Promise<CursorPage<number>>((resolve) => {
          release = resolve;
        }),
    );

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems, pageSize: PAGE_SIZE, visibilityTarget: visibility });

    visibility.set(true);
    release(full(0, 'x1'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(onItems).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it('ẩn trong lúc lượt đang chạy, trang chưa đầy: không hẹn giờ', async () => {
    let release: (page: CursorPage<number>) => void = () => undefined;
    const fetchPage = vi.fn(
      () =>
        new Promise<CursorPage<number>>((resolve) => {
          release = resolve;
        }),
    );

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    visibility.set(true);
    release({ items: [1], nextCursor: 'y1' });
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
    handle.stop();
  });

  it('hiện lại khi lượt đang chạy thì không gọi chồng', async () => {
    const fetchPage = vi.fn(() => new Promise<CursorPage<number>>(() => undefined));

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    visibility.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it('stop() huỷ lượt đang chạy, bỏ kết quả về muộn, gỡ listener, gọi lặp vô hại', async () => {
    let release: (page: CursorPage<number>) => void = () => undefined;
    let signal: AbortSignal | undefined;
    const onItems = vi.fn();
    const onDone = vi.fn();
    const fetchPage = vi.fn(
      (input: { signal: AbortSignal }) =>
        new Promise<CursorPage<number>>((resolve) => {
          signal = input.signal;
          release = resolve;
        }),
    );

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onDone, onItems, pageSize: PAGE_SIZE, visibilityTarget: visibility });

    handle.stop();
    expect(signal?.aborted).toBe(true);
    expect(visibility.listeners.size).toBe(0);

    release({ items: [1] });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onItems).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(fetchPage).toHaveBeenCalledTimes(1);

    expect(() => handle.stop()).not.toThrow();
    visibility.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('stop() trong lúc lượt đang chạy rồi lượt ấy ném lỗi: không gọi onError', async () => {
    let fail: (error: Error) => void = () => undefined;
    const onError = vi.fn();
    const fetchPage = vi.fn(
      () =>
        new Promise<CursorPage<number>>((_resolve, reject) => {
          fail = reject;
        }),
    );

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onError, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    handle.stop();
    fail(new DOMException('aborted', 'AbortError'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onError).not.toHaveBeenCalled();
  });

  it('onItems gọi stop(): không onDone, không hẹn nhịp sau, kể cả trang cuối hay trang đầy', async () => {
    for (const page of [{ items: [1] }, full(1, 'c1'), { items: [1], nextCursor: 'c1' }]) {
      const { fetchPage } = createFetch([page]);
      const onDone = vi.fn();
      const handle = startCursorPolling({
        fetchPage,
        intervalMs: () => INTERVAL_MS,
        onDone,
        onItems: () => handle.stop(),
        pageSize: PAGE_SIZE,
        visibilityTarget: visibility,
      });

      await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);

      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it('stop() khi đang chờ nhịp: bỏ hẹn giờ', async () => {
    const { fetchPage } = createFetch([{ items: [], nextCursor: 's1' }]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    handle.stop();
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('dùng clock tiêm vào cho hẹn giờ', async () => {
    const scheduled: { fn: () => void; ms: number }[] = [];
    const clock: ChannelClock = {
      clearTimeout: vi.fn(),
      now: () => 0,
      setTimeout: (fn, ms) => {
        scheduled.push({ fn, ms });
        return setTimeout(() => undefined, 0);
      },
    };
    const { fetchPage } = createFetch([{ items: [], nextCursor: 'c1' }]);

    const handle = startCursorPolling({ clock, fetchPage, intervalMs: () => 15_000, onItems: vi.fn(), pageSize: PAGE_SIZE, visibilityTarget: visibility });

    await vi.advanceTimersByTimeAsync(0);
    expect(scheduled.map((entry) => entry.ms)).toEqual([15_000]);

    scheduled[0]?.fn();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchPage).toHaveBeenCalledTimes(2);

    handle.stop();
    expect(clock.clearTimeout).toHaveBeenCalled();
  });

  it('không có document (worker, node) thì vẫn hỏi, không cần visibilityTarget', async () => {
    const { fetchPage } = createFetch([]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE });

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    handle.stop();
  });

  it('có document thì mặc định nghe visibilitychange của nó', async () => {
    vi.stubGlobal('document', visibility);
    const { fetchPage } = createFetch([]);

    const handle = startCursorPolling({ fetchPage, intervalMs: () => INTERVAL_MS, onItems: vi.fn(), pageSize: PAGE_SIZE });

    expect(visibility.listeners.size).toBe(1);
    handle.stop();
    expect(visibility.listeners.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
