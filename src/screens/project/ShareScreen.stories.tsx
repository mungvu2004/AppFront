import type { Meta, StoryObj } from '@storybook/react';

import { MIN_SHARE_PASSWORD_LENGTH } from '@/lib/export/shareLink';

import { ShareScreenView, type ShareScreenViewProps } from './ShareScreen';

/**
 * The share screen in each of invariant A11's seven states.
 *
 * Every story renders {@link ShareScreenView} rather than `ShareScreen`, so
 * nothing here needs a gateway, a clock or a network — the view is a function
 * of its props, which is the whole point of invariant D's split.
 */
const meta = {
  title: 'Screens/Project/ShareScreen',
  component: ShareScreenView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ShareScreenView>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

const PROJECT_NAME = 'Chung cư Hoàng Anh';
const SHARE_URL = 'https://app.example.com/s/8f2c1d?level=L-02&color=area';

/** Four characters, so the complaint under the field is one the real form makes. */
const SHORT_PASSPHRASE = 'mo-c';

/**
 * What {@link validateShareLinkRequest} says about {@link SHORT_PASSPHRASE},
 * built from the same constant rather than copied, so the story cannot drift
 * away from the rule it is illustrating.
 */
const SHORT_PASSPHRASE_PROBLEM = `mật khẩu cần ít nhất ${MIN_SHARE_PASSWORD_LENGTH} ký tự`;

const base: ShareScreenViewProps = {
  projectName: PROJECT_NAME,
  state: 'success',
  canCreate: true,
  isCollapsed: false,
  isLoading: false,
  isCreating: false,
  isRevoking: false,
  rows: [],
  form: {
    permission: 'view',
    expiryChoice: '7d',
    passwordEnabled: false,
    password: '',
    includeViewpoint: true,
    toolbar: true,
  },
  formProblems: {},
  canSubmit: true,
  errorMessage: null,
  unreadableNotice: null,
  revoking: null,
  copiedId: null,
  viewpointAvailable: true,
  setPermission: noop,
  setExpiryChoice: noop,
  setPasswordEnabled: noop,
  setPassword: noop,
  setIncludeViewpoint: noop,
  setToolbar: noop,
  setCollapsed: noop,
  create: noop,
  reload: noop,
  copyUrl: noop,
  copyEmbedCode: noop,
  askRevoke: noop,
  cancelRevoke: noop,
  confirmRevoke: noop,
};

const activeRow: ShareScreenViewProps['rows'][number] = {
  id: 'shr-001',
  url: SHARE_URL,
  embedCode: `<iframe src="${SHARE_URL}" title="Bản vẽ mặt bằng"></iframe>`,
  permissionLabel: 'chỉ xem',
  statusLabel: 'đang dùng được',
  tone: 'verified',
  expiryText: 'còn 6 ngày',
  passwordProtected: true,
  title: 'Gửi tư vấn giám sát',
  canRevoke: true,
};

const commentRow: ShareScreenViewProps['rows'][number] = {
  id: 'shr-002',
  url: 'https://app.example.com/s/a10f77',
  embedCode: '<iframe src="https://app.example.com/s/a10f77"></iframe>',
  permissionLabel: 'góp ý',
  statusLabel: 'đang dùng được',
  tone: 'verified',
  expiryText: 'còn 22 giờ',
  passwordProtected: false,
  title: 'Chủ đầu tư xem tầng 2',
  canRevoke: true,
};

const expiredRow: ShareScreenViewProps['rows'][number] = {
  id: 'shr-003',
  url: 'https://app.example.com/s/61b2ac',
  embedCode: '<iframe src="https://app.example.com/s/61b2ac"></iframe>',
  permissionLabel: 'chỉ xem',
  statusLabel: 'đã hết hạn',
  tone: 'neutral',
  expiryText: 'đã hết hạn',
  passwordProtected: false,
  title: 'Bản gửi thầu phụ',
  canRevoke: false,
};

/** rỗng — dự án chưa từng được chia sẻ. */
export const Empty: Story = {
  args: { ...base, state: 'empty', rows: [] },
};

/** đang tải — danh sách chưa về. */
export const Loading: Story = {
  args: { ...base, state: 'loading', isLoading: true },
};

/**
 * một phần — máy chủ gửi năm dòng, đọc được ba.
 *
 * The notice is the state's whole reason for existing: a list that dropped rows
 * and said nothing looks complete and is not.
 */
export const Partial: Story = {
  args: {
    ...base,
    state: 'partial',
    rows: [activeRow, commentRow, expiredRow],
    unreadableNotice:
      '2 trong 5 liên kết không đọc được và không hiện ở đây; hãy tải lại hoặc báo quản trị trước khi kết luận dự án đã sạch.',
  },
};

/** lỗi — không tải được danh sách, kèm nút thử lại. */
export const ErrorState: Story = {
  args: {
    ...base,
    state: 'error',
    errorMessage: 'không kết nối được máy chủ; liên kết chia sẻ chưa thay đổi',
  },
};

/** thành công — ba liên kết, hai còn sống. */
export const Success: Story = {
  args: { ...base, state: 'success', rows: [activeRow, commentRow, expiredRow] },
};

/** không có quyền — vai trò chỉ xem: mất form, giữ danh sách. */
export const Forbidden: Story = {
  args: {
    ...base,
    state: 'forbidden',
    canCreate: false,
    rows: [
      { ...activeRow, canRevoke: false },
      { ...commentRow, canRevoke: false },
    ],
  },
};

/** thu gọn — cả phần chia sẻ gập lại thành một dòng. */
export const Collapsed: Story = {
  args: { ...base, state: 'collapsed', isCollapsed: true, rows: [activeRow] },
};

/**
 * Hộp thoại xác nhận thu hồi.
 *
 * Not an eighth state — the same `success` screen with a dialog over it — but
 * worth its own story because it is the one action invariant A8's undo cannot
 * cover, and the wording is the compensating control.
 */
export const RevokeConfirm: Story = {
  args: { ...base, state: 'success', rows: [activeRow, commentRow], revoking: activeRow },
};

/** Mật khẩu bật, và lời nhắc rằng nó không nằm trong đường dẫn. */
export const WithPassword: Story = {
  args: {
    ...base,
    state: 'empty',
    form: { ...base.form, passwordEnabled: true, password: SHORT_PASSPHRASE },
    formProblems: { password: SHORT_PASSPHRASE_PROBLEM },
    canSubmit: false,
  },
};

/** Chưa mở bản vẽ nên không có góc nhìn nào để gắn kèm. */
export const WithoutViewpoint: Story = {
  args: { ...base, state: 'empty', viewpointAvailable: false },
};
