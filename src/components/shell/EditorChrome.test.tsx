import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { ROUTES } from '@/routes/paths';

import { EditorFileMenu, EditorStepLabel, EditorStepList, type EditorFileMenuProps } from './EditorChrome';

function renderMenu(overrides: Partial<EditorFileMenuProps> = {}) {
  const props: EditorFileMenuProps = { projectId: 'p1', projectName: 'Nhà A', showAdmin: false, accountInitials: 'HA', accountLabel: 'Hà', onSignOut: vi.fn(), ...overrides };
  return { props, ...render(<MemoryRouter initialEntries={[ROUTES.project.walls('p1', 'f1')]}><EditorFileMenu {...props} /></MemoryRouter>) };
}

describe('EditorFileMenu', () => {
  it('gom lối của header chung; Quản trị chỉ cho quản trị viên', () => {
    const { container, unmount } = renderMenu();
    expect(screen.getByTitle('Nhà A')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách dự án' })).toHaveAttribute('href', ROUTES.dashboard);
    for (const name of ['Lịch sử phiên bản', 'Chất lượng ảnh đầu vào', 'Thành viên', 'Cài đặt', 'Tài khoản']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Quản trị' })).toBeNull();
    expectVietnamese(container);
    unmount();
    renderMenu({ showAdmin: true });
    expect(screen.getByRole('link', { name: 'Quản trị' })).toHaveAttribute('href', ROUTES.adminUsers);
  });

  it('Đăng xuất có hỏi lại; Esc đóng menu', async () => {
    const { props, container } = renderMenu();
    const details = container.querySelector('details')!;
    details.open = true;
    fireEvent.keyDown(details, { key: 'Escape' });
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(props.onSignOut).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Đăng xuất' }));
    expect(props.onSignOut).toHaveBeenCalledOnce();
  });
});

describe('EditorStepList / EditorStepLabel', () => {
  it('sáu bước kèm trạng thái, bước 3 là bước đang đứng và trỏ về tầng đang mở; dòng vị trí là chữ', () => {
    const project = { id: 'p1', stepIndex: 2, floorId: 'f1', stepStates: ['done', 'done', 'todo', 'todo', 'todo', 'todo'] } as const;
    render(
      <MemoryRouter>
        <EditorStepLabel project={project} />
        <EditorStepList project={project} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Bước 3 · Duyệt tầng').tagName).toBe('P');
    const nav = screen.getByRole('navigation', { name: 'Các bước của dự án' });
    const steps = within(nav).getAllByRole('link');
    expect(steps).toHaveLength(6);
    const current = within(nav).getByRole('link', { name: 'Bước 3: Duyệt tầng, đang mở' });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).toHaveAttribute('href', ROUTES.project.walls('p1', 'f1'));
    expect(within(nav).getByRole('link', { name: 'Bước 1: Tải bản vẽ, đã xong' })).not.toHaveAttribute('aria-current');
  });
});
