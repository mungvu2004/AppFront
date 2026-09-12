/**
 * Cổng dữ liệu của màn quản lý người dùng (`/admin/users`). Một file THUẦN: không React,
 * không JSX, nên nó chạy và test được ngoài một cây React — đúng khuôn
 * `ModelLibrary/modelLibraryGateway.ts` và `VersionHistory/versionHistoryGateway.ts`.
 *
 * Ba nhóm việc, cả ba đều là **nối lại** logic đã có (R-61):
 *
 * 1. **Năng lực** — {@link userManagementCapabilities} gọi `can('manage', 'user', { roles })`
 *    của `src/lib/auth/permissions.ts`. Không một bảng vai nào được gõ lại ở đây; gõ lại
 *    chính là "tự định nghĩa lại bộ quyền", điều cấm số một của đặc tả màn.
 * 2. **Ba lượt đọc** — đi qua `usersListQueryOptions` / `userMembershipsQueryOptions` /
 *    `userActivityQueryOptions` (`src/lib/query/usersQueries.ts`). Không `fetch` nào được
 *    viết ở đây và không `isLoading`/`error` nào được nuôi bằng tay (R-64).
 * 3. **Ma trận quyền** — {@link buildPermissionMatrix} đọc TỪNG Ô từ `permissionMatrix`.
 *    Ba cột (`AUTH_ROLES`) × bảy dòng ({@link PERMISSION_MATRIX_ROWS}).
 *
 * ## Ba cột, không phải bốn
 *
 * `ProjectRole` có đúng ba giá trị và `AUTH_ROLES` là nguồn duy nhất của tập ấy. Đặc tả
 * gốc đòi bốn vai; vai thứ tư KHÔNG tồn tại ở tầng logic và R-68 cấm sửa `src/types` /
 * `src/lib` khi dựng màn, nên người duyệt đã chốt ba cột (hợp đồng, mục Đ-1) và tiêu chí
 * "đếm đúng 4" được báo cáo là trượt có chủ ý. Cột dựng bằng vòng lặp trên `AUTH_ROLES`,
 * nên không ai thêm được một cột thứ tư ở tầng màn mà tầng auth không biết.
 *
 * ## Khả năng vắng mặt thì phương thức vắng mặt
 *
 * Cổng này KHÔNG có `changeMembershipRole`. Không tầng nào của repo có đường ghi vai
 * TRONG một dự án: `UsersApi` chỉ có `changeRole` (vai hệ thống),
 * `ProjectSettingsPatch` (`screens/project/ProjectSettings/projectSettingsGateway.ts:79`)
 * không có trường `members`, và `ENDPOINTS.projects` không có đường `members` nào. Nên
 * mỗi hàng dự án của panel chi tiết mang một CÂU giải thích
 * ({@link MEMBERSHIP_ROLE_BLOCKED_REASON}) thay vì một ô chọn không đi tới đâu — cùng
 * nguyên tắc mà `VersionHistoryGateway.tagVersion?` và chín trường `false` của
 * `modelLibraryCapabilities` đã đặt: một khả năng vắng mặt là một phương thức vắng mặt,
 * chứ không phải một hàm ném lỗi (R-69).
 *
 * ## `resendInvite` nhận id của chính hàng đang chờ
 *
 * `ENDPOINTS.users.resendInvite(inviteId)` là đường DUY NHẤT gửi lại một lời mời, và
 * `AdminUserSchema` không có trường `inviteId`: một người `status: 'pending'` CHÍNH LÀ lời
 * mời — `invitedAt` và `inviteExpiresAt` chỉ có mặt trên đúng những hàng ấy
 * (`src/api/schemas/users.ts`). Nên `AdminUser.id` của một hàng chờ là mã lời mời, và cổng
 * này ghi điều đó ra thay vì để nơi gọi đoán.
 */

import type {
  AdminUser,
  AdminUserList,
  ApiResult,
  UserActivity,
  UserMembership,
  UsersApi,
} from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { EmailSchema } from '@/api/schemas';
import { AUTH_ROLES, can, permissionMatrix, type PermissionKey } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import {
  createUndoTicket,
  type CreateUndoTicketOptions,
  type UndoTicket,
} from '@/lib/mutations/undoTicket';
import type { NotificationBus, NotificationInput } from '@/lib/mutations/notificationBus';
import { createUuid } from '@/lib/http/ids';
import { queryKeys } from '@/lib/query/queryKeys';
import {
  userActivityQueryOptions,
  userMembershipsQueryOptions,
  usersListQueryOptions,
  type UserActivityQueryKey,
  type UserMembershipsQueryKey,
  type UsersListQueryKey,
  type UsersQueryOptions,
} from '@/lib/query/usersQueries';
import { createBeaconTransport, createTelemetrySender } from '@/lib/telemetry/sender';
import type { TelemetrySender } from '@/lib/telemetry/sender';
import type { TelemetryEventInput } from '@/lib/telemetry/events';
import type { ProjectRole } from '@/types/project';

import type {
  PermissionMatrixModel,
  PermissionMatrixRowModel,
  RoleOption,
  StatusOption,
  UserAccountStatus,
} from './types';

/* -------------------------------------------------------------------------- */
/* 1 — Khoá bộ nhớ đệm (R-64, R-71)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Ba khoá, lấy thẳng từ `queryKeys` chứ không khai lại.
 *
 * `createQueryClient` đã đặt `setQueryDefaults(['user'], …)` cho mọi khoá bắt đầu bằng
 * `'user'` (bậc `'static'`, `cachePolicy.ts`), nên một nhánh khoá thứ hai ở đây là một
 * chính sách cache thứ hai cho cùng một bảng — đúng thứ R-71 cấm. Cùng khuôn
 * `modelLibraryListKey` của màn anh em.
 */
export function usersListKey(): UsersListQueryKey {
  return queryKeys.user.list();
}

/** Những dự án một người tham gia. Cùng nguồn với {@link usersListKey}. */
export function userMembershipsKey(userId: string): UserMembershipsQueryKey {
  return queryKeys.user.memberships(userId);
}

/** Nhật ký hoạt động của một người. Cùng nguồn với {@link usersListKey}. */
export function userActivityKey(userId: string): UserActivityQueryKey {
  return queryKeys.user.activity(userId);
}

/* -------------------------------------------------------------------------- */
/* 2 — Vai, trạng thái, và chữ tiếng Việt của chúng                            */
/* -------------------------------------------------------------------------- */

/**
 * Nhãn tiếng Việt của ba vai (A6: viết thường, kiểu câu).
 *
 * `Record<ProjectRole, string>` chứ không một đối tượng trần: thêm một vai vào miền thì
 * bảng này KHÔNG biên dịch được nữa, nên không có cách nào để một vai lạ đi qua màn mà
 * không có chữ. Cùng hình dạng và cùng lý do với `projectRoleByWire`
 * (`src/api/schemas/users.ts`).
 */
export const ROLE_LABELS: Readonly<Record<ProjectRole, string>> = Object.freeze({
  admin: 'quản trị',
  engineer: 'kỹ sư',
  viewer: 'người xem',
});

/** Nhãn tiếng Việt của ba trạng thái tài khoản. */
export const STATUS_LABELS: Readonly<Record<UserAccountStatus, string>> = Object.freeze({
  active: 'đang hoạt động',
  pending: 'chờ chấp nhận',
  disabled: 'đã vô hiệu hoá',
});

/** Ba tuỳ chọn vai của ô lọc và của ô đổi vai, dựng từ `AUTH_ROLES`. */
export const ROLE_OPTIONS: readonly RoleOption[] = Object.freeze(
  AUTH_ROLES.map((role): RoleOption => ({ role, label: ROLE_LABELS[role] })),
);

/** Ba tuỳ chọn trạng thái của ô lọc. */
export const STATUS_OPTIONS: readonly StatusOption[] = Object.freeze(
  (Object.keys(STATUS_LABELS) as UserAccountStatus[]).map(
    (status): StatusOption => ({ status, label: STATUS_LABELS[status] }),
  ),
);

/* -------------------------------------------------------------------------- */
/* 3 — Ma trận quyền: bảy dòng × ba cột                                        */
/* -------------------------------------------------------------------------- */

interface PermissionRowSpec {
  readonly key: PermissionKey;
  readonly label: string;
}

/**
 * Bảy việc của đặc tả, mỗi việc ánh xạ sang một `PermissionKey` CÓ THẬT.
 *
 * `satisfies readonly PermissionRowSpec[]` giữ cho mọi khoá ở đây là một khoá tầng auth
 * biết: gõ sai một khoá là lỗi biên dịch tại dòng ấy, không phải một ô rỗng lúc chạy.
 * `qc.approve` và `ruleset.edit` mới được thêm vào `permissionMatrix` ở lượt T0; năm khoá
 * còn lại đã có từ trước. Ba khoá khác của repo (`project.create`, `project.settings.edit`,
 * `library.manage`) KHÔNG hiện ở đây vì đặc tả chỉ nêu bảy việc.
 */
export const PERMISSION_MATRIX_ROWS = [
  { key: 'floor.upload', label: 'tải bản vẽ' },
  { key: 'layer.edit', label: 'sửa hình học' },
  { key: 'qc.approve', label: 'duyệt QC' },
  { key: 'ruleset.edit', label: 'đổi bộ luật' },
  { key: 'model.export', label: 'xuất' },
  { key: 'share.create', label: 'chia sẻ' },
  { key: 'user.manage', label: 'quản lý người dùng' },
] as const satisfies readonly PermissionRowSpec[];

/**
 * Câu cho trình đọc màn hình của MỘT ô.
 *
 * Một dấu tích không phải văn bản, nên ô nào cũng phải nói được thành câu đầy đủ:
 * `"quản trị: được phép tải bản vẽ"` / `"người xem: không được phép xuất"`. Câu dựng từ
 * chính nhãn vai và nhãn việc, nên nó không bao giờ lệch khỏi thứ đang hiện trên màn.
 */
export function permissionCellSrLabel(
  role: ProjectRole,
  rowLabel: string,
  allowed: boolean,
): string {
  return `${ROLE_LABELS[role]}: ${allowed ? 'được phép' : 'không được phép'} ${rowLabel}`;
}

/**
 * Cả ma trận: ba cột × bảy dòng, mỗi ô đọc từ `permissionMatrix[key][role]`.
 *
 * Không một `true`/`false` nào được gõ tay ở tầng màn. Đổi chính sách của một vai là sửa
 * `src/lib/auth/permissions.ts`, và màn này đi theo mà không phải sửa dòng nào.
 */
export function buildPermissionMatrix(): PermissionMatrixModel {
  const rows = PERMISSION_MATRIX_ROWS.map(
    ({ key, label }): PermissionMatrixRowModel => ({
      key,
      label,
      cells: AUTH_ROLES.map((role) => {
        const allowed = permissionMatrix[key][role];

        return { role, allowed, srLabel: permissionCellSrLabel(role, label, allowed) };
      }),
    }),
  );

  return { columns: ROLE_OPTIONS, rows };
}

/**
 * Những việc một người MẤT khi đi từ `fromRole` sang `toRole`.
 *
 * Hiệu của hai cột trên đúng bảy khoá ở trên, đọc từ `permissionMatrix` — KHÔNG một danh
 * sách viết tay nào. Một danh sách viết tay sẽ lệch khỏi ma trận đúng vào lúc chính sách
 * đổi, và không có bài kiểm nào bắt được sự lệch ấy vì hai bên vẫn tự nhất quán.
 * Trả mảng rỗng khi vai mới không mất gì (thăng vai, hoặc đổi ngang).
 */
export function permissionsLostBetween(
  fromRole: ProjectRole,
  toRole: ProjectRole,
): readonly string[] {
  return PERMISSION_MATRIX_ROWS.filter(
    ({ key }) => permissionMatrix[key][fromRole] && !permissionMatrix[key][toRole],
  ).map(({ label }) => label);
}

/* -------------------------------------------------------------------------- */
/* 4 — Năng lực                                                                */
/* -------------------------------------------------------------------------- */

export interface UserManagementCapabilities {
  /** `can('manage', 'user', …)`. `false` thì màn hiện CHỈ ma trận quyền (trạng thái 6). */
  readonly canManageUsers: boolean;
}

/** Vai của phiên có được quản lý người dùng không — một lời gọi `can()`, không hơn. */
export function canManageUsers(roles: readonly ProjectRole[]): boolean {
  return can('manage', 'user', { roles });
}

/** Cổng năng lực đầy đủ của màn, cho một tập vai. */
export function userManagementCapabilities(
  roles: readonly ProjectRole[],
): UserManagementCapabilities {
  return { canManageUsers: canManageUsers(roles) };
}

/* -------------------------------------------------------------------------- */
/* 5 — Đường mở một đối tượng trong nhật ký hoạt động (R-65)                    */
/* -------------------------------------------------------------------------- */

/**
 * Miền của một `UserActivity.kind` ↔ tuyến mở được đối tượng ấy.
 *
 * `kind` có dạng `<miền>.<việc>` (`wall.edit`, `room.edit`, `rules.run`) — cùng từ vựng mà
 * `TELEMETRY_EVENT_NAMES` dùng. Giá trị của bảng phải lấy TỪ `ROUTES`, để không một chuỗi
 * nào bắt đầu bằng `/` được viết trong thư mục màn (R-65).
 *
 * Bảng cố tình NGẮN. Những tuyến còn lại của repo đều cần một mã dự án hoặc một mã tầng
 * (`ROUTES.project.*` là hàm), mà `UserActivitySchema` không mang mã nào trong hai thứ đó
 * — nó có `objectCode` để ĐỌC, không phải để điều hướng. Nên `wall`, `rules`, `export` và
 * `project` không có mặt ở đây và {@link activityHref} trả `null` cho chúng: một dòng
 * không mở được thì nói thẳng là không mở được, chứ không dẫn tới một trang sai.
 *
 * **Bảng nay RỖNG, và đó là kết luận của chính đoạn trên.** Chín mục cũ đều trỏ vào các
 * hằng tĩnh `/layers/*` và `/floors`, vốn cũng không mang hai mã ấy — nên không mục nào
 * trong chúng mở được đối tượng:
 *
 * - `opening`, `furniture`, `object`, `dimension`, `floor`, `level` dẫn vào `<Placeholder>`
 *   của router (`src/routes/router.tsx:332-335`), tức một `<div>Canvas</div>` rỗng — đúng
 *   cái màn trắng mà A11 tồn tại để chặn;
 * - `room`, `axis`, `grid` dẫn tới màn thật nhưng không có tham số, nên màn chỉ dựng được
 *   `InlineAlert` "Thiếu mã dự án hoặc mã tầng" — trung thực, nhưng vẫn là một trang sai
 *   cho yêu cầu "mở R-12", và người dùng không bao giờ đi tiếp được từ đó.
 *
 * Bảng ở lại (thay vì xoá hẳn cùng {@link activityHref}) vì cơ chế vẫn đúng: ngày
 * `UserActivitySchema` mang thêm mã dự án và mã tầng, mỗi miền thêm lại một dòng gọi
 * `ROUTES.project.*(projectId, floorId)`. Tới lúc đó bảng mới có gì để tra.
 *
 * Trong khi chờ, `UserManagementDetail.tsx:174-181` đã dựng sẵn nhánh `null`: mã đối tượng
 * hiện ra dạng chữ thường, không phải thẻ liên kết. Affordance rời khỏi DOM (R-69).
 */
const ROUTE_BY_ACTIVITY_DOMAIN: Readonly<Record<string, string>> = Object.freeze({});

/** Đường mở đối tượng của một dòng hoạt động, hoặc `null` khi không mở được. */
export function activityHref(kind: string): string | null {
  const [domain = ''] = kind.split('.');

  return ROUTE_BY_ACTIVITY_DOMAIN[domain] ?? null;
}

/* -------------------------------------------------------------------------- */
/* 6 — Ô nhập nhiều email                                                      */
/* -------------------------------------------------------------------------- */

/** Kết quả tách và kiểm ô nhập nhiều địa chỉ. */
export interface ParsedInviteEmails {
  readonly validEmails: readonly string[];
  readonly invalidEmails: readonly string[];
}

/**
 * Tách theo dấu phẩy HOẶC xuống dòng, rồi kiểm từng phần bằng `EmailSchema`.
 *
 * Không một biểu thức chính quy email nào được viết ở đây: `EmailSchema`
 * (`src/api/schemas/index.ts:66`) là luật đang chạy ở màn đăng nhập và ở
 * `InviteUsersSchema`, nên ô nhập này chấp nhận đúng những địa chỉ mà request sẽ chấp
 * nhận. Một địa chỉ lặp lại chỉ được đếm một lần — người dán một danh sách từ bảng tính
 * thường dán trùng, và mời hai lần cùng một người là hai dòng chờ cho một con người.
 */
export function parseInviteEmails(rawEmails: string): ParsedInviteEmails {
  const validEmails: string[] = [];
  const invalidEmails: string[] = [];

  for (const piece of rawEmails.split(/[,\n]/)) {
    const candidate = piece.trim();

    if (candidate === '') {
      continue;
    }

    const target = EmailSchema.safeParse(candidate).success ? validEmails : invalidEmails;

    if (!target.includes(candidate)) {
      target.push(candidate);
    }
  }

  return { validEmails, invalidEmails };
}

/* -------------------------------------------------------------------------- */
/* 7 — Câu giải thích của chỗ KHÔNG có đường ghi                               */
/* -------------------------------------------------------------------------- */

/**
 * Vì sao mỗi hàng dự án của panel chi tiết không đổi vai được — xem docblock đầu file.
 *
 * Đây là một câu, không phải một cờ `disabled`: đặc tả cấm "một nút vô hiệu không lý do",
 * nên chỗ duy nhất một hành động bị chặn được biểu diễn là một câu tiếng Việt tại chỗ.
 */
export const MEMBERSHIP_ROLE_BLOCKED_REASON =
  'vai trong từng dự án theo vai của hệ thống; hệ thống chưa có đường đổi riêng cho một dự án';

/* -------------------------------------------------------------------------- */
/* 8 — Đo đạc (O-01)                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Một lượt đổi vai, ở dạng người gọi viết ra.
 *
 * `Omit<…, 'name'>` chứ không một hình dạng chép tay: trường nào bắt buộc là câu trả lời
 * của `src/lib/telemetry/events.ts`, và nó đã nói rõ — **không `userId`, không địa chỉ,
 * không tên**. Cổng này không có chỗ nào để nhét một mã người dùng vào, và đó là chủ ý.
 */
export type RoleChangeMeasurement = Omit<
  Extract<TelemetryEventInput, { name: 'user.role-change' }>,
  'name'
>;

/* -------------------------------------------------------------------------- */
/* 9 — Cổng                                                                    */
/* -------------------------------------------------------------------------- */

/** Đổi vai hệ thống của đúng một người. */
export interface ChangeRoleRequest {
  readonly userId: string;
  readonly role: ProjectRole;
}

/** Mời một hoặc nhiều địa chỉ vào cùng một vai. */
export interface InviteRequest {
  readonly emails: readonly string[];
  readonly role: ProjectRole;
}

/** Xoá hẳn, kèm địa chỉ người duyệt vừa gõ lại (A9). */
export interface RemoveRequest {
  readonly userId: string;
  readonly confirmEmail: string;
}

export interface UserManagementGateway {
  readonly capabilities: UserManagementCapabilities;
  /** Người đang đăng nhập — chỗ `UserRowModel.isSelf` đọc, không phải một cờ của máy chủ. */
  readonly currentUserId: string | null;
  readonly currentUserEmail: string | null;
  /** Ba cột × bảy dòng, dựng sẵn một lần: nó không phụ thuộc vào dữ liệu nào. */
  readonly permissionMatrix: PermissionMatrixModel;
  listUsers(signal?: AbortSignal): Promise<AdminUserList>;
  readMemberships(userId: string, signal?: AbortSignal): Promise<readonly UserMembership[]>;
  readActivity(userId: string, signal?: AbortSignal): Promise<readonly UserActivity[]>;
  changeRole(request: ChangeRoleRequest): Promise<AdminUser>;
  disableUser(userId: string): Promise<AdminUser>;
  enableUser(userId: string): Promise<AdminUser>;
  inviteUsers(request: InviteRequest): Promise<readonly AdminUser[]>;
  removeUser(request: RemoveRequest): Promise<AdminUser>;
  /** `inviteId` là `AdminUser.id` của chính hàng đang chờ — xem docblock đầu file. */
  resendInvite(inviteId: string): Promise<AdminUser>;
  /** Vé hoàn tác tám giây của A8. Đồng hồ tiêm sẵn, nên bài kiểm không phải chờ thật. */
  createWriteTicket(options: CreateUndoTicketOptions): UndoTicket;
  /** Toast của A8 đi qua `notificationBus`; nút Hoàn tác là `undoTicket` của thông báo. */
  notify(input: NotificationInput): void;
  /** O-01. Không kèm dữ liệu cá nhân — xem {@link RoleChangeMeasurement}. */
  trackRoleChange(measurement: RoleChangeMeasurement): void;
  /** Mã của một dòng chờ dựng lạc quan, trước khi máy chủ trả mã thật. */
  createOptimisticId(): string;
  now(): number;
}

export interface CreateUserManagementGatewayOptions {
  /**
   * Cổng vào hẹp, cùng khuôn `usersQueries.ts`: đúng chín phương thức màn này gọi, nên
   * bài kiểm dựng chín hàm giả thay vì cả mười nhóm của `ApiClient`.
   */
  readonly usersApi: UsersApi;
  /** Vai của phiên đang mở. `canManageUsers` đọc đúng danh sách này, không đọc store. */
  readonly roles: readonly ProjectRole[];
  readonly currentUserId?: string | null;
  readonly currentUserEmail?: string | null;
  /** Bus thông báo tiêm được — story và bài kiểm cắm bus riêng, không dùng bus toàn ứng dụng. */
  readonly notifications: NotificationBus;
  /** Bộ gửi đo đạc tiêm được. Không truyền thì màn không đo — nó không tự dựng một bộ gửi. */
  readonly telemetry?: TelemetrySender;
  readonly now?: () => number;
}

/** Ném lỗi ra để `useMutation` nhìn thấy thất bại — cùng cổng lỗi mà `usersQueries` dùng. */
async function unwrap<T>(result: Promise<ApiResult<T>>): Promise<T> {
  const settled = await result;

  if (!settled.ok) {
    throw settled.error;
  }

  return settled.data;
}

/**
 * Cổng thật.
 *
 * Ba lượt đọc chạy `queryFn` của `usersQueries` với đúng ba trường mà
 * `QueryFunctionContext` bắt buộc; khi nơi gọi không đưa `signal`, một `AbortController`
 * mới đứng vào chỗ đó — cùng cách `modelLibraryGateway` xử lý cùng chỗ thiếu.
 */
export function createUserManagementGateway(
  options: CreateUserManagementGatewayOptions,
): UserManagementGateway {
  const { notifications, usersApi } = options;
  const now = options.now ?? Date.now;

  const run = async <TData, TKey extends readonly unknown[]>(
    query: UsersQueryOptions<TData, TKey>,
    signal: AbortSignal | undefined,
  ): Promise<TData> =>
    query.queryFn({
      queryKey: query.queryKey,
      signal: signal ?? new AbortController().signal,
      meta: undefined,
    });

  return {
    capabilities: userManagementCapabilities(options.roles),
    currentUserId: options.currentUserId ?? null,
    currentUserEmail: options.currentUserEmail ?? null,
    permissionMatrix: buildPermissionMatrix(),
    listUsers: async (signal?: AbortSignal): Promise<AdminUserList> =>
      run(usersListQueryOptions(usersApi), signal),
    readMemberships: async (
      userId: string,
      signal?: AbortSignal,
    ): Promise<readonly UserMembership[]> =>
      run(userMembershipsQueryOptions(usersApi, userId), signal),
    readActivity: async (userId: string, signal?: AbortSignal): Promise<readonly UserActivity[]> =>
      run(userActivityQueryOptions(usersApi, userId), signal),
    changeRole: async ({ role, userId }: ChangeRoleRequest): Promise<AdminUser> =>
      unwrap(usersApi.changeRole({ body: { role, userId } })),
    disableUser: async (userId: string): Promise<AdminUser> =>
      unwrap(usersApi.disable({ userId })),
    enableUser: async (userId: string): Promise<AdminUser> => unwrap(usersApi.enable({ userId })),
    inviteUsers: async ({ emails, role }: InviteRequest): Promise<readonly AdminUser[]> =>
      unwrap(usersApi.invite({ body: { emails: [...emails], role } })),
    removeUser: async ({ confirmEmail, userId }: RemoveRequest): Promise<AdminUser> =>
      unwrap(usersApi.remove({ body: { confirmEmail, userId } })),
    resendInvite: async (inviteId: string): Promise<AdminUser> =>
      unwrap(usersApi.resendInvite({ inviteId })),
    createWriteTicket: (ticketOptions: CreateUndoTicketOptions): UndoTicket =>
      createUndoTicket({ now, ...ticketOptions }),
    notify: (input: NotificationInput): void => {
      notifications.publish(input);
    },
    trackRoleChange: (measurement: RoleChangeMeasurement): void => {
      options.telemetry?.track({ name: 'user.role-change', ...measurement });
    },
    createOptimisticId: createUuid,
    now,
  };
}

/**
 * Cổng dựng cho ứng dụng thật — thứ container lớp 3 gọi.
 *
 * Vai và người đang đăng nhập lấy từ `getSession()`, nguồn duy nhất của phiên
 * (`src/lib/auth/session.ts:296`). Bus thông báo là bus toàn ứng dụng, cùng bus mà
 * `NotificationHost` đang vẽ.
 */
export function createAppUserManagementGateway(
  usersApi: UsersApi,
  notifications: NotificationBus,
): UserManagementGateway {
  const session = getSession();

  return createUserManagementGateway({
    usersApi,
    notifications,
    roles: session.roles,
    currentUserId: session.user?.id ?? null,
    currentUserEmail: session.user?.email ?? null,
    telemetry: createTelemetrySender({
      transport: createBeaconTransport({ url: ENDPOINTS.telemetry }),
      sessionId: createUuid(),
    }),
  });
}
