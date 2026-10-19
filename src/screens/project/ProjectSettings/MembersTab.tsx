/**
 * Thẻ "thành viên": ai đang ở trong dự án, họ giữ vai gì, và (khi có quyền sửa)
 * thêm hay gỡ người.
 *
 * Vai không sửa được cài đặt thì ô email, nút thêm và nút gỡ rời hẳn khỏi DOM
 * (không phải bị khoá): đúng một danh sách chỉ để đọc.
 *
 * N4-03: vai là vai TOÀN HỆ THỐNG. Quản trị viên đổi ngay tại đây bằng Select
 * (trừ dòng của chính mình — máy chủ cấm tự đổi), qua hộp xác nhận liệt kê các
 * dự án bị ảnh hưởng. Người khác chỉ thấy Badge kèm lời chỉ đường.
 *
 * View thuần (R-60): danh sách, câu chữ và lỗi đã thành chuỗi từ `useProjectMembers`.
 */

import { Users } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

import { AddMemberForm } from './AddMemberForm';
import { MemberRemoveDialog } from './MemberRemoveDialog';
import { MemberRoleDialog } from './MemberRoleDialog';
import type { ProjectMemberRole } from './projectSettingsGateway';
import type { ProjectSettingsMemberRow, ProjectSettingsViewProps } from './useProjectSettings';

export interface MemberRoleOption {
  readonly value: ProjectMemberRole;
  readonly label: string;
}

export type MembersTabMember = ProjectSettingsMemberRow & {
  /** False với người không phải quản trị viên và với dòng của chính mình. */
  readonly canChangeRole: boolean;
  readonly roleOptions: readonly MemberRoleOption[];
};

export type MembersTabProps = Pick<
  ProjectSettingsViewProps,
  | 'memberCountLabel'
  | 'state'
  | 'canEdit'
  | 'memberEmail'
  | 'memberError'
  | 'isAddingMember'
  | 'isAddMemberLocked'
  | 'memberRemoveDialog'
  | 'setMemberEmail'
  | 'addMember'
  | 'inviteEmail'
  | 'isInvitingMember'
  | 'inviteMember'
  | 'requestRemoveMember'
  | 'confirmRemoveMember'
  | 'cancelRemoveMember'
  | 'roleChangeDialog'
  | 'requestRoleChange'
  | 'confirmRoleChange'
  | 'cancelRoleChange'
> & {
  readonly members: readonly MembersTabMember[];
};

const ROLE_BADGE_TITLE = 'Vai toàn hệ thống — nhờ quản trị viên đổi';

function RoleCell({ member, onChange }: { readonly member: MembersTabMember; readonly onChange: (role: ProjectMemberRole) => void }) {
  if (!member.canChangeRole) {
    return (
      <Badge variant="neutral" title={ROLE_BADGE_TITLE}>
        {member.roleLabel}
      </Badge>
    );
  }

  const options = member.roleOptions.map((option) => ({ label: option.label, value: option.value as string }));
  // Giá trị luôn là vai hiện tại: chọn vai khác chỉ mở hộp xác nhận, huỷ hay lỗi thì Select vẫn đúng vai cũ.
  const current = member.roleOptions.find((option) => option.label === member.roleLabel)?.value;

  return (
    <Select.Root
      className="w-[140px]"
      onChange={(value) => {
        const picked = member.roleOptions.find((option) => option.value === value);
        if (picked !== undefined && picked.value !== current) onChange(picked.value);
      }}
      options={options}
      value={current}
    >
      <Select.Label className="sr-only">{`Vai toàn hệ thống của ${member.name}`}</Select.Label>
      <Select.Trigger options={options} />
      <Select.Content>
        {options.map((option) => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

export function MembersTab(props: MembersTabProps) {
  if (props.state === 'loading') {
    return <Skeleton preset="table-row" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {props.canEdit && <AddMemberForm {...props} />}
      {props.members.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="Chưa có thành viên nào"
          description="Dự án này chưa có ai ngoài chủ sở hữu. Tên của họ sẽ hiện ở đây khi có thêm người."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-text-secondary">
            <span>{props.memberCountLabel}</span>
            <span> · Vai áp dụng cho mọi dự án của người đó.</span>
          </p>
          <div className="rounded-lg border border-border-default">
            <div className="flex items-center border-b border-border-default px-3 py-1.5 text-[12px] font-medium text-text-secondary">
              <span>Thành viên</span>
              <span className="ml-auto">Vai (toàn hệ thống)</span>
            </div>
            <ul className="flex flex-col divide-y divide-border-default">
              {props.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar initials={member.initials} alt={member.name} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px] text-text-primary">{member.name}</span>
                    {member.email.length > 0 && member.email !== member.name && (
                      <span className="truncate text-[12px] text-text-secondary">{member.email}</span>
                    )}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {member.isPending === true && <Badge variant="neutral">Chờ chấp nhận</Badge>}
                    <RoleCell member={member} onChange={(role) => props.requestRoleChange(member.id, role)} />
                    {props.canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={member.removeLabel}
                        onClick={() => props.requestRemoveMember(member.id)}
                      >
                        Gỡ
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {props.canEdit && (
        <MemberRemoveDialog
          dialog={props.memberRemoveDialog}
          onConfirm={props.confirmRemoveMember}
          onCancel={props.cancelRemoveMember}
        />
      )}
      <MemberRoleDialog
        dialog={props.roleChangeDialog}
        onConfirm={props.confirmRoleChange}
        onCancel={props.cancelRoleChange}
      />
    </div>
  );
}
