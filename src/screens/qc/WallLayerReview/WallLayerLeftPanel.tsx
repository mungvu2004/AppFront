/**
 * Panel trái (280px) — bộ đếm duyệt, cây lớp, bộ lọc và danh sách tường ảo hoá.
 *
 * View THUẦN (R-60): nhận nguyên `WallLayerViewProps` (đúng khuôn
 * `ScaleCalibrationPanel`) và chỉ hiển thị. Bộ đếm duyệt đứng NGOÀI vùng cuộn
 * (`overflow-y-auto` chỉ bọc `WallLayerList`) để luôn nhìn thấy — đúng yêu cầu
 * "12/48 tường đã duyệt ... Luôn nhìn thấy".
 *
 * Số chạy 12→13 dùng lớp bọc React của `useCountUp`
 * (`src/hooks/useCountUp.ts` — xem `docs/contracts/ui.md` mục D để phân biệt
 * với bản kỹ thuật thuần ở `src/lib/motion`). Câu "12/48 tường đã duyệt" đã
 * ghép sẵn ở hook (`reviewProgressLabel`, A15) — chuỗi đó làm `aria-label` cho
 * trình đọc màn hình LUÔN đúng, phần hiển thị trực quan tách số ra để chạy số
 * (các mảnh `aria-hidden`, tránh trình đọc màn hình đọc hai lần).
 *
 * {@link WallLayerOtherKind}/`onNavigateLayer` là phần MỞ RỘNG ngoài
 * `types.ts` (đóng băng): năm mục cây lớp là nội dung CỐ ĐỊNH (đúng năm khoá
 * của `i18n.fragment.json#layerTree`, không phải dữ liệu nghiệp vụ), nhưng
 * điều hướng sang bốn lớp còn lại cần một callback không có trong hợp đồng L1
 * — T8/hook truyền khi ghép màn; thiếu thì bốn mục đó chỉ hiển thị, không làm
 * gì khi bấm.
 */

import { Crosshair, DoorOpen, LayoutGrid, Ruler, Square } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { TreeItem } from '@/components/ui/TreeItem';
import { useCountUp } from '@/hooks/useCountUp';

import { WallLayerList } from './WallLayerList';
import type { WallLayerFilterKey, WallLayerViewProps } from './types';

/** Bốn lớp khác ngoài "Tường" — đúng năm khoá của `i18n.fragment.json#layerTree`. */
export type WallLayerOtherKind = 'openingsAndFurniture' | 'dimensions' | 'axes' | 'rooms';

export interface WallLayerLeftPanelProps {
  readonly panel: WallLayerViewProps;
  readonly onNavigateLayer?: ((layer: WallLayerOtherKind) => void) | undefined;
}

const FILTER_LABELS: Readonly<Record<WallLayerFilterKey, string>> = {
  onlyUnreviewed: 'Chỉ hiện chưa duyệt',
  onlyLowConfidence: 'Chỉ hiện độ tin cậy thấp',
  onlyNonStandardThickness: 'Chỉ hiện độ dày không chuẩn',
};

const FILTER_KEYS: readonly WallLayerFilterKey[] = [
  'onlyUnreviewed',
  'onlyLowConfidence',
  'onlyNonStandardThickness',
];

const LAYER_TREE_ARIA_LABEL = 'Cây lớp';
const REVIEWED_SUFFIX = ' tường đã duyệt';
/** Cùng hành động với mục cây lớp "Cửa và nội thất" — xem `onNavigateLayer`. */
const SUCCESS_CONTINUE_LABEL = 'Sang lớp Cửa và nội thất';

export function WallLayerLeftPanel({ panel, onNavigateLayer }: WallLayerLeftPanelProps) {
  const { reviewCounter, reviewProgressLabel, filters, onToggleFilter } = panel;
  // Phân số tiến độ: view được PHÉP tính tại chỗ (eslint-rules/no-raw-number.js:21).
  const progressFraction = reviewCounter.total === 0 ? 0 : reviewCounter.reviewed / reviewCounter.total;
  const { text: reviewedText } = useCountUp(reviewCounter.reviewed, { format: { fractionDigits: 0 } });

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel">
      <div className="flex shrink-0 flex-col gap-4 px-5 pb-3 pt-4">
        <div aria-label={reviewProgressLabel} className="flex flex-col gap-1.5">
          <p className="text-[13px] text-text-primary">
            <span aria-hidden="true" className="font-mono font-semibold tabular-nums">
              {reviewedText}
            </span>
            <span aria-hidden="true" className="font-mono tabular-nums text-text-muted">
              /{reviewCounter.total}
            </span>
            <span aria-hidden="true" className="text-text-secondary">
              {REVIEWED_SUFFIX}
            </span>
          </p>
          <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-bg-sunken">
            <div
              className="h-full rounded-full bg-accent transition-all duration-340"
              style={{ width: `${progressFraction * 100}%` }}
            />
          </div>
        </div>

        {panel.state === 'success' && (
          <Button fullWidth onClick={() => onNavigateLayer?.('openingsAndFurniture')} variant="primary">
            {SUCCESS_CONTINUE_LABEL}
          </Button>
        )}

        <div aria-label={LAYER_TREE_ARIA_LABEL} role="tree">
          <TreeItem hasChildren={false} label="Tường" selected typeIcon={<Square className="h-4 w-4" />} />
          <TreeItem
            hasChildren={false}
            label="Cửa và nội thất"
            onClick={() => onNavigateLayer?.('openingsAndFurniture')}
            typeIcon={<DoorOpen className="h-4 w-4" />}
          />
          <TreeItem
            hasChildren={false}
            label="Kích thước"
            onClick={() => onNavigateLayer?.('dimensions')}
            typeIcon={<Ruler className="h-4 w-4" />}
          />
          <TreeItem
            hasChildren={false}
            label="Trục"
            onClick={() => onNavigateLayer?.('axes')}
            typeIcon={<Crosshair className="h-4 w-4" />}
          />
          <TreeItem
            hasChildren={false}
            label="Phòng"
            onClick={() => onNavigateLayer?.('rooms')}
            typeIcon={<LayoutGrid className="h-4 w-4" />}
          />
        </div>

        <div className="flex flex-col gap-1">
          {FILTER_KEYS.map((key) => (
            <Checkbox
              checked={filters[key]}
              key={key}
              label={FILTER_LABELS[key]}
              onChange={() => onToggleFilter(key)}
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {panel.state === 'error' && panel.errorMessage !== null && (
          <div className="px-3 pb-2 pt-1">
            <InlineAlert level="violation" message={panel.errorMessage} />
          </div>
        )}
        <WallLayerList panel={panel} />
      </div>
    </div>
  );
}
