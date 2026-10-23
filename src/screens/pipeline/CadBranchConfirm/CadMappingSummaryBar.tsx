/**
 * Dòng tóm tắt chân màn của giai đoạn 2 (tách khỏi `CadBranchConfirm.tsx` cho trần 400 dòng).
 */

import { Button } from '@/components/ui/Button';
import { useCountUp } from '@/hooks/useCountUp';
import type { NumberFormatOptions } from '@/lib/format/number';

import { IMPORT_BUTTON_LABEL } from './cadBranchConfirmText';
import type { CadMappingSummary } from './types';

const SUMMARY_ARIA_LABEL = 'Tóm tắt số lớp đã ánh xạ';

const IMPORT_REASON_ID = 'cad-import-disabled-reason';

/** Dấu ngăn hai vế của dòng tóm tắt, cùng dấu bảng lớp dùng cho dòng gợi ý. */
const SUMMARY_SEPARATOR = ' · ';

/**
 * Số đối tượng là số đếm: không phần thập phân nào có nghĩa ở đây.
 *
 * Hằng nằm ngoài thân hàm để tham chiếu của nó đứng yên giữa hai lượt render —
 * `useCountUp` đọc từng trường của nó, nhưng một đối tượng dựng lại mỗi lần
 * render vẫn là thứ không cần thiết.
 */
const COUNT_FORMAT: NumberFormatOptions = { fractionDigits: 0 };

/* -------------------------------------------------------------------------- */
/* Dòng tóm tắt chân màn.                                                       */
/* -------------------------------------------------------------------------- */

interface CadMappingSummaryBarProps {
  readonly summary: CadMappingSummary;
  readonly canImportGeometry: boolean;
  readonly disabledReason: string | null;
  readonly isImporting: boolean;
  readonly prefersReducedMotion: boolean;
  readonly onImportGeometry: () => void;
}

/**
 * Chân màn: con số chạy, câu tóm tắt của hook, nút "Nhập hình học".
 *
 * Tách thành hàm riêng vì `useCountUp` là một hook — nó không được gọi trong một
 * nhánh điều kiện, mà dòng tóm tắt chỉ tồn tại ở giai đoạn 2
 * (`model.summary === null` ở giai đoạn 1).
 */
export function CadMappingSummaryBar({
  canImportGeometry,
  disabledReason,
  isImporting,
  onImportGeometry,
  prefersReducedMotion,
  summary,
}: CadMappingSummaryBarProps) {
  const runningObjectCount = useCountUp(summary.objectCount, {
    format: COUNT_FORMAT,
    reducedMotion: prefersReducedMotion,
  });

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <span
          aria-hidden="true"
          className="font-mono text-[20px] leading-none tabular-nums text-text-primary"
        >
          {runningObjectCount.text}
        </span>
        <p aria-label={SUMMARY_ARIA_LABEL} className="text-[13px] text-text-secondary" role="status">
          {summary.mappedCountLabel}
          {SUMMARY_SEPARATOR}
          {summary.objectCountLabel}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button
          {...(disabledReason !== null ? { 'aria-describedby': IMPORT_REASON_ID } : {})}
          disabled={!canImportGeometry}
          loading={isImporting}
          onClick={onImportGeometry}
          variant="primary"
        >
          {IMPORT_BUTTON_LABEL}
        </Button>
        {disabledReason !== null ? (
          <p className="text-[12px] text-text-secondary" id={IMPORT_REASON_ID}>
            {disabledReason}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
