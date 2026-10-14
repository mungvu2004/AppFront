/** Trạng thái căn tầng (BUG-638): chữ nhìn thấy được, không chỉ một chấm màu `aria-hidden`. */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { millimetres } from '@/domain/units/types';

import { AxisGridFloorAlignList } from './AxisGridFloorAlignList';

afterEach(cleanup);

describe('AxisGridFloorAlignList', () => {
  it('[BUG-638] tầng lệch hiện chữ "Cần chú ý" và "Không căn được"', () => {
    render(
      <AxisGridFloorAlignList
        blockedReason={null}
        floors={[
          { levelId: 'L1', name: 'Tầng 1', offsetText: '0 mm', offsetMm: millimetres(0), status: 'ok', isBase: true, isHovered: false },
          { levelId: 'L2', name: 'Tầng 2', offsetText: '40 mm', offsetMm: millimetres(40), status: 'warning', isBase: false, isHovered: false },
          { levelId: 'L3', name: 'Tầng 3', offsetText: '—', offsetMm: millimetres(0), status: 'unalignable', isBase: false, isHovered: false },
        ]}
        onAutoAlign={vi.fn()}
        onFloorRowHover={vi.fn()}
        onViewFloorOnDrawing={vi.fn()}
        unavailableNotice={null}
        warningBanner={null}
      />,
    );

    expect(screen.getByText('Cần chú ý')).toBeVisible();
    expect(screen.getByText('Không căn được')).toBeVisible();
  });
});
