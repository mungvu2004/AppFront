/**
 * T6 — vỏ màn quản lý người dùng (`/admin/users`). View thuần (R-60, mục D): mọi dữ liệu
 * qua `UserManagementProps`, không chạm store/mạng, không tự nuôi `isLoading`/`error`.
 *
 * Bảy trạng thái A11 rẽ nhánh ở đây. "không có quyền" khác hẳn "một phần" hay "thành công":
 * ở `forbidden` màn hiện CHỈ ma trận quyền — không thanh công cụ, không danh sách người —
 * kèm giải thích và một liên kết quay lại, để nó không phải một trang 403 trơ trọi (Đ-7).
 * Sáu trạng thái còn lại dùng chung một khung: breadcrumb + nút tham chiếu quyền ở đầu
 * trang, thanh công cụ, rồi vùng nội dung (khung xương lúc `loading`, `EmptyState` lúc
 * `empty`, `InlineAlert` lúc `error`, bảng người dùng cho `partial`/`success`/`collapsed`).
 *
 * ## Hai component đến từ một nhánh khác
 *
 * `UserManagementDetail` và `UserManagementPermissionMatrix` thuộc phạm vi của T7, viết
 * song song trên nhánh riêng. File này nhập đúng tên và đúng chữ ký
 * (`UserManagementDetailProps`, `UserManagementPermissionMatrixProps` trong `./types`) từ
 * trước khi hai file kia tồn tại — không tự viết, không thay bằng stub — nên tới lượt kiểm
 * của nhánh này `pnpm typecheck` báo đúng hai lỗi "Cannot find module" ở hai dòng nhập dưới
 * đây. Lỗi ấy đã dự kiến tan khi lớp gộp (T9) ghép các nhánh lại.
 *
 * ## Ma trận quyền có HAI chỗ mở được
 *
 * Đặc tả bắt ma trận "mở được từ đầu trang, ngoài chỗ của nó ở đáy panel" — panel chi tiết
 * (T7) có bản của riêng nó; bản ở đây là một `Modal` độc lập, bật/tắt bằng
 * `model.isPermissionReferenceOpen` + `actions.onOpen/ClosePermissionReference`, không phụ
 * thuộc việc có đang mở panel chi tiết hay không.
 */
import { ShieldCheck, UserPlus } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

import { UserManagementDetail } from './UserManagementDetail';
import { UserManagementPermissionMatrix } from './UserManagementPermissionMatrix';
import { UserManagementTable } from './UserManagementTable';
import { UserManagementToolbar } from './UserManagementToolbar';
import type {
  BreadcrumbItemModel,
  UserManagementActions,
  UserManagementProps,
  UserManagementViewModel,
} from './types';

const SCREEN_CONTAINER_CLASS = 'mx-auto flex w-full max-w-[1080px] flex-col gap-4 p-6';
const BREADCRUMB_NAV_LABEL = 'đường dẫn trang';
const PERMISSION_REFERENCE_BUTTON_LABEL = 'Xem ma trận quyền';
const PERMISSION_REFERENCE_MODAL_TITLE = 'Ma trận quyền theo vai trò';
const PERMISSION_MATRIX_CAPTION = 'ma trận quyền theo vai trò';
const EMPTY_TITLE = 'chưa có người dùng nào khác';
const INVITE_BUTTON_LABEL = 'Mời người dùng';
const ERROR_TITLE = 'không tải được danh sách người dùng';
const GENERIC_ERROR_MESSAGE = 'Đã có lỗi xảy ra.';
const RETRY_BUTTON_LABEL = 'Thử lại';
const MODAL_WIDTH = 720;

function BreadcrumbLink({ item }: { readonly item: BreadcrumbItemModel }) {
  if (item.href === null) {
    return (
      <span aria-current="page" className="text-text-primary">
        {item.label}
      </span>
    );
  }

  return (
    <a className="hover:text-text-primary hover:underline" href={item.href}>
      {item.label}
    </a>
  );
}

function UserManagementBreadcrumb({ items }: { readonly items: readonly BreadcrumbItemModel[] }) {
  return (
    <nav aria-label={BREADCRUMB_NAV_LABEL} className="text-[13px] text-text-secondary">
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => (
          <li className="flex items-center gap-1.5" key={item.label}>
            {index > 0 && <span aria-hidden="true">›</span>}
            <BreadcrumbLink item={item} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function renderContent(model: UserManagementViewModel, actions: UserManagementActions) {
  if (model.state === 'empty') {
    return (
      <EmptyState
        action={{ label: INVITE_BUTTON_LABEL, onClick: actions.onOpenInvite }}
        description={model.emptyTeachingLabel}
        icon={<UserPlus aria-hidden="true" />}
        title={EMPTY_TITLE}
      />
    );
  }

  if (model.state === 'error') {
    return (
      <InlineAlert
        action={{ label: RETRY_BUTTON_LABEL, onClick: actions.onRetry }}
        level="violation"
        message={model.errorLabel ?? GENERIC_ERROR_MESSAGE}
        title={ERROR_TITLE}
      />
    );
  }

  return (
    <UserManagementTable
      actions={actions}
      isCollapsed={model.isCollapsed}
      roleOptions={model.toolbar.roleOptions}
      rows={model.rows}
      selectedUserId={model.selectedUserId}
      skeletonRowCount={model.skeletonRowCount}
      state={model.state}
    />
  );
}

export function UserManagement({ model, actions }: UserManagementProps) {
  if (model.state === 'forbidden') {
    return (
      <div className={SCREEN_CONTAINER_CLASS}>
        <UserManagementBreadcrumb items={model.breadcrumbItems} />
        <InlineAlert level="attention" message={model.forbiddenLabel} />
        <UserManagementPermissionMatrix captionLabel={PERMISSION_MATRIX_CAPTION} matrix={model.permissionMatrix} />
        <BreadcrumbLink item={model.backLink} />
      </div>
    );
  }

  return (
    <div className={SCREEN_CONTAINER_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <UserManagementBreadcrumb items={model.breadcrumbItems} />
        <Button
          iconBefore={<ShieldCheck aria-hidden="true" size={16} />}
          onClick={actions.onOpenPermissionReference}
          size="sm"
          variant="secondary"
        >
          {PERMISSION_REFERENCE_BUTTON_LABEL}
        </Button>
      </div>

      <UserManagementToolbar actions={actions} invite={model.invite} summary={model.summary} toolbar={model.toolbar} />

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{renderContent(model, actions)}</div>
        {model.detail !== null && (
          <UserManagementDetail
            actions={actions}
            detail={model.detail}
            isCollapsed={model.isCollapsed}
            permissionMatrix={model.permissionMatrix}
            removeConfirm={model.removeConfirm}
            roleOptions={model.toolbar.roleOptions}
          />
        )}
      </div>

      <Modal
        isOpen={model.isPermissionReferenceOpen}
        onClose={actions.onClosePermissionReference}
        title={PERMISSION_REFERENCE_MODAL_TITLE}
        width={MODAL_WIDTH}
      >
        <UserManagementPermissionMatrix captionLabel={PERMISSION_MATRIX_CAPTION} matrix={model.permissionMatrix} />
      </Modal>
    </div>
  );
}
