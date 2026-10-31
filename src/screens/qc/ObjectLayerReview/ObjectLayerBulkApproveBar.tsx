/**
 * U04: duyệt hàng loạt đầu danh sách, như "Duyệt N đoạn máy chắc chắn" của bước Tường.
 * View thuần — nhãn đã ghép sẵn ở hook; mỗi nút là MỘT bước hoàn tác (Ctrl+Z trả cả lượt).
 */

import { Button } from '@/components/ui/Button';

const GROUP_LABEL = 'Duyệt hàng loạt';

export interface ObjectLayerBulkApproveBarProps {
  readonly confidentLabel?: string | null | undefined;
  readonly onApproveConfident?: (() => void) | undefined;
  readonly remainingLabel?: string | null | undefined;
  readonly onApproveRemaining?: (() => void) | undefined;
}

export function ObjectLayerBulkApproveBar({
  confidentLabel,
  onApproveConfident,
  remainingLabel,
  onApproveRemaining,
}: ObjectLayerBulkApproveBarProps) {
  const showConfident = confidentLabel != null && onApproveConfident !== undefined;
  const showRemaining = remainingLabel != null && onApproveRemaining !== undefined;

  if (!showConfident && !showRemaining) {
    return null;
  }

  return (
    <div aria-label={GROUP_LABEL} className="flex flex-col gap-2 px-1" role="group">
      {showConfident ? (
        <Button fullWidth onClick={onApproveConfident} size="sm" variant="secondary">
          {confidentLabel}
        </Button>
      ) : null}
      {showRemaining ? (
        <Button fullWidth onClick={onApproveRemaining} size="sm" variant="secondary">
          {remainingLabel}
        </Button>
      ) : null}
    </div>
  );
}
