import { describe, expect, it } from 'vitest';

import type { WallLayerCanvasShape } from './wallLayerHatch';
import { placeWallTag, WALL_TAG_OFFSET_PX, WALL_TAG_RIGHT_RESERVE_PX, WALL_TAG_TOP_RESERVE_PX, wallTagOf } from './wallTag';

const FRAME = { width: 1200, height: 800 };

describe('placeWallTag', () => {
  it('tường đứng: chip sang TRÁI 32 px (xa thẻ thông tin bên phải), neo ở trung điểm', () => {
    const placed = placeWallTag({ x: 500, y: 200 }, { x: 500, y: 600 }, FRAME);

    expect(placed?.anchorPx).toEqual({ x: 500, y: 400 });
    expect(placed?.tagPx).toEqual({ x: 500 - WALL_TAG_OFFSET_PX, y: 400 });
  });

  it('tường nằm: chip lên TRÊN, cùng kết quả khi đảo chiều tường', () => {
    const forward = placeWallTag({ x: 300, y: 400 }, { x: 600, y: 400 }, FRAME);
    const backward = placeWallTag({ x: 600, y: 400 }, { x: 300, y: 400 }, FRAME);

    expect(forward?.tagPx.y).toBeCloseTo(400 - WALL_TAG_OFFSET_PX);
    expect(forward?.tagPx.x).toBeCloseTo(450);
    expect(backward?.tagPx.x).toBeCloseTo(450);
    expect(backward?.tagPx.y).toBeCloseTo(400 - WALL_TAG_OFFSET_PX);
  });

  it('kẹp trong khung: không vào phần thẻ phải, không lên dải 60 px trên', () => {
    const nearRight = placeWallTag({ x: 1150, y: 300 }, { x: 1150, y: 500 }, FRAME);
    const nearTop = placeWallTag({ x: 300, y: 20 }, { x: 500, y: 20 }, FRAME);

    expect(nearRight!.tagPx.x).toBeLessThanOrEqual(FRAME.width - WALL_TAG_RIGHT_RESERVE_PX);
    expect(nearTop!.tagPx.y).toBeGreaterThanOrEqual(WALL_TAG_TOP_RESERVE_PX);
  });

  it('tường ngoài tầm nhìn: không có nhãn', () => {
    expect(placeWallTag({ x: -400, y: 100 }, { x: -200, y: 100 }, FRAME)).toBeNull();
  });
});

describe('wallTagOf', () => {
  it('ghép chữ dài × dày · tin cậy, đổi tim tường ra pixel khung theo khung nhìn', () => {
    const shape = {
      centrelinePx: { start: { x: 100, y: 100 }, end: { x: 100, y: 300 } },
      confidenceTier: 'certain',
    } as unknown as WallLayerCanvasShape;

    const tag = wallTagOf(shape, { lengthText: '3.450', thicknessText: '220' }, { x: 10, y: 20, zoom: 2 }, FRAME);

    expect(tag?.text).toBe('3.450 × 220 mm · Máy chắc chắn');
    expect(tag?.anchorPx).toEqual({ x: 210, y: 420 });
    expect(tag?.tier).toBe('certain');
  });
});
