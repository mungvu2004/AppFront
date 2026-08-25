/**
 * Thẻ "thành viên": ai đang ở trong dự án và họ giữ vai gì.
 *
 * **Chỉ để xem trong lượt này.** Mời thêm người, đổi vai hay gỡ một thành viên
 * đều cần endpoint mà `src/api/client.ts` chưa có (nhóm `projects` chỉ đọc và
 * ghi chính dự án). Dựng một nút "mời" gọi vào chỗ trống là hứa suông, nên
 * lượt này không dựng — mã đề xuất cho lượt dữ liệu là **T-01**.
 *
 * View thuần (R-60): danh sách và số đếm đã thành chuỗi từ `useProjectSettings`.
 */

import { Users } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

import type { ProjectSettingsViewProps } from './useProjectSettings';

export type MembersTabProps = Pick<ProjectSettingsViewProps, 'members' | 'memberCountLabel' | 'state'>;

export function MembersTab(props: MembersTabProps) {
  if (props.state === 'loading') {
    return <Skeleton preset="table-row" />;
  }

  if (props.members.length === 0) {
    return (
      <EmptyState
        icon={<Users aria-hidden="true" />}
        title="Chưa có thành viên nào"
        description="Dự án này chưa có ai ngoài chủ sở hữu. Tên của họ sẽ hiện ở đây khi có thêm người."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-text-secondary">
        {props.memberCountLabel} · chỉ để xem trong bản này.
      </p>
      <ul className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
        {props.members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2">
            <Avatar initials={member.initials} alt={member.name} />
            <span className="truncate text-[14px] text-text-primary">{member.name}</span>
            <span className="ml-auto">
              <Badge variant="neutral">{member.roleLabel}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
