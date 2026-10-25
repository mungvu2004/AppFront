/**
 * Đầu khung danh sách (trong `Section` của màn): ô tìm, hai bộ lọc, và ô mời mở rộng. Nút
 * "Mời người dùng" và các số tóm tắt đã lên `PageHead` (next / status) của màn.
 *
 * `Select` lọc vai/trạng thái đều tự mang `label` thật (không phải `FieldRow`), nên cả hai
 * tự đạt `expectAccessible` mà không cần thêm `aria-label` — cùng khuôn `ModelLibraryToolbar`.
 *
 * Ô nhập email của lời mời PHẢI là `Textarea`, không phải `Combobox`: `Combobox` của repo
 * chỉ bắn `onChange` khi chọn một tuỳ chọn có sẵn nên không bao giờ nhận được địa chỉ gõ tay
 * (bẫy đã biết, ghi ở `contract-decisions.md` Đ-5).
 */
import { Send } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { ProjectRole } from '@/types/project';

import { FILTER_ALL } from './types';
import type { RoleFilter, StatusFilter, UserManagementToolbarProps } from './types';

const SEARCH_LABEL = 'Tìm người dùng';
const SEARCH_PLACEHOLDER = 'Tìm theo tên hoặc email…';
const ROLE_FILTER_LABEL = 'Vai';
const STATUS_FILTER_LABEL = 'Trạng thái';
const ALL_OPTION_LABEL = 'Tất cả';
const INVITE_ROLE_LABEL = 'Vai cho lời mời';
const INVITE_EMAILS_LABEL = 'Email người được mời';
const INVITE_EMAILS_PLACEHOLDER = 'ten@congty.vn, ten2@congty.vn';
const INVITE_SUBMIT_LABEL = 'Gửi lời mời';
const INVITE_CANCEL_LABEL = 'Huỷ';
const VALID_EMAIL_COUNT_SUFFIX = 'địa chỉ hợp lệ';
const SUBMIT_BLOCKED_REASON_ID = 'user-invite-submit-blocked-reason';

export function UserManagementToolbar({ actions, invite, searchRef, toolbar }: UserManagementToolbarProps) {
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
    <div className="flex flex-col gap-4 border-b border-border-default px-5 py-4">
      <div className="flex flex-wrap items-end gap-4">
        <Input
          ref={searchRef}
          className="w-60"
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

      {invite.isOpen && (
        <div className="flex flex-col gap-3 rounded-lg border border-border-default p-4">
          <Textarea
            autoFocus
            hint={invite.hintLabel}
            label={INVITE_EMAILS_LABEL}
            onChange={(event) => actions.onInviteEmailsChange(event.target.value)}
            // Esc khi ô đã có chữ: bỏ tiêu điểm, giữ khối (khỏi mất bản nháp); ô trống thì Esc đóng khối — sổ phím nhận Esc ở window.
            onKeyDown={(event) => {
              if (event.key === 'Escape' && invite.rawEmails.trim() !== '') {
                event.stopPropagation();
                event.currentTarget.blur();
              }
            }}
            placeholder={INVITE_EMAILS_PLACEHOLDER}
            value={invite.rawEmails}
            {...(invite.errorLabel !== null ? { error: invite.errorLabel } : {})}
          />

          {/* BUG-083: địa chỉ sai chỉ nói một lần (lỗi của ô nhập); chip chỉ đếm khi có gì để đếm. */}
          {invite.validEmails.length > 0 && (
            <Badge className="w-fit" variant="neutral">
              {invite.validEmails.length} {VALID_EMAIL_COUNT_SUFFIX}
            </Badge>
          )}

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
                {...(invite.submitBlockedReason !== null ? { 'aria-describedby': SUBMIT_BLOCKED_REASON_ID } : {})}
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
          {invite.submitBlockedReason !== null && !invite.isSubmitting && (
            <p className="text-[13px] text-text-secondary" id={SUBMIT_BLOCKED_REASON_ID}>
              {invite.submitBlockedReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
