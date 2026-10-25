import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { QcFloorNav } from './QcFloorNav';

function renderNav() {
  render(
    <MemoryRouter>
      <QcFloorNav floorId="f1" floors={[{ id: 'f1', label: 'Tầng 1' }]} layer="walls" projectId="p1" projectName="Nhà A" />
    </MemoryRouter>,
  );
}

describe('QcFloorNav', () => {
  it('đường dẫn và tab lớp cùng một hàng phụ', () => {
    renderNav();
    const crumbs = screen.getByRole('navigation', { name: 'Đường dẫn trang' });
    const layers = screen.getByRole('navigation', { name: 'Các lớp kiểm tra' });
    expect(crumbs.closest('div.h-8')).toBe(layers.parentElement);
  });

  it('breadcrumb chỉ còn Tầng › màn: tên dự án đã có ở header', () => {
    renderNav();
    expect(screen.queryByText('Nhà A')).toBeNull();
    const crumbs = within(screen.getByRole('navigation', { name: 'Đường dẫn trang' }));
    expect(crumbs.getByText('Tầng 1')).toBeInTheDocument();
    expect(crumbs.getByText('Duyệt tường')).toBeInTheDocument();
  });

  it('ba lớp bắt buộc đánh số, rồi nhóm "Công cụ (không bắt buộc):" có "So với bản vẽ"', () => {
    renderNav();
    const layers = screen.getByRole('navigation', { name: 'Các lớp kiểm tra' });
    expect(layers.textContent).toContain('Cần duyệt:1Tường2Cửa và nội thất3Phòng');
    expect(within(layers).getByText('Công cụ (không bắt buộc):')).toBeInTheDocument();
    expect(within(layers).getByRole('link', { name: 'So với bản vẽ' })).toBeInTheDocument();
    expect(within(layers).queryByText('Chồng lớp')).toBeNull();
  });
});
