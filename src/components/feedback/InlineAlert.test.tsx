import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InlineAlert } from './InlineAlert';

describe('InlineAlert — nút hành động (NO-373)', () => {
  it('không gửi biểu mẫu bao quanh: nút là type="button", chỉ gọi onClick', () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });

    render(
      <form onSubmit={onSubmit}>
        <InlineAlert level="attention" message="Mất kết nối" action={{ label: 'Thử lại', onClick }} />
      </form>,
    );

    const button = screen.getByRole('button', { name: 'Thử lại' });
    expect(button).toHaveAttribute('type', 'button');

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('InlineAlert — khung hẹp (QA-01 nợ #3)', () => {
  it('cho nút xuống hàng dưới thay vì ép chữ thành cột: hàng ngoài wrap, chữ giữ bề rộng tối thiểu', () => {
    render(
      <InlineAlert level="violation" title="Sai mật khẩu" message="Thử lại" action={{ label: 'Đặt lại', onClick: vi.fn() }} />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('flex-wrap');

    const text = screen.getByText('Sai mật khẩu').parentElement?.parentElement;
    expect(text?.parentElement).toBe(alert);
    expect(text).toHaveClass('basis-60', 'flex-1');
    expect(text).not.toHaveClass('flex-wrap');
  });
});

describe('InlineAlert — ngắt dòng thân (BUG-087)', () => {
  it('thân dùng text-pretty: không để một từ đứng riêng ở dòng cuối khi khung hẹp', () => {
    render(<InlineAlert level="attention" message="Hãy yêu cầu liên kết mới ở trang đăng nhập." />);

    expect(screen.getByText('Hãy yêu cầu liên kết mới ở trang đăng nhập.')).toHaveClass('text-pretty');
  });
});
