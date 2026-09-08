/**
 * Mục 1 — thành viên dự án, CHỈ ĐỂ XEM.
 *
 * Không ô mời, không `Select` vai, không nút gỡ: không endpoint nào cho ba thứ đó —
 * xem chú thích đầu `types.ts`, mã prompt dữ liệu còn thiếu là **T-01**. Khuôn chép từ
 * `ProjectSettings/MembersTab.tsx`, tiền lệ đang chạy đúng ranh giới này trong repo.
 *
 * Hàng `isOwner` phải nói rõ đây là chủ sở hữu và không sửa được — không chỉ một chấm
 * màu, mà một câu chữ đọc được.
 */

import { Users } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

import type { MemberRowModel } from './types';

export interface ShareDialogPeopleProps {
  readonly members: readonly MemberRowModel[];
  readonly membersReadOnlyReason: string;
}

export function ShareDialogPeople({ members, membersReadOnlyReason }: ShareDialogPeopleProps) {
  if (members.length === 0) {
    return (
      <section aria-label="thành viên">
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="chưa có thành viên nào"
          description={membersReadOnlyReason}
        />
      </section>
    );
  }

  return (
    <section aria-label="thành viên" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-text-secondary">thành viên</h3>

      <ul className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2">
            <Avatar
              {...(member.avatarUrl !== null ? { src: member.avatarUrl } : {})}
              initials={member.initials}
              alt={member.name}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] text-text-primary">{member.name}</span>
              <span className="truncate text-xs text-text-secondary">{member.email}</span>
              {member.isOwner && (
                <span className="text-xs text-text-muted">chủ sở hữu dự án — không đổi được</span>
              )}
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {member.isOwner && <Badge variant="neutral">chủ sở hữu</Badge>}
              <Badge variant="neutral">{member.roleLabel}</Badge>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-text-secondary">{membersReadOnlyReason}</p>
    </section>
  );
}
