/**
 * Thẻ của mục đang chọn/rê (WRU-B): đường dẫn 1 px (màu nét kích thước) từ mục tới chip mono
 * "3.450 × 220 mm · Máy chắc chắn" có chấm màu tin cậy, nền mặt 92% như `MeasurementLabel`.
 * View thuần: vị trí và chữ tới sẵn, toạ độ là pixel KHUNG. Dùng ở màn Tường và "So sánh hai bên":
 * so sánh đưa thêm `leaderPx` (`placeCompareTag`): đường dẫn gấp khúc, cùng thẻ ở cả hai nửa.
 */

import { dimensionStrokeToken, wallConfidenceToken } from '@/components/canvas/materialMap';

interface PointPx {
  readonly x: number;
  readonly y: number;
}

export interface QcTagView {
  readonly anchorPx: PointPx;
  readonly tagPx: PointPx;
  readonly text: string;
  readonly tier: Parameters<typeof wallConfidenceToken>[0];
}

export function QcTag({ anchorPx, leaderPx, tagPx, text, tier }: QcTagView & { readonly leaderPx?: readonly PointPx[] }) {
  const points = [anchorPx, ...(leaderPx ?? [tagPx])].map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <>
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <polyline fill="none" points={points} stroke={dimensionStrokeToken()} strokeWidth={1} />
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
