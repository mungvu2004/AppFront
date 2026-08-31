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

import type { MouseEvent as ReactMouseEvent } from 'react';

import { selectionBorderToken } from '@/components/canvas/materialMap';
import { cn } from '@/lib/utils';

import type { WallLayerCanvasShape, WallLayerCanvasViewProps } from './wallLayerHatch';
import {
  ATTENTION_DOT_RADIUS_PX,
  ATTENTION_TOKEN,
  WALL_CENTRELINE_TOKEN,
  WALL_HATCH_PATTERN_ID,
  toSvgPoints,
  wallThicknessFillToken,
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
}

/**
 * Bốn lớp chồng lên nhau: đa giác tô theo màu độ dày (màu CHẠY 260 ms khi đổi
 * độ dày — đặc tả ghi 240, thang chuyển động chỉ có 120/180/260/340/700); gạch
 * chéo cộng chấm cần chú ý khi dưới ngưỡng tin cậy; tim tường khi cờ bật; viền
 * tô sáng chọn/trỏ ở nhịp 180 ms, tách khỏi lớp một để hai nhịp không phải chia
 * nhau một thuộc tính. Viền LUÔN nằm trong cây và chỉ đổi độ mờ, nên nó mờ dần
 * chứ không nhấp nháy vì bị gắn rồi tháo.
 */
export function WallShapeFigure({
  shape,
  isSelected,
  isHovered,
  isInteractive,
  showCentrelines,
  onSelect,
  onToggleSelect,
  onHover,
  onOpenMenu,
}: WallShapeFigureProps) {
  const points = toSvgPoints(shape.outline);

  /*
   * Ctrl (hoặc Cmd trên máy Mac) giữ vùng chọn cũ và thêm/bớt đúng tường vừa
   * bấm — đó là cách chọn được HAI đoạn, tức là cách nút "nối đoạn" thôi bị
   * khoá vĩnh viễn. Phép cộng/trừ vùng chọn nằm ở `selectionOps.toggleSelection`
   * của S-10; view chỉ đọc hai cờ phím của sự kiện chuột.
   */
  const handleClick = (event: ReactMouseEvent<SVGGElement>) => {
    if (event.ctrlKey || event.metaKey) {
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
      <polygon
        className="transition-colors duration-260 motion-reduce:transition-none"
        fill={wallThicknessFillToken(shape.thicknessMm)}
        points={points}
      />

      {shape.isLowConfidence ? (
        <>
          <polygon fill={`url(#${WALL_HATCH_PATTERN_ID})`} points={points} />
          <circle
            cx={shape.attentionDotPx.x}
            cy={shape.attentionDotPx.y}
            fill={ATTENTION_TOKEN}
            r={ATTENTION_DOT_RADIUS_PX}
          />
        </>
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
}

