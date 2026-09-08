/**
 * `/admin/users` — quản lý người dùng. Đường nhập duy nhất của thư mục này.
 *
 * - {@link UserManagementContainer} là màn ĐÃ NỐI: một màn khác chỉ cần
 *   `<UserManagementContainer />` là mở được, không phải viết thêm một dòng logic người
 *   dùng nào (R-73). Hai đường ra ngoài — `onNavigateBack` và `onToast` — đều có mặc định
 *   chạy thật, nên "không truyền gì" vẫn là một màn dùng được.
 * - {@link UserManagementRoute} là thứ `src/routes/router.tsx` mount; nó là nơi bắc
 *   `useNavigate` vào `onNavigateBack`.
 * - {@link UserManagement} là markup thuần, cho story và bài kiểm (mục D, R-60).
 * - {@link useUserManagement} là toàn bộ logic, cho ai muốn dựng một vỏ khác.
 * - {@link createUserManagementGateway} là cửa vào DUY NHẤT tới dữ liệu người dùng, tới
 *   tầng quyền và tới ma trận quyền.
 *
 * Kiểu công khai có đúng **một** nơi định nghĩa — `./types`, hợp đồng đông cứng mà bốn
 * worker viết song song cùng nhập — nên barrel này chỉ tái xuất, không chép lại hình dạng.
 *
 * Bốn file anh em (`UserManagementToolbar`, `UserManagementTable`, `UserManagementDetail`,
 * `UserManagementPermissionMatrix`) **không** ra khỏi thư mục: chúng là phần con của một
 * màn, không phải component dùng chung — "không tạo component mới" nhắm `src/components`,
 * và R-59 cho phép file con trong thư mục màn.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { UserManagement } from './UserManagement';

export { UserManagementContainer, UserManagementRoute } from './UserManagement.container';
export type { UserManagementContainerProps } from './UserManagement.container';

export {
  COLLAPSE_BREAKPOINT_PX,
  USER_MANAGEMENT_TEXT,
  USER_MANAGEMENT_UNDO_WINDOW_MS,
  useUserManagement,
} from './useUserManagement';
export type { UseUserManagementOptions, UserManagementResult } from './useUserManagement';

export {
  MEMBERSHIP_ROLE_BLOCKED_REASON,
  PERMISSION_MATRIX_ROWS,
  ROLE_LABELS,
  ROLE_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  activityHref,
  buildPermissionMatrix,
  canManageUsers,
  createAppUserManagementGateway,
  createUserManagementGateway,
  parseInviteEmails,
  permissionCellSrLabel,
  permissionsLostBetween,
  userActivityKey,
  userManagementCapabilities,
  userMembershipsKey,
  usersListKey,
} from './userManagementGateway';
export type {
  ChangeRoleRequest,
  CreateUserManagementGatewayOptions,
  InviteRequest,
  ParsedInviteEmails,
  RemoveRequest,
  RoleChangeMeasurement,
  UserManagementCapabilities,
  UserManagementGateway,
} from './userManagementGateway';

export { FILTER_ALL } from './types';
export type {
  BreadcrumbItemModel,
  InviteFormModel,
  PermissionMatrixCell,
  PermissionMatrixModel,
  PermissionMatrixRowModel,
  RemoveConfirmModel,
  RoleFilter,
  RoleOption,
  StatusFilter,
  StatusOption,
  SummaryModel,
  ToolbarModel,
  UserAccountStatus,
  UserActivityRowModel,
  UserDetailModel,
  UserManagementActions,
  UserManagementDetailProps,
  UserManagementPermissionMatrixProps,
  UserManagementProps,
  UserManagementTableProps,
  UserManagementToolbarProps,
  UserManagementViewModel,
  UserMembershipRowModel,
  UserRowModel,
} from './types';
