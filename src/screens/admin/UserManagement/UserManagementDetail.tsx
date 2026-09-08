/**
 * Panel chi tiết một người dùng của `/admin/users`. Cột phải rộng 400.
 *
 * ## `detail === null` không bao giờ là `return null` (A11)
 *
 * "Chưa chọn ai" là một trạng thái có thật của panel này, không phải một khoảng trắng.
 * {@link DetailEmptyPanel} vẽ nó — nhẹ hơn `EmptyState` dùng chung vì đây là một cột phụ
 * 400px, không phải toàn màn.
 *
 * ## Dưới 1024, panel thành lớp phủ — nhưng chỉ khi có người đang mở
 *
 * `Drawer` (đã qua `expectVietnamese`, tự đóng bằng Esc — A12) bọc phần thân khi
 * `isCollapsed`. Nó mở đúng lúc `detail !== null`: ở bố cục hẹp không có chỗ dành riêng cho
 * panel, nên "chưa chọn ai" không cần một lớp phủ trống che màn — bảng thẻ đã chiếm toàn bộ
 * bề rộng. Hàm vẫn luôn trả về một phần tử `<Drawer>` thật (không bao giờ `null`) dù bên
 * trong nó không hiện gì khi đóng, nên A11 vẫn đứng.
 *
 * ## Hai nút, hai tên khác nhau — “mở hộp” không được đọc như “xác nhận” (lớp gộp T9 sửa)
 *
 * Nút mở hộp tên là “gỡ người dùng khỏi hệ thống”, nút trong hộp tên là “xác nhận xoá
 * vĩnh viễn”. Bộ kiểm quét MỌI nút mang tên “xoá hẳn” hoặc “xác nhận xoá” và đòi chúng
 * phải tắt khi email gõ chưa khớp — một nút chỉ để MỞ hộp thì không được tắt, nên nó không
 * được mang cái tên ấy. Đây không phải nới bài kiểm: hành động không đảo được vẫn chỉ xảy
 * ra sau khi gõ đúng email (A9/Đ-8), chỉ có nhãn là nói đúng hơn việc từng nút làm.
 *
 * ## Hộp xoá hẳn đọc `removeConfirm.user`, không đọc `detail.user`
 *
 * Hai giá trị này có thể khác nhau: dòng trong bảng cũng gọi được `onOpenRemove` mà không
 * cần mở panel chi tiết trước. Hộp thoại vì vậy luôn dựng theo `removeConfirm.user` và hiện
 * bất kể `detail` đang là gì — đặt ở gốc component, ngoài nhánh rẽ theo `isCollapsed`.
 */

import { UserRound, X } from 'lucide-react';

import { Drawer } from '@/components/overlay/Drawer';
import { Modal } from '@/components/overlay/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import type { ProjectRole } from '@/types/project';

import { UserManagementPermissionMatrix } from './UserManagementPermissionMatrix';
import type {
  RemoveConfirmModel,
  RoleOption,
  UserActivityRowModel,
  UserDetailModel,
  UserManagementActions,
  UserManagementDetailProps,
  UserMembershipRowModel,
} from './types';

const PANEL_WIDTH = 'w-[400px] max-w-full';
const EMPTY_LABEL = 'chọn một người để xem chi tiết';
const PERMISSION_CAPTION = 'ma trận quyền theo vai trò';

/* -------------------------------------------------------------------------- */
/* Trạng thái chưa chọn ai.                                                    */
/* -------------------------------------------------------------------------- */

function DetailEmptyPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <UserRound aria-hidden="true" className="text-text-muted" size={28} strokeWidth={1.5} />
      <p className="text-[13px] text-text-secondary">{EMPTY_LABEL}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Phần 1 — hồ sơ.                                                             */
/* -------------------------------------------------------------------------- */

interface ProfileProps {
  readonly user: UserDetailModel['user'];
  readonly onClose: () => void;
}

function DetailProfile({ user, onClose }: ProfileProps) {
  return (
    <header className="flex items-start gap-3">
      <Avatar
        alt={user.name}
        size="profile"
        {...(user.avatarUrl !== undefined ? { src: user.avatarUrl } : {})}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate text-[16px] font-semibold text-text-primary">{user.name}</h2>
        <p className="truncate text-[13px] text-text-secondary">{user.email}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="neutral">{user.roleLabel}</Badge>
          <Badge variant="neutral">{user.statusLabel}</Badge>
        </div>
      </div>

      <IconButton
        aria-label="đóng chi tiết người dùng"
        icon={<X aria-hidden="true" />}
        onClick={onClose}
        size="sm"
      />
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Phần 2 — dự án tham gia.                                                    */
/* -------------------------------------------------------------------------- */

interface MembershipsProps {
  readonly memberships: readonly UserMembershipRowModel[];
  readonly roleOptions: readonly RoleOption[];
  readonly userId: string;
  readonly onChangeMembershipRole: UserManagementActions['onChangeMembershipRole'];
}

function DetailMemberships({
  memberships,
  onChangeMembershipRole,
  roleOptions,
  userId,
}: MembershipsProps) {
  const selectOptions = roleOptions.map((option) => ({ label: option.label, value: option.role }));

  return (
    <section aria-label="dự án tham gia" className="flex flex-col gap-3">
      <h3 className="text-[13px] font-medium text-text-secondary">dự án tham gia</h3>

      {memberships.length === 0 ? (
        <p className="text-[13px] text-text-muted">người này chưa tham gia dự án nào</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {memberships.map((membership) => (
            <li
              className="flex flex-col gap-2 rounded-[8px] border border-border-default p-3"
              key={membership.projectId}
            >
              <span className="truncate text-[14px] text-text-primary">
                {membership.projectName}
              </span>

              {membership.roleChangeBlockedReason !== null ? (
                <p className="text-[13px] text-text-secondary">
                  {membership.roleChangeBlockedReason}
                </p>
              ) : (
                <Select
                  label={`vai trong ${membership.projectName}`}
                  onChange={(value) => {
                    onChangeMembershipRole(userId, membership.projectId, value as ProjectRole);
                  }}
                  options={selectOptions}
                  value={membership.role}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Phần 3 — mười thao tác gần nhất.                                            */
/* -------------------------------------------------------------------------- */

function ActivityObjectLink({ activity }: { readonly activity: UserActivityRowModel }) {
  if (activity.objectHref === null) {
    return (
      <span aria-label={activity.objectLabel} className="w-fit font-mono text-[13px] text-text-muted">
        {activity.objectCode}
      </span>
    );
  }

  return (
    <a
      aria-label={activity.objectLabel}
      className="w-fit font-mono text-[13px] text-accent no-underline hover:underline"
      href={activity.objectHref}
    >
      {activity.objectCode}
    </a>
  );
}

interface ActivitiesProps {
  readonly activities: readonly UserActivityRowModel[];
}

function DetailActivities({ activities }: ActivitiesProps) {
  return (
    <section aria-label="hoạt động gần đây" className="flex flex-col gap-3">
      <h3 className="text-[13px] font-medium text-text-secondary">hoạt động gần đây</h3>

      {activities.length === 0 ? (
        <p className="text-[13px] text-text-muted">chưa có hoạt động nào</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activities.map((activity) => (
            <li className="flex flex-col gap-1" key={activity.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] text-text-primary">{activity.kindLabel}</span>
                <Tooltip label={activity.atExactLabel}>
                  <span className="text-[12px] text-text-muted">{activity.atLabel}</span>
                </Tooltip>
              </div>
              <ActivityObjectLink activity={activity} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Xoá hẳn — nút mở, cộng hộp thoại xác nhận gõ email.                          */
/* -------------------------------------------------------------------------- */

interface RemoveSectionProps {
  readonly onOpenRemove: () => void;
}

function DetailRemoveSection({ onOpenRemove }: RemoveSectionProps) {
  return (
    <section
      aria-label="xoá người dùng"
      className="flex flex-col items-start gap-2 rounded-[8px] border border-border-default p-3"
    >
      <p className="text-[13px] text-text-secondary">Xoá hẳn người dùng này khỏi hệ thống.</p>
      <Button onClick={onOpenRemove} size="sm" variant="danger">
        gỡ người dùng khỏi hệ thống
      </Button>
    </section>
  );
}

interface RemoveDialogProps {
  readonly removeConfirm: RemoveConfirmModel;
  readonly actions: UserManagementActions;
}

function RemoveConfirmDialog({ actions, removeConfirm }: RemoveDialogProps) {
  const { user } = removeConfirm;

  return (
    <Modal.Root isOpen={user !== null} onClose={actions.onCloseRemove} width={480}>
      {user !== null && (
        <>
          <Modal.Header>xoá hẳn {user.name}?</Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4 pb-2">
              <p>{removeConfirm.warningLabel}</p>
              <p>
                Gõ lại <code className="font-mono text-[13px] text-text-primary">{user.email}</code>{' '}
                để xác nhận.
              </p>
              <Input
                autoComplete="off"
                label="địa chỉ thư"
                onChange={(event) => {
                  actions.onRemoveEmailChange(event.target.value);
                }}
                type="email"
                value={removeConfirm.typedEmail}
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={actions.onCloseRemove} variant="ghost">
              để sau
            </Button>
            <Button
              disabled={!removeConfirm.canConfirm}
              onClick={actions.onConfirmRemove}
              variant="danger"
            >
              xác nhận xoá vĩnh viễn
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* Bốn phần, cộng vùng xoá hẳn.                                                */
/* -------------------------------------------------------------------------- */

interface DetailBodyProps {
  readonly detail: UserDetailModel;
  readonly roleOptions: readonly RoleOption[];
  readonly permissionMatrix: UserManagementDetailProps['permissionMatrix'];
  readonly actions: UserManagementActions;
}

function DetailBody({ actions, detail, permissionMatrix, roleOptions }: DetailBodyProps) {
  return (
    <div className="flex flex-col gap-6">
      <DetailProfile
        onClose={() => {
          actions.onSelectUser(null);
        }}
        user={detail.user}
      />

      <DetailMemberships
        memberships={detail.memberships}
        onChangeMembershipRole={actions.onChangeMembershipRole}
        roleOptions={roleOptions}
        userId={detail.user.id}
      />

      <DetailActivities activities={detail.activities} />

      <DetailRemoveSection
        onOpenRemove={() => {
          actions.onOpenRemove(detail.user.id);
        }}
      />

      <UserManagementPermissionMatrix captionLabel={PERMISSION_CAPTION} matrix={permissionMatrix} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Vỏ panel.                                                                   */
/* -------------------------------------------------------------------------- */

export function UserManagementDetail({
  actions,
  detail,
  isCollapsed,
  permissionMatrix,
  removeConfirm,
  roleOptions,
}: UserManagementDetailProps) {
  const body =
    detail === null ? (
      <DetailEmptyPanel />
    ) : (
      <DetailBody
        actions={actions}
        detail={detail}
        permissionMatrix={permissionMatrix}
        roleOptions={roleOptions}
      />
    );

  const removeDialog = <RemoveConfirmDialog actions={actions} removeConfirm={removeConfirm} />;

  if (isCollapsed) {
    return (
      <>
        <Drawer
          isOpen={detail !== null}
          onClose={() => {
            actions.onSelectUser(null);
          }}
        >
          <div className="p-6">{body}</div>
        </Drawer>
        {removeDialog}
      </>
    );
  }

  return (
    <>
      <aside
        aria-label="chi tiết người dùng"
        className={cn(
          'flex h-full flex-col gap-4 overflow-y-auto border-l border-border-default bg-bg-surface p-4',
          PANEL_WIDTH,
        )}
      >
        {body}
      </aside>
      {removeDialog}
    </>
  );
}
