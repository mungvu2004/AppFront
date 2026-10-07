/**
 * Hộp thoại A9 của dải lưu lớp tầng. Tách file để `FloorLayerSaveBanner` nạp lười:
 * `Modal` (cùng `focusTrap`, `AnimatePresence`) chỉ cần khi có sửa chưa lưu gặp bản mới,
 * không phải mọi lần màn có dải — đo ở GHEP-FE/SIZE, ~3 KiB gzip khỏi chunk màn 3D.
 */

import { Modal } from '@/components/overlay/Modal';
import type { FloorLayerSaveConfirm as Confirm } from '@/hooks/useAutosave';

export default function FloorLayerSaveConfirm({ confirm }: { readonly confirm: Confirm }) {
  return (
    <Modal
      isOpen={confirm.open}
      onClose={confirm.onCancel}
      primaryAction={{ label: 'Tải lại và bỏ thay đổi', onClick: confirm.onConfirm }}
      secondaryAction={{ label: 'Huỷ', onClick: confirm.onCancel }}
      title="Bỏ thay đổi chưa lưu của tầng này?"
    >
      Bản mới nhất trên máy chủ sẽ thay mọi sửa đổi chưa lưu của tầng này. Thao tác này không hoàn tác được.
    </Modal>
  );
}
