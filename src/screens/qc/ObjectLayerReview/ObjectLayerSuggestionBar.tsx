/**
 * Dải gợi ý của máy (B3) đầu danh sách: số gợi ý còn chờ, câu giải thích gợi ý là gì, nút chính
 * "Xem từng gợi ý" và hai nút phụ "Nhận tất cả gợi ý" / "Bỏ tất cả gợi ý".
 * View thuần — số đếm đã định dạng sẵn ở hook (A15); bỏ cả loạt có toast hoàn tác (A8).
 */

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
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-default px-3 py-2" role="group" aria-label={label}>
      <p className="text-[13px] text-text-primary">{label}</p>
      <p className="text-[12px] text-text-secondary">{SUGGESTION_EXPLAINER}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onReviewEach} size="sm" variant="primary">
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
  );
}
