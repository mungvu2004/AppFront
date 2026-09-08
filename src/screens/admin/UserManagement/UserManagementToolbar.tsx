/**
 * Thanh công cụ đầu bảng: ô tìm, hai bộ lọc, nút mời, dải tóm tắt, và ô mời mở rộng.
 *
 * `Select` lọc vai/trạng thái đều tự mang `label` thật (không phải `FieldRow`), nên cả hai
 * tự đạt `expectAccessible` mà không cần thêm `aria-label` — cùng khuôn `ModelLibraryToolbar`.
 *
 * KHÔNG có nút "Mời người dùng" xám khi `toolbar.canInvite === false` — thay vào đó hiện
 * ngay `toolbar.inviteBlockedReason` tại chỗ nút đứng. Đặc tả cấm nút vô hiệu không lý do.
 *
 * Ô nhập email của lời mời PHẢI là `Textarea`, không phải `Combobox`: `Combobox` của repo
 * chỉ bắn `onChange` khi chọn một tuỳ chọn có sẵn nên không bao giờ nhận được địa chỉ gõ tay
 * (bẫy đã biết, ghi ở `contract-decisions.md` Đ-5).
 */
import { Send, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { ProjectRole } from '@/types/project';

import { FILTER_ALL } from './types';
import type { RoleFilter, StatusFilter, UserManagementToolbarProps } from './types';

const SEARCH_LABEL = 'tìm người dùng';
const SEARCH_PLACEHOLDER = 'Tìm theo tên hoặc email...';
const ROLE_FILTER_LABEL = 'vai';
const STATUS_FILTER_LABEL = 'trạng thái';
const ALL_OPTION_LABEL = 'tất cả';
const INVITE_BUTTON_LABEL = 'Mời người dùng';
const INVITE_ROLE_LABEL = 'vai cho lời mời';
const INVITE_EMAILS_LABEL = 'email người được mời';
const INVITE_EMAILS_PLACEHOLDER = 'Nhập email, cách nhau bằng dấu phẩy hoặc xuống dòng...';
const INVITE_SUBMIT_LABEL = 'Gửi lời mời';
const INVITE_CANCEL_LABEL = 'Huỷ';
const INVALID_EMAILS_PREFIX = 'không hợp lệ:';
const VALID_EMAIL_COUNT_SUFFIX = 'địa chỉ hợp lệ';
const SUMMARY_USER_LABEL = 'người dùng';
const SUMMARY_ADMIN_LABEL = 'quản trị';
const SUMMARY_PENDING_LABEL = 'lời mời đang chờ';

export function UserManagementToolbar({ actions, invite, summary, toolbar }: UserManagementToolbarProps) {
  const roleFilterOptions = [
    { label: ALL_OPTION_LABEL, value: FILTER_ALL as string },
    ...toolbar.roleOptions.map((option) => ({ label: option.label, value: option.role as string })),
  ];
  const statusFilterOptions = [
    { label: ALL_OPTION_LABEL, value: FILTER_ALL as string },
    ...toolbar.statusOptions.map((option) => ({ label: option.label, value: option.status as string })),
  ];
  const inviteRoleOptions = toolbar.roleOptions.map((option) => ({ label: option.label, value: option.role as string }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Input
            className="w-[240px]"
            label={SEARCH_LABEL}
            onChange={(event) => actions.onSearchChange(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            value={toolbar.search}
          />
          <Select
            className="w-[180px]"
            label={ROLE_FILTER_LABEL}
            onChange={(value) => actions.onRoleFilterChange(value as RoleFilter)}
            options={roleFilterOptions}
            value={toolbar.roleFilter}
          />
          <Select
            className="w-[180px]"
            label={STATUS_FILTER_LABEL}
            onChange={(value) => actions.onStatusFilterChange(value as StatusFilter)}
            options={statusFilterOptions}
            value={toolbar.statusFilter}
          />
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {toolbar.canInvite ? (
            <Button
              iconBefore={<UserPlus aria-hidden="true" size={16} />}
              onClick={actions.onOpenInvite}
              variant="primary"
            >
              {INVITE_BUTTON_LABEL}
            </Button>
          ) : (
            <p className="max-w-[280px] text-right text-[13px] text-text-secondary">{toolbar.inviteBlockedReason}</p>
          )}
        </div>
      </div>

      <dl className="flex flex-wrap items-center gap-4 text-[13px] text-text-secondary">
        <div className="flex items-center gap-1.5">
          <dt>{SUMMARY_USER_LABEL}</dt>
          <dd className="font-mono tabular-nums text-text-primary">{summary.userCountLabel}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>{SUMMARY_ADMIN_LABEL}</dt>
          <dd className="font-mono tabular-nums text-text-primary">{summary.adminCountLabel}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>{SUMMARY_PENDING_LABEL}</dt>
          <dd className="font-mono tabular-nums text-text-primary">{summary.pendingInviteCountLabel}</dd>
        </div>
      </dl>

      {invite.isOpen && (
        <div className="flex flex-col gap-3 rounded-[8px] border border-border-default p-4">
          <Textarea
            hint={invite.hintLabel}
            label={INVITE_EMAILS_LABEL}
            onChange={(event) => actions.onInviteEmailsChange(event.target.value)}
            placeholder={INVITE_EMAILS_PLACEHOLDER}
            value={invite.rawEmails}
            {...(invite.errorLabel !== null ? { error: invite.errorLabel } : {})}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {invite.validEmails.length} {VALID_EMAIL_COUNT_SUFFIX}
            </Badge>
            {invite.invalidEmails.length > 0 && (
              <p className="text-[13px] text-text-secondary">
                {INVALID_EMAILS_PREFIX} {invite.invalidEmails.join(', ')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <Select
              className="w-[180px]"
              label={INVITE_ROLE_LABEL}
              onChange={(value) => actions.onInviteRoleChange(value as ProjectRole)}
              options={inviteRoleOptions}
              value={invite.role}
            />
            <div className="flex items-center gap-2">
              <Button
                disabled={!invite.canSubmit}
                iconBefore={<Send aria-hidden="true" size={16} />}
                loading={invite.isSubmitting}
                onClick={actions.onSubmitInvite}
                variant="primary"
              >
                {INVITE_SUBMIT_LABEL}
              </Button>
              <Button onClick={actions.onCloseInvite} variant="ghost">
                {INVITE_CANCEL_LABEL}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
