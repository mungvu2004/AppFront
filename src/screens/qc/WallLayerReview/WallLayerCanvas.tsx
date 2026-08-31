/**
 * Canvas giữa của màn QC "Duyệt lớp tường" — mặt bằng 2D vẽ tường thành đa giác
 * tô đầy, trên nền ảnh bản vẽ gốc mờ 20%, kèm các lớp phủ nổi.
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng `WallLayerCanvasViewProps`,
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`
 * (`import type` bên dưới bị xoá lúc biên dịch nên không kéo tầng nào vào bản
 * dựng — đúng ngoại lệ mà `eslint-rules/no-data-layer-in-view.js` ghi rõ).
 *
 * **Luật số một: không một phép hình học nào ở đây.** Đa giác tường tới nơi ĐÃ
 * TÍNH SẴN, hook dựng bằng `resolveWallShapes`; việc của file này là nối mảng
 * điểm thành chuỗi `points` (`toSvgPoints`) và giao cho `<polygon>`. Không tự
 * offset, không tự tìm giao điểm, không tự tính pháp tuyến, không tự quy đổi
 * mm↔px, không tự tìm hộp bao. Mọi toạ độ trong props đã là PIXEL bản vẽ.
 *
 * `wallLayerHatch.ts` giữ phần còn lại của tài liệu lớp này và phải đọc trước
 * khi nối hook vào: mục "MỞ RỘNG HỢP ĐỒNG PROPS" (từng trường thêm vào và lý do
 * canvas không tự dựng được nó) và mục "GHI CHÚ THIẾT KẾ CỦA LỚP CANVAS" (vì
 * sao vẽ bằng SVG, hai lớp phân biệt ba độ dày, bảy trạng thái, và hai hạn chế
 * đã biết của `ZoomCluster`/`MiniMap`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import { ContextMenu } from '@/components/canvas/ContextMenu';
import { GridLayer } from '@/components/canvas/GridLayer';
import { MeasurementLabel } from '@/components/canvas/MeasurementLabel';
import { MiniMap } from '@/components/canvas/MiniMap';
import { SelectionHalo } from '@/components/canvas/SelectionHalo';
import { ZoomCluster } from '@/components/canvas/ZoomCluster';
import { Skeleton } from '@/components/feedback/Skeleton';
import type { ContextMenuGroup } from '@/hooks/useContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useSelectionHalo } from '@/hooks/useSelectionHalo';
import { cssDurationMs } from '@/lib/motion';

import { WallLayerLegend } from './WallLayerLegend';
import { WallShapeFigure } from './WallLayerShapeFigure';
import type { WallLayerCanvasViewProps, WallLayerRectPx } from './wallLayerHatch';
import {
  ATTENTION_TOKEN,
  BACKGROUND_IMAGE_OPACITY,
  WALL_HATCH_LINE_WIDTH_PX,
  WALL_HATCH_OPACITY,
  WALL_HATCH_PATTERN_ID,
  WALL_HATCH_PATTERN_TRANSFORM,
  WALL_HATCH_TILE_PX,
  toSvgPoints,
  wallThicknessFillToken,
} from './wallLayerHatch';

/** Hợp đồng props của lớp canvas, mang ra đây cho nơi gọi khỏi phải biết hai đường nhập. */
export type * from './wallLayerHatch';

/**
 * Mã một tường, đọc lại từ chính hợp đồng props — cùng kiểu với `WallId` của
 * `@/domain/spatial/types`, nhưng nhờ vậy view này không có MỘT dòng nhập nào
 * trỏ vào tầng dữ liệu, kể cả dòng `import type` mà R-60 vốn cho phép.
 */
type WallId = NonNullable<WallLayerCanvasViewProps['selectedWallId']>;

/* Chuỗi tiếng Việt tĩnh — khớp `i18n.fragment.json` của màn (A6). */

const MENU_LABELS = {
  approve: 'Duyệt',
  changeThickness: 'Đổi độ dày',
  split: 'Tách đoạn',
  remove: 'Xoá',
} as const;

const WAITING_FRAME_LABEL = 'Chưa có ảnh bản vẽ của tầng này';
const MINIMAP_LABEL = 'Mặt bằng thu nhỏ';
const FORBIDDEN_DESCRIPTION =
  'Bản vẽ vẫn xem và phóng to được, nhưng không chọn hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.';
const FORBIDDEN_DESCRIPTION_ID = 'wall-layer-canvas-forbidden';

/** Khung canvas: tối thiểu 640, bo 16, thụt 12 — đúng đặc tả màn. */
const FRAME_CLASSES =
  'relative min-h-[640px] w-full overflow-hidden rounded-[16px] border border-border-default bg-canvas-2d p-3';

/* Canvas. */

export function WallLayerCanvas({
  backgroundImageAlt,
  backgroundImageUrl,
  canvasLabel,
  contentBoundsPx,
  drawingSizePx,
  hoveredWallId,
  isInteractive,
  isWallLayerVisible,
  legendLevels,
  measurement,
  millimetresPerPixel,
  onApprove,
  onDelete,
  onHover,
  onRequestSplit,
  onRequestThicknessChange,
  onSelect,
  miniMapViewport,
  onFitToScreen,
  onFrameResize,
  onMiniMapViewportChange,
  onPointerMove,
  onResetZoom,
  onZoomIn,
  onZoomOut,
  prefersReducedMotion,
  selectedWallId,
  shapes,
  showCentrelines,
  state,
  viewport,
  zoomPercent,
}: WallLayerCanvasViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const halo = useSelectionHalo();
  const menu = useContextMenu();
  const { select: haloSelect, hover: haloHover, deselect: haloDeselect } = halo;
  const { openMenu } = menu;

  useEffect(() => {
    const frame = frameRef.current;

    if (frame === null) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry !== undefined) {
        const size = { width: entry.contentRect.width, height: entry.contentRect.height };

        setFrameSize(size);
        /*
         * Lên hook, nguyên số của `ResizeObserver`. "Vừa khung" cần biết khung
         * rộng bao nhiêu mới khớp được thật, và khung là thứ chỉ view biết.
         */
        onFrameResize(size);
      }
    });

    observer.observe(frame);

    return () => observer.disconnect();
  }, [onFrameResize]);

  useEffect(() => {
    if (selectedWallId !== null) {
      haloSelect();
    } else if (hoveredWallId !== null) {
      haloHover();
    } else {
      haloDeselect();
    }
  }, [selectedWallId, hoveredWallId, haloSelect, haloHover, haloDeselect]);

  /**
   * Toạ độ con trỏ cho thanh trạng thái — KHÔNG một phép tính nào ở đây.
   *
   * `getScreenCTM().inverse()` là ma trận của chính `<svg>`, và `<svg>` mang
   * `viewBox` đúng bằng khổ ảnh bản vẽ tính theo pixel — nên trình duyệt trả về
   * thẳng toạ độ PIXEL BẢN VẼ, đã gộp sẵn cả phép dịch lẫn mức phóng của khung
   * nhìn. View chỉ chuyển tiếp hai con số đó; hook quy ra milimét và định dạng.
   *
   * jsdom không cài `getScreenCTM`, nên nhánh `null` là đường đi thật của bài
   * kiểm chứ không phải một lối thoát phòng hờ — bài kiểm gọi thẳng
   * `canvas.onPointerMove(...)` để đo chuỗi toạ độ.
   */
  const handlePointerMove = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const matrix = event.currentTarget.getScreenCTM?.();

      if (matrix === null || matrix === undefined) {
        return;
      }

      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());

      onPointerMove({ xPx: point.x, yPx: point.y });
    },
    [onPointerMove],
  );

  const handlePointerLeave = useCallback(() => {
    onPointerMove(null);
  }, [onPointerMove]);

  const handleOpenMenu = useCallback(
    (event: ReactMouseEvent<SVGGElement>, wallId: WallId) => {
      event.preventDefault();
      onSelect(wallId);

      const groups: ContextMenuGroup[] = [
        {
          id: 'wall',
          items: [
            { id: 'approve', label: MENU_LABELS.approve, action: () => onApprove(wallId) },
            {
              id: 'thickness',
              label: MENU_LABELS.changeThickness,
              action: () => onRequestThicknessChange(wallId),
            },
            { id: 'split', label: MENU_LABELS.split, action: () => onRequestSplit(wallId) },
            {
              id: 'remove',
              label: MENU_LABELS.remove,
              isDestructive: true,
              action: () => onDelete(wallId),
            },
          ],
        },
      ];

      openMenu(event.clientX, event.clientY, groups);
    },
    [onApprove, onDelete, onRequestSplit, onRequestThicknessChange, onSelect, openMenu],
  );

  /** Khung của lớp vẽ: ảnh bản vẽ nếu đã có, không thì vừa đủ ôm hết tường. */
  const surface = useMemo<WallLayerRectPx | null>(() => {
    if (drawingSizePx !== null) {
      return { x: 0, y: 0, width: drawingSizePx.width, height: drawingSizePx.height };
    }

    return contentBoundsPx;
  }, [contentBoundsPx, drawingSizePx]);

  const activeShape =
    shapes.find((shape) => shape.id === (selectedWallId ?? hoveredWallId)) ?? null;

  const viewBox =
    surface === null ? undefined : `${surface.x} ${surface.y} ${surface.width} ${surface.height}`;

  return (
    <div
      aria-describedby={isInteractive ? undefined : FORBIDDEN_DESCRIPTION_ID}
      aria-label={canvasLabel}
      className={FRAME_CLASSES}
      onMouseLeave={handlePointerLeave}
      ref={frameRef}
      role="group"
    >
      {state === 'loading' ? (
        <Skeleton className="absolute inset-0" preset="canvas" />
      ) : (
        <>
          <GridLayer
            height={frameSize.height}
            offsetX={viewport.x}
            offsetY={viewport.y}
            scaleRatioMmPerPx={millimetresPerPixel}
            width={frameSize.width}
            zoom={viewport.zoom}
          />

          {surface === null ? (
            <div
              aria-label={WAITING_FRAME_LABEL}
              className="absolute inset-3 rounded-[12px] bg-bg-sunken"
              role="img"
            />
          ) : (
            <div
              className="absolute left-0 top-0 origin-top-left motion-reduce:transition-none"
              style={{
                height: surface.height,
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                transitionDuration: cssDurationMs('slow', { reducedMotion: prefersReducedMotion }),
                transitionProperty: 'transform',
                width: surface.width,
              }}
            >
              {backgroundImageUrl === null ? (
                <div aria-hidden="true" className="absolute inset-0 bg-bg-sunken" />
              ) : (
                <img
                  alt={backgroundImageAlt}
                  className="pointer-events-none absolute inset-0 block h-full w-full select-none"
                  draggable={false}
                  src={backgroundImageUrl}
                  style={{ opacity: BACKGROUND_IMAGE_OPACITY }}
                />
              )}

              <svg
                aria-label={canvasLabel}
                className="absolute inset-0 h-full w-full"
                onMouseMove={handlePointerMove}
                role="img"
                viewBox={viewBox}
              >
                <defs>
                  <pattern
                    height={WALL_HATCH_TILE_PX}
                    id={WALL_HATCH_PATTERN_ID}
                    patternTransform={WALL_HATCH_PATTERN_TRANSFORM}
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
                </defs>

                {shapes.map((shape) => (
                  <WallShapeFigure
                    isHovered={shape.id === hoveredWallId}
                    isInteractive={isInteractive}
                    isSelected={shape.id === selectedWallId}
                    key={shape.id}
                    onHover={onHover}
                    onOpenMenu={handleOpenMenu}
                    onSelect={onSelect}
                    shape={shape}
                    showCentrelines={showCentrelines}
                  />
                ))}
              </svg>

              {activeShape === null ? null : (
                <SelectionHalo
                  hasEntered={halo.hasEntered}
                  height={activeShape.boundsPx.height}
                  isVisible={halo.isVisible}
                  variant={halo.variant}
                  width={activeShape.boundsPx.width}
                  x={activeShape.boundsPx.x}
                  y={activeShape.boundsPx.y}
                />
              )}

              {measurement === null ? null : (
                <MeasurementLabel
                  currentPoint={measurement.currentPx}
                  distanceFormatted={measurement.distanceLabel}
                  midPoint={measurement.midPx}
                  startPoint={measurement.startPx}
                  state={measurement.state}
                />
              )}
            </div>
          )}
        </>
      )}

      <WallLayerLegend
        isWallLayerVisible={isWallLayerVisible}
        levels={legendLevels}
        state={state}
      />
      <ZoomCluster
        onFitToScreen={onFitToScreen}
        onResetZoom={onResetZoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        zoomLevel={zoomPercent}
      />
      <MiniMap initialViewport={miniMapViewport} onViewportChange={onMiniMapViewportChange}>
        {viewBox === undefined ? null : (
          <svg aria-label={MINIMAP_LABEL} className="h-full w-full" role="img" viewBox={viewBox}>
            {shapes.map((shape) => (
              <polygon
                fill={wallThicknessFillToken(shape.thicknessMm)}
                key={shape.id}
                points={toSvgPoints(shape.outline)}
              />
            ))}
          </svg>
        )}
      </MiniMap>

      <ContextMenu
        groups={menu.groups}
        isVisible={menu.isVisible}
        onClose={menu.closeMenu}
        position={menu.position}
      />

      {isInteractive ? null : (
        <p className="sr-only" id={FORBIDDEN_DESCRIPTION_ID}>
          {FORBIDDEN_DESCRIPTION}
        </p>
      )}
    </div>
  );
}
