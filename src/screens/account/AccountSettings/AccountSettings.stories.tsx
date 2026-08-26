/**
 * Màn `/tai-khoan` trong bảy trạng thái của bất biến A11, cộng hai biến thể.
 *
 * Mọi story dựng {@link AccountSettings} — view thuần — chứ không dựng
 * `AccountSettingsContainer`: không cổng, không đồng hồ, không mạng, không
 * `Toast.Provider`. Đó là toàn bộ lý do mục D chia màn làm hai.
 *
 * Bảng chia bảy trạng thái cho bốn người dựng nằm ở `useAccountSettings.ts`;
 * ở đây mỗi trạng thái là một `args` đọc được bằng mắt. `AccountSettings.test.tsx`
 * cố ý KHÔNG nhập lại file này: bộ kiểm dẫn xuất bảy `vm` của nó từ
 * `createSevenStateScenarios()`, nên nếu bộ kịch bản chung đổi hình thì bộ kiểm
 * đỏ — còn story thì minh hoạ, và minh hoạ được phép viết tay.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { AccountSettings } from './AccountSettings';
import type { AccountSessionRow } from './SessionsSection';
import type { NotificationEventModel } from './NotificationsSection';
import { DENSITY_ROW_CLASS, LANGUAGE_OPTIONS } from './useAccountPreferences';
import { NOTIFICATION_CHANNELS, buildShortcutRows } from './useAccountTables';
import type { AccountSettingsViewModel } from './useAccountSettings';

const meta = {
  title: 'Screens/Account/AccountSettings',
  component: AccountSettings,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof AccountSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

const EMAIL = 'thu.ha@congty.vn';

const SESSIONS: readonly AccountSessionRow[] = [
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

/** Năm sự việc của ma trận, dựng từ hai kênh mà `useAccountTables` khai. */
const EVENTS: readonly NotificationEventModel[] = [
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

/** Trạng thái 5 — thành công. Sáu story còn lại là bản này sửa một chỗ. */
const base: AccountSettingsViewModel = {
  isLoading: false,
  errorMessage: null,
  retryLoad: noop,
  saveState: 'saved',
  saveLabel: 'Đã lưu lúc 09:12',
  preferences: {
    profile: {
      avatarUrl: null,
      avatarInitials: 'NH',
      avatarAlt: 'Ảnh đại diện của Nguyễn Thu Hà',
      isAvatarUploading: false,
      avatarStatusLabel: 'Đang tải ảnh lên…',
      onAvatarFileSelected: noop,
      fullName: 'Nguyễn Thu Hà',
      onFullNameChange: noop,
      jobTitle: 'Kỹ sư kết cấu',
      onJobTitleChange: noop,
      jobTitlePlaceholder: 'chưa đặt',
      email: EMAIL,
      emailReadOnlyReason: 'Thư điện tử là tên đăng nhập nên chỉ đọc ở đây.',
      onChangeEmail: noop,
      phone: '0912 345 678',
      onPhoneChange: noop,
      language: 'vi',
      languageOptions: LANGUAGE_OPTIONS,
      onLanguageChange: noop,
      flashedField: null,
      rowClassName: DENSITY_ROW_CLASS.comfortable,
      motionOff: false,
    },
    appearance: {
      theme: 'light',
      onThemeChange: noop,
      viewportDark: false,
      onViewportDarkChange: noop,
      reducedMotion: false,
      onReducedMotionChange: noop,
      showGrid: true,
      onShowGridChange: noop,
      density: 'comfortable',
      onDensityChange: noop,
      flashedField: null,
      rowClassName: DENSITY_ROW_CLASS.comfortable,
      motionOff: false,
    },
  },
  tables: {
    notifications: {
      channels: NOTIFICATION_CHANNELS,
      events: EVENTS,
      isCollapsed: false,
      onChange: noop,
    },
    shortcuts: {
      query: '',
      onQueryChange: noop,
      // Danh sách dẫn xuất từ I-01, không viết tay — kể cả trong một story.
      rows: buildShortcutRows(),
      countLabel: 'Đang hiện đủ số phím tắt đang có hiệu lực.',
      emptyMessage: 'Không có phím tắt nào khớp với ô tìm.',
      rowMotion: { layout: 'position', transition: { duration: 0 } },
    },
  },
  auth: {
    password: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      onCurrentPasswordChange: noop,
      onNewPasswordChange: noop,
      onConfirmPasswordChange: noop,
      currentPasswordProblem: null,
      newPasswordProblem: null,
      confirmPasswordProblem: null,
      strength: null,
      canSubmit: false,
      isSubmitting: false,
      onSubmit: noop,
      successMessage: null,
      isManagedExternally: false,
    },
    sessions: {
      rows: SESSIONS,
      warning: null,
      onRetry: noop,
      onSignOut: noop,
      signingOutId: null,
      reducedMotion: false,
    },
    danger: {
      email: EMAIL,
      isDialogOpen: false,
      onRequestDelete: noop,
      onCancelDelete: noop,
      onConfirmDelete: noop,
      confirmValue: '',
      onConfirmValueChange: noop,
      canConfirm: false,
      isDeleting: false,
      errorMessage: null,
    },
  },
};

/** `base` với một khối sửa lại, không phải một `vm` chép lại lần nữa. */
function withProfile(patch: Partial<AccountSettingsViewModel['preferences']['profile']>) {
  return {
    ...base,
    preferences: {
      ...base.preferences,
      profile: { ...base.preferences.profile, ...patch },
    },
  };
}

function withAuth(patch: Partial<AccountSettingsViewModel['auth']>) {
  return { ...base, auth: { ...base.auth, ...patch } };
}

/** 1 · rỗng — tài khoản mới: chưa ảnh đại diện, chưa chức danh, chưa số máy. */
export const Empty: Story = {
  args: {
    vm: {
      ...withProfile({ avatarUrl: null, jobTitle: '', phone: '' }),
      auth: { ...base.auth, sessions: { ...base.auth.sessions, rows: [] } },
    },
  },
};

/** 2 · đang tải — của cả trang: bảy thẻ thành khung xương một nhịp, không bảy nhịp. */
export const Loading: Story = {
  args: { vm: { ...base, isLoading: true, saveState: 'idle', saveLabel: null } },
};

/**
 * 3 · một phần — hai khối cùng nói dở dang, và cả hai nói tại chỗ của mình.
 *
 * Ảnh đại diện đang tải lên (T4) và lượt đọc phiên hỏng (T3). Dải cảnh báo nằm
 * **trong** khối phiên, không bao giờ trên đầu trang: sáu khối kia vẫn đúng.
 */
export const Partial: Story = {
  args: {
    vm: {
      ...withProfile({ isAvatarUploading: true, flashedField: 'fullName' }),
      saveState: 'saving',
      saveLabel: 'Đang lưu…',
      auth: {
        ...base.auth,
        sessions: {
          ...base.auth.sessions,
          rows: SESSIONS.slice(0, 1),
          warning: 'Không đọc được danh sách phiên đang mở. Thử lại sau ít phút.',
        },
      },
    },
  },
};

/** 4 · lỗi — mật khẩu cũ sai, và lỗi buộc vào đúng cái ô đã gây ra nó. */
export const ErrorState: Story = {
  args: {
    vm: withAuth({
      password: {
        ...base.auth.password,
        currentPassword: '••••••••',
        currentPasswordProblem: 'Mật khẩu hiện tại không đúng.',
      },
    }),
  },
};

/** 5 · thành công — sáu khối có dữ liệu, vùng nguy hiểm đóng. */
export const Success: Story = {
  args: { vm: base },
};

/** 6 · không có quyền — tài khoản do công ty quản lý: khối mật khẩu chỉ đọc. */
export const Forbidden: Story = {
  args: {
    vm: withAuth({
      password: { ...base.auth.password, isManagedExternally: true },
    }),
  },
};

/** 7 · thu gọn — màn hẹp: ma trận thành danh sách sự việc, mỗi mục hai công tắc. */
export const Collapsed: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  args: {
    vm: {
      ...base,
      tables: {
        ...base.tables,
        notifications: { ...base.tables.notifications, isCollapsed: true },
      },
    },
  },
};

/**
 * Giảm chuyển động — cùng màn ấy với mọi hoạt cảnh của nó đã tắt.
 *
 * `motionOff` không phải một cách vẽ, nó là một *quyết định*, nên nó đi qua
 * props: story này và bộ kiểm nhìn thấy đúng một thứ.
 */
export const ReducedMotion: Story = {
  args: {
    vm: {
      ...base,
      preferences: {
        profile: { ...base.preferences.profile, motionOff: true },
        appearance: {
          ...base.preferences.appearance,
          motionOff: true,
          reducedMotion: true,
        },
      },
      tables: {
        ...base.tables,
        shortcuts: {
          ...base.tables.shortcuts,
          rowMotion: { layout: false, transition: { duration: 0 } },
        },
      },
      auth: {
        ...base.auth,
        sessions: { ...base.auth.sessions, reducedMotion: true },
      },
    },
  },
};

/**
 * Chủ đề tối — cùng bộ token, không một bộ lọc làm tối nào.
 *
 * Storybook đặt `html.dark` qua tham số nền; màn không tự tô lại thứ gì, vì
 * mọi màu của nó là token và bộ token tối đã khai ở `src/styles/globals.css`.
 */
export const DarkTheme: Story = {
  parameters: { themes: { themeOverride: 'dark' }, backgrounds: { default: 'dark' } },
  args: {
    vm: {
      ...base,
      preferences: {
        ...base.preferences,
        appearance: { ...base.preferences.appearance, theme: 'dark' },
      },
    },
  },
};

/** Lỗi ĐỌC cấp trang — một dải cảnh báo thay chỗ cả bảy khối (A11, của T2). */
export const LoadFailed: Story = {
  args: {
    vm: {
      ...base,
      errorMessage: 'Không kết nối được máy chủ. Cài đặt tài khoản chưa đọc được.',
      saveState: 'error',
      saveLabel: 'Lưu thất bại',
    },
  },
};
