/**
 * U04: duyệt hàng loạt đầu danh sách, như "Duyệt N đoạn máy chắc chắn" của bước Tường.
 * View thuần — nhãn đã ghép sẵn ở hook; mỗi nút là MỘT bước hoàn tác (Ctrl+Z trả cả lượt).
 *
 * UX-06: món máy chưa chắc phải hỏi lại (nêu số mục) rồi mới duyệt. Câu tách "cần xem" nằm ở gợi ý khi rê
 * chuột và cho trình đọc màn hình; số từng phần đã thấy ở đầu các nhóm của danh sách.
 *
 * Một phần tử của hàng hành động (cùng hàng với dải gợi ý); lúc hỏi lại thì chiếm cả hàng.
 *
 * Ít nút (chủ sản phẩm 04/11): MỘT nút phụ mỗi lúc — còn món máy chắc chắn thì là nút ấy; duyệt xong mới tới
 * nút món máy chưa chắc. Nút chính của cột là "Xem tiếp" ở đáy.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { nextSuggestionIdOf } from './objectLayerReviewGateway';
import type { ObjectLayerReviewModel } from './objectLayerTypes';
import { ObjectLayerSuggestionBar } from './ObjectLayerSuggestionBar';

const GROUP_LABEL = 'Duyệt hàng loạt';
const CONFIRM_YES = 'Vẫn duyệt';
const CONFIRM_NO = 'Thôi';
/** Chữ nhỏ hơn nút `sm` để nhãn "Duyệt N mục máy chắc chắn" đứng cạnh dải gợi ý trong cột 280 px. */
const BUTTON_CLASS = 'px-2 text-[12px]';

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

  if (!showConfident && !showRemaining) {
    return null;
  }

  return (
    <div
      aria-label={GROUP_LABEL}
      className={cn('min-w-0', isConfirming && showRemaining ? 'basis-full' : 'flex-1')}
      role="group"
      title={breakdownLabel ?? undefined}
    >
      {breakdownLabel == null ? null : <span className="sr-only">{breakdownLabel}</span>}
      {showConfident ? (
        <Button className={BUTTON_CLASS} fullWidth onClick={onApproveConfident} size="sm" variant="secondary">
          {confidentLabel}
        </Button>
      ) : null}
      {showRemaining && !isConfirming ? (
        <Button className={BUTTON_CLASS} fullWidth onClick={() => setIsConfirming(true)} size="sm" variant="secondary">
          {remainingLabel}
        </Button>
      ) : null}
      {showRemaining && isConfirming ? (
        <div className="flex flex-col gap-1.5 py-1" role="group">
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

/** Hàng nút phụ đầu danh sách, đứng ngoài vùng cuộn: duyệt hàng loạt + gợi ý; không còn nút nào thì hàng biến mất. */
export function ObjectLayerQueueActions({ model }: { readonly model: ObjectLayerReviewModel }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border-default px-2 py-1 empty:hidden">
      <ObjectLayerBulkApproveBar
        breakdownLabel={model.reviewBreakdownLabel}
        confidentLabel={model.approveConfidentLabel}
        onApproveConfident={model.onApproveConfident}
        onApproveRemaining={model.onApproveRemaining}
        remainingConfirm={model.approveRemainingConfirm}
        remainingLabel={model.approveRemainingLabel}
      />
      {(model.suggestionCount ?? 0) === 0 ||
      model.onAcceptAllSuggestions === undefined ||
      model.onRejectAllSuggestions === undefined ? null : (
        <ObjectLayerSuggestionBar
          label={model.suggestionLabel ?? ''}
          onReviewEach={() => model.onSelect(nextSuggestionIdOf(model.rows, model.selectedObjectId))}
          onAcceptAll={model.onAcceptAllSuggestions}
          onRejectAll={model.onRejectAllSuggestions}
        />
      )}
    </div>
  );
}
