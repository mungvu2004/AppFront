import { beforeEach, describe, expect, it } from 'vitest';
import { __resetIdle, decide, HOLD_MS, markDirty, pollDirty, SETTLE_FRAMES, SETTLE_MAX_MS, shouldDraw } from './idle';
import { useRealism } from './store';

const cam = (x = 0) => {
  const e: number[] = Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0));
  e[12] = x;
  return { matrixWorld: { elements: e }, projectionMatrix: { elements: e } };
};
const none = { selectedObjects: [] as unknown[], hoveredObjects: [] as unknown[] };
const drawsAfter = (n: number, t: number) => Array.from({ length: n }, () => shouldDraw(t)).filter(Boolean).length;

describe('decide', () => {
  it('vẽ trong cửa sổ bẩn, rồi đúng SETTLE_FRAMES khung, rồi ngừng', () => {
    let s = { until: 100, settle: 2 };
    expect(decide(s, 50, true).draw).toBe(true);
    let r = decide(s, 200, true); expect(r.draw).toBe(true); s = r.next;
    r = decide(s, 201, true); expect(r.draw).toBe(true); s = r.next;
    expect(decide(s, 202, true).draw).toBe(false);
    expect(decide(s, 202, false).draw).toBe(true);
  });
  it('khung tích luỹ có trần SETTLE_MAX_MS (GPU chậm)', () => {
    expect(decide({ until: 100, settle: 5 }, 100 + SETTLE_MAX_MS + 1, true).draw).toBe(false);
  });
});

describe('idle', () => {
  beforeEach(() => {
    __resetIdle();
    useRealism.setState({ flags: { ...useRealism.getState().flags, idle: true } });
  });

  it('đứng yên → ngừng sau HOLD + SETTLE; markDirty → vẽ lại ngay', () => {
    pollDirty(cam(), none, 800, 600, 0);
    expect(drawsAfter(SETTLE_FRAMES + 10, HOLD_MS + 1)).toBe(SETTLE_FRAMES);
    expect(shouldDraw(1000)).toBe(false);
    markDirty('x', HOLD_MS, 1000);
    expect(shouldDraw(1001)).toBe(true);
  });

  it('camera đổi / hover / chọn / cỡ → bẩn; không đổi → không bẩn', () => {
    pollDirty(cam(), none, 800, 600, 0);
    drawsAfter(SETTLE_FRAMES, 500);
    pollDirty(cam(), none, 800, 600, 1000);
    expect(shouldDraw(1001)).toBe(false);
    pollDirty(cam(1), none, 800, 600, 2000);
    expect(shouldDraw(2001)).toBe(true);
    drawsAfter(SETTLE_FRAMES, 3000);
    pollDirty(cam(1), { selectedObjects: [], hoveredObjects: [{}] }, 800, 600, 4000);
    expect(shouldDraw(4001)).toBe(true);
    drawsAfter(SETTLE_FRAMES, 5000);
    pollDirty(cam(1), { selectedObjects: [{}], hoveredObjects: [] }, 800, 600, 6000);
    expect(shouldDraw(6001)).toBe(true);
    drawsAfter(SETTLE_FRAMES, 7000);
    pollDirty(cam(1), { selectedObjects: none.selectedObjects, hoveredObjects: [] }, 801, 600, 8000);
    expect(shouldDraw(8001)).toBe(true);
  });

  it('cờ idle tắt → luôn vẽ', () => {
    useRealism.setState({ flags: { ...useRealism.getState().flags, idle: false } });
    expect(drawsAfter(200, 99999)).toBe(200);
  });
});
