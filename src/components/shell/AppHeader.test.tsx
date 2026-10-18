import { render, screen } from '@testing-library/react';
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
  it('ngoài dự án: không có thanh bước, có đăng xuất', () => {
    const { props } = renderHeader();
    expect(screen.queryByRole('navigation', { name: 'Các bước của dự án' })).toBeNull();
    screen.getByRole('button', { name: 'Đăng xuất' }).click();
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

  it('bước cuối không có "Bước tiếp theo"; ngoài sáu bước thì có "Về bước đầu"', () => {
    const { unmount } = renderHeader({ project: { id: 'p1', name: null, stepIndex: 5 } });
    expect(screen.queryByRole('link', { name: /Bước tiếp theo/ })).toBeNull();
    unmount();
    renderHeader({ project: { id: 'p1', name: null, stepIndex: -1 } });
    expect(screen.getByRole('link', { name: 'Về bước đầu' })).toHaveAttribute('href', ROUTES.project.upload('p1'));
  });

  it('quản trị viên thấy liên kết "Quản trị"', () => {
    renderHeader({ showAdmin: true });
    expect(screen.getByRole('link', { name: 'Quản trị' })).toHaveAttribute('href', ROUTES.adminUsers);
  });
});
