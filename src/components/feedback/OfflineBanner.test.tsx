import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearPendingEdits, notePendingEdit } from '@/lib/autosave/pendingEdits';

import { OfflineBanner } from './OfflineBanner';

describe('OfflineBanner (UX-40)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearPendingEdits();
  });

  it('có mạng thì không hiện', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);

    expect(screen.queryByText(/Mất mạng/u)).not.toBeInTheDocument();
  });

  it('mất mạng thì hiện dải trên cùng kèm số thao tác đang chờ gửi', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);

    online.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Mất mạng · Thay đổi sẽ tự lưu khi có mạng lại')).toBeInTheDocument();

    act(() => {
      notePendingEdit();
      notePendingEdit();
      notePendingEdit();
    });
    expect(screen.getByText('Mất mạng · 3 thao tác đang chờ gửi')).toBeInTheDocument();

    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/Mất mạng/u)).not.toBeInTheDocument();
  });
});
