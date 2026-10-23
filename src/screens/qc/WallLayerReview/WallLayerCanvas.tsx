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
import { SelectionHalo } from '@/components/canvas/SelectionHalo';
import { useCanvasPan } from '@/components/canvas/useCanvasPan';
import { ZoomCluster } from '@/components/canvas/ZoomCluster';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useSelectionHalo } from '@/hooks/useSelectionHalo';
import { cn } from '@/lib/utils';

import { WallDraftGuide, WallDrawingBackground, WallLayerLegend, WallLayerMiniMap } from './WallLayerCanvasParts';
import { drawingPointOf, wallMenuGroups } from './wallLayerCanvasActions';
import { WallHatchDefs, WallShapeFigure } from './WallLayerShapeFigure';
import type { WallLayerCanvasViewProps, WallLayerRectPx } from './wallLayerHatch';

/** Hợp đồng props của lớp canvas, mang ra đây cho nơi gọi khỏi phải biết hai đường nhập. */
export type * from './wallLayerHatch';

/**
 * Mã một tường, đọc lại từ chính hợp đồng props — cùng kiểu với `WallId` của
 * `@/domain/spatial/types`, nhưng nhờ vậy view này không có MỘT dòng nhập nào
 * trỏ vào tầng dữ liệu, kể cả dòng `import type` mà R-60 vốn cho phép.
 */
type WallId = NonNullable<WallLayerCanvasViewProps['selectedWallId']>;

const NO_SELECTED_WALLS: readonly WallId[] = [];

const WAITING_FRAME_LABEL = 'Chưa có ảnh bản vẽ của tầng này';
const FORBIDDEN_DESCRIPTION =
  'Bản vẽ vẫn xem và phóng to được, nhưng không chọn hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.';

const FORBIDDEN_DESCRIPTION_ID = 'wall-layer-canvas-forbidden';

/**
 * Khung canvas: tối thiểu 640 từ 1280px (đặc tả màn), bo 16, thụt 12. Dưới 1280px khung lấp đầy vùng
 * bản vẽ 60vh — tối thiểu 640 ở đó đẩy thanh thu phóng ra ngoài vùng nhìn (BUG-317).
 */
const FRAME_CLASSES =
  'relative h-full min-h-80 w-full overflow-hidden rounded-2xl border border-border-default bg-canvas-2d p-3 xl:min-h-[640px]';

/* Canvas. */

export function WallLayerCanvas({
  backgroundImageAlt,
  backgroundImageUrl,
  canvasLabel,
  contentBoundsPx,
  drawingSizePx,
  haloRectPx,
  hoveredWallId,
  isInteractive,
  isWallLayerVisible,
  legendLevels,
  measurement,
  millimetresPerPixel,
  onApprove,
  onCanvasPoint,
  onDelete,
  onHover,
  onToggleSelect,
  onRequestSplit,
  onRequestThicknessChange,
  onSelect,
  miniMapViewport,
  onFitToScreen,
  onFrameResize,
  onMiniMapViewportChange,
  onPanBy,
  onPointerMove,
  onResetZoom,
  onZoomIn,
  onZoomOut,
  selectedWallId,
  selectedWallIds = NO_SELECTED_WALLS,
  menuRequest,
  draftGuidePx = null,
  shapes,
  showCentrelines,
  state,
  surfaceRectPx,
  unitPx,
  viewBoxPx,
  viewport,
  zoomPercent,
}: WallLayerCanvasViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const halo = useSelectionHalo();
  const menu = useContextMenu();
  const { select: haloSelect, hover: haloHover, deselect: haloDeselect } = halo;
  const { openMenu } = menu;

  /*
   * G4a-19: kéo nền (chuột trái trên nền trống), chuột giữa, Space+kéo dời bản vẽ; lăn chuột phóng.
   * `useCanvasPan` cộng dồn độ dời; ở đây chỉ chuyển PHẦN MỚI lên hook (viewBox do hook giữ).
   */
  const pan = useCanvasPan((direction) => (direction > 0 ? onZoomIn() : onZoomOut()));
  const panRef = pan.ref;
  const lastPanOffsetRef = useRef(pan.offset);
  useEffect(() => {
    const previous = lastPanOffsetRef.current;
    lastPanOffsetRef.current = pan.offset;
    const dx = pan.offset.x - previous.x;
    const dy = pan.offset.y - previous.y;

    if (dx !== 0 || dy !== 0) {
      onPanBy(dx, dy);
    }
  }, [onPanBy, pan.offset]);
  const setFrameEl = useCallback(
    (el: HTMLDivElement | null) => {
      frameRef.current = el;
      panRef(el);
    },
    [panRef],
  );
  /* Kéo xong thì `click` vẫn nổ: bỏ qua nó để công cụ vẽ không nhận một điểm ngoài ý muốn. */
  const pointerDownAtRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const frame = frameRef.current;

    if (frame === null) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry !== undefined) {
        setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        /* Lên hook: khổ hộp đệm — hệ toạ độ của lớp vẽ `absolute inset-0` mà "vừa khung" cần. */
        onFrameResize({ width: frame.clientWidth, height: frame.clientHeight });
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
   * Toạ độ con trỏ cho thanh trạng thái — KHÔNG một phép tính nào ở đây (`drawingPointOf`: trình
   * duyệt đổi, hook quy ra milimét). jsdom trả `null`, nên bài kiểm gọi thẳng `canvas.onPointerMove(...)`.
   */
  const handlePointerMove = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const reading = drawingPointOf(event.currentTarget, event.clientX, event.clientY);

      if (reading !== null) {
        onPointerMove(reading);
      }
    },
    [onPointerMove],
  );

  /**
   * Một lượt bấm trên bản vẽ → một bước của máy công cụ.
   *
   * Đây là đường mà vẽ tường, tách đoạn và đo đi qua; trước lượt sửa này nó
   * không tồn tại, nên ba công cụ đó bấm được mà không làm gì. Toạ độ vẫn do
   * TRÌNH DUYỆT đổi (`getScreenCTM().inverse()`), y hệt `handlePointerMove` —
   * không một phép tính nào thêm ở view.
   *
   * Bấm vào một đa giác tường cũng nổi bọt lên đây, và đó là điều mong muốn:
   * bước `point` của công cụ tách đoạn thường rơi đúng trên tường cần cắt.
   * Công cụ nào không chờ một điểm thì `reduceTool` bỏ qua lượt này.
   */
  const svgRef = useRef<SVGSVGElement | null>(null);
  const handleCanvasClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const svg = svgRef.current;

      /*
       * Gắn ở KHUNG (không ở `<svg>`): lúc kéo nền khung giữ con trỏ (pointer capture), nên
       * `click` của một lần bấm nền rơi vào khung chứ không vào `<svg>`. Bấm nút nổi (thu phóng,
       * bản đồ nhỏ, chú giải) thì bỏ qua.
       */
      if (!isInteractive || svg === null || !(event.target === event.currentTarget || svg.contains(event.target as Node))) {
        return;
      }

      const downAt = pointerDownAtRef.current;

      if (downAt !== null && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 4) {
        return;
      }

      const reading = drawingPointOf(svg, event.clientX, event.clientY);

      if (reading !== null) {
        onCanvasPoint(reading);
      }
    },
    [isInteractive, onCanvasPoint],
  );

  const handlePointerLeave = useCallback(() => {
    onPointerMove(null);
  }, [onPointerMove]);

  const openWallMenu = useCallback(
    (x: number, y: number, wallId: WallId) => {
      const isReviewed = shapes.find((shape) => shape.id === wallId)?.isReviewed ?? false;

      openMenu(x, y, wallMenuGroups(wallId, isReviewed, { onApprove, onDelete, onRequestSplit, onRequestThicknessChange }));
    },
    [onApprove, onDelete, onRequestSplit, onRequestThicknessChange, openMenu, shapes],
  );

  const handleOpenMenu = useCallback(
    (event: ReactMouseEvent<SVGGElement>, wallId: WallId) => {
      event.preventDefault();
      onSelect(wallId);
      openWallMenu(event.clientX, event.clientY, wallId);
    },
    [onSelect, openWallMenu],
  );

  /* G74: menu mở từ bàn phím (danh sách) neo ở giữa khung — không có toạ độ con trỏ nào để neo. */
  const lastMenuSeqRef = useRef(0);
  useEffect(() => {
    if (menuRequest == null || menuRequest.seq === lastMenuSeqRef.current) {
      return;
    }

    lastMenuSeqRef.current = menuRequest.seq;
    const { left = 0, top = 0, width = 0, height = 0 } = frameRef.current?.getBoundingClientRect() ?? {};
    openWallMenu(left + width / 2, top + height / 2, menuRequest.wallId);
  }, [menuRequest, openWallMenu]);

  /** Khung của lớp vẽ: ảnh bản vẽ nếu đã có, không thì vừa đủ ôm hết tường. */
  const surface = useMemo<WallLayerRectPx | null>(() => {
    if (drawingSizePx !== null) {
      return { x: 0, y: 0, width: drawingSizePx.width, height: drawingSizePx.height };
    }

    return contentBoundsPx;
  }, [contentBoundsPx, drawingSizePx]);

  const frameViewBox =
    viewBoxPx === null
      ? undefined
      : `${viewBoxPx.x} ${viewBoxPx.y} ${viewBoxPx.width} ${viewBoxPx.height}`;

  return (
    <div
      aria-describedby={isInteractive ? undefined : FORBIDDEN_DESCRIPTION_ID}
      aria-label={canvasLabel}
      className={cn(
        FRAME_CLASSES,
        pan.surfaceClassName,
        pan.isPanning ? 'cursor-grabbing' : pan.spaceHeld ? 'cursor-grab' : undefined,
      )}
      onClick={handleCanvasClick}
      onMouseLeave={handlePointerLeave}
      onLostPointerCapture={pan.handlers.onLostPointerCapture}
      onPointerCancel={pan.handlers.onPointerCancel}
      onPointerDown={(event) => {
        pointerDownAtRef.current = { x: event.clientX, y: event.clientY };
        pan.handlers.onPointerDown(event);
      }}
      onPointerMove={pan.handlers.onPointerMove}
      onPointerUp={pan.handlers.onPointerUp}
      ref={setFrameEl}
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
              className="absolute inset-3 rounded-xl bg-bg-sunken"
              role="img"
            />
          ) : (
            <>
              {/* Ảnh nền + `<svg>` + lớp phủ đứng ở pixel KHUNG do hook tính (BUG-403): không lớp `scale()` nào. */}
              <WallDrawingBackground
                backgroundImageAlt={backgroundImageAlt}
                backgroundImageUrl={backgroundImageUrl}
                surface={surface}
                surfaceRectPx={surfaceRectPx}
              />

              <svg
                aria-label={canvasLabel}
                className="absolute inset-0 h-full w-full"
                data-canvas-bg=""
                ref={svgRef}
                onMouseMove={handlePointerMove}
                role="img"
                viewBox={frameViewBox}
              >
                <WallHatchDefs unitPx={unitPx} />

                {/* G4a-17: "Ẩn lớp tường" ẩn thật các đoạn tường, để nhìn thấy bản vẽ gốc bên dưới. */}
                {(isWallLayerVisible ? shapes : []).map((shape) => (
                  <WallShapeFigure
                    isHovered={shape.id === hoveredWallId}
                    isInteractive={isInteractive}
                    isSelected={shape.id === selectedWallId || selectedWallIds.includes(shape.id)}
                    key={shape.id}
                    onHover={onHover}
                    onOpenMenu={handleOpenMenu}
                    onSelect={onSelect}
                    onToggleSelect={onToggleSelect}
                    shape={shape}
                    showCentrelines={showCentrelines}
                    unitPx={unitPx}
                  />
                ))}

                {draftGuidePx === null ? null : <WallDraftGuide draftGuidePx={draftGuidePx} unitPx={unitPx} />}
              </svg>

              {haloRectPx === null ? null : (
                <SelectionHalo
                  hasEntered={halo.hasEntered}
                  height={haloRectPx.height}
                  isVisible={halo.isVisible}
                  variant={halo.variant}
                  width={haloRectPx.width}
                  x={haloRectPx.x}
                  y={haloRectPx.y}
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
            </>
          )}
        </>
      )}

      <WallLayerLegend
        isWallLayerVisible={isWallLayerVisible}
        legendLevels={legendLevels}
        shapes={shapes}
        state={state}
      />
      <ZoomCluster
        onFitToScreen={onFitToScreen}
        onResetZoom={onResetZoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        zoomLevel={zoomPercent}
      />
      <WallLayerMiniMap
        miniMapViewport={miniMapViewport}
        onMiniMapViewportChange={onMiniMapViewportChange}
        shapes={shapes}
        surface={surface}
        zoomPercent={zoomPercent}
      />

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
