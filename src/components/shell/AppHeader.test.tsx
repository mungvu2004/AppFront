import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { ROUTES } from '@/routes/paths';

import { AppHeader, type AppHeaderProps } from './AppHeader';

function renderHeader(overrides: Partial<AppHeaderProps> = {}) {
  const props: AppHeaderProps = { accountLabel: 'Hà', showAdmin: false, project: null, onSignOut: vi.fn(), ...overrides };
  return { props, ...render(<MemoryRouter><AppHeader {...props} /></MemoryRouter>) };
}

describe('AppHeader', () => {
  it('ngoài dự án: không có thanh bước, đăng xuất có hỏi lại', async () => {
    const { props } = renderHeader();
    expect(screen.queryByRole('navigation', { name: 'Các bước của dự án' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(props.onSignOut).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Đăng xuất' }));
    expect(props.onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link', { name: 'Quản trị' })).toBeNull();
  });

  it('trong dự án: đánh dấu bước hiện tại và trỏ nút "Bước tiếp theo" sang bước sau', () => {
    const { container } = renderHeader({ project: { id: 'p1', name: 'Nhà A', stepIndex: 2 } });
    expect(screen.getByText('Nhà A')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kiểm tra tầng/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: /Bước tiếp theo: Mô hình 3D/ })).toHaveAttribute('href', ROUTES.project.viewer('p1'));
    expectVietnamese(container, { allowWords: ['AppFront'] });
  });

  it('bước cuối không có "Bước tiếp theo"; ngoài sáu bước, mở thẳng: "Về Quản lý tầng"', () => {
    const { unmount } = renderHeader({ project: { id: 'p1', name: null, stepIndex: 5 } });
    expect(screen.queryByRole('link', { name: /Bước tiếp theo/ })).toBeNull();
    unmount();
    renderHeader({ project: { id: 'p1', name: null, stepIndex: -1 } });
    expect(screen.getByRole('link', { name: 'Về Quản lý tầng' })).toHaveAttribute('href', ROUTES.project.floors('p1'));
  });

  it('màn xác nhận CAD: không mời "Về duyệt lớp tường" (RV5 #10)', () => {
    const props: AppHeaderProps = { accountLabel: 'Hà', showAdmin: false, onSignOut: vi.fn(), project: { id: 'p1', name: null, stepIndex: 2, floorId: 'f1', layerIndex: -1 } };
    render(
      <MemoryRouter initialEntries={[ROUTES.project.cadConfirm('p1', 'f1')]}>
        <AppHeader {...props} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: /Về duyệt lớp/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Bước tiếp theo/ })).toBeNull();
  });

  it('trong một lớp của tầng: ô bước 3 về lớp Tường, nút chính mời lớp kế tiếp', () => {
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 2, floorId: 'f1', layerIndex: 0 } });
    expect(screen.getByRole('link', { name: /Kiểm tra tầng/ })).toHaveAttribute('href', ROUTES.project.walls('p1', 'f1'));
    expect(screen.getByRole('link', { name: /Tiếp: Cửa và nội thất/ })).toHaveAttribute('href', ROUTES.project.objects('p1', 'f1'));
  });

  it('J-4: đang xử lý thì không mời tải bản vẽ lần nữa', () => {
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 1, blocker: 'processing' } });
    expect(screen.queryByRole('link', { name: /Tải bản vẽ để bắt đầu/ })).toBeNull();
    expect(screen.getByText('Đang xử lý bản vẽ: chờ xong rồi đi tiếp')).toBeInTheDocument();
  });

  it('chưa có bản vẽ hoặc xử lý lỗi: nút chính không mời sang bước sau', () => {
    const { unmount } = renderHeader({ project: { id: 'p1', name: null, stepIndex: 1, blocker: 'no-drawings' } });
    expect(screen.queryByRole('link', { name: /Bước tiếp theo/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Tải bản vẽ để bắt đầu/ })).toHaveAttribute('href', ROUTES.project.upload('p1'));
    unmount();
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 1, blocker: 'pipeline-error' } });
    expect(screen.queryByRole('link', { name: /Bước tiếp theo/ })).toBeNull();
    expect(screen.getByText(/Xử lý gặp lỗi/)).toBeInTheDocument();
  });

  it('quản trị viên thấy liên kết "Quản trị"', () => {
    renderHeader({ showAdmin: true });
    expect(screen.getByRole('link', { name: 'Quản trị' })).toHaveAttribute('href', ROUTES.adminUsers);
  });

  it('"Quản trị" sáng trên mọi màn /admin/*, không chỉ màn người dùng', () => {
    const props: AppHeaderProps = { accountLabel: 'Hà', showAdmin: true, project: null, onSignOut: vi.fn() };
    render(
      <MemoryRouter initialEntries={[ROUTES.adminTrainingJobs]}>
        <AppHeader {...props} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Quản trị' })).toHaveClass('text-accent');
  });
});
