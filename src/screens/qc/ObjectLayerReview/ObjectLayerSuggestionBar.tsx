/**
 * Dải gợi ý của máy (B3) đầu danh sách: số gợi ý còn chờ, câu giải thích gợi ý là gì, nút chính
 * "Xem từng gợi ý" và hai nút phụ "Nhận tất cả gợi ý" / "Bỏ tất cả gợi ý".
 * View thuần — số đếm đã định dạng sẵn ở hook (A15); bỏ cả loạt có toast hoàn tác (A8).
 *
 * Ít nút (chủ sản phẩm 04/11): dải gấp sẵn thành MỘT dòng "N gợi ý của máy đang chờ ▾"; mở ra mới có câu
 * giải thích và ba nút. Dòng gợi ý vẫn nằm trong hàng đợi, nên "Xem tiếp" ở đáy cột cũng đi qua chúng.
 */

import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/Button';

const REVIEW_EACH_LABEL = 'Xem từng gợi ý';
const ACCEPT_ALL_LABEL = 'Nhận tất cả gợi ý';
const REJECT_ALL_LABEL = 'Bỏ tất cả gợi ý';
const SUGGESTION_EXPLAINER =
  'Gợi ý = chỗ có nét vẽ máy chưa nhận ra là gì (có thể là đồ, cũng có thể là chữ số). Chưa nhận thì không dựng 3D.';

export interface ObjectLayerSuggestionBarProps {
  /** "3 gợi ý của máy đang chờ" — đã ghép sẵn. */
  readonly label: string;
  readonly onReviewEach: () => void;
  readonly onAcceptAll: () => void;
  readonly onRejectAll: () => void;
}

export function ObjectLayerSuggestionBar({ label, onReviewEach, onAcceptAll, onRejectAll }: ObjectLayerSuggestionBarProps) {
  return (
    <details className="group rounded-lg border border-dashed border-border-default px-3 py-1">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-sm text-[13px] text-text-primary outline-hidden hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-120 group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 pb-2 pt-1" role="group" aria-label={label}>
        <p className="text-[12px] text-text-secondary">{SUGGESTION_EXPLAINER}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onReviewEach} size="sm" variant="secondary">
            {REVIEW_EACH_LABEL}
          </Button>
          <Button onClick={onAcceptAll} size="sm" variant="secondary">
            {ACCEPT_ALL_LABEL}
          </Button>
          <Button onClick={onRejectAll} size="sm" variant="ghost">
            {REJECT_ALL_LABEL}
          </Button>
        </div>
      </div>
    </details>
  );
}
