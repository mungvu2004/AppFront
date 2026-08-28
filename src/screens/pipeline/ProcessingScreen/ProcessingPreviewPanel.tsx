/**
 * STUB — panel xem trước của màn Xử lý. Nhiệm vụ V6 thay ruột file này; chữ ký
 * giữ nguyên từ `ProcessingPreviewPanelProps` (`types.ts`).
 *
 * Chưa vẽ đường hình học đã dò (`detectedGeometryPaths`) hay vạch quét
 * (`isScanning`) — khung chỉ giữ chỗ cho ảnh nguồn, không glow không gradient
 * (mục [CẤM TUYỆT ĐỐI]) vẫn là ràng buộc ngay cả ở dạng khung.
 */

import type { ProcessingPreviewPanelProps } from './types';

export function ProcessingPreviewPanel({ preview }: ProcessingPreviewPanelProps) {
  return (
    <div aria-label="Xem trước bản vẽ đang xử lý" className="flex min-h-[240px] items-center justify-center bg-bg-sunken">
      {preview.sourceImageUrl !== undefined ? (
        <img alt={preview.altText} className="max-h-full max-w-full" src={preview.sourceImageUrl} />
      ) : null}
    </div>
  );
}
