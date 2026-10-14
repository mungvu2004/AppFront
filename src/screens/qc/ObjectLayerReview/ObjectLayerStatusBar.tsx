/**
 * Thanh trạng thái (32px) của màn Lớp đối tượng — đúng khuôn QC-SHELL
 * (`WallLayerStatusBar.tsx`, `.orca-notes/T3-qcshell.md` mục H): tự dựng
 * bằng `div` trần, KHÔNG dùng `src/components/shell/StatusBar` (component
 * đó tự `toFixed(2)` số thô bên trong, nằm trong sổ nợ `no-raw-number` đã
 * ghi ở `CLAUDE.md`, không phải khuôn để chép).
 *
 * `ObjectLayerStatusBarProps` (`objectLayerTypes.ts`, đóng băng) khác hẳn
 * `WallLayerStatusBarProps`: không có `cursorLabel`/`scaleLabel`/`saveLabel`
 * — thay vào đó mang thẳng trạng thái màn (`state`, các `*Notice`) và hai
 * hành động (`onUndo`, `onToggleCollapsed`). Vì vậy khuôn ba cột "toạ độ ·
 * tỷ lệ · lưu" của màn anh em không áp được nguyên văn; bố cục ở đây là bộ
 * đếm (trái) · ghi chú trạng thái đang hoạt động, nếu có (giữa) · hai hành
 * động (phải).
 *
 * ## A7 — không có trường "trạng thái tự lưu" riêng, dùng `aria-live`
 *
 * A7 đòi hệ thống "tự lưu và nói ra trạng thái đó cho trình đọc màn hình",
 * nhưng hợp đồng props ở đây không có một chuỗi `saveLabel` như màn anh em.
 * Bộ đếm `reviewProgressLabel` là thứ DUY NHẤT thay đổi ngay sau một thao
 * tác đã tự lưu (duyệt/gộp lệnh), nên bọc chính nó bằng `aria-live="polite"`
 * là cách nói ra trạng thái đó cho trình đọc màn hình mà không cần thêm một
 * trường mới vào hợp đồng đã đóng băng của T4.
 */

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

import type { ObjectLayerStatusBarProps } from './objectLayerTypes';

const STATUS_BAR_ARIA_LABEL = 'Thanh trạng thái';
/** Nút chữ cao 24 px: vùng chạm tối thiểu WCAG 2.5.8 trong thanh 32 px (BUG-325, trước đó 49×18). */
const UNDO_LABEL = 'Hoàn tác';
const COLLAPSE_LABEL = 'Thu gọn hai panel';
const EXPAND_LABEL = 'Mở lại hai panel';

export function ObjectLayerStatusBar({
  reviewProgressLabel,
  errorMessage,
  viewerRoleNotice,
  furnitureAttentionNotice,
  isCollapsed,
  onToggleCollapsed,
  onUndo,
}: ObjectLayerStatusBarProps) {
  /* Câu rỗng đã ở trạng thái rỗng của panel: không lặp lần thứ hai ở đây (BUG-422). */
  const notice = errorMessage ?? furnitureAttentionNotice ?? viewerRoleNotice;
  const isViewer = viewerRoleNotice !== null;

  const noticeTone =
    errorMessage !== null
      ? 'text-state-violation-text'
      : furnitureAttentionNotice !== null
        ? 'text-state-attention-text'
        : 'text-text-secondary';

  return (
    <div
      aria-label={STATUS_BAR_ARIA_LABEL}
      className="flex h-8 shrink-0 select-none items-center justify-between gap-2 whitespace-nowrap border-t border-border-default bg-bg-surface px-4"
      role="status"
    >
      {/* Câu, không mono (BUG-612); một dòng, không gãy ở 375 (BUG-324). */}
      <span aria-live="polite" className="shrink-0 text-[12px] leading-none tabular-nums text-text-secondary">
        {reviewProgressLabel}
      </span>

      {notice !== null && (
        <span className={cn('hidden min-w-0 truncate px-2 text-[12px] sm:block', noticeTone)}>{notice}</span>
      )}

      <div className="flex shrink-0 items-center gap-2">
        {/* Người xem không hoàn tác được gì: không đưa nút chết (BUG-601). */}
        {isViewer ? null : (
        <button
          className="inline-flex h-6 items-center rounded px-1.5 text-[12px] font-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          onClick={onUndo}
          type="button"
        >
          {UNDO_LABEL}
        </button>
        )}
        <IconButton
          aria-label={isCollapsed ? EXPAND_LABEL : COLLAPSE_LABEL}
          icon={
            isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
            )
          }
          onClick={onToggleCollapsed}
          size="sm"
          tooltip={false}
        />
      </div>
    </div>
  );
}
