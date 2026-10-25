/**
 * Chú giải ba màu dữ liệu cộng tổng số đối tượng của canvas SCR-17 — tách khỏi
 * `ObjectLayerCanvas.tsx` để file đó dưới trần 400 dòng (R-22).
 *
 * Tổng lấy từ chính mảng `placements` của canvas chứ không từ một con số truyền
 * riêng, nên "21 ở cả bốn nơi" không thể lệch: canvas đếm đúng cái nó vẽ.
 * `count === null` lúc đang tải: không in "0 đối tượng" khi dữ liệu chưa tới (BUG-618).
 */

import { Check } from 'lucide-react';

import {
  OBJECT_CANVAS_COLOR_COUNT_TEST_ID,
  OBJECT_CANVAS_TEXT,
  OBJECT_LAYER_COLOR_TOKENS,
  OBJECT_LAYER_STROKE_STYLES,
  visibleDataColorTokens,
} from './objectLayerSymbols';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS, type ObjectLayerVisibility } from './objectLayerTypes';

const LEGEND_ATTENTION = 'Cần xem';
const LEGEND_REVIEWED = 'Đã duyệt';

export function ObjectLayerCanvasLegend({
  count,
  layerVisibility,
}: {
  readonly count: number | null;
  readonly layerVisibility: ObjectLayerVisibility;
}) {
  const dataColors = visibleDataColorTokens(layerVisibility);

  return (
    <div
      aria-label={OBJECT_CANVAS_TEXT.legendLabel}
      className="absolute bottom-16 left-4 z-10 flex flex-col gap-1 whitespace-nowrap rounded-xl bg-bg-surface p-3 shadow-float"
    >
      {OBJECT_LAYER_IDS.filter((layer) => layerVisibility[layer]).map((layer) => (
        <span className="flex items-center gap-1.5 text-[12px] text-text-secondary" key={layer}>
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-xs border-2"
            style={{
              backgroundColor: OBJECT_LAYER_COLOR_TOKENS[layer],
              borderColor: OBJECT_LAYER_COLOR_TOKENS[layer],
              borderStyle: OBJECT_LAYER_STROKE_STYLES[layer].legendBorder,
              ...(layer === 'window' ? { backgroundColor: 'transparent' } : {}),
            }}
          />
          {OBJECT_LAYER_LABELS[layer]}
        </span>
      ))}
      {/* Z/S-16: hình nói loại, màu nói trạng thái — hai dòng trạng thái của nét (không chữ số: bài đếm đọc số đầu tiên sau đây). */}
      <span className="mt-1 flex items-center gap-1.5 border-t border-border-default pt-1.5 text-[12px] text-text-secondary">
        <span aria-hidden="true" className="h-3 w-3 rounded-xs border-2 border-state-attention" />
        {LEGEND_ATTENTION}
      </span>
      <span className="flex items-center gap-1.5 text-[12px] text-text-secondary">
        <Check aria-hidden="true" className="h-3 w-3 rounded-full bg-state-verified p-px text-bg-surface" strokeWidth={3} />
        {LEGEND_REVIEWED}
      </span>
      {count === null ? null : (
        <span className="text-[12px] tabular-nums text-text-primary">
          {count}
          <span className="text-text-secondary">{OBJECT_CANVAS_TEXT.objectCountSuffix}</span>
        </span>
      )}
      <span className="sr-only" data-testid={OBJECT_CANVAS_COLOR_COUNT_TEST_ID}>
        {dataColors.length}
      </span>
    </div>
  );
}
