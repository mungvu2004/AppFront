import { describe, expect, it } from 'vitest';

import {
  computeContentBoundsPx,
  fitMillimetresPerPixel,
  focusViewOf,
  frameRectOf,
  shortRoomName,
} from './roomLabelCanvasGeometry';
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

describe('shortRoomName (K16)', () => {
  it('rút tên dài về tên ngắn để ghi trên bản vẽ', () => {
    expect(shortRoomName('phòng tắm 1')).toBe('WC 1');
    expect(shortRoomName('Nhà vệ sinh')).toBe('WC');
    expect(shortRoomName('phòng ngủ 2')).toBe('Ngủ 2');
    expect(shortRoomName('Phòng khách')).toBe('Khách');
    expect(shortRoomName('phòng kỹ thuật')).toBe('Kỹ thuật');
    expect(shortRoomName('bếp')).toBe('bếp');
  });
});

describe('L23 Từng việc — phóng tới phòng', () => {
  it('hộp nhìn vừa khung, tâm đúng giữa khung', () => {
    const content = { x: -40, y: -30, width: 800, height: 500 };
    const frame = { width: 1000, height: 600 };
    const basePan = { x: 100, y: 50 };
    const focus = { x: 300, y: 100, width: 320, height: 200 };
    const view = focusViewOf(focus, content, frame, basePan);
    expect(view.zoomPct).toBe(300);

    const shown = frameRectOf(
      focus,
      content,
      { x: basePan.x + view.offset.x, y: basePan.y + view.offset.y },
      view.zoomPct / 100,
    );
    expect(shown.x + shown.width / 2).toBeCloseTo(frame.width / 2);
    expect(shown.y + shown.height / 2).toBeCloseTo(frame.height / 2);
    expect(shown.height).toBeCloseTo(frame.height);
    expect(shown.width).toBeLessThanOrEqual(frame.width);
  });

  it('scale 1, không dời: hộp chỉ trừ gốc nội dung', () => {
    const content = { x: -40, y: -30, width: 800, height: 500 };
    expect(frameRectOf({ x: 10, y: 20, width: 5, height: 6 }, content, { x: 0, y: 0 }, 1)).toEqual({
      x: 50,
      y: 50,
      width: 5,
      height: 6,
    });
  });
});

