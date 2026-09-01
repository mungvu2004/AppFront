/**
 * Danh sách duyệt của nửa phải — đầu danh sách DÍNH, thân cuộn được.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng props, không `@/api`, không
 * `@/store`, không `@/domain`, không `@/lib/http`.
 *
 * ## Đầu danh sách dính, và vì sao nó dính
 *
 * Bộ đếm "18/34 kích thước đã duyệt" và bộ lọc là hai thứ người duyệt phải
 * nhìn thấy ở mọi vị trí cuộn: bộ đếm nói còn bao nhiêu việc, bộ lọc nói đang
 * nhìn tập nào. Chúng nằm trong một khối `sticky top-0` bên trong chính vùng
 * cuộn, nên thứ tự DOM — đầu danh sách trước, rồi tới các hàng — cũng là thứ tự
 * tiêu điểm (I-02): Tab đi từ bộ lọc xuống hàng đầu tiên, không nhảy cóc.
 *
 * ## Không định dạng một con số nào
 *
 * `reviewProgressLabel` tới nơi đã là câu hoàn chỉnh, ghép sẵn ở hook bằng
 * `reviewProgressLabel()` của T4 (A15). File này không cộng, không chia, không
 * gọi một hàm định dạng nào — `local/no-raw-number` chặn cả ba đường.
 *
 * ## Vì sao KHÔNG dùng `Table.Row`
 *
 * `.orca-notes/S14-T2-components.contract.md` ghi `Table.Row`, `Slider` và
 * `Textarea` có vòng tiêu điểm điều khiển bằng state, thứ làm hỏng
 * `expectAccessible` (R-72). Hàng ở đây là `role="option"` thuần với
 * `focus-visible:` dạng class, đúng cách khắc phục mục đó chỉ ra và cùng cách
 * hai màn QC anh em đã chọn.
 */

import { useEffect, useRef } from 'react';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';

import { DIMENSION_OCR_TEXT } from './dimensionOcrText';
import { DimensionOcrRow } from './DimensionOcrRow';
import type {
  DimensionFilterId,
  DimensionOcrListProps,
  DimensionOcrRowProps,
} from './dimensionOcrTypes';
import { DIMENSION_FILTER_IDS } from './dimensionOcrTypes';

/**
 * Props của danh sách — mở rộng THUẦN CỘNG hợp đồng đóng băng của T3 (QĐ-7).
 *
 * Ba callback dưới đây là thứ `DimensionOcrRowProps` đòi mà `DimensionOcrListProps`
 * không mang: danh sách vẽ hàng thì phải có gì để truyền xuống hàng.
 * `dimensionOcrTypes.ts` không bị chạm tới.
 */
export interface DimensionOcrListViewProps extends DimensionOcrListProps {
  readonly onEdit: DimensionOcrRowProps['onEdit'];
  readonly onApprove: DimensionOcrRowProps['onApprove'];
  readonly onCancelEdit: DimensionOcrRowProps['onCancelEdit'];
  /**
   * Hàng DUY NHẤT đang gõ ra một giá trị vô lý, kèm câu đã ghép sẵn bằng
   * `outlierHint()` của T4. `null` khi không có hàng nào như vậy. Hook so
   * ngưỡng — view chỉ hiển thị ([CẤM TUYỆT ĐỐI], A15).
   */
  readonly outlierNotice: { readonly dimensionId: string; readonly message: string } | null;
}

/** Nhãn ba lựa chọn lọc, lấy nguyên từ T4 — không gõ câu tiếng Việt mới ở đây. */
const FILTER_LABELS: Readonly<Record<DimensionFilterId, string>> = {
  all: DIMENSION_OCR_TEXT.filter.allLabel,
  lowConfidence: DIMENSION_OCR_TEXT.filter.lowConfidenceLabel,
  unreviewed: DIMENSION_OCR_TEXT.filter.unreviewedLabel,
};

const FILTER_OPTIONS = DIMENSION_FILTER_IDS.map((id) => ({
  label: FILTER_LABELS[id],
  value: id,
}));

export function DimensionOcrList({
  rows,
  reviewProgressLabel,
  activeFilter,
  onFilterChange,
  selectedDimensionId,
  onSelect,
  isViewerRole,
  onEdit,
  onApprove,
  onCancelEdit,
  outlierNotice,
}: DimensionOcrListViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /*
    Hàng được chọn TỪ NGOÀI — bấm một chuỗi trên canvas, hoặc hook nhảy sang
    hàng sau khi duyệt — phải cuộn vào tầm nhìn, nếu không thì nửa trái và nửa
    phải nói về hai chuỗi khác nhau. `block: 'nearest'` để hàng đã nhìn thấy thì
    không giật; `behavior: 'smooth'` là chuyển động do trình duyệt điều khiển,
    API gốc không nhận tham số mili-giây nên không có con số nào để viết ra.
  */
  useEffect(() => {
    if (selectedDimensionId === null) {
      return;
    }

    const container = scrollRef.current;

    if (container === null) {
      return;
    }

    const row = container.querySelector<HTMLElement>(
      `[data-dimension-id="${selectedDimensionId}"]`,
    );

    /*
      `scrollIntoView` là API của trình duyệt thật; jsdom không cài nó, và một
      môi trường thiếu nó phải làm hàng KHÔNG cuộn chứ không làm cả màn hỏng —
      đây đúng là màn trắng mà A11 tồn tại để chặn.
    */
    if (row !== null && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedDimensionId, rows]);

  return (
    <div
      aria-label={DIMENSION_OCR_TEXT.screen.dimensionListAriaLabel}
      className="flex h-full min-h-0 flex-col"
      role="group"
    >
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        {/*
          Đầu danh sách dính. `z-10` để nó nằm trên các thẻ hàng lúc cuộn qua;
          nền đặc để chữ bên dưới không đọc xuyên lên.
        */}
        <div
          className={cn(
            'sticky top-0 z-10 flex flex-col gap-2',
            'border-b border-border-default bg-bg-surface px-3 py-2',
          )}
        >
          {/*
            A7: không có nút lưu. Bộ đếm là thứ DUY NHẤT đổi ngay sau một thao
            tác đã tự lưu, nên bọc chính nó bằng `aria-live="polite"` là cách
            nói ra trạng thái ấy cho trình đọc màn hình.
          */}
          <p aria-live="polite" className="text-[13px] text-text-secondary">
            {reviewProgressLabel}
          </p>

          <SegmentedControl
            aria-label={DIMENSION_OCR_TEXT.filter.ariaLabel}
            onChange={onFilterChange}
            options={FILTER_OPTIONS}
            value={activeFilter}
          />
        </div>

        <div className="flex flex-col gap-2 p-3" role="listbox">
          {rows.map((row) => (
            <DimensionOcrRow
              isSelected={row.id === selectedDimensionId}
              isViewerRole={isViewerRole}
              key={row.id}
              onApprove={onApprove}
              onCancelEdit={onCancelEdit}
              onEdit={onEdit}
              onSelect={onSelect}
              outlierMessage={
                outlierNotice !== null && outlierNotice.dimensionId === row.id
                  ? outlierNotice.message
                  : null
              }
              row={row}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
