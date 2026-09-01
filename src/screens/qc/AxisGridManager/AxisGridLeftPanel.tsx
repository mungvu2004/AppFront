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
 */

import { Eye, EyeOff, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

import type {
  AxisGridDirection,
  AxisGridManagerProps,
  AxisGroupViewModel,
  AxisRowViewModel,
} from './axisGridTypes';

export interface AxisGridLeftPanelProps
  extends Pick<AxisGridManagerProps, 'onAxisAdd' | 'onAxisSelect' | 'onAxisToggleVisibility' | 'onGhostToggle'> {
  readonly groups: readonly AxisGroupViewModel[];
  readonly ghostEnabled: boolean;
}

const PANEL_TITLE = 'Trục';
/** Nhãn tĩnh của Toggle — không đổi theo trạng thái bật/tắt, cùng khuôn `CENTRELINES_LABEL`. */
const GHOST_TOGGLE_LABEL = 'Hiện bóng ma tầng dưới';
/** Dấu gạch ngang chờ cho trục cuối nhóm (`spacingText === null`) — cùng khuôn `ScaleCalibrationMethodReference.tsx`. */
const MISSING_DISTANCE = '—';

function axisToggleAriaLabel(row: AxisRowViewModel): string {
  return row.isVisible ? `Ẩn trục ${row.label}` : `Hiện trục ${row.label}`;
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
  readonly onSelect: (axisId: string) => void;
  readonly onToggleVisibility: (axisId: string) => void;
}

function AxisGridRow({ row, onSelect, onToggleVisibility }: AxisGridRowProps) {
  return (
    <div className="flex items-center gap-1 px-1" role="none">
      <button
        aria-label={axisRowAriaLabel(row)}
        aria-selected={row.isSelected}
        className={cn(
          'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[8px] px-2 text-left text-[13px] outline-none',
          'transition-colors duration-120',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          row.isSelected ? 'bg-bg-selected text-text-primary' : 'text-text-primary hover:bg-bg-hover',
        )}
        onClick={() => onSelect(row.id)}
        role="option"
        type="button"
      >
        <span className="w-8 shrink-0 font-mono font-semibold">{row.label}</span>
        <span className="ml-auto shrink-0 font-mono tabular-nums text-text-secondary">
          {row.spacingText ?? MISSING_DISTANCE}
        </span>
      </button>
      <IconButton
        aria-label={axisToggleAriaLabel(row)}
        aria-pressed={row.isVisible}
        icon={row.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        onClick={() => onToggleVisibility(row.id)}
        size="sm"
      />
    </div>
  );
}

interface AxisGridGroupProps {
  readonly group: AxisGroupViewModel;
  readonly onAxisAdd: (direction: AxisGridDirection) => void;
  readonly onAxisSelect: (axisId: string) => void;
  readonly onAxisToggleVisibility: (axisId: string) => void;
}

function AxisGridGroup({ group, onAxisAdd, onAxisSelect, onAxisToggleVisibility }: AxisGridGroupProps) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      <h4 className="px-1 text-[13px] font-semibold text-text-secondary">{group.title}</h4>
      <div aria-label={group.title} className="flex flex-col gap-0.5" role="listbox">
        {group.rows.map((row) => (
          <AxisGridRow key={row.id} onSelect={onAxisSelect} onToggleVisibility={onAxisToggleVisibility} row={row} />
        ))}
      </div>
      <Button
        className="mt-1 self-start"
        iconBefore={<Plus className="h-4 w-4" />}
        onClick={() => onAxisAdd(group.direction)}
        size="sm"
        variant="ghost"
      >
        {group.addButtonLabel}
      </Button>
    </div>
  );
}

export function AxisGridLeftPanel({
  groups,
  ghostEnabled,
  onAxisAdd,
  onAxisSelect,
  onAxisToggleVisibility,
  onGhostToggle,
}: AxisGridLeftPanelProps) {
  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel">
      <div className="flex h-14 shrink-0 items-center px-5">
        <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.map((group) => (
          <AxisGridGroup
            group={group}
            key={group.direction}
            onAxisAdd={onAxisAdd}
            onAxisSelect={onAxisSelect}
            onAxisToggleVisibility={onAxisToggleVisibility}
          />
        ))}
      </div>

      <div className="shrink-0 border-t border-border-default px-5 py-4">
        <Toggle checked={ghostEnabled} label={GHOST_TOGGLE_LABEL} onChange={() => onGhostToggle()} />
      </div>
    </div>
  );
}
