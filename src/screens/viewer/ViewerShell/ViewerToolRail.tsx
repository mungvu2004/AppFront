/**
 * Ray công cụ trái, rộng 56 — quay quanh · kéo màn · đo · mặt cắt · chọn · cô lập.
 *
 * View thuần (R-60): dữ liệu và hàm xử lý đến qua props.
 *
 * ## Vai Người xem: công cụ bị GỠ, không bị làm mờ
 *
 * `props.tools` đã được `useViewerShell` lọc bằng `can('edit', 'layer', …)`
 * trước khi tới đây, nên ray không bao giờ vẽ một nút rồi vô hiệu hoá nó. Một
 * nút mờ vẫn là một nút: nó chiếm chỗ trên đường Tab, trình đọc màn hình vẫn
 * đọc ra, và người dùng vẫn phải đoán vì sao bấm không được. Đặc tả nói "gỡ
 * khỏi ray", và gỡ thật là cách duy nhất giữ đúng lời ấy cho cả chuột lẫn bàn
 * phím (A12).
 */

import {
  Crosshair,
  Hand,
  MousePointer2,
  Rotate3d,
  Ruler,
  Scissors,
  type LucideIcon,
} from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';

import type { ViewerToolId, ViewerToolViewModel } from './viewerShellTypes';

/** Biểu tượng của từng công cụ. Khai đủ sáu, nên không nhánh nào ra rỗng. */
const TOOL_ICONS: Readonly<Record<ViewerToolId, LucideIcon>> = {
  orbit: Rotate3d,
  pan: Hand,
  measure: Ruler,
  section: Scissors,
  select: MousePointer2,
  isolate: Crosshair,
};

export interface ViewerToolRailProps {
  readonly tools: readonly ViewerToolViewModel[];
  readonly activeToolId: ViewerToolId;
  readonly onToolChange: (id: ViewerToolId) => void;
}

export function ViewerToolRail({ tools, activeToolId, onToolChange }: ViewerToolRailProps) {
  return (
    <div
      aria-label="Công cụ khung nhìn"
      aria-orientation="vertical"
      className="flex w-[56px] shrink-0 flex-col items-center gap-1 py-2"
      role="toolbar"
    >
      {tools.map((tool) => {
        const Icon = TOOL_ICONS[tool.id];

        return (
          <IconButton
            aria-label={`${tool.label} (${tool.keyLabel})`}
            aria-pressed={tool.id === activeToolId}
            icon={<Icon aria-hidden="true" className="h-[18px] w-[18px]" />}
            isActive={tool.id === activeToolId}
            key={tool.id}
            onClick={(): void => {
              onToolChange(tool.id);
            }}
            size="lg"
          />
        );
      })}
    </div>
  );
}
