/**
 * Panel trái (280px) — danh sách trục, hai nhóm "Trục ngang"/"Trục dọc", và
 * bóng ma tầng dưới ở cuối panel.
 *
 * View THUẦN (R-60): không `@/api`, `@/store`, `@/domain`, `@/lib/http`. Props
 * dùng `Pick<AxisGridManagerProps, ...>` thay vì tự khai lại chữ ký handler —
 * cùng một nguồn sự thật với hook lớp sau (T5), không có chỗ hai bên lệch kiểu.
 *
 * Mỗi hàng trục là một hàng đứng cạnh nút mắt bật/tắt (KHÔNG lồng
 * `<button>` trong `<button>` — trình đọc màn hình chỉ thấy một trong hai),
 * đúng khuôn `WallLayerTreeRow`/`ObjectLayerTreeRow` đã được duyệt trước đó
 * (`WallLayerLeftPanel.tsx:97-117`). `spacingText`/`addButtonLabel` render
 * NGUYÊN VĂN từ props — file này không tự ghép câu, không tự định dạng số
 * (A15).
 *
 * ## Ba chỗ T8 sửa lúc ráp màn (quyết định của điều phối viên)
 *
 * 1. **Nút chữ của hàng gọi `onViewOnDrawing`, không gọi `onAxisSelect`.**
 *    JSDoc của chính hợp đồng T3 nói `onViewOnDrawing` là "chọn một trục rồi
 *    bay khung nhìn canvas tới nó" — tức nó ĐÃ LÀ hành động kích hoạt một hàng,
 *    không phải một nút thứ hai đứng cạnh. `onAxisSelect` giữ đường còn lại:
 *    bấm thẳng vào trục TRÊN CANVAS, và bỏ chọn khi bấm ra ngoài.
 * 2. **Mỗi hàng có nút xoá.** Mục nối lệnh của đặc tả ghi màn này nối lệnh
 *    "thêm, xoá, di chuyển trục"; A8 đòi mọi thay đổi hoàn tác được kèm toast,
 *    và hook đã dựng sẵn vé hoàn tác cho đường xoá. Không có nút thì cả đường
 *    dây đó là mã chết.
 * 3. **Vai Người xem không thấy nút thêm và nút xoá.** Đặc tả: "canvas chỉ
 *    xem, không thêm/xoá/kéo được trục"; A2 nói màu nhấn chỉ dành cho thứ
 *    tương tác được, nên một nút bấm vào không có gì xảy ra là thứ A2 tồn tại
 *    để chặn. Hook vẫn vô hiệu hoá ở tầng của nó — đây là lớp thứ hai, không
 *    phải lớp duy nhất.
 */

import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

import type {
  AxisAddOptions,
  AxisGridDirection,
  AxisGridManagerProps,
  AxisGroupViewModel,
  AxisRowViewModel,
} from './axisGridTypes';

export interface AxisGridLeftPanelProps
  extends Pick<
    AxisGridManagerProps,
    'onAxisAdd' | 'onAxisRemove' | 'onAxisToggleVisibility' | 'onGhostToggle' | 'onViewOnDrawing'
  > {
  readonly groups: readonly AxisGroupViewModel[];
  readonly ghostEnabled: boolean;
  /** G4b-24: false khi dự án chỉ có một tầng — công tắc bóng ma khoá kèm lý do. */
  readonly hasGhostFloors?: boolean;
  /** Vai Người xem: ẩn nút thêm và nút xoá — xem mục 3 ở đầu file. */
  readonly isViewerRole: boolean;
  readonly onAxisRename?: AxisGridRowProps['onRename'];
  readonly onAxisSpacingChange?: AxisGridRowProps['onSpacingChange'];
}

const PANEL_TITLE = 'Trục';
/** Nhãn tĩnh của Toggle — không đổi theo trạng thái bật/tắt, cùng khuôn `CENTRELINES_LABEL`. */
const GHOST_TOGGLE_LABEL = 'Hiện bóng ma tầng dưới';
const GHOST_TOGGLE_NO_FLOORS = 'Dự án chỉ có một tầng nên chưa có tầng nào để hiện bóng ma.';
/** Dấu gạch ngang chờ cho trục cuối nhóm (`spacingText === null`) — cùng khuôn `ScaleCalibrationMethodReference.tsx`. */
const MISSING_DISTANCE = '—';

function axisToggleAriaLabel(row: AxisRowViewModel): string {
  return row.isVisible ? `Ẩn trục ${row.label}` : `Hiện trục ${row.label}`;
}

/** Nhãn nút xoá — khoá `axisPanel.removeAxis` của `src/i18n/vi.json`. */
function axisRemoveAriaLabel(row: AxisRowViewModel): string {
  return `Xoá trục ${row.label}`;
}

/**
 * `axisPanel.rowAriaLabel` của T4 là `"Trục {{code}}, cách trục kế là
 * {{distance}} mm"`, viết cho một số thô. Kiểu chỉ cấp `spacingText` đã có sẵn
 * " mm" — ghép thẳng chuỗi đó thay vì tách số ra rồi nối lại " mm" một lần nữa
 * cho đúng NGUYÊN VĂN câu T4 định, không phải một câu khác.
 */
function axisRowAriaLabel(row: AxisRowViewModel): string {
  return `Trục ${row.label}, cách trục kế là ${row.spacingText ?? MISSING_DISTANCE}`;
}

interface AxisGridRowProps {
  readonly row: AxisRowViewModel;
  readonly isViewerRole: boolean;
  readonly onRemove: (axisId: string) => void;
  readonly onToggleVisibility: (axisId: string) => void;
  readonly onViewOnDrawing: (axisId: string) => void;
  readonly onRename?: ((axisId: string, label: string) => string | null) | undefined;
  readonly onSpacingChange?: ((axisId: string, spacingMm: number) => string | null) | undefined;
}

/** G4b-20: sửa tên + khoảng cách (mm) ngay trên hàng; Enter lưu, Esc huỷ. */
function AxisGridRowEditor({
  row,
  onClose,
  onRename,
  onSpacingChange,
}: {
  readonly row: AxisRowViewModel;
  readonly onClose: () => void;
  readonly onRename?: AxisGridRowProps['onRename'];
  readonly onSpacingChange?: AxisGridRowProps['onSpacingChange'];
}) {
  const [label, setLabel] = useState(row.label);
  const [spacing, setSpacing] = useState(row.spacingMm === null ? '' : String(Math.round(row.spacingMm)));
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const renameError = label.trim() === row.label ? null : (onRename?.(row.id, label) ?? null);

    if (renameError !== null) {
      setError(renameError);
      return;
    }

    const spacingMm = Number(spacing.replace(/\./g, '').replace(',', '.'));
    const original = row.spacingMm === null ? '' : String(Math.round(row.spacingMm));
    const spacingError = spacing === original || spacing === '' ? null : (onSpacingChange?.(row.id, spacingMm) ?? null);

    if (spacingError !== null) {
      setError(spacingError);
      return;
    }

    onClose();
  };

  return (
    <form
      aria-label={`Sửa trục ${row.label}`}
      className="flex flex-col gap-1 px-2 py-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      onSubmit={submit}
    >
      <div className="flex items-center gap-2">
        <input
          aria-label="Tên trục"
          autoFocus
          className="h-8 w-14 rounded-md border border-border-control bg-bg-surface px-2 text-[13px] font-semibold"
          maxLength={4}
          onChange={(event) => setLabel(event.target.value)}
          value={label}
        />
        <input
          aria-label="Khoảng cách tới trục kế (mm)"
          className="h-8 min-w-0 flex-1 rounded-md border border-border-control bg-bg-surface px-2 text-right text-[13px] tabular-nums"
          disabled={row.spacingMm === null}
          inputMode="numeric"
          onChange={(event) => setSpacing(event.target.value)}
          placeholder={row.spacingMm === null ? 'Trục cuối' : undefined}
          value={spacing}
        />
        <span className="text-[12px] text-text-secondary">mm</span>
      </div>
      {error === null ? null : (
        <p className="text-[12px] text-state-violation-text" role="alert">
          {error}
        </p>
      )}
      <p className="text-[12px] text-text-secondary">Enter để lưu, Esc để huỷ.</p>
      <button className="sr-only" type="submit">
        Lưu
      </button>
    </form>
  );
}

function AxisGridRow({
  row,
  isViewerRole,
  onRemove,
  onRename,
  onSpacingChange,
  onToggleVisibility,
  onViewOnDrawing,
}: AxisGridRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = !isViewerRole && onRename !== undefined;

  if (isEditing) {
    return (
      <AxisGridRowEditor
        onClose={() => setIsEditing(false)}
        onRename={onRename}
        onSpacingChange={onSpacingChange}
        row={row}
      />
    );
  }

  return (
    <div className="flex items-center gap-1 px-1" role="none">
      <button
        aria-label={axisRowAriaLabel(row)}
        aria-selected={row.isSelected}
        className={cn(
          'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px] outline-none',
          'transition-colors duration-120',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          row.isSelected ? 'bg-bg-selected text-text-primary' : 'text-text-primary hover:bg-bg-hover',
        )}
        onClick={() => onViewOnDrawing(row.id)}
        onDoubleClick={canEdit ? () => setIsEditing(true) : undefined}
        onKeyDown={(event) => {
          if (canEdit && event.key === 'F2') {
            setIsEditing(true);
          }
        }}
        role="option"
        type="button"
      >
        <span className="w-8 shrink-0 font-mono font-semibold">{row.label}</span>
        <span className="ml-auto shrink-0 font-mono tabular-nums text-text-secondary">
          {row.spacingText ?? MISSING_DISTANCE}
        </span>
      </button>
      {canEdit ? (
        <IconButton
          aria-label={`Sửa trục ${row.label}`}
          icon={<Pencil className="h-4 w-4" />}
          onClick={() => setIsEditing(true)}
          size="sm"
        />
      ) : null}
      <IconButton
        aria-label={axisToggleAriaLabel(row)}
        aria-pressed={row.isVisible}
        icon={row.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        onClick={() => onToggleVisibility(row.id)}
        size="sm"
      />
      {isViewerRole ? null : (
        <IconButton
          aria-label={axisRemoveAriaLabel(row)}
          icon={<Trash2 className="h-4 w-4" />}
          onClick={() => onRemove(row.id)}
          size="sm"
        />
      )}
    </div>
  );
}

interface AxisGridGroupProps {
  readonly group: AxisGroupViewModel;
  readonly isViewerRole: boolean;
  readonly onAxisAdd: (direction: AxisGridDirection, options?: AxisAddOptions) => void;
  readonly onAxisRemove: (axisId: string) => void;
  readonly onAxisToggleVisibility: (axisId: string) => void;
  readonly onViewOnDrawing: (axisId: string) => void;
  readonly onAxisRename?: AxisGridRowProps['onRename'];
  readonly onAxisSpacingChange?: AxisGridRowProps['onSpacingChange'];
}

function AxisGridGroup({
  group,
  isViewerRole,
  onAxisAdd,
  onAxisRemove,
  onAxisRename,
  onAxisSpacingChange,
  onAxisToggleVisibility,
  onViewOnDrawing,
}: AxisGridGroupProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSpacing, setNewSpacing] = useState('');
  const closeAdd = (): void => {
    setIsAdding(false);
    setNewLabel('');
    setNewSpacing('');
  };
  const submitAdd = (event: FormEvent): void => {
    event.preventDefault();
    const spacing = Number(newSpacing.replace(/\./gu, '').replace(',', '.'));
    onAxisAdd(group.direction, {
      label: newLabel,
      ...(newSpacing.trim() !== '' && Number.isFinite(spacing) && spacing > 0 ? { spacingMm: spacing } : {}),
    });
    closeAdd();
  };

  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      <h4 className="px-1 text-[13px] font-semibold text-text-secondary">{group.title}</h4>
      <div aria-label={group.title} className="flex flex-col gap-0.5" role="listbox">
        {group.rows.map((row) => (
          <AxisGridRow
            isViewerRole={isViewerRole}
            key={row.id}
            onRemove={onAxisRemove}
            onRename={onAxisRename}
            onSpacingChange={onAxisSpacingChange}
            onToggleVisibility={onAxisToggleVisibility}
            onViewOnDrawing={onViewOnDrawing}
            row={row}
          />
        ))}
      </div>
      {!isViewerRole && isAdding ? (
        <form
          className="mt-1 flex flex-wrap items-end gap-2 rounded-lg border border-border-default p-2"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeAdd();
            }
          }}
          onSubmit={submitAdd}
        >
          <label className="flex flex-col gap-1 text-[12px] text-text-secondary">
            Tên trục
            <input
              autoFocus
              className="h-8 w-16 rounded-md border border-border-default bg-bg-surface px-2 text-[13px] text-text-primary"
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="Tự đặt"
              value={newLabel}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-secondary">
            Cách trục cuối (mm)
            <input
              className="h-8 w-24 rounded-md border border-border-default bg-bg-surface px-2 text-[13px] text-text-primary"
              inputMode="decimal"
              onChange={(event) => setNewSpacing(event.target.value)}
              placeholder="Như cũ"
              value={newSpacing}
            />
          </label>
          <Button size="sm" type="submit">Thêm</Button>
          <Button onClick={closeAdd} size="sm" type="button" variant="ghost">Huỷ</Button>
        </form>
      ) : null}
      {isViewerRole || isAdding ? null : (
        <Button
          className="mt-1 self-start"
          iconBefore={<Plus className="h-4 w-4" />}
          onClick={() => {
            setNewLabel(group.nextLabel ?? '');
            setIsAdding(true);
          }}
          size="sm"
          variant="ghost"
        >
          {group.addButtonLabel}
        </Button>
      )}
    </div>
  );
}

export function AxisGridLeftPanel({
  groups,
  ghostEnabled,
  hasGhostFloors = true,
  isViewerRole,
  onAxisAdd,
  onAxisRemove,
  onAxisToggleVisibility,
  onAxisRename,
  onAxisSpacingChange,
  onGhostToggle,
  onViewOnDrawing,
}: AxisGridLeftPanelProps) {
  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel max-lg:w-full">
      <div className="flex h-14 shrink-0 items-center px-5">
        <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.map((group) => (
          <AxisGridGroup
            group={group}
            isViewerRole={isViewerRole}
            key={group.direction}
            onAxisAdd={onAxisAdd}
            onAxisRemove={onAxisRemove}
            onAxisRename={onAxisRename}
            onAxisSpacingChange={onAxisSpacingChange}
            onAxisToggleVisibility={onAxisToggleVisibility}
            onViewOnDrawing={onViewOnDrawing}
          />
        ))}
      </div>

      <div className="shrink-0 border-t border-border-default px-5 py-4">
        <Toggle
          checked={hasGhostFloors && ghostEnabled}
          description={hasGhostFloors ? undefined : GHOST_TOGGLE_NO_FLOORS}
          disabled={!hasGhostFloors}
          label={GHOST_TOGGLE_LABEL}
          onChange={() => onGhostToggle()}
        />
      </div>
    </div>
  );
}
