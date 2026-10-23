import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SLOW_PENDING_MS, SlowPendingShell } from './SlowPendingShell';

describe('SlowPendingShell', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('chỉ hiện nút Tải lại trang sau khi chờ quá lâu', () => {
    vi.useFakeTimers();
    render(<SlowPendingShell label="Đang tải màn hình" />);
    expect(screen.queryByRole('button', { name: 'Tải lại trang' })).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(SLOW_PENDING_MS);
    });
    expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeInTheDocument();
  });
});
