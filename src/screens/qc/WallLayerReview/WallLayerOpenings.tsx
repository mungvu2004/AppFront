/**
 * Cửa đi / cửa sổ trên canvas bước Tường — CHỈ ĐỌC, để soát tường cùng ô mở. Nét mờ trung tính
 * (không tranh màu tin cậy của tường), không bấm được; hình học đã tính ở `openingSymbolsOf`.
 */

import type { OpeningSymbolPx } from '../shared/openingSymbols';

const OPENING_TOKEN = 'var(--text-secondary)';
const WASH_OPACITY = 0.08;
const STROKE_OPACITY = 0.7;

export function WallLayerOpenings({ openings }: { readonly openings: readonly OpeningSymbolPx[] }) {
  if (openings.length === 0) {
    return null;
  }

  return (
    <g aria-hidden="true" className="pointer-events-none" data-testid="wall-layer-openings">
      {openings.map((opening) => (
        <g data-opening-kind={opening.kind} key={opening.id} transform={opening.transform}>
          <path d={opening.symbol.footprint} fill={OPENING_TOKEN} fillOpacity={WASH_OPACITY} />
          {opening.symbol.strokes.map((stroke) => (
            <path
              d={stroke.d}
              fill="none"
              key={stroke.id}
              stroke={OPENING_TOKEN}
              strokeDasharray={stroke.dashArray ?? undefined}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ))}
    </g>
  );
}
