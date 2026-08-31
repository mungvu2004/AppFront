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

import type { ReactNode } from 'react';
import { Crosshair, DoorOpen, LayoutGrid, Ruler, Square } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

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

/**
 * Một hàng cây lớp — dựng tại chỗ thay vì gọi `TreeItem` dùng chung.
 *
 * `src/components/ui/TreeItem.tsx` gắn một nút con mắt bật/tắt lớp mang
 * `tabIndex={-1}` và `aria-label="Ẩn layer"`. Hai thứ đó làm hỏng hai bộ soát
 * bắt buộc của R-72 cùng lúc, và cả hai đều là lỗi thật chứ không phải chuyện
 * hình thức:
 *
 * - `tabIndex={-1}` → một nút bàn phím KHÔNG tới được, đúng thứ A12 tồn tại để
 *   chặn ("bàn phím là đường đi hạng nhất, không phải phương án dự phòng");
 * - `"Ẩn layer"` → chữ tiếng Anh trong nhãn người đọc, phạm A6/mục B.
 *
 * Màn này lại KHÔNG truyền `onToggleVisible`, nên nút đó còn không làm gì —
 * `src/components/**` nằm ngoài danh sách file được sửa (R-68), và sửa nó ở đây
 * cũng sai chỗ: bộ tên và hành vi của nó đang phục vụ những nơi gọi khác. Nên
 * màn dùng hàng của riêng nó: một `<button role="treeitem">` thật, bàn phím tới
 * được, nhãn tiếng Việt có dấu, không có nút phụ nào chết bên trong.
 *
 * Cờ hiện/ẩn lớp Tường KHÔNG mất đi — nó sống ở cây lớp của kho
 * (`hiddenLayers`), và chú giải độ dày đọc thẳng cờ đó.
 */
function WallLayerTreeRow({
  icon,
  label,
  isCurrent = false,
  onOpen,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly isCurrent?: boolean;
  readonly onOpen?: (() => void) | undefined;
}) {
  return (
    <button
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={label}
      aria-selected={isCurrent}
      className={cn(
        'flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px]',
        'transition-colors duration-120',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        isCurrent
          ? 'bg-accent-wash text-accent'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
      )}
      onClick={onOpen}
      role="treeitem"
      type="button"
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Lớp đang mở. Bốn lớp còn lại nằm ở {@link OTHER_LAYERS}. */
const WALL_LAYER_LABEL = 'Tường';

/** Bốn lớp còn lại của cây, đúng thứ tự đặc tả đọc chúng. */
const OTHER_LAYERS: readonly {
  readonly kind: WallLayerOtherKind;
  readonly label: string;
  readonly icon: ReactNode;
}[] = [
  {
    kind: 'openingsAndFurniture',
    label: 'Cửa và nội thất',
    icon: <DoorOpen className="h-4 w-4" />,
  },
  { kind: 'dimensions', label: 'Kích thước', icon: <Ruler className="h-4 w-4" /> },
  { kind: 'axes', label: 'Trục', icon: <Crosshair className="h-4 w-4" /> },
  { kind: 'rooms', label: 'Phòng', icon: <LayoutGrid className="h-4 w-4" /> },
];

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
          <WallLayerTreeRow icon={<Square className="h-4 w-4" />} isCurrent label={WALL_LAYER_LABEL} />
          {OTHER_LAYERS.map((layer) => (
            <WallLayerTreeRow
              icon={layer.icon}
              key={layer.kind}
              label={layer.label}
              onOpen={() => onNavigateLayer?.(layer.kind)}
            />
          ))}
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
