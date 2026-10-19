/**
 * Hộp thoại A9 trước khi đổi vai toàn hệ thống của một thành viên (N4-03).
 *
 * Vai là vai trên toàn hệ thống, nên hộp nói rõ những dự án nào bị ảnh hưởng.
 * Chọn vai trong Select chưa ghi gì: chỉ "Đổi vai" mới gọi máy chủ. Lỗi (ví dụ
 * `MEMBER_LAST_EDITOR`) hiện ngay trong hộp, hộp giữ nguyên; Esc đóng qua
 * `onClose` của `Modal.Root` (A12).
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

import type { RoleChangeDialogModel } from './useProjectMembers';

export interface MemberRoleDialogProps {
  readonly dialog: RoleChangeDialogModel;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function MemberRoleDialog({ dialog, onConfirm, onCancel }: MemberRoleDialogProps) {
  const open = dialog.state === 'open' ? dialog : null;
  const isSubmitting = open?.isSubmitting === true;

  return (
    <Modal.Root isOpen={dialog.state !== 'closed'} onClose={onCancel} width={480}>
      <Modal.Header>
        {open === null ? 'Đổi vai' : `Đổi vai ${open.memberName}: ${open.fromLabel} → ${open.toLabel}`}
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-3">
          {open === null ? (
            <p className="text-[14px] text-text-secondary">Đang tải các dự án của thành viên…</p>
          ) : (
            <>
              <p className="text-[14px] text-text-primary">{open.consequence}</p>
              <p className="text-[14px] text-text-primary">
                {open.projectNames.length === 0
                  ? `Vai mới áp dụng cho mọi dự án của ${open.memberName}.`
                  : `Vai mới áp dụng cho tất cả ${open.projectNames.length} dự án của ${open.memberName}:`}
              </p>
              {open.projectNames.length > 0 && (
                <ul className="flex max-h-40 list-disc flex-col gap-1 overflow-y-auto pl-5 text-[13px] text-text-primary">
                  {open.projectNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
              {open.error !== null && (
                <p role="alert" className="text-[13px] text-state-violation-text">
                  {open.error}
                </p>
              )}
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Huỷ
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={isSubmitting} disabled={open === null}>
          Đổi vai
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
