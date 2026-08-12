/**
 * eventChannel.test.ts — Kiểm thử backoff.ts và eventChannel.ts với đồng hồ giả.
 *
 * Bộ test bắt buộc theo spec:
 *  1. Chuỗi khoảng chờ backoff đúng 1000/2000/4000/8000/16000/30000/30000.
 *  2. Nối lại có gửi kèm lastEventId đúng bằng id sự kiện cuối.
 *  3. close() rồi tua 60 giây — không có lần nối lại nào.
 *  4. Sự kiện không hợp lệ → onEvent không được gọi, console.warn được gọi.
 *  5. Chuỗi trạng thái: dang-noi → da-noi → mat-ket-noi → dang-noi → da-noi.
 *  6. Sau 30 giây ổn định, bậc reset về 0 và khoảng chờ tiếp là 1000ms.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBackoff } from '../backoff';
import { createEventChannel } from '../eventChannel';
import type { ChannelClock, ChannelEvent, ChannelState } from '../eventChannel';

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  // ── Test helpers ──────────────────────────────────────────────────────────

  triggerOpen(): void {
    this.onopen?.(new Event('open'));
  }

  triggerError(): void {
    this.onerror?.(new Event('error'));
  }

  /**
   * Mô phỏng sự kiện SSE từ server.
   * @param data     Dữ liệu thô (sẽ được JSON.stringify trước khi truyền vào handler).
   * @param lastEventId  Giá trị `id:` của sự kiện SSE.
   */
  triggerMessage(data: unknown, lastEventId = ''): void {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data),
      lastEventId,
    });
    this.onmessage?.(event);
  }
}

// ---------------------------------------------------------------------------
// Fixture & helpers
// ---------------------------------------------------------------------------

/** Progress hợp lệ theo ProgressSchema (chỉ các trường bắt buộc). */
const VALID_PROGRESS = {
  id: 'p-1',
  progressPercent: 42,
  status: 'running',
  step: 'analyze',
} as const;

/** Clock mặc định sử dụng hàm timer toàn cục (đã được vi.useFakeTimers() patch). */
const makeClock = (): ChannelClock => ({
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
});

/** Tạo kênh với EventSource mock và random=0 (bỏ jitter). */
function makeChannel(
  overrides: Partial<Parameters<typeof createEventChannel>[0]> = {},
): {
  handle: ReturnType<typeof createEventChannel>;
  states: ChannelState[];
  events: ChannelEvent[];
} {
  const states: ChannelState[] = [];
  const events: ChannelEvent[] = [];

  const handle = createEventChannel({
    url: 'https://api.example.com/events',
    onEvent: (e) => events.push(e),
    onStateChange: (s) => states.push(s),
    clock: makeClock(),
    EventSourceImpl: MockEventSource as unknown as typeof EventSource,
    random: () => 0,
    ...overrides,
  });

  return { handle, states, events };
}

// ---------------------------------------------------------------------------
// backoff.ts
// ---------------------------------------------------------------------------

describe('backoff.ts', () => {
  it('chuỗi khoảng chờ đúng 1000/2000/4000/8000/16000/30000/30000 khi bỏ jitter', () => {
    const backoff = createBackoff({ random: () => 0 });
    const delays: number[] = [];

    for (let i = 0; i < 7; i++) {
      delays.push(backoff.nextDelayMs());
      backoff.advance();
    }

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });

  it('giữ nguyên 30000ms sau khi vượt quá số phần tử trong mảng', () => {
    const backoff = createBackoff({ random: () => 0 });
    for (let i = 0; i < 20; i++) backoff.advance();
    expect(backoff.nextDelayMs()).toBe(30_000);
  });

  it('jitter nằm trong khoảng [0, 200] ms', () => {
    // random = 1.0 (giới hạn trên — Math.floor(1.0 * 201) = 201... trên thực tế random < 1)
    // Dùng 0.999 → Math.floor(0.999 * 201) = 200
    const backoff = createBackoff({ random: () => 0.999 });
    expect(backoff.nextDelayMs()).toBe(1_000 + 200);
  });

  it('reset về 1000ms sau 30 giây kết nối ổn định', () => {
    let now = 0;
    const backoff = createBackoff({ random: () => 0, clock: { now: () => now } });

    backoff.advance();
    backoff.advance();
    backoff.advance();
    expect(backoff.nextDelayMs()).toBe(8_000); // bậc 3

    backoff.markConnected();
    now = 30_000;
    backoff.resetIfStable();

    expect(backoff.attemptIndex()).toBe(0);
    expect(backoff.nextDelayMs()).toBe(1_000);
  });

  it('không reset nếu chưa đủ 30 giây', () => {
    let now = 0;
    const backoff = createBackoff({ random: () => 0, clock: { now: () => now } });

    backoff.advance();
    backoff.advance();

    backoff.markConnected();
    now = 29_999;
    backoff.resetIfStable();

    expect(backoff.attemptIndex()).toBe(2);
    expect(backoff.nextDelayMs()).toBe(4_000);
  });

  it('không reset nếu markConnected() chưa được gọi', () => {
    let now = 0;
    const backoff = createBackoff({ random: () => 0, clock: { now: () => now } });

    backoff.advance();
    now = 60_000;
    backoff.resetIfStable(); // không có connectedAt

    expect(backoff.attemptIndex()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// eventChannel.ts
// ---------------------------------------------------------------------------

describe('eventChannel.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── 1. Trạng thái kênh ──────────────────────────────────────────────────

  it('[trạng thái] dang-noi → da-noi → mat-ket-noi → dang-noi → da-noi', async () => {
    const { states } = makeChannel();

    // Lần kết nối đầu
    expect(states[0]?.status).toBe('dang-noi');
    expect(states[0]).toMatchObject({ status: 'dang-noi', attemptIndex: 0 });

    const es1 = MockEventSource.instances[0]!;
    es1.triggerOpen();
    expect(states[1]?.status).toBe('da-noi');

    es1.triggerError();
    expect(states[2]?.status).toBe('mat-ket-noi');
    expect(states[2]).toMatchObject({ status: 'mat-ket-noi', attemptIndex: 0 });
    // nextRetryAt = 0 + 1000
    if (states[2]?.status === 'mat-ket-noi') {
      expect(states[2].nextRetryAt).toBe(1_000);
    }

    // Chờ reconnect (bậc 0 = 1000ms, random=0)
    await vi.advanceTimersByTimeAsync(1_000);
    expect(states[3]?.status).toBe('dang-noi');
    expect(states[3]).toMatchObject({ status: 'dang-noi', attemptIndex: 1 });

    const es2 = MockEventSource.instances[1]!;
    es2.triggerOpen();
    expect(states[4]?.status).toBe('da-noi');
  });

  it('[trạng thái] close() phát da-dong và EventSource bị đóng', () => {
    const { handle, states } = makeChannel();

    MockEventSource.instances[0]!.triggerOpen();
    expect(states[1]?.status).toBe('da-noi');

    handle.close();
    expect(states[2]?.status).toBe('da-dong');
    expect(MockEventSource.instances[0]!.closed).toBe(true);
  });

  // ── 2. lastEventId ──────────────────────────────────────────────────────

  it('[lastEventId] URL nối lại chứa id của sự kiện cuối nhận được', async () => {
    const { events } = makeChannel();

    const es1 = MockEventSource.instances[0]!;
    es1.triggerOpen();
    es1.triggerMessage(VALID_PROGRESS, 'evt-42');
    expect(events).toHaveLength(1);

    es1.triggerError();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1]!.url).toContain('lastEventId=evt-42');
  });

  it('[lastEventId] URL đầu tiên không chứa lastEventId nếu không có sự kiện nào', async () => {
    makeChannel();

    expect(MockEventSource.instances[0]!.url).not.toContain('lastEventId');
  });

  it('[lastEventId] lastEventId khởi tạo từ options được đưa vào URL đầu tiên', () => {
    makeChannel({ lastEventId: 'restored-99' });

    expect(MockEventSource.instances[0]!.url).toContain('lastEventId=restored-99');
  });

  it('[lastEventId] chỉ cập nhật khi sự kiện có id; sự kiện không có id không xoá giá trị cũ', async () => {
    makeChannel();

    const es1 = MockEventSource.instances[0]!;
    es1.triggerOpen();
    es1.triggerMessage(VALID_PROGRESS, 'evt-10');
    // Sự kiện không có id
    es1.triggerMessage(VALID_PROGRESS, '');
    es1.triggerError();

    await vi.advanceTimersByTimeAsync(1_000);
    // lastEventId vẫn là 'evt-10'
    expect(MockEventSource.instances[1]!.url).toContain('lastEventId=evt-10');
  });

  // ── 3. close() ngăn reconnect ───────────────────────────────────────────

  it('[close] rồi tua 60 giây — không có lần nối lại nào', async () => {
    const { handle } = makeChannel();

    MockEventSource.instances[0]!.triggerOpen();
    MockEventSource.instances[0]!.triggerError();

    handle.close();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('[close] trước khi onopen — không phát sự kiện stale', async () => {
    const { handle, states } = makeChannel();

    // Đóng ngay sau khi EventSource được tạo, trước khi onopen kịp fire
    handle.close();
    // Giả lập onopen đến trễ
    MockEventSource.instances[0]!.triggerOpen();

    expect(states.at(-1)?.status).toBe('da-dong');
    // Không có trạng thái da-noi
    expect(states.some((s) => s.status === 'da-noi')).toBe(false);
  });

  it('[close] close() gọi hai lần không gây lỗi', () => {
    const { handle } = makeChannel();
    expect(() => {
      handle.close();
      handle.close();
    }).not.toThrow();
  });

  // ── 4. Sự kiện không hợp lệ ────────────────────────────────────────────

  it('[schema] sự kiện không hợp lệ → onEvent không được gọi, console.warn được gọi', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events } = makeChannel();

    MockEventSource.instances[0]!.triggerOpen();
    // Thiếu trường bắt buộc
    MockEventSource.instances[0]!.triggerMessage({ invalid: true });

    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('[schema] data không phải JSON → onEvent không được gọi, console.warn được gọi', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events } = makeChannel();

    const es1 = MockEventSource.instances[0]!;
    es1.triggerOpen();

    // Trigger với data thô không hợp lệ JSON (bypass triggerMessage helper)
    const badEvent = new MessageEvent('message', { data: 'not-json', lastEventId: '' });
    es1.onmessage?.(badEvent);

    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('[schema] sự kiện hợp lệ được giải mã và phát qua onEvent', () => {
    const { events } = makeChannel();

    MockEventSource.instances[0]!.triggerOpen();
    MockEventSource.instances[0]!.triggerMessage(VALID_PROGRESS);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('progress');
    expect(events[0]?.data.id).toBe('p-1');
    expect(events[0]?.data.progressPercent).toBe(42);
    expect(events[0]?.data.status).toBe('running');
  });

  // ── 5. Stable reset ─────────────────────────────────────────────────────

  it('[stable] sau 30 giây ổn định, bậc reset về 0 và khoảng chờ tiếp là 1000ms', async () => {
    const { states } = makeChannel();

    MockEventSource.instances[0]!.triggerOpen();
    // Tua 30 giây → stable timer fires → resetIfStable() → attempt = 0
    await vi.advanceTimersByTimeAsync(30_000);

    // Lỗi sau khi đã stable
    MockEventSource.instances[0]!.triggerError();

    const disconnected = states.find((s) => s.status === 'mat-ket-noi');
    expect(disconnected).toBeDefined();
    if (disconnected?.status === 'mat-ket-noi') {
      // Bậc 0 sau reset → 1000ms delay, nextRetryAt = 30000 + 1000
      expect(disconnected.nextRetryAt).toBe(31_000);
      expect(disconnected.attemptIndex).toBe(0);
    }
  });

  it('[stable] stable timer bị huỷ khi kết nối lỗi trước 30 giây', async () => {
    const { states } = makeChannel();

    MockEventSource.instances[0]!.triggerOpen();
    // Lỗi trước khi stable timer fire (tại t=10s)
    await vi.advanceTimersByTimeAsync(10_000);
    MockEventSource.instances[0]!.triggerError();

    // Tua thêm 20 giây (stable timer đã huỷ, không ảnh hưởng gì)
    await vi.advanceTimersByTimeAsync(20_000);

    const disconnected = states.find((s) => s.status === 'mat-ket-noi');
    expect(disconnected).toBeDefined();
    if (disconnected?.status === 'mat-ket-noi') {
      // Chưa stable → attempt 0 nhưng stable timer không fire, bậc bình thường
      expect(disconnected.attemptIndex).toBe(0);
    }
  });
});
