/**
 * Canvas giữa của màn QC "Lớp đối tượng" — 21 đối tượng vẽ bằng KÝ HIỆU KIẾN
 * TRÚC trên nền tường đã hạ xuống `--wall-idle`.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng {@link ObjectLayerCanvasViewProps},
 * không `@/api`, không `@/store`, không `@/domain`, không `@/lib/http` — kể cả
 * một dòng `import type`, thứ mà R-60 vốn cho phép nhưng màn anh em vẫn tránh.
 *
 * **Luật số một: không một phép hình học nào ở đây.** Tâm, góc, bề rộng, bề sâu
 * và hộp bao của từng đối tượng tới nơi ĐÃ TÍNH SẴN trong
 * `ObjectPlacementViewModel`; hook dựng chúng bằng `placeOnWall(wall,
 * relativePosition)` của M-08. Việc của file này là đặt một `translate` cộng
 * một `rotate` rồi đổ chuỗi `d` của `objectLayerSymbols.ts` vào `<path>`.
 *
 * `objectLayerSymbols.ts` giữ phần còn lại của tài liệu lớp này và phải đọc
 * trước khi sửa: mục "MỞ RỘNG HỢP ĐỒNG PROPS" (từng trường thêm vào và lý do
 * canvas không tự dựng được nó) và mục "GHI CHÚ THIẾT KẾ CỦA LỚP CANVAS" (vì
 * `viewBox` vừa khung, ba màu dữ liệu, và hai nhịp chuyển động
 * 260 ms).
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

import { ContextMenu } from '@/components/canvas/ContextMenu';
import { MeasurementLabel } from '@/components/canvas/MeasurementLabel';
import { SelectionHalo } from '@/components/canvas/SelectionHalo';
import { useCanvasZoomPan } from '@/components/canvas/useCanvasZoomPan';
import { ZoomCluster } from '@/components/canvas/ZoomCluster';
import type { ContextMenuGroup } from '@/hooks/useContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useSelectionHalo } from '@/hooks/useSelectionHalo';

import { QcAskAnchor } from '../shared/QcAskCard';
import { useQcAskSlot } from '../shared/qcAsk';
import { QcViewLayer } from '../shared/QcViewLayer';
import { QC_BACKGROUND_OPACITY } from '../shared/qcBackground';

import {
  HOST_WALL_HIGHLIGHT_TOKEN,
  OBJECT_CANVAS_FRAME_CLASSES,
  OBJECT_CANVAS_READ_ONLY_ID,
  OBJECT_CANVAS_TEXT,
  WALL_IDLE_TOKEN,
  buildObjectContextMenuItems,
  clientToViewBoxPoint,
  selectionHandleRects,
  type ObjectLayerCanvasViewProps,
} from './objectLayerSymbols';
import type { PixelPoint } from './objectLayerTypes';
import { ObjectSymbolFigure } from './ObjectLayerSymbolFigure';
import { ObjectLayerVisibilityToggles } from './ObjectLayerVisibilityToggles';

/** Hợp đồng props của lớp canvas, mang ra đây cho nơi gọi khỏi phải biết hai đường nhập. */
export type * from './objectLayerSymbols';

/** Kéo dưới chừng này pixel màn vẫn là một cú bấm: món 600 × 600 mm như trước (B3). */
const DRAG_CLICK_TOLERANCE_PX = 5;

/** Một lượt nhấn-kéo của chế độ vẽ: điểm nhấn trên màn (đo ngưỡng bấm) và hai góc pixel bản vẽ. */
interface DrawDrag {
  readonly clientX: number;
  readonly clientY: number;
  readonly start: PixelPoint;
  readonly end: PixelPoint;
}

/* -------------------------------------------------------------------------- */
/* Canvas.                                                                     */
/* -------------------------------------------------------------------------- */

export function ObjectLayerCanvas({
  backgroundImageAlt,
  backgroundImageUrl,
  dragMeasurement,
  drawLayer = null,
  haloRectPx,
  highlightedWallId,
  hoveredObjectId,
  isInteractive,
  isLoading = false,
  layerVisibility,
  onAttachToNearestWall,
  onApprove,
  onChangeSubtype,
  onDelete,
  onFrameResize,
  onHover,
  onPlaceAt,
  onSelect,
  onToggleLayer,
  placements,
  selectedObjectId,
  surfaceRectPx,
  unitPx,
  viewBoxPx,
  viewPins,
  wallOutlines,
}: ObjectLayerCanvasViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  /* Kéo bản vẽ: chuột giữa hoặc giữ Space + kéo (G4a-28, G4b-08; P06 mục 1). */
  /* Cụm zoom góc phải dưới như màn Tường (Impeccable A3): 100% là "vừa khung", lăn chuột cũng phóng. */
  const { pan, scale, zoomCluster } = useCanvasZoomPan();
  const setPanEl = pan.ref;
  const setFrameRef = useCallback(
    (element: HTMLDivElement | null) => {
      frameRef.current = element;
      setPanEl(element);
    },
    [setPanEl],
  );

  /* Khổ hộp đệm lên hook — "vừa khung" (BUG-403) cần biết khung rộng bao nhiêu. */
  useEffect(() => {
    const frame = frameRef.current;

    if (frame === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      onFrameResize({ width: frame.clientWidth, height: frame.clientHeight });
    });

    observer.observe(frame);

    return () => observer.disconnect();
  }, [onFrameResize]);

  const halo = useSelectionHalo();
  const ask = useQcAskSlot();
  const menu = useContextMenu();
  const { select: haloSelect, hover: haloHover, deselect: haloDeselect } = halo;
  const { openMenu } = menu;

  useEffect(() => {
    if (selectedObjectId !== null) {
      haloSelect();
    } else if (hoveredObjectId !== null) {
      haloHover();
    } else {
      haloDeselect();
    }
  }, [selectedObjectId, hoveredObjectId, haloSelect, haloHover, haloDeselect]);

  const handleOpenMenu = useCallback(
    (event: ReactMouseEvent<SVGGElement>, objectId: string) => {
      event.preventDefault();
      onSelect(objectId);

      const placement = placements.find((candidate) => candidate.id === objectId);

      if (placement === undefined) {
        return;
      }

      /* Mục menu dựng ở `objectLayerSymbols.ts`: một menu là dữ liệu, không phải thẻ. */
      const items = buildObjectContextMenuItems(placement, {
        onApprove,
        onAttachToNearestWall,
        onChangeSubtype,
        onDelete,
      });

      if (items.length === 0) {
        return;
      }

      const groups: ContextMenuGroup[] = [{ id: 'object', items: [...items] }];

      openMenu(event.clientX, event.clientY, groups);
    },
    [onApprove, onAttachToNearestWall, onChangeSubtype, onDelete, onSelect, openMenu, placements],
  );

  /*
   * Chế độ vẽ (K07): bấm trái lên bản vẽ đặt một món tại điểm ấy; giữ Space là kéo bản vẽ, không đặt.
   * Nội thất (B3): nhấn rồi kéo vẽ đúng hộp kéo; kéo dưới {@link DRAG_CLICK_TOLERANCE_PX} vẫn là một cú bấm.
   */
  const isDrawing = isInteractive && drawLayer !== null && onPlaceAt !== undefined && viewBoxPx !== null;
  const [drag, setDrag] = useState<DrawDrag | null>(null);
  const pointAt = (event: ReactMouseEvent<SVGRectElement>): PixelPoint | null => {
    const svg = event.currentTarget.ownerSVGElement;

    return svg === null || viewBoxPx === null
      ? null
      : clientToViewBoxPoint(svg.getBoundingClientRect(), viewBoxPx, event.clientX, event.clientY);
  };
  const handleDrawStart = (event: ReactMouseEvent<SVGRectElement>) => {
    const point = event.button === 0 && isDrawing && !pan.spaceHeld ? pointAt(event) : null;

    if (point !== null) {
      setDrag({ clientX: event.clientX, clientY: event.clientY, start: point, end: point });
    }
  };
  const handleDrawMove = (event: ReactMouseEvent<SVGRectElement>) => {
    const point = drag === null || drawLayer !== 'furniture' ? null : pointAt(event);

    if (drag !== null && point !== null) {
      setDrag({ ...drag, end: point });
    }
  };
  const handleDrawEnd = (event: ReactMouseEvent<SVGRectElement>) => {
    const end = drag === null ? null : pointAt(event);

    setDrag(null);

    if (drag === null || end === null || onPlaceAt === undefined) {
      return;
    }

    const isClick =
      drawLayer !== 'furniture' ||
      Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < DRAG_CLICK_TOLERANCE_PX;

    if (isClick) {
      onPlaceAt(drag.start);
    } else {
      onPlaceAt(drag.start, end);
    }
  };

  /* Thứ tự trong LỚP cho độ so le 24 ms (0/24/48… trong lớp vừa bật) — một phép đếm, không phải hình học. */
  const layerCursor: Record<string, number> = { door: 0, window: 0, furniture: 0 };
  const layerIndexById = new Map<string, number>();

  for (const placement of placements) {
    const index = layerCursor[placement.layer] ?? 0;

    layerIndexById.set(placement.id, index);
    layerCursor[placement.layer] = index + 1;
  }

  return (
    <div
      aria-describedby={isInteractive ? undefined : OBJECT_CANVAS_READ_ONLY_ID}
      aria-label={OBJECT_CANVAS_TEXT.canvasLabel}
      className={`${OBJECT_CANVAS_FRAME_CLASSES} ${pan.surfaceClassName}`}
      onMouseLeave={() => onHover(null)}
      ref={setFrameRef}
      role="group"
      style={pan.isPanning ? { cursor: 'grabbing' } : pan.spaceHeld ? { cursor: 'grab' } : undefined}
      {...pan.handlers}
    >
      {/* Ảnh nền, `<svg>` và lớp phủ đứng ở pixel KHUNG do hook tính (BUG-403). */}
      <div className="absolute inset-0" style={{ transform: `${pan.transform} scale(${scale})` }}>
        {backgroundImageUrl === null ? (
          <div aria-hidden="true" className="absolute inset-0 bg-bg-sunken" />
        ) : (
          <img
            alt={backgroundImageAlt}
            // J-10: không để preflight `max-width: 100%` bóp ảnh nền khi khung ảnh rộng hơn khung vẽ.
            className="pointer-events-none absolute block max-w-none select-none"
            draggable={false}
            src={backgroundImageUrl}
            style={
              surfaceRectPx === null
                ? { opacity: QC_BACKGROUND_OPACITY }
                : {
                    height: surfaceRectPx.height,
                    opacity: QC_BACKGROUND_OPACITY,
                    left: surfaceRectPx.x,
                    top: surfaceRectPx.y,
                    width: surfaceRectPx.width,
                  }
            }
          />
        )}

        <svg
          aria-label={OBJECT_CANVAS_TEXT.canvasLabel}
          className="absolute inset-0 h-full w-full"
          role="img"
          viewBox={
            viewBoxPx === null
              ? undefined
              : `${viewBoxPx.x} ${viewBoxPx.y} ${viewBoxPx.width} ${viewBoxPx.height}`
          }
        >
          {/* Tường hạ xuống `--wall-idle` để đối tượng nổi lên (đặc tả gốc). */}
          {wallOutlines.map((wall) => (
            <polygon
              fill={WALL_IDLE_TOKEN}
              key={wall.id}
              points={wall.outline.map((point) => `${point.x},${point.y}`).join(' ')}
              {...(wall.id === highlightedWallId ? { stroke: HOST_WALL_HIGHLIGHT_TOKEN, strokeWidth: 3 * unitPx } : {})}
            />
          ))}

          {placements.map((placement) => (
            <ObjectSymbolFigure
              isHovered={placement.id === hoveredObjectId}
              isInteractive={isInteractive}
              isLayerVisible={layerVisibility[placement.layer]}
              isSelected={placement.id === selectedObjectId}
              key={placement.id}
              layerIndex={layerIndexById.get(placement.id) ?? 0}
              onHover={onHover}
              onOpenMenu={handleOpenMenu}
              onSelect={onSelect}
              placement={placement}
              unitPx={unitPx}
            />
          ))}

          {/* Lớp bắt bấm của chế độ vẽ, trên mọi ký hiệu: bấm trúng một món cũ vẫn là đặt món mới. */}
          {isDrawing && viewBoxPx !== null ? (
            <rect
              className="cursor-crosshair"
              data-testid="object-draw-surface"
              fill="transparent"
              height={viewBoxPx.height}
              onMouseDown={handleDrawStart}
              onMouseLeave={() => setDrag(null)}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              width={viewBoxPx.width}
              x={viewBoxPx.x}
              y={viewBoxPx.y}
            />
          ) : null}

          {/* Hộp đang kéo của nội thất mới (B3). */}
          {drag === null || drawLayer !== 'furniture' ? null : (
            <rect
              className="pointer-events-none"
              data-testid="object-draw-preview"
              fill="none"
              height={Math.abs(drag.end.y - drag.start.y)}
              stroke="var(--accent)"
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              width={Math.abs(drag.end.x - drag.start.x)}
              x={Math.min(drag.start.x, drag.end.x)}
              y={Math.min(drag.start.y, drag.end.y)}
            />
          )}
        </svg>

        <QcAskAnchor rect={selectedObjectId === null ? null : haloRectPx}>{ask}</QcAskAnchor>
        {viewPins === undefined ? null : (
          <QcViewLayer focus={selectedObjectId === null ? null : haloRectPx} onPick={onSelect} pins={viewPins} selectedId={selectedObjectId} />
        )}

        {haloRectPx === null ? null : (
          <>
            <SelectionHalo
              hasEntered={halo.hasEntered}
              height={haloRectPx.height}
              isVisible={halo.isVisible}
              variant={halo.variant}
              width={haloRectPx.width}
              x={haloRectPx.x}
              y={haloRectPx.y}
            />
            {/* Bốn tay cầm 6px của hộp chọn — `SelectionHalo` chỉ vẽ viền. */}
            {selectionHandleRects(haloRectPx).map((handle) => (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-[1px] border border-accent bg-bg-surface"
                key={`${handle.x}-${handle.y}`}
                style={{ height: handle.height, left: handle.x, top: handle.y, width: handle.width }}
              />
            ))}
          </>
        )}

        {/* Kéo Slider vị trí: số đo tới HAI ĐẦU tường chủ, hai chuỗi đã định dạng sẵn. */}
        {dragMeasurement === null ? null : (
          <>
            <MeasurementLabel
              currentPoint={dragMeasurement.objectPx}
              distanceFormatted={dragMeasurement.distanceToStartLabel}
              midPoint={dragMeasurement.midToStartPx}
              startPoint={dragMeasurement.wallStartPx}
              state={dragMeasurement.state}
            />
            <MeasurementLabel
              currentPoint={dragMeasurement.wallEndPx}
              distanceFormatted={dragMeasurement.distanceToEndLabel}
              midPoint={dragMeasurement.midToEndPx}
              startPoint={dragMeasurement.objectPx}
              state={dragMeasurement.state}
            />
          </>
        )}
      </div>

      {placements.length === 0 && !isLoading ? (
        <p className="absolute inset-x-0 top-1/2 text-center text-[13px] text-text-muted">
          {OBJECT_CANVAS_TEXT.nothingToDraw}
        </p>
      ) : null}

      {isDrawing ? (
        <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-bg-surface px-3 py-1.5 text-[13px] text-text-primary shadow-float">
          {OBJECT_CANVAS_TEXT.drawHint}
        </p>
      ) : null}

      {onToggleLayer === undefined ? null : (
        <ObjectLayerVisibilityToggles layerVisibility={layerVisibility} onToggleLayer={onToggleLayer} />
      )}

      <ZoomCluster {...zoomCluster} />

      <ContextMenu
        groups={menu.groups}
        isVisible={menu.isVisible}
        onClose={menu.closeMenu}
        position={menu.position}
      />

      {isInteractive ? null : (
        <p className="sr-only" id={OBJECT_CANVAS_READ_ONLY_ID}>
          {OBJECT_CANVAS_TEXT.readOnlyNotice}
        </p>
      )}
    </div>
  );
}
