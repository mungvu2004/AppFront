/**
 * `NotificationCenter` trong bảy trạng thái của bất biến A11.
 *
 * Viết song song với view và hook — cả hai chưa tồn tại lúc file này được viết
 * (xem `notificationModel.ts`, hợp đồng đông cứng của màn). Vì vậy file này giả
 * định hình dạng của `NotificationCenterProps` và `useNotificationCenter`, theo
 * đúng khuôn `EditorTour.stories.tsx`:
 *
 * - Component `NotificationCenter` nhận một props object, xuất từ `./NotificationCenter`.
 * - Props type + hook `useNotificationCenter` xuất từ `./useNotificationCenter`
 *   (hook tính props, view chỉ vẽ — giống `EditorTourProps` xuất từ `useEditorTour.ts`).
 *
 * Nếu tên trường lệch một chút khi lớp ghép chạy thật, người ghép sửa ở đây —
 * đây là hợp đồng đoán trước, không phải bản đã chốt.
 *
 * Mọi story dựng thẳng `NotificationCenter` (view thuần) — không dựng hook,
 * không gateway, không localStorage. `NotificationCenter.test.tsx` viết bộ dữ
 * liệu của riêng nó, không nhập lại từ đây.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { ROUTES } from '@/routes/paths';

import { NotificationCenter } from './NotificationCenter';
import type { NotificationCenterProps } from './useNotificationCenter';
import {
  UNREAD_BADGE_CAP,
  type NotificationDayGroup,
  type NotificationInlineAction,
  type NotificationItemVm,
  type NotificationKind,
} from './notificationModel';

const meta = {
  title: 'Screens/System/NotificationCenter',
  component: NotificationCenter,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof NotificationCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu — hai dự án có dấu, bốn loại thông báo (NOTIFICATION_KINDS).     */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'p-nha-pho-nguyen-trai';
const PROJECT_NAME = 'Nhà phố Nguyễn Trãi';
const FLOOR_ID = 'f-tang-2';

const INVITE_PROJECT_ID = 'p-chung-cu-botanica';
const INVITE_PROJECT_NAME = 'Chung cư Botanica';

function formatUnreadBadge(count: number): string {
  return count > UNREAD_BADGE_CAP ? `${String(UNREAD_BADGE_CAP)}+` : String(count);
}

interface ItemInput {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly sentence: string;
  readonly isRead: boolean;
  readonly relativeTime: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly floorId?: string | undefined;
  readonly targetTo: string;
  readonly targetLabel: string;
  readonly excerpt?: string | undefined;
  readonly inlineAction?: NotificationInlineAction | undefined;
}

function item(input: ItemInput): NotificationItemVm {
  return {
    id: input.id,
    kind: input.kind,
    sentence: input.sentence,
    target: {
      projectId: input.projectId,
      projectName: input.projectName,
      floorId: input.floorId,
      label: input.targetLabel,
      to: input.targetTo,
    },
    createdAt: new Date('2026-09-09T08:00:00+07:00').getTime(),
    relativeTime: input.relativeTime,
    isRead: input.isRead,
    excerpt: input.excerpt,
    inlineAction: input.inlineAction,
  };
}

function group(key: string, heading: string, items: readonly NotificationItemVm[]): NotificationDayGroup {
  return { key, heading, items };
}

const TODAY_ITEMS: readonly NotificationItemVm[] = [
  item({
    id: 'n-1',
    kind: 'aiCompleted',
    sentence: `${PROJECT_NAME}: AI đã dò xong lớp tường, tầng 2.`,
    isRead: false,
    relativeTime: '5 phút trước',
    projectId: PROJECT_ID,
    projectName: PROJECT_NAME,
    floorId: FLOOR_ID,
    targetTo: ROUTES.project.walls(PROJECT_ID, FLOOR_ID),
    targetLabel: 'xem kết quả',
  }),
  item({
    id: 'n-2',
    kind: 'violationFound',
    sentence: `${PROJECT_NAME}: phát hiện 3 tường mỏng hơn tiêu chuẩn, tầng 2.`,
    isRead: false,
    relativeTime: '20 phút trước',
    projectId: PROJECT_ID,
    projectName: PROJECT_NAME,
    floorId: FLOOR_ID,
    targetTo: ROUTES.project.thickness(PROJECT_ID, FLOOR_ID),
    targetLabel: 'xem vi phạm',
  }),
];

const YESTERDAY_ITEMS: readonly NotificationItemVm[] = [
  item({
    id: 'n-3',
    kind: 'projectInvite',
    sentence: `Bạn được mời tham gia dự án ${INVITE_PROJECT_NAME}.`,
    isRead: true,
    relativeTime: 'hôm qua',
    projectId: INVITE_PROJECT_ID,
    projectName: INVITE_PROJECT_NAME,
    targetTo: ROUTES.project.settings(INVITE_PROJECT_ID),
    targetLabel: 'xem lời mời',
    inlineAction: { label: 'chấp nhận', kind: 'accept' },
  }),
  item({
    id: 'n-4',
    kind: 'commentMention',
    sentence: `${PROJECT_NAME}: có người nhắc đến bạn trong bình luận, tầng 2.`,
    isRead: true,
    relativeTime: 'hôm qua',
    projectId: PROJECT_ID,
    projectName: PROJECT_NAME,
    floorId: FLOOR_ID,
    targetTo: ROUTES.project.rooms(PROJECT_ID, FLOOR_ID),
    targetLabel: 'xem bình luận',
    excerpt: 'Kiểm tra lại tường ngăn phòng ngủ chính giúp mình, hình như đang lệch trục.',
  }),
];

const ALL_GROUPS: readonly NotificationDayGroup[] = [
  group('today', 'Hôm nay', TODAY_ITEMS),
  group('yesterday', 'Hôm qua', YESTERDAY_ITEMS),
];

const UNREAD_COUNT = ALL_GROUPS.flatMap((entry) => entry.items).filter((entry) => !entry.isRead).length;

/** Mọi trường không đổi giữa bảy trạng thái, một chỗ (khuôn `EditorTour.stories.tsx`). */
const BASE: NotificationCenterProps = {
  screenState: 'partial',
  isOpen: true,
  groups: ALL_GROUPS,
  filter: 'all',
  unreadCount: UNREAD_COUNT,
  unreadBadge: formatUnreadBadge(UNREAD_COUNT),
  isCollapsed: false,
  liveMessage: `có ${String(UNREAD_COUNT)} thông báo chưa đọc`,
  errorMessage: '',
  onToggle: noop,
  onClose: noop,
  onFilterChange: noop,
  onItemClick: noop,
  onMarkAllRead: noop,
  onRetry: noop,
  onInlineAction: noop,
  onMarkRead: noop,
  onViewAll: noop,
  onOpenSettings: noop,
  arrivedIds: [],
  bellNudgeToken: 0,
  scrollRef: noop,
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái.                                                             */
/* -------------------------------------------------------------------------- */

/** 1 — rỗng: chưa có thông báo nào. */
export const Empty: Story = {
  args: {
    ...BASE,
    screenState: 'empty',
    groups: [],
    unreadCount: 0,
    unreadBadge: '',
    liveMessage: 'không có thông báo nào',
  },
};

/** 2 — đang tải: chưa lấy xong danh sách. */
export const Loading: Story = {
  args: { ...BASE, screenState: 'loading', groups: [], unreadCount: 0, unreadBadge: '' },
};

/** 3 — một phần: mới thấy nhóm "Hôm nay", nhóm cũ hơn chưa nạp xong. */
export const Partial: Story = {
  args: {
    ...BASE,
    screenState: 'partial',
    groups: [group('today', 'Hôm nay', TODAY_ITEMS)],
    unreadCount: TODAY_ITEMS.filter((entry) => !entry.isRead).length,
    unreadBadge: formatUnreadBadge(TODAY_ITEMS.filter((entry) => !entry.isRead).length),
  },
};

/** 4 — lỗi: không lấy được danh sách, còn nút thử lại. */
export const ErrorState: Story = {
  args: {
    ...BASE,
    screenState: 'error',
    groups: [],
    unreadCount: 0,
    unreadBadge: '',
    errorMessage: 'Không tải được thông báo. Kiểm tra kết nối rồi thử lại.',
  },
};

/** 5 — thành công: đủ hai nhóm ngày, đủ bốn loại thông báo. */
export const Success: Story = { args: BASE };

/** 6 — không có quyền: vai người xem, không có thao tác "chấp nhận" lời mời. */
export const Forbidden: Story = {
  args: {
    ...BASE,
    screenState: 'forbidden',
    groups: [
      group('today', 'Hôm nay', TODAY_ITEMS),
      group(
        'yesterday',
        'Hôm qua',
        YESTERDAY_ITEMS.map((entry) => ({ ...entry, inlineAction: undefined })),
      ),
    ],
    liveMessage: 'vai người xem không thao tác được lời mời',
  },
};

/** 7 — thu gọn: ít khoảng trống hơn, cùng dữ liệu với trạng thái thành công. */
export const Collapsed: Story = { args: { ...BASE, screenState: 'collapsed', isCollapsed: true } };
