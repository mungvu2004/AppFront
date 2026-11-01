import { describe, expect, it } from 'vitest';

import { createVsyncClock } from './pacing';

/** Chạy đồng hồ trên màn `hz` (lệch ±0,3 ms mỗi nhịp) với trần 50 FPS; trả khoảng cách giữa các khung được vẽ + delta. */
function run(hz: number, seconds = 2) {
  const clock = createVsyncClock();
  const vsync = 1000 / hz;
  const shown: number[] = [];
  const times: number[] = [];
  for (let i = 0; i < hz * seconds; i++) {
    const t = i * vsync + ((i * 7919) % 7) * 0.1 - 0.3;
    const ft = clock.sample(t, 20);
    if (ft === null) continue;
    shown.push(t);
    times.push(ft * 1000);
  }
  const gaps = shown.slice(1).map((t, i) => t - shown[i]!);
  const deltas = times.slice(1).map((t, i) => t - times[i]!);
  return { gaps, deltas, vsync };
}

describe('createVsyncClock', () => {
  it.each([
    [60, 1],
    [75, 1],
    [100, 2],
    [120, 2],
    [144, 2],
    [165, 3],
    [240, 4],
  ])('%i Hz: vẽ đều mỗi %i nhịp, không dưới trần 50 FPS', (hz, every) => {
    const { gaps, vsync } = run(hz);
    // Bỏ vài khung đầu lúc chưa đo đủ chu kỳ.
    for (const gap of gaps.slice(WARM)) expect(Math.abs(gap - every * vsync)).toBeLessThan(1);
    expect(1000 / (every * vsync)).toBeGreaterThanOrEqual(50);
  });

  it('delta cho animation bằng thời gian thật giữa hai khung', () => {
    const { gaps, deltas } = run(60);
    deltas.forEach((d, i) => expect(d).toBeCloseTo(gaps[i]!, 6));
  });

  it('nhịp rAF chậm hơn trần (GPU bận) thì vẽ mỗi nhịp', () => {
    const clock = createVsyncClock();
    const drawn = [0, 40, 80, 120, 160].map((t) => clock.sample(t, 20));
    expect(drawn.slice(1).every((ft) => ft !== null)).toBe(true);
  });

  it('step giữ đồng hồ tăng dần từ mốc khởi đầu', () => {
    const clock = createVsyncClock(5);
    expect(clock.step(0.001)).toBeCloseTo(5.001);
  });
});

const WARM = 3;
