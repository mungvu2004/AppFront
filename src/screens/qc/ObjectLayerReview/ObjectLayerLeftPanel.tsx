/**
 * Bộ lọc của panel trái màn "Duyệt cửa và nội thất" (demo Z/S-16): ba nút bật/tắt theo
 * loại (Cửa đi · Cửa sổ · Nội thất, mỗi nút một số đếm) và menu "Loại con" gom tám chip
 * loại con (chín chip làm panel quá dài).
 *
 * View THUẦN (R-60): mọi thứ vào bằng {@link ObjectLayerLeftPanelViewProps}, ra bằng hai
 * callback. Ba số đếm đọc từ `counts` — hàm DUY NHẤT cộng ba lớp con là
 * `createObjectLayerCounts`, nên tổng ở dòng trạng thái luôn bằng tổng ba nút.
 *
 * Chip đếm CHỈ là bộ lọc (K07): bấm "Cửa đi 6" là chỉ hiện cửa đi, bấm lại là hiện cả ba.
 * `aria-pressed` bật khi chip đang lọc. Ẩn/hiện lớp trên bản vẽ không ở đây.
 * Menu "Loại con" chỉ liệt kê loại có mặt trên tầng (hoặc đang bật).
 */

import { lowerFirst } from '@/lib/format/sentence';
import { AppWindow, ChevronDown, DoorOpen, Sofa, type LucideIcon } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { cn } from '@/lib/utils';

import type { ObjectLayerLeftPanelViewProps } from './objectLayerSymbols';
import type { ObjectLayerCounts, ObjectLayerId, ObjectSubtype } from './objectLayerTypes';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS, OBJECT_SUBTYPES, OBJECT_SUBTYPE_LABELS } from './objectLayerTypes';

const FILTER_ROW_LABEL = 'Lọc theo loại';
const SUBTYPE_MENU_LABEL = 'Loại con';
const SUBTYPE_GROUP_LABEL = 'Lọc theo loại con';
const FILTER_LAYER_PREFIX = 'Chỉ hiện ';

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

const CHIP_CLASS = cn(
  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[13px]',
  'transition-colors duration-120',
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

export function ObjectLayerLeftPanel({
  availableSubtypes,
  counts,
  furnitureAttentionNotice,
  listLayerFilter,
  onFilterLayer,
  onToggleSubtypeFilter,
  subtypeFilters,
}: ObjectLayerLeftPanelViewProps) {
  const subtypes = OBJECT_SUBTYPES.filter((subtype) => subtypeFilters.has(subtype) || availableSubtypes.has(subtype));

  return (
    <div className="flex flex-col gap-3 border-b border-border-default px-4 py-3">
      <div aria-label={FILTER_ROW_LABEL} className="flex flex-wrap gap-2" role="group">
        {OBJECT_LAYER_IDS.map((layer) => {
          const Icon = LAYER_ICONS[layer];
          const label = OBJECT_LAYER_LABELS[layer];
          const isFiltering = listLayerFilter === layer;

          return (
            <button
              aria-label={`${FILTER_LAYER_PREFIX}${lowerFirst(label)}`}
              aria-pressed={isFiltering}
              className={cn(
                CHIP_CLASS,
                isFiltering
                  ? 'border-accent bg-accent-wash text-text-primary'
                  : 'border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
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

      {/* Nhánh nội thất lỗi trong khi cửa vẫn xong (trạng thái 3b): một hàng cần chú ý, không chặn cả màn. */}
      {furnitureAttentionNotice === null ? null : <InlineAlert level="attention" message={furnitureAttentionNotice} />}

      <details className="group">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-sm text-[13px] text-text-secondary outline-hidden hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          {SUBTYPE_MENU_LABEL}
          {subtypeFilters.size === 0 ? null : <span className="tabular-nums text-accent">{subtypeFilters.size}</span>}
          <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform duration-120 group-open:rotate-180" />
        </summary>
        {/* Chip đang bật mang `aria-pressed`: trạng thái lọc không chỉ nằm ở màu. */}
        <div aria-label={SUBTYPE_GROUP_LABEL} className="mt-2 flex flex-wrap gap-1.5" role="group">
          {/* Chỉ loại có mặt trên tầng (K07): chip xám "không có đối tượng" chỉ làm dài menu. */}
          {subtypes.map((subtype: ObjectSubtype) => {
            const isOn = subtypeFilters.has(subtype);

            return (
              <button
                aria-pressed={isOn}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[12px]',
                  'transition-colors duration-120',
                  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  isOn
                    ? 'border-accent bg-accent-wash text-accent'
                    : 'border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
                key={subtype}
                onClick={() => onToggleSubtypeFilter(subtype)}
                type="button"
              >
                {OBJECT_SUBTYPE_LABELS[subtype]}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
