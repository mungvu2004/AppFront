/**
 * Chân trang của Cổng chất lượng đầu vào — xác nhận và hai nút hành động.
 *
 * Khung tối thiểu do người viết `InputQualityGate.tsx` dựng. Toàn bộ nội dung
 * (hộp xác nhận, hai nút, cách ẩn khi `areActionsHidden`) do lớp Layer 2 phụ
 * trách chân trang thay thế.
 */

import type { InputQualityFooterProps } from './types';

export function InputQualityGateFooter({ footer }: InputQualityFooterProps) {
  return (
    <footer aria-label="Hành động tiếp theo" className="flex items-center justify-end gap-3">
      <span className="text-[13px] text-text-secondary">{footer.acknowledgementLabel}</span>
    </footer>
  );
}
