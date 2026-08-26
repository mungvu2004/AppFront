/**
 * Bộ kiểm của khối phiên đăng nhập — view thuần, trạng thái 3, và vé hoàn tác D-05.
 *
 * Ba điều bộ kiểm này giữ, và chúng là ba điều dễ trôi nhất của khối:
 *
 * 1. **Dải cảnh báo nằm TRONG khối.** Trạng thái 3 nói "một phần": sáu khối kia
 *    vẫn dùng được. Phép khẳng định vì thế soát *chỗ đứng* của dải cảnh báo, chứ
 *    không chỉ soát rằng nó có mặt.
 * 2. **Hoàn tác là hoàn tác thật.** Lượt thu hồi hoãn sau vé tám giây, nên bấm
 *    "Hoàn tác" thì **chưa có gì đi qua cổng** — chứ không phải thu hồi rồi tạo
 *    lại, thứ không điểm cuối nào làm được.
 * 3. **Giảm chuyển động là tắt, không phải nhanh hơn.** `durationSeconds` trả về
 *    0, và 0 nghĩa là không có hoạt cảnh.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toast } from '@/components/feedback/Toast';
import { durationSeconds } from '@/lib/motion';
import { UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import type { AccountAuthGateway, AccountSession } from './accountAuthGateway';
import {
  SessionsSection,
  type AccountSessionRow,
  type SessionsSectionProps,
} from './SessionsSection';
import { useAccountAuth, type UseAccountAuthOptions } from './useAccountAuth';

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const MINUTE_MS = 60_000;

/** Một mốc cố định, để câu thời gian tương đối không đổi giữa hai lượt chạy. */
const NOW = Date.UTC(2026, 7, 27, 9, 0, 0);

const ROWS: readonly AccountSessionRow[] = [
  {
    id: 'session-current',
    device: 'Trình duyệt trên máy tính để bàn',
    location: 'Hà Nội, Việt Nam',
    lastActiveLabel: 'vừa xong',
    isCurrent: true,
  },
  {
    id: 'session-laptop',
    device: 'Trình duyệt trên máy tính xách tay',
    location: 'Đà Nẵng, Việt Nam',
    lastActiveLabel: '12 phút trước',
    isCurrent: false,
  },
];

function baseProps(overrides: Partial<SessionsSectionProps> = {}): SessionsSectionProps {
  return {
    rows: ROWS,
    warning: null,
    onRetry: vi.fn(),
    onSignOut: vi.fn(),
    signingOutId: null,
    reducedMotion: false,
    ...overrides,
  };
}

const SESSIONS: readonly AccountSession[] = [
  {
    id: 'session-current',
    device: 'Trình duyệt trên máy tính để bàn',
    location: 'Hà Nội, Việt Nam',
    lastActiveAt: NOW,
    isCurrent: true,
  },
  {
    id: 'session-laptop',
    device: 'Trình duyệt trên máy tính xách tay',
    location: 'Đà Nẵng, Việt Nam',
    lastActiveAt: NOW - 12 * MINUTE_MS,
    isCurrent: false,
  },
];

function fakeGateway(overrides: Partial<AccountAuthGateway> = {}): AccountAuthGateway {
  return {
    readIdentity: () =>
      Promise.resolve({ ok: true, data: { email: 'an@congty.vn', isManagedExternally: false } }),
    listSessions: () => Promise.resolve({ ok: true, data: SESSIONS }),
    changePassword: () => Promise.resolve({ ok: true, data: undefined }),
    revokeSession: () => Promise.resolve({ ok: true, data: undefined }),
    deleteAccount: () => Promise.resolve({ ok: true, data: undefined }),
    ...overrides,
  };
}

/** Hook thật cắm vào view thật — khối phiên đo được từ đầu tới cuối. */
function WiredSessions(props: UseAccountAuthOptions) {
  const model = useAccountAuth(props);

  return <SessionsSection {...model.sessions} />;
}

/* -------------------------------------------------------------------------- */
/* View thuần.                                                                 */
/* -------------------------------------------------------------------------- */

describe('khối phiên đăng nhập — view dựng chỉ từ props', () => {
  it('mỗi hàng nói thiết bị, vị trí và hoạt động cuối', () => {
    renderWithProviders(<SessionsSection {...baseProps()} />);

    expect(screen.getByText('Trình duyệt trên máy tính để bàn')).toBeTruthy();
    expect(screen.getByText(/Hà Nội, Việt Nam/)).toBeTruthy();
    expect(screen.getByText(/vừa xong/)).toBeTruthy();
    expect(screen.getByText(/12 phút trước/)).toBeTruthy();
  });

  it('phiên của chính máy này mang nhãn và KHÔNG có nút đăng xuất', () => {
    renderWithProviders(<SessionsSection {...baseProps()} />);

    expect(screen.getByText('thiết bị này')).toBeTruthy();
    // Hai hàng, một nút: hàng hiện tại không tự đăng xuất được.
    expect(screen.getAllByRole('button', { name: /Đăng xuất/ })).toHaveLength(1);
  });

  it('nút chìm gọi onSignOut với đúng mã phiên của hàng đó', () => {
    const onSignOut = vi.fn();

    renderWithProviders(<SessionsSection {...baseProps({ onSignOut })} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Đăng xuất khỏi Trình duyệt trên máy tính xách tay' }),
    );

    expect(onSignOut).toHaveBeenCalledWith('session-laptop');
  });

  it('đang gửi một lượt thì mọi nút đăng xuất khác cùng khoá', () => {
    renderWithProviders(<SessionsSection {...baseProps({ signingOutId: 'session-laptop' })} />);

    expect(
      screen.getByRole('button', { name: 'Đăng xuất khỏi Trình duyệt trên máy tính xách tay' }),
    ).toBeDisabled();
  });

  it('trạng thái 3 — dải cảnh báo nằm TRONG khối, kèm nút đọc lại', () => {
    const onRetry = vi.fn();

    const { container } = renderWithProviders(
      <SessionsSection
        {...baseProps({
          rows: [],
          warning: 'Không đọc được danh sách phiên đang mở. Thử lại sau ít phút.',
          onRetry,
        })}
      />,
    );

    const block = container.firstElementChild;

    if (block === null) {
      throw new Error('khối phiên không dựng được');
    }

    // Dải cảnh báo là con của khối, không phải của trang. Đó là toàn bộ nghĩa
    // của "một phần" trong trạng thái 3.
    const alert = within(block as HTMLElement).getByRole('alert');
    expect(alert.textContent).toContain('Không đọc được danh sách phiên');

    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('không có phiên nào và cũng không có cảnh báo thì nói ra một câu', () => {
    renderWithProviders(<SessionsSection {...baseProps({ rows: [] })} />);

    expect(screen.getByText('Chưa có phiên nào đang mở.')).toBeTruthy();
  });

  it('chuỗi là tiếng Việt có dấu, và cây render tiếp cận được', () => {
    const { container } = renderWithProviders(
      <SessionsSection
        {...baseProps({ warning: 'Không đọc được danh sách phiên đang mở. Thử lại sau ít phút.' })}
      />,
    );

    expectVietnamese(container);
    expectAccessible(container);
  });
});

/* -------------------------------------------------------------------------- */
/* Giảm chuyển động.                                                           */
/* -------------------------------------------------------------------------- */

describe('giảm chuyển động tắt hoạt cảnh, không rút ngắn nó', () => {
  it('nấc thay cho 240 ms của đặc tả là standard = 260 ms, và nó về 0 khi giảm chuyển động', () => {
    // R1: 240 không có trong thang của mục B. Nấc gần nhất là 'standard'.
    expect(durationSeconds('standard')).toBe(0.26);
    expect(durationSeconds('standard', { reducedMotion: true })).toBe(0);
  });

  it('hàng biến khỏi cây render dù bật hay tắt giảm chuyển động', async () => {
    for (const reducedMotion of [true, false]) {
      const { rerender, unmount } = renderWithProviders(
        <SessionsSection {...baseProps({ reducedMotion })} />,
      );

      expect(screen.getByText('Trình duyệt trên máy tính xách tay')).toBeTruthy();

      rerender(
        <SessionsSection {...baseProps({ reducedMotion, rows: ROWS.slice(0, 1) })} />,
      );

      await waitFor(() => {
        expect(screen.queryByText('Trình duyệt trên máy tính xách tay')).toBeNull();
      });

      unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Vé hoàn tác — D-05.                                                         */
/* -------------------------------------------------------------------------- */

describe('đăng xuất một phiên đi qua vé hoàn tác tám giây', () => {
  it('hàng biến ngay, toast mời hoàn tác, và bấm hoàn tác thì cổng chưa hề bị gọi', async () => {
    const revokeSession = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));

    renderWithProviders(
      <Toast.Provider>
        <WiredSessions gateway={fakeGateway({ revokeSession })} now={() => NOW} />
      </Toast.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Trình duyệt trên máy tính xách tay')).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Đăng xuất khỏi Trình duyệt trên máy tính xách tay' }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Trình duyệt trên máy tính xách tay')).toBeNull();
    });

    const undo = await screen.findByRole('button', { name: 'Hoàn tác' });
    expect(screen.getByText('Đã đăng xuất khỏi Trình duyệt trên máy tính xách tay')).toBeTruthy();

    fireEvent.click(undo);

    await waitFor(() => {
      expect(screen.getByText('Trình duyệt trên máy tính xách tay')).toBeTruthy();
    });

    // Đây là câu quan trọng nhất của cả file: lượt thu hồi CHƯA từng đi qua dây,
    // nên "hoàn tác" ở đây là hoàn tác thật chứ không phải một lượt tạo lại.
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it('rời màn giữa cửa sổ hoàn tác thì lượt thu hồi vẫn gửi đi', async () => {
    const revokeSession = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));

    const { unmount } = renderWithProviders(
      <WiredSessions gateway={fakeGateway({ revokeSession })} now={() => NOW} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Trình duyệt trên máy tính xách tay')).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Đăng xuất khỏi Trình duyệt trên máy tính xách tay' }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Trình duyệt trên máy tính xách tay')).toBeNull();
    });

    // Huỷ hẹn giờ không phải huỷ việc: người dùng đã bấm, đã thấy hàng biến, và
    // đã không hoàn tác. Đóng thẻ hai giây sau mà phiên vẫn mở là màn hình nói
    // dối đúng chuyện nó tồn tại để nói thật.
    unmount();

    expect(revokeSession).toHaveBeenCalledTimes(1);
    expect(revokeSession).toHaveBeenCalledWith({ sessionId: 'session-laptop' });
  });

  /**
   * THỨ TỰ CÓ NGHĨA: hai phép kiểm dùng đồng hồ giả đứng CUỐI khối này.
   *
   * `framer-motion` giữ một vòng lặp khung hình dùng chung cho cả tệp; đi qua một
   * đoạn `vi.useFakeTimers()` rồi trả lại đồng hồ thật thì vòng lặp ấy không tỉnh
   * lại, và phép kiểm nào sau đó chờ hàng thu xong sẽ treo tới lúc hết giờ — một
   * thất bại đọc lên như lỗi của khối chứ không như lỗi của thứ tự. Phép kiểm nào
   * cần hàng biến khỏi cây render thì đặt TRƯỚC hai cái dưới đây.
   */
  it('để vé trôi hết tám giây thì lượt thu hồi mới đi, đúng một lần', async () => {
    const revokeSession = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));

    renderWithProviders(<WiredSessions gateway={fakeGateway({ revokeSession })} now={() => NOW} />);

    await waitFor(() => {
      expect(screen.getByText('Trình duyệt trên máy tính xách tay')).toBeTruthy();
    });

    vi.useFakeTimers();

    try {
      fireEvent.click(
        screen.getByRole('button', { name: 'Đăng xuất khỏi Trình duyệt trên máy tính xách tay' }),
      );

      // Chưa hết cửa sổ thì chưa gửi gì.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
      });
      expect(revokeSession).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(revokeSession).toHaveBeenCalledTimes(1);
      expect(revokeSession).toHaveBeenCalledWith({ sessionId: 'session-laptop' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('cổng từ chối lượt thu hồi thì dải cảnh báo hiện lên trong khối', async () => {
    renderWithProviders(
      <WiredSessions
        gateway={fakeGateway({
          revokeSession: () => Promise.resolve({ ok: false, error: 'session-gone' }),
        })}
        now={() => NOW}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Trình duyệt trên máy tính xách tay')).toBeTruthy();
    });

    vi.useFakeTimers();

    try {
      fireEvent.click(
        screen.getByRole('button', { name: 'Đăng xuất khỏi Trình duyệt trên máy tính xách tay' }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      });
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Phiên này đã đóng từ trước');
    });
  });
});
