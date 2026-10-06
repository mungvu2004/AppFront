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

  it('Enter cam kết tên mới một lần; blur sau đó không gọi lại', () => {
    const onCommit = vi.fn();

    render(<RoomLabelNameField isReadOnly={false} name="Bếp" onCommit={onCommit} suggestions={[]} />);

    const field = screen.getByRole('textbox', { name: 'Tên phòng' });

    fireEvent.change(field, { target: { value: 'Bếp ăn' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    // Lượt lưu chưa về nên tên đang lưu vẫn là "Bếp": blur lúc này không được cam
    // kết lần hai (review DEBT-03 P3-5e — trước đây bài không blur).
    fireEvent.blur(field);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Bếp ăn');
  });

  it('Esc trả ô về tên đang lưu và xoá lỗi', () => {
    const onCommit = vi.fn();

    render(<RoomLabelNameField isReadOnly={false} name="Bếp" onCommit={onCommit} suggestions={[]} />);

    const field = screen.getByRole('textbox', { name: 'Tên phòng' });

    fireEvent.change(field, { target: { value: '' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.change(field, { target: { value: 'x' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(field).toHaveValue('Bếp');
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('bấm gợi ý chỉ điền vào ô; vai chỉ xem không có ô nhập gợi ý', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <RoomLabelNameField isReadOnly={false} name="" onCommit={onCommit} suggestions={['Phòng ngủ']} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Phòng ngủ' }));

    expect(screen.getByRole('textbox', { name: 'Tên phòng' })).toHaveValue('Phòng ngủ');
    expect(onCommit).not.toHaveBeenCalled();

    rerender(<RoomLabelNameField isReadOnly name="Bếp" onCommit={onCommit} suggestions={['Phòng ngủ']} />);

    expect(screen.queryByRole('button', { name: 'Phòng ngủ' })).toBeNull();
  });
});
