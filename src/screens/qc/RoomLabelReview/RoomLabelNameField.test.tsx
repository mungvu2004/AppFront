import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoomLabelNameField } from './RoomLabelNameField';

describe('RoomLabelNameField', () => {
  it('theo tên đang lưu khi tên đổi từ ngoài ô — hoàn tác giữ phòng đang chọn (B-V7-30)', () => {
    const props = { suggestions: [], onCommit: vi.fn(), isReadOnly: false } as const;
    const { rerender } = render(<RoomLabelNameField {...props} name="Phòng thử e2e" />);

    rerender(<RoomLabelNameField {...props} name="Phòng khách chung" />);

    expect(screen.getByRole('textbox', { name: 'Tên phòng' })).toHaveValue('Phòng khách chung');
  });

  it('chữ đang gõ dở vẫn giữ khi tên đang lưu không đổi', () => {
    const props = { suggestions: [], onCommit: vi.fn(), isReadOnly: false } as const;
    const { rerender } = render(<RoomLabelNameField {...props} name="Phòng khách chung" />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Tên phòng' }), { target: { value: 'phòng kh' } });
    rerender(<RoomLabelNameField {...props} name="Phòng khách chung" />);

    expect(screen.getByRole('textbox', { name: 'Tên phòng' })).toHaveValue('phòng kh');
  });

  it('chặn tên rỗng ở ô: báo lỗi, giữ tên cũ, không gọi onCommit', () => {
    const onCommit = vi.fn();

    render(<RoomLabelNameField isReadOnly={false} name="Bếp" onCommit={onCommit} suggestions={[]} />);

    const field = screen.getByRole('textbox', { name: 'Tên phòng' });

    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);

    expect(onCommit).not.toHaveBeenCalled();
    expect(field).toHaveValue('Bếp');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Tên phòng không được để trống.')).toBeInTheDocument();
  });
});
