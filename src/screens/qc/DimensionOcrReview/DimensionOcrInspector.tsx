/**
 * Hai mảnh của bố cục S-15 cho màn kiểm kích thước (demo Z/S-17):
 * - `DimensionOcrCanvasCard`: thẻ góc trên trái bản vẽ cho trạng thái rỗng (trạng thái
 *   CHÍNH trên dữ liệu thật: OCR đọc được 0 chuỗi) và lỗi — nguyên nhân + hai lối ra.
 * - `DimensionOcrInspector`: cột chi tiết phải — chưa chọn thì nói màn này kiểm chéo tỷ lệ,
 *   chọn một chuỗi thì dải đối chiếu (số đo lại + % lệch từ domain) và việc tiếp theo.
 * View thuần: mọi số tới nơi đã định dạng; cờ "lệch đáng kể" là của hook, không so ở đây.
 */

import { AlertCircle, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { getButtonStyles } from '@/components/ui/buttonVariants';

import { DIMENSION_INSPECTOR_TEXT, DIMENSION_OCR_TEXT } from './dimensionOcrText';
import { DimensionOcrCompareBar } from './DimensionOcrCompareBar';
import type { DimensionOcrReviewModel } from './useDimensionOcrReview';

/** Lối ra dạng liên kết mang dáng `Button` — vùng chạm đủ (BUG-325). */
const PRIMARY_LINK_CLASS = getButtonStyles({ variant: 'primary', size: 'md' });
const SECONDARY_LINK_CLASS = getButtonStyles({ variant: 'secondary', size: 'md' });

/* -------------------------------------------------------------------------- */
/* Thẻ trên bản vẽ: rỗng / lỗi.                                               */
/* -------------------------------------------------------------------------- */

interface DimensionOcrCanvasCardProps {
  readonly model: DimensionOcrReviewModel;
  readonly scaleCalibrationHref: string;
  readonly wallReviewHref: string | undefined;
}

/**
 * Đặt góc trên trái (không che giữa bản vẽ). App chưa có lệnh thêm kích thước tay
 * (CẦN BE), nên lối ra chính là "Hiệu chỉnh tỷ lệ", lối phụ là "Về duyệt tường".
 */
export function DimensionOcrCanvasCard({ model, scaleCalibrationHref, wallReviewHref }: DimensionOcrCanvasCardProps) {
  const isError = model.errorMessage !== null;

  if (!isError && model.emptyNotice === null) {
    return null;
  }

  const text = isError ? DIMENSION_OCR_TEXT.states.error : DIMENSION_OCR_TEXT.states.empty;

  return (
    <div
      className="absolute left-4 top-4 z-10 flex w-[420px] max-w-[calc(100%-32px)] flex-col items-start gap-3 rounded-xl bg-bg-surface p-5 shadow-panel"
      role={isError ? 'alert' : undefined}
    >
      <span
        aria-hidden="true"
        className={
          isError
            ? 'flex h-8 w-8 items-center justify-center rounded-lg bg-state-violation-tint text-state-violation-text'
            : 'flex h-8 w-8 items-center justify-center rounded-lg bg-bg-sunken text-text-secondary'
        }
      >
        {isError ? <AlertCircle size={18} /> : <Ruler size={18} />}
      </span>
      <h2 className="text-heading text-text-primary">{text.title}</h2>
      <p className="text-body-sm text-text-secondary">{isError ? model.errorMessage : model.emptyNotice}</p>
      <div className="flex flex-wrap items-center gap-2">
        {isError ? (
          <>
            <Button onClick={model.onRetry} type="button" variant="primary">
              {DIMENSION_OCR_TEXT.states.error.actionLabel}
            </Button>
            <Link className={SECONDARY_LINK_CLASS} to={scaleCalibrationHref}>
              {DIMENSION_OCR_TEXT.states.empty.actionLabel}
            </Link>
          </>
        ) : (
          <>
            {/* Liên kết thật tới trang tỷ lệ — mở được bằng bàn phím, chuột giữa (A12). */}
            <Link className={PRIMARY_LINK_CLASS} to={scaleCalibrationHref}>
              {DIMENSION_OCR_TEXT.states.empty.actionLabel}
            </Link>
            {wallReviewHref === undefined ? null : (
              <Link className={SECONDARY_LINK_CLASS} to={wallReviewHref}>
                {DIMENSION_INSPECTOR_TEXT.backToWallsLabel}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cột chi tiết phải.                                                         */
/* -------------------------------------------------------------------------- */

interface DimensionOcrInspectorProps {
  readonly model: DimensionOcrReviewModel;
  readonly scaleCalibrationHref: string;
}

export function DimensionOcrInspector({ model, scaleCalibrationHref }: DimensionOcrInspectorProps) {
  const selected = model.rows.find((row) => row.id === model.selectedDimensionId) ?? null;
  const compare = model.compare;

  return (
    <section
      aria-label={DIMENSION_INSPECTOR_TEXT.ariaLabel}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl bg-bg-surface shadow-panel"
    >
      {selected === null || compare === null ? (
        <div className="flex flex-col gap-3 p-4">
          <h2 className="text-heading text-text-primary">{DIMENSION_INSPECTOR_TEXT.noSelectionTitle}</h2>
          <p className="text-body-sm text-text-secondary">{DIMENSION_INSPECTOR_TEXT.noSelectionBody}</p>
          {model.scaleLabel == null ? null : (
            <dl className="flex items-baseline justify-between gap-3 text-body-sm">
              <dt className="text-text-secondary">{DIMENSION_INSPECTOR_TEXT.scaleLabel}</dt>
              <dd className="tabular-nums text-text-primary">{model.scaleLabel}</dd>
            </dl>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 p-4">
            <h2 className="font-mono text-heading text-text-primary">{selected.codeLabel}</h2>
            {selected.hostWallLabel === null ? null : (
              <p className="text-body-sm text-text-secondary">{selected.hostWallLabel}</p>
            )}
          </div>
          {/* Số đo lại + % lệch: `compareLengthToMeasured` ở hook (M-15), màn không tự tính. */}
          <DimensionOcrCompareBar
            compare={compare}
            deviationPercentValue={compare.deviationPercentValue}
            formatDeviation={compare.formatDeviation}
          />
          {/* Lệch > 2 %: việc chính là đặt lại tỷ lệ; ≤ 2 %: "Duyệt" của hàng là nút chính. */}
          {compare.isSignificant && !model.isViewerRole ? (
            <div className="flex flex-col gap-2 border-t border-border-default p-4">
              <p className="text-body-sm text-text-secondary">{DIMENSION_INSPECTOR_TEXT.rescaleHint}</p>
              <Link className={PRIMARY_LINK_CLASS} to={scaleCalibrationHref}>
                {DIMENSION_INSPECTOR_TEXT.rescaleLabel}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
