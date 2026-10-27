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

import { GripVertical } from 'lucide-react';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { NumericField } from '@/components/ui/NumericField';
import { Table } from '@/components/ui/Table';
import { Toggle } from '@/components/ui/Toggle';
import { formatNumber, parseNumber } from '@/lib/format/number';
import { cn } from '@/lib/utils';

import { elevationSignedText, floorStepOf, heightDraftFromMm, heightDraftMm, heightMmText } from './floorProgress';
import { FloorActionsCell, FloorNameCell, FloorProgressCell, InlineNumber } from './FloorTableRowCells';
import { type FloorEditableField, type FloorManagerViewProps, type FloorRowVm } from './floorManagerTypes';

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

/** Đuôi nhãn dòng khi chưa có bản vẽ: chưa có gì để kiểm nên không đọc "— đã kiểm" (BUG-263). */
const NEEDS_DRAWING_ROW_SUFFIX = 'chưa có bản vẽ';
const COPY_FURNITURE_LABEL = 'Sao chép nội thất sang tầng mới';
/** Ô nhập mét đọc như ô bảng bên cạnh, "4,0" chứ không "4" (BUG-306; `metreText` của hook). */
const METRE_FRACTION_DIGITS = 1;


/** Đệm ô 8px thay vì 12px của `Table.Cell`. */
export const CELL = 'px-3';

/* `InlineNumber` và lớp chữ của ô sửa tại chỗ ở `FloorTableRowCells.tsx`. */
const CONFIRM_DUPLICATE_LABEL = 'Nhân bản';
const OVERRIDDEN_LABEL = 'Ghi đè';
/** Dấu lỗi ngay ở ô; câu đầy đủ (gọi tên hai tầng) vẫn ở dải phía trên bảng (BUG-306). */
const ELEVATION_REFUSED_LABEL = 'Chưa đặt được';
/** Tường, phòng, diện tích, tiến độ QC, hành động. */
const DUPLICATE_STRIP_COLUMNS = 2;

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
  /** Từ 2 tầng mới có tay nắm đổi thứ tự. */
  readonly canReorder: boolean;
  /** K34: dự án là các căn hộ riêng thì không có cột cao độ. Vắng = có. */
  readonly showElevation?: boolean;
  readonly isAutoElevation: boolean;
  readonly duplicatingFloorId: string | null;
  readonly copyFurniture: boolean;
  readonly showInsertionLineBefore: boolean;
  /** Đường chèn ở viền DƯỚI — chỉ dòng cuối, khi thả vào nửa dưới của nó (BUG-518). */
  readonly showInsertionLineAfter: boolean;
  /** Dòng xuống hàng như thẻ thay vì trải mười cột (BUG-250). */
  readonly isRenaming: boolean;
  readonly onRenameStart: (floorId: string) => void;
  readonly onRenameEnd: () => void;
  readonly onSelectFloor: FloorRowHandlers['onSelectFloor'];
  readonly onHoverFloor: FloorRowHandlers['onHoverFloor'];
  readonly onFloorFieldChange: FloorRowHandlers['onFloorFieldChange'];
  readonly onFloorFieldCommit: FloorRowHandlers['onFloorFieldCommit'];
  readonly onFloorFieldCancel: FloorRowHandlers['onFloorFieldCancel'];
  readonly onReorderFloors: FloorRowHandlers['onReorderFloors'];
  readonly onUploadDrawing: FloorRowHandlers['onUploadDrawing'];
  readonly onOpenOverlay?: FloorRowHandlers['onOpenOverlay'];
  readonly onOpenMenu: (event: MouseEvent, row: FloorRowVm) => void;
  readonly onOpenReviewMenu?: (event: MouseEvent, row: FloorRowVm) => void;
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
  canReorder,
  showElevation = true,
  isAutoElevation,
  duplicatingFloorId,
  copyFurniture,
  showInsertionLineBefore,
  showInsertionLineAfter,
  isRenaming,
  onRenameStart,
  onRenameEnd,
  onSelectFloor,
  onHoverFloor,
  onFloorFieldChange,
  onFloorFieldCommit,
  onFloorFieldCancel,
  onReorderFloors,
  onUploadDrawing,
  onOpenOverlay,
  onOpenMenu,
  onOpenReviewMenu,
  onCancelDuplicate,
  onSetCopyFurniture,
  onConfirmDuplicate,
  onDragHandleStart,
  onDragOverRow,
  onDropRow,
  onDragEnd,
}: FloorTableRowProps) {
  const isDuplicating = duplicatingFloorId === row.id;
  const cell = CELL;
  const step = floorStepOf(row);
  const [openField, setOpenField] = useState<FloorEditableField | null>(null);
  const closeField = () => setOpenField(null);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (isDuplicating && event.key === 'Escape') {
      event.preventDefault();
      onCancelDuplicate();
      return;
    }

    if (!canReorder || !event.altKey) {
      return;
    }

    moveByArrow(event);
  };

  /** Mũi tên lên/xuống dời dòng một bậc — dùng chung cho Alt+mũi tên ở dòng và mũi tên ở nút kéo (G3-20). */
  function moveByArrow(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    const ids = reorderedIds(rows, index, event.key === 'ArrowUp' ? -1 : 1);

    if (ids === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onReorderFloors(ids);
  }

  return (
    <tr
      aria-label={`${row.name}, cao độ ${row.elevationText}, cao ${row.heightText}, ${row.hasDrawing ? step.label.toLowerCase() : NEEDS_DRAWING_ROW_SUFFIX}`}
      aria-selected={row.isSelected}
      className={cn(
        'h-[72px] border-b border-border-default-50 outline-hidden transition-colors duration-120',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        row.isSelected ? 'bg-bg-selected' : row.isHovered ? 'bg-bg-hover' : undefined,
        row.isHiddenIn3d && 'opacity-50',
        showInsertionLineBefore && 'border-t-2 border-t-accent',
        showInsertionLineAfter && 'border-accent',
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
      {canReorder && (
        <Table.Cell className={cn(cell, 'w-10 sm:w-8')}>
          <IconButton
            aria-keyshortcuts="ArrowUp ArrowDown"
            aria-label={`Đổi thứ tự tầng ${row.name}`}
            className="cursor-grab active:cursor-grabbing"
            draggable
            icon={<GripVertical className="h-4 w-4" />}
            onClick={(event) => event.stopPropagation()}
            onDragEnd={onDragEnd}
            onKeyDown={moveByArrow}
            onDragStart={(event) => {
              event.stopPropagation();
              onDragHandleStart(row.id);
            }}
            size="sm"
            tooltip={false}
          />
        </Table.Cell>
      )}

      <FloorNameCell canEdit={canEdit} className={cell} isRenaming={isRenaming} onFloorFieldCancel={onFloorFieldCancel} onFloorFieldChange={onFloorFieldChange} onFloorFieldCommit={onFloorFieldCommit} onRenameEnd={onRenameEnd} onRenameStart={onRenameStart} row={row} summaryText={step.summaryText} />

      {showElevation && (
      <Table.Cell className={cn(cell, 'tabular-nums')}>
        {canEdit && !isAutoElevation ? (
          <InlineNumber
            isOpen={openField === 'elevation' || row.isElevationRefused}
            label={`cao độ tầng ${row.name}`}
            onClose={closeField}
            onOpen={() => setOpenField('elevation')}
            text={elevationSignedText(row.elevationMm)}
          >
          <NumericField
            aria-label={`Cao độ tầng ${row.name}`}
            autoFocus={!row.isElevationRefused}
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
          </InlineNumber>
        ) : (
          <span className="text-[13px] text-text-primary">{elevationSignedText(row.elevationMm)}</span>
        )}
        {/* Ô ghi đè phải nhìn ra được, không trông như mọi ô tính tự động (BUG-289). */}
        {row.isElevationOverridden && <span className="ml-1 text-[12px] text-text-secondary">{OVERRIDDEN_LABEL}</span>}
      </Table.Cell>
      )}

      <Table.Cell className={cn(cell, 'tabular-nums')}>
        {canEdit ? (
          <InlineNumber
            isOpen={openField === 'height'}
            label={`chiều cao tầng ${row.name}`}
            onClose={closeField}
            onOpen={() => setOpenField('height')}
            text={heightMmText(row.heightMm)}
          >
          <NumericField
            aria-label={`Chiều cao tầng ${row.name}`}
            autoFocus
            className="w-20 text-[13px]"
            onChange={(value) => {
              /* Ô nhập mm; nháp của hook tính bằng mét — đổi ở `floorProgress.ts`. */
              onFloorFieldChange(row.id, 'height', heightDraftFromMm(value));
              onFloorFieldCommit(row.id, 'height');
            }}
            onClick={(event) => event.stopPropagation()}
            fractionDigits={0}
            unit="mm"
            value={heightDraftMm(row)}
          />
          </InlineNumber>
        ) : (
          <span className="text-[13px] text-text-primary">{heightMmText(row.heightMm)}</span>
        )}
      </Table.Cell>

      {isDuplicating ? (
        /* Dải hỏi nhân bản thay chỗ hai ô cuối của chính dòng này: ô "Hành động" một mình không
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
          <FloorProgressCell className={cell} step={step} />

          <FloorActionsCell canEdit={canEdit} className={cell} onOpenMenu={onOpenMenu} onOpenOverlay={onOpenOverlay} onOpenReviewMenu={onOpenReviewMenu} onUploadDrawing={onUploadDrawing} row={row} />
        </>
      )}
    </tr>
  );
}
