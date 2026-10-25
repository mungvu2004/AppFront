/**
 * Panel phải — thanh tra đoạn đang chọn (demo Z/S-15): mã + trạng thái → khối độ dày đo (số lớn
 * + một câu so với chuẩn) → đổi độ dày ba lựa chọn → thông số → nút theo loại đoạn.
 *
 * View THUẦN (R-60): mọi chuỗi số (`lengthLabel`, câu so chuẩn…) đã định dạng ở hook (A15).
 * Độ dày là `SegmentedControl` ba lựa chọn — CẤM ô nhập số tự do; menu "Đổi độ dày" đưa focus
 * vào đó (BUG-604). "Độ tin cậy" ẩn khi mọi đoạn cùng một giá trị (không giúp quyết định).
 */

import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { wallStrokeToken } from '@/components/canvas/materialMap';
import { AnimatePresence, motion } from '@/components/motion';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { FieldRow } from '@/components/ui/FieldRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { WallLayerViewProps, WallThicknessChoice } from './types';
import { WallLayerInspectorActions } from './WallLayerInspectorActions';
import type { WallReviewQueue } from './wallReviewQueue';

export interface WallLayerInspectorProps {
  readonly panel: WallLayerViewProps;
  readonly queue?: WallReviewQueue | undefined;
}

const PANEL_TITLE = 'Đoạn tường';
const ADVANCED_TITLE = 'Thông số nâng cao';
const LENGTH_LABEL = 'Chiều dài';
const HEIGHT_LABEL = 'Chiều cao';
const CONFIDENCE_LABEL = 'Độ tin cậy';
const MATERIAL_LABEL = 'Vật liệu';
const ELEVATION_OFFSET_LABEL = 'Lệch Z';
const START_POINT_LABEL = 'Toạ độ đầu';
const END_POINT_LABEL = 'Toạ độ cuối';
const THICKNESS_ARIA_LABEL = 'Độ dày tường';
const MEASURED_LABEL = 'Độ dày đo được';
const CHANGE_THICKNESS_LABEL = 'Đổi độ dày';
const NON_STANDARD_LABEL = 'Không chuẩn';
const REVIEWED_LABEL = 'Đã duyệt';
const UNREVIEWED_LABEL = 'Chưa duyệt';
const REMAINING_SUFFIX = 'tường còn chờ duyệt';
const MULTI_SELECT_HINT = 'Giữ Ctrl hoặc Shift khi bấm để chọn nhiều đoạn, ví dụ để nối hai đoạn.';
const EMPTY_MESSAGE =
  'Chọn một đoạn tường trên bản vẽ hoặc trong danh sách, hoặc bấm J để mở đoạn đầu tiên cần duyệt.';

function ReadOnlyThickness({ choices, value }: { readonly choices: readonly WallThicknessChoice[]; readonly value: number }) {
  return (
    <div aria-label={THICKNESS_ARIA_LABEL} className="flex items-center gap-3" role="group">
      {choices.map((choice) => (
        <span className="flex items-center gap-1.5" key={choice}>
          <span aria-hidden="true" className="h-3 w-3 rounded-xs" style={{ backgroundColor: wallStrokeToken(choice) }} />
          <span className={cn('text-[13px]', choice === value ? 'font-semibold text-text-primary' : 'text-text-secondary')}>
            {choice} mm
          </span>
        </span>
      ))}
    </div>
  );
}

function ValueRow({ label, value, isLast = false }: { readonly label: string; readonly value: string; readonly isLast?: boolean }) {
  return (
    <FieldRow isLast={isLast} label={label}>
      <span className="flex h-9 items-center text-[14px] tabular-nums text-text-primary">{value}</span>
    </FieldRow>
  );
}

export function WallLayerInspector({ panel, queue }: WallLayerInspectorProps) {
  const [isAdvancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();
  const thicknessRef = useRef<HTMLDivElement | null>(null);
  const { inspector, thicknessFocusRequest, thicknessChoices, isViewerRole, onChangeThickness, rows } = panel;

  /* Menu "Đổi độ dày" (BUG-604): focus vào lựa chọn đang bật để phím mũi tên đổi được ngay. */
  useEffect(() => {
    if (thicknessFocusRequest === 0) {
      return;
    }

    const group = thicknessRef.current;
    const target =
      group?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? group?.querySelector<HTMLElement>('[role="radio"]');

    target?.focus();
  }, [thicknessFocusRequest]);

  const row = inspector === null ? undefined : rows.find((candidate) => candidate.id === inspector.id);
  const extra = inspector === null ? undefined : queue?.extras.get(inspector.id);
  const isReviewed = row?.isReviewed ?? false;
  const isNonStandard =
    inspector !== null && (row?.isNonStandardThickness ?? !(thicknessChoices as readonly number[]).includes(inspector.thicknessMm));
  const selectedCount = panel.selectedWallIds?.length ?? 0;
  const remaining = panel.reviewCounter.total - panel.reviewCounter.reviewed;
  const nonStandardCount = queue?.nonStandardCount ?? 0;

  return (
    <div className="order-2 flex w-full shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel xl:order-0 xl:h-full xl:w-full">
      <div className="flex h-11 shrink-0 items-end px-5">
        <h2 className="text-caption font-medium uppercase tracking-[0.06em] text-text-secondary">{PANEL_TITLE}</h2>
      </div>

      {inspector === null ? (
        /* Đệm dưới bằng đệm ngang: câu không sát đáy thẻ (BUG-329). */
        <div className="flex flex-col">
          <p className="px-5 pb-5 pt-2 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
          {/* Hàng đợi gọn khi chưa chọn (demo Z/S-15 idle): một số để hành động, không ước tính giả. */}
          {remaining > 0 ? (
            <div className="mx-5 rounded-lg bg-bg-sunken px-4 py-3">
              <p className="tabular-nums text-text-primary">
                <span className="text-[32px] font-medium leading-10">{remaining}</span>
                <span className="ml-1.5 text-body-sm text-text-secondary">{REMAINING_SUFFIX}</span>
              </p>
              {nonStandardCount > 0 ? (
                <p className="mt-1 text-body-sm text-state-attention-text">{`${nonStandardCount} không chuẩn nằm đầu danh sách`}</p>
              ) : null}
            </div>
          ) : null}
          {isViewerRole ? null : <p className="px-5 pt-4 text-caption text-text-secondary">{MULTI_SELECT_HINT}</p>}
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto pb-5">
          <div className="flex items-center gap-2 px-5 pb-3 pt-1">
            <p className="text-title tabular-nums text-text-primary">{inspector.codeLabel}</p>
            {isReviewed ? (
              <Badge variant="verified">{REVIEWED_LABEL}</Badge>
            ) : isNonStandard ? (
              <Badge variant="attention">{NON_STANDARD_LABEL}</Badge>
            ) : (
              <Badge variant="neutral">{UNREVIEWED_LABEL}</Badge>
            )}
          </div>
          {/* G4a-12: chọn nhiều thì nói rõ thông số bên dưới là của đoạn nào. */}
          {selectedCount > 1 ? (
            <p className="px-5 pb-3 text-[13px] text-text-secondary">
              {`${selectedCount} đoạn đã chọn. Thông số dưới đây của ${inspector.codeLabel}.`}
            </p>
          ) : null}

          <div className="mx-5 rounded-lg bg-bg-sunken px-4 py-3">
            <p className="text-caption text-text-secondary">{MEASURED_LABEL}</p>
            <p className="tabular-nums text-text-primary">
              <span className="text-[32px] font-medium leading-10">{inspector.thicknessMm}</span>
              <span className="ml-1 text-body-sm text-text-secondary">mm</span>
            </p>
            {extra === undefined ? null : <p className="mt-1 text-body-sm text-text-secondary">{extra.note}</p>}
          </div>

          <div className="px-5 pb-2 pt-3" ref={thicknessRef}>
            {isViewerRole ? (
              <ReadOnlyThickness choices={thicknessChoices} value={inspector.thicknessMm} />
            ) : (
              <>
                <p className="pb-1.5 text-caption text-text-secondary">{CHANGE_THICKNESS_LABEL}</p>
                <SegmentedControl
                  aria-label={THICKNESS_ARIA_LABEL}
                  onChange={(value) => onChangeThickness(inspector.id, Number(value) as WallThicknessChoice)}
                  options={thicknessChoices.map((choice) => ({ label: `${choice} mm`, swatch: wallStrokeToken(choice), value: String(choice) }))}
                  value={String(inspector.thicknessMm)}
                />
              </>
            )}
          </div>

          <div className="flex flex-col px-5">
            <ValueRow label={LENGTH_LABEL} value={inspector.lengthLabel} />
            <ValueRow label={HEIGHT_LABEL} value={inspector.heightLabel} />
            {queue?.showConfidence === false ? null : (
              <FieldRow label={CONFIDENCE_LABEL}>
                <span className="flex h-9 items-center">
                  <ConfidenceMeter value={inspector.confidence} />
                </span>
              </FieldRow>
            )}
            <FieldRow isLast label={MATERIAL_LABEL}>
              <span className="flex h-9 items-center text-[14px] text-text-primary">{inspector.kindLabel}</span>
            </FieldRow>
          </div>

          <div className="px-5 pt-2">
            <button
              aria-controls={advancedId}
              aria-expanded={isAdvancedOpen}
              className="flex w-full items-center justify-between rounded-md py-2 text-[13px] font-medium text-text-secondary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => setAdvancedOpen((open) => !open)}
              type="button"
            >
              {ADVANCED_TITLE}
              <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform duration-180', isAdvancedOpen && 'rotate-180')} />
            </button>

            <AnimatePresence initial={false}>
              {isAdvancedOpen && (
                <motion.div
                  animate={{ height: 'auto', opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  id={advancedId}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: durationSeconds('standard') }}
                >
                  <ValueRow label={ELEVATION_OFFSET_LABEL} value={inspector.advanced.elevationOffsetLabel} />
                  <ValueRow label={START_POINT_LABEL} value={inspector.advanced.startPointLabel} />
                  <ValueRow isLast label={END_POINT_LABEL} value={inspector.advanced.endPointLabel} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto flex flex-col items-stretch gap-2 px-5 pt-4">
            <WallLayerInspectorActions
              extra={extra}
              isNonStandard={isNonStandard}
              isReviewed={isReviewed}
              onStandardize={queue?.onStandardize}
              panel={panel}
              thicknessMm={inspector.thicknessMm}
              wallId={inspector.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
