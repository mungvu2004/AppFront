import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { LAST_PROJECT_KEY } from '@/lib/auth';

import { QcFloorNav } from './QcFloorNav';

function renderNav(projectName?: string) {
  render(
    <MemoryRouter>
      <QcFloorNav floorId="f1" layer="walls" projectId="p1" projectName={projectName} />
    </MemoryRouter>,
  );
}

describe('QcFloorNav', () => {
  afterEach(() => sessionStorage.clear());

  it('đường dẫn và tab lớp cùng một hàng phụ', () => {
    renderNav('Nhà A');
    const crumbs = screen.getByRole('navigation', { name: 'Đường dẫn trang' });
    const layers = screen.getByRole('navigation', { name: 'Các lớp kiểm tra' });
    expect(crumbs.parentElement).toBe(layers.parentElement);
  });

  it('nơi gọi không truyền tên: breadcrumb vẫn có tên dự án đã nhớ', () => {
    sessionStorage.setItem(LAST_PROJECT_KEY, JSON.stringify({ id: 'p1', name: 'Nhà B' }));
    renderNav();
    expect(screen.getByRole('button', { name: 'Nhà B' })).toBeInTheDocument();
  });

  it('tên đã nhớ của dự án khác thì không dùng', () => {
    sessionStorage.setItem(LAST_PROJECT_KEY, JSON.stringify({ id: 'p2', name: 'Nhà C' }));
    renderNav();
    expect(screen.queryByText('Nhà C')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dự án' })).toBeInTheDocument();
  });
});
