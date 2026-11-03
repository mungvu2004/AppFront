/**
 * Chip lỗi đặt đồ (`../PlacementIssuesChip`): không lỗi thì ẩn; có lỗi thì "N lỗi đặt đồ",
 * bấm một dòng chọn món đồ đầu tiên của lỗi.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PlacementIssue } from '@/lib/pascal/placement';

import { placementSummary, PlacementIssuesView } from '../PlacementIssuesChip';

const ISSUES: PlacementIssue[] = [
  { kind: 'overlap', furnitureIds: ['f1', 'f2'], message: 'Giường chồng lên tủ' },
  { kind: 'wall', furnitureIds: ['f3'], message: 'Bàn lấn vào tường' },
];

describe('PlacementIssuesView', () => {
  it('tóm tắt', () => {
    expect(placementSummary([])).toBe('Không thấy lỗi đặt đồ');
    expect(placementSummary(ISSUES)).toBe('2 lỗi đặt đồ');
  });

  it('không lỗi thì không hiện gì', () => {
    const { container } = render(<PlacementIssuesView issues={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('bấm dòng chọn món đồ', () => {
    const onPick = vi.fn();
    render(<PlacementIssuesView issues={ISSUES} onPick={onPick} />);
    expect(screen.getByLabelText('2 lỗi đặt đồ — mở danh sách')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bàn lấn vào tường' }));
    expect(onPick).toHaveBeenCalledWith('f3');
  });

  it('không có cách chọn thì chỉ là danh sách đọc', () => {
    render(<PlacementIssuesView issues={ISSUES} />);
    expect(screen.queryByRole('button', { name: 'Giường chồng lên tủ' })).toBeNull();
    expect(screen.getByText('Giường chồng lên tủ')).not.toBeNull();
  });
});
