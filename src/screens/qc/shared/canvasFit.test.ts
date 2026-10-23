/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import {
  backgroundFrameRect,
  fitCanvasView,
  rotatedBounds,
  toFramePoint,
  toFrameRect,
  visibleDrawingRect,
} from './canvasFit';

/* Mặt bằng 8 × 6 m của run-26 ở tầng chưa hiệu chỉnh (1 mm = 1 px), tường 220 mm: hộp -110..8110. */
const PLAN = { x: -110, y: -110, width: 8220, height: 6220 };

describe('fitCanvasView (BUG-403)', () => {
  it('đặt cả mặt bằng vào giữa khung 375, chừa 10% lề, dù hệ số dưới 0,05', () => {
    const frame = { width: 295, height: 487 };
    const view = fitCanvasView(frame, PLAN);

    expect(view).not.toBeNull();
    const box = toFrameRect(view!, PLAN);

    expect(box.width).toBeCloseTo(frame.width * 0.9);
    expect(box.x).toBeCloseTo((frame.width - box.width) / 2);
    expect(box.y).toBeCloseTo((frame.height - box.height) / 2);
    expect(view!.zoom).toBeLessThan(0.05);
  });

  it('chưa đo được khung hoặc không có gì để phủ thì trả null', () => {
    expect(fitCanvasView(null, PLAN)).toBeNull();
    expect(fitCanvasView({ width: 0, height: 400 }, PLAN)).toBeNull();
    expect(fitCanvasView({ width: 400, height: 400 }, null)).toBeNull();
  });

  it('viewBox của khung là nghịch đảo của phép đặt lên khung', () => {
    const frame = { width: 718, height: 842 };
    const view = fitCanvasView(frame, PLAN)!;
    const visible = visibleDrawingRect(view, frame);
    const corner = toFramePoint(view, { x: visible.x, y: visible.y });

    expect(corner.x).toBeCloseTo(0);
    expect(corner.y).toBeCloseTo(0);
    expect(visible.width * view.zoom).toBeCloseTo(frame.width);
  });

  it('vòng chọn của ký hiệu xoay 90° đổi rộng/cao quanh tâm', () => {
    const box = rotatedBounds({ x: 0, y: 0, width: 900, height: 220 }, 90);

    expect(box.width).toBeCloseTo(220);
    expect(box.height).toBeCloseTo(900);
    expect(box.x + box.width / 2).toBeCloseTo(450);
    expect(box.y + box.height / 2).toBeCloseTo(110);
  });
});

describe('backgroundFrameRect (J-10)', () => {
  it('dat anh theo do phan giai that tu goc (0; 0) ban ve, khong theo khung tuong', () => {
    // Khung tuong 100..700 px ban ve hien o 50..350 px khung (zoom 0,5); anh that 900 x 600 px.
    const rect = backgroundFrameRect(
      { x: 100, y: 100, width: 600, height: 400 },
      { x: 50, y: 40, width: 300, height: 200 },
      { width: 900, height: 600 },
    );

    expect(rect).toEqual({ x: 0, y: -10, width: 450, height: 300 });
  });

  it('giu khung cu khi anh chua tai xong', () => {
    const frame = { x: 5, y: 6, width: 70, height: 80 };

    expect(backgroundFrameRect({ x: 0, y: 0, width: 10, height: 10 }, frame, null)).toBe(frame);
  });
});
