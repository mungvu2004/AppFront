/**
 * Hộp thoại A9 của màn cài đặt bộ luật: tải lại bản của máy chủ sẽ bỏ thay đổi
 * chưa lưu, và lượt bỏ ấy không hoàn tác được — nên hỏi trước.
 *
 * Esc đóng hộp thoại (A12) nhờ `Modal.Root`; đóng nghĩa là "để sau", không tải lại.
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

export interface RuleSettingsReloadDialogProps {
  readonly isOpen: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function RuleSettingsReloadDialog({ isOpen, onConfirm, onCancel }: RuleSettingsReloadDialogProps) {
  return (
    <Modal.Root isOpen={isOpen} onClose={onCancel} width={480}>
      <Modal.Header>Tải lại bộ luật?</Modal.Header>
      <Modal.Body>
        <p className="pb-2">
          Tải lại sẽ bỏ thay đổi chưa lưu của bạn và hiện bản bộ luật mới nhất trên máy chủ.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onCancel}>
          Để sau
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Bỏ thay đổi và tải lại
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
