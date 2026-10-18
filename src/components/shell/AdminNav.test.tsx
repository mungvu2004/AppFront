import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AdminNav } from './AdminNav';

describe('AdminNav', () => {
  it('hiển thị 4 liên kết và đánh dấu mục hiện tại', () => {
    render(
      <MemoryRouter initialEntries={['/admin/training/jobs']}>
        <AdminNav />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Huấn luyện' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Model AI' })).not.toHaveAttribute('aria-current');
  });
});
