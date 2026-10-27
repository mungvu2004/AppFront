import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProvisionalScaleBanner } from './ProvisionalScaleBanner';

const MESSAGE = 'Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.';

afterEach(() => {
  sessionStorage.clear();
});

describe('ProvisionalScaleBanner (G4a-01, G2-22)', () => {
  it('ẩn được và nhớ trong phiên theo tầng', () => {
    const notice = { dismissKey: 'p/f1', message: MESSAGE, onCalibrate: vi.fn() };
    const { unmount } = render(<ProvisionalScaleBanner notice={notice} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn thông báo' }));
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();

    unmount();
    render(<ProvisionalScaleBanner notice={notice} />);
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();

    render(<ProvisionalScaleBanner notice={{ ...notice, dismissKey: 'p/f2' }} />);
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
  });

  it('không có onCalibrate (người xem) thì không có nút Đặt tỷ lệ', () => {
    render(<ProvisionalScaleBanner notice={{ dismissKey: 'p/f3', message: MESSAGE }} />);

    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đặt tỷ lệ' })).not.toBeInTheDocument();
  });

  it('tầng không đo được tỷ lệ: dải đỏ không ẩn được, kể cả khi đã ẩn dải vàng (UX-R1 K12); nút "Đặt tỷ lệ" chỉ ở cổng (UX-R2)', () => {
    sessionStorage.setItem('provisional-scale-dismissed:p/f4', '1');
    render(<ProvisionalScaleBanner notice={{ dismissKey: 'p/f4', level: 'violation', message: MESSAGE, onCalibrate: vi.fn() }} />);

    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ẩn thông báo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đặt tỷ lệ' })).not.toBeInTheDocument();
  });
});
