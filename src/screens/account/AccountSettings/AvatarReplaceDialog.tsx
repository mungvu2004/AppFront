/**
 * Hộp thoại xác nhận thay ảnh đại diện (A9).
 *
 * Thay ảnh qua N14 không hoàn tác được — máy chủ ghi đè ảnh cũ và chưa có điểm
 * cuối gỡ ảnh — nên việc này phải hỏi trước, đúng như `DangerZone.tsx` hỏi trước
 * khi xoá tài khoản. Khi chưa có ảnh, câu hỏi nói thẳng rằng sau này chỉ thay
 * được, không gỡ được.
 *
 * View thuần: ảnh xem trước là một chuỗi do hook giữ ở trạng thái cục bộ; file này
 * không đọc tệp và không gọi mạng. Esc đóng hộp thoại qua `onClose` của
 * `Modal.Root` (A12) và có nghĩa là huỷ — không gửi gì.
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

export interface AvatarReplaceDialogProps {
  readonly isOpen: boolean;
  /** Ảnh người dùng vừa chọn, để nhìn trước khi đồng ý. */
  readonly previewUrl: string;
  /** Đã có ảnh đại diện từ trước thì là "thay", chưa có thì là "đặt". */
  readonly hasExistingAvatar: boolean;
  /** Đang gửi N14: hai nút khoá, hộp thoại chưa đóng. */
  readonly isSending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function AvatarReplaceDialog(props: AvatarReplaceDialogProps) {
  const title = props.hasExistingAvatar ? 'Thay ảnh đại diện?' : 'Đặt ảnh đại diện?';
  const warning = props.hasExistingAvatar
    ? 'Ảnh cũ không khôi phục được.'
    : 'Sau khi đặt chỉ thay được, không gỡ được.';

  return (
    <Modal.Root isOpen={props.isOpen} onClose={props.onCancel} width={480}>
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        <div className="flex flex-col items-center gap-4 pb-2">
          {props.previewUrl === '' ? null : (
            <img
              src={props.previewUrl}
              alt="Ảnh đại diện mới"
              className="h-24 w-24 rounded-full object-cover"
            />
          )}
          <p>{warning}</p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={props.onCancel} disabled={props.isSending}>
          Huỷ
        </Button>
        <Button variant="primary" onClick={props.onConfirm} loading={props.isSending}>
          Thay ảnh
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}
