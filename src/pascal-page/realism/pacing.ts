/**
 * R12: nhịp khung theo tần số quét của màn. Vendor `frame-limiter` khoá 50 FPS theo đồng hồ tường: 50 không chia
 * đều 60/75/120/144 Hz nên khung hiện lệch nhịp (60 Hz: 17·17·17·33 ms, ~10 lần khựng mỗi giây) và delta báo cho
 * animation/camera bị làm tròn về bội 20 ms trong khi màn hiện mỗi 16,7 ms → xoay camera thấy giật.
 *
 * Ở đây: đo chu kỳ rAF (trung vị vài nhịp gần nhất), vẽ mỗi `n` nhịp với `n = floor(trần / chu kỳ)` ≥ 1 → khung
 * đều nhau và không chậm hơn trần (60 Hz → 60, 120 → 60, 144 → 72); delta = thời gian thật giữa hai khung.
 * Cùng dáng `FrameClock` của vendor (`sample`/`step`) để thay thẳng.
 */

const WINDOW = 15;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
}

export function createVsyncClock(initialTime = 0) {
  let frameTime = initialTime;
  let prevTick: number | null = null;
  let prevDraw: number | null = null;
  const gaps: number[] = [];

  return {
    sample(wallTimeMs: number, intervalMs: number): number | null {
      if (prevTick !== null) {
        gaps.push(wallTimeMs - prevTick);
        if (gaps.length > WINDOW) gaps.shift();
      }
      prevTick = wallTimeMs;
      if (prevDraw === null) {
        prevDraw = wallTimeMs;
        return null;
      }
      const elapsed = wallTimeMs - prevDraw;
      const vsync = gaps.length > 0 ? median(gaps) : elapsed;
      if (!(vsync > 0)) return null;
      // +0,05: màn 100 Hz với trần 20 ms đo ra 1,99x hay 2,01x vẫn cùng n = 2, không lật qua lại.
      const every = Math.max(1, Math.floor(intervalMs / vsync + 0.05));
      if (Math.round(elapsed / vsync) < every) return null;
      frameTime += elapsed / 1000;
      prevDraw = wallTimeMs;
      return frameTime;
    },
    step(seconds: number): number {
      frameTime += seconds;
      return frameTime;
    },
  };
}
