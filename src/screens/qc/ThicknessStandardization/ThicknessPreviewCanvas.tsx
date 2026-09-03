/**
 * Canvas xem trước của màn QC "Chuẩn hoá độ dày tường" — cột phải rộng
 * {@link THICKNESS_PREVIEW_CANVAS_WIDTH_PX}, mặt bằng thu nhỏ giữ ngữ cảnh
 * không gian cho biểu đồ và hai bảng bên trái.
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng
 * {@link ThicknessPreviewCanvasProps}, không `src/api`, không `src/store`,
 * không `src/domain`, không `src/lib/http`. Phần tính — hộp bao, tỉ lệ, khoảng
 * lệch căn giữa, hộp bao pixel của từng tường — nằm ở module anh em thuần
 * `thicknessPreviewGeometry.ts`; file này chỉ gọi rồi vẽ.
 *
 * ## Đây là XEM TRƯỚC PHỤ, không phải chỗ thao tác chính
 *
 * Đặc tả nói rõ như vậy, và nó quyết định hai điều dễ làm sai:
 *
 * - Canvas KHÔNG chọn, KHÔNG sửa, KHÔNG áp gì. Đường ra duy nhất của nó là
 *   `onHoverWall` — chỉ báo "con trỏ đang ở tường nào", còn việc tô sáng hàng
 *   nào trong hai bảng là do màn cha điều phối.
 * - Đa giác không phải nút bấm. Đường đi hạng nhất của bàn phím (A12) ở màn này
 *   là hai bảng và ba ngưỡng của biểu đồ — cả ba đều đặt cùng một
 *   `hoveredWallId`/`hoveredGroup` mà canvas đọc. Gắn 48 đa giác vào vòng Tab
 *   sẽ thêm 48 chặng dừng cho một mặt bằng chỉ để nhìn, và làm loãng đúng
 *   đường đi mà A12 muốn giữ ngắn.
 *
 * ## Tô sáng và viền
 *
 * Tường "khớp" là tường đang được trỏ tới, hoặc thuộc nhóm đang được trỏ tới
 * (nhóm đó chính là thứ một cột biểu đồ ánh xạ sang). Khớp thì nền đậm lên và
 * nhận một `SelectionHalo`; không khớp thì mờ đi. `SelectionHalo` là `<div>`
 * tuyệt đối tính bằng pixel còn đa giác vẽ bằng SVG — hai lớp chỉ chồng khít
 * nhau nhờ dùng CHUNG một phép chiếu, xem đầu `thicknessPreviewGeometry.ts`.
 *
 * ## Trạng thái `collapsed`
 *
 * Cấm tuyệt đối: ẩn canvas xem trước, KHÔNG xoá dữ liệu. Component trả `null`
 * — màn còn lại biểu đồ và hai bảng, và mọi thứ quay lại nguyên vẹn khi mở ra,
 * vì props không hề bị đụng tới.
 */

import { useCallback, useMemo } from 'react';

import { wallStrokeToken } from '@/components/canvas/materialMap';
import { SelectionHalo } from '@/components/canvas/SelectionHalo';

import {
  computePreviewProjection,
  projectOutline,
  projectedBoundsOf,
  svgPointsAttr,
  THICKNESS_PREVIEW_CANVAS_HEIGHT_PX,
  WALL_FILL_OPACITY,
  WALL_FILL_OPACITY_DIMMED,
  WALL_FILL_OPACITY_MATCHED,
  WALL_OUTLINE_STROKE_WIDTH_PX,
} from './thicknessPreviewGeometry';
import {
  THICKNESS_PREVIEW_CANVAS_WIDTH_PX,
  type ThicknessPreviewCanvasProps,
} from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp `docs/notes/thickness/t6.i18n.fragment.json`.  */
/* -------------------------------------------------------------------------- */

const CANVAS_LABEL = 'mặt bằng xem trước theo nhóm độ dày';
const LEGEND_LABEL = 'chú giải độ dày tường';
const EMPTY_NOTICE = 'chưa có hình tường để xem trước';

/** Cạnh ô màu của một mục chú giải, px — cùng cỡ với ô của `WallThicknessLegend`. */
const LEGEND_SWATCH_PX = 16;

/* -------------------------------------------------------------------------- */
/* Canvas.                                                                     */
/* -------------------------------------------------------------------------- */

export function ThicknessPreviewCanvas({
  shapes,
  legend,
  hoveredGroup,
  hoveredWallId,
  onHoverWall,
  isCollapsed,
}: ThicknessPreviewCanvasProps) {
  const projection = useMemo(() => computePreviewProjection(shapes), [shapes]);

  /** Mỗi tường một lần chiếu, dùng cho cả đa giác SVG lẫn hộp bao của `SelectionHalo`. */
  const figures = useMemo(
    () =>
      shapes.map((shape) => ({
        wallId: shape.wallId,
        group: shape.group,
        colorToken: wallStrokeToken(shape.group),
        points: svgPointsAttr(projectOutline(shape.outline, projection)),
        boundsPx: projectedBoundsOf(shape, projection),
      })),
    [projection, shapes],
  );

  const handleLeave = useCallback(() => {
    onHoverWall(null);
  }, [onHoverWall]);

  if (isCollapsed) {
    return null;
  }

  const hasHover = hoveredGroup !== null || hoveredWallId !== null;

  return (
    <aside
      aria-label={CANVAS_LABEL}
      className="shrink-0"
      style={{ width: THICKNESS_PREVIEW_CANVAS_WIDTH_PX }}
    >
      <div
        className="relative overflow-hidden rounded-[12px] border border-border-default bg-canvas-2d"
        style={{
          width: THICKNESS_PREVIEW_CANVAS_WIDTH_PX,
          height: THICKNESS_PREVIEW_CANVAS_HEIGHT_PX,
        }}
        onMouseLeave={handleLeave}
      >
        {figures.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-text-muted">
            {EMPTY_NOTICE}
          </p>
        ) : (
          <>
            <svg
              aria-hidden="true"
              className="absolute inset-0"
              height={THICKNESS_PREVIEW_CANVAS_HEIGHT_PX}
              role="presentation"
              viewBox={`0 0 ${String(THICKNESS_PREVIEW_CANVAS_WIDTH_PX)} ${String(THICKNESS_PREVIEW_CANVAS_HEIGHT_PX)}`}
              width={THICKNESS_PREVIEW_CANVAS_WIDTH_PX}
            >
              {figures.map((figure) => {
                const isMatched =
                  figure.wallId === hoveredWallId || figure.group === hoveredGroup;

                return (
                  <polygon
                    key={figure.wallId}
                    className="transition-opacity duration-standard motion-reduce:transition-none"
                    fill={figure.colorToken}
                    fillOpacity={
                      isMatched
                        ? WALL_FILL_OPACITY_MATCHED
                        : hasHover
                          ? WALL_FILL_OPACITY_DIMMED
                          : WALL_FILL_OPACITY
                    }
                    points={figure.points}
                    stroke={figure.colorToken}
                    strokeWidth={WALL_OUTLINE_STROKE_WIDTH_PX}
                    onMouseEnter={() => {
                      onHoverWall(figure.wallId);
                    }}
                  />
                );
              })}
            </svg>

            {/* Viền cho những tường khớp cột biểu đồ đang trỏ tới. */}
            {figures
              .filter(
                (figure) => figure.wallId === hoveredWallId || figure.group === hoveredGroup,
              )
              .map((figure) => (
                <SelectionHalo
                  key={figure.wallId}
                  height={figure.boundsPx.height}
                  isVisible
                  variant={figure.wallId === hoveredWallId ? 'selected' : 'hover'}
                  width={figure.boundsPx.width}
                  x={figure.boundsPx.x}
                  y={figure.boundsPx.y}
                />
              ))}
          </>
        )}

        {/* Chú giải độ dày — nhãn và token màu đã ghép sẵn ở hook (A1, A15). */}
        <ul
          aria-label={LEGEND_LABEL}
          className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-[8px] bg-bg-surface p-2 shadow-float"
        >
          {legend.map((entry) => (
            <li key={String(entry.group)} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="shrink-0 rounded-[3px]"
                style={{
                  backgroundColor: entry.colorToken,
                  height: LEGEND_SWATCH_PX,
                  width: LEGEND_SWATCH_PX,
                }}
              />
              <span className="font-mono text-xs leading-none text-text-primary">
                {entry.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
