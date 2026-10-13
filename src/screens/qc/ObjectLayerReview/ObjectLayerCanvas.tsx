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
import type { ContextMenuGroup } from '@/hooks/useContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useSelectionHalo } from '@/hooks/useSelectionHalo';
import { staggerDelayMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import {
  HOST_WALL_HIGHLIGHT_TOKEN,
  OBJECT_CANVAS_COLOR_COUNT_TEST_ID,
  OBJECT_CANVAS_FRAME_CLASSES,
  OBJECT_CANVAS_READ_ONLY_ID,
  OBJECT_CANVAS_TEXT,
  OBJECT_LAYER_COLOR_TOKENS,
  SYMBOL_STROKE_WIDTH_PX,
  SYMBOL_WASH_OPACITY,
  WALL_IDLE_TOKEN,
  buildObjectContextMenuItems,
  buildObjectSymbol,
  objectLayerColorToken,
  selectionHandleRects,
  visibleDataColorTokens,
  type ObjectLayerCanvasViewProps,
  type ObjectPlacementViewModel,
} from './objectLayerSymbols';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS } from './objectLayerTypes';

/** Hợp đồng props của lớp canvas, mang ra đây cho nơi gọi khỏi phải biết hai đường nhập. */
export type * from './objectLayerSymbols';

/* -------------------------------------------------------------------------- */
/* Một ký hiệu.                                                                */
/* -------------------------------------------------------------------------- */

interface ObjectSymbolFigureProps {
  readonly placement: ObjectPlacementViewModel;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isLayerVisible: boolean;
  readonly isInteractive: boolean;
  /** Thứ tự trong LỚP của nó — độ so le 24 ms đếm theo lớp vừa bật/tắt. */
  readonly layerIndex: number;
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
  readonly onOpenMenu: (event: ReactMouseEvent<SVGGElement>, objectId: string) => void;
  readonly unitPx: number;
}

/**
 * Một đối tượng: nền 6%, các nét viền 1px, cộng hai nhịp chuyển động (bật/tắt
 * lớp và đổi loại). Cả hai nhịp giải thích ở mục "GHI CHÚ THIẾT KẾ CỦA LỚP
 * CANVAS" của `objectLayerSymbols.ts`.
 */
function ObjectSymbolFigure({
  placement,
  isSelected,
  isHovered,
  isLayerVisible,
  isInteractive,
  layerIndex,
  onSelect,
  onHover,
  onOpenMenu,
  unitPx,
}: ObjectSymbolFigureProps) {
  const symbol = buildObjectSymbol({
    subtype: placement.subtype,
    swing: placement.swing,
    width: placement.widthPx,
    depth: placement.depthPx,
  });
  const token = objectLayerColorToken(placement.layer);
  const previousShapeRef = useRef(`${placement.subtype}/${placement.swing}`);
  const [isMorphing, setIsMorphing] = useState(false);

  useEffect(() => {
    const shape = `${placement.subtype}/${placement.swing}`;

    if (previousShapeRef.current === shape) {
      return undefined;
    }

    previousShapeRef.current = shape;
    setIsMorphing(true);

    const frame = requestAnimationFrame(() => setIsMorphing(false));

    return () => cancelAnimationFrame(frame);
  }, [placement.subtype, placement.swing]);

  return (
    <g
      aria-hidden={isLayerVisible ? undefined : 'true'}
      aria-label={placement.codeLabel}
      className={cn(
        'transition-[opacity,transform] duration-260 motion-reduce:transition-none',
        isLayerVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        isInteractive && isLayerVisible ? 'cursor-pointer' : 'pointer-events-none',
      )}
      onClick={isInteractive ? () => onSelect(placement.id) : undefined}
      onContextMenu={isInteractive ? (event) => onOpenMenu(event, placement.id) : undefined}
      onMouseEnter={isInteractive ? () => onHover(placement.id) : undefined}
      onMouseLeave={isInteractive ? () => onHover(null) : undefined}
      role="presentation"
      style={{
        transform: isLayerVisible ? 'translateY(0)' : 'translateY(4px)',
        transitionDelay: `${staggerDelayMs(layerIndex)}ms`,
      }}
    >
      {/* Đặt chỗ bằng THUỘC TÍNH `transform` của SVG: lớp `scale-…` bên trong ghi vào `transform` CSS, chung chỗ thì nuốt nhau. */}
      <g transform={`translate(${placement.centrePx.x} ${placement.centrePx.y}) rotate(${placement.angleDeg})`}>
        <g
          className={cn(
            'origin-center transition-[opacity,transform] duration-260 motion-reduce:transition-none',
            isMorphing ? 'scale-90 opacity-0' : 'scale-100 opacity-100',
          )}
        >
          <path
            className="transition-colors duration-260 motion-reduce:transition-none"
            d={symbol.footprint}
            fill={token}
            fillOpacity={SYMBOL_WASH_OPACITY}
          />

          {symbol.strokes.map((stroke) => (
            <path
              className="transition-colors duration-260 motion-reduce:transition-none"
              d={stroke.d}
              fill="none"
              key={stroke.id}
              stroke={token}
              strokeDasharray={stroke.dashArray ?? undefined}
              strokeWidth={isSelected || isHovered ? SYMBOL_STROKE_WIDTH_PX * 2 : SYMBOL_STROKE_WIDTH_PX}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </g>

      {placement.isOrphan ? (
        <circle
          cx={placement.centrePx.x}
          cy={placement.centrePx.y}
          fill="var(--state-attention)"
          r={5 * unitPx}
        >
          <title>{OBJECT_CANVAS_TEXT.orphanTitle}</title>
        </circle>
      ) : null}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Canvas.                                                                     */
/* -------------------------------------------------------------------------- */

export function ObjectLayerCanvas({
  backgroundImageAlt,
  backgroundImageUrl,
  dragMeasurement,
  haloRectPx,
  highlightedWallId,
  hoveredObjectId,
  isInteractive,
  layerVisibility,
  onAttachToNearestWall,
  onApprove,
  onChangeSubtype,
  onDelete,
  onFrameResize,
  onHover,
  onSelect,
  placements,
  selectedObjectId,
  surfaceRectPx,
  unitPx,
  viewBoxPx,
  wallOutlines,
}: ObjectLayerCanvasViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);

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

  const dataColors = visibleDataColorTokens(layerVisibility);
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
      className={OBJECT_CANVAS_FRAME_CLASSES}
      onMouseLeave={() => onHover(null)}
      ref={frameRef}
      role="group"
    >
      {/* Ảnh nền, `<svg>` và lớp phủ đứng ở pixel KHUNG do hook tính (BUG-403). */}
      <div className="absolute inset-0">
        {backgroundImageUrl === null ? (
          <div aria-hidden="true" className="absolute inset-0 bg-bg-sunken" />
        ) : (
          <img
            alt={backgroundImageAlt}
            className="pointer-events-none absolute block select-none opacity-20"
            draggable={false}
            src={backgroundImageUrl}
            style={
              surfaceRectPx === null
                ? undefined
                : {
                    height: surfaceRectPx.height,
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
        </svg>

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

      {placements.length === 0 ? (
        <p className="absolute inset-x-0 top-1/2 text-center text-[13px] text-text-muted">
          {OBJECT_CANVAS_TEXT.nothingToDraw}
        </p>
      ) : null}

      {/*
        Chú giải ba màu dữ liệu cộng tổng số đối tượng. Tổng lấy từ chính mảng
        `placements` chứ không từ một con số truyền riêng, nên "21 ở cả bốn nơi"
        không thể lệch: canvas đếm đúng cái nó vẽ.
      */}
      <div
        aria-label={OBJECT_CANVAS_TEXT.legendLabel}
        className="absolute bottom-4 left-4 flex flex-wrap items-center gap-3 whitespace-nowrap rounded-[8px] bg-bg-surface-90 px-3 py-2 shadow-panel"
      >
        {OBJECT_LAYER_IDS.filter((layer) => layerVisibility[layer]).map((layer) => (
          <span className="flex items-center gap-1.5 text-[12px] text-text-secondary" key={layer}>
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-sm border border-border-default-50"
              style={{ backgroundColor: OBJECT_LAYER_COLOR_TOKENS[layer] }}
            />
            {OBJECT_LAYER_LABELS[layer]}
          </span>
        ))}
        <span className="text-[12px] tabular-nums text-text-primary">
          {placements.length}
          <span className="text-text-secondary">{OBJECT_CANVAS_TEXT.objectCountSuffix}</span>
        </span>
        <span className="sr-only" data-testid={OBJECT_CANVAS_COLOR_COUNT_TEST_ID}>
          {dataColors.length}
        </span>
      </div>

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
