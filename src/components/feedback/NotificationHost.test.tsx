import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNotificationBus } from '@/lib/mutations/notificationBus';
import { createUndoTicket, LONG_UNDO_WINDOW_MS, UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';

import { NotificationHost } from './NotificationHost';
import { OFFLINE_NOTICE } from './offlineNotice';

describe('NotificationHost — lỗi mới gộp vào thông báo cùng loại đã tắt (FL-11F-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Như Toast.test.tsx: khung hình là đồng hồ giả.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => { cb(Date.now()); }, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { clearTimeout(id); });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('thông báo đã hết giờ rồi bị bus gộp chữ mới vào thì chữ mới vẫn hiện', async () => {
    // Cửa sổ gộp dài hơn đồng hồ đếm ngược 8 s của toast: lượt thứ hai gộp vào CÙNG id đã tắt.
    const bus = createNotificationBus({ groupWindowMs: 60_000 });
    render(<NotificationHost bus={bus} />);

    act(() => {
      bus.publish({ type: 'floor-fail', title: 'Chưa lưu được', description: 'Lỗi thứ nhất' });
    });
    expect(screen.getByText(/Lỗi thứ nhất/u)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.queryByText(/Lỗi thứ nhất/u)).toBeNull();

    act(() => {
      bus.publish({ type: 'floor-fail', title: 'Chưa lưu được', description: 'Lỗi thứ hai' });
    });
    expect(screen.getByText(/Lỗi thứ hai/u)).toBeTruthy();
  });
});

describe('NotificationHost — mất mạng (U56)', () => {
  it('trình duyệt báo offline thì hiện toast mất mạng', () => {
    const bus = createNotificationBus();
    render(<NotificationHost bus={bus} />);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(new RegExp(OFFLINE_NOTICE.title, 'u'))).toBeTruthy();
  });
});

describe('NotificationHost — toast hoàn tác giữ đủ cửa sổ của vé (UX-35)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => { cb(Date.now()); }, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { clearTimeout(id); });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('vé xoá tường 15 s: toast còn sau 8 s và 14 s, hết vé mới đi', async () => {
    const bus = createNotificationBus();
    render(<NotificationHost bus={bus} />);
    const ticket = createUndoTicket({
      description: 'Đã xoá tường số 4 (#W-007).',
      ttlMs: LONG_UNDO_WINDOW_MS,
      undo: () => undefined,
    });

    act(() => {
      bus.publish({ type: 'wall-delete', title: ticket.description, description: '', undoTicket: ticket });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS + 500);
    });
    expect(screen.getByText(/#W-007/u)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LONG_UNDO_WINDOW_MS - UNDO_WINDOW_MS - 1500);
    });
    expect(screen.getByText(/#W-007/u)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByText(/#W-007/u)).toBeNull();
  });
});
