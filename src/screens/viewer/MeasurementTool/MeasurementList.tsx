/**
 * Mục "Phép đo" ở panel phải — danh sách các phép đo đã ghim.
 *
 * VIEW THUẦN (R-60): không `@/api`, không `@/store`, không `@/domain`, không
 * `@/lib/http`. Mọi con số tới đây ĐÃ là chuỗi (`measurement.valueLabel`,
 * `countLabel`) — `local/no-raw-number` chặn mọi lượt định dạng lại ở tầng
 * này, phép đo đang đo dở càng không được chạy số (điều cấm riêng của màn
 * này, xem `MeasurementOverlay.tsx`).
 *
 * Chấm "cần chú ý" của một hàng `stale` dùng `Badge variant="neutral"` —
 * KHÔNG dùng `attention` (`--state-attention` là vàng) hay `violation`
 * (`--state-violation` là đỏ), đúng điều cấm nguyên văn của màn này.
 * `neutral` là biến thể duy nhất trong bốn biến thể của `Badge` không mang
 * một trong ba màu trạng thái (A4).
 *
 * Cùng khuôn `RoomAreaPanel.rows.tsx`: props khai bằng `Pick<>` chứ không
 * khai lại chữ ký handler lần thứ hai, hàng tương tác dựng bằng phần tử gốc
 * (không phải `Table.Row`), vòng tiêu điểm 2px lấy từ token.
 */

import {
  ChevronDown,
  CornerDownRight,
  Eye,
  EyeOff,
  MoveVertical,
  Ruler,
  Square,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

import {
  MEASURE_UNIT_LABELS,
  MEASURE_UNITS,
  type MeasureMode,
  type MeasurementToolProps,
  type MeasureUnit,
  type PinnedMeasurement,
  type PinnedMeasurementId,
} from './measurementToolTypes';

/** Biểu tượng chế độ của một hàng — bốn chế độ, đúng thứ tự `MEASURE_MODES`. */
const MODE_ICON: Readonly<Record<MeasureMode, typeof Ruler>> = {
  pointToPoint: Ruler,
  perpendicular: CornerDownRight,
  height: MoveVertical,
  floorArea: Square,
};

const UNIT_OPTIONS = MEASURE_UNITS.map((value) => ({ value, label: MEASURE_UNIT_LABELS[value] }));

const FOCUS_RING_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

const SECTION_TITLE = 'Phép đo';
const EMPTY_HINT = 'chưa có phép đo nào. nhấn M rồi chọn hai điểm trên mô hình.';
const UNIT_SELECT_LABEL = 'đơn vị';
const COLLAPSE_BUTTON_LABEL = `Thu gọn mục ${SECTION_TITLE}`;
const STALE_BADGE_TEXT = 'cần chú ý';

export interface MeasurementListProps
  extends Pick<
    MeasurementToolProps,
    | 'measurements'
    | 'countLabel'
    | 'highlightedId'
    | 'onHighlight'
    | 'onToggleVisibility'
    | 'onDelete'
    | 'unit'
    | 'onUnitChange'
    | 'canPin'
    | 'pinBlockedCaption'
    | 'collapsed'
    | 'onToggleCollapsed'
  > {}

interface MeasurementRowProps {
  readonly measurement: PinnedMeasurement;
  readonly isHighlighted: boolean;
  readonly onHighlight: (id: PinnedMeasurementId | null) => void;
  readonly onToggleVisibility: (id: PinnedMeasurementId) => void;
  readonly onDelete: (id: PinnedMeasurementId) => void;
}

function MeasurementRow({
  measurement,
  isHighlighted,
  onHighlight,
  onToggleVisibility,
  onDelete,
}: MeasurementRowProps) {
  const ModeIcon = MODE_ICON[measurement.mode];

  return (
    <li
      className={cn(
        'flex h-10 items-center gap-2 rounded-md px-2',
        'transition-colors duration-fast motion-reduce:transition-none',
        isHighlighted && 'bg-bg-hover',
      )}
      onMouseEnter={() => {
        onHighlight(measurement.id);
      }}
      onMouseLeave={() => {
        onHighlight(null);
      }}
    >
      <ModeIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />

      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{measurement.name}</span>

      <span className="shrink-0 font-mono text-[13px] tabular-nums text-text-secondary">
        {measurement.valueLabel}
      </span>

      {measurement.stale && (
        <>
          <Badge className="shrink-0" title={measurement.staleReason ?? undefined} variant="neutral">
            {STALE_BADGE_TEXT}
          </Badge>
          {measurement.staleReason !== null && (
            <span className="sr-only">{measurement.staleReason}</span>
          )}
        </>
      )}

      <IconButton
        aria-label={measurement.visible ? `Ẩn ${measurement.name}` : `Hiện ${measurement.name}`}
        icon={
          measurement.visible ? (
            <Eye aria-hidden="true" className="h-[16px] w-[16px]" />
          ) : (
            <EyeOff aria-hidden="true" className="h-[16px] w-[16px]" />
          )
        }
        isActive={!measurement.visible}
        onClick={() => {
          onToggleVisibility(measurement.id);
        }}
        size="sm"
      />

      <IconButton
        aria-label={`Xoá ${measurement.name}`}
        icon={<Trash2 aria-hidden="true" className="h-[16px] w-[16px]" />}
        onClick={() => {
          onDelete(measurement.id);
        }}
        size="sm"
      />
    </li>
  );
}

export function MeasurementList({
  measurements,
  countLabel,
  highlightedId,
  onHighlight,
  onToggleVisibility,
  onDelete,
  unit,
  onUnitChange,
  canPin,
  pinBlockedCaption,
  collapsed,
  onToggleCollapsed,
}: MeasurementListProps) {
  if (collapsed) {
    return (
      <button
        aria-label={`Mở mục ${SECTION_TITLE}, ${countLabel}`}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md px-2',
          'text-[13px] text-text-primary hover:bg-bg-hover',
          FOCUS_RING_CLASS,
        )}
        onClick={onToggleCollapsed}
        type="button"
      >
        <span>{SECTION_TITLE}</span>
        <Badge noDot variant="neutral">
          {countLabel}
        </Badge>
      </button>
    );
  }

  return (
    <section aria-label={SECTION_TITLE} className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[13px] font-medium text-text-primary">{SECTION_TITLE}</h3>
          <span className="shrink-0 text-[12px] text-text-secondary">{countLabel}</span>
        </div>
        <IconButton
          aria-label={COLLAPSE_BUTTON_LABEL}
          icon={<ChevronDown aria-hidden="true" className="h-[16px] w-[16px]" />}
          onClick={onToggleCollapsed}
          size="sm"
        />
      </header>

      <div className="px-2">
        <Select
          label={UNIT_SELECT_LABEL}
          onChange={(value) => {
            onUnitChange(value as MeasureUnit);
          }}
          options={UNIT_OPTIONS}
          value={unit}
        />
      </div>

      {!canPin && pinBlockedCaption !== null && (
        <p className="px-2 text-[12px] text-text-secondary">{pinBlockedCaption}</p>
      )}

      {measurements.length === 0 ? (
        <p className="px-2 text-[13px] text-text-secondary">{EMPTY_HINT}</p>
      ) : (
        <ul className="flex flex-col">
          {measurements.map((measurement) => (
            <MeasurementRow
              isHighlighted={highlightedId === measurement.id}
              key={measurement.id}
              measurement={measurement}
              onDelete={onDelete}
              onHighlight={onHighlight}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
