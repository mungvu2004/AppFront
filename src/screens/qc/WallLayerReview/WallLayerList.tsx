/**
 * Hàng đợi tường của panel trái — ảo hoá (`@tanstack/react-virtual`), chia nhóm theo đúng thứ tự
 * hook đã xếp (demo Z/S-15): Không chuẩn (kèm nút "Đổi n/N tường về chuẩn…") → Đúng chuẩn →
 * Đã duyệt (thu gọn, tự mở khi đang chọn một hàng trong đó hoặc không còn hàng nào khác).
 *
 * View THUẦN (R-60). `rows` đã xếp theo hàng đợi ở hook, nên danh sách, J/K, "Duyệt tiếp" và tự
 * chuyển sau "Duyệt" đi cùng một thứ tự. Hàng dùng `role="option"` + `focus-visible:` dạng class
 * (cảnh báo H1 của `docs/contracts/ui.md`).
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Inbox } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import type { WallLayerViewProps, WallRowViewModel } from './types';
import { LIST_ROW_HEIGHT_PX, WallLayerListRow } from './WallLayerListRow';
import type { WallQueueGroup, WallReviewQueue } from './wallReviewQueue';

export interface WallLayerListProps {
  readonly panel: WallLayerViewProps;
  /** Hàng vừa đổi — nháy nền một nhịp `duration-340` rồi tắt (TT-02). */
  readonly flashingWallId: WallRowViewModel['id'] | null;
  /** Ctrl/Cmd-bấm một hàng: thêm/bớt khỏi vùng chọn (NL-07). */
  readonly onToggleSelect: (wallId: WallRowViewModel['id']) => void;
  readonly queue?: WallReviewQueue | undefined;
  /** Mở xem trước đổi hàng loạt; vắng = không có nút (người xem, hoặc không đoạn nào đổi được). */
  readonly onOpenBulk?: (() => void) | undefined;
}

type ListItem =
  | { readonly kind: 'header'; readonly group: WallQueueGroup; readonly count: number }
  | { readonly kind: 'bulk' }
  | { readonly kind: 'row'; readonly row: WallRowViewModel };

const HEADER_HEIGHT_PX = 36;
const BULK_HEIGHT_PX = 44;
const LOADING_SKELETON_ROWS = 12;
const LIST_ARIA_LABEL = 'Danh sách đoạn tường';
const EMPTY_LIST_TITLE = 'Chưa có đoạn tường nào';
const NO_MATCH_MESSAGE =
  'Không có đoạn tường nào khớp bộ lọc đang bật. Bỏ bớt một bộ lọc để thấy lại danh sách.';
const GROUP_TITLE: Readonly<Record<WallQueueGroup, string>> = {
  nonStandard: 'Không chuẩn',
  standard: 'Đúng chuẩn',
  reviewed: 'Đã duyệt',
};

/** Nhóm của một hàng: theo hàng đợi ở hook; không có hàng đợi (story cũ) thì suy từ cờ của hàng. */
const groupOf = (row: WallRowViewModel, queue: WallReviewQueue | undefined): WallQueueGroup =>
  queue?.extras.get(row.id)?.group ??
  (row.isReviewed ? 'reviewed' : row.isNonStandardThickness ? 'nonStandard' : 'standard');

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

function buildItems(
  rows: readonly WallRowViewModel[],
  queue: WallReviewQueue | undefined,
  showReviewedRows: boolean,
  hasBulk: boolean,
): readonly ListItem[] {
  const groups: Record<WallQueueGroup, WallRowViewModel[]> = { nonStandard: [], standard: [], reviewed: [] };

  for (const row of rows) {
    groups[groupOf(row, queue)].push(row);
  }

  const items: ListItem[] = [];

  for (const group of ['nonStandard', 'standard', 'reviewed'] as const) {
    const members = groups[group];

    if (members.length === 0) {
      continue;
    }

    items.push({ kind: 'header', group, count: members.length });

    if (group === 'nonStandard' && hasBulk) {
      items.push({ kind: 'bulk' });
    }

    if (group !== 'reviewed' || showReviewedRows) {
      items.push(...members.map((row) => ({ kind: 'row' as const, row })));
    }
  }

  return items;
}

const keyOf = (item: ListItem | undefined): string =>
  item === undefined ? '' : item.kind === 'row' ? item.row.id : item.kind === 'header' ? `h-${item.group}` : 'bulk';

const heightOf = (item: ListItem | undefined): number =>
  item?.kind === 'header' ? HEADER_HEIGHT_PX : item?.kind === 'bulk' ? BULK_HEIGHT_PX : LIST_ROW_HEIGHT_PX;

export function WallLayerList({ panel, flashingWallId, onToggleSelect, queue, onOpenBulk }: WallLayerListProps) {
  const { rows, selectedWallId, hoveredWallId, onSelect, onHover, onOpenRowMenu, state, emptyNotice } = panel;
  const selectedWallIds = panel.selectedWallIds ?? (selectedWallId === null ? [] : [selectedWallId]);
  const [reviewedOpen, setReviewedOpen] = useState(false);
  const selectedIsReviewed = rows.some((row) => row.id === selectedWallId && row.isReviewed);
  const hasOthers = rows.some((row) => groupOf(row, queue) !== 'reviewed');
  const showReviewedRows = reviewedOpen || selectedIsReviewed || !hasOthers;
  const items = buildItems(rows, queue, showReviewedRows, onOpenBulk !== undefined && queue !== undefined);
  // Vai Người xem luôn ở `forbidden`; "đang tải" của họ đọc từ dữ liệu (bất biến 7), không từ vai (16-D-008).
  const isLoadingList =
    state === 'loading' ||
    (panel.isViewerRole && rows.length === 0 && panel.reviewCounter.total === 0 && emptyNotice === null && panel.errorMessage === null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollParentRef.current = findScrollParent(containerRef.current);
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    estimateSize: (index) => heightOf(items[index]),
    getItemKey: (index) => keyOf(items[index]),
    getScrollElement: () => scrollParentRef.current,
    overscan: 8,
  });

  const selectedIndex = items.findIndex((item) => item.kind === 'row' && item.row.id === selectedWallId);

  useEffect(() => {
    if (selectedIndex === -1) {
      return;
    }

    rowVirtualizer.scrollToIndex(selectedIndex, { align: 'auto', behavior: 'smooth' });

    /* Focus đang ở một hàng khác (J/K, bấm trên bản vẽ) thì đi theo hàng được chọn (G4a-16). */
    const container = containerRef.current;

    if (container === null || !container.contains(document.activeElement) || selectedWallId === null) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const target = container.querySelector<HTMLElement>(`[data-wall-id="${selectedWallId}"]`);

      if (target !== null && target !== document.activeElement) {
        target.focus({ preventScroll: true });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedIndex, selectedWallId, rowVirtualizer]);

  // Ref bọc ngoài LUÔN gắn vào một div ở cùng vị trí cây, nhánh nào cũng vậy (ảo hoá cần nó).
  if (isLoadingList) {
    return (
      <div aria-label={LIST_ARIA_LABEL} className="flex flex-col" ref={containerRef} role="status">
        {Array.from({ length: LOADING_SKELETON_ROWS }, (_, index) => (
          <Skeleton className="h-9" key={index} preset="table-row" />
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

  // `error`: panel cha đã hiện `InlineAlert` — không thêm câu "không khớp bộ lọc" gây hiểu lầm.
  if (rows.length === 0 && state === 'error') {
    return <div ref={containerRef} />;
  }

  if (rows.length === 0) {
    return (
      <div ref={containerRef}>
        <p className="px-2 py-8 text-center text-[13px] text-text-secondary">{NO_MATCH_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div aria-label={LIST_ARIA_LABEL} className="relative" ref={containerRef} role="listbox" style={{ height: rowVirtualizer.getTotalSize() }}>
      {rowVirtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];
        const style = { transform: `translateY(${virtualItem.start}px)` };

        if (item === undefined) {
          return null;
        }

        if (item.kind === 'header') {
          const isReviewed = item.group === 'reviewed';
          const isOpen = showReviewedRows;

          return (
            <div className="absolute inset-x-0 top-0 flex h-9 items-end px-2 pb-1" key={keyOf(item)} role="presentation" style={style}>
              {isReviewed ? (
                <button
                  aria-expanded={isOpen}
                  className="flex items-center gap-1 rounded-md text-caption font-medium uppercase tracking-[0.06em] text-text-secondary hover:text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() => setReviewedOpen(!isOpen)}
                  type="button"
                >
                  <ChevronDown aria-hidden="true" className={cn('h-3.5 w-3.5 transition-transform duration-180', !isOpen && '-rotate-90')} />
                  {`${GROUP_TITLE[item.group]} ${item.count}`}
                </button>
              ) : (
                <span className="text-caption font-medium uppercase tracking-[0.06em] text-text-secondary">
                  {`${GROUP_TITLE[item.group]} ${item.count}`}
                </span>
              )}
            </div>
          );
        }

        if (item.kind === 'bulk') {
          return (
            <div className="absolute inset-x-0 top-0 flex h-11 items-center px-1" key="bulk" role="presentation" style={style}>
              <Button fullWidth onClick={onOpenBulk} size="sm" variant="secondary">
                {`Đổi ${queue?.bulk.changeCount ?? 0}/${queue?.bulk.totalCount ?? 0} tường về chuẩn…`}
              </Button>
            </div>
          );
        }

        const { row } = item;

        return (
          <WallLayerListRow
            extra={queue?.extras.get(row.id)}
            isFlashing={row.id === flashingWallId}
            isHovered={row.id === hoveredWallId}
            isSelected={selectedWallIds.includes(row.id)}
            key={row.id}
            onHover={onHover}
            onOpenMenu={onOpenRowMenu}
            onSelect={onSelect}
            onToggleSelect={onToggleSelect}
            onUnapprove={panel.isViewerRole ? undefined : panel.onUnapprove}
            row={row}
            showConfidence={queue?.showConfidence ?? true}
            style={style}
          />
        );
      })}
    </div>
  );
}
