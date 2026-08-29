/**
 * Panel phải 344px của màn Hiệu chỉnh tỷ lệ — hoặc tấm trượt đáy dưới 1024px.
 *
 * View thuần (R-60, mục D): mọi chuỗi đã định dạng xong ở `useScaleCalibration`
 * (A15); file này chỉ đặt chúng xuống theo đúng thứ tự đặc tả — tỷ lệ hiện tại,
 * cách xác định, khối phương pháp, khối đối chiếu (luôn hiện đủ ba phần của
 * phép tính, không rút gọn), ba dòng kiểm chứng, cảnh báo, rồi chân panel.
 * Không hộp thoại nào được dựng ở đây.
 *
 * ## Tấm trượt đáy dưới 1024px
 *
 * Container luôn mang cả hai bộ lớp: cố định đáy màn hình + bo góc trên (mặc
 * định), và một bộ `lg:` đưa nó về panel tĩnh 344px cắm cạnh canvas — đúng
 * khuôn `InputQualityGate.tsx:66-69`. Đây là CSS thuần, không viết media query
 * tay và không hằng số breakpoint (R-71). `isCompact` không lái CSS: nó chỉ
 * chọn `aria-label` đúng ngữ nghĩa (bảng hay tấm trượt) cho trình đọc màn hình,
 * vì hai thứ trông giống nhau ở khung hẹp nhưng không cùng vai trò.
 *
 * ## `forbidden` làm khối phương pháp "hiện nhưng không tương tác được"
 *
 * `ScaleCalibrationMethodDimensionProps` và `ScaleCalibrationMethodReferenceProps`
 * không có cờ `disabled` — hợp đồng đã đóng băng. Panel bọc phần con bằng một lớp
 * `pointer-events-none` khi `state === 'forbidden'` thay vì đổi kiểu con, cùng
 * lý lẽ `areActionsHidden` ẩn hẳn chân trang: quyền hạn đứng ở lớp bọc, không
 * đứng ở từng ô bấm riêng lẻ.
 */

import { clsx } from 'clsx';

import { InlineAlert, type InlineAlertLevel } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { Kbd } from '@/components/ui/Kbd';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

import { ScaleCalibrationMethodDimension } from './ScaleCalibrationMethodDimension';
import { ScaleCalibrationMethodReference } from './ScaleCalibrationMethodReference';
import type { ScaleCalibrationPanelProps } from './types';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

const PANEL_ARIA_LABEL = 'Bảng hiệu chỉnh tỷ lệ';
const SHEET_ARIA_LABEL = 'Tấm trượt hiệu chỉnh tỷ lệ';
const TITLE = 'Hiệu chỉnh tỷ lệ';
const COLLAPSE_LABEL = 'Thu gọn bảng';
const EXPAND_LABEL = 'Bung bảng';
const SUCCESS_BADGE = 'đã duyệt';

const CURRENT_SCALE_TITLE = 'Tỷ lệ hiện tại';
const METHOD_TITLE = 'Cách xác định';
const METHOD_ARIA_LABEL = 'Chọn cách xác định tỷ lệ';
const SHORTCUTS_ARIA_LABEL = 'Phím tắt';
const COMPUTATION_TITLE = 'Kết quả';
const COMPUTATION_ARIA_LABEL = 'Phép tính ra tỷ lệ';
const COMPUTATION_DIVIDER = '÷';
const COMPUTATION_EQUALS = '=';
const COMPUTATION_INCOMPLETE = 'Còn thiếu một vế, nên chưa ra được tỷ lệ.';
const CROSS_CHECKS_TITLE = 'Kiểm chứng';
const CROSS_CHECKS_ARIA_LABEL = 'Ba đại lượng dẫn xuất để kiểm chứng tỷ lệ';
const WARNING_ARIA_LABEL = 'Cảnh báo về tỷ lệ';
const APPLY_PRIMARY = 'Áp dụng tỷ lệ';
const APPLY_APPLYING = 'Đang áp tỷ lệ…';
const SCOPE_ARIA_LABEL = 'Phạm vi áp tỷ lệ';

const PANEL_CONTAINER_CLASSES = clsx(
  'fixed inset-x-0 bottom-0 z-10 flex max-h-[70vh] w-full flex-col overflow-y-auto',
  'rounded-t-[16px] border-t border-border-default bg-bg-surface shadow-overlay',
  'lg:static lg:z-auto lg:w-[344px] lg:max-h-none lg:flex-shrink-0 lg:overflow-visible',
  'lg:rounded-none lg:border-0 lg:border-l lg:shadow-none',
);

/** Cùng bảng ánh xạ mà `ScaleCalibrationMethodReference` dùng — cảnh báo ở màn này luôn `'attention'`. */
function toAlertLevel(statusCode: ViewStatusCode): InlineAlertLevel {
  return statusCode === 'neutral' ? 'attention' : statusCode;
}

export function ScaleCalibrationPanel({
  actions,
  isCollapsed,
  isCompact,
  panel,
  state,
}: ScaleCalibrationPanelProps) {
  const isForbidden = state === 'forbidden';
  const isLoading = state === 'loading';

  return (
    <section aria-label={isCompact ? SHEET_ARIA_LABEL : PANEL_ARIA_LABEL} className={PANEL_CONTAINER_CLASSES}>
      <header className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[16px] font-semibold text-text-primary">{TITLE}</h2>
          {panel.statusCode === 'verified' && (
            <span className="shrink-0 rounded-full bg-state-verified-tint px-2 py-0.5 text-[12px] font-medium text-state-verified-text">
              {SUCCESS_BADGE}
            </span>
          )}
        </div>
        <Button onClick={actions.onToggleCollapsed} size="sm" variant="ghost">
          {isCollapsed ? EXPAND_LABEL : COLLAPSE_LABEL}
        </Button>
      </header>

      {!isCollapsed && (
        <div className="flex flex-col gap-6 px-4 py-4">
          <section aria-label={CURRENT_SCALE_TITLE} className="flex flex-col gap-1">
            <h3 className="text-[13px] font-medium text-text-secondary">{CURRENT_SCALE_TITLE}</h3>
            {isLoading ? (
              <Skeleton preset="property-panel" />
            ) : (
              <>
                <p className="font-mono text-[20px] font-semibold tabular-nums text-text-primary">
                  {panel.currentScaleLabel}
                </p>
                <p className="text-[13px] text-text-secondary">{panel.derivedLine}</p>
              </>
            )}
          </section>

          <section aria-label={METHOD_TITLE} className="flex flex-col gap-2">
            <h3 className="text-[13px] font-medium text-text-secondary">{METHOD_TITLE}</h3>
            <SegmentedControl
              aria-label={METHOD_ARIA_LABEL}
              disabled={isForbidden}
              isLoading={isLoading}
              onChange={actions.onChangeMethod}
              options={panel.methodOptions.map((option) => ({
                disabled: option.isDisabled,
                label: option.label,
                value: option.value,
              }))}
              value={panel.method}
            />
            {!isLoading && panel.methodNotice && (
              <p className="text-[13px] text-text-secondary">{panel.methodNotice}</p>
            )}
          </section>

          {!isLoading && (
            <>
              <section
                aria-disabled={isForbidden}
                className={clsx(isForbidden && 'pointer-events-none opacity-60')}
              >
                {panel.method === 'dimensionString' ? (
                  <ScaleCalibrationMethodDimension
                    actions={{
                      onHoverDimensionRow: actions.onHoverDimensionRow,
                      onSelectDimensionRow: actions.onSelectDimensionRow,
                    }}
                    dimension={panel.dimension}
                  />
                ) : (
                  <>
                    <ScaleCalibrationMethodReference
                      actions={{
                        onChangeRealLength: actions.onChangeRealLength,
                        onConfirmRealLength: actions.onConfirmRealLength,
                        onNudgeEndpoint: actions.onNudgeEndpoint,
                        onRemeasure: actions.onRemeasure,
                      }}
                      reference={panel.reference}
                    />
                    {panel.shortcutHints.length > 0 && (
                      <ul aria-label={SHORTCUTS_ARIA_LABEL} className="mt-3 flex flex-col gap-1.5">
                        {panel.shortcutHints.map((hint) => (
                          <li className="flex items-center gap-2 text-[13px] text-text-secondary" key={hint.id}>
                            <Kbd>{hint.comboLabel}</Kbd>
                            <span>{hint.description}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>

              <section aria-label={COMPUTATION_ARIA_LABEL} className="flex flex-col gap-1">
                <h3 className="text-[13px] font-medium text-text-secondary">{COMPUTATION_TITLE}</h3>
                <div className="flex flex-wrap items-baseline gap-2 font-mono text-[16px] text-text-primary">
                  <span>{panel.computation.numeratorLabel}</span>
                  <span aria-hidden="true">{COMPUTATION_DIVIDER}</span>
                  <span>{panel.computation.denominatorLabel}</span>
                  <span aria-hidden="true">{COMPUTATION_EQUALS}</span>
                  <span className="font-semibold">{panel.computation.resultLabel}</span>
                </div>
                {!panel.computation.isComplete && (
                  <p className="text-[12px] text-text-muted">{COMPUTATION_INCOMPLETE}</p>
                )}
              </section>

              <section aria-label={CROSS_CHECKS_ARIA_LABEL} className="flex flex-col">
                <h3 className="mb-1 text-[13px] font-medium text-text-secondary">{CROSS_CHECKS_TITLE}</h3>
                {panel.crossChecks.map((row, index) => (
                  <FieldRow isLast={index === panel.crossChecks.length - 1} key={row.id} label={row.label}>
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={clsx(
                          'font-mono text-[13px]',
                          row.statusCode === 'attention' ? 'text-state-attention-text' : 'text-text-primary',
                        )}
                      >
                        {row.valueLabel}
                      </span>
                      <span className="text-[12px] text-text-muted">{row.expectedRangeLabel}</span>
                    </div>
                  </FieldRow>
                ))}
              </section>

              {panel.warnings.length > 0 && (
                <section aria-label={WARNING_ARIA_LABEL} className="flex flex-col gap-2">
                  {panel.warnings.map((notice, index) => (
                    <InlineAlert
                      key={`${notice.warning.kind}-${String(index)}`}
                      level={toAlertLevel(notice.statusCode)}
                      message={notice.message}
                    />
                  ))}
                </section>
              )}
            </>
          )}

          {!panel.areActionsHidden && (
            <div className="flex flex-col gap-3 border-t border-border-default pt-4">
              <SegmentedControl
                aria-label={SCOPE_ARIA_LABEL}
                onChange={actions.onChangeApplyScope}
                options={panel.applyScopeOptions.map((option) => ({ label: option.label, value: option.value }))}
                value={panel.applyScope}
              />
              <Button
                disabled={!panel.canApply}
                fullWidth
                loading={panel.isApplying}
                onClick={actions.onApply}
                variant="primary"
              >
                {panel.isApplying ? APPLY_APPLYING : APPLY_PRIMARY}
              </Button>
              <p className="text-[12px] text-text-muted">{panel.recalculationCaption}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
