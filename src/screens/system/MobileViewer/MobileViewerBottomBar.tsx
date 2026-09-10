/**
 * Thanh dưới của màn `/m/du-an/:projectId`, và tấm công cụ nó mở ra.
 *
 * **Vì sao thanh và tấm ở cùng một file.** Tấm "tầng" và tấm "đo" không tồn tại
 * độc lập với thanh: chúng mở ra vì một biểu tượng trên thanh đang bật, và tắt
 * đi cùng lúc với nó. Tách làm hai file thì `activeTool` phải đi qua hai nơi và
 * quy tắc "ở 320 thì `view` là một hàng bên trong tấm tầng" nằm rải ở cả hai —
 * đúng thứ dễ lệch nhau khi một trong hai được sửa.
 *
 * **Vùng bấm.** Mọi biểu tượng dùng `IconButton size="lg"`. Khảo sát đã đo thật:
 * `md` (mặc định) ra 40px và **trượt đặc tả 4px**, chỉ `lg` đạt đúng
 * {@link MOBILE_VIEWER_MIN_HIT_TARGET_PX}. Các hàng trong tấm không phải
 * `IconButton` nên chúng nhận `minHeight` nội tuyến lấy thẳng từ hằng ấy —
 * không có con số 44 nào viết tay trong file này.
 *
 * **Ở 320 không mất chức năng nào.** `MOBILE_VIEWER_TOOLS_COMPACT` bỏ biểu
 * tượng `view` khỏi thanh, nên `view` trở thành một hàng bên trong tấm "tầng"
 * và tấm ấy **ở lại mở** khi `view` đang bật — nếu không, bấm vào hàng đó sẽ
 * đóng chính cái tấm chứa nó và người dùng mất đường quay lại.
 */

import type { ReactNode } from 'react';

import { Eye, Info, Layers, Ruler } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

import {
  MOBILE_VIEWER_BOTTOM_BAR_PX,
  MOBILE_VIEWER_MIN_HIT_TARGET_PX,
  MOBILE_VIEWER_TOOLS,
  MOBILE_VIEWER_TOOLS_COMPACT,
} from './mobileViewerTypes';
import type {
  MobileViewerFloor,
  MobileViewerMeasurement,
  MobileViewerToolId,
} from './mobileViewerTypes';

/** Nhãn của bốn công cụ. Tiếng Việt, viết thường kiểu câu (A6). */
const TOOL_LABELS: Readonly<Record<MobileViewerToolId, string>> = {
  floors: 'tầng',
  view: 'chế độ xem',
  measure: 'đo',
  info: 'thông tin',
};

/** Biểu tượng của một công cụ. `lucide-react`, không chữ nên không dính A6. */
function toolIconOf(tool: MobileViewerToolId) {
  if (tool === 'floors') {
    return <Layers />;
  }

  if (tool === 'view') {
    return <Eye />;
  }

  if (tool === 'measure') {
    return <Ruler />;
  }

  return <Info />;
}

export interface MobileViewerBottomBarProps {
  readonly isCompact: boolean;
  readonly activeTool: MobileViewerToolId | null;
  readonly onSelectTool: (tool: MobileViewerToolId | null) => void;
  readonly floors: readonly MobileViewerFloor[];
  readonly activeFloorId: string | null;
  readonly onSelectFloor: (floorId: string) => void;
  readonly measurements: readonly MobileViewerMeasurement[];
}

interface PanelRowProps {
  readonly label: string;
  readonly isActive: boolean;
  readonly onActivate: () => void;
  readonly trailing?: ReactNode;
}

/** Một hàng bấm được trong tấm. Cao tối thiểu đúng bằng sàn vùng bấm. */
function PanelRow({ label, isActive, onActivate, trailing }: PanelRowProps) {
  return (
    <button
      aria-pressed={isActive}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[14px] outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
        isActive ? 'bg-bg-selected text-text-primary' : 'text-text-secondary hover:bg-bg-hover',
      )}
      onClick={onActivate}
      style={{ minHeight: MOBILE_VIEWER_MIN_HIT_TARGET_PX }}
      type="button"
    >
      <span className="truncate">{label}</span>
      {trailing}
    </button>
  );
}

/** Khung của tấm — nền đặc, không lớp mờ (hậu tố alpha của Tailwind ra rỗng). */
function ToolPanel({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return (
    <div
      aria-label={label}
      className="max-h-[45vh] shrink-0 overflow-y-auto border-t border-border-default bg-bg-surface px-3 py-2"
      role="group"
    >
      {children}
    </div>
  );
}

export function MobileViewerBottomBar({
  isCompact,
  activeTool,
  onSelectTool,
  floors,
  activeFloorId,
  onSelectFloor,
  measurements,
}: MobileViewerBottomBarProps) {
  const tools = isCompact ? MOBILE_VIEWER_TOOLS_COMPACT : MOBILE_VIEWER_TOOLS;
  const showsFloorPanel = activeTool === 'floors' || (isCompact && activeTool === 'view');
  const showsMeasurePanel = activeTool === 'measure';

  return (
    <div className="relative z-10 flex shrink-0 flex-col">
      {showsFloorPanel && (
        <ToolPanel label={TOOL_LABELS.floors}>
          {floors.length === 0 ? (
            <p className="px-3 py-2 text-[13px] leading-relaxed text-text-secondary">
              chưa có tầng nào để hiện.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {floors.map((floor) => (
                <PanelRow
                  isActive={floor.id === activeFloorId}
                  key={floor.id}
                  label={floor.label}
                  onActivate={() => {
                    onSelectFloor(floor.id);
                  }}
                  {...(floor.isLoaded ? {} : { trailing: <Badge variant="neutral">chưa tải</Badge> })}
                />
              ))}
            </div>
          )}

          {/* Ở 320, `view` sống ở đây thay vì trên thanh — cùng nhãn, cùng
              hành động, nên không chức năng nào mất theo biểu tượng. */}
          {isCompact && (
            <div className="mt-2 border-t border-border-default pt-2">
              <PanelRow
                isActive={activeTool === 'view'}
                label={TOOL_LABELS.view}
                onActivate={() => {
                  onSelectTool(activeTool === 'view' ? 'floors' : 'view');
                }}
              />
            </div>
          )}
        </ToolPanel>
      )}

      {showsMeasurePanel && (
        <ToolPanel label={TOOL_LABELS.measure}>
          {measurements.length === 0 ? (
            <p className="px-3 py-2 text-[13px] leading-relaxed text-text-secondary">
              chưa có phép đo nào. chạm hai điểm trên mô hình để đo.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {measurements.map((measurement) => (
                <li
                  className="flex items-center justify-between gap-3 px-3 py-2 text-[14px]"
                  key={measurement.id}
                >
                  <span className="truncate text-text-secondary">{measurement.kindLabel}</span>
                  <span className="font-medium text-text-primary">{measurement.valueLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </ToolPanel>
      )}

      <nav
        aria-label="công cụ xem mô hình"
        className="flex items-center justify-around border-t border-border-default bg-bg-surface px-2"
        style={{ height: MOBILE_VIEWER_BOTTOM_BAR_PX }}
      >
        {tools.map((tool) => (
          <IconButton
            aria-label={TOOL_LABELS[tool]}
            icon={toolIconOf(tool)}
            isActive={activeTool === tool}
            key={tool}
            onClick={() => {
              onSelectTool(activeTool === tool ? null : tool);
            }}
            size="lg"
            tooltip={false}
          />
        ))}
      </nav>
    </div>
  );
}
