/**
 * Thanh công cụ nổi — viên thuốc bo `toolbarRadiusPx` (999), bóng nổi.
 *
 * Sáu nút chỉ biểu tượng, mỗi nút bọc trong `Tooltip` mang đúng chuỗi
 * `WallGeometryToolButton.tooltip` đã ghép sẵn (view không tự nối chuỗi, xem
 * `wallGeometryEditorTypes.ts`). `aria-label` lấy `label` — bắt buộc cho nút
 * chỉ-biểu-tượng (R-72). Ở trạng thái `empty`, `toolbar.buttons` rỗng và
 * `toolbar.hint` thay chỗ sáu nút bằng MỘT CÂU GỢI Ý.
 *
 * Bảng biểu tượng là một `Record` đầy đủ theo `WallGeometryToolIconCode`
 * (`wallGeometryEditorTypes.ts`) — thiếu một mã là lỗi biên dịch, không phải
 * một ô vuông trắng.
 */
import { ArrowUpDown, Link2, Move, Plus, Scissors, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

import {
  WALL_GEOMETRY_EDITOR_LAYOUT,
  type WallGeometryToolButton,
  type WallGeometryToolIconCode,
  type WallGeometryToolbar,
} from './wallGeometryEditorTypes';

const TOOL_ICONS: Readonly<Record<WallGeometryToolIconCode, ReactNode>> = {
  moveVertex: <Move size={16} />,
  addVertex: <Plus size={16} />,
  removeVertex: <Trash2 size={16} />,
  splitWall: <Scissors size={16} />,
  joinWalls: <Link2 size={16} />,
  resetHeight: <ArrowUpDown size={16} />,
};

function ToolbarButton({ button }: { button: WallGeometryToolButton }): ReactNode {
  return (
    <Tooltip label={button.tooltip}>
      <IconButton
        aria-label={button.label}
        disabled={!button.isEnabled}
        icon={TOOL_ICONS[button.iconCode]}
        isActive={button.isActive}
        onClick={button.onSelect}
        tooltip={false}
      />
    </Tooltip>
  );
}

export interface WallGeometryEditorToolbarProps {
  readonly toolbar: WallGeometryToolbar;
}

export function WallGeometryEditorToolbar({ toolbar }: WallGeometryEditorToolbarProps): ReactNode {
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-1 bg-bg-surface px-2 py-1.5 shadow-float',
      )}
      role="toolbar"
      style={{ borderRadius: WALL_GEOMETRY_EDITOR_LAYOUT.toolbarRadiusPx }}
    >
      {toolbar.buttons.length === 0 ? (
        <span className="px-2 text-[13px] text-text-secondary">{toolbar.hint}</span>
      ) : (
        toolbar.buttons.map((button) => <ToolbarButton button={button} key={button.id} />)
      )}
    </div>
  );
}
