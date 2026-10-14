/**
 * Nhãn tên trên canvas (BUG-623): `labelFits` đo ở tỷ lệ BẢN VẼ, còn canvas vẽ ở tỷ lệ vừa khung
 * (BUG-393) — tên dài phải cắt theo bề rộng phòng đang vẽ, không tràn ra hai mép khung.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RoomLabelCanvasRoomFigure } from './RoomLabelCanvasRoomFigure';
import type { RoomLabelViewModel } from './roomLabelTypes';

const LONG_NAME = 'Phòng sinh hoạt chung của gia đình nhiều thế hệ, tầng một khu phía sau';

/* Phòng 4.000 × 4.000 mm; 20 mm/px ⇒ 200 px rộng — tên 70 ký tự ở cỡ 15 px cần ~600 px. */
const ROOM = {
  id: 'R-1',
  codeLabel: '#R-001',
  name: LONG_NAME,
  hasName: true,
  areaText: '16,00 m²',
  outlineMm: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 4000 },
    { x: 0, y: 4000 },
  ],
  labelAnchorMm: { x: 2000, y: 2000 },
  labelFits: true,
  fillToken: '--bg-sunken',
} as unknown as RoomLabelViewModel;

afterEach(cleanup);

describe('RoomLabelCanvasRoomFigure — nhãn tên', () => {
  it('[BUG-623] tên dài cắt bằng "…" theo bề rộng phòng, tên đầy đủ ở <title>', () => {
    const { container } = render(
      <svg>
        <RoomLabelCanvasRoomFigure isSelected={false} millimetresPerPixel={20} reducedMotion room={ROOM} />
      </svg>,
    );

    const nameText = container.querySelector('text');
    const drawn = [...(nameText?.childNodes ?? [])]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('');

    expect(drawn).not.toContain(LONG_NAME);
    expect(drawn).toContain('…');
    expect(nameText?.querySelector('title')?.textContent).toBe(LONG_NAME);
  });
});
