import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';

import { ProjectSettingsReloadDialog } from './ProjectSettingsReloadDialog';

afterEach(() => {
  cleanup();
});

describe('ProjectSettingsReloadDialog', () => {
  it('đóng thì không dựng gì', () => {
    render(<ProjectSettingsReloadDialog isOpen={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nói rõ tải lại sẽ bỏ thay đổi chưa lưu; xác nhận và giữ lại gọi đúng hàm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(<ProjectSettingsReloadDialog isOpen onConfirm={onConfirm} onCancel={onCancel} />);
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText(viMessages.project.settings.load.reloadDialogTitle)).toBeInTheDocument();
    expectVietnamese(container);

    fireEvent.click(dialog.getByRole('button', { name: viMessages.project.settings.load.reload }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(dialog.getByRole('button', { name: viMessages.project.settings.load.reloadKeep }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc đóng hộp thoại (A12)', () => {
    const onCancel = vi.fn();
    render(<ProjectSettingsReloadDialog isOpen onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
