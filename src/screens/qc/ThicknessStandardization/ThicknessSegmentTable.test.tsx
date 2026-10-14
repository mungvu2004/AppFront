/**
 * Bảng chọn nhóm theo lô của bảng chi tiết (BUG-620): ở 375 px hàng không xuống dòng đẩy "Huỷ" /
 * "Áp dụng" ra ngoài màn, và dải hành động bên dưới lặp lại "Đổi độ dày" / "Bỏ chọn".
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WallId } from '@/domain/spatial/types';

import { ThicknessSegmentTable } from './ThicknessSegmentTable';
import type { ThicknessSegmentRow } from './thicknessTypes';

const WALL_ID = 'W-0001' as WallId;

const ROW: ThicknessSegmentRow = {
  wallId: WALL_ID,
  code: '#W-001',
  measuredMm: 200,
  measuredLabel: '200 mm',
  normalizedGroup: 220,
  deviationMm: 20,
  deviationLabel: '20 mm',
  exceedsTolerance: false,
  confidence: 0.9,
  confidenceLabel: '0,9',
  floorName: 'Tầng 1',
  status: 'attention',
  reviewed: false,
};

afterEach(cleanup);

describe('ThicknessSegmentTable — bảng chọn nhóm theo lô', () => {
  it('[BUG-620] xuống dòng được và thay dải hành động khi đang mở', () => {
    render(
      <ThicknessSegmentTable
        flashingWallIds={[]}
        hoveredWallId={null}
        onApplySelectedGroup={vi.fn()}
        onChangeNormalizedGroup={vi.fn()}
        onChangeSortKey={vi.fn()}
        onClearSelection={vi.fn()}
        onHoverRow={vi.fn()}
        onToggleAllSelected={vi.fn()}
        onToggleRowSelected={vi.fn()}
        rows={[ROW]}
        selectedWallIds={[WALL_ID]}
        sortKey="deviation"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Đổi độ dày/ }));

    const picker = screen.getByRole('group', { name: 'Chọn nhóm áp cho các đoạn đã chọn' });
    expect(picker.className).toContain('flex-wrap');
    expect(screen.queryByRole('button', { name: /Đổi độ dày/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeInTheDocument();
  });
});
