/**
 * Chân hộp thoại chia sẻ — đúng một nút "xong".
 *
 * Không nút Huỷ, không nút Lưu: mọi thay đổi ở ba mục phía trên đã áp ngay qua các
 * hành động `setXxx`/`createLink`/`revokeLink` của `ShareDialogActions` (A7 — không có
 * gì "đang chờ lưu" để một nút Lưu phải gánh). Đóng hộp thoại không phải một hành động
 * cần xác nhận (A9 chỉ áp cho hành động A8 không hoàn tác được) nên đây vẫn là một nút
 * bình thường, không phải hộp thoại xác nhận.
 */

import { Button } from '@/components/ui/Button';

export interface ShareDialogFooterProps {
  readonly onDismiss: () => void;
}

export function ShareDialogFooter({ onDismiss }: ShareDialogFooterProps) {
  return (
    <Button variant="primary" onClick={onDismiss}>
      xong
    </Button>
  );
}
