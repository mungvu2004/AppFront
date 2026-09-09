/**
 * `CollaborationLayer` trong bảy trạng thái của bất biến A11.
 *
 * View THUẦN — mỗi story tiêm `CollaborationLayerProps` trực tiếp (xem `./types.ts`),
 * không nối gateway, không kênh thời gian thực, không store. File này được viết
 * TRƯỚC KHI `CollaborationLayer.tsx` tồn tại (bốn nhánh dựng song song, xem
 * `types.ts:1-32`): dữ liệu đối chiếu với hợp đồng kiểu, không đối chiếu bản dựng.
 *
 * Bảy story, đúng bảy trạng thái, không hơn:
 * Rỗng · Đang tải · Một phần · Lỗi · Xong · Không có quyền · Thu gọn.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { CollaborationLayer } from './CollaborationLayer';
import type {
  CollaborationLayerProps,
  CollaboratorVm,
  CommentPinVm,
  ConflictVm,
  LockVm,
} from './types';

const meta = {
  title: 'Screens/System/CollaborationLayer',
  component: CollaborationLayer,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof CollaborationLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu — hai cộng tác viên khác, một khoá, hai ghim, một xung đột.      */
/* -------------------------------------------------------------------------- */

const SELF: CollaboratorVm = {
  id: 'u-self',
  name: 'Bạn',
  initials: 'B',
  floorLabel: 'đang ở tầng 1',
  selectionLabel: null,
  cursor: null,
  isSelf: true,
};

const MAI: CollaboratorVm = {
  id: 'u-mai',
  name: 'Trần Thị Mai',
  initials: 'TM',
  floorLabel: 'đang ở tầng 2',
  selectionLabel: 'đang chọn tường W-014',
  cursor: { x: 420, y: 260 },
  isSelf: false,
};

const DUC: CollaboratorVm = {
  id: 'u-duc',
  name: 'Nguyễn Văn Đức',
  initials: 'ND',
  floorLabel: 'đang ở tầng 1',
  selectionLabel: null,
  cursor: { x: 180, y: 340 },
  isSelf: false,
};

const LOCK_DOOR: LockVm = {
  objectId: 'D-004',
  holderName: 'Trần Thị Mai',
  heldSinceLabel: 'giữ từ 3 phút trước',
};

const COMMENT_OPEN: CommentPinVm = {
  id: 'c-1',
  objectId: 'W-014',
  at: { x: 420, y: 260 },
  isResolved: false,
  replyCount: 2,
};

const COMMENT_DONE: CommentPinVm = {
  id: 'c-2',
  objectId: 'R-003',
  at: { x: 640, y: 180 },
  isResolved: true,
  replyCount: 0,
};

const CONFLICT: ConflictVm = {
  entityId: 'W-014',
  entityType: 'wall',
  fieldLabel: 'độ dày',
  mine: { valueLabel: '110 mm', authorName: 'Bạn', atLabel: 'vừa xong' },
  theirs: { valueLabel: '220 mm', authorName: 'Trần Thị Mai', atLabel: '2 phút trước' },
};

/** Mọi trường không đổi giữa các story, một chỗ (khuôn `EditorTour.stories.tsx`). */
const BASE: CollaborationLayerProps = {
  capabilities: { presence: true, comments: true, locks: true, requestAccess: true },
  syncState: 'da-noi',
  collaborators: [SELF, MAI, DUC],
  locks: [LOCK_DOOR],
  conflict: null,
  comments: [COMMENT_OPEN, COMMENT_DONE],
  isCollapsed: false,
  canWrite: true,
  onGoToCollaborator: noop,
  onRequestEditAccess: noop,
  onResolveConflict: noop,
  onDeferConflict: noop,
  onFrameComment: noop,
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái.                                                             */
/* -------------------------------------------------------------------------- */

/** 1 — rỗng: chỉ mình bạn đang xem, không khoá, không bình luận đang mở. */
export const Empty: Story = {
  args: {
    ...BASE,
    syncState: 'da-noi',
    collaborators: [SELF],
    locks: [],
    comments: [],
  },
};

/** 2 — đang tải: chưa nạp xong danh sách người xem. */
export const Loading: Story = {
  args: {
    ...BASE,
    syncState: 'dang-noi',
    collaborators: [SELF],
    locks: [],
    comments: [],
  },
};

/** 3 — một phần: đồng bộ chậm, có một xung đột đang chờ quyết định. */
export const Partial: Story = {
  args: {
    ...BASE,
    syncState: 'dong-bo-cham',
    collaborators: [SELF, MAI],
    comments: [COMMENT_OPEN],
    conflict: CONFLICT,
  },
};

/** 4 — lỗi: mất kết nối máy chủ, vẫn sửa được tại chỗ (`lam-viec-rieng` không áp dụng ở đây). */
export const ErrorState: Story = {
  args: {
    ...BASE,
    syncState: 'mat-ket-noi',
    collaborators: [SELF],
  },
};

/** 5 — thành công: đủ cộng tác viên, khoá, bình luận, không xung đột. */
export const Success: Story = { args: BASE };

/** 6 — không có quyền: vai người xem, xem được bình luận nhưng không viết. */
export const Forbidden: Story = {
  args: {
    ...BASE,
    canWrite: false,
  },
};

/** 7 — thu gọn: con trỏ người khác ẩn, ghim bình luận còn lại. */
export const Collapsed: Story = {
  args: {
    ...BASE,
    isCollapsed: true,
  },
};
