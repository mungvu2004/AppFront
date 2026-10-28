/**
 * Dải gợi ý của máy (B3) đầu danh sách: số gợi ý còn chờ, "Nhận tất cả gợi ý" và "Bỏ tất cả gợi ý".
 * View thuần — số đếm đã định dạng sẵn ở hook (A15); bỏ cả loạt có toast hoàn tác (A8).
 */

import { Button } from '@/components/ui/Button';

const ACCEPT_ALL_LABEL = 'Nhận tất cả gợi ý';
const REJECT_ALL_LABEL = 'Bỏ tất cả gợi ý';

export interface ObjectLayerSuggestionBarProps {
  /** "3 gợi ý của máy đang chờ" — đã ghép sẵn. */
  readonly label: string;
  readonly onAcceptAll: () => void;
  readonly onRejectAll: () => void;
}

export function ObjectLayerSuggestionBar({ label, onAcceptAll, onRejectAll }: ObjectLayerSuggestionBarProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-default px-3 py-2" role="group" aria-label={label}>
      <p className="text-[13px] text-text-primary">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onAcceptAll} size="sm" variant="primary">
          {ACCEPT_ALL_LABEL}
        </Button>
        <Button onClick={onRejectAll} size="sm" variant="secondary">
          {REJECT_ALL_LABEL}
        </Button>
      </div>
    </div>
  );
}
