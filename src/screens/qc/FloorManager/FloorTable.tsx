/**
 * Bảng tầng của `FloorManager` — cột phải, dòng cao 40px.
 *
 * VIEW THUẦN (R-60), file anh em của `FloorManager.tsx` (mục D CLAUDE.md).
 * `Pick<FloorManagerViewProps, …>` thay vì khai lại chữ ký handler.
 *
 * Một dòng bảng tách ra `FloorTableRow.tsx` — file anh em thứ 13 của thư mục,
 * điều phối viên đã duyệt vì `FloorTable.tsx` vượt trần 400 dòng của R-22 khi
 * gộp chung (xem đầu file đó và báo cáo `worker_done`).
 *
 * ## Menu ngữ cảnh (QĐ-C) và nhân bản hỏi ngay tại dòng
 *
 * `ContextMenu` nhập từ `@/components/canvas/ContextMenu` (không phải
 * `src/components/ui/`, xem `notes/floor-manager/ui.md` mục A.7). Nhân bản
 * KHÔNG mở hộp thoại: chọn mục "nhân bản" mở một dải hỏi "sao chép nội thất"
 * NGAY TRONG DÒNG đó (`duplicatingFloorId`, state cục bộ của view — không phải
 * dữ liệu nghiệp vụ, nên không phạm "view test được chỉ từ props": mọi lượt
 * xác nhận vẫn đi ra qua `onDuplicateFloor`).
 *
 * ## Kéo đổi thứ tự
 *
 * Chuột: HTML5 drag/drop trên tay nắm mỗi dòng, đường chèn 2px là viền trên
 * của dòng đang được trỏ tới. Bàn phím (A12, đường hạng nhất): dòng đang focus
 * + `Alt+↑`/`Alt+↓` hoán vị hai tầng liền kề — xử lý trong `FloorTableRow.tsx`.
 */

import { useRef, useState, type MouseEvent } from 'react';

import { ContextMenu } from '@/components/canvas/ContextMenu';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Toggle } from '@/components/ui/Toggle';
import { useContextMenu } from '@/hooks/useContextMenu';

import { FloorTableRow } from './FloorTableRow';
import type { FloorManagerScreenState, FloorManagerViewProps, FloorRowVm } from './floorManagerTypes';

export interface FloorTableProps
  extends Pick<
    FloorManagerViewProps,
    | 'rows'
    | 'footer'
    | 'canEdit'
    | 'isAutoElevation'
    | 'emptyNotice'
    | 'errorMessage'
    | 'onSelectFloor'
    | 'onHoverFloor'
    | 'onFloorFieldChange'
    | 'onFloorFieldCommit'
    | 'onFloorFieldCancel'
    | 'onReorderFloors'
    | 'onAddFloor'
    | 'onDuplicateFloor'
    | 'onToggleHiddenIn3d'
    | 'onRemoveFloor'
    | 'onToggleAutoElevation'
    | 'onUploadDrawing'
    | 'onRetry'
  > {
  readonly state: FloorManagerScreenState;
}

const EMPTY_TITLE = 'chưa có tầng nào';
const ERROR_TITLE = 'không đọc được danh sách tầng';
const ADD_FLOOR_LABEL = 'Thêm tầng';
const DUPLICATE_SELECTED_LABEL = 'Nhân bản tầng';
const RETRY_LABEL = 'Thử lại';
const CAPTION_TEXT = 'cao độ tính tự động từ chiều cao các tầng dưới trừ khi ghi đè.';
const AUTO_ELEVATION_LABEL = 'tự động tính cao độ';

const EDITABLE_HEADERS: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'handle', label: 'Đổi thứ tự' },
  { key: 'name', label: 'Tên tầng' },
  { key: 'elevation', label: 'Cao độ (m)' },
  { key: 'height', label: 'Chiều cao (m)' },
  { key: 'drawings', label: 'Bản vẽ' },
  { key: 'walls', label: 'Tường' },
  { key: 'rooms', label: 'Phòng' },
  { key: 'area', label: 'Diện tích' },
  { key: 'qc', label: 'Tiến độ QC' },
  { key: 'actions', label: 'Hành động' },
];

export function FloorTable({
  state,
  rows,
  footer,
  canEdit,
  isAutoElevation,
  emptyNotice,
  errorMessage,
  onSelectFloor,
  onHoverFloor,
  onFloorFieldChange,
  onFloorFieldCommit,
  onFloorFieldCancel,
  onReorderFloors,
  onAddFloor,
  onDuplicateFloor,
  onToggleHiddenIn3d,
  onRemoveFloor,
  onToggleAutoElevation,
  onUploadDrawing,
  onRetry,
}: FloorTableProps) {
  const menu = useContextMenu();
  const [duplicatingFloorId, setDuplicatingFloorId] = useState<string | null>(null);
  const [copyFurniture, setCopyFurniture] = useState(false);
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const draggedFloorId = useRef<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDrop = () => {
    const fromIndex = rows.findIndex((row) => row.id === draggedFloorId.current);

    if (fromIndex === -1 || dragOverIndex === null) {
      draggedFloorId.current = null;
      setDragOverIndex(null);
      return;
    }

    const ids = rows.map((row) => row.id);
    const moved = ids.splice(fromIndex, 1)[0];

    if (moved !== undefined) {
      const insertAt = fromIndex < dragOverIndex ? dragOverIndex - 1 : dragOverIndex;
      ids.splice(insertAt, 0, moved);
      onReorderFloors(ids);
    }

    draggedFloorId.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    draggedFloorId.current = null;
    setDragOverIndex(null);
  };

  const headers = canEdit
    ? EDITABLE_HEADERS
    : EDITABLE_HEADERS.filter((header) => header.key !== 'handle' && header.key !== 'actions');
  const columnCount = headers.length;

  const openRowMenu = (event: MouseEvent, row: FloorRowVm) => {
    menu.openMenu(event.clientX, event.clientY, [
      {
        id: 'row-actions',
        items: [
          {
            id: 'rename',
            label: 'đổi tên',
            action: () => nameInputRefs.current[row.id]?.focus(),
          },
          {
            id: 'duplicate',
            label: 'nhân bản',
            action: () => {
              setCopyFurniture(false);
              setDuplicatingFloorId(row.id);
            },
          },
          {
            id: 'toggle-hidden',
            label: row.isHiddenIn3d ? 'hiện trong mô hình 3D' : 'ẩn khỏi mô hình 3D',
            action: () => onToggleHiddenIn3d(row.id),
          },
          {
            id: 'remove',
            label: 'xoá tầng',
            isDestructive: true,
            action: () => onRemoveFloor(row.id),
          },
        ],
      },
    ]);
  };

  const selectedRow = rows.find((row) => row.isSelected) ?? null;

  if (state === 'empty') {
    return (
      <EmptyState
        action={{ label: ADD_FLOOR_LABEL, onClick: onAddFloor }}
        className="h-full"
        description={emptyNotice ?? ''}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-bg-sunken" />}
        title={EMPTY_TITLE}
      />
    );
  }

  if (state === 'error') {
    return (
      <InlineAlert
        action={{ label: RETRY_LABEL, onClick: onRetry }}
        level="violation"
        message={errorMessage ?? ''}
        title={ERROR_TITLE}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {canEdit && state !== 'loading' && (
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={onAddFloor} size="sm" variant="secondary">
            {ADD_FLOOR_LABEL}
          </Button>
          {selectedRow !== null && (
            <Button
              onClick={() => {
                setCopyFurniture(false);
                setDuplicatingFloorId(selectedRow.id);
              }}
              size="sm"
              variant="ghost"
            >
              {DUPLICATE_SELECTED_LABEL}
            </Button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-border-default">
        <Table.Root>
          <Table.Header>
            <tr>
              {headers.map((header) => (
                <Table.Head key={header.key}>
                  {header.key === 'handle' || header.key === 'actions' ? (
                    <span className="sr-only">{header.label}</span>
                  ) : (
                    header.label
                  )}
                </Table.Head>
              ))}
            </tr>
          </Table.Header>
          <Table.Body>
            {state === 'loading' ? (
              <Table.Skeleton columns={columnCount} rows={4} />
            ) : (
              rows.map((row, index) => (
                <FloorTableRow
                  canEdit={canEdit}
                  copyFurniture={copyFurniture}
                  duplicatingFloorId={duplicatingFloorId}
                  index={index}
                  isAutoElevation={isAutoElevation}
                  key={row.id}
                  nameInputRef={(element) => {
                    nameInputRefs.current[row.id] = element;
                  }}
                  onCancelDuplicate={() => setDuplicatingFloorId(null)}
                  onConfirmDuplicate={(floorId) => {
                    onDuplicateFloor(floorId, { copyFurniture });
                    setDuplicatingFloorId(null);
                  }}
                  onDragEnd={handleDragEnd}
                  onDragHandleStart={(floorId) => {
                    draggedFloorId.current = floorId;
                  }}
                  onDragOverRow={setDragOverIndex}
                  onDropRow={handleDrop}
                  onFloorFieldCancel={onFloorFieldCancel}
                  onFloorFieldChange={onFloorFieldChange}
                  onFloorFieldCommit={onFloorFieldCommit}
                  onHoverFloor={onHoverFloor}
                  onOpenMenu={openRowMenu}
                  onReorderFloors={onReorderFloors}
                  onSelectFloor={onSelectFloor}
                  onSetCopyFurniture={setCopyFurniture}
                  onUploadDrawing={onUploadDrawing}
                  row={row}
                  rows={rows}
                  showInsertionLineBefore={dragOverIndex === index}
                />
              ))
            )}
          </Table.Body>
        </Table.Root>
      </div>

      {state !== 'loading' && (
        <>
          <p className="shrink-0 text-[12px] text-text-muted">{CAPTION_TEXT}</p>
          {canEdit && (
            <Toggle
              checked={isAutoElevation}
              className="shrink-0"
              label={AUTO_ELEVATION_LABEL}
              onChange={onToggleAutoElevation}
            />
          )}
          <p className="shrink-0 text-[13px] text-text-secondary">
            {footer.floorCountText} · tổng cao {footer.totalHeightText} · {footer.totalAreaText}
          </p>
        </>
      )}

      <ContextMenu groups={menu.groups} isVisible={menu.isVisible} onClose={menu.closeMenu} position={menu.position} />
    </div>
  );
}
