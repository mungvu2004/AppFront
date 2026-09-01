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

import type { FloorEditableField, FloorManagerViewProps, FloorRowVm } from './floorManagerTypes';

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
>;

const NEEDS_DRAWING_LABEL = 'chưa có bản vẽ';
const UPLOAD_LINK_LABEL = 'tải lên';
const COPY_FURNITURE_LABEL = 'sao chép nội thất sang tầng mới';
const CONFIRM_DUPLICATE_LABEL = 'nhân bản';

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
  readonly nameInputRef: (element: HTMLInputElement | null) => void;
  readonly onSelectFloor: FloorRowHandlers['onSelectFloor'];
  readonly onHoverFloor: FloorRowHandlers['onHoverFloor'];
  readonly onFloorFieldChange: FloorRowHandlers['onFloorFieldChange'];
  readonly onFloorFieldCommit: FloorRowHandlers['onFloorFieldCommit'];
  readonly onFloorFieldCancel: FloorRowHandlers['onFloorFieldCancel'];
  readonly onReorderFloors: FloorRowHandlers['onReorderFloors'];
  readonly onUploadDrawing: FloorRowHandlers['onUploadDrawing'];
  readonly onOpenMenu: (event: MouseEvent, row: FloorRowVm) => void;
  readonly onCancelDuplicate: () => void;
  readonly onSetCopyFurniture: (value: boolean) => void;
  readonly onConfirmDuplicate: (floorId: string) => void;
  readonly onDragHandleStart: (floorId: string) => void;
  readonly onDragOverRow: (index: number) => void;
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
  const text = value === undefined ? '' : formatNumber(value, { fractionDigits: 1 });
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
  nameInputRef,
  onSelectFloor,
  onHoverFloor,
  onFloorFieldChange,
  onFloorFieldCommit,
  onFloorFieldCancel,
  onReorderFloors,
  onUploadDrawing,
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
      aria-label={`${row.name}, cao độ ${row.elevationText}, cao ${row.heightText}, ${row.qcProgressText} đã kiểm`}
      aria-selected={row.isSelected}
      className={cn(
        'h-10 border-b border-border-default/50 outline-none transition-colors duration-120',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        row.isSelected ? 'bg-bg-selected' : row.isHovered ? 'bg-bg-hover' : undefined,
        row.isHiddenIn3d && 'opacity-50',
        showInsertionLineBefore && 'border-t-2 border-t-accent',
      )}
      onClick={() => onSelectFloor(row.id)}
      onDragOver={(event) => {
        if (!canEdit) {
          return;
        }

        event.preventDefault();
        onDragOverRow(index);
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
        <Table.Cell className="w-8">
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

      <Table.Cell>
        {canEdit ? (
          <Input
            aria-label={`Tên tầng ${row.name}`}
            className="h-8 text-[13px]"
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

      <Table.Cell>
        {canEdit && !isAutoElevation ? (
          <NumericField
            aria-label={`Cao độ tầng ${row.name}`}
            className="h-8 w-24 text-[13px]"
            onChange={(value) =>
              commitNumericField(row.id, 'elevation', value, onFloorFieldChange, onFloorFieldCommit)
            }
            onClick={(event) => event.stopPropagation()}
            unit="m"
            value={parseNumber(row.draft.elevation)}
          />
        ) : (
          <span className="text-[13px] text-text-primary">{row.elevationText}</span>
        )}
      </Table.Cell>

      <Table.Cell>
        {canEdit ? (
          <NumericField
            aria-label={`Chiều cao tầng ${row.name}`}
            className="h-8 w-24 text-[13px]"
            onChange={(value) => commitNumericField(row.id, 'height', value, onFloorFieldChange, onFloorFieldCommit)}
            onClick={(event) => event.stopPropagation()}
            unit="m"
            value={parseNumber(row.draft.height)}
          />
        ) : (
          <span className="text-[13px] text-text-primary">{row.heightText}</span>
        )}
      </Table.Cell>

      <Table.Cell>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-text-secondary">{row.drawingCountText}</span>
          {row.needsDrawing && canEdit && (
            <>
              <Badge variant="attention">{NEEDS_DRAWING_LABEL}</Badge>
              <button
                className="text-[12px] text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={(event) => {
                  event.stopPropagation();
                  onUploadDrawing(row.id);
                }}
                type="button"
              >
                {UPLOAD_LINK_LABEL}
              </button>
            </>
          )}
        </div>
      </Table.Cell>

      <Table.Cell className="text-[13px] text-text-secondary">{row.wallCountText}</Table.Cell>
      <Table.Cell className="text-[13px] text-text-secondary">{row.roomCountText}</Table.Cell>
      <Table.Cell className="text-[13px] text-text-secondary">{row.areaText}</Table.Cell>

      <Table.Cell>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-bg-sunken">
            <div
              className="absolute inset-y-0 left-0 origin-left rounded-full bg-accent"
              style={{ scale: `${row.qcProgressRatio} 1` }}
            />
          </div>
          <span className="text-[13px] text-text-secondary">{row.qcProgressText}</span>
          {row.qcProgressRatio === 1 && <Badge variant="verified">{row.qcProgressText}</Badge>}
        </div>
      </Table.Cell>

      {canEdit && (
        <Table.Cell>
          {isDuplicating ? (
            <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
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
          ) : (
            <IconButton
              aria-label={`Thao tác khác cho tầng ${row.name}`}
              icon={<MoreVertical className="h-4 w-4" />}
              onClick={(event) => {
                event.stopPropagation();
                onOpenMenu(event, row);
              }}
              size="sm"
              tooltip={false}
            />
          )}
        </Table.Cell>
      )}
    </tr>
  );
}
