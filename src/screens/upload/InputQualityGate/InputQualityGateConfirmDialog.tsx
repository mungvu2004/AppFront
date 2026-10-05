/**
 * Hộp thoại hỏi trước (A9) cho hai lượt ghi mà máy chủ không đảo được: nắn
 * thẳng và cắt lại theo bốn góc. Thuần props — chữ và trạng thái bận đến từ
 * `model.confirm`; Esc và nút Huỷ cùng đi về `onCancelWrite`.
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

import type { InputQualityConfirmModel, InputQualityGateActions } from './types';

export interface InputQualityGateConfirmDialogProps {
  readonly confirm: InputQualityConfirmModel | null;
  readonly actions: Pick<InputQualityGateActions, 'onCancelWrite' | 'onConfirmWrite'>;
}

export function InputQualityGateConfirmDialog({
  actions,
  confirm,
}: InputQualityGateConfirmDialogProps) {
  return (
    <Modal.Root isOpen={confirm !== null} onClose={actions.onCancelWrite} width={480}>
      {confirm !== null && (
        <>
          <Modal.Header>{confirm.title}</Modal.Header>
          <Modal.Body>
            <p className="pb-2">{confirm.body}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button disabled={confirm.isBusy} onClick={actions.onCancelWrite} variant="ghost">
              {confirm.cancelLabel}
            </Button>
            <Button disabled={confirm.isBusy} onClick={actions.onConfirmWrite} variant="primary">
              {confirm.confirmLabel}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal.Root>
  );
}
