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

import { readFileSync } from 'node:fs';

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONTRAST_MINIMUM_BODY, checkContrast, parsePalette } from '@/lib/coloring/legend';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { formatNumber } from '@/lib/format/number';
import { buildGlobalShortcuts } from '@/lib/input/shortcutRegistry';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  createSevenStateScenarios,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import { ROUTES, ROUTE_PATTERNS } from '@/routes/paths';

import { AccountSettings } from './AccountSettings';
import { AccountSettingsContainer } from './AccountSettings.container';
import { EMPTY_ACCOUNT_DRAFT, type AccountDraft, type AccountDraftPort } from './accountDraft';
import type { AccountSettingsGateway } from './accountSettingsGateway';
import type { AccountSessionRow } from './SessionsSection';
import type { NotificationEventModel } from './NotificationsSection';
import {
  DENSITY_ROW_CLASS,
  LANGUAGE_OPTIONS,
  type AccountPreferencesModel,
} from './useAccountPreferences';
import { NOTIFICATION_CHANNELS, buildShortcutRows } from './useAccountTables';
import {
  ACCOUNT_AUTOSAVE_DEBOUNCE_MS,
  toSaveState,
  type AccountSettingsViewModel,
} from './useAccountSettings';

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

/* ========================================================================== */
/* Nghiệm thu cả màn — T6.                                                     */
/*                                                                            */
/* Phần trên là mối nối của T2 và không đổi. Phần này hỏi câu của lượt cuối:   */
/* bảy trạng thái của CẢ trang, chuyển động khi người dùng tắt chuyển động,    */
/* tương phản chữ ở chủ đề tối, số phím tắt hiển thị so với số mục đã đăng ký, */
/* và năm lượt đổi chủ đề liên tiếp.                                          */
/*                                                                            */
/* Mọi con số in ra bằng `console.log` chứ không chỉ nằm trong một `expect`:   */
/* lượt nghiệm thu phải đọc được số mà không phải mở file test (E.10).         */
/* ========================================================================== */

/** Một mẫu thư điện tử dùng chung cho khối hồ sơ và vùng nguy hiểm. */
const SAMPLE_EMAIL = 'an@congty.vn';

/** Hai phiên mẫu. `lastActiveLabel` đã là chuỗi — A15 nói định dạng xong ở viewmodel. */
const SAMPLE_SESSIONS: readonly AccountSessionRow[] = [
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

/** Năm sự việc của ma trận thông báo, dựng từ hai kênh mà T5 khai. */
const NOTIFICATION_EVENTS: readonly NotificationEventModel[] = [
  { id: 'aiCompleted', label: 'AI xử lý xong' },
  { id: 'violationFound', label: 'Phát hiện vi phạm mới' },
  { id: 'projectInvite', label: 'Được mời vào dự án' },
  { id: 'commentMention', label: 'Bình luận nhắc đến tôi' },
  { id: 'morningDigest', label: 'Tổng hợp mỗi sáng' },
].map((event, index) => ({
  ...event,
  cells: NOTIFICATION_CHANNELS.map((channel, column) => ({
    channelId: channel.id,
    label: `${event.label} — ${channel.label}`,
    isOn: (index + column) % 2 === 0,
  })),
}));

/**
 * Một `AccountSettingsViewModel` cho mỗi kịch bản trong bảy trạng thái.
 *
 * View là view thuần (mục D), nên bảy trạng thái dựng được **chỉ từ props** —
 * không hook, không cổng, không đồng hồ. Bảng chia chủ nằm ở
 * `useAccountSettings.ts`; đây là chỗ nó thành bảy lượt render thật:
 *
 * | # | Trạng thái | Chủ | Hiện ra ở đâu trong `vm` |
 * |---|---|---|---|
 * | 1 | rỗng | T4 | `avatarUrl: null`, `jobTitle: ''`, khối phím tắt không khớp gì |
 * | 2 | đang tải | T2 | `isLoading` → bảy thẻ thành khung xương |
 * | 3 | một phần | T3 + T4 | ảnh đại diện đang tải lên **và** dải cảnh báo trong khối phiên |
 * | 4 | lỗi | T3 | `currentPasswordProblem` buộc vào đúng ô mật khẩu cũ |
 * | 5 | thành công | tất cả | mọi khối có dữ liệu, không lỗi nào |
 * | 6 | không có quyền | T3 | `isManagedExternally` → khối mật khẩu chỉ đọc |
 * | 7 | thu gọn | T5 | `isCollapsed` → ma trận thành danh sách sự việc |
 */
function vmFor(
  scenario: SevenStateScenario,
  overrides: { readonly motionOff?: boolean } = {},
): AccountSettingsViewModel {
  const isEmpty = scenario.state === 'empty';
  const isPartial = scenario.state === 'partial';
  const isError = scenario.error !== null;
  const isForbidden = !scenario.canView;
  const motionOff = overrides.motionOff ?? false;

  return {
    isLoading: scenario.isLoading,
    // Lỗi ĐỌC cấp trang là một nhánh khác, và bộ kiểm của T2 ở trên đã soát nó.
    // Trạng thái 4 của bảng là lỗi của T3, buộc vào đúng ô đã gây ra nó.
    errorMessage: null,
    retryLoad: vi.fn(),
    saveState: isError ? 'error' : 'saved',
    saveLabel: isError ? 'Lưu thất bại' : 'Đã lưu lúc 09:00',
    preferences: {
      profile: {
        avatarUrl: isEmpty ? null : '/mau/anh-dai-dien.png',
        avatarInitials: 'NH',
        avatarAlt: 'Ảnh đại diện của Nguyễn Thu Hà',
        isAvatarUploading: isPartial,
        avatarStatusLabel: 'Đang tải ảnh lên…',
        onAvatarFileSelected: vi.fn(),
        fullName: 'Nguyễn Thu Hà',
        onFullNameChange: vi.fn(),
        jobTitle: isEmpty ? '' : 'Kỹ sư kết cấu',
        onJobTitleChange: vi.fn(),
        jobTitlePlaceholder: 'chưa đặt',
        email: SAMPLE_EMAIL,
        emailReadOnlyReason: 'Thư điện tử là tên đăng nhập nên chỉ đọc ở đây.',
        onChangeEmail: vi.fn(),
        phone: isEmpty ? '' : '0912 345 678',
        onPhoneChange: vi.fn(),
        language: 'vi',
        languageOptions: LANGUAGE_OPTIONS,
        onLanguageChange: vi.fn(),
        // R6: vệt sáng của hàng là prop `flash` có sẵn, tô `bg-accent-wash`.
        flashedField: isPartial ? 'fullName' : null,
        rowClassName: DENSITY_ROW_CLASS.comfortable,
        motionOff,
      },
      appearance: {
        theme: 'light',
        onThemeChange: vi.fn(),
        viewportDark: false,
        onViewportDarkChange: vi.fn(),
        reducedMotion: motionOff,
        onReducedMotionChange: vi.fn(),
        showGrid: true,
        onShowGridChange: vi.fn(),
        density: 'comfortable',
        onDensityChange: vi.fn(),
        flashedField: null,
        rowClassName: DENSITY_ROW_CLASS.comfortable,
        motionOff,
      },
    },
    tables: {
      notifications: {
        channels: NOTIFICATION_CHANNELS,
        events: NOTIFICATION_EVENTS,
        isCollapsed: scenario.isCollapsed,
        onChange: vi.fn(),
      },
      shortcuts: {
        query: isEmpty ? 'lệnh chưa có' : '',
        onQueryChange: vi.fn(),
        // Không viết tay danh sách phím tắt: nó dẫn xuất từ I-01.
        rows: isEmpty ? [] : buildShortcutRows(),
        countLabel: isEmpty
          ? 'Không hiện phím tắt nào.'
          : 'Đang hiện đủ số phím tắt đang có hiệu lực.',
        emptyMessage: 'Không có phím tắt nào khớp với ô tìm.',
        rowMotion: motionOff
          ? { layout: false, transition: { duration: 0 } }
          : { layout: 'position', transition: { duration: 0 } },
      },
    },
    auth: {
      password: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        onCurrentPasswordChange: vi.fn(),
        onNewPasswordChange: vi.fn(),
        onConfirmPasswordChange: vi.fn(),
        currentPasswordProblem: isError ? 'Mật khẩu hiện tại không đúng.' : null,
        newPasswordProblem: null,
        confirmPasswordProblem: null,
        strength: null,
        canSubmit: false,
        isSubmitting: false,
        onSubmit: vi.fn(),
        successMessage: null,
        isManagedExternally: isForbidden,
      },
      sessions: {
        rows: isEmpty || isError || isForbidden ? [] : SAMPLE_SESSIONS,
        warning: isPartial
          ? 'Không đọc được danh sách phiên đang mở. Thử lại sau ít phút.'
          : null,
        onRetry: vi.fn(),
        onSignOut: vi.fn(),
        signingOutId: null,
        reducedMotion: motionOff,
      },
      danger: {
        email: SAMPLE_EMAIL,
        isDialogOpen: false,
        onRequestDelete: vi.fn(),
        onCancelDelete: vi.fn(),
        onConfirmDelete: vi.fn(),
        confirmValue: '',
        onConfirmValueChange: vi.fn(),
        canConfirm: false,
        isDeleting: false,
        errorMessage: null,
      },
    },
  };
}

/** Kịch bản của một trạng thái, hoặc một lỗi nói rõ trạng thái nào thiếu. */
function scenarioOf(state: SevenStateScenario['state']): SevenStateScenario {
  const found = createSevenStateScenarios().find((one) => one.state === state);

  if (found === undefined) {
    throw new Error(`bộ kịch bản không có trạng thái "${state}"`);
  }

  return found;
}

/* -------------------------------------------------------------------------- */
/* ii. Bảy trạng thái của cả màn.                                              */
/* -------------------------------------------------------------------------- */

describe('A11 — bảy trạng thái, đo trên cả màn chứ không trên một khối', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<AccountSettings vm={vmFor(scenario)} />);
    }, createSevenStateScenarios());

    console.log(
      `[T6] expectSevenStates = ${String(covered.length)}/${String(SEVEN_STATES.length)} — ${covered.join(', ')}`,
    );

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });

  it('mỗi trạng thái vẽ ra thứ riêng của nó, không phải bảy lần cùng một trang', () => {
    const byState = new Map<string, string>();

    for (const scenario of createSevenStateScenarios()) {
      const { container, unmount } = render(<AccountSettings vm={vmFor(scenario)} />);

      byState.set(scenario.state, container.innerHTML);
      unmount();
    }

    // Trạng thái 2 là của cả trang: khung xương thay chỗ ruột của bảy khối.
    expect(byState.get('loading')).not.toEqual(byState.get('success'));

    // Năm trạng thái còn lại nằm trong ruột khối, nên chúng phải khác 'success'
    // — nếu một cái trùng thì kịch bản của nó không tới được khối nào.
    for (const state of ['empty', 'partial', 'error', 'forbidden', 'collapsed']) {
      expect(byState.get(state)).not.toEqual(byState.get('success'));
    }
  });

  it('trạng thái 6 làm khối mật khẩu chỉ đọc, và nói ra lý do', () => {
    render(<AccountSettings vm={vmFor(scenarioOf('forbidden'))} />);

    expect(screen.getByText('Do quản trị viên công ty quản lý.')).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/* Tiếng Việt, khả năng tiếp cận và màu — trên cả màn.                          */
/* -------------------------------------------------------------------------- */

describe('cả màn: tiếng Việt có dấu, tiếp cận được, không mã màu thô', () => {
  it('expectVietnamese và expectAccessible chạy trên cây render của cả bảy khối', () => {
    const { container } = render(<AccountSettings vm={vmFor(scenarioOf('success'))} />);

    // Địa chỉ thư là dữ liệu, không phải câu chữ của giao diện — cùng ngoại lệ
    // mà `ProfileSection.test.tsx` đã mở.
    expectVietnamese(container, { ignore: [SAMPLE_EMAIL] });
    expectAccessible(container);
  });

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/account/AccountSettings');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* iii. Giảm chuyển động.                                                      */
/* -------------------------------------------------------------------------- */

/** Lớp Tailwind nào là một lời hứa chuyển động, sau khi bỏ tiền tố biến thể. */
const MOTION_CLASS =
  /^(transition(-[a-z]+)?|duration-\[?[\w.]+\]?|animate-[a-z-]+|ease-[a-z-]+|delay-\[?[\w.]+\]?)$/;

/**
 * Lớp nói "không có chuyển động". Chúng là công tắc TẮT, không phải hoạt cảnh.
 *
 * `duration-0` đáng kể nhất: một `transition-opacity duration-0` không nội suy
 * gì cả, và đó chính là cách hai khối của T4 tắt hoạt cảnh của mình.
 */
const MOTION_SILENCERS = new Set(['transition-none', 'animate-none', 'duration-0']);

/**
 * Lớp có chuyển động nhưng KHÔNG dịch chuyển gì.
 *
 * - `transition-colors` chỉ nội suy màu; không có gì di chuyển, nên nó không
 *   phải thứ mà "giảm chuyển động" nói tới.
 * - `animate-focus-ring` là vòng lấy nét. Tắt nó thì bàn phím mất dấu chỉ chỗ,
 *   mà A12 gọi bàn phím là đường đi hạng nhất.
 */
const MOTION_HARMLESS = new Set(['transition-colors', 'animate-focus-ring']);

/** Một phần tử còn mang lời hứa chuyển động, và những lớp nó mang. */
interface MotionSite {
  /** Khối chứa nó — `aria-labelledby` của thẻ `section`. */
  readonly block: string;
  readonly tag: string;
  /** Lớp chuyển động, còn nguyên tiền tố biến thể. */
  readonly classes: readonly string[];
  /** Lớp thật sự dịch chuyển thứ gì đó, sau khi trừ hai nhóm vô hại ở trên. */
  readonly movement: readonly string[];
  /** Có công tắc tắt trên chính phần tử ấy hay không. */
  readonly silenced: boolean;
}

/**
 * Mọi chỗ trong cây render còn hứa một chuyển động.
 *
 * Đọc **lớp** chứ không đọc `getComputedStyle`: jsdom không nạp Tailwind, nên
 * lớp là thứ duy nhất nói thật về việc trình duyệt sẽ chạy hoạt cảnh gì. Cũng vì
 * thế biến thể `motion-reduce:` phải đọc bằng cấu trúc — nó là một media query
 * mà jsdom không đánh giá, nhưng trình duyệt thì có.
 */
function motionSites(container: HTMLElement): readonly MotionSite[] {
  const sites: MotionSite[] = [];

  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    const classes = [...element.classList].filter((className) =>
      MOTION_CLASS.test(className.slice(className.lastIndexOf(':') + 1)),
    );

    if (classes.length === 0) {
      continue;
    }

    const bare = classes.map((className) => className.slice(className.lastIndexOf(':') + 1));
    const movement = classes.filter((className) => {
      const token = className.slice(className.lastIndexOf(':') + 1);

      return (
        !MOTION_SILENCERS.has(token) &&
        !MOTION_HARMLESS.has(token) &&
        !/^(duration|ease|delay)-/.test(token) &&
        // `motion-reduce:` là công tắc, không phải hoạt cảnh.
        !className.startsWith('motion-reduce:')
      );
    });

    sites.push({
      block: element.closest('section')?.getAttribute('aria-labelledby') ?? '(đầu trang)',
      tag: element.tagName.toLowerCase(),
      classes,
      movement,
      silenced:
        classes.some((className) => className.startsWith('motion-reduce:')) ||
        bare.some((token) => MOTION_SILENCERS.has(token)),
    });
  }

  return sites;
}

/** Bảng đếm từng lớp chuyển động trong cây, để in ra nguyên vẹn. */
function motionInventory(sites: readonly MotionSite[]): string {
  const counted = new Map<string, number>();

  for (const site of sites) {
    for (const className of site.classes) {
      const token = className.slice(className.lastIndexOf(':') + 1);

      counted.set(token, (counted.get(token) ?? 0) + 1);
    }
  }

  return [...counted.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([token, count]) => `${token}×${String(count)}`)
    .join(' · ');
}

/**
 * Số chỗ còn dịch chuyển thật khi người dùng đã tắt chuyển động.
 *
 * Đo được 12, và cả 12 đều nằm trong `src/components/ui` — thư mục mà
 * [KHÔNG ĐƯỢC SỬA FILE NÀO] đóng băng:
 *
 * | Chỗ | Lớp | File |
 * |---|---|---|
 * | ô chọn ngôn ngữ | `transition-all duration-120` | `ui/Select.tsx:145` |
 * | mũi tên của ô chọn | `transition-transform duration-180` | `ui/Select.tsx:158` |
 * | 10 dấu tích của ma trận | `transition-opacity duration-120` | `ui/Checkbox.tsx:80` |
 *
 * Số này là một cái chốt chỉ được NHỎ đi: sửa một trong ba chỗ trên thì nó giảm
 * và bài vẫn xanh, còn thêm một hoạt cảnh mới thì bài đỏ.
 */
const FROZEN_MOTION_RESIDUE = 12;

describe('giảm chuyển động — mọi hoạt cảnh của màn phải tắt', () => {
  it('không một hoạt cảnh nào của màn còn sống; chỗ còn lại đều trong file đóng băng', () => {
    const { container } = render(
      <AccountSettings vm={vmFor(scenarioOf('success'), { motionOff: true })} />,
    );

    const sites = motionSites(container);
    const moving = sites.filter((site) => site.movement.length > 0);
    const alive = moving.filter((site) => !site.silenced);

    console.log(`[T6] giảm chuyển động — toàn bộ lớp: ${motionInventory(sites)}`);
    console.log(
      `[T6] giảm chuyển động — ${String(moving.length)} chỗ có dịch chuyển, ` +
        `${String(moving.length - alive.length)} chỗ đã bị tắt tại chỗ, ` +
        `${String(alive.length)} chỗ còn sống: ` +
        alive
          .map((site) => `${site.block}/${site.tag} [${site.movement.join(' ')}]`)
          .join(' · '),
    );

    expect(alive.length).toBeLessThanOrEqual(FROZEN_MOTION_RESIDUE);

    // Không chỗ nào còn sống nằm ngoài ba khuôn của `ui/Select` và `ui/Checkbox`.
    for (const site of alive) {
      expect(
        site.movement.every((className) =>
          ['transition-all', 'transition-transform', 'transition-opacity'].includes(className),
        ),
        `hoạt cảnh lạ còn sống: ${site.block}/${site.tag} ${site.movement.join(' ')}`,
      ).toBe(true);
    }
  });

  it('công tắc của màn có tác dụng thật: bật thì không còn duration-0, tắt thì có', () => {
    const off = render(<AccountSettings vm={vmFor(scenarioOf('success'), { motionOff: true })} />);
    const offSilenced = motionSites(off.container).filter((site) =>
      site.classes.includes('duration-0'),
    ).length;

    off.unmount();

    const on = render(<AccountSettings vm={vmFor(scenarioOf('success'), { motionOff: false })} />);
    const onSilenced = motionSites(on.container).filter((site) =>
      site.classes.includes('duration-0'),
    ).length;

    console.log(
      `[T6] chỗ mang duration-0: khi tắt chuyển động = ${String(offSilenced)} · khi bật = ${String(onSilenced)}`,
    );

    // Tắt chuyển động thì màn tự dập hoạt cảnh của chính nó; bật lại thì không.
    expect(offSilenced).toBeGreaterThan(0);
    expect(onSilenced).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* iv. Tương phản chữ ở chủ đề tối.                                            */
/* -------------------------------------------------------------------------- */

const GLOBALS_CSS = readFileSync('src/styles/globals.css', 'utf8');

/** Chỗ khối `:root` bắt đầu — `html.dark` nằm TRƯỚC nó, có chủ ý. */
const ROOT_BLOCK_AT = GLOBALS_CSS.indexOf('  :root {');

const DARK_PALETTE = parsePalette(GLOBALS_CSS.slice(0, ROOT_BLOCK_AT));
const LIGHT_PALETTE = parsePalette(GLOBALS_CSS.slice(ROOT_BLOCK_AT));

/** Bốn cặp chữ/nền mà [NGHIỆM THU] bắt đo. */
const CONTRAST_PAIRS: readonly (readonly [ColorTokenName, ColorTokenName])[] = [
  ['--text-primary', '--bg-app'],
  ['--text-primary', '--bg-surface'],
  ['--text-secondary', '--bg-app'],
  ['--text-secondary', '--bg-surface'],
];

/** Tỉ số, viết theo A15 — dấu thập phân là dấu phẩy. */
function ratioText(value: number): string {
  return `${formatNumber(value, { fractionDigits: 2 })}:1`;
}

/** Bốn cặp, đo trên một bảng màu. */
function measurePairs(palette: ReturnType<typeof parsePalette>): readonly {
  readonly pair: string;
  readonly ratio: number;
}[] {
  return CONTRAST_PAIRS.map(([text, background]) => ({
    pair: `${text}/${background}`,
    ratio: checkContrast(background, text, palette).ratio,
  }));
}

describe('tương phản chữ ở chủ đề tối ≥ 4,5:1', () => {
  it('bốn cặp chữ/nền đều đạt, và cả bốn con số in ra', () => {
    const measured = measurePairs(DARK_PALETTE);

    console.log(
      `[T6] tương phản chủ đề TỐI — ${measured
        .map((one) => `${one.pair} ${ratioText(one.ratio)}`)
        .join(' · ')}`,
    );

    for (const one of measured) {
      expect(one.ratio).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    }
  });

  it('chủ đề sáng vẫn đạt ngưỡng của chính nó — bộ token tối không đụng vào nó', () => {
    const measured = measurePairs(LIGHT_PALETTE);

    console.log(
      `[T6] tương phản chủ đề SÁNG — ${measured
        .map((one) => `${one.pair} ${ratioText(one.ratio)}`)
        .join(' · ')}`,
    );

    for (const one of measured) {
      expect(one.ratio).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* v. Số phím tắt hiển thị so với số mục đã đăng ký.                            */
/* -------------------------------------------------------------------------- */

const noop = (): void => undefined;

describe('số phím tắt hiển thị bằng số mục trong registry (I-01)', () => {
  it('đếm hàng vẽ ra trong khối phím tắt của cả màn, không trong một khối rời', () => {
    const { container } = render(<AccountSettings vm={vmFor(scenarioOf('success'))} />);

    const block = container.querySelector('section[aria-labelledby="account-shortcuts"]');

    if (block === null) {
      throw new Error('không tìm thấy khối phím tắt trên màn');
    }

    const shown = block.querySelectorAll('tbody tr').length;
    const registered = buildGlobalShortcuts({
      undo: noop,
      redo: noop,
      save: noop,
      openSearch: noop,
      openShortcutHelp: noop,
      closeTopLayer: noop,
    }).length;

    console.log(
      `[T6] phím tắt hiển thị = ${String(shown)} · mục trong registry = ${String(registered)}`,
    );

    expect(shown).toBe(registered);
    expect(registered).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* vi. Đổi chủ đề năm lần liên tiếp.                                           */
/* -------------------------------------------------------------------------- */

/** Mã màu thô ở bất cứ dạng nào — đúng thứ [CẤM TUYỆT ĐỐI] không cho nháy ra. */
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;

describe('đổi chủ đề năm lần liên tiếp — không nháy màu thô', () => {
  it('hai bộ token khai đủ cùng một tập khoá, nên không khoá nào rơi về màu dự phòng', () => {
    const dark = Object.keys(DARK_PALETTE).sort();
    const light = Object.keys(LIGHT_PALETTE).sort();

    console.log(
      `[T6] token chủ đề tối = ${String(dark.length)} · chủ đề sáng = ${String(light.length)}`,
    );

    // Bộ tối chỉ khai LẠI những khoá nó đổi; phần còn lại — màu vật liệu cảnh
    // 3D, màu loại tường, `--black`/`--white` — cố ý dùng chung cho hai chủ đề.
    // Cái làm nháy màu là một khoá CHỈ có ở bộ tối, vì lúc ấy chủ đề sáng không
    // có gì để rơi về. Không có khoá nào như thế.
    expect(dark.filter((token) => !light.includes(token))).toEqual([]);
    expect(dark.length).toBeGreaterThan(0);
  });

  it('`html.dark` đứng TRƯỚC `:root`, thứ mà parsePalette phụ thuộc vào', () => {
    expect(GLOBALS_CSS.indexOf('html.dark {')).toBeLessThan(ROOT_BLOCK_AT);
    expect(parsePalette(GLOBALS_CSS)).toEqual(LIGHT_PALETTE);
  });

  it('năm lượt đổi không đổi một byte nào của cây render, và không sinh mã màu thô', () => {
    const { container } = render(<AccountSettings vm={vmFor(scenarioOf('success'))} />);
    const before = container.innerHTML;
    const observed: string[] = [];

    for (let round = 0; round < 5; round += 1) {
      act(() => {
        document.documentElement.classList.toggle('dark');
      });

      const isDark = document.documentElement.classList.contains('dark');
      const drifted = container.innerHTML !== before;
      const raw = [...container.querySelectorAll<HTMLElement>('[style]')]
        .map((element) => element.getAttribute('style') ?? '')
        .filter((style) => RAW_COLOR.test(style));

      observed.push(
        `#${String(round + 1)} ${isDark ? 'tối' : 'sáng'}` +
          `${drifted ? ' CÂY ĐỔI' : ''}${raw.length > 0 ? ` MÀU THÔ×${String(raw.length)}` : ''}`,
      );

      expect(drifted).toBe(false);
      expect(raw).toEqual([]);
    }

    console.log(`[T6] đổi chủ đề ×5 — ${observed.join(' · ')}`);

    document.documentElement.classList.remove('dark');
  });
});
