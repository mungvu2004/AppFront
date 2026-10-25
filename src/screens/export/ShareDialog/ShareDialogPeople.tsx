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

import { Lock, Users } from 'lucide-react';

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
      <section aria-label="Người có quyền">
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="Chưa có thành viên nào"
          description={membersReadOnlyReason}
        />
      </section>
    );
  }

  return (
    <section aria-label="Người có quyền" className="flex flex-col gap-2">
      <h3 className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">Người có quyền</h3>

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
            </div>
            {member.isOwner ? (
              <span
                className="ml-auto flex shrink-0 items-center gap-1 text-[13px] text-text-secondary"
                title="Chủ dự án luôn giữ quyền quản trị, không đổi vai hay gỡ được."
              >
                <Lock size={14} aria-hidden="true" />
                {member.roleLabel}, chủ dự án
              </span>
            ) : (
              <span className="ml-auto shrink-0">
                <Badge variant="neutral">{member.roleLabel}</Badge>
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-text-secondary">{membersReadOnlyReason}</p>
    </section>
  );
}
