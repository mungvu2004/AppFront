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

import { selectionBorderToken, wallConfidenceToken, type WallConfidenceTier } from '@/components/canvas/materialMap';
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
      {/* Không chuẩn: sọc giấy mảnh trên nền màu tin cậy (khác gạch vàng của tin cậy thấp) — mã hoá bằng hình. */}
      <pattern
        height={NON_STANDARD_HATCH_TILE_PX}
        id={NON_STANDARD_HATCH_PATTERN_ID}
        patternTransform={`${WALL_HATCH_PATTERN_TRANSFORM} scale(${unitPx})`}
        patternUnits="userSpaceOnUse"
        width={NON_STANDARD_HATCH_TILE_PX}
      >
        <line stroke={NON_STANDARD_STRIPE_TOKEN} strokeWidth={1.5} x1={0} x2={0} y1={0} y2={NON_STANDARD_HATCH_TILE_PX} />
      </pattern>
    </defs>
  );
}

const NON_STANDARD_HATCH_TILE_PX = 6;
/** Viền + sọc giấy của tường không chuẩn — đọc được trên cả ba màu tin cậy (sọc vàng thì chìm trong nền vàng). */
const NON_STANDARD_OUTLINE_TOKEN = 'var(--text-primary)';
const NON_STANDARD_STRIPE_TOKEN = 'var(--bg-surface)';

/**
 * Ruột tô theo BẬC TIN CẬY (WRU-B): chắc chắn xám đậm · khá chắc vàng · chưa chắc gỉ sắt · đã duyệt
 * nền xanh nhạt + viền xanh (A5: chỉ việc của người duyệt). Độ dày đọc từ bề rộng thật của đa giác;
 * độ dày không chuẩn thêm sọc giấy + viền đậm làm tín hiệu phụ. Cùng màu với `WallThicknessSwatch`.
 */
function WallBody({ points, thicknessMm, tier }: { readonly points: string; readonly thicknessMm: number; readonly tier: WallConfidenceTier }) {
  const colour = 'transition-colors duration-260 motion-reduce:transition-none';
  const line = { vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const };

  if (tier === 'reviewed') {
    return <polygon className={colour} fill="var(--state-verified-tint)" points={points} stroke="var(--state-verified)" strokeWidth={1.5} {...line} />;
  }

  const body = <polygon className={colour} fill={wallConfidenceToken(tier)} points={points} />;

  if (wallThicknessColorGroupOf(thicknessMm) !== null) {
    return body;
  }

  return (
    <>
      {body}
      <polygon fill={`url(#${NON_STANDARD_HATCH_PATTERN_ID})`} points={points} />
      <polygon fill="none" points={points} stroke={NON_STANDARD_OUTLINE_TOKEN} strokeWidth={2} {...line} />
    </>
  );
}

/**
 * Bốn lớp chồng lên nhau: đa giác tô theo màu tin cậy (màu CHẠY 260 ms khi đổi
 * bậc — đặc tả ghi 240, thang chuyển động chỉ có 120/180/260/340/700); gạch
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
      <WallBody points={points} thicknessMm={shape.thicknessMm} tier={shape.confidenceTier} />

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
