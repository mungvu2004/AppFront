/**
 * S-36 — cây cấu trúc bên trái.
 *
 * Phần con của một màn, không phải component dùng chung: nó không ra khỏi thư
 * mục này (R-68).
 *
 * ## Vì sao là danh sách chứ không phải `TreeItem` của thư viện
 *
 * `components/ui/TreeItem.tsx` dựng một nút cây tự giữ trạng thái mở. Ở đây
 * trạng thái mở sống trong hook, và hàng đã được dàn phẳng kèm sẵn `depth` —
 * nên cái cần là một hàng biết thụt lề, không phải một cây thứ hai. Dùng
 * `TreeItem` sẽ thành hai nguồn cho cùng một câu hỏi "nút này đang mở chưa".
 *
 * Vai trò ARIA vẫn là cây thật: `role="tree"` cộng `aria-level` và
 * `aria-expanded` trên từng hàng, nên trình đọc màn hình nghe đúng cấu trúc dù
 * DOM là một danh sách phẳng.
 *
 * ## Tam giác gấp mở KHÔNG phải một nút riêng
 *
 * Bản đầu dựng nó thành `<button aria-label="Mở rộng walls">`, và
 * `expectVietnamese` đỏ ngay: `walls`, `openings`, `rooms` là khoá của hợp đồng
 * dữ liệu, không phải chuỗi giao diện, nhưng một `aria-label` thì luôn là chuỗi
 * giao diện. Dán khoá tiếng Anh vào đó là tạo ra thứ mà R-42 tồn tại để chặn.
 *
 * Cách đúng cũng là cách chuẩn của ARIA cho cây: **hàng** mang `aria-expanded`
 * và nhận phím, tam giác chỉ là hình. Mũi tên phải mở, mũi tên trái thu, Enter
 * và Space chọn — đúng khuôn mà người dùng bàn phím đã biết từ mọi cây khác
 * (A12: bàn phím là đường đi hạng nhất).
 */

import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { SpatialJsonNode, SpatialJsonTone } from './types';

/** Bậc thụt một cấp, theo đặc tả: 16px. */
const INDENT_PX = 16;

/**
 * Ba tông, ba lớp. Lý do không dùng `--accent` và `--data-dimension` nằm ở đầu
 * `./types.ts` — cả hai trượt ngưỡng tương phản cho chữ 13px.
 */
const TONE_CLASS: Readonly<Record<SpatialJsonTone, string>> = {
  key: 'text-text-primary',
  none: 'text-text-primary',
  number: 'text-text-secondary',
  string: 'text-accent-active',
};

export interface SpatialJsonTreeProps {
  readonly nodes: readonly SpatialJsonNode[];
  readonly selectedNodeId: string | null;
  readonly onToggle: (nodeId: string) => void;
  readonly onSelect: (nodeId: string) => void;
}

export function SpatialJsonTree({ nodes, onSelect, onToggle, selectedNodeId }: SpatialJsonTreeProps) {
  return (
    <div role="tree" aria-label="Cấu trúc dữ liệu không gian" className="py-2">
      {nodes.map((node) => {
        const isSelected = node.id === selectedNodeId;

        return (
          <div
            key={node.id}
            role="treeitem"
            aria-level={node.depth + 1}
            aria-selected={isSelected}
            {...(node.isExpandable ? { 'aria-expanded': node.isExpanded } : {})}
            className={cn(
              'flex h-6 cursor-pointer items-center gap-1 rounded-[6px] pr-3 text-[13px] leading-5',
              'transition-colors duration-fast',
              isSelected ? 'bg-bg-selected' : node.isMatch ? 'bg-bg-flash' : 'hover:bg-bg-hover',
            )}
            style={{ paddingLeft: `${node.depth * INDENT_PX + 8}px` }}
            onClick={() => {
              onSelect(node.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(node.id);
                return;
              }

              if (!node.isExpandable) {
                return;
              }

              if (event.key === 'ArrowRight' && !node.isExpanded) {
                event.preventDefault();
                onToggle(node.id);
                return;
              }

              if (event.key === 'ArrowLeft' && node.isExpanded) {
                event.preventDefault();
                onToggle(node.id);
              }
            }}
            tabIndex={0}
          >
            {node.isExpandable ? (
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-text-muted hover:bg-bg-hover"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(node.id);
                }}
              >
                {node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}

            {/* `<code>` chứ không `<span>`: khoá và giá trị JSON là ĐỊNH DANH, không
                phải câu chữ. Thẻ này vừa đúng ngữ nghĩa, vừa là thẻ mà
                `expectVietnamese` cố ý không soi vào — nếu không, mọi khoá tiếng
                Anh của hợp đồng dữ liệu sẽ bị báo là chuỗi giao diện sót lại. */}
            <code className={cn('truncate font-mono', TONE_CLASS.key)}>{node.label}</code>

            {node.valueText !== null ? (
              <>
                <span className="text-text-muted" aria-hidden="true">
                  :
                </span>
                <code className={cn('truncate font-mono', TONE_CLASS[node.tone])}>{node.valueText}</code>
              </>
            ) : null}

            {!node.isExpanded && node.childCount !== null && node.childCount > 0 ? (
              <code className="ml-1 shrink-0 font-mono text-[13px] leading-[18px] text-text-muted">
                [{node.childCount}]
              </code>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
