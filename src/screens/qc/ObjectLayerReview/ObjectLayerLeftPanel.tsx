/**
 * Panel trái (280px) của màn QC "Lớp đối tượng" — bộ đếm duyệt, cây ba lớp con,
 * và hàng chip lọc theo tám loại.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng
 * {@link ObjectLayerLeftPanelViewProps} và ra bằng hai callback; không `@/api`,
 * không `@/store`, không `@/domain`, không `@/lib/http`.
 *
 * ## 21 = 9 + 7 + 5, và không một con số nào viết tay
 *
 * Ba số đếm của cây lớp và tổng của nó đều đọc từ `counts`, thứ mà
 * `createObjectLayerCounts` của `objectLayerTypes.ts` dựng — hàm DUY NHẤT cộng
 * ba lớp con lại, nên `total` không thể lệch khỏi tổng ba số con. Bộ đếm duyệt
 * đọc `reviewCounter`. Panel này không cộng, không trừ, không gõ một con số
 * nghiệp vụ nào ra: sai số ở đây là sai số ở "21 phải đúng ở mọi nơi xuất
 * hiện", đúng thứ CẤM TUYỆT ĐỐI của đặc tả gốc nói tới.
 *
 * ## Vì sao KHÔNG dùng `TreeItem` dùng chung
 *
 * `src/components/ui/TreeItem.tsx` là component đúng nghĩa cho một cây lớp, và
 * nó có sẵn cả `colorChip` lẫn `count` — hai thứ màn này cần. Nhưng nút con mắt
 * bật/tắt lớp của nó mang `tabIndex={-1}` và `aria-label="Ẩn layer"`, và cả hai
 * đều là lỗi thật ở màn này chứ không phải chuyện hình thức:
 *
 * - `tabIndex={-1}` → một nút bàn phím KHÔNG tới được, đúng thứ A12 tồn tại để
 *   chặn. Ba lớp con của màn này BẮT BUỘC bật tắt được, nên đó là ba nút chết.
 * - `"Ẩn layer"` → chữ tiếng Anh trong nhãn người đọc, phạm A6 và mục B.
 *
 * `src/components/**` nằm ngoài danh sách file được sửa (R-68), và sửa nó ở đây
 * cũng sai chỗ: bộ tên và hành vi đó đang phục vụ những nơi gọi khác. Nên panel
 * này dùng hàng của riêng nó — một `<button role="treeitem">` thật, bàn phím
 * tới được, nhãn tiếng Việt có dấu. Đây là kết luận màn tường anh em đã đi tới
 * trước và ghi lại nguyên văn ở `WallLayerLeftPanel.tsx:97-117`; không phải một
 * quyết định mới.
 */

import { Eye, EyeOff } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import type { ObjectLayerLeftPanelViewProps } from './objectLayerSymbols';
import { OBJECT_LAYER_COLOR_TOKENS } from './objectLayerSymbols';
import type { ObjectLayerCounts, ObjectLayerId, ObjectSubtype } from './objectLayerTypes';
import {
  OBJECT_LAYER_IDS,
  OBJECT_LAYER_LABELS,
  OBJECT_SUBTYPES,
  OBJECT_SUBTYPE_LABELS,
} from './objectLayerTypes';

/* Chuỗi tiếng Việt tĩnh — chép từ `.orca-notes/S13-SPEC-GOC.md` phần IV (A6). */

const REVIEWED_SUFFIX = ' đối tượng đã duyệt';
const LAYER_TREE_LABEL = 'cây lớp';
const TOTAL_PREFIX = 'tổng ';
const TOTAL_SUFFIX = ' đối tượng';
const FILTER_ROW_LABEL = 'lọc theo loại';
const SHOW_LAYER_PREFIX = 'Hiện lớp ';
const HIDE_LAYER_PREFIX = 'Ẩn lớp ';

/** Số đếm của một lớp con, đọc từ `counts` — không cộng lại ở view. */
const LAYER_COUNT_READERS: Readonly<Record<ObjectLayerId, (counts: ObjectLayerCounts) => number>> = {
  door: (counts) => counts.doorCount,
  window: (counts) => counts.windowCount,
  furniture: (counts) => counts.furnitureCount,
};

/* -------------------------------------------------------------------------- */
/* Một hàng cây lớp.                                                           */
/* -------------------------------------------------------------------------- */

interface ObjectLayerTreeRowProps {
  readonly layer: ObjectLayerId;
  readonly count: number;
  readonly isVisible: boolean;
  readonly onToggle: (layer: ObjectLayerId) => void;
}

/**
 * Một lớp con: ô màu, nhãn, số đếm, và nút con mắt bật/tắt.
 *
 * Nút con mắt đứng CẠNH hàng, không lồng trong nó: một `<button>` bên trong một
 * `<button>` không hợp lệ, và trình đọc màn hình sẽ chỉ thấy một trong hai. Vỏ
 * ngoài mang `role="none"` để cây lớp vẫn thấy `treeitem` là con trực tiếp.
 */
function ObjectLayerTreeRow({ layer, count, isVisible, onToggle }: ObjectLayerTreeRowProps) {
  const label = OBJECT_LAYER_LABELS[layer];

  return (
    <div className="flex items-center gap-1" role="none">
      <button
        aria-label={label}
        aria-selected={false}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px]',
          'transition-colors duration-120',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          isVisible ? 'text-text-primary' : 'text-text-muted',
          'hover:bg-bg-hover',
        )}
        onClick={() => onToggle(layer)}
        role="treeitem"
        type="button"
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-sm border border-border-default/50"
          style={{ backgroundColor: OBJECT_LAYER_COLOR_TOKENS[layer] }}
        />
        <span className="truncate">{label}</span>
        <span className="ml-auto shrink-0 font-mono tabular-nums text-text-muted">({count})</span>
      </button>
      <button
        aria-label={`${isVisible ? HIDE_LAYER_PREFIX : SHOW_LAYER_PREFIX}${label}`}
        aria-pressed={isVisible}
        className={cn(
          'shrink-0 rounded-[8px] p-1.5 text-text-secondary',
          'transition-colors duration-120 hover:bg-bg-hover hover:text-text-primary',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
        onClick={() => onToggle(layer)}
        type="button"
      >
        {isVisible ? (
          <Eye aria-hidden="true" className="h-4 w-4" />
        ) : (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel.                                                                      */
/* -------------------------------------------------------------------------- */

export function ObjectLayerLeftPanel({
  counts,
  furnitureAttentionNotice,
  layerVisibility,
  onToggleLayer,
  onToggleSubtypeFilter,
  reviewCounter,
  reviewProgressLabel,
  subtypeFilters,
}: ObjectLayerLeftPanelViewProps) {
  // Phân số tiến độ: view được PHÉP tính tại chỗ (eslint-rules/no-raw-number.js:21).
  const progressFraction =
    reviewCounter.total === 0 ? 0 : reviewCounter.reviewed / reviewCounter.total;
  const { text: reviewedText } = useCountUp(reviewCounter.reviewed, {
    format: { fractionDigits: 0 },
  });
  /*
   * Xong thì bộ đếm ĐỔI HÌNH THỨC, không chỉ đứng ở 21/21.
   *
   * A5 vẫn nguyên: xanh "đã xác minh" ở đây chỉ xuất hiện vì `reviewed ===
   * total` — tức là việc của người duyệt — chứ không vì một điểm số nào của AI.
   */
  const isComplete = reviewCounter.total > 0 && reviewCounter.reviewed === reviewCounter.total;

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col gap-4 overflow-y-auto rounded-[12px] bg-bg-surface px-5 py-4 shadow-panel">
      {/*
        Bộ đếm duyệt. Câu "9/21 đối tượng đã duyệt" đã ghép sẵn ở hook
        (`reviewProgressLabel`, A15) và làm `aria-label` cho trình đọc màn hình,
        nên nó LUÔN đúng; phần nhìn thấy tách số ra để chạy số, và các mảnh của
        nó mang `aria-hidden` để trình đọc màn hình không đọc hai lần.
      */}
      <div aria-label={reviewProgressLabel} className="flex flex-col gap-1.5">
        <p className="text-[13px] text-text-primary">
          <span
            aria-hidden="true"
            className={cn(
              'font-mono font-semibold tabular-nums',
              isComplete && 'text-state-verified',
            )}
          >
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
            className={cn(
              'h-full rounded-full transition-all duration-340',
              isComplete ? 'bg-state-verified' : 'bg-accent',
            )}
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>
      </div>

      {/* Cây lớp: ba lớp con bật tắt được, mỗi lớp một ô màu và một số đếm. */}
      <div className="flex flex-col gap-0.5">
        <div aria-label={LAYER_TREE_LABEL} className="flex flex-col gap-0.5" role="tree">
          {OBJECT_LAYER_IDS.map((layer) => (
            <ObjectLayerTreeRow
              count={LAYER_COUNT_READERS[layer](counts)}
              isVisible={layerVisibility[layer]}
              key={layer}
              layer={layer}
              onToggle={onToggleLayer}
            />
          ))}
        </div>

        {/*
          Nhánh nội thất lỗi trong khi cửa vẫn xong (trạng thái 3b): MỘT HÀNG cần
          chú ý dưới đúng lớp nội thất, không phải một màn lỗi. Hai lớp cửa bên
          trên vẫn bật tắt và vẫn duyệt được bình thường.
        */}
        {furnitureAttentionNotice === null ? null : (
          <div className="pl-2 pt-1">
            <InlineAlert level="attention" message={furnitureAttentionNotice} />
          </div>
        )}

        <p className="px-2 pt-2 text-[12px] text-text-muted">
          {TOTAL_PREFIX}
          <span className="font-mono tabular-nums text-text-secondary">{counts.total}</span>
          {TOTAL_SUFFIX}
        </p>
      </div>

      {/*
        Hàng chip lọc theo tám loại con. Chip đang bật mang `aria-pressed`, nên
        trạng thái của nó không chỉ nằm ở màu — một bộ lọc mà chỉ màu nói ra là
        một bộ lọc người dùng trình đọc màn hình không biết mình đang bật.
      */}
      <div aria-label={FILTER_ROW_LABEL} className="flex flex-wrap gap-1.5" role="group">
        {OBJECT_SUBTYPES.map((subtype: ObjectSubtype) => {
          const isOn = subtypeFilters.has(subtype);

          return (
            <button
              aria-pressed={isOn}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[12px]',
                'transition-colors duration-120',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isOn
                  ? 'border-accent bg-accent-wash text-accent'
                  : 'border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
              key={subtype}
              onClick={() => onToggleSubtypeFilter(subtype)}
              type="button"
            >
              {OBJECT_SUBTYPE_LABELS[subtype]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
