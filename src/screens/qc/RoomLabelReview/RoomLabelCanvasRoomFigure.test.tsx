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

  it('[K23] nhãn trên bản vẽ chỉ ghi tên, không ghi diện tích (từng đè nhãn phòng bên)', () => {
    const { container } = render(
      <svg>
        <RoomLabelCanvasRoomFigure isSelected={false} millimetresPerPixel={1} reducedMotion room={{ ...ROOM, name: 'Bếp' }} />
      </svg>,
    );

    expect(container.querySelectorAll('text')).toHaveLength(1);
    expect(container.textContent).not.toContain('16,00 m²');
  });

  it('[K16] tên đủ không vừa thì ghi tên ngắn ("WC 1"), không ghi mã phòng', () => {
    /* 80 mm/px ⇒ phòng rộng 50 px: "phòng tắm 1" không vừa cả cỡ nhỏ, "WC 1" vừa. */
    const { container } = render(
      <svg>
        <RoomLabelCanvasRoomFigure
          isSelected={false}
          millimetresPerPixel={80}
          reducedMotion
          room={{ ...ROOM, name: 'phòng tắm 1', labelFits: false }}
        />
      </svg>,
    );

    const text = container.querySelector('text');

    expect(text?.textContent).toContain('WC 1');
    expect(text?.textContent).not.toContain('#R-001');
    expect(text?.querySelector('title')?.textContent).toBe('phòng tắm 1');
  });

  it('[K15] chọn phòng không phóng hình: đường bao giữ đúng toạ độ', () => {
    const pointsOf = (isSelected: boolean) => {
      const { container, unmount } = render(
        <svg>
          <RoomLabelCanvasRoomFigure isSelected={isSelected} millimetresPerPixel={20} reducedMotion room={ROOM} />
        </svg>,
      );
      const polygon = container.querySelector('polygon');
      const result = { points: polygon?.getAttribute('points'), transform: polygon?.closest('g')?.getAttribute('style') ?? '' };
      unmount();
      return result;
    };

    const selected = pointsOf(true);

    expect(selected.points).toBe(pointsOf(false).points);
    expect(selected.transform).not.toContain('scale');
  });

  it('phòng vẽ quá nhỏ: không cắt tên thành "p…", hiện mã phòng, tên ở <title>', () => {
    /* 100 mm/px ⇒ phòng rộng 40 px — chỉ đủ ~4 ký tự cỡ 15 px. */
    const { container } = render(
      <svg>
        <RoomLabelCanvasRoomFigure isSelected={false} millimetresPerPixel={100} reducedMotion room={ROOM} />
      </svg>,
    );

    const texts = [...container.querySelectorAll('text')];

    expect(texts).toHaveLength(1);
    expect(texts[0]?.textContent).toContain('#R-001');
    expect(texts[0]?.textContent).not.toContain('…');
    expect(texts[0]?.querySelector('title')?.textContent).toBe(LONG_NAME);
  });
});

describe('RoomLabelCanvasRoomFigure — nhãn không đè chữ gốc (G4a-29)', () => {
  const nameY = (hasBackground: boolean): number => {
    const { container, unmount } = render(
      <svg>
        <RoomLabelCanvasRoomFigure
          hasBackground={hasBackground}
          isSelected={false}
          millimetresPerPixel={20}
          reducedMotion
          room={ROOM}
        />
      </svg>,
    );
    const y = Number(container.querySelector('text')?.getAttribute('y'));
    unmount();
    return y;
  };

  it('có bản vẽ nền thì nhãn dời khỏi giữa phòng (nơi bản vẽ gốc ghi tên), không nền thì giữ giữa', () => {
    const centred = nameY(false);
    const moved = nameY(true);

    expect(moved).toBeLessThan(centred - 40);
    expect(moved).toBeGreaterThan(0);
  });
});
