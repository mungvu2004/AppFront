/**
 * Hộp thoại A9 trước khi tải lại cài đặt khi còn thay đổi chưa lưu.
 *
 * Tải lại ghi đè bản nháp bằng bản trên máy chủ, mà không có vé hoàn tác nào cho
 * việc đó — nên hỏi trước. Esc đóng qua `onClose` của `Modal.Root` (A12).
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

export interface ProjectSettingsReloadDialogProps {
  readonly isOpen: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ProjectSettingsReloadDialog(props: ProjectSettingsReloadDialogProps) {
  return (
    <Modal.Root isOpen={props.isOpen} onClose={props.onCancel} width={480}>
      <Modal.Header>Tải lại sẽ bỏ thay đổi chưa lưu</Modal.Header>
      <Modal.Body>
        <p className="text-[14px] text-text-primary">
          Những thay đổi chưa lưu trên màn này sẽ mất, và bản mới nhất từ máy chủ sẽ thay vào chỗ đó.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={props.onCancel}>
          Giữ thay đổi
        </Button>
        <Button variant="danger" onClick={props.onConfirm}>
          Tải lại
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
