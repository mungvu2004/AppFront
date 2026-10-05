/**
 * Thẻ "thành viên": ai đang ở trong dự án, họ giữ vai gì, và (khi có quyền sửa)
 * thêm hay gỡ người.
 *
 * Vai không sửa được cài đặt thì ô email, nút thêm và nút gỡ rời hẳn khỏi DOM
 * (không phải bị khoá): đúng một danh sách chỉ để đọc.
 *
 * View thuần (R-60): danh sách, câu chữ và lỗi đã thành chuỗi từ `useProjectMembers`.
 */

import { Users } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import { AddMemberForm } from './AddMemberForm';
import { MemberRemoveDialog } from './MemberRemoveDialog';
import type { ProjectSettingsViewProps } from './useProjectSettings';

export type MembersTabProps = Pick<
  ProjectSettingsViewProps,
  | 'members'
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
  | 'requestRemoveMember'
  | 'confirmRemoveMember'
  | 'cancelRemoveMember'
>;

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
          <p className="text-[13px] text-text-secondary">{props.memberCountLabel}</p>
          <ul className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
            {props.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar initials={member.initials} alt={member.name} />
                <span className="truncate text-[14px] text-text-primary">{member.name}</span>
                <span className="ml-auto flex items-center gap-2">
                  <Badge variant="neutral">{member.roleLabel}</Badge>
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
      )}
      {props.canEdit && (
        <MemberRemoveDialog
          dialog={props.memberRemoveDialog}
          onConfirm={props.confirmRemoveMember}
          onCancel={props.cancelRemoveMember}
        />
      )}
    </div>
  );
}
