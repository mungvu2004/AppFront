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

  it('trong dự án: đánh dấu bước hiện tại; bước đã xong thì nút "Tiếp: <bước>" trỏ sang bước sau', () => {
    const { container } = renderHeader({ project: { id: 'p1', name: 'Nhà A', stepIndex: 2, stepStates: ['done', 'done', 'done', 'todo', 'todo', 'todo'] } });
    expect(screen.getByText('Nhà A')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bước 3: Duyệt tầng/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: /Tiếp: Mô hình 3D/ })).toHaveAttribute('href', ROUTES.project.viewer('p1'));
    expectVietnamese(container, { allowWords: ['AppFront'] });
  });

  it('bước chưa xong: vẫn "Tiếp: …" kiểu phụ; bước cuối không có "Tiếp"', () => {
    const { unmount } = renderHeader({ project: { id: 'p1', name: null, stepIndex: 2, stepStates: ['done', 'done', 'todo', 'todo', 'todo', 'todo'] } });
    expect(screen.getByRole('link', { name: /Tiếp: Mô hình 3D/ }).className).not.toContain('bg-accent ');
    unmount();
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 5, stepStates: ['done', 'done', 'done', 'done', 'done', 'done'] } });
    expect(screen.queryByRole('link', { name: /^Tiếp:/ })).toBeNull();
  });

  it('màn ngoài sáu bước: "Tiếp tục: <bước đầu chưa xong>", không còn "Về quản lý tầng"', () => {
    const { unmount } = renderHeader({ project: { id: 'p1', name: null, stepIndex: -1, stepStates: ['done', 'done', 'todo', 'todo', 'todo', 'todo'] } });
    expect(screen.getByRole('link', { name: /Tiếp tục: Duyệt tầng/ })).toHaveAttribute('href', ROUTES.project.floors('p1'));
    expect(screen.queryByRole('link', { name: 'Về quản lý tầng' })).toBeNull();
    unmount();
    renderHeader({ project: { id: 'p1', name: null, stepIndex: -1, lastFloorPath: ROUTES.project.rooms('p1', 'f1'), stepStates: ['done', 'done', 'todo', 'todo', 'todo', 'todo'] } });
    expect(screen.getByRole('link', { name: /Tiếp tục: Duyệt tầng/ })).toHaveAttribute('href', ROUTES.project.rooms('p1', 'f1'));
  });

  it('thanh bước nói trạng thái từng bước; màn Tải bản vẽ dùng nút đi tiếp kiểu phụ', () => {
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 0, stepStates: ['done', 'attention', 'todo', 'todo', 'todo', 'todo'] } });
    // Bước 1 đã xong: nút đi tiếp có, nhưng kiểu phụ vì màn có nút chính riêng.
    expect(screen.getByRole('link', { name: 'Bước 1: Tải bản vẽ, đã xong' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: 'Bước 2: Xử lý, còn việc' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tiếp: Xử lý/ }).className).not.toContain('bg-accent ');
  });

  it('trong tầng: ô bước 3 về lớp Tường; header không mời lớp kế hay "Về duyệt lớp" (cổng tầng lo)', () => {
    const { unmount } = renderHeader({ project: { id: 'p1', name: null, stepIndex: 2, floorId: 'f1', layerIndex: 0 } });
    expect(screen.getByRole('link', { name: /Bước 3: Duyệt tầng/ })).toHaveAttribute('href', ROUTES.project.walls('p1', 'f1'));
    expect(screen.queryByRole('link', { name: /Tiếp: Cửa và nội thất/ })).toBeNull();
    unmount();
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 2, floorId: 'f1', layerIndex: -1 } });
    expect(screen.queryByRole('link', { name: /Về duyệt lớp/ })).toBeNull();
  });

  it('J-4: đang xử lý thì không mời tải bản vẽ lần nữa', () => {
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 1, blocker: 'processing' } });
    expect(screen.queryByRole('link', { name: /Tải bản vẽ để bắt đầu/ })).toBeNull();
    expect(screen.getByText('Đang xử lý bản vẽ: chờ xong rồi đi tiếp')).toBeInTheDocument();
  });

  it('chưa có bản vẽ hoặc xử lý lỗi: nút chính không mời sang bước sau', () => {
    const { unmount } = renderHeader({ project: { id: 'p1', name: null, stepIndex: 1, blocker: 'no-drawings' } });
    expect(screen.queryByRole('link', { name: /^Tiếp:/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Tải bản vẽ để bắt đầu/ })).toHaveAttribute('href', ROUTES.project.upload('p1'));
    unmount();
    renderHeader({ project: { id: 'p1', name: null, stepIndex: 1, blocker: 'pipeline-error' } });
    expect(screen.queryByRole('link', { name: /^Tiếp:/ })).toBeNull();
    expect(screen.getByText(/Xử lý gặp lỗi/)).toBeInTheDocument();
  });

  it('nav dự án nằm trong menu tên dự án, tách khỏi nav toàn cục (aesthetic 2.1 #1)', () => {
    renderHeader({ project: { id: 'p1', name: 'Nhà A', stepIndex: 2 } });
    const global = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(global).queryByRole('link', { name: 'Lịch sử phiên bản' })).toBeNull();
    const projectNav = screen.getByRole('navigation', { name: 'Màn khác của dự án' });
    expect(projectNav.closest('details')).not.toBeNull();
    expect(within(projectNav).getByRole('link', { name: 'Lịch sử phiên bản' })).toHaveAttribute('href', ROUTES.project.versions('p1'));
  });

  it('Esc đóng menu dự án đang mở (A12)', () => {
    renderHeader({ project: { id: 'p1', name: 'Nhà A', stepIndex: 2 } });
    const details = screen.getByRole('navigation', { name: 'Màn khác của dự án' }).closest('details');
    if (details === null) throw new Error('thiếu <details>');
    details.open = true;
    fireEvent.keyDown(details, { key: 'Escape' });
    expect(details.open).toBe(false);
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
