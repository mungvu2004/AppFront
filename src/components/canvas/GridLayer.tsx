import React, { memo } from 'react';
import type { GridConfig } from '../../hooks/useGridLayer';
import { useGridLayer } from '../../hooks/useGridLayer';
import { gridMinorToken, gridMajorToken } from './materialMap';

interface GridLayerProps {
  /** Chiều rộng canvas (px) */
  width: number;
  /** Chiều cao canvas (px) */
  height: number;
  /** Pan offset X (px) */
  offsetX?: number;
  /** Pan offset Y (px) */
  offsetY?: number;
  /** Zoom level hiện tại (1.0 = 100%) */
  zoom?: number;
  /** Tỉ lệ mm/px */
  scaleRatioMmPerPx?: number;
  /** Tuỳ chỉnh bước lưới */
  config?: Partial<GridConfig>;
  className?: string;
}

/**
 * GridLayer — lưới kỹ thuật 2D.
 * - Bước nhỏ 100 mm màu canvas-2d-grid
 * - Bước lớn 1000 mm đậm hơn 1 bậc (border-default)
 * - Ẩn lưới nhỏ khi zoom < 40%
 * - Không tính toán hình học inline; gọi useGridLayer
 */
export const GridLayer = memo(function GridLayer({
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  zoom = 1,
  scaleRatioMmPerPx = 12,
  config,
  className,
}: GridLayerProps) {
  const { showMinorGrid, minorStepPx, majorStepPx } = useGridLayer(
    zoom,
    scaleRatioMmPerPx,
    config
  );

  // Guard: nếu step quá nhỏ thì không vẽ (tránh vô hạn đường)
  if (minorStepPx < 1 || majorStepPx < 1) return null;

  // ID dùng cho SVG pattern — phải unique nếu có nhiều GridLayer
  const minorId = `grid-minor-${Math.round(minorStepPx * 100)}`;
  const majorId = `grid-major-${Math.round(majorStepPx * 100)}`;

  // Offset phải modulo step để lưới đồng bộ với pan
  const minorOffX = ((offsetX % minorStepPx) + minorStepPx) % minorStepPx;
  const minorOffY = ((offsetY % minorStepPx) + minorStepPx) % minorStepPx;
  const majorOffX = ((offsetX % majorStepPx) + majorStepPx) % majorStepPx;
  const majorOffY = ((offsetY % majorStepPx) + majorStepPx) % majorStepPx;

  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <defs>
        {/* Lưới nhỏ 100 mm */}
        {showMinorGrid && (
          <pattern
            id={minorId}
            x={minorOffX}
            y={minorOffY}
            width={minorStepPx}
            height={minorStepPx}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${minorStepPx} 0 L 0 0 0 ${minorStepPx}`}
              fill="none"
              stroke={gridMinorToken()}
              strokeWidth="0.5"
            />
          </pattern>
        )}

        {/* Lưới lớn 1000 mm */}
        <pattern
          id={majorId}
          x={majorOffX}
          y={majorOffY}
          width={majorStepPx}
          height={majorStepPx}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${majorStepPx} 0 L 0 0 0 ${majorStepPx}`}
            fill="none"
            stroke={gridMajorToken()}
            strokeWidth="1"
          />
        </pattern>
      </defs>

      {/* Lưới nhỏ (ẩn khi zoom < 40%) */}
      {showMinorGrid && (
        <rect width={width} height={height} fill={`url(#${minorId})`} />
      )}

      {/* Lưới lớn — luôn hiện */}
      <rect width={width} height={height} fill={`url(#${majorId})`} />
    </svg>
  );
});
