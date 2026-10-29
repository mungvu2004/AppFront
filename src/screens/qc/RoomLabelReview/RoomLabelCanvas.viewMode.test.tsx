/**
 * Chế độ nhìn trên canvas Phòng: Tổng thể ghim số 1..N cho phòng chưa duyệt theo thứ tự hàng đợi
 * (chưa có tên trước, máy đề xuất sau); nút đổi chế độ luôn có trên bản vẽ.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { setQcViewMode } from '../shared/qcViewMode';
import { RoomLabelCanvas } from './RoomLabelCanvas';
import type { RoomLabelStatus, RoomLabelViewModel } from './roomLabelTypes';

const roomAt = (id: string, x: number, status: RoomLabelStatus) =>
  ({
    id,
    codeLabel: `#${id}`,
    name: id,
    hasName: true,
    areaText: '16,00 m²',
    outlineMm: [
      { x, y: 0 },
      { x: x + 4000, y: 0 },
      { x: x + 4000, y: 4000 },
      { x, y: 4000 },
    ],
    labelAnchorMm: { x: x + 2000, y: 2000 },
    labelFits: true,
    fillToken: '--bg-sunken',
    status,
  }) as unknown as RoomLabelViewModel;

const ROOMS = [roomAt('R-1', 0, 'suggested'), roomAt('R-2', 4000, 'confirmed'), roomAt('R-3', 8000, 'unnamed')];

const renderCanvas = () =>
  render(
    <RoomLabelCanvas
      backgroundImageAlt=""
      backgroundImageUrl={null}
      hoveredRoomId={null}
      isInteractive
      millimetresPerPixel={20 as never}
      onHover={vi.fn()}
      onSelect={vi.fn()}
      rooms={ROOMS}
      selectedRoomId={null}
    />,
  );

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class {
      observe(): void {
        /* Khung không đổi cỡ trong bài kiểm. */
      }
      disconnect(): void {
        /* Không có gì để ngắt. */
      }
    },
  });
});

afterEach(() => {
  cleanup();
  setQcViewMode('task');
});

describe('RoomLabelCanvas — chế độ nhìn', () => {
  it('Tổng thể: ghim số 1..N cho phòng chưa duyệt, theo thứ tự hàng đợi', () => {
    setQcViewMode('overview');
    renderCanvas();

    const pins = screen.getAllByRole('button', { name: /^Mục cần xem số/ });
    expect(pins.map((pin) => pin.textContent)).toEqual(['1', '2']);
    /* R-3 chưa có tên đứng trước R-1 máy đề xuất: ghim 1 nằm bên phải ghim 2. */
    expect(parseFloat(pins[0]!.style.left)).toBeGreaterThan(parseFloat(pins[1]!.style.left));
  });

  it('có nút đổi chế độ nhìn trên bản vẽ', () => {
    renderCanvas();

    expect(screen.getByRole('group', { name: 'Chế độ nhìn' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tổng thể' })).toBeTruthy();
  });
});
