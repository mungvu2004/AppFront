/**
 * Một đa giác tường của canvas — bốn lớp chồng lên nhau.
 *
 * Tách khỏi `WallLayerCanvas.tsx` khi file đó vượt trần 400 dòng của R-22. Mục
 * D cho phép đúng việc này: phần con ra file anh em, `index.ts` giữ nguyên
 * đường nhập nên không nơi gọi nào phải sửa theo. Tiền lệ: `PipelineFailure/`
 * có 16 file, `ScaleCalibration/` tách `ScaleCalibrationCanvas.tsx` cùng cách.
 *
 * Vẫn là view thuần và vẫn KHÔNG một phép hình học nào: đa giác tới nơi đã tính
 * sẵn, việc của file này là nối mảng điểm thành chuỗi `points` và giao cho
 * `<polygon>`. Tâm chấm cần chú ý cũng vậy — nó từng được tính tại chỗ
 * (`boundsPx.x + boundsPx.width / 2`), nay tới sẵn trong `shape.attentionDotPx`
 * do `centreOfBounds` của hook dựng.
 */

import { memo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import { selectionBorderToken } from '@/components/canvas/materialMap';
import { cn } from '@/lib/utils';

import type { WallLayerCanvasShape, WallLayerCanvasViewProps } from './wallLayerHatch';
import {
  ATTENTION_DOT_RADIUS_PX,
  ATTENTION_TOKEN,
  NON_STANDARD_HATCH_PATTERN_ID,
  WALL_CENTRELINE_TOKEN,
  WALL_HATCH_LINE_WIDTH_PX,
  WALL_HATCH_OPACITY,
  WALL_HATCH_PATTERN_ID,
  WALL_HATCH_PATTERN_TRANSFORM,
  WALL_HATCH_TILE_PX,
  wallThicknessColorGroupOf,
  toSvgPoints,
} from './wallLayerHatch';

/**
 * Mã một tường, đọc lại từ chính hợp đồng props — cùng kiểu với `WallId` của
 * `@/domain/spatial/types`, nhưng nhờ vậy view này không có MỘT dòng nhập nào
 * trỏ vào tầng dữ liệu, kể cả dòng `import type` mà R-60 vốn cho phép.
 */
type WallId = NonNullable<WallLayerCanvasViewProps['selectedWallId']>;

export interface WallShapeFigureProps {
  readonly shape: WallLayerCanvasShape;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isInteractive: boolean;
  readonly showCentrelines: boolean;
  readonly onSelect: (wallId: WallId | null) => void;
  /** Ctrl/Cmd-bấm: thêm/bớt khỏi vùng chọn thay vì thay cả vùng (NL-07). */
  readonly onToggleSelect: (wallId: WallId) => void;
  readonly onHover: (wallId: WallId | null) => void;
  readonly onOpenMenu: (event: ReactMouseEvent<SVGGElement>, wallId: WallId) => void;
  /** Một px màn tính bằng px bản vẽ — chấm chú ý giữ cỡ px màn khi vừa khung ở hệ số nhỏ. */
  readonly unitPx: number;
}

/**
 * Mẫu gạch chéo dưới ngưỡng tin cậy. Ô và nét là px MÀN: `scale(unitPx)` bù hệ số phóng, không thì
 * tầng chưa hiệu chỉnh vừa khung ở ~0,05 có ô 0,6 px — tín hiệu không-màu biến mất (review-1 #3).
 */
export function WallHatchDefs({ unitPx }: { readonly unitPx: number }) {
  return (
    <defs>
      <pattern
        height={WALL_HATCH_TILE_PX}
        id={WALL_HATCH_PATTERN_ID}
        patternTransform={`${WALL_HATCH_PATTERN_TRANSFORM} scale(${unitPx})`}
        patternUnits="userSpaceOnUse"
        width={WALL_HATCH_TILE_PX}
      >
        <line
          opacity={WALL_HATCH_OPACITY}
          stroke={ATTENTION_TOKEN}
          strokeWidth={WALL_HATCH_LINE_WIDTH_PX}
          x1={0}
          x2={0}
          y1={0}
          y2={WALL_HATCH_TILE_PX}
        />
      </pattern>
      {/* Không chuẩn: gạch chéo mảnh THẤY ĐƯỢC (khác gạch 6% của tin cậy thấp) — mã hoá bằng hình. */}
      <pattern
        height={NON_STANDARD_HATCH_TILE_PX}
        id={NON_STANDARD_HATCH_PATTERN_ID}
        patternTransform={`${WALL_HATCH_PATTERN_TRANSFORM} scale(${unitPx})`}
        patternUnits="userSpaceOnUse"
        width={NON_STANDARD_HATCH_TILE_PX}
      >
        <line stroke={ATTENTION_TOKEN} strokeWidth={1} x1={0} x2={0} y1={0} y2={NON_STANDARD_HATCH_TILE_PX} />
      </pattern>
    </defs>
  );
}

const NON_STANDARD_HATCH_TILE_PX = 6;
const STROKE_110 = 'var(--wall-330-stroke)';
const PAPER = 'var(--bg-surface)';

/**
 * Ruột + viền theo MÃ HÌNH (demo Z/S-15 vòng 7, che chữ và đen trắng vẫn đọc được):
 * theo ba dải màu của `wallThicknessColorBand`: 100/150 rỗng (ruột giấy, viền mảnh) · 200/220 đặc ·
 * 300/400 đặc + viền đôi · không chuẩn gạch chéo + viền
 * đậm `--state-attention-stroke` (≥3:1 trên giấy) · đã duyệt nền xanh nhạt + viền xanh (A5: chỉ
 * việc của người duyệt). Cùng hình với `WallThicknessSwatch` của chú giải và danh sách.
 */
function WallBody({ points, thicknessMm, isReviewed }: { readonly points: string; readonly thicknessMm: number; readonly isReviewed: boolean }) {
  const band = wallThicknessColorGroupOf(thicknessMm);
  const colour = 'transition-colors duration-260 motion-reduce:transition-none';
  const line = { vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const };

  if (isReviewed) {
    return <polygon className={colour} fill="var(--state-verified-tint)" points={points} stroke="var(--state-verified)" strokeWidth={1.5} {...line} />;
  }

  if (band === null) {
    return (
      <>
        <polygon fill="var(--state-attention-tint)" points={points} />
        <polygon fill={`url(#${NON_STANDARD_HATCH_PATTERN_ID})`} points={points} />
        <polygon fill="none" points={points} stroke={ATTENTION_TOKEN} strokeWidth={2.5} {...line} />
      </>
    );
  }

  if (band === 110) {
    return <polygon className={colour} fill={PAPER} points={points} stroke={STROKE_110} strokeWidth={1.5} {...line} />;
  }

  if (band === 330) {
    return (
      <>
        <polygon fill="none" points={points} stroke="var(--wall-330-stroke)" strokeWidth={6} {...line} />
        <polygon fill="none" points={points} stroke={PAPER} strokeWidth={3} {...line} />
        <polygon className={colour} fill="var(--wall-330)" points={points} />
      </>
    );
  }

  return <polygon className={colour} fill="var(--wall-220)" points={points} />;
}

/**
 * Bốn lớp chồng lên nhau: đa giác tô theo màu độ dày (màu CHẠY 260 ms khi đổi
 * độ dày — đặc tả ghi 240, thang chuyển động chỉ có 120/180/260/340/700); gạch
 * chéo cộng chấm cần chú ý khi dưới ngưỡng tin cậy; tim tường khi cờ bật; viền
 * tô sáng chọn/trỏ ở nhịp 180 ms, tách khỏi lớp một để hai nhịp không phải chia
 * nhau một thuộc tính. Viền LUÔN nằm trong cây và chỉ đổi độ mờ, nên nó mờ dần
 * chứ không nhấp nháy vì bị gắn rồi tháo.
 *
 * P5 (PERF-03): `memo` — rê chuột làm màn render lại, hình tường nào props không đổi thì bỏ qua.
 */
export const WallShapeFigure = memo(function WallShapeFigure({
  shape,
  isSelected,
  isHovered,
  isInteractive,
  showCentrelines,
  onSelect,
  onToggleSelect,
  onHover,
  onOpenMenu,
  unitPx,
}: WallShapeFigureProps) {
  const points = toSvgPoints(shape.outline);
  /* Không chuẩn đã có viền đậm + gạch chéo (WallBody); chấm chỉ còn cho tin cậy thấp chưa duyệt. */
  const showDot = shape.isLowConfidence && !shape.isReviewed;

  /*
   * Ctrl (hoặc Cmd trên máy Mac) giữ vùng chọn cũ và thêm/bớt đúng tường vừa
   * bấm — đó là cách chọn được HAI đoạn, tức là cách nút "nối đoạn" thôi bị
   * khoá vĩnh viễn. Phép cộng/trừ vùng chọn nằm ở `selectionOps.toggleSelection`
   * của S-10; view chỉ đọc hai cờ phím của sự kiện chuột.
   */
  const handleClick = (event: ReactMouseEvent<SVGGElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      onToggleSelect(shape.id);

      return;
    }

    onSelect(shape.id);
  };

  return (
    <g
      aria-label={shape.codeLabel}
      className={isInteractive ? 'cursor-pointer' : 'pointer-events-none'}
      onClick={isInteractive ? handleClick : undefined}
      onContextMenu={isInteractive ? (event) => onOpenMenu(event, shape.id) : undefined}
      onMouseEnter={isInteractive ? () => onHover(shape.id) : undefined}
      onMouseLeave={isInteractive ? () => onHover(null) : undefined}
      role="presentation"
    >
      <WallBody isReviewed={shape.isReviewed} points={points} thicknessMm={shape.thicknessMm} />

      {shape.isLowConfidence ? <polygon fill={`url(#${WALL_HATCH_PATTERN_ID})`} points={points} /> : null}

      {showDot ? (
        <circle cx={shape.attentionDotPx.x} cy={shape.attentionDotPx.y} fill={ATTENTION_TOKEN} r={ATTENTION_DOT_RADIUS_PX * unitPx} />
      ) : null}

      {showCentrelines ? (
        <line
          stroke={WALL_CENTRELINE_TOKEN}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          x1={shape.centrelinePx.start.x}
          x2={shape.centrelinePx.end.x}
          y1={shape.centrelinePx.start.y}
          y2={shape.centrelinePx.end.y}
        />
      ) : null}

      <polygon
        className={cn(
          'transition-opacity duration-180 motion-reduce:transition-none',
          isSelected || isHovered ? 'opacity-100' : 'opacity-0',
        )}
        fill="none"
        points={points}
        stroke={selectionBorderToken()}
        strokeWidth={isSelected ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
});
