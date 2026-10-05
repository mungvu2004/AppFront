/**
 * Hộp thoại A9 trước khi gỡ một thành viên.
 *
 * Gỡ không hoàn tác được (không có toast hoàn tác), nên đây là chỗ duy nhất hỏi
 * trước. Lỗi của lượt gỡ hiện ngay trong hộp, hộp giữ nguyên để thử lại; Esc đóng
 * qua `onClose` của `Modal.Root` (A12).
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

import type { MemberRemoveDialogModel } from './useProjectMembers';

export interface MemberRemoveDialogProps {
  readonly dialog: MemberRemoveDialogModel | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function MemberRemoveDialog({ dialog, onConfirm, onCancel }: MemberRemoveDialogProps) {
  return (
    <Modal.Root isOpen={dialog !== null} onClose={onCancel} width={480}>
      <Modal.Header>{dialog?.title}</Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-text-primary">{dialog?.message}</p>
          {dialog?.error != null && (
            <p role="alert" className="text-[13px] text-state-violation-text">
              {dialog.error}
            </p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onCancel} disabled={dialog?.isRunning === true}>
          {dialog?.cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={dialog?.isRunning === true}>
          {dialog?.confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
