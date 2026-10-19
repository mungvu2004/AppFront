/**
 * B-V2-04 — bấm một thông báo ở `/thong-bao` phải tới màn của nó.
 *
 * Tệp riêng vì nó thay cổng dữ liệu của cả mô-đun bằng `vi.mock`: route không nhận
 * cổng tiêm vào, còn `NotificationCenter.test.tsx` cần cổng thật cho các bài dây.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_NOTIFICATIONS } from '@/api/__mocks__/client';
import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES } from '@/routes/paths';

import { NotificationCenterRoute } from './NotificationCenter.container';
import type * as GatewayModule from './notificationCenterGateway';
import type { NotificationCenterGateway } from './notificationModel';

vi.mock('./notificationCenterGateway', async (importActual) => {
  const actual = await importActual<typeof GatewayModule>();
  const items = MOCK_NOTIFICATIONS.map((wire) => actual.toNotificationItemVm(wire, Date.now()));
  const gateway: NotificationCenterGateway = {
    list: () => Promise.resolve(items),
    markRead: () => Promise.resolve(),
    markAllRead: () => Promise.resolve(),
    acceptInvite: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };

  return { ...actual, createNotificationCenterGateway: () => gateway };
});

// jsdom không có matchMedia; Drawer.Root gọi nó ngay lần render đầu (khuôn AppShell.test.tsx).
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function Landing() {
  return <p>đang ở {useLocation().pathname}</p>;
}

describe('NotificationCenterRoute', () => {
  it('mở thẳng rồi bấm một thông báo ⇒ tới màn của thông báo, không bị lượt "đóng" kéo về /', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // `MemoryRouter`, không `createMemoryRouter`: bộ định tuyến dữ liệu dựng `Request`
    // với `AbortSignal` mà jsdom không nhận, và lượt điều hướng chết lặng.
    renderWithProviders(
      <MemoryRouter initialEntries={[ROUTES.notifications]}>
        <Routes>
          <Route path={ROUTES.notifications} element={<NotificationCenterRoute />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </MemoryRouter>,
    );

    const first = MOCK_NOTIFICATIONS[0];
    if (first === undefined) throw new Error('bộ mẫu thông báo rỗng');
    const target = (await import('./notificationCenterGateway')).toNotificationItemVm(first, Date.now()).target.to;

    const [row] = await screen.findAllByText(first.message, { exact: false });
    if (row === undefined) throw new Error('không thấy dòng thông báo đầu');
    fireEvent.click(row);
    // Chạy hết mọi hẹn giờ: không lượt "đóng" muộn nào được kéo người dùng về.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(screen.getByText(`đang ở ${target}`)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('G1-15: /thong-bao là trang thật — tiêu đề, bộ lọc, đánh dấu tất cả, danh sách; không hộp thoại, không "Xem tất cả"', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={[ROUTES.notifications]}>
        <Routes>
          <Route path={ROUTES.notifications} element={<NotificationCenterRoute />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Thông báo' })).toBeInTheDocument();
    const first = MOCK_NOTIFICATIONS[0];
    if (first === undefined) throw new Error('bộ mẫu thông báo rỗng');
    await screen.findAllByText(first.message, { exact: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Trung tâm thông báo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem tất cả' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeInTheDocument();
    for (const name of ['Tất cả', 'Chưa đọc', 'Nhắc đến tôi']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }

    // Esc không còn rời trang: đây là một trang thường, không phải lớp phủ.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByRole('heading', { level: 1, name: 'Thông báo' })).toBeInTheDocument();
  });
});
