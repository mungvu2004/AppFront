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
});
