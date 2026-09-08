/**
 * Bảy kịch bản của {@link UserManagementViewModel} (A11 / R-63), dữ liệu THUẦN — không React,
 * không cổng, không mạng. `UserManagement.test.tsx` và `UserManagement.stories.tsx` nhập
 * CHUNG file này (R-70): một nguồn dữ liệu, không hai bản có thể trôi khỏi nhau.
 *
 * ## Vì sao file này không nhập `src/lib/testing/fakeClock`
 *
 * `fakeClock.ts` nhập `vi` từ `'vitest'`. `UserManagement.stories.tsx` cũng nhập file này, và
 * Storybook không đóng gói được `vitest` — nhập gián tiếp sẽ vỡ bản dựng Storybook. Mốc
 * `NOW` dưới đây vì thế là một literal độc lập, cùng giá trị với `FAKE_CLOCK_START`
 * (`2026-08-17T14:32:00+07:00`, "14:32" mẫu autosave của sản phẩm) chứ không nhập lại nó.
 *
 * ## Đ-1 — BA vai, không phải bốn
 *
 * `ROLE_OPTIONS` dựng từ `AUTH_ROLES` thật (`src/lib/auth/permissions.ts`), không gõ tay.
 * Ma trận quyền dưới đây có đúng BA cột theo quyết định đã chốt (`contract-decisions.md`
 * mục Đ-1) — đếm "đúng 4" là tiêu chí trượt có chủ ý.
 *
 * ## Đ-2 — bảy dòng ma trận, năm dòng đọc `permissionMatrix` thật, hai dòng đang chờ T0
 *
 * `qc.approve` và `ruleset.edit` là hai khoá T0 đang thêm vào `src/lib/auth/permissions.ts`
 * (xem `t0-logic-users.md` mục 2.1, waiver R-68 riêng của T0) — CHƯA có trên nhánh này tại
 * thời điểm file này được viết. `QC_APPROVE_POLICY`/`RULESET_EDIT_POLICY` dưới đây chép
 * NGUYÊN VĂN chính sách ĐÃ CHỐT trong đặc tả đó (không tự bịa — R-70). Khi T0 gộp, hai dòng
 * này đổi sang đọc thẳng `permissionMatrix['qc.approve']`/`['ruleset.edit']` như năm dòng còn
 * lại — đúng một chỗ đổi, không rải rác.
 *
 * ## Đ-8 — hành động bị chặn mang lý do, không phải cờ `disabled` trần
 *
 * Trong kịch bản `success`, hàng của chính người dùng (`isSelf: true`) mang
 * `roleChangeBlockedReason`, và hàng quản trị còn lại mang `removeBlockedReason` — hai chỗ
 * bị chặn `UserManagement.test.tsx` khẳng định phải tự giải thích bằng câu, không phải một
 * nút xám vô cớ.
 */

import { formatCalendarDate, formatClockTime, formatTimestamp } from '@/lib/format/datetime';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';
import { AUTH_ROLES, permissionMatrix } from '@/lib/auth/permissions';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import {
  FILTER_ALL,
  type BreadcrumbItemModel,
  type InviteFormModel,
  type PermissionMatrixModel,
  type RemoveConfirmModel,
  type RoleOption,
  type StatusOption,
  type SummaryModel,
  type ToolbarModel,
  type UserAccountStatus,
  type UserActivityRowModel,
  type UserDetailModel,
  type UserManagementActions,
  type UserManagementViewModel,
  type UserMembershipRowModel,
  type UserRowModel,
} from './types';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* ==========================================================================
 * 0. Mốc thời gian — literal độc lập, cùng giá trị FAKE_CLOCK_START (xem docblock đầu file).
 * ========================================================================== */

const NOW = new Date('2026-08-17T14:32:00+07:00');
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const TWELVE_MINUTES_AGO = new Date(NOW.getTime() - 12 * MINUTE_MS);
const SAME_DAY_EARLIER = new Date(NOW.getTime() - 5 * HOUR_MS);
const THREE_DAYS_AGO = new Date(NOW.getTime() - 3 * DAY_MS);
const LAST_MONTH = new Date(NOW.getTime() - 28 * DAY_MS);

/** `formatTimestamp` (Đ-3) cho ô bảng, cộng mốc đầy đủ cho tooltip. `null` = chưa từng vào. */
function momentLabels(at: Date | null): { readonly label: string; readonly exactLabel: string } {
  if (at === null) {
    return { label: MISSING_VALUE, exactLabel: MISSING_VALUE };
  }
  return {
    label: formatTimestamp(at, NOW, { timeZone: TIME_ZONE }),
    exactLabel: `${formatCalendarDate(at, { timeZone: TIME_ZONE })} ${formatClockTime(at, { timeZone: TIME_ZONE })}`,
  };
}

function activityMoment(at: Date): { readonly atLabel: string; readonly atExactLabel: string } {
  const moment = momentLabels(at);
  return { atLabel: moment.label, atExactLabel: moment.exactLabel };
}

/* ==========================================================================
 * 1. Nhãn vai/trạng thái — A6 (viết thường, kiểu câu). Nguồn duy nhất cho cả file.
 * ========================================================================== */

const ROLE_LABEL: Readonly<Record<ProjectRole, string>> = {
  admin: 'quản trị',
  engineer: 'kỹ sư',
  viewer: 'người xem',
};

const STATUS_LABEL: Readonly<Record<UserAccountStatus, string>> = {
  active: 'đang hoạt động',
  pending: 'chờ chấp nhận',
  disabled: 'đã vô hiệu hoá',
};

const ROLE_OPTIONS: readonly RoleOption[] = AUTH_ROLES.map((role) => ({ role, label: ROLE_LABEL[role] }));

const STATUS_OPTIONS: readonly StatusOption[] = (['active', 'pending', 'disabled'] as const).map((status) => ({
  status,
  label: STATUS_LABEL[status],
}));

/* ==========================================================================
 * 2. Ma trận quyền — Đ-2. Ba cột × bảy dòng, giống hệt ở mọi kịch bản (kể cả `forbidden`).
 * ========================================================================== */

interface PermissionRowSeed {
  readonly key: string;
  readonly label: string;
  readonly values: Readonly<Record<ProjectRole, boolean>>;
}

/** Chính sách đã chốt cho `qc.approve` (`t0-logic-users.md` mục 2.1) — xem docblock đầu file. */
const QC_APPROVE_POLICY: Readonly<Record<ProjectRole, boolean>> = {
  admin: true,
  engineer: true,
  viewer: false,
};

/** Chính sách đã chốt cho `ruleset.edit` (`t0-logic-users.md` mục 2.1). */
const RULESET_EDIT_POLICY: Readonly<Record<ProjectRole, boolean>> = {
  admin: true,
  engineer: false,
  viewer: false,
};

const PERMISSION_ROW_SEEDS: readonly PermissionRowSeed[] = [
  { key: 'floor.upload', label: 'tải bản vẽ', values: permissionMatrix['floor.upload'] },
  { key: 'layer.edit', label: 'sửa hình học', values: permissionMatrix['layer.edit'] },
  { key: 'qc.approve', label: 'duyệt QC', values: QC_APPROVE_POLICY },
  { key: 'ruleset.edit', label: 'đổi bộ luật', values: RULESET_EDIT_POLICY },
  { key: 'model.export', label: 'xuất', values: permissionMatrix['model.export'] },
  { key: 'share.create', label: 'chia sẻ', values: permissionMatrix['share.create'] },
  { key: 'user.manage', label: 'quản lý người dùng', values: permissionMatrix['user.manage'] },
];

function buildPermissionMatrix(): PermissionMatrixModel {
  return {
    columns: ROLE_OPTIONS,
    rows: PERMISSION_ROW_SEEDS.map((seed) => ({
      key: seed.key,
      label: seed.label,
      cells: AUTH_ROLES.map((role) => {
        const allowed = seed.values[role];

        return {
          role,
          allowed,
          srLabel: `${ROLE_LABEL[role]}: ${allowed ? 'được phép' : 'không được phép'} ${seed.label}`,
        };
      }),
    })),
  };
}

/** Đơn sắc, ba cột bảy dòng, dùng chung mọi kịch bản (Đ-7: `forbidden` vẫn hiện đủ). */
const PERMISSION_MATRIX: PermissionMatrixModel = buildPermissionMatrix();

/* ==========================================================================
 * 3. Câu chữ dùng chung — mỗi câu MỘT nơi định nghĩa, khớp Đ-7/Đ-8.
 * ========================================================================== */

const SELF_ROLE_CHANGE_BLOCKED_REASON = 'Bạn không thể tự hạ vai của chính mình.';
const LAST_ADMIN_REMOVE_BLOCKED_REASON =
  'Đây là quản trị cuối cùng của dự án nên không thể xoá; hãy chỉ định một quản trị khác trước.';
const EMPTY_TEACHING_LABEL =
  'Bạn là người duy nhất trong danh sách. Mời đồng nghiệp tham gia bằng nút mời người dùng ở trên.';
const FORBIDDEN_LABEL =
  'Bạn không có quyền quản lý người dùng của dự án này. Liên hệ quản trị để được cấp quyền; ma trận quyền bên dưới vẫn xem được.';
const FORBIDDEN_INVITE_BLOCKED_REASON = 'Bạn không có quyền mời người dùng mới.';
const ERROR_LABEL = 'Không tải được danh sách người dùng. Kiểm tra kết nối rồi thử lại.';
const INVITE_HINT_LABEL = 'Nhập email, cách nhau bằng dấu phẩy hoặc xuống dòng.';
const REMOVE_WARNING_LABEL = 'Xoá hẳn sẽ gỡ toàn bộ phần ghi công của người này trong lịch sử. Gõ đúng email để xác nhận.';

const SKELETON_ROW_COUNT = 8;

const BREADCRUMB_ITEMS: readonly BreadcrumbItemModel[] = [
  { label: 'quản trị', href: ROUTES.dashboard },
  { label: 'người dùng', href: null },
];

const BACK_LINK: BreadcrumbItemModel = { label: 'quay lại trang chủ', href: ROUTES.dashboard };

/* ==========================================================================
 * 4. Một hàng người dùng — nguyên liệu tối thiểu vào, `UserRowModel` đầy đủ ra.
 * ========================================================================== */

interface RowSeed {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: ProjectRole;
  readonly status: UserAccountStatus;
  readonly projectCount: number;
  readonly lastActiveAt: Date | null;
  readonly isSelf?: boolean;
  readonly inviteExpired?: boolean;
  readonly canResendInvite?: boolean;
  readonly justChanged?: boolean;
  readonly roleChangeBlockedReason?: string | null;
  readonly disableBlockedReason?: string | null;
  readonly removeBlockedReason?: string | null;
}

function toRow(seed: RowSeed): UserRowModel {
  const moment = momentLabels(seed.lastActiveAt);

  return {
    id: seed.id,
    name: seed.name,
    email: seed.email,
    role: seed.role,
    roleLabel: ROLE_LABEL[seed.role],
    status: seed.status,
    statusLabel: STATUS_LABEL[seed.status],
    projectCountLabel: formatNumber(seed.projectCount),
    lastActiveLabel: moment.label,
    lastActiveExactLabel: moment.exactLabel,
    isSelf: seed.isSelf ?? false,
    inviteExpired: seed.inviteExpired ?? false,
    canResendInvite: seed.canResendInvite ?? false,
    justChanged: seed.justChanged ?? false,
    roleChangeBlockedReason: seed.roleChangeBlockedReason ?? null,
    disableBlockedReason: seed.disableBlockedReason ?? null,
    removeBlockedReason: seed.removeBlockedReason ?? null,
  };
}

/* ==========================================================================
 * 5. Bộ người dùng mẫu — tên và dự án tiếng Việt có dấu, cùng tiền lệ
 *    `shareDialogFixtures.ts:275-277` ("Phạm An", "Nguyễn Bình", "Trần Chi").
 * ========================================================================== */

/** Chính người đang đăng nhập — quản trị, dùng lại ở `empty`/`partial`/`success`/`collapsed`. */
const SELF_ROW: UserRowModel = toRow({
  id: 'user-pham-an',
  name: 'Phạm An',
  email: 'an.pham@appfront.vn',
  role: 'admin',
  status: 'active',
  projectCount: 8,
  lastActiveAt: NOW,
  isSelf: true,
  roleChangeBlockedReason: SELF_ROLE_CHANGE_BLOCKED_REASON,
});

const OTHER_ADMIN_ROW: UserRowModel = toRow({
  id: 'user-nguyen-binh',
  name: 'Nguyễn Bình',
  email: 'binh.nguyen@appfront.vn',
  role: 'admin',
  status: 'active',
  projectCount: 5,
  lastActiveAt: TWELVE_MINUTES_AGO,
  removeBlockedReason: LAST_ADMIN_REMOVE_BLOCKED_REASON,
});

const ENGINEER_ROW: UserRowModel = toRow({
  id: 'user-tran-chi',
  name: 'Trần Chi',
  email: 'chi.tran@appfront.vn',
  role: 'engineer',
  status: 'active',
  projectCount: 6,
  lastActiveAt: SAME_DAY_EARLIER,
});

const DISABLED_ENGINEER_ROW: UserRowModel = toRow({
  id: 'user-le-dung',
  name: 'Lê Dung',
  email: 'dung.le@appfront.vn',
  role: 'engineer',
  status: 'disabled',
  projectCount: 3,
  lastActiveAt: THREE_DAYS_AGO,
});

const VIEWER_ROW: UserRowModel = toRow({
  id: 'user-do-hanh',
  name: 'Đỗ Hạnh',
  email: 'hanh.do@appfront.vn',
  role: 'viewer',
  status: 'active',
  projectCount: 2,
  lastActiveAt: LAST_MONTH,
});

const PENDING_ENGINEER_ROW: UserRowModel = toRow({
  id: 'user-vu-khanh',
  name: 'Vũ Khánh',
  email: 'khanh.vu@appfront.vn',
  role: 'engineer',
  status: 'pending',
  projectCount: 0,
  lastActiveAt: null,
  inviteExpired: true,
  canResendInvite: true,
});

const PENDING_VIEWER_ROW: UserRowModel = toRow({
  id: 'user-ngo-lan',
  name: 'Ngô Lan',
  email: 'lan.ngo@appfront.vn',
  role: 'viewer',
  status: 'pending',
  projectCount: 0,
  lastActiveAt: null,
  inviteExpired: false,
  canResendInvite: true,
});

const PENDING_ADMIN_ROW: UserRowModel = toRow({
  id: 'user-dang-minh',
  name: 'Đặng Minh',
  email: 'minh.dang@appfront.vn',
  role: 'admin',
  status: 'pending',
  projectCount: 0,
  lastActiveAt: null,
  inviteExpired: false,
  canResendInvite: true,
});

/** Trạng thái 3 (Đ-7): danh sách + đúng ba lời mời chờ nhận. */
const PARTIAL_ROWS: readonly UserRowModel[] = [SELF_ROW, PENDING_ENGINEER_ROW, PENDING_VIEWER_ROW, PENDING_ADMIN_ROW];

/** Trạng thái 5/7 (Đ-7): đủ ba vai, ít nhất một `disabled`, thời gian rải rác. */
const SUCCESS_ROWS: readonly UserRowModel[] = [
  SELF_ROW,
  OTHER_ADMIN_ROW,
  ENGINEER_ROW,
  DISABLED_ENGINEER_ROW,
  VIEWER_ROW,
];

/* ==========================================================================
 * 6. Panel chi tiết — kịch bản `success` mở chi tiết của `OTHER_ADMIN_ROW`.
 * ========================================================================== */

const OTHER_ADMIN_MEMBERSHIPS: readonly UserMembershipRowModel[] = [
  {
    projectId: 'project-hanoi-tower',
    projectName: 'tháp hà nội',
    role: 'admin',
    roleLabel: ROLE_LABEL.admin,
    roleChangeBlockedReason: null,
  },
  {
    projectId: 'project-da-nang-mall',
    projectName: 'trung tâm thương mại đà nẵng',
    role: 'engineer',
    roleLabel: ROLE_LABEL.engineer,
    roleChangeBlockedReason: null,
  },
];

const OTHER_ADMIN_ACTIVITIES: readonly UserActivityRowModel[] = [
  {
    id: 'activity-1',
    kindLabel: 'tải bản vẽ lên dự án',
    ...activityMoment(TWELVE_MINUTES_AGO),
    objectCode: 'P-014',
    objectLabel: 'tháp hà nội',
    objectHref: ROUTES.project.floors('project-hanoi-tower'),
  },
  {
    id: 'activity-2',
    kindLabel: 'duyệt qc cho tầng ba',
    ...activityMoment(SAME_DAY_EARLIER),
    objectCode: 'P-014',
    objectLabel: 'tháp hà nội',
    objectHref: ROUTES.project.quality('project-hanoi-tower'),
  },
  {
    id: 'activity-3',
    kindLabel: 'mời người dùng mới',
    ...activityMoment(THREE_DAYS_AGO),
    objectCode: 'P-021',
    objectLabel: 'trung tâm thương mại đà nẵng',
    objectHref: null,
  },
];

const OTHER_ADMIN_DETAIL: UserDetailModel = {
  user: OTHER_ADMIN_ROW,
  memberships: OTHER_ADMIN_MEMBERSHIPS,
  activities: OTHER_ADMIN_ACTIVITIES,
};

/* ==========================================================================
 * 7. Toolbar / mời / xoá hẳn — giá trị mặc định dùng lại ở hầu hết kịch bản.
 * ========================================================================== */

function buildToolbar(overrides: Partial<ToolbarModel> = {}): ToolbarModel {
  return {
    search: '',
    roleFilter: FILTER_ALL,
    statusFilter: FILTER_ALL,
    roleOptions: ROLE_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    canInvite: true,
    inviteBlockedReason: null,
    ...overrides,
  };
}

function buildInvite(overrides: Partial<InviteFormModel> = {}): InviteFormModel {
  return {
    isOpen: false,
    rawEmails: '',
    validEmails: [],
    invalidEmails: [],
    role: 'viewer',
    canSubmit: false,
    hintLabel: INVITE_HINT_LABEL,
    errorLabel: null,
    isSubmitting: false,
    ...overrides,
  };
}

function buildRemoveConfirm(overrides: Partial<RemoveConfirmModel> = {}): RemoveConfirmModel {
  return {
    user: null,
    typedEmail: '',
    isMatch: false,
    warningLabel: REMOVE_WARNING_LABEL,
    canConfirm: false,
    ...overrides,
  };
}

function buildSummary(rows: readonly UserRowModel[]): SummaryModel {
  const adminCount = rows.filter((row) => row.role === 'admin').length;
  const pendingCount = rows.filter((row) => row.status === 'pending').length;

  return {
    userCountLabel: formatNumber(rows.length),
    adminCountLabel: formatNumber(adminCount),
    pendingInviteCountLabel: formatNumber(pendingCount),
  };
}

const LOADING_SUMMARY: SummaryModel = {
  userCountLabel: MISSING_VALUE,
  adminCountLabel: MISSING_VALUE,
  pendingInviteCountLabel: MISSING_VALUE,
};

/* ==========================================================================
 * 8. Bảy `UserManagementViewModel` đã điền đầy đủ (Đ-7).
 * ========================================================================== */

/** 1 · rỗng — đúng một người (chính mình) + câu dạy việc mời đội. */
export const USER_MANAGEMENT_SCENARIO_EMPTY: UserManagementViewModel = {
  state: 'empty',
  isCollapsed: false,
  canManageUsers: true,
  breadcrumbItems: BREADCRUMB_ITEMS,
  toolbar: buildToolbar(),
  summary: buildSummary([SELF_ROW]),
  rows: [SELF_ROW],
  skeletonRowCount: SKELETON_ROW_COUNT,
  selectedUserId: null,
  detail: null,
  permissionMatrix: PERMISSION_MATRIX,
  isPermissionReferenceOpen: false,
  invite: buildInvite(),
  removeConfirm: buildRemoveConfirm(),
  errorLabel: null,
  emptyTeachingLabel: EMPTY_TEACHING_LABEL,
  forbiddenLabel: FORBIDDEN_LABEL,
  backLink: BACK_LINK,
};

/** 2 · đang tải — tám hàng khung xương (`skeletonRowCount`), chưa hàng nào có thật. */
export const USER_MANAGEMENT_SCENARIO_LOADING: UserManagementViewModel = {
  state: 'loading',
  isCollapsed: false,
  canManageUsers: true,
  breadcrumbItems: BREADCRUMB_ITEMS,
  toolbar: buildToolbar(),
  summary: LOADING_SUMMARY,
  rows: [],
  skeletonRowCount: SKELETON_ROW_COUNT,
  selectedUserId: null,
  detail: null,
  permissionMatrix: PERMISSION_MATRIX,
  isPermissionReferenceOpen: false,
  invite: buildInvite(),
  removeConfirm: buildRemoveConfirm(),
  errorLabel: null,
  emptyTeachingLabel: EMPTY_TEACHING_LABEL,
  forbiddenLabel: FORBIDDEN_LABEL,
  backLink: BACK_LINK,
};

/** 3 · một phần — danh sách + đúng ba lời mời chờ nhận, một cái đã hết hạn. */
export const USER_MANAGEMENT_SCENARIO_PARTIAL: UserManagementViewModel = {
  state: 'partial',
  isCollapsed: false,
  canManageUsers: true,
  breadcrumbItems: BREADCRUMB_ITEMS,
  toolbar: buildToolbar(),
  summary: buildSummary(PARTIAL_ROWS),
  rows: PARTIAL_ROWS,
  skeletonRowCount: SKELETON_ROW_COUNT,
  selectedUserId: null,
  detail: null,
  permissionMatrix: PERMISSION_MATRIX,
  isPermissionReferenceOpen: false,
  invite: buildInvite(),
  removeConfirm: buildRemoveConfirm(),
  errorLabel: null,
  emptyTeachingLabel: EMPTY_TEACHING_LABEL,
  forbiddenLabel: FORBIDDEN_LABEL,
  backLink: BACK_LINK,
};

/** 4 · lỗi — không tải được danh sách, kèm lời báo hỏng và nút thử lại. */
export const USER_MANAGEMENT_SCENARIO_ERROR: UserManagementViewModel = {
  state: 'error',
  isCollapsed: false,
  canManageUsers: true,
  breadcrumbItems: BREADCRUMB_ITEMS,
  toolbar: buildToolbar({ canInvite: false }),
  summary: LOADING_SUMMARY,
  rows: [],
  skeletonRowCount: SKELETON_ROW_COUNT,
  selectedUserId: null,
  detail: null,
  permissionMatrix: PERMISSION_MATRIX,
  isPermissionReferenceOpen: false,
  invite: buildInvite(),
  removeConfirm: buildRemoveConfirm(),
  errorLabel: ERROR_LABEL,
  emptyTeachingLabel: EMPTY_TEACHING_LABEL,
  forbiddenLabel: FORBIDDEN_LABEL,
  backLink: BACK_LINK,
};

/** 5 · thành công — đủ ba vai, một tài khoản vô hiệu, hai chỗ hành động bị chặn kèm lý do. */
export const USER_MANAGEMENT_SCENARIO_SUCCESS: UserManagementViewModel = {
  state: 'success',
  isCollapsed: false,
  canManageUsers: true,
  breadcrumbItems: BREADCRUMB_ITEMS,
  toolbar: buildToolbar(),
  summary: buildSummary(SUCCESS_ROWS),
  rows: SUCCESS_ROWS,
  skeletonRowCount: SKELETON_ROW_COUNT,
  selectedUserId: OTHER_ADMIN_ROW.id,
  detail: OTHER_ADMIN_DETAIL,
  permissionMatrix: PERMISSION_MATRIX,
  isPermissionReferenceOpen: false,
  invite: buildInvite(),
  removeConfirm: buildRemoveConfirm(),
  errorLabel: null,
  emptyTeachingLabel: EMPTY_TEACHING_LABEL,
  forbiddenLabel: FORBIDDEN_LABEL,
  backLink: BACK_LINK,
};

/** 6 · không có quyền — chỉ ma trận quyền, không danh sách người (Đ-7 điểm dễ sai nhất). */
export const USER_MANAGEMENT_SCENARIO_FORBIDDEN: UserManagementViewModel = {
  state: 'forbidden',
  isCollapsed: false,
  canManageUsers: false,
  breadcrumbItems: BREADCRUMB_ITEMS,
  toolbar: buildToolbar({ canInvite: false, inviteBlockedReason: FORBIDDEN_INVITE_BLOCKED_REASON }),
  summary: buildSummary([]),
  rows: [],
  skeletonRowCount: SKELETON_ROW_COUNT,
  selectedUserId: null,
  detail: null,
  permissionMatrix: PERMISSION_MATRIX,
  isPermissionReferenceOpen: false,
  invite: buildInvite(),
  removeConfirm: buildRemoveConfirm(),
  errorLabel: null,
  emptyTeachingLabel: EMPTY_TEACHING_LABEL,
  forbiddenLabel: FORBIDDEN_LABEL,
  backLink: BACK_LINK,
};

/** 7 · thu gọn — dưới 1024: bảng thành thẻ, panel thành lớp phủ. Cùng dữ liệu `success`. */
export const USER_MANAGEMENT_SCENARIO_COLLAPSED: UserManagementViewModel = {
  state: 'collapsed',
  isCollapsed: true,
  canManageUsers: true,
  breadcrumbItems: BREADCRUMB_ITEMS,
  toolbar: buildToolbar(),
  summary: buildSummary(SUCCESS_ROWS),
  rows: SUCCESS_ROWS,
  skeletonRowCount: SKELETON_ROW_COUNT,
  selectedUserId: null,
  detail: null,
  permissionMatrix: PERMISSION_MATRIX,
  isPermissionReferenceOpen: false,
  invite: buildInvite(),
  removeConfirm: buildRemoveConfirm(),
  errorLabel: null,
  emptyTeachingLabel: EMPTY_TEACHING_LABEL,
  forbiddenLabel: FORBIDDEN_LABEL,
  backLink: BACK_LINK,
};

/** Bảy kịch bản, đúng thứ tự {@link SEVEN_STATES}. */
export const USER_MANAGEMENT_SCENARIOS: readonly UserManagementViewModel[] = [
  USER_MANAGEMENT_SCENARIO_EMPTY,
  USER_MANAGEMENT_SCENARIO_LOADING,
  USER_MANAGEMENT_SCENARIO_PARTIAL,
  USER_MANAGEMENT_SCENARIO_ERROR,
  USER_MANAGEMENT_SCENARIO_SUCCESS,
  USER_MANAGEMENT_SCENARIO_FORBIDDEN,
  USER_MANAGEMENT_SCENARIO_COLLAPSED,
];

/** Kịch bản của một trạng thái — story và test tra theo tên nhánh (khuôn `objectLayerScenarioFor`). */
export function userManagementScenarioFor(state: SevenState): UserManagementViewModel {
  return (
    USER_MANAGEMENT_SCENARIOS.find((scenario) => scenario.state === state) ?? USER_MANAGEMENT_SCENARIO_SUCCESS
  );
}

/* ==========================================================================
 * 9. Actions giả — no-op thuần (không `vi.fn()`: file này được `UserManagement.stories.tsx`
 *    nhập tĩnh, và Storybook không đóng gói `vitest`). Bài test cần theo dõi lời gọi tự dựng
 *    `vi.fn()` riêng trong `UserManagement.test.tsx`, đúng khuôn `ModelLibrary.test.tsx`.
 * ========================================================================== */

const noop = (): void => {
  /* Kịch bản tĩnh: hành động không làm gì. */
};

export const USER_MANAGEMENT_ACTIONS: UserManagementActions = {
  onSearchChange: noop,
  onRoleFilterChange: noop,
  onStatusFilterChange: noop,
  onSelectUser: noop,
  onChangeRole: noop,
  onChangeMembershipRole: noop,
  onDisableUser: noop,
  onEnableUser: noop,
  onResendInvite: noop,
  onOpenInvite: noop,
  onCloseInvite: noop,
  onInviteEmailsChange: noop,
  onInviteRoleChange: noop,
  onSubmitInvite: noop,
  onOpenRemove: noop,
  onCloseRemove: noop,
  onRemoveEmailChange: noop,
  onConfirmRemove: noop,
  onOpenPermissionReference: noop,
  onClosePermissionReference: noop,
  onRetry: noop,
};
