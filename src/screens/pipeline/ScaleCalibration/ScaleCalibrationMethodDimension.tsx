/**
 * Khối "từ chuỗi kích thước" của panel Hiệu chỉnh tỷ lệ — phương pháp 1.
 *
 * View thuần (R-60): mọi chuỗi hiện ra đã được `useScaleCalibration` định dạng
 * xong (A15) — `valueLabel`, `pixelLengthLabel` là chữ đã ghép, không con số
 * nào bị làm tròn hay đổi đơn vị ở đây. Hai chuỗi tĩnh duy nhất trong file này
 * (đơn vị "mm" và hậu tố "đo được") là chữ cố định, không phải phép định dạng.
 *
 * Hàng bấm được bằng `<button role="option">` nên Enter/Space chọn được ngay
 * không cần thêm dây; phím lên/xuống di chuyển tiêu điểm giữa các hàng — cùng
 * khuôn `SegmentedControl.tsx:129-142` áp cho trục dọc thay vì trục ngang.
 */

import { useRef } from 'react';
import { clsx } from 'clsx';
import { Ruler } from 'lucide-react';

import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';

import type { ScaleCalibrationMethodDimensionProps, ScaleDimensionMethodViewModel } from './types';

const LIST_ARIA_LABEL = 'Các chuỗi kích thước đã đọc được';
const ROW_ARIA_LABEL_PREFIX = 'Chuỗi kích thước ';
const UNIT_MM = 'mm';
const MEASURED_SUFFIX = 'đo được';

const EMPTY_TITLE = 'Chưa đọc được chuỗi kích thước nào';
const EMPTY_DESCRIPTION_FALLBACK =
  'OCR không tìm thấy chuỗi kích thước nào trên bản vẽ này. Vẽ một đường tham chiếu dọc cạnh đã biết để đặt tỷ lệ bằng tay.';

type ManualCalibrationReason = NonNullable<ScaleDimensionMethodViewModel['manualCalibrationReason']>;

const MANUAL_CALIBRATION_REASON_TEXT: Record<ManualCalibrationReason, string> = {
  tooFewSamples: 'Chưa đủ chuỗi kích thước để suy ra tỷ lệ, nên phải đặt bằng tay.',
  lowConfidence: 'Độ tin cậy chung còn thấp, nên tỷ lệ phải được xác nhận bằng tay.',
};

/** Di chuyển tiêu điểm giữa các hàng bằng mũi tên lên/xuống — không đổi lựa chọn. */
function focusAdjacentRow(list: HTMLUListElement | null, direction: 1 | -1): void {
  const buttons = list?.querySelectorAll<HTMLButtonElement>('button[role="option"]');
  if (!buttons || buttons.length === 0) {
    return;
  }

  const currentIndex = Array.from(buttons).findIndex((button) => button === document.activeElement);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus();
}

export function ScaleCalibrationMethodDimension({ actions, dimension }: ScaleCalibrationMethodDimensionProps) {
  const listRef = useRef<HTMLUListElement>(null);

  if (dimension.rows.length === 0) {
    return (
      <EmptyState
        description={dimension.emptyNotice ?? EMPTY_DESCRIPTION_FALLBACK}
        icon={<Ruler aria-hidden="true" />}
        title={EMPTY_TITLE}
      />
    );
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    focusAdjacentRow(listRef.current, event.key === 'ArrowDown' ? 1 : -1);
  };

  return (
    <div className="flex flex-col gap-3">
      {dimension.lowConfidenceNotice && (
        <InlineAlert level="attention" message={dimension.lowConfidenceNotice} />
      )}
      {dimension.manualCalibrationReason && (
        <p className="text-[13px] text-text-secondary">
          {MANUAL_CALIBRATION_REASON_TEXT[dimension.manualCalibrationReason]}
        </p>
      )}

      <ul aria-label={LIST_ARIA_LABEL} className="flex flex-col gap-1.5" onKeyDown={handleKeyDown} ref={listRef}>
        {dimension.rows.map((row) => {
          const isSelected = dimension.selectedRowId === row.id;

          return (
            <li key={row.id}>
              <button
                aria-label={`${ROW_ARIA_LABEL_PREFIX}${row.valueLabel} ${UNIT_MM}`}
                aria-selected={isSelected}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-[8px] border px-3 py-2 text-left outline-none transition-colors duration-standard',
                  'hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
                  isSelected ? 'border-accent bg-accent-wash' : 'border-border-default bg-bg-surface',
                  row.isLowConfidence && 'bg-state-attention-tint',
                )}
                onBlur={() => actions.onHoverDimensionRow(null)}
                onClick={() => actions.onSelectDimensionRow(row.id)}
                onFocus={() => actions.onHoverDimensionRow(row.id)}
                onMouseEnter={() => actions.onHoverDimensionRow(row.id)}
                onMouseLeave={() => actions.onHoverDimensionRow(null)}
                role="option"
                type="button"
              >
                <span
                  className={clsx(
                    'flex-1 truncate font-mono text-[14px]',
                    row.isLowConfidence ? 'text-state-attention-text line-through' : 'text-text-primary',
                  )}
                >
                  {row.valueLabel} {UNIT_MM}
                </span>
                <ConfidenceMeter noTooltip value={row.confidence} />
                <span className="shrink-0 whitespace-nowrap text-[12px] text-text-muted">
                  {row.pixelLengthLabel} {MEASURED_SUFFIX}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
