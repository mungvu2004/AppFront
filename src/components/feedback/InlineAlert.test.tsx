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
