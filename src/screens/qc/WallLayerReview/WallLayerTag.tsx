/**
 * Nhãn của tường đang chọn/rê (WRU-B): đường dẫn 1 px (màu nét kích thước) từ tim tường tới chip
 * mono "3.450 × 220 mm · Máy chắc chắn" có chấm màu tin cậy, nền mặt 92% như `MeasurementLabel`.
 * View thuần: vị trí và chữ tới sẵn từ `wallTag.ts` qua hook, toạ độ là pixel KHUNG.
 */

import { dimensionStrokeToken, wallConfidenceToken } from '@/components/canvas/materialMap';

import type { WallTagView } from './wallLayerHatch';

export function WallLayerTag({ anchorPx, tagPx, text, tier }: WallTagView) {
  return (
    <>
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <line stroke={dimensionStrokeToken()} strokeWidth={1} x1={anchorPx.x} x2={tagPx.x} y1={anchorPx.y} y2={tagPx.y} />
        <circle cx={anchorPx.x} cy={anchorPx.y} fill={dimensionStrokeToken()} r={2} />
      </svg>
      <div
        className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-bg-surface-92 px-2 py-1 font-mono text-[12px] leading-none text-text-primary shadow-float"
        data-testid="wall-layer-tag"
        style={{ left: tagPx.x, top: tagPx.y }}
      >
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: wallConfidenceToken(tier) }} />
        {text}
      </div>
    </>
  );
}
