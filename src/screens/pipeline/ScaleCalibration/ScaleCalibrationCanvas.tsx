/**
 * Canvas giữa của màn Hiệu chỉnh tỷ lệ — bản vẽ đã nắn 3000×3000 px, thu
 * phóng được, nơi người dùng chọn một chuỗi kích thước OCR hoặc tự kéo một
 * đường tham chiếu để đặt tỷ lệ mm/px.
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng {@link ScaleCalibrationCanvasProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`.
 * Không có `ScaleCalibrationStatusBar.tsx` đi kèm — xem ghi chú "Vì sao không có
 * `ScaleCalibrationStatusBarProps`" ở đầu `types.ts`: thanh trạng thái tái sử
 * dụng `src/components/shell/StatusBar.tsx` có sẵn, dựng ở `ScaleCalibration.tsx`.
 *
 * ## Vì sao khung là hình vuông
 *
 * Ảnh gốc luôn là 3000×3000 px (hình vuông). Đặt khung theo `aspect-square`
 * thay vì để nó tự do theo khối cha khiến toạ độ tỉ lệ 0..1 ({@link ImageRatioPoint})
 * luôn khớp thẳng với phần trăm CSS của khung — không lệch mép, không cần đo
 * kích thước ảnh đã render để quy đổi ngược.
 *
 * ## Vì sao thu phóng/kéo nền không tính tỷ lệ
 *
 * `actions.onZoom` và `actions.onPan` chỉ mang số zoom màn hình và độ dịch con
 * trỏ trên màn — cùng lý lẽ với `handleWheel` của `CanvasIntegration.stories.tsx`.
 * Đây là toán học tương tác giao diện (zoom level), không phải phép quy đổi
 * mm/px của nghiệp vụ mà đặc tả cấm tự tính; hook nhận số này và tự kẹp biên.
 * Kéo nền dùng NÚT GIỮA CHUỘT — khớp `panningViewport` đã khai sẵn trong
 * `src/lib/input/cursors.ts` (khoảng trống dành cho "Space held hoặc pan gesture,
 * đứng yên") — để không đụng độ với kéo trái vẽ đường tham chiếu.
 *
 * ## Vì sao đo bằng ResizeObserver thay vì đọc `naturalWidth`
 *
 * {@link MeasurementLabel} và {@link SelectionHalo} nhận toạ độ PIXEL của lớp phủ,
 * không phải tỉ lệ — cùng khuôn `InputQualityGateImagePanel.ratioAt`, chiều
 * ngược lại. Khung luôn vuông nên một cặp bề rộng và bề cao đo một lần là đủ
 * quy đổi cho mọi điểm, không phải đo lại theo từng điểm.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { dimensionStrokeToken } from '@/components/canvas/materialMap';
import { MeasurementLabel } from '@/components/canvas/MeasurementLabel';
import { SelectionHalo } from '@/components/canvas/SelectionHalo';
import { Skeleton } from '@/components/feedback/Skeleton';
import type { MeasurementState, Point } from '@/hooks/useMeasurementLabel';
import { useSelectionHalo } from '@/hooks/useSelectionHalo';
import { cssDurationMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { CanvasNavigation, DimensionRowBox, ReferenceHandle } from './ScaleCalibrationCanvasControls';
import type {
  ImageRatioPoint,
  ReferenceLineEndpoint,
  ScaleCalibrationCanvasProps,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp nguyên văn i18n-keys.fragment.json (A6).       */
/* -------------------------------------------------------------------------- */

const CANVAS_ARIA_LABEL = 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu';
const FORBIDDEN_DESCRIPTION =
  'Bản vẽ vẫn xem và phóng to được, nhưng không kéo được đường tham chiếu. Nhờ người có quyền sửa dự án đặt tỷ lệ giúp.';
const FORBIDDEN_DESCRIPTION_ID = 'scale-calibration-canvas-forbidden';

/** Bước zoom mỗi nấc lăn chuột — số tương tác giao diện, không phải tỷ lệ mm/px. */
const WHEEL_ZOOM_STEP = 1.1;
/** Nút giữa chuột (button === 1), dùng để kéo nền thay vì vẽ. */
const MIDDLE_MOUSE_BUTTON = 1;
/** Sai số làm tròn toạ độ con trỏ so với mép khung: kéo đúng mép ảnh không được tính là "ra khỏi khung" (14-C-023). */
const EDGE_TOLERANCE_PX = 1;

/** Tâm khung ảnh — chỗ Enter trên canvas đặt đoạn mới khi không có chuột (BUG-607). */
const FRAME_CENTRE: ImageRatioPoint = { x: 0.5, y: 0.5 };

const FRAME_CLASSES =
  'relative aspect-square w-full overflow-hidden rounded-2xl border border-border-default bg-canvas-2d';

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function ScaleCalibrationCanvas({
  actions,
  canvas,
  prefersReducedMotion,
}: ScaleCalibrationCanvasProps) {
  const {
    onCancelDrag,
    onEndDrag,
    onFitView,
    onHoverDimensionRow,
    onMiniMapViewportChange,
    onMoveCursor,
    onMoveDrag,
    onNudgeEndpoint,
    onPan,
    onSelectDimensionRow,
    onStartDrag,
    onZoom,
    onZoomIn,
    onZoomOut,
  } = actions;

  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const halo = useSelectionHalo();
  const { select: haloSelect, hover: haloHover, deselect: haloDeselect } = halo;

  useEffect(() => {
    const content = contentRef.current;

    if (content === null) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry !== undefined) {
        setContentSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    observer.observe(content);

    return () => observer.disconnect();
    // Khung ảnh chỉ gắn khi skeleton đi: đo lại lúc ấy, không thì cỡ mãi 0 và nhãn đo trực tiếp không hiện (G51a).
  }, [canvas.isImageLoading]);

  useEffect(() => {
    if (canvas.selectedRowId !== null) {
      haloSelect();
    } else if (canvas.highlightedRowId !== null) {
      haloHover();
    } else {
      haloDeselect();
    }
  }, [canvas.selectedRowId, canvas.highlightedRowId, haloSelect, haloHover, haloDeselect]);

  const ratioAt = useCallback((clientX: number, clientY: number): ImageRatioPoint | null => {
    const content = contentRef.current;

    if (content === null) {
      return null;
    }

    const bounds = content.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) {
      return null;
    }

    return {
      x: clampRatio((clientX - bounds.left) / bounds.width),
      y: clampRatio((clientY - bounds.top) / bounds.height),
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button === MIDDLE_MOUSE_BUTTON) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsPanning(true);
        return;
      }

      if (!canvas.isInteractive || event.button !== 0) {
        return;
      }

      const point = ratioAt(event.clientX, event.clientY);

      if (point === null) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      onStartDrag(point);
    },
    [canvas.isInteractive, onStartDrag, ratioAt],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onMoveCursor(ratioAt(event.clientX, event.clientY));

      if (isPanning) {
        onPan(event.movementX, event.movementY);
        return;
      }

      if (!canvas.isInteractive || canvas.referenceLine === null || !canvas.referenceLine.isDragging) {
        return;
      }

      // Con trỏ đã được "bắt" nên trình duyệt không bắn pointerleave: tự phát hiện con trỏ ra khỏi khung ảnh và huỷ đoạn (14-A-014).
      const bounds = contentRef.current?.getBoundingClientRect();

      if (
        bounds !== undefined &&
        bounds.width > 0 &&
        (event.clientX < bounds.left - EDGE_TOLERANCE_PX ||
          event.clientX > bounds.right + EDGE_TOLERANCE_PX ||
          event.clientY < bounds.top - EDGE_TOLERANCE_PX ||
          event.clientY > bounds.bottom + EDGE_TOLERANCE_PX)
      ) {
        onCancelDrag();
        return;
      }

      const point = ratioAt(event.clientX, event.clientY);

      if (point !== null) {
        onMoveDrag(point, { isAxisLocked: event.shiftKey });
      }
    },
    [canvas.isInteractive, canvas.referenceLine, isPanning, onCancelDrag, onMoveCursor, onMoveDrag, onPan, ratioAt],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (isPanning) {
        setIsPanning(false);
        return;
      }

      if (!canvas.isInteractive) {
        return;
      }

      const point = ratioAt(event.clientX, event.clientY);

      if (point !== null) {
        onEndDrag(point);
      }
    },
    [canvas.isInteractive, isPanning, onEndDrag, ratioAt],
  );

  const handlePointerLeave = useCallback(() => {
    onMoveCursor(null);
    setIsPanning(false);

    if (canvas.isInteractive && canvas.referenceLine !== null && canvas.referenceLine.isDragging) {
      onCancelDrag();
    }
  }, [canvas.isInteractive, canvas.referenceLine, onCancelDrag, onMoveCursor]);

  const handleWheel = useCallback(
    (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
      onZoom(canvas.viewport.zoom * factor, ratioAt(event.clientX, event.clientY));
    },
    [canvas.viewport.zoom, onZoom, ratioAt],
  );

  // React gắn `onWheel` ở gốc cây với passive:true nên preventDefault không có tác dụng và trang cuộn theo (14-E-013): gắn trình nghe gốc không-passive.
  useEffect(() => {
    const frame = frameRef.current;

    if (frame === null) {
      return undefined;
    }

    frame.addEventListener('wheel', handleWheel, { passive: false });

    return () => frame.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleGrabEndpoint = useCallback(
    (endpoint: ReferenceLineEndpoint, clientX: number, clientY: number) => {
      onStartDrag(ratioAt(clientX, clientY) ?? canvas.referenceLine?.[endpoint] ?? FRAME_CENTRE, endpoint);
    },
    [canvas.referenceLine, onStartDrag, ratioAt],
  );

  /** Đường bàn phím (BUG-607): Enter trên khung khi chưa có đoạn → đoạn ở tâm, mũi tên dời đầu cuối. */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const isFrameEnter = event.key === 'Enter' && event.target === event.currentTarget;

      if (!isFrameEnter || !canvas.isInteractive || canvas.referenceLine !== null) {
        return;
      }

      event.preventDefault();
      onStartDrag(FRAME_CENTRE);
      onEndDrag(FRAME_CENTRE);
    },
    [canvas.isInteractive, canvas.referenceLine, onEndDrag, onStartDrag],
  );

  const viewportDuration = cssDurationMs('slow', { reducedMotion: prefersReducedMotion });

  const cursorClass = !canvas.isInteractive
    ? 'cursor-not-allowed'
    : isPanning || canvas.referenceLine?.isDragging === true
      ? 'cursor-grabbing'
      : 'cursor-crosshair';

  const activeRowId = canvas.selectedRowId ?? canvas.highlightedRowId;
  const activeRow = canvas.dimensionRows.find((row) => row.id === activeRowId) ?? null;
  const haloBox =
    activeRow !== null && contentSize.width > 0
      ? {
          x: activeRow.boundingBox.min.x * contentSize.width,
          y: activeRow.boundingBox.min.y * contentSize.height,
          width: (activeRow.boundingBox.max.x - activeRow.boundingBox.min.x) * contentSize.width,
          height: (activeRow.boundingBox.max.y - activeRow.boundingBox.min.y) * contentSize.height,
        }
      : null;

  const draft = canvas.referenceLine;
  const measurementState: MeasurementState =
    draft === null ? 'idle' : draft.isDragging ? 'measuring' : 'committed';
  const startPx: Point | null =
    draft !== null && contentSize.width > 0
      ? { x: draft.start.x * contentSize.width, y: draft.start.y * contentSize.height }
      : null;
  const currentPx: Point | null =
    draft !== null && contentSize.width > 0
      ? { x: draft.end.x * contentSize.width, y: draft.end.y * contentSize.height }
      : null;
  const midPx: Point | null =
    startPx !== null && currentPx !== null
      ? { x: (startPx.x + currentPx.x) / 2, y: (startPx.y + currentPx.y) / 2 }
      : null;
  const showLiveLabel = draft !== null && draft.isDragging && canvas.liveLengthLabel !== null && startPx !== null;

  return (
    <div
      aria-describedby={canvas.isInteractive ? undefined : FORBIDDEN_DESCRIPTION_ID}
      aria-label={CANVAS_ARIA_LABEL}
      className={cn(FRAME_CLASSES, cursorClass)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={frameRef}
      role="group"
      tabIndex={canvas.isInteractive ? 0 : undefined}
    >
      {canvas.isImageLoading ? (
        <Skeleton className="absolute inset-0" preset="canvas" />
      ) : (
        <div
          className="absolute inset-0 origin-top-left"
          ref={contentRef}
          style={{
            transform: `translate(${canvas.viewport.x}px, ${canvas.viewport.y}px) scale(${canvas.viewport.zoom})`,
            transitionDuration: viewportDuration,
            transitionProperty: 'transform',
          }}
        >
          {canvas.imageUrl !== null ? (
            <img
              alt={canvas.altText}
              className="pointer-events-none block h-full w-full select-none object-contain"
              draggable={false}
              src={canvas.imageUrl}
            />
          ) : null}

          {canvas.dimensionRows.map((row) => (
            <DimensionRowBox key={row.id} onHover={onHoverDimensionRow} onSelect={onSelectDimensionRow} row={row} />
          ))}

          {haloBox !== null ? (
            <SelectionHalo
              hasEntered={halo.hasEntered}
              height={haloBox.height}
              isVisible={halo.isVisible}
              variant={halo.variant}
              width={haloBox.width}
              x={haloBox.x}
              y={haloBox.y}
            />
          ) : null}

          {draft !== null ? (
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              <line
                stroke={dimensionStrokeToken()}
                strokeLinecap="round"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                x1={`${draft.start.x * 100}%`}
                x2={`${draft.end.x * 100}%`}
                y1={`${draft.start.y * 100}%`}
                y2={`${draft.end.y * 100}%`}
              />
            </svg>
          ) : null}

          {draft !== null && canvas.isInteractive ? (
            <>
              <ReferenceHandle
                endpoint="start"
                onGrab={handleGrabEndpoint}
                onNudge={onNudgeEndpoint}
                point={draft.start}
                zoom={canvas.viewport.zoom}
              />
              <ReferenceHandle
                endpoint="end"
                onGrab={handleGrabEndpoint}
                onNudge={onNudgeEndpoint}
                point={draft.end}
                zoom={canvas.viewport.zoom}
              />
            </>
          ) : null}

          {showLiveLabel ? (
            <MeasurementLabel
              currentPoint={currentPx}
              distanceFormatted={canvas.liveLengthLabel ?? ''}
              midPoint={midPx}
              startPoint={startPx}
              state={measurementState}
            />
          ) : null}
        </div>
      )}

      {!canvas.isInteractive ? (
        <p className="sr-only" id={FORBIDDEN_DESCRIPTION_ID}>
          {FORBIDDEN_DESCRIPTION}
        </p>
      ) : null}

      <CanvasNavigation
        miniMapViewport={canvas.miniMapViewport}
        onFitView={onFitView}
        onMiniMapViewportChange={onMiniMapViewportChange}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        zoomPercent={canvas.zoomPercent}
      />
    </div>
  );
}
