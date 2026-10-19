import { describe, expect, it } from 'vitest';

import { computeContentBoundsPx, fitMillimetresPerPixel } from './roomLabelCanvasGeometry';
import type { RoomLabelViewModel } from './roomLabelTypes';

/* Chỉ `outlineMm` được hai hàm này đọc. */
const room = {
  outlineMm: [
    { x: 6000, y: 1000 },
    { x: 8000, y: 1000 },
    { x: 8000, y: 3000 },
    { x: 6000, y: 3000 },
  ],
} as unknown as RoomLabelViewModel;

describe('room canvas fit (QA-1)', () => {
  it('the frame takes in the whole background drawing, not only the rooms', () => {
    const background = { widthMm: 10_000, heightMm: 5000 };
    const frame = { width: 1096, height: 596 };
    const scale = fitMillimetresPerPixel([room], 1, frame, background);
    const bounds = computeContentBoundsPx([room], scale, 48, background);

    expect(scale).toBeCloseTo(10_000 / 1000);
    expect(bounds).toEqual({ x: -48, y: -48, width: 1000 + 96, height: 500 + 96 });
  });

  it('without a known background size it still fits the rooms only', () => {
    expect(computeContentBoundsPx([room], 1, 0)).toEqual({ x: 6000, y: 1000, width: 2000, height: 2000 });
  });
});
