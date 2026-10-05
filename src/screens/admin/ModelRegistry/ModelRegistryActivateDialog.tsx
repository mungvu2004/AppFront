/**
 * Hộp thoại A9 trước mọi lượt N24: kích hoạt một bản, hoặc quay về đường cổ điển.
 *
 * Esc đóng (Modal tự đăng ký ở phạm vi `dialog`, A12) và tiêu điểm về nút đã mở nó. Nút xác
 * nhận tắt trong lúc gửi để không có lượt bấm lặp.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

import type { ActivateDialogModel, ModelRegistryActions } from './types';

const CANCEL_LABEL = 'Huỷ';

export interface ModelRegistryActivateDialogProps {
  readonly dialog: ActivateDialogModel | null;
  readonly actions: ModelRegistryActions;
}

export function ModelRegistryActivateDialog({ actions, dialog }: ModelRegistryActivateDialogProps) {
  return (
    <Modal.Root isOpen={dialog !== null} onClose={actions.onCloseDialog} width={480}>
      {dialog !== null && (
        <>
          <Modal.Header>{dialog.title}</Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4 pb-2">
              <p>{dialog.body}</p>
              {dialog.warning !== null && <InlineAlert level="attention" message={dialog.warning} />}
              {dialog.errorMessage !== null && <InlineAlert level="violation" message={dialog.errorMessage} />}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={actions.onCloseDialog} variant="ghost">
              {CANCEL_LABEL}
            </Button>
            <Button
              disabled={dialog.isSubmitting}
              loading={dialog.isSubmitting}
              onClick={actions.onConfirmDialog}
              variant="primary"
            >
              {dialog.confirmLabel}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal.Root>
  );
}
