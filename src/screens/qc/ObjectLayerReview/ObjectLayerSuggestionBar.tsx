/**
 * Dải gợi ý của máy (B3) đầu danh sách: số gợi ý còn chờ, câu giải thích gợi ý là gì, nút chính
 * "Xem từng gợi ý" và hai nút phụ "Nhận tất cả gợi ý" / "Bỏ tất cả gợi ý".
 * View thuần — số đếm đã định dạng sẵn ở hook (A15); bỏ cả loạt có toast hoàn tác (A8).
 *
 * Ít nút (chủ sản phẩm 04/11): dải gấp sẵn thành MỘT nút phụ "N gợi ý ▾" cùng hàng với nút duyệt hàng loạt;
 * mở ra thì chiếm cả hàng, có câu giải thích và ba nút. Dòng gợi ý vẫn nằm trong hàng đợi, nên "Xem tiếp" ở
 * đáy cột cũng đi qua chúng.
 */

import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/Button';

const LABEL_TAIL = ' của máy';
/** Cùng cỡ với nút duyệt hàng loạt cạnh nó. */
const BUTTON_CLASS = 'px-2 text-[12px]';
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
  /* Thấy "6 gợi ý"; phần đuôi của nhãn đã ghép vẫn ở lại cho trình đọc màn hình và khi rê chuột. */
  const cut = label.indexOf(LABEL_TAIL);
  const head = cut === -1 ? label : label.slice(0, cut);
  const tail = cut === -1 ? '' : label.slice(cut);

  return (
    <details className="group shrink-0 open:basis-full">
      <summary
        className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg border border-border-default px-2 text-[12px] font-medium text-text-primary outline-hidden transition-colors duration-120 hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
        title={label}
      >
        <span className="min-w-0 flex-1 whitespace-nowrap tabular-nums">
          {head}
          {tail === '' ? null : <span className="sr-only">{tail}</span>}
        </span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-120 group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 pb-1 pt-2" role="group" aria-label={label}>
        <p className="text-[12px] text-text-secondary">{SUGGESTION_EXPLAINER}</p>
        <div className="flex flex-wrap gap-2">
          <Button className={BUTTON_CLASS} onClick={onReviewEach} size="sm" variant="secondary">
            {REVIEW_EACH_LABEL}
          </Button>
          <Button className={BUTTON_CLASS} onClick={onAcceptAll} size="sm" variant="secondary">
            {ACCEPT_ALL_LABEL}
          </Button>
          <Button className={BUTTON_CLASS} onClick={onRejectAll} size="sm" variant="ghost">
            {REJECT_ALL_LABEL}
          </Button>
        </div>
      </div>
    </details>
  );
}
