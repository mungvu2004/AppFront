/**
 * A9: hành động không hoàn tác được (cam kết tài chính) phải hỏi trước bằng
 * hộp thoại. File anh em của `BillingScreen.tsx` (mục D, R-22).
 *
 * `Modal.Root` luôn được gắn — `isOpen` bám theo `confirm !== null` — để lượt
 * đóng chạy hết hoạt ảnh thoát của `AnimatePresence` thay vì gỡ cây ngay lập tức.
 */
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';

import type { BillingConfirmSummary } from './BillingScreen';

export interface ConfirmUpgradeDialogProps {
  readonly confirm: BillingConfirmSummary | null;
  readonly onConfirmDismiss: () => void;
  readonly onConfirmAccept: () => void;
}

export function ConfirmUpgradeDialog({ confirm, onConfirmDismiss, onConfirmAccept }: ConfirmUpgradeDialogProps) {
  return (
    <Modal.Root isOpen={confirm !== null} onClose={onConfirmDismiss} width={480}>
      <Modal.Header>{confirm?.title ?? ''}</Modal.Header>
      <Modal.Body>
        {confirm !== null &&
          confirm.rows.map((row, index) => (
            <FieldRow key={row.label} label={row.label} isLast={index === confirm.rows.length - 1}>
              {row.value}
            </FieldRow>
          ))}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onConfirmDismiss}>
          {confirm?.cancelLabel ?? ''}
        </Button>
        <Button variant="primary" onClick={onConfirmAccept}>
          {confirm?.confirmLabel ?? ''}
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
