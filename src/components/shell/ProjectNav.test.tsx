import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Breadcrumb } from './Breadcrumb';
import { ProjectNav } from './ProjectNav';

function renderNav(pathname: string, search = '') {
  render(
    <MemoryRouter>
      <ProjectNav projectId="p1" pathname={pathname} search={search} />
    </MemoryRouter>,
  );
}

describe('ProjectNav', () => {
  it('có đủ năm lối vào bằng chữ, đúng đích', () => {
    renderNav('/projects/p1/floors');
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Lịch sử phiên bản',
      'Dữ liệu dự án',
      'Sơ đồ xử lý',
      'Thành viên',
      'Cài đặt',
    ]);
    expect(screen.getByRole('link', { name: 'Thành viên' })).toHaveAttribute('href', '/projects/p1/settings?tab=members');
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
  });

  it('đánh dấu mục đang mở; tab Thành viên tách khỏi Cài đặt', () => {
    renderNav('/projects/p1/settings', '?tab=members');
    expect(screen.getByRole('link', { name: 'Thành viên' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cài đặt' })).not.toHaveAttribute('aria-current');
  });

  it('đánh dấu Sơ đồ xử lý trên route sơ đồ', () => {
    renderNav('/projects/p1/pipeline/graph');
    expect(screen.getByRole('link', { name: 'Sơ đồ xử lý' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Breadcrumb · tên dự án', () => {
  it('tên dự án là link về màn tầng của dự án khi ở trong route dự án', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1/upload']}>
        <Routes>
          <Route
            path="/projects/:projectId/upload"
            element={<Breadcrumb items={[{ id: 'projects', label: 'Dự án' }, { id: 'project', label: 'Nhà A' }, { id: 'current', label: 'Tải bản vẽ' }]} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Nhà A' })).toHaveAttribute('href', '/projects/p1/floors');
  });

  it('ngoài router tên dự án vẫn là chữ thường', () => {
    render(<Breadcrumb items={[{ id: 'project', label: 'Nhà A' }, { id: 'current', label: 'Xuất' }]} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Nhà A')).toBeInTheDocument();
  });
});
