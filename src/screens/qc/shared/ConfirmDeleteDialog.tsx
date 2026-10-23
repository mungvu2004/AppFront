/**
 * Hộp xác nhận xoá dùng chung cho các màn duyệt lớp (Impeccable A3 P0): xoá ghi
 * thẳng máy chủ, nên một lần bấm nút xoá chỉ mở hộp này. Hộp nêu tên thứ bị xoá
 * và hậu quả; nút xác nhận kiểu nguy hiểm, Esc/"Để nguyên" giữ nguyên.
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

export interface ConfirmDeleteDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ConfirmDeleteDialog({ body, confirmLabel, isOpen, onCancel, onConfirm, title }: ConfirmDeleteDialogProps) {
  return (
    <Modal.Root isOpen={isOpen} onClose={onCancel} width={480}>
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        <p className="pb-2">{body}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} variant="ghost">
          Để nguyên
        </Button>
        <Button onClick={onConfirm} variant="danger">
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
