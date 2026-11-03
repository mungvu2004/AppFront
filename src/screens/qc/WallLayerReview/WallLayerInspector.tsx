/**
 * Thân panel phải của đoạn tường đang chọn (bố cục hai panel kiểu Figma, `docs/figma-layout-spec.md`):
 * các mục `QcInspectorSection` — "Kích thước" (Dài | Dày cùng hàng, "Khác…" mở ô nhập mm 60–600, UX-10;
 * menu "Đổi độ dày" đưa focus vào ô chọn, BUG-604), "Độ tin cậy" (chấm màu + chữ + ghi chú máy đo),
 * "Loại" (Vật liệu, Chiều cao), "Thông số nâng cao" (gập: điểm tin cậy, lệch Z, toạ độ).
 * Huy hiệu ở đầu panel ({@link WallLayerInspectorBadge}); chân ghim ({@link WallLayerInspectorFooter}).
 * View THUẦN (R-60): mọi chuỗi số đã định dạng ở hook (A15).
 */

import { useEffect, useId, useRef, useState } from 'react';

import { wallConfidenceToken } from '@/components/canvas/materialMap';
import { Badge } from '@/components/ui/Badge';
import { WALL_KIND_LABELS } from '@/lib/commands/business/shared';

import { QcInspectorSection } from '../shared/QcInspectorSection';
import type { WallLayerViewProps } from './types';
import { WallLayerInspectorActions } from './WallLayerInspectorActions';
import { CustomThicknessField, LengthField } from './WallLayerInspectorFields';
import { wallConfidenceTierOf } from './wallLayerHatch';
import { WallScaleLockNotice } from './WallScaleLockNotice';
import type { WallReviewQueue } from './wallReviewQueue';

export interface WallLayerInspectorProps {
  readonly panel: WallLayerViewProps;
  readonly queue?: WallReviewQueue | undefined;
}

const SIZE_TITLE = 'Kích thước';
const CONFIDENCE_TITLE = 'Độ tin cậy';
const KIND_TITLE = 'Loại';
const ADVANCED_TITLE = 'Thông số nâng cao';
const LENGTH_FACT = 'Dài';
const THICKNESS_FACT = 'Dày';
const HEIGHT_LABEL = 'Chiều cao';
const CONFIDENCE_SCORE_LABEL = 'Điểm tin cậy';
const MATERIAL_LABEL = 'Vật liệu';
const ELEVATION_OFFSET_LABEL = 'Lệch Z';
const START_POINT_LABEL = 'Toạ độ đầu';
const END_POINT_LABEL = 'Toạ độ cuối';
const THICKNESS_ARIA_LABEL = 'Độ dày tường';
const CUSTOM_OPTION_VALUE = 'other';
const CUSTOM_OPTION_LABEL = 'Khác…';
const NON_STANDARD_LABEL = 'Không chuẩn';
const REVIEWED_LABEL = 'Đã duyệt';
const UNREVIEWED_LABEL = 'Chưa duyệt';
const FIELD_LABEL = 'text-caption text-text-secondary';
const VALUE = 'flex h-9 items-center text-body-sm tabular-nums text-text-primary';

/** Đoạn đang mở và các cờ suy từ dòng danh sách — dùng chung cho thân, huy hiệu và chân panel. */
function selectionOf({ panel, queue }: WallLayerInspectorProps) {
  const { inspector, thicknessChoices, rows } = panel;
  const row = inspector === null ? undefined : rows.find((candidate) => candidate.id === inspector.id);
  const choices = thicknessChoices as readonly number[];
  const isOffScale = inspector !== null && !choices.includes(inspector.thicknessMm);

  return {
    inspector,
    row,
    extra: inspector === null ? undefined : queue?.extras.get(inspector.id),
    isReviewed: row?.isReviewed ?? false,
    isNonStandard: inspector !== null && (row?.isNonStandardThickness ?? isOffScale),
    isOffScale,
  };
}

function ValueRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="min-w-0 truncate tabular-nums text-text-primary" title={value}>{value}</span>
    </div>
  );
}

/** Huy hiệu trạng thái cạnh mã ở đầu panel. */
export function WallLayerInspectorBadge(props: WallLayerInspectorProps) {
  const { isReviewed, isNonStandard } = selectionOf(props);

  return isReviewed ? (
    <Badge variant="verified">{REVIEWED_LABEL}</Badge>
  ) : isNonStandard ? (
    <Badge variant="attention">{NON_STANDARD_LABEL}</Badge>
  ) : (
    <Badge variant="neutral">{UNREVIEWED_LABEL}</Badge>
  );
}

/** Chân ghim ngoài vùng cuộn (U20): nút theo loại đoạn, hoặc lý do khoá tỷ lệ + lối sang bước Tỷ lệ. */
export function WallLayerInspectorFooter(props: WallLayerInspectorProps) {
  const { panel, queue } = props;
  const { inspector, extra, isReviewed, isNonStandard } = selectionOf(props);

  if (inspector === null) {
    return null;
  }

  return panel.scaleLock == null ? (
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
    <WallScaleLockNotice lock={panel.scaleLock} />
  );
}

export function WallLayerInspector(props: WallLayerInspectorProps) {
  const { panel, queue } = props;
  /* UX-10: ô "Khác…" gắn với đúng đoạn đang mở — chọn đoạn khác thì tự đóng. */
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const customId = useId();
  const lockId = useId();
  const thicknessRef = useRef<HTMLSelectElement | null>(null);
  const { thicknessFocusRequest, thicknessChoices, isViewerRole, onChangeThickness } = panel;
  const { inspector, row, extra, isNonStandard, isOffScale } = selectionOf(props);

  /* Menu "Đổi độ dày" (BUG-604): focus vào lựa chọn đang bật để phím mũi tên đổi được ngay. */
  useEffect(() => {
    if (thicknessFocusRequest === 0) {
      return;
    }

    thicknessRef.current?.focus();
  }, [thicknessFocusRequest]);

  if (inspector === null) {
    return null;
  }

  const selectedCount = panel.selectedWallIds?.length ?? 0;
  /* Khoá đổi độ dày (K09, Codex P1): ô chọn tắt; nút hành động đã nói lý do khi có nút "Đổi về" thì không lặp lại. */
  const scaleLock = panel.scaleLock ?? null;
  const lockText = scaleLock === null ? (queue?.lockText ?? null) : scaleLock.reason;
  const showLockHere = scaleLock === null && lockText !== null && !(isNonStandard && extra !== undefined && extra.targetMm !== null);
  const tier = wallConfidenceTierOf(row?.isReviewed ?? false, row?.isLowConfidence ?? false, row?.confidence ?? inspector.confidence);
  /* P03: cùng điều kiện với đổi độ dày (vai sửa, không khoá tỷ lệ); tường cong vẫn chỉ đọc. */
  const lengthEdit = !isViewerRole && lockText === null && panel.onChangeLength !== undefined ? (inspector.lengthEdit ?? null) : null;

  return (
    <>
      {/* G4a-12: chọn nhiều thì nói rõ thông số là của đoạn nào. */}
      {selectedCount > 1 ? (
        <p className="px-4 pt-3 text-caption text-text-secondary">{`${selectedCount} đoạn đã chọn. Thông số dưới đây của ${inspector.codeLabel}.`}</p>
      ) : null}

      <QcInspectorSection title={SIZE_TITLE}>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-w-0 flex-col">
            <span className={FIELD_LABEL}>{LENGTH_FACT}</span>
            {lengthEdit === null ? (
              <span className={VALUE}>{inspector.lengthLabel}</span>
            ) : (
              <LengthField
                edit={lengthEdit}
                key={`${inspector.id}:${lengthEdit.valueText}`}
                onCommit={(lengthMm) => panel.onChangeLength?.(inspector.id, lengthMm)}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className={FIELD_LABEL}>{THICKNESS_FACT}</span>
            {/* U37: người xem không thấy ô đổi độ dày (trông như nút sửa) — chỉ đọc số. */}
            {isViewerRole ? (
              <span className={VALUE}>{`${inspector.thicknessMm} mm`}</span>
            ) : (
              <select
                aria-describedby={showLockHere ? lockId : undefined}
                aria-label={THICKNESS_ARIA_LABEL}
                className="my-1 h-9 min-w-0 rounded-md border border-border-default bg-bg-surface px-2 text-body-sm tabular-nums text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
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
            )}
          </div>
        </div>
        {!isViewerRole && lockText === null && customFor === inspector.id ? (
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
        {!isViewerRole && showLockHere ? (
          <p className="pt-1 text-caption leading-snug text-state-violation" id={lockId}>
            {lockText}
          </p>
        ) : null}
      </QcInspectorSection>

      {queue?.showConfidence === false ? null : (
        <QcInspectorSection title={CONFIDENCE_TITLE}>
          <div className="flex items-center gap-2 text-text-primary">
            <svg aria-hidden="true" className="shrink-0" height={10} viewBox="0 0 10 10" width={10}>
              <circle cx={5} cy={5} fill={wallConfidenceToken(tier)} r={5} />
            </svg>
            <span>{inspector.confidenceText}</span>
          </div>
          {inspector.detectedNote ? <p className="text-caption text-text-secondary">{inspector.detectedNote}</p> : null}
          {extra === undefined ? null : <p className="text-caption text-text-secondary">{extra.note}</p>}
        </QcInspectorSection>
      )}

      <QcInspectorSection title={KIND_TITLE}>
        <ValueRow label={MATERIAL_LABEL} value={inspector.kindLabel} />
        <ValueRow label={HEIGHT_LABEL} value={inspector.heightLabel} />
      </QcInspectorSection>

      <QcInspectorSection collapsible defaultOpen={false} title={ADVANCED_TITLE}>
        <ValueRow label={CONFIDENCE_SCORE_LABEL} value={inspector.advanced.confidenceLabel} />
        <ValueRow label={ELEVATION_OFFSET_LABEL} value={inspector.advanced.elevationOffsetLabel} />
        <ValueRow label={START_POINT_LABEL} value={inspector.advanced.startPointLabel} />
        <ValueRow label={END_POINT_LABEL} value={inspector.advanced.endPointLabel} />
      </QcInspectorSection>
    </>
  );
}
