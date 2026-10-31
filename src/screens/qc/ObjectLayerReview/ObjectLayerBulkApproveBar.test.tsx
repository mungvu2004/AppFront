import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ObjectLayerBulkApproveBar } from './ObjectLayerBulkApproveBar';

describe('ObjectLayerBulkApproveBar (UX-06)', () => {
  const props = {
    breakdownLabel: '52 cần xem = 18 máy chắc chắn + 22 máy chưa chắc + 12 gợi ý',
    confidentLabel: 'Duyệt 18 mục máy chắc chắn',
    remainingLabel: 'Duyệt 22 mục máy chưa chắc',
    remainingConfirm: 'Duyệt luôn 22 mục máy chưa chắc?',
  } as const;

  it('nút máy chắc chắn duyệt ngay; dòng tách số cần xem hiện', () => {
    const onApproveConfident = vi.fn();

    render(<ObjectLayerBulkApproveBar {...props} onApproveConfident={onApproveConfident} onApproveRemaining={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: props.confidentLabel }));

    expect(onApproveConfident).toHaveBeenCalledTimes(1);
    expect(screen.getByText(props.breakdownLabel)).toBeInTheDocument();
  });

  it('nút máy chưa chắc hỏi lại, nêu số mục; "Thôi" không duyệt, "Vẫn duyệt" mới duyệt', () => {
    const onApproveRemaining = vi.fn();

    render(<ObjectLayerBulkApproveBar {...props} onApproveConfident={vi.fn()} onApproveRemaining={onApproveRemaining} />);
    fireEvent.click(screen.getByRole('button', { name: props.remainingLabel }));

    expect(onApproveRemaining).not.toHaveBeenCalled();
    expect(screen.getByText(props.remainingConfirm)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thôi' }));
    expect(onApproveRemaining).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: props.remainingLabel }));
    fireEvent.click(screen.getByRole('button', { name: 'Vẫn duyệt' }));
    expect(onApproveRemaining).toHaveBeenCalledTimes(1);
  });
});
