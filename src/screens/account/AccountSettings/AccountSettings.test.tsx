/**
 * Khung xương của màn `/tai-khoan` — bộ kiểm của T2, và chỉ của T2.
 *
 * File này soát **mối nối**, không soát ruột khối nào: đường dẫn, bảy khung
 * thẻ, trạng thái 2 của cả trang, lỗi đọc cấp trang, và một lượt tự lưu đi trọn
 * đường từ `port.stage` tới cổng lưu. Ba người dựng khối viết bộ kiểm của riêng
 * mình, kể cả `expectSevenStates` cho sáu trạng thái còn lại.
 *
 * Mọi phép dựng ở đây đi qua hook thật chứ không qua một `vm` viết tay: props
 * của bảy khối thuộc về T3/T4/T5 và sẽ đổi, còn mối nối thì không. Một bộ kiểm
 * viết tay `vm` sẽ bắt ba người kia phải sửa file này, mà file này là của T2.
 */

import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES, ROUTE_PATTERNS } from '@/routes/paths';

import { AccountSettingsContainer } from './AccountSettings.container';
import { EMPTY_ACCOUNT_DRAFT, type AccountDraft, type AccountDraftPort } from './accountDraft';
import type { AccountSettingsGateway } from './accountSettingsGateway';
import type { AccountPreferencesModel } from './useAccountPreferences';
import { ACCOUNT_AUTOSAVE_DEBOUNCE_MS, toSaveState } from './useAccountSettings';

/**
 * Cổng mà `useAccountSettings` trao cho hook con, bắt lại để test đóng vai hook con.
 *
 * Bản mô phỏng **gọi tiếp hook thật** chứ không thay nó: T4 dựng xong khối hồ sơ
 * và giao diện thì file này vẫn chạy nguyên, vì nó không giả định gì về thứ hook
 * đó trả về.
 */
let mockCapturedPort: AccountDraftPort | null = null;

vi.mock('./useAccountPreferences', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('./useAccountPreferences');
  const original = actual['useAccountPreferences'] as (
    port: AccountDraftPort,
  ) => AccountPreferencesModel;

  return {
    ...actual,
    useAccountPreferences: (port: AccountDraftPort): AccountPreferencesModel => {
      mockCapturedPort = port;

      return original(port);
    },
  };
});

beforeEach(() => {
  mockCapturedPort = null;
});

afterEach(() => {
  cleanup();
});

/** Bảy tiêu đề mà khung vẽ. Ruột của chúng thuộc về người khác. */
const BLOCK_TITLES = [
  'hồ sơ',
  'giao diện',
  'thông báo',
  'phím tắt',
  'mật khẩu',
  'phiên đăng nhập',
  'vùng nguy hiểm',
] as const;

/** Cổng đọc được ngay, ghi vào một mảng để test đếm số lượt lưu. */
function createRecordingGateway(): {
  gateway: AccountSettingsGateway;
  saves: AccountDraft[];
} {
  const saves: AccountDraft[] = [];

  return {
    saves,
    gateway: {
      read: () => Promise.resolve(EMPTY_ACCOUNT_DRAFT),
      save: (draft) => {
        saves.push(draft);

        return Promise.resolve();
      },
    },
  };
}

describe('đường dẫn của màn cài đặt tài khoản', () => {
  it('là /tai-khoan, và khoá vẫn là định danh tiếng Anh', () => {
    expect(ROUTE_PATTERNS.account).toBe('/tai-khoan');
    expect(ROUTES.account).toBe(ROUTE_PATTERNS.account);
  });
});

describe('khung của màn', () => {
  it('vẽ đủ bảy khối, mỗi khối một tiêu đề đọc được', async () => {
    const { gateway } = createRecordingGateway();

    renderWithProviders(<AccountSettingsContainer gateway={gateway} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'cài đặt tài khoản' })).toBeTruthy();
    });

    for (const title of BLOCK_TITLES) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeTruthy();
    }

    // A7: chỉ báo lưu nói ra được, và nó là `role="status"`.
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('chuỗi hiển thị là tiếng Việt có dấu, và cây render tiếp cận được', async () => {
    const { gateway } = createRecordingGateway();

    const { container } = renderWithProviders(<AccountSettingsContainer gateway={gateway} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'hồ sơ' })).toBeTruthy();
    });

    expectVietnamese(container);
    expectAccessible(container);
  });
});

describe('trạng thái 2 — đang tải, và nó là của cả trang', () => {
  it('khi lượt đọc chưa về thì bảy khối là khung xương, không khối nào có ruột', () => {
    const pendingGateway: AccountSettingsGateway = {
      read: () => new Promise<AccountDraft>(() => undefined),
      save: () => Promise.resolve(),
    };

    renderWithProviders(<AccountSettingsContainer gateway={pendingGateway} />);

    // Bảy tiêu đề vẫn có — khung xương là khung xương của thẻ, không phải một
    // trang trắng thay chỗ cả màn (A11).
    for (const title of BLOCK_TITLES) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeTruthy();
    }

    // …còn ruột thì chưa: câu giữ chỗ của khối chưa xuất hiện.
    expect(screen.queryByText('Khối hồ sơ đang được dựng.')).toBeNull();
  });
});

describe('lỗi đọc cấp trang', () => {
  it('thay chỗ bảy khối bằng một dải cảnh báo có nút đọc lại', async () => {
    const failingGateway: AccountSettingsGateway = {
      read: () => Promise.reject(new Error('đọc hỏng')),
      save: () => Promise.resolve(),
    };

    renderWithProviders(<AccountSettingsContainer gateway={failingGateway} />);

    await waitFor(() => {
      expect(screen.getByText('Không tải được cài đặt tài khoản')).toBeTruthy();
    });

    expect(screen.queryByRole('heading', { level: 2, name: 'hồ sơ' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });
});

describe('mối nối tự lưu (D-07)', () => {
  it('bộ đếm của màn là 800 ms — con số của bất biến A7', () => {
    expect(ACCOUNT_AUTOSAVE_DEBOUNCE_MS).toBe(800);
  });

  it('dịch trọn năm nhánh của AutosaveState sang SaveState', () => {
    expect(toSaveState('dirty')).toBe('pending');
    expect(toSaveState('saving')).toBe('saving');
    expect(toSaveState('saved')).toBe('saved');
    expect(toSaveState('failed')).toBe('error');
    // Ngoại tuyến gộp vào 'error': `SaveState` không có nhánh nào cho nó, và với
    // người dùng hai thứ nói cùng một điều.
    expect(toSaveState('offline')).toBe('error');
  });

  it('một lượt port.stage đi trọn đường tới cổng lưu sau khi hết 800 ms', async () => {
    const { gateway, saves } = createRecordingGateway();

    renderWithProviders(<AccountSettingsContainer gateway={gateway} />);

    await waitFor(() => {
      expect(mockCapturedPort).not.toBeNull();
      expect(mockCapturedPort?.saved).toBeTruthy();
    });

    const port = mockCapturedPort;

    if (port === null) {
      throw new Error('không bắt được cổng — mối nối hỏng');
    }

    vi.useFakeTimers();

    try {
      // Đây là đúng thứ một hook con làm, viết bằng chính API mà hook con dùng.
      act(() => {
        port.stage('appearance', { theme: 'dark' });
      });

      // Chưa hết giờ thì chưa gửi gì: bộ đếm là 800 ms, không phải 0.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ACCOUNT_AUTOSAVE_DEBOUNCE_MS - 1);
      });
      expect(saves).toHaveLength(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(saves).toHaveLength(1);
      expect(saves[0]?.appearance).toEqual({ theme: 'dark' });
      // Mật khẩu không có khoá nào ở đây, và đó là chủ ý.
      expect(Object.keys(saves[0] ?? {}).sort()).toEqual([
        'appearance',
        'notifications',
        'profile',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
