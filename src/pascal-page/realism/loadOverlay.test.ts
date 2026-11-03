/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { installLoadOverlay, LOAD_CAP_MS, LOAD_QUIET_MS, loadDone, PILL_STYLE } from './loadOverlay';

const idle = { builds: 5, buildsDone: 5, started: 3, done: 3, lastActivityAt: 1000 };

describe('loadDone', () => {
  it('gỡ khi có bản dựng mới, hết việc chờ và yên LOAD_QUIET_MS', () => {
    expect(loadDone(idle, 2, 0, 0, 0, 1000 + LOAD_QUIET_MS)).toBe(true);
    expect(loadDone(idle, 2, 0, 0, 0, 1000 + LOAD_QUIET_MS - 1)).toBe(false);
  });
  it('còn pipeline / bản dựng / ảnh / tệp đang tải → chưa gỡ; chưa có bản dựng mới → chưa gỡ', () => {
    const t = 1000 + LOAD_QUIET_MS;
    expect(loadDone({ ...idle, done: 2 }, 2, 0, 0, 0, t)).toBe(false);
    expect(loadDone({ ...idle, buildsDone: 4 }, 2, 0, 0, 0, t)).toBe(false);
    expect(loadDone({ ...idle, texWaiting: 1 }, 2, 0, 0, 0, t)).toBe(false);
    expect(loadDone(idle, 2, 1, 0, 0, t)).toBe(false);
    expect(loadDone(idle, 2, 0, t, 0, t)).toBe(false); // tệp vừa tải xong: chưa yên
    expect(loadDone(idle, 5, 0, 0, 0, t)).toBe(false);
  });
  it('quá LOAD_CAP_MS thì gỡ dù còn việc', () => {
    expect(loadDone({ ...idle, done: 0 }, 5, 3, 0, 0, LOAD_CAP_MS)).toBe(true);
  });
});

describe('installLoadOverlay', () => {
  const fakeDom = () => {
    const el = {
      style: {} as Record<string, string>,
      dataset: {} as Record<string, string>,
      attrs: {} as Record<string, string>,
      textContent: '',
      isConnected: true,
      setAttribute(k: string, v: string) {
        this.attrs[k] = v;
      },
      remove() {
        this.isConnected = false;
      },
    };
    vi.stubGlobal('document', { createElement: () => el });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    return { el, host: { appendChild: vi.fn() } as unknown as HTMLElement };
  };

  it('viên nhỏ giữa đáy, không che cảnh, không chặn chuột, trên nhãn phòng HTML', () => {
    expect(PILL_STYLE.pointerEvents).toBe('none');
    expect(PILL_STYLE).not.toHaveProperty('inset');
    expect(PILL_STYLE).not.toHaveProperty('width');
    expect(PILL_STYLE).not.toHaveProperty('height');
    expect(PILL_STYLE.left).toBe('50%');
    expect(PILL_STYLE.bottom).toMatch(/px$/);
    expect(Number(PILL_STYLE.zIndex)).toBeGreaterThan(16777271);
    const { el, host } = fakeDom();
    installLoadOverlay(host, () => ({ builds: 0, buildsDone: 0, started: 0, done: 0, lastActivityAt: 0 }), () => undefined);
    expect(el.attrs.role).toBe('status');
    expect(el.style.pointerEvents).toBe('none');
    expect(el.style.inset).toBeUndefined();
    expect(el.textContent).toContain('nội thất');
    vi.unstubAllGlobals();
  });

  it('gỡ đúng mốc (bắt đầu nạp + LOAD_CAP_MS) dù còn việc, kể cả gắn muộn', () => {
    vi.useFakeTimers();
    const { el, host } = fakeDom();
    const onDone = vi.fn();
    const busy = { builds: 9, buildsDone: 1, started: 0, done: 0, lastActivityAt: 0 };
    const deadline = performance.now() + LOAD_CAP_MS - 7_000; // nạp bắt đầu 7 s trước khi gắn nhãn
    installLoadOverlay(host, () => busy, onDone, deadline);
    vi.advanceTimersByTime(LOAD_CAP_MS - 7_000 - 200);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000);
    expect(el.isConnected).toBe(false);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
