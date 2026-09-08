/**
 * Hook của màn quản lý người dùng (`/admin/users`).
 *
 * View thuần chỉ nhận `model` + `actions` (mục D, R-60); toàn bộ phần còn lại của màn ở
 * đây. File này tiêu thụ `userManagementGateway.ts` và không dựng lại thứ gì trong đó.
 *
 * ## R-61 — file này NỐI LẠI logic đã có, không chứa công thức tự chế
 *
 * | Việc | Đi qua |
 * |---|---|
 * | Ba lượt đọc | `usersListQueryOptions` / `userMembershipsQueryOptions` / `userActivityQueryOptions`, qua cổng |
 * | Quyền và ma trận | `can()` + `permissionMatrix` (`src/lib/auth/permissions.ts`), qua cổng |
 * | Ghi lạc quan | `createOptimisticMutation` (`src/lib/mutations`) |
 * | Hoàn tác | `createUndoTicket` + `UNDO_WINDOW_MS` (`src/lib/mutations/undoTicket.ts`) |
 * | Toast | `notificationBus`, qua cổng |
 * | Làm mất hiệu lực | `applyInvalidation` (`src/lib/query/invalidation.ts`) |
 * | Định dạng số | `formatNumber` (`src/lib/format/number.ts`) |
 * | Định dạng thời gian | `formatTimestamp` / `formatCalendarDate` / `formatClockTime` |
 * | Tìm bỏ dấu | `foldForSearch` (`screens/viewer/Viewer3D/roomSearch.ts`) |
 * | Câu lỗi tiếng Việt | `describeError(toAppError(…))` (`src/lib/errors`) |
 * | Đường dẫn | `ROUTES` (`@/routes/paths`), qua cổng |
 *
 * `roomSearch.ts` là module LÁ — nó không nhập gì cả — nên lời nhập sâu vào thư mục màn
 * khác ấy đi vào bao đóng của tuyến `/admin/users` gần như miễn phí, đúng lý lẽ đã đo ở
 * `useModelLibrary.ts`. Nhập cùng thứ ấy qua `index.ts` của `Viewer3D` sẽ kéo theo cả
 * tầng 3D và `src/store`.
 *
 * ## Trạng thái máy chủ: `useQuery` / `useMutation`, không `useState` (R-64)
 *
 * Không một `useState` nào ở đây giữ trạng thái máy chủ: cờ đang tải và câu báo hỏng đều
 * đọc thẳng từ `useQuery` / `useMutation`. `hooks/useShareLinks.ts` tự nuôi hai thứ ấy
 * bằng tay — đó là **ngoại lệ đi trước, không phải khuôn mẫu để chép**.
 * `useState` trong file này chỉ giữ lựa chọn của người dùng: ô tìm, hai ô lọc, người đang
 * chọn, hai lớp phủ, và tập hàng vừa đổi vai (thứ nháy nền 340 ms rồi biến mất).
 *
 * ## Đổi vai: không hộp thoại, và toast nói rõ họ MẤT gì
 *
 * D-04/D-05 — đổi ngay trên giao diện, xác nhận với máy chủ, hỏng thì
 * `createOptimisticMutation` trả lại ảnh chụp trước đó. Toast phát khi máy chủ đã nhận,
 * mang vé hoàn tác tám giây; phát trước đó thì nút Hoàn tác sẽ hứa hoàn tác một thay đổi
 * có thể chưa bao giờ xảy ra. Danh sách "mất những gì" tính bằng
 * {@link permissionsLostBetween} — hiệu của hai cột trong `permissionMatrix`, không phải
 * một danh sách gõ tay, vì một danh sách gõ tay sẽ lệch khỏi ma trận đúng vào lúc chính
 * sách đổi mà không bài kiểm nào bắt được.
 *
 * ## Hai lệch có chủ ý, ghi ở đây để không ai "sửa" nhầm
 *
 * 1. **Nền hàng nháy 340 ms, không phải 400.** Thang chuyển động có đúng năm giá trị
 *    (`MOTION_DURATIONS_MS`); 400 không nằm trong đó và `local/no-raw-duration` chặn ở mức
 *    `error`. 340 là giá trị hợp lệ gần nhất.
 * 2. **Cột "lần hoạt động cuối" không luôn tương đối.** `formatTimestamp` chuyển sang mốc
 *    tuyệt đối khi khoảng cách quá một giờ và nó KHÔNG có chế độ luôn-tương-đối. R-61 cấm
 *    viết một công thức thời gian thứ hai trong thư mục màn, nên màn đi theo hàm đã có.
 *    `lastActiveExactLabel` là mốc đầy đủ cho tooltip.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AdminUser, AdminUserList, UserActivity, UserMembership } from '@/api/client';
import { describeError, toAppError } from '@/lib/errors';
import { formatCalendarDate, formatClockTime, formatTimestamp } from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { createOptimisticMutation } from '@/lib/mutations/createOptimisticMutation';
import { UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import { applyInvalidation } from '@/lib/query/invalidation';
import { ROUTES } from '@/routes/paths';
import { foldForSearch } from '@/screens/viewer/Viewer3D/roomSearch';
import type { ProjectRole } from '@/types/project';

import {
  MEMBERSHIP_ROLE_BLOCKED_REASON,
  ROLE_LABELS,
  ROLE_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  activityHref,
  parseInviteEmails,
  permissionsLostBetween,
  userActivityKey,
  userMembershipsKey,
  usersListKey,
  type UserManagementGateway,
} from './userManagementGateway';
import {
  FILTER_ALL,
  type BreadcrumbItemModel,
  type InviteFormModel,
  type PermissionMatrixModel,
  type RemoveConfirmModel,
  type RoleFilter,
  type StatusFilter,
  type SummaryModel,
  type ToolbarModel,
  type UserActivityRowModel,
  type UserDetailModel,
  type UserManagementActions,
  type UserManagementViewModel,
  type UserMembershipRowModel,
  type UserRowModel,
} from './types';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* -------------------------------------------------------------------------- */
/* 1 — Hai con số của hợp đồng                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Tám hàng khung xương lúc đang tải, theo đặc tả — hằng nằm ở hook, không ở view
 * (`types.ts`, `skeletonRowCount`).
 */
const SKELETON_ROW_COUNT = 8;

/** "Mười thao tác gần nhất" của panel chi tiết, cũng theo hợp đồng (`UserDetailModel`). */
const ACTIVITY_LIMIT = 10;

/** Điểm ngắt bố cục hẹp — bảng thành thẻ, panel thành lớp phủ (hợp đồng, mục Đ-7). */
export const COLLAPSE_BREAKPOINT_PX = 1024;

/* -------------------------------------------------------------------------- */
/* 2 — Chữ của hook (A6: viết thường, kiểu câu)                                */
/* -------------------------------------------------------------------------- */

/**
 * Mọi câu tiếng Việt hook sinh ra, gom một chỗ.
 *
 * Xuất khẩu để bài kiểm đối chiếu ĐÚNG chuỗi này thay vì gõ lại một bản thứ hai (R-70),
 * cùng lý do `MODEL_LIBRARY_TEXT` tồn tại ở màn anh em. Bản sao dành cho từ điển kiểm tra
 * nằm ở `logic.i18n.fragment.json`; T9 trộn nó vào `src/i18n/vi.json`.
 */
export const USER_MANAGEMENT_TEXT = {
  breadcrumbAdmin: 'quản trị',
  breadcrumbUsers: 'người dùng',
  backLabel: 'về bảng điều khiển',
  neverActive: 'chưa hoạt động lần nào',
  selfRoleBlocked: 'bạn không thể tự đổi vai của mình',
  selfDisableBlocked: 'bạn không thể tự vô hiệu hoá tài khoản của mình',
  lastAdminBlocked: 'đây là quản trị cuối cùng, hệ thống cần ít nhất một người giữ vai này',
  forbidden:
    'vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì',
  emptyTeaching:
    'mới chỉ có mình bạn ở đây; mời đồng đội bằng nút mời người dùng, ngăn cách nhiều địa chỉ bằng dấu phẩy hoặc xuống dòng',
  inviteHint: 'ngăn cách nhiều địa chỉ bằng dấu phẩy hoặc xuống dòng',
  inviteInvalidPrefix: 'chưa đọc được các địa chỉ sau:',
  inviteBlocked: 'vai của bạn chưa mời được người dùng',
  removeWarning:
    'xoá hẳn gỡ luôn phần ghi công của người này trong lịch sử và không hoàn tác được; gõ đúng địa chỉ thư của họ để xác nhận',
  loadFailed: 'không đọc được danh sách người dùng',
  roleChangedTitle: 'đã đổi vai',
  roleChangedNoLoss: 'vai mới giữ nguyên mọi việc họ đang làm được',
  roleChangedLostPrefix: 'vai mới không còn:',
  roleChangeFailedTitle: 'không đổi được vai',
  disabledTitle: 'đã vô hiệu hoá tài khoản',
  enabledTitle: 'đã bật lại tài khoản',
  setEnabledFailedTitle: 'không đổi được trạng thái tài khoản',
  invitedTitle: 'đã gửi lời mời',
  inviteFailedTitle: 'không gửi được lời mời',
  removedTitle: 'đã xoá tài khoản',
  removeFailedTitle: 'không xoá được tài khoản',
  resentTitle: 'đã gửi lại lời mời',
  resendFailedTitle: 'không gửi lại được lời mời',
  activityFallback: 'thao tác khác',
} as const;

/**
 * Nhãn tiếng Việt của một dòng nhật ký.
 *
 * `UserActivity.kind` là MÃ máy đọc (`'wall.edit'`), và schema nói thẳng rằng câu tiếng
 * Việt là việc của tầng trình bày — nên bảng này sống ở đây chứ không ở `src/api`. Một mã
 * chưa có trong bảng rơi về {@link USER_MANAGEMENT_TEXT.activityFallback} thay vì in mã
 * máy ra cho người đọc.
 */
const ACTIVITY_KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'wall.edit': 'sửa tường',
  'room.edit': 'sửa phòng',
  'opening.edit': 'sửa ô mở',
  'furniture.move': 'dời nội thất',
  'dimension.edit': 'sửa kích thước',
  'axis.edit': 'sửa trục',
  'floor.upload': 'tải bản vẽ',
  'rules.run': 'chạy bộ luật',
  'export.file': 'xuất tệp',
  'share.create': 'tạo liên kết chia sẻ',
  'project.open': 'mở dự án',
});

/* -------------------------------------------------------------------------- */
/* 3 — Một hàng: định dạng xảy ra ở đây, không ở view (A15)                    */
/* -------------------------------------------------------------------------- */

/** Thứ {@link buildRow} cần ngoài chính bản ghi người dùng. */
interface RowContext {
  readonly currentUserId: string | null;
  readonly currentUserEmail: string | null;
  readonly nowMs: number;
  /**
   * Số quản trị ĐANG HOẠT ĐỘNG.
   *
   * Một tài khoản `'disabled'` không quản trị được gì, và một lời mời `'pending'` thì chưa
   * ai nhận — nên cả hai không được tính vào "hệ thống còn bao nhiêu quản trị". Đây cũng
   * là con số `adminCountLabel` in ra, để dải tóm tắt và câu chặn không nói hai điều khác
   * nhau về cùng một bảng.
   */
  readonly activeAdminCount: number;
  readonly canManage: boolean;
  readonly justChangedIds: readonly string[];
}

/** Người này có phải chính người đang đăng nhập không. */
function isSelfUser(user: AdminUser, context: RowContext): boolean {
  return user.id === context.currentUserId || user.email === context.currentUserEmail;
}

/** Gỡ hoặc hạ vai người này thì hệ thống không còn quản trị nào — hợp đồng, mục Đ-8. */
function isLastActiveAdmin(user: AdminUser, context: RowContext): boolean {
  return user.role === 'admin' && user.status === 'active' && context.activeAdminCount <= 1;
}

/** Một hàng, đã định dạng sẵn cho mắt người. */
function buildRow(user: AdminUser, context: RowContext): UserRowModel {
  const isSelf = isSelfUser(user, context);
  const lastAdmin = isLastActiveAdmin(user, context);
  const lastActiveAt = user.lastActiveAt === null ? null : new Date(user.lastActiveAt);
  const expiresAtMs =
    user.inviteExpiresAt === undefined ? null : Date.parse(user.inviteExpiresAt);

  const roleChangeBlockedReason = isSelf
    ? USER_MANAGEMENT_TEXT.selfRoleBlocked
    : lastAdmin
      ? USER_MANAGEMENT_TEXT.lastAdminBlocked
      : null;

  // Một tài khoản đã vô hiệu thì việc làm được ở đó là BẬT LẠI, và bật lại không bị chặn
  // bởi bất cứ điều gì ở trên — nên chỗ này là `null` chứ không phải câu chặn của lượt
  // vô hiệu hoá.
  const disableBlockedReason =
    user.status === 'disabled'
      ? null
      : isSelf
        ? USER_MANAGEMENT_TEXT.selfDisableBlocked
        : lastAdmin
          ? USER_MANAGEMENT_TEXT.lastAdminBlocked
          : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.avatarUrl === undefined ? {} : { avatarUrl: user.avatarUrl }),
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    status: user.status,
    statusLabel: STATUS_LABELS[user.status],
    projectCountLabel: formatNumber(user.projectCount),
    lastActiveLabel:
      lastActiveAt === null
        ? USER_MANAGEMENT_TEXT.neverActive
        : formatTimestamp(lastActiveAt, context.nowMs),
    lastActiveExactLabel:
      lastActiveAt === null
        ? USER_MANAGEMENT_TEXT.neverActive
        : `${formatCalendarDate(lastActiveAt)} ${formatClockTime(lastActiveAt)}`,
    isSelf,
    inviteExpired:
      user.status === 'pending' && expiresAtMs !== null && expiresAtMs <= context.nowMs,
    canResendInvite: context.canManage && user.status === 'pending',
    justChanged: context.justChangedIds.includes(user.id),
    roleChangeBlockedReason,
    disableBlockedReason,
    removeBlockedReason: lastAdmin ? USER_MANAGEMENT_TEXT.lastAdminBlocked : null,
  };
}

/* -------------------------------------------------------------------------- */
/* 4 — Lọc và tìm                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ô tìm khớp cả tên lẫn địa chỉ, bỏ dấu ở CẢ HAI phía.
 *
 * Cùng phép so mà ô tìm đối tượng của `Viewer3D` dùng: người gõ "nguyen binh" phải ra
 * "Nguyễn Bình" mà không cần bộ gõ tiếng Việt.
 */
function matchesSearch(row: UserRowModel, query: string): boolean {
  const needle = foldForSearch(query).trim();

  return (
    needle === '' ||
    foldForSearch(row.name).includes(needle) ||
    foldForSearch(row.email).includes(needle)
  );
}

/* -------------------------------------------------------------------------- */
/* 5 — Ghi lạc quan: sửa thẳng trang danh sách trong bộ nhớ đệm                */
/* -------------------------------------------------------------------------- */

/** Thay một bản ghi trong trang danh sách; `total` không đổi. */
function replaceUserIn(list: AdminUserList | undefined, next: AdminUser): AdminUserList | undefined {
  if (list === undefined) {
    return list;
  }

  return {
    ...list,
    users: list.users.map((candidate) => (candidate.id === next.id ? next : candidate)),
  };
}

/** Sửa vài trường của một bản ghi, giữ nguyên phần còn lại. */
function patchUserIn(
  list: AdminUserList | undefined,
  userId: string,
  patch: Partial<AdminUser>,
): AdminUserList | undefined {
  if (list === undefined) {
    return list;
  }

  return {
    ...list,
    users: list.users.map((candidate) =>
      candidate.id === userId ? { ...candidate, ...patch } : candidate,
    ),
  };
}

/** Thêm hàng chờ; `total` đi theo, nếu không dải tóm tắt nói một đằng bảng nói một nẻo. */
function addUsersTo(
  list: AdminUserList | undefined,
  added: readonly AdminUser[],
): AdminUserList | undefined {
  if (list === undefined) {
    return list;
  }

  return { total: list.total + added.length, users: [...list.users, ...added] };
}

/** Gỡ những hàng có id nằm trong `ids`; `total` đi theo. */
function removeUsersFrom(
  list: AdminUserList | undefined,
  ids: readonly string[],
): AdminUserList | undefined {
  if (list === undefined) {
    return list;
  }

  const users = list.users.filter((candidate) => !ids.includes(candidate.id));

  return { total: list.total - (list.users.length - users.length), users };
}

/* -------------------------------------------------------------------------- */
/* 6 — Tham số và kết quả của hook                                             */
/* -------------------------------------------------------------------------- */

export interface UseUserManagementOptions {
  readonly gateway: UserManagementGateway;
  /** Khung hẹp hơn {@link COLLAPSE_BREAKPOINT_PX}. Nơi ráp đo, hook không đọc `window`. */
  readonly isNarrow?: boolean;
  /** Đồng hồ tiêm được, để bài kiểm không phụ thuộc vào giờ máy chạy. */
  readonly now?: () => number;
}

export interface UserManagementResult {
  readonly model: UserManagementViewModel;
  readonly actions: UserManagementActions;
}

/** Biến của lượt đổi vai; `isUndo` chỉ đi vào O-01 và vào việc "có phát toast không". */
interface RoleChangeVariables {
  readonly userId: string;
  readonly role: ProjectRole;
  readonly previousRole: ProjectRole;
  readonly isUndo: boolean;
}

interface SetEnabledVariables {
  readonly userId: string;
  readonly enabled: boolean;
  readonly isUndo: boolean;
}

interface InviteVariables {
  readonly emails: readonly string[];
  readonly role: ProjectRole;
  /** Mã tạm của những hàng chờ vừa vẽ ra, để lượt thành công gỡ đúng chúng đi. */
  readonly optimisticIds: readonly string[];
}

interface RemoveVariables {
  readonly userId: string;
  readonly confirmEmail: string;
}

/* -------------------------------------------------------------------------- */
/* 7 — Hook                                                                    */
/* -------------------------------------------------------------------------- */

export function useUserManagement(options: UseUserManagementOptions): UserManagementResult {
  const { gateway } = options;
  const isCollapsed = options.isNarrow ?? false;
  const now = options.now ?? gateway.now;
  const canManage = gateway.capabilities.canManageUsers;

  const queryClient = useQueryClient();

  /* ---- Lựa chọn của người dùng ----------------------------------------- */

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(FILTER_ALL);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isPermissionReferenceOpen, setPermissionReferenceOpen] = useState(false);
  const [isInviteOpen, setInviteOpen] = useState(false);
  const [rawEmails, setRawEmails] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('viewer');
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [removeEmail, setRemoveEmail] = useState('');
  /** Hàng vừa đổi vai xong: nền nháy đúng một nhịp `MOTION_DURATIONS_MS.slow` rồi tắt. */
  const [justChangedIds, setJustChangedIds] = useState<readonly string[]>([]);

  const flashTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(
    () => (): void => {
      for (const timer of flashTimersRef.current.values()) {
        clearTimeout(timer);
      }
      flashTimersRef.current.clear();
    },
    [],
  );

  const flashRow = useCallback((userId: string): void => {
    const timers = flashTimersRef.current;
    const running = timers.get(userId);

    if (running !== undefined) {
      clearTimeout(running);
    }

    setJustChangedIds((previous) =>
      previous.includes(userId) ? previous : [...previous, userId],
    );
    timers.set(
      userId,
      setTimeout(() => {
        timers.delete(userId);
        setJustChangedIds((previous) => previous.filter((id) => id !== userId));
      }, MOTION_DURATIONS_MS.slow),
    );
  }, []);

  const stopFlash = useCallback((userId: string): void => {
    const running = flashTimersRef.current.get(userId);

    if (running !== undefined) {
      clearTimeout(running);
      flashTimersRef.current.delete(userId);
    }

    setJustChangedIds((previous) => previous.filter((id) => id !== userId));
  }, []);

  /* ---- Ba lượt đọc ------------------------------------------------------ */

  const listQuery = useQuery({
    queryKey: usersListKey(),
    queryFn: ({ signal }): Promise<AdminUserList> => gateway.listUsers(signal),
    enabled: canManage,
  });

  const membershipsQuery = useQuery({
    queryKey: userMembershipsKey(selectedUserId ?? ''),
    queryFn: ({ signal }): Promise<readonly UserMembership[]> => {
      if (selectedUserId === null) {
        return Promise.reject(new Error(USER_MANAGEMENT_TEXT.loadFailed));
      }

      return gateway.readMemberships(selectedUserId, signal);
    },
    enabled: canManage && selectedUserId !== null,
  });

  const activityQuery = useQuery({
    queryKey: userActivityKey(selectedUserId ?? ''),
    queryFn: ({ signal }): Promise<readonly UserActivity[]> => {
      if (selectedUserId === null) {
        return Promise.reject(new Error(USER_MANAGEMENT_TEXT.loadFailed));
      }

      return gateway.readActivity(selectedUserId, signal);
    },
    enabled: canManage && selectedUserId !== null,
  });

  const users = useMemo(
    (): readonly AdminUser[] => listQuery.data?.users ?? [],
    [listQuery.data],
  );

  /* ---- Hàng, dải tóm tắt ------------------------------------------------ */

  const nowMs = now();

  const activeAdminCount = useMemo(
    (): number =>
      users.filter((user) => user.role === 'admin' && user.status === 'active').length,
    [users],
  );

  const pendingInviteCount = useMemo(
    (): number => users.filter((user) => user.status === 'pending').length,
    [users],
  );

  const rowContext = useMemo(
    (): RowContext => ({
      currentUserId: gateway.currentUserId,
      currentUserEmail: gateway.currentUserEmail,
      nowMs,
      activeAdminCount,
      canManage,
      justChangedIds,
    }),
    [
      gateway.currentUserId,
      gateway.currentUserEmail,
      nowMs,
      activeAdminCount,
      canManage,
      justChangedIds,
    ],
  );

  /** Mọi hàng, chưa lọc — chỗ mọi lời phán về "người này" đọc, kể cả khi ô lọc đang bật. */
  const allRows = useMemo(
    (): readonly UserRowModel[] => users.map((user) => buildRow(user, rowContext)),
    [users, rowContext],
  );

  const rows = useMemo(
    (): readonly UserRowModel[] =>
      allRows.filter(
        (row) =>
          matchesSearch(row, search) &&
          (roleFilter === FILTER_ALL || row.role === roleFilter) &&
          (statusFilter === FILTER_ALL || row.status === statusFilter),
      ),
    [allRows, search, roleFilter, statusFilter],
  );

  const rowById = useMemo(
    (): ReadonlyMap<string, UserRowModel> => new Map(allRows.map((row) => [row.id, row])),
    [allRows],
  );

  const summary = useMemo(
    (): SummaryModel => ({
      userCountLabel: formatNumber(users.length),
      adminCountLabel: formatNumber(activeAdminCount),
      pendingInviteCountLabel: formatNumber(pendingInviteCount),
    }),
    [users.length, activeAdminCount, pendingInviteCount],
  );

  /* ---- Thông báo -------------------------------------------------------- */

  const notifyFailure = useCallback(
    (title: string, error: unknown): void => {
      gateway.notify({
        type: 'user.write-failed',
        title,
        description: describeError(toAppError(error)).description,
      });
    },
    [gateway],
  );

  /* ---- Bốn lượt ghi lạc quan + một lượt ghi thường (R-64) ---------------- */

  const roleChangeMutation = useMutation(
    createOptimisticMutation<RoleChangeVariables, AdminUser>(queryClient, {
      affectedKeys: ({ userId }) => [usersListKey(), userMembershipsKey(userId)],
      applyOptimistic: ({ role, userId }) => {
        queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
          patchUserIn(previous, userId, { role }),
        );
        flashRow(userId);
      },
      callServer: ({ role, userId }) => gateway.changeRole({ role, userId }),
      afterSuccess: (fresh, { userId }) => {
        queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
          replaceUserIn(previous, fresh),
        );
        applyInvalidation(queryClient, 'changeUserRole', { userId });
      },
      entityId: ({ userId }) => userId,
      rollback: ({ userId }) => {
        stopFlash(userId);
      },
    }),
  );

  const setEnabledMutation = useMutation(
    createOptimisticMutation<SetEnabledVariables, AdminUser>(queryClient, {
      affectedKeys: ({ userId }) => [usersListKey(), userMembershipsKey(userId)],
      applyOptimistic: ({ enabled, userId }) => {
        queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
          patchUserIn(previous, userId, { status: enabled ? 'active' : 'disabled' }),
        );
      },
      callServer: ({ enabled, userId }) =>
        enabled ? gateway.enableUser(userId) : gateway.disableUser(userId),
      afterSuccess: (fresh, { userId }) => {
        queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
          replaceUserIn(previous, fresh),
        );
        applyInvalidation(queryClient, 'setUserEnabled', { userId });
      },
      entityId: ({ userId }) => userId,
      rollback: () => {
        // Ảnh chụp trước lượt ghi đã được `createOptimisticMutation` trả lại; ngoài bộ nhớ
        // đệm, lượt này không đụng vào state nào của màn nên không còn gì để gỡ.
      },
    }),
  );

  const inviteMutation = useMutation(
    createOptimisticMutation<InviteVariables, readonly AdminUser[]>(queryClient, {
      affectedKeys: () => [usersListKey()],
      applyOptimistic: ({ emails, optimisticIds, role }) => {
        // Hàng chờ hiện NGAY, không đợi vòng làm mới. `name` tạm là chính địa chỉ: máy chủ
        // là nơi duy nhất biết tên thật, và lượt `afterSuccess` ngay dưới thay cả hàng
        // bằng bản ghi thật. `inviteExpiresAt` KHÔNG được đoán — hạn của một lời mời là
        // chính sách của máy chủ, và bịa ra một hạn ở đây là vẽ chấm "hết hạn" sai (R-71).
        const invitedAt = new Date(now()).toISOString();
        const pending = emails.map(
          (email, index): AdminUser => ({
            email,
            id: optimisticIds[index] ?? email,
            invitedAt,
            lastActiveAt: null,
            name: email,
            projectCount: 0,
            role,
            status: 'pending',
          }),
        );

        queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
          addUsersTo(previous, pending),
        );
      },
      callServer: ({ emails, role }) => gateway.inviteUsers({ emails, role }),
      afterSuccess: (fresh, { optimisticIds }) => {
        queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
          addUsersTo(removeUsersFrom(previous, optimisticIds), fresh),
        );
        applyInvalidation(queryClient, 'inviteUsers', {});
      },
      entityId: ({ role }) => `invite:${role}`,
      rollback: () => {
        // Cùng lý do với lượt vô hiệu hoá ở trên: hàng chờ chỉ sống trong bộ nhớ đệm.
      },
    }),
  );

  const removeMutation = useMutation(
    createOptimisticMutation<RemoveVariables, AdminUser>(queryClient, {
      affectedKeys: ({ userId }) => [
        usersListKey(),
        userMembershipsKey(userId),
        userActivityKey(userId),
      ],
      applyOptimistic: ({ userId }) => {
        queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
          removeUsersFrom(previous, [userId]),
        );
      },
      callServer: ({ confirmEmail, userId }) => gateway.removeUser({ confirmEmail, userId }),
      afterSuccess: (_removed, { userId }) => {
        applyInvalidation(queryClient, 'removeUser', { userId });
      },
      entityId: ({ userId }) => userId,
      rollback: () => {
        // Ảnh chụp của `createOptimisticMutation` là thứ trả hàng vừa gỡ về chỗ cũ.
      },
    }),
  );

  /**
   * Gửi lại lời mời — lượt ghi DUY NHẤT không lạc quan.
   *
   * Không có gì để vẽ trước: thứ lượt này đổi là `inviteExpiresAt`, và hạn mới là con số
   * của máy chủ. Đoán một hạn ở đây để "nhìn cho nhanh" là dựng một hằng số chính sách
   * trong thư mục màn (R-71), nên màn chờ câu trả lời thật rồi mới vẽ lại.
   */
  const resendMutation = useMutation({
    mutationFn: (userId: string): Promise<AdminUser> => gateway.resendInvite(userId),
    onSuccess: (fresh: AdminUser): void => {
      queryClient.setQueryData<AdminUserList>(usersListKey(), (previous) =>
        replaceUserIn(previous, fresh),
      );
      applyInvalidation(queryClient, 'resendInvite', {});
    },
  });

  /* ---- Đổi vai: không hộp thoại, toast có Hoàn tác ----------------------- */

  const runRoleChange = useCallback(
    (variables: RoleChangeVariables): void => {
      const startedAt = now();

      void roleChangeMutation.mutateAsync(variables).then(
        () => {
          gateway.trackRoleChange({
            fromRole: variables.previousRole,
            toRole: variables.role,
            outcome: 'success',
            undo: variables.isUndo,
            durationMs: now() - startedAt,
          });

          if (variables.isUndo) {
            // Lượt hoàn tác không phát toast: một toast có nút Hoàn tác cho chính lượt
            // hoàn tác là một vòng không có điểm dừng.
            return;
          }

          const lost = permissionsLostBetween(variables.previousRole, variables.role);
          const ticket = gateway.createWriteTicket({
            description: USER_MANAGEMENT_TEXT.roleChangedTitle,
            undo: () => {
              runRoleChange({
                userId: variables.userId,
                role: variables.previousRole,
                previousRole: variables.role,
                isUndo: true,
              });
            },
          });

          gateway.notify({
            type: 'user.role-change',
            title: USER_MANAGEMENT_TEXT.roleChangedTitle,
            description:
              lost.length === 0
                ? `${ROLE_LABELS[variables.role]} — ${USER_MANAGEMENT_TEXT.roleChangedNoLoss}`
                : `${ROLE_LABELS[variables.role]} — ${USER_MANAGEMENT_TEXT.roleChangedLostPrefix} ${lost.join(', ')}`,
            undoTicket: ticket,
          });
        },
        (error: unknown) => {
          gateway.trackRoleChange({
            fromRole: variables.previousRole,
            toRole: variables.role,
            outcome: 'failure',
            undo: variables.isUndo,
            durationMs: now() - startedAt,
            errorKind: toAppError(error).kind,
          });
          notifyFailure(USER_MANAGEMENT_TEXT.roleChangeFailedTitle, error);
        },
      );
    },
    [gateway, notifyFailure, now, roleChangeMutation],
  );

  /* ---- Vô hiệu hoá / bật lại: đảo được, tức thì, kèm hoàn tác ------------ */

  const runSetEnabled = useCallback(
    (variables: SetEnabledVariables): void => {
      void setEnabledMutation.mutateAsync(variables).then(
        () => {
          if (variables.isUndo) {
            return;
          }

          const title = variables.enabled
            ? USER_MANAGEMENT_TEXT.enabledTitle
            : USER_MANAGEMENT_TEXT.disabledTitle;

          gateway.notify({
            type: 'user.set-enabled',
            title,
            description: rowById.get(variables.userId)?.name ?? variables.userId,
            undoTicket: gateway.createWriteTicket({
              description: title,
              undo: () => {
                runSetEnabled({
                  userId: variables.userId,
                  enabled: !variables.enabled,
                  isUndo: true,
                });
              },
            }),
          });
        },
        (error: unknown) => {
          notifyFailure(USER_MANAGEMENT_TEXT.setEnabledFailedTitle, error);
        },
      );
    },
    [gateway, notifyFailure, rowById, setEnabledMutation],
  );

  /* ---- Panel chi tiết --------------------------------------------------- */

  const memberships = useMemo(
    (): readonly UserMembershipRowModel[] =>
      (membershipsQuery.data ?? []).map(
        (membership): UserMembershipRowModel => ({
          projectId: membership.projectId,
          projectName: membership.projectName,
          role: membership.role,
          roleLabel: ROLE_LABELS[membership.role],
          // Không tầng nào của repo có đường ghi vai TRONG một dự án — xem docblock của
          // `userManagementGateway.ts`. Câu này là thứ hiện thay cho một ô chọn chết.
          roleChangeBlockedReason: MEMBERSHIP_ROLE_BLOCKED_REASON,
        }),
      ),
    [membershipsQuery.data],
  );

  const activities = useMemo(
    (): readonly UserActivityRowModel[] =>
      [...(activityQuery.data ?? [])]
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
        .slice(0, ACTIVITY_LIMIT)
        .map((activity): UserActivityRowModel => {
          const at = new Date(activity.at);

          return {
            id: activity.id,
            kindLabel: ACTIVITY_KIND_LABELS[activity.kind] ?? USER_MANAGEMENT_TEXT.activityFallback,
            atLabel: formatTimestamp(at, nowMs),
            atExactLabel: `${formatCalendarDate(at)} ${formatClockTime(at)}`,
            objectCode: activity.objectCode,
            objectLabel: activity.objectLabel,
            objectHref: activityHref(activity.kind),
          };
        }),
    [activityQuery.data, nowMs],
  );

  const detail = useMemo((): UserDetailModel | null => {
    if (selectedUserId === null) {
      return null;
    }

    const user = rowById.get(selectedUserId);

    return user === undefined ? null : { user, memberships, activities };
  }, [selectedUserId, rowById, memberships, activities]);

  /* ---- Mời người dùng --------------------------------------------------- */

  const parsedEmails = useMemo(() => parseInviteEmails(rawEmails), [rawEmails]);

  const invite = useMemo(
    (): InviteFormModel => ({
      isOpen: isInviteOpen,
      rawEmails,
      validEmails: parsedEmails.validEmails,
      invalidEmails: parsedEmails.invalidEmails,
      role: inviteRole,
      canSubmit:
        canManage &&
        !inviteMutation.isPending &&
        parsedEmails.validEmails.length > 0 &&
        parsedEmails.invalidEmails.length === 0,
      hintLabel: USER_MANAGEMENT_TEXT.inviteHint,
      errorLabel:
        parsedEmails.invalidEmails.length === 0
          ? null
          : `${USER_MANAGEMENT_TEXT.inviteInvalidPrefix} ${parsedEmails.invalidEmails.join(', ')}`,
      isSubmitting: inviteMutation.isPending,
    }),
    [isInviteOpen, rawEmails, parsedEmails, inviteRole, canManage, inviteMutation.isPending],
  );

  /* ---- Xoá hẳn: bắt gõ đúng địa chỉ (A9) -------------------------------- */

  const removeConfirm = useMemo((): RemoveConfirmModel => {
    const user = removeUserId === null ? null : (rowById.get(removeUserId) ?? null);
    const isMatch =
      user !== null && removeEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

    return {
      user,
      typedEmail: removeEmail,
      isMatch,
      warningLabel: USER_MANAGEMENT_TEXT.removeWarning,
      canConfirm:
        isMatch &&
        user !== null &&
        user.removeBlockedReason === null &&
        !removeMutation.isPending,
    };
  }, [removeUserId, rowById, removeEmail, removeMutation.isPending]);

  /* ---- Bảy trạng thái --------------------------------------------------- */

  /**
   * Chỉ lượt đọc DANH SÁCH mới đưa cả màn vào trạng thái lỗi.
   *
   * Hai lượt đọc của panel chi tiết hỏng thì bảng vẫn đúng và panel hiện phần nó có —
   * đúng nghĩa `'partial'` của A11. Kéo cả màn về `'error'` vì một nhật ký hoạt động
   * không đọc được là vứt đi một bảng vẫn dùng được.
   */
  const errorLabel = useMemo(
    (): string | null =>
      listQuery.error === null ? null : describeError(toAppError(listQuery.error)).description,
    [listQuery.error],
  );

  /**
   * Bậc thang: `forbidden` → `loading` → `error` → `collapsed` → `empty` → `partial` →
   * `success`.
   *
   * `forbidden` đứng đầu vì nó là câu trả lời về QUYỀN: không có quyền thì không có lượt
   * đọc nào chạy, nên mọi nhánh dưới nó nói về dữ liệu không tồn tại. `collapsed` đứng
   * trên `empty` theo đúng thứ tự mà `useModelLibrary.ts` đã chọn cho cùng câu hỏi — bề
   * rộng quyết định BỐ CỤC, và `model.isCollapsed` vẫn đi riêng nên view dựng thẻ thay cho
   * bảng ở bất kỳ nhánh nào.
   */
  const state = useMemo((): SevenState => {
    if (!canManage) {
      return 'forbidden';
    }
    if (listQuery.isPending) {
      return 'loading';
    }
    if (errorLabel !== null) {
      return 'error';
    }
    if (isCollapsed) {
      return 'collapsed';
    }
    if (users.length <= 1) {
      return 'empty';
    }

    return pendingInviteCount > 0 ? 'partial' : 'success';
  }, [
    canManage,
    listQuery.isPending,
    errorLabel,
    isCollapsed,
    users.length,
    pendingInviteCount,
  ]);

  /* ---- Việc làm được ---------------------------------------------------- */

  const onChangeRole = useCallback(
    (userId: string, role: ProjectRole): void => {
      const row = rowById.get(userId);

      if (row === undefined) {
        return;
      }

      if (row.roleChangeBlockedReason !== null) {
        // Hành động bị chặn tự giải thích — kể cả khi nơi gọi bỏ qua câu đã có sẵn trên
        // hàng. Không có nhánh nào ở đây im lặng không làm gì.
        gateway.notify({
          type: 'user.blocked',
          title: USER_MANAGEMENT_TEXT.roleChangeFailedTitle,
          description: row.roleChangeBlockedReason,
        });

        return;
      }

      if (row.role === role) {
        return;
      }

      runRoleChange({ userId, role, previousRole: row.role, isUndo: false });
    },
    [gateway, rowById, runRoleChange],
  );

  const onSetEnabled = useCallback(
    (userId: string, enabled: boolean): void => {
      const row = rowById.get(userId);

      if (row === undefined) {
        return;
      }

      if (!enabled && row.disableBlockedReason !== null) {
        gateway.notify({
          type: 'user.blocked',
          title: USER_MANAGEMENT_TEXT.setEnabledFailedTitle,
          description: row.disableBlockedReason,
        });

        return;
      }

      runSetEnabled({ userId, enabled, isUndo: false });
    },
    [gateway, rowById, runSetEnabled],
  );

  const actions = useMemo(
    (): UserManagementActions => ({
      onSearchChange: setSearch,
      onRoleFilterChange: setRoleFilter,
      onStatusFilterChange: setStatusFilter,
      onSelectUser: setSelectedUserId,
      onChangeRole,
      onChangeMembershipRole: (userId): void => {
        // Hợp đồng khai hành động này, nhưng KHÔNG tầng nào của repo có đường ghi vai
        // trong một dự án (xem `userManagementGateway.ts`). Mọi hàng dự án đã mang sẵn
        // {@link MEMBERSHIP_ROLE_BLOCKED_REASON}, nên view không dựng ô chọn nào; nếu một
        // nơi gọi vẫn tới đây thì nó nhận lại đúng câu giải thích ấy chứ không phải một
        // lượt gọi lặng lẽ rơi vào hư không.
        gateway.notify({
          type: 'user.blocked',
          title: USER_MANAGEMENT_TEXT.roleChangeFailedTitle,
          description: `${rowById.get(userId)?.name ?? userId} — ${MEMBERSHIP_ROLE_BLOCKED_REASON}`,
        });
      },
      onDisableUser: (userId): void => {
        onSetEnabled(userId, false);
      },
      onEnableUser: (userId): void => {
        onSetEnabled(userId, true);
      },
      onResendInvite: (userId): void => {
        void resendMutation.mutateAsync(userId).then(
          () => {
            gateway.notify({
              type: 'user.resend-invite',
              title: USER_MANAGEMENT_TEXT.resentTitle,
              description: rowById.get(userId)?.email ?? userId,
            });
          },
          (error: unknown) => {
            notifyFailure(USER_MANAGEMENT_TEXT.resendFailedTitle, error);
          },
        );
      },
      onOpenInvite: (): void => {
        setInviteOpen(true);
      },
      onCloseInvite: (): void => {
        setInviteOpen(false);
        setRawEmails('');
      },
      onInviteEmailsChange: setRawEmails,
      onInviteRoleChange: setInviteRole,
      onSubmitInvite: (): void => {
        const { validEmails } = parseInviteEmails(rawEmails);

        if (validEmails.length === 0) {
          return;
        }

        const variables: InviteVariables = {
          emails: validEmails,
          role: inviteRole,
          optimisticIds: validEmails.map(() => gateway.createOptimisticId()),
        };

        void inviteMutation.mutateAsync(variables).then(
          () => {
            setInviteOpen(false);
            setRawEmails('');
            gateway.notify({
              type: 'user.invite',
              title: USER_MANAGEMENT_TEXT.invitedTitle,
              description: validEmails.join(', '),
            });
          },
          (error: unknown) => {
            notifyFailure(USER_MANAGEMENT_TEXT.inviteFailedTitle, error);
          },
        );
      },
      onOpenRemove: (userId): void => {
        setRemoveUserId(userId);
        setRemoveEmail('');
      },
      onCloseRemove: (): void => {
        setRemoveUserId(null);
        setRemoveEmail('');
      },
      onRemoveEmailChange: setRemoveEmail,
      onConfirmRemove: (): void => {
        if (removeUserId === null || !removeConfirm.canConfirm) {
          return;
        }

        const userId = removeUserId;

        void removeMutation.mutateAsync({ userId, confirmEmail: removeEmail.trim() }).then(
          () => {
            setRemoveUserId(null);
            setRemoveEmail('');
            setSelectedUserId((current) => (current === userId ? null : current));
            gateway.notify({
              type: 'user.remove',
              title: USER_MANAGEMENT_TEXT.removedTitle,
              // Xoá hẳn KHÔNG hoàn tác được (A9) — nên thông báo này cố tình không mang
              // `undoTicket`. Đó là lý do nó đã hỏi trước bằng ô gõ lại địa chỉ.
              description: removeEmail.trim(),
            });
          },
          (error: unknown) => {
            notifyFailure(USER_MANAGEMENT_TEXT.removeFailedTitle, error);
          },
        );
      },
      onOpenPermissionReference: (): void => {
        setPermissionReferenceOpen(true);
      },
      onClosePermissionReference: (): void => {
        setPermissionReferenceOpen(false);
      },
      onRetry: (): void => {
        void queryClient.invalidateQueries({ queryKey: usersListKey() });
      },
    }),
    [
      gateway,
      inviteMutation,
      inviteRole,
      notifyFailure,
      onChangeRole,
      onSetEnabled,
      queryClient,
      rawEmails,
      removeConfirm.canConfirm,
      removeEmail,
      removeMutation,
      removeUserId,
      resendMutation,
      rowById,
    ],
  );

  /* ---- Viewmodel -------------------------------------------------------- */

  const toolbar = useMemo(
    (): ToolbarModel => ({
      search,
      roleFilter,
      statusFilter,
      roleOptions: ROLE_OPTIONS,
      statusOptions: STATUS_OPTIONS,
      canInvite: canManage,
      inviteBlockedReason: canManage ? null : USER_MANAGEMENT_TEXT.inviteBlocked,
    }),
    [search, roleFilter, statusFilter, canManage],
  );

  /**
   * Breadcrumb "quản trị > người dùng", đúng mục Đ-5 của hợp đồng.
   *
   * Cả hai mục đều `href: null`. Repo KHÔNG có tuyến chỉ mục `/admin` — `ROUTE_PATTERNS`
   * chỉ có `adminModels` và `adminUsers` — nên mục tổ tiên là một nhãn chứ không phải một
   * liên kết; bịa ra một đích cho nó là đúng thứ R-65 tồn tại để chặn. Đường quay lại là
   * {@link UserManagementViewModel.backLink}.
   */
  const breadcrumbItems = useMemo(
    (): readonly BreadcrumbItemModel[] => [
      { label: USER_MANAGEMENT_TEXT.breadcrumbAdmin, href: null },
      { label: USER_MANAGEMENT_TEXT.breadcrumbUsers, href: null },
    ],
    [],
  );

  const permissionMatrix = useMemo(
    (): PermissionMatrixModel => gateway.permissionMatrix,
    [gateway.permissionMatrix],
  );

  const model = useMemo(
    (): UserManagementViewModel => ({
      state,
      isCollapsed,
      canManageUsers: canManage,
      breadcrumbItems,
      toolbar,
      summary,
      rows,
      skeletonRowCount: SKELETON_ROW_COUNT,
      selectedUserId,
      detail,
      permissionMatrix,
      isPermissionReferenceOpen,
      invite,
      removeConfirm,
      errorLabel,
      emptyTeachingLabel: USER_MANAGEMENT_TEXT.emptyTeaching,
      forbiddenLabel: USER_MANAGEMENT_TEXT.forbidden,
      backLink: { label: USER_MANAGEMENT_TEXT.backLabel, href: ROUTES.dashboard },
    }),
    [
      state,
      isCollapsed,
      canManage,
      breadcrumbItems,
      toolbar,
      summary,
      rows,
      selectedUserId,
      detail,
      permissionMatrix,
      isPermissionReferenceOpen,
      invite,
      removeConfirm,
      errorLabel,
    ],
  );

  return { model, actions };
}

/** Vé hoàn tác của màn này dùng đúng cửa sổ tám giây của A8, không một con số riêng nào. */
export const USER_MANAGEMENT_UNDO_WINDOW_MS = UNDO_WINDOW_MS;
