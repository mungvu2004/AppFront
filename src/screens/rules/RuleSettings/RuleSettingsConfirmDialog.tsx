/**
 * Hộp thoại hỏi trước (A9) cho hai việc đổi cả bộ luật cùng lúc: áp bộ luật sẵn
 * và khôi phục mặc định. Cả hai hoàn tác được 8 giây, nhưng đổi hàng loạt thì
 * vẫn hỏi trước (G5-36, G5-37). Esc đóng = không làm gì (A12).
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

export interface RuleSettingsConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function RuleSettingsConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: RuleSettingsConfirmDialogProps) {
  return (
    <Modal.Root isOpen={isOpen} onClose={onCancel} width={480}>
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        <p className="pb-2">{body}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onCancel}>
          Huỷ
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
