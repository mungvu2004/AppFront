import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  // text-pretty chỉ chặn MỘT từ mồ côi; "bản cũ." (hai từ) vẫn rơi xuống dòng 2 ở 1440 (BUG-455).
  // text-balance chia đều các dòng của khối căn giữa nên chặn cả hai (BUG-170, BUG-455).
  it('mô tả dùng text-balance: dòng cuối không còn một hai từ mồ côi (BUG-170, BUG-455)', () => {
    render(<EmptyState icon={null} title="Chưa có bước nào" description="Các bước xử lý sẽ hiện ở đây." />);

    expect(screen.getByText('Các bước xử lý sẽ hiện ở đây.')).toHaveClass('text-balance');
  });

  it('tiêu đề cũng text-balance: "nào" không đứng riêng một dòng (BUG-338)', () => {
    render(<EmptyState icon={null} title="Chưa nhận ra đối tượng nào" description="Mô tả." />);

    expect(screen.getByRole('heading', { name: 'Chưa nhận ra đối tượng nào' })).toHaveClass('text-balance');
  });
});
