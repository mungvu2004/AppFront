/**
 * Dải lưu lớp tầng (F-04x-1 bước 7) — dùng chung cho bốn màn QC.
 *
 * View thuần: nhận `saveBlock` mà `useFloorLayerAutosave` dựng sẵn (câu, nút,
 * trạng thái hộp thoại A9 đều ở hook) và vẽ. `reload` → dải chú ý + nút
 * "Tải lại", còn sửa chưa lưu thì hook mở hộp thoại A9; `blocked` → dải vi phạm.
 * Đặt ngoài canvas, trong khối nội dung của màn.
 */

import { lazy, Suspense } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import type { FloorLayerSaveBlock } from '@/hooks/useAutosave';

const FloorLayerSaveConfirm = lazy(() => import('./FloorLayerSaveConfirm'));

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
        <Suspense fallback={null}>
          <FloorLayerSaveConfirm confirm={confirm} />
        </Suspense>
      )}
    </>
  );
}
