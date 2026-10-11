import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('mô tả dùng text-pretty: không để một từ đứng riêng ở dòng cuối (BUG-170)', () => {
    render(<EmptyState icon={null} title="Chưa có bước nào" description="Các bước xử lý sẽ hiện ở đây." />);

    expect(screen.getByText('Các bước xử lý sẽ hiện ở đây.')).toHaveClass('text-pretty');
  });
});
