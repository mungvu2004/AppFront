/**
 * Thanh đầu cột việc của màn "Duyệt cửa và nội thất", một hàng như bước Tường: nút "Lọc" (gấp sẵn), số dòng
 * đang hiện khi có lọc, nút kính lúp mở ô tìm mã và nút "⚠ n" lỗi quy chuẩn. Mở "Lọc" là thấy: công tắc "Chỉ hiện chỗ máy chưa chắc", ba nút loại (Cửa đi ·
 * Cửa sổ · Nội thất, mỗi nút một số đếm) và các chip "Loại con". Số bộ lọc đang áp hiện cạnh chữ "Lọc".
 *
 * View THUẦN (R-60): mọi thứ vào bằng {@link ObjectLayerLeftPanelViewProps}, ra bằng callback. Ba số đếm
 * đọc từ `counts` — hàm DUY NHẤT cộng ba lớp con là `createObjectLayerCounts`, nên tổng ở dòng trạng thái
 * luôn bằng tổng ba nút.
 *
 * Chip đếm CHỈ là bộ lọc (K07): bấm "Cửa đi 6" là chỉ hiện cửa đi, bấm lại là hiện cả ba.
 * `aria-pressed` bật khi chip đang lọc. Ẩn/hiện lớp trên bản vẽ không ở đây.
 * Chip loại con chỉ liệt kê loại có mặt trên tầng (hoặc đang bật).
 */

import { lowerFirst } from '@/lib/format/sentence';
import { AppWindow, ChevronDown, DoorOpen, ListFilter, Search, Sofa, X, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

import { QcRuleIssueFocus, QcRuleIssuesBadge } from '../shared/QcRuleIssues';

import type { ObjectLayerLeftPanelViewProps } from './objectLayerSymbols';
import type { ObjectLayerCounts, ObjectLayerId, ObjectSubtype } from './objectLayerTypes';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS, OBJECT_SUBTYPES, OBJECT_SUBTYPE_LABELS } from './objectLayerTypes';

const FILTER_BUTTON = 'Lọc';
const FILTER_ROW_LABEL = 'Lọc theo loại';
const SUBTYPE_MENU_LABEL = 'Loại con';
const SUBTYPE_GROUP_LABEL = 'Lọc theo loại con';
const FILTER_LAYER_PREFIX = 'Chỉ hiện ';
const LOW_CONFIDENCE_FILTER = 'Chỉ hiện chỗ máy chưa chắc';
const SEARCH_LABEL = 'Tìm mã';
const SEARCH_PLACEHOLDER = 'Tìm mã, ví dụ D-007';
const CLEAR_SEARCH = 'Xoá ô tìm';

/** Số đếm của một lớp con, đọc từ `counts` — không cộng lại ở view. */
const LAYER_COUNT_READERS: Readonly<Record<ObjectLayerId, (counts: ObjectLayerCounts) => number>> = {
  door: (counts) => counts.doorCount,
  window: (counts) => counts.windowCount,
  furniture: (counts) => counts.furnitureCount,
};

/** Icon nét (không tô đầy, CẤM TUYỆT ĐỐI của đặc tả): hình nói loại, màu để dành cho trạng thái. */
const LAYER_ICONS: Readonly<Record<ObjectLayerId, LucideIcon>> = {
  door: DoorOpen,
  window: AppWindow,
  furniture: Sofa,
};

const FOCUS_RING = 'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const CHIP_CLASS = cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[13px] transition-colors duration-120', FOCUS_RING);
const PILL_CLASS = cn('rounded-full border px-2.5 py-1 text-[12px] transition-colors duration-120', FOCUS_RING);
const ON_CLASS = 'border-accent bg-accent-wash text-accent';
const OFF_CLASS = 'border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary';

/** Lỗi quy chuẩn không chặn duyệt đồ: nói rõ là xem sau cũng được. */
const ruleWarningTitleOf = (count: number): string => `Cảnh báo quy chuẩn (${count}) — xem sau cũng được`;

export interface ObjectLayerLeftPanelExtras {
  /** Ô tìm mã: chữ đang gõ — danh sách lọc theo nó; vắng `onCodeQueryChange` = không có nút tìm. */
  readonly codeQuery?: string | undefined;
  readonly onCodeQueryChange?: ((query: string) => void) | undefined;
  /** "29 / 31 đối tượng" khi có lọc; `null` = đang hiện đủ. */
  readonly filteredLabel?: string | null | undefined;
}

/** Thấy "29 / 31"; chữ đơn vị vẫn ở lại cho trình đọc màn hình và khi rê chuột. */
const FILTERED_NUMBERS = /^[\d.,\s/]+/u;

export function ObjectLayerLeftPanel({
  availableSubtypes,
  codeQuery = '',
  counts,
  filteredLabel = null,
  furnitureAttentionNotice,
  isLowConfidenceOnly,
  listLayerFilter,
  onCodeQueryChange,
  onFilterLayer,
  onToggleLowConfidenceOnly,
  onToggleSubtypeFilter,
  ruleIssues,
  subtypeFilters,
}: ObjectLayerLeftPanelViewProps & ObjectLayerLeftPanelExtras) {
  const subtypes = OBJECT_SUBTYPES.filter((subtype) => subtypeFilters.has(subtype) || availableSubtypes.has(subtype));
  const activeCount = (listLayerFilter === null ? 0 : 1) + subtypeFilters.size + (isLowConfidenceOnly ? 1 : 0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const showSearch = isSearchOpen || codeQuery !== '';
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const closeSearch = () => {
    onCodeQueryChange?.('');
    setIsSearchOpen(false);
    searchButtonRef.current?.focus();
  };
  const filteredHead = filteredLabel?.match(FILTERED_NUMBERS)?.[0]?.trimEnd() ?? filteredLabel ?? '';

  return (
    <div className="relative flex flex-col border-b border-border-default">
      {/* Nhóm nút bên phải đứng đè lên hàng của `summary`, để phần mở ra của "Lọc" được cả bề ngang cột. */}
      <div className="absolute right-2 top-1 z-10 flex h-8 items-center gap-1">
        {filteredLabel === null ? null : (
          <p aria-live="polite" className="whitespace-nowrap text-[12px] tabular-nums text-text-secondary" title={filteredLabel}>
            {filteredHead}
            <span className="sr-only">{filteredLabel.slice(filteredHead.length)}</span>
          </p>
        )}
        {onCodeQueryChange === undefined ? null : (
          <IconButton
            aria-expanded={showSearch}
            aria-label={SEARCH_LABEL}
            icon={<Search aria-hidden="true" className="h-4 w-4" />}
            onClick={() => (showSearch ? closeSearch() : setIsSearchOpen(true))}
            ref={searchButtonRef}
            size="sm"
          />
        )}
        {ruleIssues === undefined ? null : <QcRuleIssuesBadge {...ruleIssues} titleOf={ruleWarningTitleOf} />}
      </div>

      <div className="px-2 py-1">
        {/* `details` gấp sẵn: một nút trên màn, mở ra ngay dưới thanh (không phủ lên danh sách). */}
        <details className="group">
          <summary
            className={cn(
              'inline-flex h-8 cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-body-sm font-medium text-text-primary',
              'transition-colors duration-120 hover:bg-bg-hover [&::-webkit-details-marker]:hidden',
              FOCUS_RING,
              activeCount > 0 && 'bg-accent-wash text-accent',
            )}
          >
            <ListFilter aria-hidden="true" className="h-4 w-4" />
            {FILTER_BUTTON}
            {activeCount > 0 ? (
              <>
                <span aria-hidden="true" className="rounded-full bg-accent px-1.5 text-caption tabular-nums text-white">
                  {activeCount}
                </span>
                <span className="sr-only">{`: ${activeCount} đang bật`}</span>
              </>
            ) : null}
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-text-muted transition-transform duration-120 group-open:rotate-180" />
          </summary>

          <div className="flex flex-col gap-3 px-1.5 pb-2 pt-2">
            {/* Còn bật thì ô còn, để tắt được (BUG-584). */}
            {onToggleLowConfidenceOnly === null ? null : (
              <button
                aria-pressed={isLowConfidenceOnly}
                className={cn('self-start', PILL_CLASS, isLowConfidenceOnly ? ON_CLASS : OFF_CLASS)}
                onClick={onToggleLowConfidenceOnly}
                type="button"
              >
                {LOW_CONFIDENCE_FILTER}
              </button>
            )}

            <div aria-label={FILTER_ROW_LABEL} className="flex flex-wrap gap-2" role="group">
              {OBJECT_LAYER_IDS.map((layer) => {
                const Icon = LAYER_ICONS[layer];
                const label = OBJECT_LAYER_LABELS[layer];
                const isFiltering = listLayerFilter === layer;

                return (
                  <button
                    aria-label={`${FILTER_LAYER_PREFIX}${lowerFirst(label)}`}
                    aria-pressed={isFiltering}
                    className={cn(CHIP_CLASS, isFiltering ? 'border-accent bg-accent-wash text-text-primary' : OFF_CLASS)}
                    key={layer}
                    onClick={() => onFilterLayer(layer)}
                    type="button"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                    <span className="tabular-nums text-text-secondary">{LAYER_COUNT_READERS[layer](counts)}</span>
                  </button>
                );
              })}
            </div>

            {/* Chỉ loại có mặt trên tầng (K07); chip đang bật mang `aria-pressed`, không chỉ đổi màu. */}
            {subtypes.length === 0 ? null : (
              <div className="flex flex-col gap-1.5">
                <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{SUBTYPE_MENU_LABEL}</p>
                <div aria-label={SUBTYPE_GROUP_LABEL} className="flex flex-wrap gap-1.5" role="group">
                  {subtypes.map((subtype: ObjectSubtype) => {
                    const isOn = subtypeFilters.has(subtype);

                    return (
                      <button
                        aria-pressed={isOn}
                        className={cn(PILL_CLASS, isOn ? ON_CLASS : OFF_CLASS)}
                        key={subtype}
                        onClick={() => onToggleSubtypeFilter(subtype)}
                        type="button"
                      >
                        {OBJECT_SUBTYPE_LABELS[subtype]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>

      {onCodeQueryChange !== undefined && showSearch ? (
        <div className="flex items-center gap-1 px-2 pb-1.5">
          <Input
            aria-label={SEARCH_LABEL}
            autoFocus
            className="min-w-0 flex-1 text-[13px]"
            onChange={(event) => onCodeQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeSearch();
              }
            }}
            placeholder={SEARCH_PLACEHOLDER}
            type="search"
            value={codeQuery}
          />
          <IconButton aria-label={CLEAR_SEARCH} icon={<X aria-hidden="true" className="h-4 w-4" />} onClick={closeSearch} size="sm" />
        </div>
      ) : null}

      {/* P03: mở từ nút "Sửa" của Quy chuẩn thì lỗi đó nói ngay trên danh sách — lỗi gì, sửa thế nào. */}
      {ruleIssues !== undefined && (ruleIssues.focused !== null || ruleIssues.focusResolved) ? (
        <div className="px-3 pb-2">
          <QcRuleIssueFocus {...ruleIssues} />
        </div>
      ) : null}

      {/* Nhánh nội thất lỗi trong khi cửa vẫn xong (trạng thái 3b): một hàng cần chú ý, không chặn cả màn. */}
      {furnitureAttentionNotice === null ? null : (
        <div className="px-3 pb-2">
          <InlineAlert level="attention" message={furnitureAttentionNotice} />
        </div>
      )}
    </div>
  );
}
