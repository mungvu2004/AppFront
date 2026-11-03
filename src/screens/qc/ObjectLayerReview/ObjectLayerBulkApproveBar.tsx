/**
 * U04: duyệt hàng loạt đầu danh sách, như "Duyệt N đoạn máy chắc chắn" của bước Tường.
 * View thuần — nhãn đã ghép sẵn ở hook; mỗi nút là MỘT bước hoàn tác (Ctrl+Z trả cả lượt).
 *
 * UX-06: món máy chưa chắc phải hỏi lại (nêu số mục) rồi mới duyệt. Dòng tách "cần xem" cho thấy các số
 * cộng lại đúng.
 *
 * Ít nút (chủ sản phẩm 04/11): MỘT nút phụ mỗi lúc — còn món máy chắc chắn thì là nút ấy; duyệt xong mới tới
 * nút món máy chưa chắc. Nút chính của cột là "Xem tiếp" ở đáy.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/Button';

const GROUP_LABEL = 'Duyệt hàng loạt';
const CONFIRM_YES = 'Vẫn duyệt';
const CONFIRM_NO = 'Thôi';

export interface ObjectLayerBulkApproveBarProps {
  readonly breakdownLabel?: string | null | undefined;
  readonly confidentLabel?: string | null | undefined;
  readonly onApproveConfident?: (() => void) | undefined;
  readonly remainingLabel?: string | null | undefined;
  readonly remainingConfirm?: string | null | undefined;
  readonly onApproveRemaining?: (() => void) | undefined;
}

export function ObjectLayerBulkApproveBar({
  breakdownLabel,
  confidentLabel,
  onApproveConfident,
  remainingLabel,
  remainingConfirm,
  onApproveRemaining,
}: ObjectLayerBulkApproveBarProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const showConfident = confidentLabel != null && onApproveConfident !== undefined;
  const showRemaining = !showConfident && remainingLabel != null && onApproveRemaining !== undefined;

  if (!showConfident && !showRemaining && breakdownLabel == null) {
    return null;
  }

  return (
    <div aria-label={GROUP_LABEL} className="flex flex-col gap-2 px-1" role="group">
      {breakdownLabel == null ? null : (
        <p className="px-1 text-[12px] tabular-nums text-text-secondary">{breakdownLabel}</p>
      )}
      {showConfident ? (
        <Button fullWidth onClick={onApproveConfident} size="sm" variant="secondary">
          {confidentLabel}
        </Button>
      ) : null}
      {showRemaining && !isConfirming ? (
        <Button fullWidth onClick={() => setIsConfirming(true)} size="sm" variant="secondary">
          {remainingLabel}
        </Button>
      ) : null}
      {showRemaining && isConfirming ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-default px-2 py-2" role="group">
          <p className="text-[13px] text-text-primary">{remainingConfirm ?? remainingLabel}</p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setIsConfirming(false);
                onApproveRemaining();
              }}
              size="sm"
              variant="secondary"
            >
              {CONFIRM_YES}
            </Button>
            <Button onClick={() => setIsConfirming(false)} size="sm" variant="ghost">
              {CONFIRM_NO}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
