import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BackToProjectCard, READ_ONLY_REASON, SaveStatusCard } from '../BackToProjectCard';
import type { PascalSaveStatus } from '../bridge/types';

const status = (patch: Partial<PascalSaveStatus> = {}): PascalSaveStatus => ({
  state: 'saved',
  label: 'Đã lưu lúc 10:00',
  blockMessage: null,
  onReloadFloor: vi.fn(),
  notice: null,
  dismissNotice: vi.fn(),
  ...patch,
});

describe('SaveStatusCard (v3 V3 — trạng thái lưu thật trên trang Pascal)', () => {
  it('đã lưu / đang lưu / thất bại', () => {
    const { rerender } = render(<SaveStatusCard save={status()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu lúc 10:00');

    rerender(<SaveStatusCard save={status({ state: 'saving' })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang lưu…');

    rerender(<SaveStatusCard save={status({ state: 'failed', label: 'Lưu thất bại' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Lưu thất bại');
    expect(screen.queryByRole('button', { name: 'Tải lại tầng' })).toBeNull();
  });

  it('bị khối: lý do + nút "Tải lại tầng"', () => {
    const save = status({ state: 'blocked', blockMessage: 'Bản vẽ đã đổi ở nơi khác.' });
    render(<SaveStatusCard save={save} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Bản vẽ đã đổi ở nơi khác.');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại tầng' }));
    expect(save.onReloadFloor).toHaveBeenCalledTimes(1);
  });

  it('câu "Chưa lưu được" đóng được; chưa lưu lần nào thì không có chip', () => {
    const save = status({ label: null, notice: 'Chưa lưu được: màu sàn — sẽ có ở bản sau.' });
    render(<SaveStatusCard save={save} />);

    expect(screen.getByText('Chưa lưu được: màu sàn — sẽ có ở bản sau.')).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(save.dismissNotice).toHaveBeenCalledTimes(1);
  });

  it('V10 — câu thông báo là toast cổng ra body (không chiếm chỗ trên thanh), chip lưu co được', () => {
    const save = status({ notice: 'Chưa lưu được: màu sàn.' });
    const { container } = render(
      <div data-testid="bar">
        <SaveStatusCard save={save} />
      </div>,
    );

    const toast = screen.getByText('Chưa lưu được: màu sàn.').closest('[role="status"]')!;
    expect(container.contains(toast)).toBe(false);
    expect(toast.parentElement!.parentElement).toBe(document.body);
    expect(toast.parentElement!.className).toContain('fixed');
    expect(toast.querySelector('button[aria-label="Đóng thông báo"]')).not.toBeNull();
    const chip = screen.getByText('Đã lưu lúc 10:00').parentElement!;
    expect(container.contains(chip)).toBe(true);
    expect(chip.className).not.toContain('shrink-0');
  });

  it('N1 — lượt lưu bị từ chối: toast là cảnh báo (role alert, màu đỏ)', () => {
    render(<SaveStatusCard save={status({ notice: 'Không lưu được: món đồ đặt lên đồ khác.', noticeTone: 'alert' })} />);

    const toast = screen.getByRole('alert');
    expect(toast).toHaveTextContent('Không lưu được: món đồ đặt lên đồ khác.');
    expect(toast.className).toContain('text-[var(--pa-danger)]');
  });

  it('B3-09 — lưu hỏng: câu đầy đủ + "Tải lại tầng" ở toast ngoài thanh, chip chỉ "Chưa lưu" và không co', () => {
    const { container } = render(
      <div>
        <SaveStatusCard save={status({ state: 'blocked', blockMessage: 'Máy chủ không nhận dữ liệu của tầng này.' })} />
      </div>,
    );

    const toast = screen.getByRole('alert');
    expect(container.contains(toast)).toBe(false);
    expect(toast).toHaveTextContent('Máy chủ không nhận dữ liệu của tầng này.');
    expect(toast).toContainElement(screen.getByRole('button', { name: 'Tải lại tầng' }));
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('Chưa lưu');
    expect(chip.className).toContain('shrink-0');
  });

  it('BackToProjectCard: không có `save` (chỉ đọc) thì có lối về và câu nói vì sao chỉ xem, không có chip lưu', () => {
    render(<BackToProjectCard href="/projects/p1/floors" projectName="Nhà mẫu" />);

    expect(screen.getByRole('link', { name: 'Về dự án: Nhà mẫu' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent(READ_ONLY_REASON);
  });

  it('BackToProjectCard: có `save` thì không hiện chip chỉ xem', () => {
    render(<BackToProjectCard href="/projects/p1/floors" projectName="Nhà mẫu" save={status()} />);

    expect(screen.queryByRole('note')).toBeNull();
  });
});
