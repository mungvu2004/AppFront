/**
 * Thân thẻ hỏi của đoạn tường đang chọn (L23), gọn để thẻ neo mép phải chỉ ~300 × 260 px:
 * - một hàng chip: mã · trạng thái · "Dày 220 mm" · "Dài 3.450 mm" · lời độ tin cậy;
 * - "Đổi độ dày": ô chọn trong thang chuẩn, cộng "Khác…" mở ô nhập mm (60–600, UX-10); menu "Đổi độ dày"
 *   đưa focus vào ô chọn (BUG-604);
 * - "Thông số nâng cao" (gập): chiều dài sửa được, chiều cao, vật liệu, điểm tin cậy, lệch Z, toạ độ;
 * - chân thẻ: nút theo loại đoạn (`WallLayerInspectorActions`).
 * View THUẦN (R-60): mọi chuỗi số đã định dạng ở hook (A15).
 */

import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { AnimatePresence, motion } from '@/components/motion';
import { Badge } from '@/components/ui/Badge';
import { FieldRow } from '@/components/ui/FieldRow';
import { durationSeconds } from '@/lib/motion';
import { WALL_KIND_LABELS } from '@/lib/commands/business/shared';
import { cn } from '@/lib/utils';

import type { WallLayerViewProps } from './types';
import { WallLayerInspectorActions } from './WallLayerInspectorActions';
import { CustomThicknessField, LengthField } from './WallLayerInspectorFields';
import { WallScaleLockNotice } from './WallScaleLockNotice';
import type { WallReviewQueue } from './wallReviewQueue';

export interface WallLayerInspectorProps {
  readonly panel: WallLayerViewProps;
  readonly queue?: WallReviewQueue | undefined;
}

const ADVANCED_TITLE = 'Thông số nâng cao';
const LENGTH_LABEL = 'Chiều dài';
const HEIGHT_LABEL = 'Chiều cao';
const CONFIDENCE_SCORE_LABEL = 'Điểm tin cậy';
const MATERIAL_LABEL = 'Vật liệu';
const ELEVATION_OFFSET_LABEL = 'Lệch Z';
const START_POINT_LABEL = 'Toạ độ đầu';
const END_POINT_LABEL = 'Toạ độ cuối';
const THICKNESS_ARIA_LABEL = 'Độ dày tường';
const THICKNESS_FACT = 'Dày';
const LENGTH_FACT = 'Dài';
const CHANGE_THICKNESS_LABEL = 'Đổi độ dày';
const CUSTOM_OPTION_VALUE = 'other';
const CUSTOM_OPTION_LABEL = 'Khác…';
const NON_STANDARD_LABEL = 'Không chuẩn';
const REVIEWED_LABEL = 'Đã duyệt';
const UNREVIEWED_LABEL = 'Chưa duyệt';
const EMPTY_MESSAGE =
  'Chọn một đoạn tường trên bản vẽ hoặc trong danh sách để duyệt.';

function ValueRow({ label, value, isLast = false }: { readonly label: string; readonly value: string; readonly isLast?: boolean }) {
  return (
    <FieldRow isLast={isLast} label={label}>
      <span className="flex h-9 items-center text-[14px] tabular-nums text-text-primary">{value}</span>
    </FieldRow>
  );
}

function Fact({ children }: { readonly children: ReactNode }) {
  return <span className="inline-flex h-6 items-center gap-1 rounded-md bg-bg-sunken px-2 text-body-sm tabular-nums text-text-primary">{children}</span>;
}

export function WallLayerInspector({ panel, queue }: WallLayerInspectorProps) {
  const [isAdvancedOpen, setAdvancedOpen] = useState(false);
  /* UX-10: ô "Khác…" gắn với đúng đoạn đang mở — chọn đoạn khác thì tự đóng. */
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const customId = useId();
  const advancedId = useId();
  const lockId = useId();
  const thicknessRef = useRef<HTMLSelectElement | null>(null);
  const { inspector, thicknessFocusRequest, thicknessChoices, isViewerRole, onChangeThickness, rows } = panel;

  /* Menu "Đổi độ dày" (BUG-604): focus vào lựa chọn đang bật để phím mũi tên đổi được ngay. */
  useEffect(() => {
    if (thicknessFocusRequest === 0) {
      return;
    }

    thicknessRef.current?.focus();
  }, [thicknessFocusRequest]);

  const row = inspector === null ? undefined : rows.find((candidate) => candidate.id === inspector.id);
  const extra = inspector === null ? undefined : queue?.extras.get(inspector.id);
  const isReviewed = row?.isReviewed ?? false;
  const isNonStandard =
    inspector !== null && (row?.isNonStandardThickness ?? !(thicknessChoices as readonly number[]).includes(inspector.thicknessMm));
  const isOffScale = inspector !== null && !(thicknessChoices as readonly number[]).includes(inspector.thicknessMm);
  const selectedCount = panel.selectedWallIds?.length ?? 0;
  /* Khoá đổi độ dày (K09, Codex P1): ô chọn tắt; nút hành động đã nói lý do khi có nút "Đổi về" thì không lặp lại. */
  const scaleLock = panel.scaleLock ?? null;
  const lockText = scaleLock === null ? (queue?.lockText ?? null) : scaleLock.reason;
  const showLockHere = scaleLock === null && lockText !== null && !(isNonStandard && extra !== undefined && extra.targetMm !== null);

  if (inspector === null) {
    return (
      <div className="order-2 flex w-full shrink-0 flex-col rounded-xl bg-bg-surface shadow-panel xl:order-0 xl:w-full">
        {/* Đệm dưới bằng đệm ngang: câu không sát đáy thẻ (BUG-329). */}
        <p className="px-5 pb-5 pt-4 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="order-2 flex max-h-full min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel xl:order-0 xl:h-full xl:w-full">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-1 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* K16: mã không gãy giữa "#W-" và "001". */}
          <span className="whitespace-nowrap text-body-sm font-medium tabular-nums text-text-primary">{inspector.codeLabel}</span>
          {isReviewed ? (
            <Badge variant="verified">{REVIEWED_LABEL}</Badge>
          ) : isNonStandard ? (
            <Badge variant="attention">{NON_STANDARD_LABEL}</Badge>
          ) : (
            <Badge variant="neutral">{UNREVIEWED_LABEL}</Badge>
          )}
          {/* U30: dấu cách thật giữa chữ, số và đơn vị — chép/đọc màn hình không dính chữ. */}
          <Fact>
            {THICKNESS_FACT} <span className="font-medium">{inspector.thicknessMm}</span> mm
          </Fact>
          <Fact>{`${LENGTH_FACT} ${inspector.lengthLabel}`}</Fact>
          {queue?.showConfidence === false ? null : <Fact>{inspector.confidenceText}</Fact>}
        </div>
        {inspector.detectedNote ? <p className="text-caption text-text-secondary">{inspector.detectedNote}</p> : null}
        {extra === undefined ? null : <p className="text-caption text-text-secondary">{extra.note}</p>}
        {/* G4a-12: chọn nhiều thì nói rõ thông số là của đoạn nào. */}
        {selectedCount > 1 ? (
          <p className="text-caption text-text-secondary">{`${selectedCount} đoạn đã chọn. Thông số dưới đây của ${inspector.codeLabel}.`}</p>
        ) : null}

        {/* U37: người xem không thấy ô đổi độ dày (trông như nút sửa) — số hiện tại đã ở hàng chip. */}
        {isViewerRole ? null : (
          <div>
            <label className="flex items-center gap-3">
              <span className="shrink-0 text-caption text-text-secondary">{CHANGE_THICKNESS_LABEL}</span>
              <select
                aria-describedby={showLockHere ? lockId : undefined}
                aria-label={THICKNESS_ARIA_LABEL}
                className="h-9 min-w-0 flex-1 rounded-md border border-border-default bg-bg-surface px-2 text-[14px] tabular-nums text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                disabled={lockText !== null}
                onChange={(event) => {
                  if (event.target.value === CUSTOM_OPTION_VALUE) {
                    setCustomFor(inspector.id);
                    setCustomText(String(inspector.thicknessMm));
                    return;
                  }

                  setCustomFor(null);
                  onChangeThickness(inspector.id, Number(event.target.value));
                }}
                ref={thicknessRef}
                value={customFor === inspector.id ? CUSTOM_OPTION_VALUE : String(inspector.thicknessMm)}
              >
                {/* Độ dày đo không nằm trong thang: hiện đúng số đó, không chọn lại được. */}
                {isOffScale ? <option disabled value={String(inspector.thicknessMm)}>{`${inspector.thicknessMm} mm`}</option> : null}
                {thicknessChoices.map((choice) => (
                  <option key={choice} value={String(choice)}>{`${choice} mm`}</option>
                ))}
                <option value={CUSTOM_OPTION_VALUE}>{CUSTOM_OPTION_LABEL}</option>
              </select>
            </label>
            {lockText === null && customFor === inspector.id ? (
              <CustomThicknessField
                errorId={customId}
                onApply={(value) => {
                  setCustomFor(null);
                  onChangeThickness(inspector.id, value);
                }}
                onTextChange={setCustomText}
                text={customText}
              />
            ) : null}
            {showLockHere ? (
              <p className="mt-2 text-caption leading-snug text-state-violation" id={lockId}>
                {lockText}
              </p>
            ) : null}
          </div>
        )}

        <div>
          <button
            aria-controls={advancedId}
            aria-expanded={isAdvancedOpen}
            className="flex w-full items-center justify-between rounded-md py-1.5 text-[13px] font-medium text-text-secondary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                {/* P03: cùng điều kiện với đổi độ dày (vai sửa, không khoá tỷ lệ); tường cong vẫn chỉ đọc. */}
                {!isViewerRole && lockText === null && inspector.lengthEdit != null && panel.onChangeLength !== undefined ? (
                  <FieldRow label={LENGTH_LABEL}>
                    <LengthField
                      edit={inspector.lengthEdit}
                      key={`${inspector.id}:${inspector.lengthEdit.valueText}`}
                      onCommit={(lengthMm) => panel.onChangeLength?.(inspector.id, lengthMm)}
                    />
                  </FieldRow>
                ) : (
                  <ValueRow label={LENGTH_LABEL} value={inspector.lengthLabel} />
                )}
                <ValueRow label={HEIGHT_LABEL} value={inspector.heightLabel} />
                <ValueRow label={MATERIAL_LABEL} value={inspector.kindLabel} />
                <ValueRow label={CONFIDENCE_SCORE_LABEL} value={inspector.advanced.confidenceLabel} />
                <ValueRow label={ELEVATION_OFFSET_LABEL} value={inspector.advanced.elevationOffsetLabel} />
                <ValueRow label={START_POINT_LABEL} value={inspector.advanced.startPointLabel} />
                <ValueRow isLast label={END_POINT_LABEL} value={inspector.advanced.endPointLabel} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* U20: nút duyệt nằm ngoài vùng cuộn, đứng đáy thẻ — ở 768 px vẫn thấy ngay, không phải cuộn. */}
      <div className="flex shrink-0 flex-col items-stretch gap-2 border-t border-border-default px-4 py-3">
        {/* Khoá tỷ lệ: thay mọi nút sửa/duyệt bằng lý do + lối sang bước Tỷ lệ. */}
        {scaleLock === null ? (
          <WallLayerInspectorActions
            confirmDelete={inspector.kindLabel === WALL_KIND_LABELS.envelope || inspector.isLongWall === true}
            extra={extra}
            isNonStandard={isNonStandard}
            isReviewed={isReviewed}
            lockText={queue?.lockText}
            onStandardize={queue?.onStandardize}
            panel={panel}
            thicknessMm={inspector.thicknessMm}
            wallId={inspector.id}
          />
        ) : (
          <WallScaleLockNotice lock={scaleLock} />
        )}
      </div>
    </div>
  );
}
