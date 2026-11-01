import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { describePipelineError } from '../../pipeline/pipelineErrorText';
import { ObjectLayerSuggestionBar } from './ObjectLayerSuggestionBar';
import { confidentRowLabelOf, nextSuggestionIdOf } from './objectLayerReviewGateway';

/* Giảm tải duyệt (GIAI-PHAP 3.12): dòng gom món chắc chắn, thanh gợi ý, câu lỗi ảnh 3D. */
describe('giảm tải duyệt — Cửa và nội thất', () => {
  it('món máy chắc chắn gom thành một dòng "N mục máy chắc chắn — Duyệt cả N"', () => {
    expect(confidentRowLabelOf(8)).toBe('8 mục máy chắc chắn — Duyệt cả 8');
  });

  it('"Xem từng gợi ý" đi lần lượt qua các dòng gợi ý, vòng lại đầu', () => {
    const rows = [{ id: 'a' }, { id: 's1', isSuggested: true }, { id: 'b' }, { id: 's2', isSuggested: true }];

    expect(nextSuggestionIdOf(rows, null)).toBe('s1');
    expect(nextSuggestionIdOf(rows, 'a')).toBe('s1');
    expect(nextSuggestionIdOf(rows, 's1')).toBe('s2');
    expect(nextSuggestionIdOf(rows, 's2')).toBe('s1');
    expect(nextSuggestionIdOf([{ id: 'a' }], null)).toBeNull();
  });

  it('thanh gợi ý giải thích gợi ý là gì; nút chính là "Xem từng gợi ý"', () => {
    const onReviewEach = vi.fn();

    render(
      <ObjectLayerSuggestionBar
        label="12 gợi ý của máy đang chờ"
        onAcceptAll={vi.fn()}
        onRejectAll={vi.fn()}
        onReviewEach={onReviewEach}
      />,
    );

    expect(
      screen.getByText(
        'Gợi ý = chỗ có nét vẽ máy chưa nhận ra là gì (có thể là đồ, cũng có thể là chữ số). Chưa nhận thì không dựng 3D.',
      ),
    ).toBeInTheDocument();
    const [first] = screen.getAllByRole('button');

    expect(first).toHaveAccessibleName('Xem từng gợi ý');
    expect(screen.getByRole('button', { name: 'Nhận tất cả gợi ý' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem từng gợi ý' }));
    expect(onReviewEach).toHaveBeenCalledTimes(1);
  });

  it('lỗi NOT_A_FLOOR_PLAN nói rõ có vẻ là ảnh phối cảnh 3D', () => {
    expect(describePipelineError('NOT_A_FLOOR_PLAN').sentence).toContain(
      'Đây có vẻ là ảnh phối cảnh 3D, không phải mặt bằng nhìn từ trên xuống.',
    );
  });
});
