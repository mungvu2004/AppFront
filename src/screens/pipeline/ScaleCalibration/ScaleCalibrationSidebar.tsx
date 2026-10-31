/**
 * Panel trái của màn Đặt tỷ lệ (S-11, demo Z/S-11): ba câu "làm gì / trạng thái"
 * ở đầu, rồi "Cách đặt" (phương pháp + các bước đo + phím).
 *
 * View thuần: chip và câu trạng thái lấy NGUYÊN từ `panel.scaleCheck.status` —
 * cùng đối tượng mà panel phải dùng, nên hai bên không nói hai kiểu.
 * Phương pháp bị khoá (OCR 0 chuỗi) không bày ra một nút mờ: chỉ còn một dòng
 * `methodNotice` dưới cách đo 2 điểm.
 */

import { clsx } from 'clsx';

import { PageHead } from '@/components/shell/PageHead';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Kbd } from '@/components/ui/Kbd';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

import { ScaleCalibrationMethodDimension } from './ScaleCalibrationMethodDimension';
import { ScaleCalibrationMethodReference } from './ScaleCalibrationMethodReference';
import type { ScaleCalibrationPanelProps } from './types';

const SIDEBAR_ARIA_LABEL = 'Cách đặt tỷ lệ';
const TITLE = 'Tỷ lệ bản vẽ';
const METHOD_TITLE = 'Cách đặt';
const METHOD_ARIA_LABEL = 'Chọn cách xác định tỷ lệ';
const SHORTCUTS_ARIA_LABEL = 'Phím tắt';
const SUGGESTION_ARIA_LABEL = 'Tỷ lệ máy ước lượng';

type SidebarProps = Pick<ScaleCalibrationPanelProps, 'actions' | 'panel' | 'state'>;

export function ScaleCalibrationSidebar({ actions, panel, state }: SidebarProps) {
  const isForbidden = state === 'forbidden' || panel.areActionsHidden;
  const isLoading = state === 'loading';
  const status = panel.scaleCheck?.status;
  const hasLockedMethod = panel.methodOptions.some((option) => option.isDisabled);

  return (
    <section
      aria-label={SIDEBAR_ARIA_LABEL}
      className="flex w-full flex-col border-b border-border-default bg-bg-surface xl:w-[280px] xl:shrink-0 xl:overflow-y-auto xl:border-r xl:border-b-0"
    >
      <PageHead
        className="mb-0 border-b border-border-default px-4 py-4"
        status={
          status === undefined ? undefined : (
            <span className="flex flex-col items-start gap-2">
              <Badge variant={status.tone}>{status.label}</Badge>
              <span className="text-[13px] text-text-secondary" title={panel.scaleCheck?.densityValue == null ? undefined : `${panel.scaleCheck.densityValue} mm/px`}>{status.sentence}</span>
            </span>
          )
        }
        title={TITLE}
      />

      {/* UX-R2: tầng chưa có tỷ lệ — đề nghị tỷ lệ máy ước từ độ dày tường; bấm chỉ đặt đề nghị, chưa lưu. */}
      {panel.suggestion !== undefined && !isLoading && (
        <section
          aria-label={SUGGESTION_ARIA_LABEL}
          className="flex flex-col items-start gap-2 border-b border-border-default px-4 py-3"
        >
          <p className="text-[13px] text-text-primary">{panel.suggestion.text}</p>
          {!panel.suggestion.isActive && (
            <Button disabled={isForbidden} onClick={actions.onUseSuggestedScale} size="sm" variant="secondary">
              {panel.suggestion.actionLabel}
            </Button>
          )}
        </section>
      )}

      {/* UX41 U01: máy chủ biết DPI của ảnh — nhập thẳng tỷ lệ ghi trên bản vẽ, khỏi kéo đo. */}
      {panel.ratioEntry !== undefined && !isLoading && !isForbidden && (
        <section className="flex flex-col gap-2 border-b border-border-default px-4 py-3">
          <Input
            className="font-mono text-[13px] leading-5"
            error={panel.ratioEntry.error ?? undefined}
            label={panel.ratioEntry.label}
            onChange={(event) => {
              actions.onChangeDrawingRatio?.(event.target.value);
            }}
            placeholder={panel.ratioEntry.placeholder}
            value={panel.ratioEntry.text}
          />
        </section>
      )}

      {/* UX-R4 U11: brochure không ghi số kích thước nhưng in diện tích căn — gõ diện tích, máy suy tỷ lệ. */}
      {panel.areaEntry !== undefined && !isLoading && !isForbidden && (
        <section className="flex flex-col gap-2 border-b border-border-default px-4 py-3">
          <Input
            className="font-mono text-[13px] leading-5"
            error={panel.areaEntry.error ?? undefined}
            hint={panel.areaEntry.hint}
            inputMode="decimal"
            label={panel.areaEntry.label}
            onChange={(event) => {
              actions.onChangeFlatArea?.(event.target.value);
            }}
            placeholder={panel.areaEntry.placeholder}
            value={panel.areaEntry.text}
          />
        </section>
      )}

      {/* UX-R4 U06: ảnh chụp/JPG — nói một câu vì sao ghi chú "TL 1/N" không dùng được. */}
      {panel.ratioEntry === undefined && panel.ratioPhotoNotice !== undefined && !isLoading && !isForbidden && (
        <p className="border-b border-border-default px-4 py-3 text-[13px] text-text-secondary">
          {panel.ratioPhotoNotice}
        </p>
      )}

      {/* UX41 U46: người xem không sửa được — không bày ô nhập/nút đo mờ; dải trên bản vẽ đã nói nhờ ai. */}
      {!isForbidden && (
      <div className="flex flex-col gap-3 px-4 py-4">
        <h3 className="text-[13px] font-medium text-text-secondary">{METHOD_TITLE}</h3>
        {!hasLockedMethod && (
          <SegmentedControl
            aria-label={METHOD_ARIA_LABEL}
            disabled={isForbidden}
            isLoading={isLoading}
            onChange={actions.onChangeMethod}
            options={panel.methodOptions.map((option) => ({ label: option.label, value: option.value }))}
            value={panel.method}
          />
        )}
        {!isLoading && (
          <section
            aria-disabled={isForbidden || panel.isMethodLocked}
            className={clsx((isForbidden || panel.isMethodLocked) && 'pointer-events-none opacity-60')}
          >
            {panel.method === 'dimensionString' ? (
              <ScaleCalibrationMethodDimension
                actions={{
                  onHoverDimensionRow: actions.onHoverDimensionRow,
                  onSelectDimensionRow: actions.onSelectDimensionRow,
                  ...(actions.onZoomToNumbers === undefined ? {} : { onZoomToNumbers: actions.onZoomToNumbers }),
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
                    onPlaceSegment: actions.onPlaceSegment,
                    onRemeasure: actions.onRemeasure,
                  }}
                  reference={panel.reference}
                />
                {panel.shortcutHints.length > 0 && (
                  /* Dưới 640 px (màn chạm) không có bàn phím để bấm: ẩn danh sách phím (BUG-633). */
                  <details className="mt-3 max-sm:hidden">
                    <summary className="cursor-pointer text-[13px] font-medium text-text-secondary">{SHORTCUTS_ARIA_LABEL}</summary>
                  <ul aria-label={SHORTCUTS_ARIA_LABEL} className="mt-2 flex flex-col gap-1.5">
                    {panel.shortcutHints.map((hint) => (
                      <li className="flex items-center gap-2 text-[13px] text-text-secondary" key={hint.id}>
                        <Kbd>{hint.comboLabel}</Kbd>
                        <span>{hint.description}</span>
                      </li>
                    ))}
                  </ul>
                  </details>
                )}
              </>
            )}
          </section>
        )}
        {!isLoading && panel.methodNotice && (
          <p className="text-[13px] text-text-secondary">{panel.methodNotice}</p>
        )}
      </div>
      )}
    </section>
  );
}
