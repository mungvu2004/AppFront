/** Bộ lọc không còn hàng (BUG-629): một câu và lối về "Tất cả", không để danh sách trắng. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DimensionOcrList } from './DimensionOcrList';

afterEach(cleanup);

describe('DimensionOcrList', () => {
  it('[BUG-629] bộ lọc "Chưa duyệt" rỗng: câu giải thích và nút "Xem tất cả"', () => {
    const onFilterChange = vi.fn();

    render(
      <DimensionOcrList
        activeFilter="unreviewed"
        isViewerRole={false}
        onApprove={vi.fn()}
        onCancelEdit={vi.fn()}
        onEdit={vi.fn()}
        onFilterChange={onFilterChange}
        onSelect={vi.fn()}
        outlierNotice={null}
        reviewCounter={{ reviewed: 3, total: 3 }}
        reviewProgressLabel="3/3 kích thước đã duyệt"
        rows={[]}
        selectedDimensionId={null}
      />,
    );

    expect(screen.getByText('Không còn kích thước nào trong bộ lọc này.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }));
    expect(onFilterChange).toHaveBeenCalledWith('all');
  });
});
