/**
 * Một dòng của `FloorTable` — tách ra vì `FloorTable.tsx` vượt trần 400 dòng
 * của R-22 (mục D CLAUDE.md: view vượt trần thì tách file anh em). File anh
 * em thứ 13 của `FloorManager/` — điều phối viên đã duyệt, xem báo cáo
 * `worker_done` của T6.
 *
 * VIEW THUẦN (R-60), sở hữu bởi T6. Props lấy bằng `Pick<FloorManagerViewProps>`
 * qua `FloorTableProps` của `FloorTable.tsx`, không khai lại kiểu mới.
 *
 * ## Bẫy focus ring của `Table.Row` (QĐ-D)
 *
 * `notes/floor-manager/ui.md` mục A.1/A.8: vòng tiêu điểm của `Table.Row` chỉ
 * vẽ khi prop `focused` được set tay. Dòng CHỌN ĐƯỢC bằng chuột lẫn bàn phím ở
 * đây dùng khắc phục thật của `WallLayerReview/WallLayerList.tsx`: `<tr>` trần,
 * `tabIndex={0}`, `focus-visible:ring-2 ring-inset ring-accent` — class CSS
 * thuần, không state.
 *
 * ## `NumericField` NGUYÊN TRẠNG (QĐ-A)
 *
 * `onChange` chỉ bắn khi CHỐT (800ms/blur, `useNumericField.ts:14,86`) — dải
 * lát cắt chỉ đổi tỷ lệ ở lúc chốt, không debounce thứ hai. `parseNumber`/
 * `formatNumber` chỉ đọc/ghi bộ đệm `draft.*` (không phải chuỗi `*Text` được
 * A15 bảo vệ), nên `local/no-raw-number` không chặn.
 */

import { GripVertical, MoreVertical } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { NumericField } from '@/components/ui/NumericField';
import { Table } from '@/components/ui/Table';
import { Toggle } from '@/components/ui/Toggle';
import { formatNumber, parseNumber } from '@/lib/format/number';
import { cn } from '@/lib/utils';

import { FLOOR_COLUMN_LABELS, type FloorEditableField, type FloorManagerViewProps, type FloorRowVm } from './floorManagerTypes';

/** Chỉ chín hàm xử lý dòng cần — tránh `import type` vòng ngược với `FloorTable.tsx`. */
type FloorRowHandlers = Pick<
  FloorManagerViewProps,
  | 'onSelectFloor'
  | 'onHoverFloor'
  | 'onFloorFieldChange'
  | 'onFloorFieldCommit'
  | 'onFloorFieldCancel'
  | 'onReorderFloors'
  | 'onUploadDrawing'
  | 'onOpenOverlay'
>;

const NEEDS_DRAWING_LABEL = 'Chưa có bản vẽ';
/** Đuôi nhãn dòng khi chưa có bản vẽ: chưa có gì để kiểm nên không đọc "— đã kiểm" (BUG-263). */
const NEEDS_DRAWING_ROW_SUFFIX = 'chưa có bản vẽ';
const UPLOAD_LINK_LABEL = 'Tải lên';
const OVERLAY_ACTION_LABEL = 'Đối chiếu lớp phủ';
const COPY_FURNITURE_LABEL = 'Sao chép nội thất sang tầng mới';
/** Ô nhập mét đọc như ô bảng bên cạnh, "4,0" chứ không "4" (BUG-306; `metreText` của hook). */
const METRE_FRACTION_DIGITS = 1;


/**
 * Dòng xếp chồng (BUG-250): mười cột không vừa cạnh lát cắt hay dưới 1.024px, nên dòng
 * xuống hàng như thẻ và mỗi ô tự mang tên cột (hàng tiêu đề ẩn hẳn, nên nhãn ô cũng là thứ trình đọc màn hình đọc).
 */
const STACKED_ROW = 'flex h-auto flex-wrap items-center py-2';
/** Đệm ô 8px thay vì 12px của `Table.Cell`: mười cột vừa 958px (1.024px, lát cắt thu gọn). */
export const CELL = 'px-2';
const STACKED_CELL = 'flex h-auto items-center gap-2';

function StackedLabel({ isStacked, column }: { readonly isStacked: boolean; readonly column: keyof typeof FLOOR_COLUMN_LABELS }) {
  return isStacked ? (
    <span className="text-[12px] text-text-muted">
      {FLOOR_COLUMN_LABELS[column]}
    </span>
  ) : null;
}
const CONFIRM_DUPLICATE_LABEL = 'Nhân bản';
const OVERRIDDEN_LABEL = 'Ghi đè';
/** Dấu lỗi ngay ở ô; câu đầy đủ (gọi tên hai tầng) vẫn ở dải phía trên bảng (BUG-306). */
const ELEVATION_REFUSED_LABEL = 'Chưa đặt được';
/** Tường, phòng, diện tích, tiến độ QC, hành động. */
const DUPLICATE_STRIP_COLUMNS = 5;

function reorderedIds(rows: readonly FloorRowVm[], index: number, direction: -1 | 1): readonly string[] | null {
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= rows.length) {
    return null;
  }

  const ids = rows.map((row) => row.id);
  const moved = ids[index];
  const swapped = ids[targetIndex];

  if (moved === undefined || swapped === undefined) {
    return null;
  }

  ids[index] = swapped;
  ids[targetIndex] = moved;

  return ids;
}

export interface FloorTableRowProps {
  readonly row: FloorRowVm;
  readonly index: number;
  readonly rows: readonly FloorRowVm[];
  readonly canEdit: boolean;
  readonly isAutoElevation: boolean;
  readonly duplicatingFloorId: string | null;
  readonly copyFurniture: boolean;
  readonly showInsertionLineBefore: boolean;
  /** Đường chèn ở viền DƯỚI — chỉ dòng cuối, khi thả vào nửa dưới của nó (BUG-518). */
  readonly showInsertionLineAfter: boolean;
  /** Dòng xuống hàng như thẻ thay vì trải mười cột (BUG-250). */
  readonly isStacked: boolean;
  readonly nameInputRef: (element: HTMLInputElement | null) => void;
  readonly onSelectFloor: FloorRowHandlers['onSelectFloor'];
  readonly onHoverFloor: FloorRowHandlers['onHoverFloor'];
  readonly onFloorFieldChange: FloorRowHandlers['onFloorFieldChange'];
  readonly onFloorFieldCommit: FloorRowHandlers['onFloorFieldCommit'];
  readonly onFloorFieldCancel: FloorRowHandlers['onFloorFieldCancel'];
  readonly onReorderFloors: FloorRowHandlers['onReorderFloors'];
  readonly onUploadDrawing: FloorRowHandlers['onUploadDrawing'];
  readonly onOpenOverlay?: FloorRowHandlers['onOpenOverlay'];
  readonly onOpenMenu: (event: MouseEvent, row: FloorRowVm) => void;
  readonly onCancelDuplicate: () => void;
  readonly onSetCopyFurniture: (value: boolean) => void;
  readonly onConfirmDuplicate: (floorId: string) => void;
  readonly onDragHandleStart: (floorId: string) => void;
  /** Vị trí chèn: `index` khi trỏ nửa trên của dòng, `index + 1` khi trỏ nửa dưới (BUG-518). */
  readonly onDragOverRow: (insertIndex: number) => void;
  readonly onDropRow: () => void;
  readonly onDragEnd: () => void;
}

function commitNumericField(
  floorId: string,
  field: FloorEditableField,
  value: number | undefined,
  onFloorFieldChange: FloorRowHandlers['onFloorFieldChange'],
  onFloorFieldCommit: FloorRowHandlers['onFloorFieldCommit'],
) {
  const text = value === undefined ? '' : formatNumber(value, { fractionDigits: METRE_FRACTION_DIGITS });
  onFloorFieldChange(floorId, field, text);
  onFloorFieldCommit(floorId, field);
}

export function FloorTableRow({
  row,
  index,
  rows,
  canEdit,
  isAutoElevation,
  duplicatingFloorId,
  copyFurniture,
  showInsertionLineBefore,
  showInsertionLineAfter,
  isStacked,
  nameInputRef,
  onSelectFloor,
  onHoverFloor,
  onFloorFieldChange,
  onFloorFieldCommit,
  onFloorFieldCancel,
  onReorderFloors,
  onUploadDrawing,
  onOpenOverlay,
  onOpenMenu,
  onCancelDuplicate,
  onSetCopyFurniture,
  onConfirmDuplicate,
  onDragHandleStart,
  onDragOverRow,
  onDropRow,
  onDragEnd,
}: FloorTableRowProps) {
  const isDuplicating = duplicatingFloorId === row.id;
  const cell = cn(CELL, isStacked && STACKED_CELL);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (isDuplicating && event.key === 'Escape') {
      event.preventDefault();
      onCancelDuplicate();
      return;
    }

    if (!canEdit || !event.altKey) {
      return;
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    const ids = reorderedIds(rows, index, event.key === 'ArrowUp' ? -1 : 1);

    if (ids === null) {
      return;
    }

    event.preventDefault();
    onReorderFloors(ids);
  };

  return (
    <tr
      aria-label={`${row.name}, cao độ ${row.elevationText}, cao ${row.heightText}, ${row.hasDrawing ? `${row.qcProgressText} đã kiểm` : NEEDS_DRAWING_ROW_SUFFIX}`}
      aria-selected={row.isSelected}
      className={cn(
        'h-10 border-b border-border-default-50 outline-none transition-colors duration-120',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        row.isSelected ? 'bg-bg-selected' : row.isHovered ? 'bg-bg-hover' : undefined,
        row.isHiddenIn3d && 'opacity-50',
        showInsertionLineBefore && 'border-t-2 border-t-accent',
        showInsertionLineAfter && 'border-accent',
        isStacked && STACKED_ROW,
      )}
      onClick={() => onSelectFloor(row.id)}
      onDragOver={(event) => {
        if (!canEdit) {
          return;
        }

        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        onDragOverRow(event.clientY > box.top + box.height / 2 ? index + 1 : index);
      }}
      onDrop={(event) => {
        if (!canEdit) {
          return;
        }

        event.preventDefault();
        onDropRow();
      }}
      onKeyDown={handleRowKeyDown}
      onMouseEnter={() => onHoverFloor(row.id)}
      onMouseLeave={() => onHoverFloor(null)}
      tabIndex={0}
    >
      {canEdit && (
        <Table.Cell className={cn(cell, !isStacked && 'w-10 sm:w-8')}>
          <IconButton
            aria-label={`Đổi thứ tự tầng ${row.name}`}
            className="cursor-grab active:cursor-grabbing"
            draggable
            icon={<GripVertical className="h-4 w-4" />}
            onClick={(event) => event.stopPropagation()}
            onDragEnd={onDragEnd}
            onDragStart={(event) => {
              event.stopPropagation();
              onDragHandleStart(row.id);
            }}
            size="sm"
            tooltip={false}
          />
        </Table.Cell>
      )}

      <Table.Cell className={cell}>
        {canEdit ? (
          <Input
            aria-label={`Tên tầng ${row.name}`}
            className="w-32 text-[13px]"
            onBlur={() => onFloorFieldCommit(row.id, 'name')}
            onChange={(event) => onFloorFieldChange(row.id, 'name', event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }

              if (event.key === 'Escape') {
                onFloorFieldCancel(row.id, 'name');
                event.currentTarget.blur();
              }
            }}
            ref={nameInputRef}
            value={row.draft.name}
          />
        ) : (
          <span className="text-[13px] text-text-primary">{row.name}</span>
        )}
      </Table.Cell>

      <Table.Cell className={cell}>
        <StackedLabel column="elevation" isStacked={isStacked} />
        {canEdit && !isAutoElevation ? (
          <NumericField
            aria-label={`Cao độ tầng ${row.name}`}
            className="w-16 text-[13px]"
            error={row.isElevationRefused ? ELEVATION_REFUSED_LABEL : undefined}
            onChange={(value) =>
              commitNumericField(row.id, 'elevation', value, onFloorFieldChange, onFloorFieldCommit)
            }
            onClick={(event) => event.stopPropagation()}
            fractionDigits={METRE_FRACTION_DIGITS}
            unit="m"
            value={parseNumber(row.draft.elevation)}
          />
        ) : (
          <span className="text-[13px] text-text-primary">{row.elevationText}</span>
        )}
        {/* Ô ghi đè phải nhìn ra được, không trông như mọi ô tính tự động (BUG-289). */}
        {row.isElevationOverridden && <span className="ml-1 text-[12px] text-text-secondary">{OVERRIDDEN_LABEL}</span>}
      </Table.Cell>

      <Table.Cell className={cell}>
        <StackedLabel column="height" isStacked={isStacked} />
        {canEdit ? (
          <NumericField
            aria-label={`Chiều cao tầng ${row.name}`}
            className="w-16 text-[13px]"
            onChange={(value) => commitNumericField(row.id, 'height', value, onFloorFieldChange, onFloorFieldCommit)}
            onClick={(event) => event.stopPropagation()}
            fractionDigits={METRE_FRACTION_DIGITS}
            unit="m"
            value={parseNumber(row.draft.height)}
          />
        ) : (
          <span className="text-[13px] text-text-primary">{row.heightText}</span>
        )}
      </Table.Cell>

      <Table.Cell className={cell}>
        {/* Bảng đủ cột thì chip và "Tải lên" chồng lên nhau để cột hẹp lại (BUG-250). */}
        <div className={cn('flex items-center gap-2', !isStacked && 'flex-col items-start gap-1')}>
          <StackedLabel column="drawings" isStacked={isStacked} />
          {row.needsDrawing && canEdit ? (
            <>
              {/* Chip đã nói "Chưa có bản vẽ": không lặp chữ ấy lần nữa ngay cạnh nó (BUG-250). */}
              <Badge variant="attention">{NEEDS_DRAWING_LABEL}</Badge>
              <button
                className="inline-flex min-h-11 items-center rounded-[6px] px-1.5 text-[12px] text-accent underline-offset-2 sm:min-h-6 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={(event) => {
                  event.stopPropagation();
                  onUploadDrawing(row.id);
                }}
                type="button"
              >
                {UPLOAD_LINK_LABEL}
              </button>
            </>
          ) : (
            <span className="text-[13px] text-text-secondary">{row.drawingCountText}</span>
          )}
        </div>
      </Table.Cell>

      {isDuplicating ? (
        /* Dải hỏi nhân bản thay chỗ năm ô cuối của chính dòng này: ô "Hành động" một mình không
           đủ rộng, nhét vào đó thì bảng tràn ngang (BUG-250). */
        <Table.Cell className={cell} colSpan={DUPLICATE_STRIP_COLUMNS}>
          <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <Toggle
              aria-label={COPY_FURNITURE_LABEL}
              checked={copyFurniture}
              label={COPY_FURNITURE_LABEL}
              onChange={onSetCopyFurniture}
            />
            <Button onClick={() => onConfirmDuplicate(row.id)} size="sm" variant="primary">
              {CONFIRM_DUPLICATE_LABEL}
            </Button>
          </div>
        </Table.Cell>
      ) : (
        <>
          {(
            [
              ['walls', row.wallCountText],
              ['rooms', row.roomCountText],
              ['area', row.areaText],
            ] as const
          ).map(([column, text]) => (
            <Table.Cell className={cn(cell, 'text-[13px] text-text-secondary')} key={column}>
              <StackedLabel column={column} isStacked={isStacked} />
              {text}
            </Table.Cell>
          ))}

          <Table.Cell className={cell}>
            <div className="flex items-center gap-2">
              <StackedLabel column="qc" isStacked={isStacked} />
              <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-bg-sunken">
                <div
                  className="absolute inset-y-0 left-0 origin-left rounded-full bg-accent"
                  style={{ scale: `${row.qcProgressRatio} 1` }}
                />
              </div>
              {row.qcProgressRatio === 1 ? (
                <Badge variant="verified">{row.qcProgressText}</Badge>
              ) : (
                <span className="text-[13px] text-text-secondary">{row.qcProgressText}</span>
              )}
            </div>
          </Table.Cell>

          {(canEdit || onOpenOverlay !== undefined) && (
            <Table.Cell className={cell}>
              {onOpenOverlay !== undefined && row.hasDrawing && (
                <Button
                  aria-label={`${OVERLAY_ACTION_LABEL} tầng ${row.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenOverlay(row.id);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {OVERLAY_ACTION_LABEL}
                </Button>
              )}
              {canEdit && <IconButton
                aria-label={`Thao tác khác cho tầng ${row.name}`}
                icon={<MoreVertical className="h-4 w-4" />}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenMenu(event, row);
                }}
                size="sm"
                tooltip={false}
              />}
            </Table.Cell>
          )}
        </>
      )}
    </tr>
  );
}
