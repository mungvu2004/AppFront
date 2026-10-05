/**
 * Dải lưu lớp tầng (F-04x-1 bước 7) — dùng chung cho bốn màn QC.
 *
 * View thuần: nhận `saveBlock` mà `useFloorLayerAutosave` dựng sẵn (câu, nút,
 * trạng thái hộp thoại A9 đều ở hook) và vẽ. `reload` → dải chú ý + nút
 * "Tải lại", còn sửa chưa lưu thì hook mở hộp thoại A9; `blocked` → dải vi phạm.
 * Đặt ngoài canvas, trong khối nội dung của màn.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import type { FloorLayerSaveBlock } from '@/hooks/useAutosave';

export interface FloorLayerSaveBannerProps {
  readonly saveBlock: FloorLayerSaveBlock | null;
}

export function FloorLayerSaveBanner({ saveBlock }: FloorLayerSaveBannerProps) {
  if (saveBlock === null) {
    return null;
  }

  if (saveBlock.kind === 'blocked') {
    return <InlineAlert level="violation" message={saveBlock.message} />;
  }

  const { confirm, onReload } = saveBlock;

  return (
    <>
      <InlineAlert
        level="attention"
        message={saveBlock.message}
        {...(onReload === undefined ? {} : { action: { label: 'Tải lại', onClick: onReload } })}
      />
      {confirm !== null && (
        <Modal
          isOpen={confirm.open}
          onClose={confirm.onCancel}
          primaryAction={{ label: 'Tải lại và bỏ thay đổi', onClick: confirm.onConfirm }}
          secondaryAction={{ label: 'Huỷ', onClick: confirm.onCancel }}
          title="Bỏ thay đổi chưa lưu của tầng này?"
        >
          Bản mới nhất trên máy chủ sẽ thay mọi sửa đổi chưa lưu của tầng này. Thao tác này không hoàn tác được.
        </Modal>
      )}
    </>
  );
}
