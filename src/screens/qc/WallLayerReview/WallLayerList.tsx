/**
 * Danh sách tường ảo hoá (dòng cao 40) của panel trái — `src/screens/qc/WallLayerReview`.
 *
 * View THUẦN (R-60): nhận nguyên `WallLayerViewProps` (đúng khuôn
 * `ScaleCalibrationPanel` nhận `model.panel`) và chỉ hiển thị. Ảo hoá thật bằng
 * `@tanstack/react-virtual` — đã là phụ thuộc có sẵn của repo (dùng lại ở
 * `Table.tsx#TableVirtual`), không cài thư viện mới.
 *
 * KHÔNG dùng `Table.Row`: `docs/contracts/ui.md` mục H1 cảnh báo nó có vòng
 * tiêu điểm điều khiển bằng state, làm hỏng `expectAccessible`. Dòng ở đây
 * dùng `role="option"` thuần cùng `focus-visible:` (class-based, không state)
 * — đúng cách khắc phục mục H1 chỉ ra.
 *
 * Hàng dưới ngưỡng tin cậy CHƯA duyệt (`statusCode === 'attention'` và
 * `isLowConfidence`) mang gạch chéo 45° 2px ở 6% — không bao giờ đổi màu đặc
 * (không đỏ, A5 + P-06). Chấm trạng thái dùng đúng ba token trạng thái của A4,
 * xanh "đã xác minh" chỉ khi `statusCode === 'verified'` (tức người đã duyệt).
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { Inbox } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';

import { wallStrokeToken } from '@/components/canvas/materialMap';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { cn } from '@/lib/utils';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
import type { WallThickness } from '@/types/spatial';

import type { WallLayerViewProps, WallRowViewModel } from './types';

export interface WallLayerListProps {
  readonly panel: WallLayerViewProps;
}

const ROW_HEIGHT_PX = 40;
const LOADING_SKELETON_ROWS = 12;
const LIST_ARIA_LABEL = 'Danh sách tường';
const EMPTY_LIST_TITLE = 'Chưa có đoạn tường nào';
const NO_MATCH_MESSAGE = 'Không có tường nào khớp bộ lọc hiện tại.';

const STATUS_DOT_TOKEN: Readonly<Record<ViewStatusCode, string>> = {
  verified: 'bg-state-verified',
  attention: 'bg-state-attention',
  violation: 'bg-state-violation',
  neutral: 'bg-text-muted',
};

const STATUS_DOT_LABEL: Readonly<Record<ViewStatusCode, string>> = {
  verified: 'đã duyệt',
  attention: 'cần chú ý',
  violation: 'vi phạm',
  neutral: 'bình thường',
};

/** Đi lên DOM tìm tổ tiên cuộn gần nhất — đúng kỹ thuật `Table.tsx#TableVirtual`. */
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node;

  while (current) {
    const overflow = getComputedStyle(current).overflowY;

    if (overflow === 'auto' || overflow === 'scroll') {
      return current;
    }

    current = current.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? null;
}

interface WallLayerListRowProps {
  readonly row: WallRowViewModel;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly onSelect: (wallId: WallRowViewModel['id']) => void;
  readonly onHover: (wallId: WallRowViewModel['id'] | null) => void;
  readonly style: CSSProperties;
}

function WallLayerListRow({ row, isSelected, isHovered, onSelect, onHover, style }: WallLayerListRowProps) {
  const showHatch = row.isLowConfidence && row.statusCode === 'attention';

  return (
    <div
      aria-label={`${row.codeLabel} — ${STATUS_DOT_LABEL[row.statusCode]}`}
      aria-selected={isSelected}
      className={cn(
        'absolute inset-x-0 top-0 flex h-10 cursor-pointer items-center gap-2 px-2 text-[13px] outline-none',
        'transition-colors duration-120 hover:bg-bg-hover',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        isSelected && 'bg-bg-selected hover:bg-bg-selected',
        isHovered && !isSelected && 'bg-bg-hover',
      )}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row.id);
        }
      }}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
      role="option"
      style={style}
      tabIndex={0}
    >
      {showHatch && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, var(--state-attention) 0, var(--state-attention) 2px, transparent 2px, transparent 8px)',
            opacity: 0.06,
          }}
        />
      )}

      <span className="relative w-16 shrink-0 truncate font-mono text-text-primary">{row.codeLabel}</span>

      <span className="relative flex shrink-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-sm border border-border-default/50"
          style={{ backgroundColor: wallStrokeToken(row.thicknessMm as WallThickness) }}
        />
        <span className="font-mono text-text-secondary">{row.thicknessLabel}</span>
      </span>

      <span className="relative shrink-0">
        <ConfidenceMeter noTooltip value={row.confidence} />
      </span>

      <span className="relative ml-auto flex shrink-0 items-center" title={STATUS_DOT_LABEL[row.statusCode]}>
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_TOKEN[row.statusCode])} />
      </span>
    </div>
  );
}

export function WallLayerList({ panel }: WallLayerListProps) {
  const { rows, selectedWallId, hoveredWallId, onSelect, onHover, state, emptyNotice } = panel;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollParentRef.current = findScrollParent(containerRef.current);
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT_PX,
    getScrollElement: () => scrollParentRef.current,
    overscan: 8,
  });

  useEffect(() => {
    if (selectedWallId === null) {
      return;
    }

    const index = rows.findIndex((row) => row.id === selectedWallId);

    if (index === -1) {
      return;
    }

    // 180ms ("fast"): trình duyệt tự điều khiển `behavior: 'smooth'`, API gốc
    // không nhận tham số mili-giây — không có số thời lượng nào để viết ra.
    rowVirtualizer.scrollToIndex(index, { align: 'auto', behavior: 'smooth' });
  }, [selectedWallId, rows, rowVirtualizer]);

  // Ref bọc ngoài LUÔN gắn vào một div ở cùng vị trí cây, bất kể nhánh nào bên
  // dưới đang vẽ — nếu chỉ gắn ở nhánh danh sách ảo hoá, màn mount lần đầu ở
  // `loading`, `empty` hay `error` thì `containerRef.current` không bao giờ
  // được gán và ảo hoá im lặng hỏng ngay khi `rows` có dữ liệu sau đó.
  if (state === 'loading') {
    return (
      <div aria-label={LIST_ARIA_LABEL} className="flex flex-col" ref={containerRef} role="status">
        {Array.from({ length: LOADING_SKELETON_ROWS }, (_, index) => (
          <Skeleton className="h-10" key={index} preset="table-row" />
        ))}
      </div>
    );
  }

  if (rows.length === 0 && emptyNotice !== null) {
    return (
      <div ref={containerRef}>
        <EmptyState description={emptyNotice} icon={<Inbox />} title={EMPTY_LIST_TITLE} />
      </div>
    );
  }

  // `error`: panel cha đã hiện `InlineAlert` giải thích lý do rows rỗng — danh
  // sách không vẽ thêm một thông báo "không khớp bộ lọc" gây hiểu lầm.
  if (rows.length === 0 && state === 'error') {
    return <div ref={containerRef} />;
  }

  if (rows.length === 0) {
    return (
      <div ref={containerRef}>
        <p className="px-2 py-8 text-center text-[13px] text-text-muted">{NO_MATCH_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div
      aria-label={LIST_ARIA_LABEL}
      className="relative"
      ref={containerRef}
      role="listbox"
      style={{ height: rowVirtualizer.getTotalSize() }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];

        if (row === undefined) {
          return null;
        }

        return (
          <WallLayerListRow
            isHovered={row.id === hoveredWallId}
            isSelected={row.id === selectedWallId}
            key={row.id}
            onHover={onHover}
            onSelect={onSelect}
            row={row}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          />
        );
      })}
    </div>
  );
}
