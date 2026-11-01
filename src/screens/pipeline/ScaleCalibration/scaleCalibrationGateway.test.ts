import { describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient } from '@/api/client';
import type { DetectedGeometry } from '@/api/schemas/quality';

import { createScaleCalibrationGateway } from './scaleCalibrationGateway';

const INPUT = { projectId: 'p1', floorId: 'f1' };
const box = (xMin: number, yMin: number, xMax: number, yMax: number) => ({ xMin, yMin, xMax, yMax });

const GEOMETRY: DetectedGeometry = {
  pagePx: [2000, 1500],
  wallThicknessPx: { median: 7, p90: 9 },
  snapPoints: [
    { x: 10, y: 20, kind: 'wallEnd' },
    { x: 30, y: 40, kind: 'junction' },
  ],
  doors: [
    { id: 'd1', box: box(0, 0, 10, 10), widthPx: 25, confidence: 0.9 },
    { id: 'd2', box: box(0, 0, 10, 10), widthPx: 31, confidence: 0.8 },
  ],
  largestRoom: { roomId: 'r1', boxPx: box(100, 200, 400, 600), label: 'Phòng khách' },
  outerBoxPx: box(50, 50, 1900, 1400),
};

function clientWith(detectedGeometry?: NonNullable<ApiClient['quality']['detectedGeometry']>): ApiClient {
  const base = createMockApiClient();
  const quality: ApiClient['quality'] = { ...base.quality };

  if (detectedGeometry === undefined) {
    delete quality.detectedGeometry;
  } else {
    quality.detectedGeometry = detectedGeometry;
  }

  return { ...base, quality };
}

describe('createScaleCalibrationGateway — detected-geometry', () => {
  it('đọc bề dày tường, cửa rộng nhất, phòng lớn nhất, điểm bắt từ một lượt gọi', async () => {
    const read = vi.fn(async () => ({ ok: true as const, data: GEOMETRY }));
    const gateway = createScaleCalibrationGateway(clientWith(read));

    const [wall, door, room, snaps] = await Promise.all([
      gateway.readReferenceWallWidth(INPUT),
      gateway.readTypicalDoorWidth(INPUT),
      gateway.readLargestRoomBox(INPUT),
      gateway.readSnapTargets(INPUT),
    ]);

    expect(read).toHaveBeenCalledTimes(1);
    expect(wall).toEqual({ supported: true, value: 7 });
    expect(door).toEqual({ supported: true, value: 31 });
    expect(room).toEqual({ supported: true, value: { widthPx: 300, heightPx: 400 } });
    expect(snaps.supported && snaps.value.map((t) => [t.kind, t.xPx, t.yPx])).toEqual([
      ['wallVertex', 10, 20],
      ['intersection', 30, 40],
    ]);
    expect(gateway.supports.snapTargets).toBe(true);
  });

  it('máy chủ cũ (404/501) → cả bốn việc lùi về unsupported, không ném', async () => {
    const read = vi.fn(async () => ({
      ok: false as const,
      error: { kind: 'http' as const, raw: {}, requestId: 'r', retryable: false, status: 501 },
    }));
    const gateway = createScaleCalibrationGateway(clientWith(read));

    const results = await Promise.all([
      gateway.readReferenceWallWidth(INPUT),
      gateway.readTypicalDoorWidth(INPUT),
      gateway.readLargestRoomBox(INPUT),
      gateway.readSnapTargets(INPUT),
    ]);

    expect(results.map((r) => r.supported)).toEqual([false, false, false, false]);
  });

  it('client không có endpoint (bộ mẫu) → unsupported, cờ supports tắt', async () => {
    const gateway = createScaleCalibrationGateway(clientWith());

    expect(gateway.supports.referenceWallWidth).toBe(false);
    expect((await gateway.readSnapTargets(INPUT)).supported).toBe(false);
  });

  it('lỗi mạng (ném) → unsupported', async () => {
    const gateway = createScaleCalibrationGateway(clientWith(vi.fn(async () => Promise.reject(new Error('net')))));

    expect((await gateway.readTypicalDoorWidth(INPUT)).supported).toBe(false);
  });
});
