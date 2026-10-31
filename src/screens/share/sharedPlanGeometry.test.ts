import { describe, expect, it } from 'vitest';

import type { Opening, Room, Wall } from '@/domain/spatial/types';

import { cameraViewBox, fitCamera, fitViewBox, MAX_ZOOM, openingSegment, panCamera, roomDisplayName, zoomCamera } from './sharedPlanGeometry';

const wall = (x1: number, y1: number, x2: number, y2: number) =>
  ({ centreline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } }) as unknown as Wall;

describe('mặt bằng trang chia sẻ', () => {
  it('[U43] tên phòng viết hoa chữ đầu cho khách', () => {
    expect(roomDisplayName('phòng ngủ 01')).toBe('Phòng ngủ 01');
    expect(roomDisplayName(' lô gia')).toBe('Lô gia');
    expect(roomDisplayName('đ')).toBe('Đ');
    expect(roomDisplayName('')).toBe('');
  });

  it('[U23] đệm tỉ lệ theo bản vẽ, không phải 500 đơn vị cố định', () => {
    const fit = fitViewBox([wall(0, 0, 600, 0), wall(600, 0, 600, 300)], []);
    expect(fit).not.toBeNull();
    // Bản vẽ 600 đơn vị: đệm 6% = 36 mỗi bên, khung chiếm ~89% chiều ngang.
    expect(fit?.w).toBeCloseTo(672);
    expect(600 / (fit?.w ?? 1)).toBeGreaterThan(0.85);
  });

  it('khung tính cả đường bao phòng, tầng trống thì null', () => {
    const room = { outline: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }] } as unknown as Room;
    expect(fitViewBox([], [])).toBeNull();
    expect(fitViewBox([], [room])?.x).toBeLessThan(-100);
  });

  it('phóng quanh con trỏ giữ điểm dưới trỏ đứng yên, và bị kẹp ở MAX_ZOOM', () => {
    const fit = { x: 0, y: 0, w: 100, h: 100 };
    const start = fitCamera(fit);
    const at = { x: 80, y: 20 };
    const zoomed = zoomCamera(start, 2, at);
    const before = cameraViewBox(fit, start);
    const after = cameraViewBox(fit, zoomed);
    expect((at.x - after.x) / after.w).toBeCloseTo((at.x - before.x) / before.w);
    expect(zoomCamera(start, 1000).zoom).toBe(MAX_ZOOM);
  });

  it('kéo sang phải thì tâm nhìn lùi sang trái', () => {
    expect(panCamera({ cx: 50, cy: 50, zoom: 1 }, 10, -5)).toEqual({ cx: 40, cy: 55, zoom: 1 });
  });

  it('đoạn cửa nằm trên tim tường từ offset tới offset + rộng, kẹp trong tường', () => {
    const opening = { offsetMm: 100, widthMm: 900 } as unknown as Opening;
    expect(openingSegment(wall(0, 0, 1000, 0), opening)).toEqual({ start: { x: 100, y: 0 }, end: { x: 1000, y: 0 } });
    expect(openingSegment(wall(5, 5, 5, 5), opening)).toBeNull();
  });
});
