/**
 * Hợp đồng kiểu của màn quản lý người dùng (`/admin/users`).
 *
 * File này do bước `prep-contract` chốt và **không worker nào ở lớp viết được sửa nó**.
 * Bốn worker (hook, view danh sách, view chi tiết, test+story) code song song dựa vào đúng
 * các kiểu dưới đây; đổi một trường ở đây là làm hỏng ba nhánh còn lại.
 *
 * ## Ba quyết định đã chốt, ghi ở đây để không ai phải đi tìm
 *
 * 1. **BA vai, không phải bốn.** `ProjectRole = 'admin' | 'engineer' | 'viewer'`
 *    (`src/types/project.ts:1`), dùng ở 192 chỗ trong 71 file. Đặc tả đòi bốn vai
 *    (Quản trị · Kỹ sư QC · Kiến trúc sư · Người xem) nhưng vai thứ tư không tồn tại ở
 *    tầng logic, và R-68 cấm sửa `src/lib` / `src/types` khi dựng màn. Người duyệt đã chọn:
 *    ma trận có **ba cột**, và tiêu chí nghiệm thu "đếm đúng 4" được báo cáo là **trượt có
 *    chủ ý**. Vai lấy từ `AUTH_ROLES`, không gõ tay ở đây.
 *
 * 2. **Hành động bị chặn mang theo LÝ DO, không phải một cờ `disabled`.** Mọi trường
 *    `…BlockedReason` là `string | null`: `null` nghĩa là làm được, chuỗi là câu tiếng Việt
 *    hiện tại chỗ. Đặc tả cấm "một nút vô hiệu không lý do", nên kiểu dữ liệu ở đây không
 *    cho phép biểu diễn một nút như thế. Ba chỗ bị chặn: tự hạ vai của chính mình, gỡ hoặc
 *    hạ vai Quản trị cuối cùng, và xoá hẳn (chỗ này không chặn mà bắt gõ đúng email).
 *
 * 3. **A15 — định dạng số và thời gian xảy ra ở viewmodel, không ở view.** Mọi thứ người
 *    đọc nhìn thấy đều đã là `string` ở đây (`projectCountLabel`, `lastActiveLabel`,
 *    `userCountLabel`). View chỉ đặt chúng vào ô: không `toFixed`, không `toLocaleString`,
 *    không tự quy đổi. `local/no-raw-number` chặn ở mức `error`. Dấu thập phân là dấu phẩy.
 *
 * ## Thời gian: `formatTimestamp` và giới hạn đã biết của nó
 *
 * `src/lib/format/datetime.ts:184` trả `vừa xong` (< 1 phút), `12 phút trước` (< 1 giờ),
 * rồi chuyển sang tuyệt đối (`14:32`, `03/08/2026 14:32`). Nó **không có** chế độ
 * luôn-tương-đối. Đặc tả muốn cột "lần hoạt động cuối" luôn tương đối; với mốc cũ hơn một
 * giờ ô sẽ hiện ngày giờ tuyệt đối. Đó là **lệch có chủ ý**: R-61 cấm viết công thức thời
 * gian mới trong thư mục màn, nên muốn luôn-tương-đối thì phải là một prompt logic riêng.
 * `lastActiveExactLabel` là mốc đầy đủ cho tooltip.
 *
 * ## Màu không bao giờ là kênh duy nhất
 *
 * Vai và trạng thái đều có `…Label` bằng chữ. `Badge` của repo có bốn biến thể
 * (`verified` · `attention` · `violation` · `neutral`); màn này dùng **`neutral`** cho cả
 * vai lẫn trạng thái. Hai lý do, cả hai đều bắt buộc: đặc tả cấm truyền đạt vai bằng màu
 * (không đỏ cho Người xem, không đỏ cho trạng thái chờ), và bất biến A5 giữ màu xanh
 * "đã xác minh" **chỉ** cho việc người duyệt xác nhận — một tài khoản đang hoạt động không
 * phải một thứ đã được ai đó duyệt.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

/* ── Vai, trạng thái, lựa chọn lọc ────────────────────────────────────────────────────── */

/** Trạng thái một tài khoản. Khớp `AdminUserStatus` của `src/api/schemas/users.ts`. */
export type UserAccountStatus = 'active' | 'pending' | 'disabled';

/** Giá trị "tất cả" của hai ô lọc — không phải một vai, không phải một trạng thái. */
export const FILTER_ALL = 'all';

export type RoleFilter = ProjectRole | typeof FILTER_ALL;
export type StatusFilter = UserAccountStatus | typeof FILTER_ALL;

export interface RoleOption {
  readonly role: ProjectRole;
  /** `quản trị` · `kỹ sư` · `người xem` — viết thường, kiểu câu (A6). */
  readonly label: string;
}

export interface StatusOption {
  readonly status: UserAccountStatus;
  /** `đang hoạt động` · `chờ chấp nhận` · `đã vô hiệu hoá`. */
  readonly label: string;
}

/* ── Ma trận quyền ────────────────────────────────────────────────────────────────────── */

/**
 * Một ô của ma trận. `srLabel` tồn tại vì một dấu tích không phải văn bản: trình đọc màn
 * hình cần nghe "quản trị: được phép tải bản vẽ", không phải nghe một ký tự hình học.
 */
export interface PermissionMatrixCell {
  readonly role: ProjectRole;
  readonly allowed: boolean;
  readonly srLabel: string;
}

export interface PermissionMatrixRowModel {
  /** `PermissionKey` thật của `src/lib/auth/permissions.ts`, ví dụ `floor.upload`. */
  readonly key: string;
  /** `tải bản vẽ` · `sửa hình học` · `duyệt QC` · … */
  readonly label: string;
  readonly cells: readonly PermissionMatrixCell[];
}

/**
 * Bảy dòng, ba cột. Giá trị ô lấy từ `permissionMatrix` của tầng auth — **không** gõ tay
 * bảng true/false ở tầng màn, vì đó chính là "tự định nghĩa lại bộ quyền" mà đặc tả cấm.
 */
export interface PermissionMatrixModel {
  readonly columns: readonly RoleOption[];
  readonly rows: readonly PermissionMatrixRowModel[];
}

/* ── Một hàng người dùng ──────────────────────────────────────────────────────────────── */

export interface UserRowModel {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatarUrl?: string;
  readonly role: ProjectRole;
  readonly roleLabel: string;
  readonly status: UserAccountStatus;
  readonly statusLabel: string;
  /** Qua `formatNumber`. */
  readonly projectCountLabel: string;
  /** Qua `formatTimestamp` — xem docblock đầu file về giới hạn của nó. */
  readonly lastActiveLabel: string;
  /** Mốc đầy đủ cho tooltip. */
  readonly lastActiveExactLabel: string;
  /** Người đang đăng nhập. Dùng để chặn tự hạ vai chính mình. */
  readonly isSelf: boolean;
  /** Lời mời đã quá `inviteExpiresAt` — hiện chấm cần chú ý. */
  readonly inviteExpired: boolean;
  readonly canResendInvite: boolean;
  /** Vừa đổi vai xong: nền hàng nháy 340 ms (`MOTION_DURATIONS_MS`, không phải 400). */
  readonly justChanged: boolean;
  /** `null` = đổi được. Chuỗi = câu giải thích tại chỗ. Xem quyết định 2 ở đầu file. */
  readonly roleChangeBlockedReason: string | null;
  readonly disableBlockedReason: string | null;
  readonly removeBlockedReason: string | null;
}

/* ── Panel chi tiết ───────────────────────────────────────────────────────────────────── */

export interface UserMembershipRowModel {
  readonly projectId: string;
  readonly projectName: string;
  readonly role: ProjectRole;
  readonly roleLabel: string;
  readonly roleChangeBlockedReason: string | null;
}

export interface UserActivityRowModel {
  readonly id: string;
  /** Việc đã làm, tiếng Việt viết thường. */
  readonly kindLabel: string;
  readonly atLabel: string;
  readonly atExactLabel: string;
  /** Mã đối tượng, hiện bằng chữ đều khi trỏ vào dòng. */
  readonly objectCode: string;
  readonly objectLabel: string;
  /** Dựng từ `@/routes/paths`. `null` khi đối tượng không còn mở được. R-65 cấm chuỗi thô. */
  readonly objectHref: string | null;
}

export interface UserDetailModel {
  readonly user: UserRowModel;
  readonly memberships: readonly UserMembershipRowModel[];
  /** Mười thao tác gần nhất. */
  readonly activities: readonly UserActivityRowModel[];
}

/* ── Thanh công cụ và dải tóm tắt ─────────────────────────────────────────────────────── */

export interface ToolbarModel {
  readonly search: string;
  readonly roleFilter: RoleFilter;
  readonly statusFilter: StatusFilter;
  readonly roleOptions: readonly RoleOption[];
  readonly statusOptions: readonly StatusOption[];
  readonly canInvite: boolean;
  readonly inviteBlockedReason: string | null;
}

export interface SummaryModel {
  readonly userCountLabel: string;
  readonly adminCountLabel: string;
  readonly pendingInviteCountLabel: string;
}

/* ── Mời người dùng ───────────────────────────────────────────────────────────────────── */

/**
 * Ô nhập nhiều email. Phải là `Textarea`, **không** phải `Combobox`: `Combobox` của repo chỉ
 * bắn `onChange` khi người dùng chọn một tuỳ chọn có sẵn, nên nó không bao giờ nhận được
 * một địa chỉ gõ tay. Kiểm ngay khi gõ; ngăn cách bằng dấu phẩy hoặc xuống dòng.
 */
export interface InviteFormModel {
  readonly isOpen: boolean;
  readonly rawEmails: string;
  readonly validEmails: readonly string[];
  readonly invalidEmails: readonly string[];
  readonly role: ProjectRole;
  readonly canSubmit: boolean;
  readonly hintLabel: string;
  readonly errorLabel: string | null;
  readonly isSubmitting: boolean;
}

/* ── Xoá hẳn ──────────────────────────────────────────────────────────────────────────── */

/**
 * Xoá hẳn là hành động **thật sự không đảo được** — nó gỡ luôn phần ghi công trong lịch sử
 * — nên A9 bắt hỏi trước, và đặc tả bắt gõ đúng email. Vô hiệu hoá thì ngược lại: đảo được
 * và tức thì, nên nó **không** đi qua kiểu này.
 */
export interface RemoveConfirmModel {
  readonly user: UserRowModel | null;
  readonly typedEmail: string;
  readonly isMatch: boolean;
  readonly warningLabel: string;
  readonly canConfirm: boolean;
}

/* ── Breadcrumb dựng trong màn ────────────────────────────────────────────────────────── */

/**
 * `src/components/shell/Breadcrumb.tsx` có `aria-label="Breadcrumb"` bằng tiếng Anh nên nó
 * không qua `expectVietnamese` (R-72). Màn này tự dựng breadcrumb bằng phần tử thường —
 * việc đó **không** vi phạm "không tạo component mới", vì lệnh cấm ấy nhắm `src/components`.
 */
export interface BreadcrumbItemModel {
  readonly label: string;
  /** `null` cho mục cuối (trang hiện tại). Dựng từ `@/routes/paths`. */
  readonly href: string | null;
}

/* ── Viewmodel tổng ───────────────────────────────────────────────────────────────────── */

export interface UserManagementViewModel {
  readonly state: SevenState;
  readonly isCollapsed: boolean;
  /**
   * `false` thì màn hiện **chỉ ma trận quyền** kèm giải thích thường và liên kết quay lại —
   * không danh sách người, và không phải một trang 403 trơ trọi (trạng thái `forbidden`).
   */
  readonly canManageUsers: boolean;
  readonly breadcrumbItems: readonly BreadcrumbItemModel[];
  readonly toolbar: ToolbarModel;
  readonly summary: SummaryModel;
  readonly rows: readonly UserRowModel[];
  /** Tám, theo đặc tả. Hằng nằm ở hook, không ở view. */
  readonly skeletonRowCount: number;
  readonly selectedUserId: string | null;
  readonly detail: UserDetailModel | null;
  readonly permissionMatrix: PermissionMatrixModel;
  /** Ma trận mở được từ đầu trang, ngoài chỗ của nó ở đáy panel chi tiết. */
  readonly isPermissionReferenceOpen: boolean;
  readonly invite: InviteFormModel;
  readonly removeConfirm: RemoveConfirmModel;
  readonly errorLabel: string | null;
  /** Câu dạy việc của trạng thái rỗng: một người thì mời đội thế nào. */
  readonly emptyTeachingLabel: string;
  readonly forbiddenLabel: string;
  readonly backLink: BreadcrumbItemModel;
}

/* ── Hành động ────────────────────────────────────────────────────────────────────────── */

/**
 * Đổi vai **không có hộp thoại**: gọi thẳng, đổi ngay trên giao diện (D-04), xác nhận với
 * máy chủ, kèm vé hoàn tác (D-05). Toast phải nói rõ người đó **mất những gì** khi vai mới
 * ít quyền hơn vai cũ — hiệu tính từ `permissionMatrix`, không gõ tay.
 */
export interface UserManagementActions {
  readonly onSearchChange: (value: string) => void;
  readonly onRoleFilterChange: (value: RoleFilter) => void;
  readonly onStatusFilterChange: (value: StatusFilter) => void;
  readonly onSelectUser: (userId: string | null) => void;
  readonly onChangeRole: (userId: string, role: ProjectRole) => void;
  readonly onChangeMembershipRole: (
    userId: string,
    projectId: string,
    role: ProjectRole,
  ) => void;
  readonly onDisableUser: (userId: string) => void;
  readonly onEnableUser: (userId: string) => void;
  readonly onResendInvite: (userId: string) => void;
  readonly onOpenInvite: () => void;
  readonly onCloseInvite: () => void;
  readonly onInviteEmailsChange: (rawEmails: string) => void;
  readonly onInviteRoleChange: (role: ProjectRole) => void;
  readonly onSubmitInvite: () => void;
  readonly onOpenRemove: (userId: string) => void;
  readonly onCloseRemove: () => void;
  readonly onRemoveEmailChange: (value: string) => void;
  readonly onConfirmRemove: () => void;
  readonly onOpenPermissionReference: () => void;
  readonly onClosePermissionReference: () => void;
  readonly onRetry: () => void;
}

/* ── Props của view và các file con ───────────────────────────────────────────────────── */

export interface UserManagementProps {
  readonly model: UserManagementViewModel;
  readonly actions: UserManagementActions;
}

export interface UserManagementToolbarProps {
  readonly toolbar: ToolbarModel;
  readonly summary: SummaryModel;
  readonly invite: InviteFormModel;
  readonly actions: UserManagementActions;
}

export interface UserManagementTableProps {
  readonly rows: readonly UserRowModel[];
  readonly roleOptions: readonly RoleOption[];
  readonly state: SevenState;
  readonly skeletonRowCount: number;
  readonly isCollapsed: boolean;
  readonly selectedUserId: string | null;
  readonly actions: UserManagementActions;
}

export interface UserManagementDetailProps {
  readonly detail: UserDetailModel | null;
  readonly roleOptions: readonly RoleOption[];
  readonly permissionMatrix: PermissionMatrixModel;
  readonly removeConfirm: RemoveConfirmModel;
  readonly isCollapsed: boolean;
  readonly actions: UserManagementActions;
}

export interface UserManagementPermissionMatrixProps {
  readonly matrix: PermissionMatrixModel;
  readonly captionLabel: string;
}
