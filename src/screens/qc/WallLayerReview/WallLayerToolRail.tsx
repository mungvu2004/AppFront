/**
 * Ray công cụ trái (56px) của màn Duyệt lớp tường.
 *
 * View THUẦN (R-60): không `useState` cho công cụ đang chọn — đó là trạng thái
 * NGHIỆP VỤ (S-08 `toolMachine`), sở hữu bởi hook, không phải bản sao cục bộ ở
 * đây (mục D). {@link WallLayerToolRailProps} là phần MỞ RỘNG ngoài `types.ts`
 * (đóng băng vì ba worker song song) — quyết định của điều phối viên sau khi
 * worker này báo lỗ hổng hợp đồng: component con được phép tự khai props của
 * chính nó, thay vì sửa `types.ts`. Container/hook (T8) truyền các trường này
 * khi ghép màn.
 *
 * "nối đoạn" KHÔNG phải một `ToolId` (toolMachine không có mục cho merge) — nó
 * là nút HÀNH ĐỘNG theo vùng chọn, vô hiệu qua `canMerge` (hook tính, vì canvas
 * hiện chỉ có một `selectedWallId`, không phải danh sách nhiều lựa chọn).
 */

import { Fragment } from 'react';
import {
  GitMerge,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Ruler,
  Scissors,
  Square,
  type LucideIcon,
} from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';

/** Bốn chế độ công cụ thật của màn — khớp `ToolId` của `toolMachine` (không có mục merge). */
export type WallLayerToolId = 'select' | 'drawWall' | 'splitWall' | 'measure';

export interface WallLayerToolRailProps {
  readonly activeTool: WallLayerToolId;
  readonly onSelectTool: (tool: WallLayerToolId) => void;
  /** Bật khi đã chọn đủ hai đoạn tường để gộp. */
  readonly canMerge: boolean;
  readonly onMerge: () => void;
  /** `true` ở vai Người xem — ẩn công cụ vẽ/tách/gộp, chỉ còn chọn và đo. */
  readonly readOnly: boolean;
  /** Hai panel đang thu gọn hay không — nút cuối ray đổi nhãn theo nó. */
  readonly isCollapsed: boolean;
  /**
   * Thu gọn / mở lại hai panel (BT-16).
   *
   * `WallLayerViewProps.onToggleCollapsed` đã có từ hợp đồng L1 nhưng KHÔNG
   * view nào gọi, nên trạng thái `collapsed` chỉ tới được từ `forceCollapsed` —
   * một cửa của story và bài kiểm, không phải của người dùng. R-73 gọi đích
   * danh "một hành động chỉ tồn tại như một prop optional không ai truyền", nên
   * nút này là chỗ hành động đó có mặt trên màn.
   */
  readonly onToggleCollapsed: () => void;
}

interface WallLayerToolDef {
  readonly id: WallLayerToolId;
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6). */
  readonly label: string;
  readonly icon: LucideIcon;
  /** Tên phím — chữ hoa vì đây là tên phím, ngoại lệ của A6. */
  readonly kbd?: string;
  /** `true` cho công cụ chỉnh sửa — ẩn hẳn ở vai Người xem. */
  readonly isEditTool: boolean;
}

const TOOLS: readonly WallLayerToolDef[] = [
  { id: 'select', label: 'chọn', icon: MousePointer2, kbd: 'V', isEditTool: false },
  { id: 'drawWall', label: 'vẽ tường', icon: Square, kbd: 'W', isEditTool: true },
  { id: 'splitWall', label: 'tách đoạn', icon: Scissors, isEditTool: true },
  { id: 'measure', label: 'đo', icon: Ruler, kbd: 'M', isEditTool: false },
];

const MERGE_LABEL = 'nối đoạn';
const MERGE_HINT = 'Chọn hai đoạn tường để gộp';
const RAIL_ARIA_LABEL = 'Công cụ lớp tường';
const COLLAPSE_LABEL = 'Thu gọn hai panel';
const EXPAND_LABEL = 'Mở lại hai panel';

/**
 * Vị trí của "nối đoạn" trên ray — TRƯỚC "đo" (BC-02).
 *
 * Đặc tả đọc ray theo thứ tự chọn · vẽ tường · tách đoạn · nối đoạn · đo. "Nối
 * đoạn" vẫn KHÔNG phải một `ToolId` thứ chín (xem đầu file), nên nó không vào
 * được {@link TOOLS}; thay vào đó khối nút của nó được chèn ngay trước mục mang
 * mã này. Ở vai Người xem "đo" vẫn hiện còn "nối đoạn" bị ẩn, và thứ tự này
 * không đụng vào hai nhánh đó.
 */
const MERGE_BEFORE_TOOL: WallLayerToolId = 'measure';

export function WallLayerToolRail({
  activeTool,
  onSelectTool,
  canMerge,
  onMerge,
  readOnly,
  isCollapsed,
  onToggleCollapsed,
}: WallLayerToolRailProps) {
  const collapseLabel = isCollapsed ? EXPAND_LABEL : COLLAPSE_LABEL;
  const CollapseIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  const mergeButton = readOnly ? null : (
    <div className="relative flex w-full justify-center" key="merge">
      <Tooltip label={canMerge ? MERGE_LABEL : MERGE_HINT}>
        <IconButton
          aria-label={canMerge ? MERGE_LABEL : `${MERGE_LABEL} — ${MERGE_HINT}`}
          disabled={!canMerge}
          icon={<GitMerge aria-hidden="true" className="h-[18px] w-[18px]" />}
          onClick={onMerge}
          size="lg"
          tooltip={false}
        />
      </Tooltip>
    </div>
  );

  return (
    <div
      aria-label={RAIL_ARIA_LABEL}
      aria-orientation="vertical"
      className="flex w-[56px] shrink-0 flex-col items-center gap-1 py-2"
      role="toolbar"
    >
      {TOOLS.map((tool) => {
        if (readOnly && tool.isEditTool) {
          return null;
        }

        const isActive = tool.id === activeTool;
        const Icon = tool.icon;

        const button = (
          <div className="relative flex w-full justify-center" key={tool.id}>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-accent"
              />
            )}
            <Tooltip {...(tool.kbd !== undefined ? { kbd: tool.kbd } : {})} label={tool.label}>
              <IconButton
                aria-label={tool.kbd ? `${tool.label} (phím ${tool.kbd})` : tool.label}
                className={isActive ? 'bg-accent-wash text-accent hover:bg-accent-wash' : undefined}
                icon={<Icon aria-hidden="true" className="h-[18px] w-[18px]" />}
                isActive={isActive}
                onClick={() => onSelectTool(tool.id)}
                size="lg"
                tooltip={false}
              />
            </Tooltip>
          </div>
        );

        if (tool.id !== MERGE_BEFORE_TOOL) {
          return button;
        }

        return (
          <Fragment key={tool.id}>
            {mergeButton}
            {button}
          </Fragment>
        );
      })}

      <div className="relative mt-1 flex w-full justify-center">
        <Tooltip label={collapseLabel}>
          <IconButton
            aria-label={collapseLabel}
            icon={<CollapseIcon aria-hidden="true" className="h-[18px] w-[18px]" />}
            onClick={onToggleCollapsed}
            size="lg"
            tooltip={false}
          />
        </Tooltip>
      </div>
    </div>
  );
}
