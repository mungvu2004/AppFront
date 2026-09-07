/**
 * Canvas đối chiếu của màn Đối chiếu bản vẽ — ba kiểu đặt nguồn cạnh kết quả,
 * ba lớp thị giác, một đường chia đôi kéo được, và bốn mốc chuyển động.
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng {@link OverlayComparisonCanvasProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`.
 * Hai phần con nằm ở file anh em — `OverlayComparisonCanvasLayers.tsx` (ba lớp
 * thị giác) và `OverlayComparisonCanvasDivider.tsx` (đường chia đôi kéo được).
 * Tách vì trần 400 dòng của R-22, không vì chúng dùng lại được ở đâu khác.
 *
 * ## Vì sao mọi toạ độ ở đây là tỉ lệ `0..1`
 *
 * View không import được `millimetres()`, nên nó không bao giờ gắn nhãn đơn vị
 * cho một con số. Nó đọc `event.clientX` ra tỉ lệ và nhận tỉ lệ để đặt vào
 * `style`. Hook là nơi duy nhất biết một tỉ lệ đáng bao nhiêu milimét. Phép nhân
 * với 100 dưới đây là phần trăm CSS, không phải quy đổi đơn vị.
 *
 * ## Camera: một `viewport` cho mọi khung
 *
 * `useCanvasViewport` không chia sẻ state giữa hai lượt gọi — mỗi lượt là một
 * `useState` riêng (`src/hooks/useCanvasViewport.ts:82-86`) — nên kiểu
 * `sideBySide` **không** đồng bộ được bằng cách gọi hook hai lần. Hook gọi nó
 * đúng một lần ở tầng cha; canvas chỉ đọc `viewport` và báo thay đổi ra ngoài
 * qua `onSetViewport`. Hai khung của `sideBySide` cùng đọc một giá trị nên chúng
 * kéo và thu phóng cùng nhau **theo cấu trúc**, không nhờ một lượt đồng bộ chạy
 * sau. Cú bay tới vùng lệch cũng đi đường đó: hook đổi `viewport`, và transition
 * `slow` dưới đây đưa khung tới nơi.
 *
 * Thu phóng bằng con lăn và kéo nền bằng nút giữa chuột tính vị trí mới ngay tại
 * chỗ này. Đó là toán học tương tác giao diện — cùng lý lẽ `ScaleCalibrationCanvas`
 * đã ghi — không phải phép quy đổi mm/px mà R-61 cấm view tự viết.
 *
 * ## Bốn mốc chuyển động, và không con số nào viết tay (R-71)
 *
 * | Việc | Thời lượng | Cách làm |
 * |---|---|---|
 * | kéo đường chia đôi | không hoạt cảnh | `transitionProperty` bỏ `clip-path` trong lúc kéo |
 * | tay cầm 4px → 6px khi trỏ chuột | `instant` 120 ms | `group-hover:w-[6px]`, xem file đường chia đôi |
 * | đổi kiểu đối chiếu, hoà tan | `slow` 340 ms | {@link CanvasDissolve} gắn lại theo `key={compareMode}` |
 * | bay tới vùng lệch được chọn | `slow` 340 ms | transition trên `transform` của mặt phẳng |
 * | vùng mới vượt ngưỡng | ba nhịp rồi tĩnh | `hasJustCrossedTolerance`, xem file lớp |
 *
 * Đặc tả nói 700 ms cho cú bay. `src/lib/motion/tokens.ts:80-87` giữ 700 ms **cố
 * ý** ngoài `MotionDurationName` — *"Nothing travels from one state to another at
 * it"* — và một cú bay camera **là** chuyển cảnh. Thứ tự ưu tiên
 * LUAT_MAN_HINH → RULE → CLAUDE → đặc tả buộc lấy `slow`; điều phối viên đã ghi
 * lại để sửa đặc tả.
 *
 * ## Hoà tan: vì sao gắn lại thay vì chồng hai cây
 *
 * `sideBySide` dựng **hai** khung còn hai kiểu kia dựng **một**, nên không có
 * cây DOM chung nào để CSS hoà tan giữa hai kiểu. `framer-motion` thì không được
 * nhập ngoài `src/components/motion` (`local/no-framer-outside-motion`). Nên lượt
 * hoà tan đi qua `useTransition('slow')` — cách dùng chung của kho — trong một
 * thành phần gắn lại theo `key={compareMode}`: bố cục mới hiện dần trong 340 ms.
 * Camera không đi theo, vì nó là `viewport` từ props chứ không phải state ở đây.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent, ReactNode, WheelEvent } from 'react';

import { MeasurementLabel } from '@/components/canvas/MeasurementLabel';
import type { ViewportState } from '@/hooks/useCanvasViewport';
import type { Point } from '@/hooks/useMeasurementLabel';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTransition } from '@/hooks/useTransition';
import { cssDurationMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { OverlayComparisonCanvasDivider } from './OverlayComparisonCanvasDivider';
import {
  DeviationLayer,
  GeometryLayer,
  ScanInkFilter,
  ScanLayer,
} from './OverlayComparisonCanvasLayers';
import type { OverlayComparisonCanvasProps } from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp nguyên văn vi.canvas.fragment.json (A6).       */
/* -------------------------------------------------------------------------- */

const CANVAS_ARIA_LABEL = 'khung đối chiếu bản vẽ và mô hình';
const SOURCE_FRAME_ARIA_LABEL = 'khung bản vẽ nguồn';
const RESULT_FRAME_ARIA_LABEL = 'khung mô hình sinh ra';

/* -------------------------------------------------------------------------- */
/* Hằng số hình học.                                                           */
/* -------------------------------------------------------------------------- */

/** Tỉ lệ `0..1` sang phần trăm CSS. */
const PERCENT = 100;

/** Bước thu phóng mỗi nấc lăn chuột, và hai biên của nó. */
const WHEEL_ZOOM_STEP = 1.1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

/** Nút giữa chuột, dùng để kéo nền — không đụng độ với kéo trái trên tay cầm. */
const MIDDLE_MOUSE_BUTTON = 1;

const FRAME_CLASSES =
  'relative h-full min-w-0 flex-1 overflow-hidden rounded-[12px] border border-border-default bg-canvas-2d';

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/* -------------------------------------------------------------------------- */
/* Hoà tan khi đổi kiểu đối chiếu.                                             */
/* -------------------------------------------------------------------------- */

/**
 * Bố cục mới hiện dần trong 340 ms.
 *
 * Gắn lại theo `key={compareMode}` ở nơi gọi, nên `useTransition` bắt đầu lại từ
 * 0 mỗi lần đổi kiểu. Dưới chế độ giảm chuyển động `value` là 1 ngay từ lượt
 * render đầu — một cú cắt, không phải một hoạt cảnh nhanh.
 */
function CanvasDissolve({ children }: { readonly children: ReactNode }) {
  const { value } = useTransition('slow', { easing: 'enter' });

  return (
    <div className="absolute inset-0 flex gap-3" style={{ opacity: value }}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Một khung, và mặt phẳng mang camera của nó.                                 */
/* -------------------------------------------------------------------------- */

interface ComparisonFrameProps {
  readonly ariaLabel: string;
  readonly viewport: ViewportState;
  readonly transitionDuration: string;
  /** Kéo nền là trực tiếp: trong lúc kéo, `transform` không có transition nào. */
  readonly isPanning: boolean;
  readonly frameRef?: (element: HTMLDivElement | null) => void;
  readonly planeRef?: (element: HTMLDivElement | null) => void;
  readonly children: ReactNode;
}

function ComparisonFrame({
  ariaLabel,
  viewport,
  transitionDuration,
  isPanning,
  frameRef,
  planeRef,
  children,
}: ComparisonFrameProps) {
  return (
    <div aria-label={ariaLabel} className={FRAME_CLASSES} ref={frameRef} role="group">
      <div
        className="absolute inset-0 origin-top-left"
        data-comparison-plane={ariaLabel}
        ref={planeRef}
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transitionDuration,
          transitionProperty: isPanning ? 'none' : 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Canvas.                                                                     */
/* -------------------------------------------------------------------------- */

export function OverlayComparisonCanvas({
  compareMode,
  layers,
  scanUrl,
  geometry,
  marks,
  measurement,
  swipePosition,
  viewport,
  isInteractive,
  onSetSwipePosition,
  onSetViewport,
  onSelectRegion,
}: OverlayComparisonCanvasProps) {
  const reducedMotion = useReducedMotion();
  // `useId` trả về dạng `:r0:`; hai dấu hai chấm đó không sống được trong một
  // `url(#…)` của CSS, nên chúng bị đổi trước khi id đi vào bộ lọc.
  const filterId = `overlay-scan-ink${useId().replace(/:/g, '-')}`;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const swipeFrameRef = useRef<HTMLDivElement | null>(null);
  const resultPlaneRef = useRef<HTMLDivElement | null>(null);

  const [planeSize, setPlaneSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  /* Đo mặt phẳng kết quả: `MeasurementLabel` nhận toạ độ PIXEL, không phải tỉ lệ. */
  useEffect(() => {
    const plane = resultPlaneRef.current;

    if (plane === null) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry !== undefined) {
        setPlaneSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    observer.observe(plane);

    return () => observer.disconnect();
  }, [compareMode]);

  /* ---------------------------------------------------------------------- */
  /* Camera — con lăn thu phóng, nút giữa kéo nền. Một viewport, mọi khung.  */
  /* ---------------------------------------------------------------------- */

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      const root = rootRef.current;

      if (root === null) {
        return;
      }

      event.preventDefault();

      const bounds = root.getBoundingClientRect();
      const anchorX = event.clientX - bounds.left;
      const anchorY = event.clientY - bounds.top;
      const zoom = clampZoom(viewport.zoom * (event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP));
      const ratio = zoom / viewport.zoom;

      onSetViewport({
        x: anchorX - (anchorX - viewport.x) * ratio,
        y: anchorY - (anchorY - viewport.y) * ratio,
        zoom,
      });
    },
    [onSetViewport, viewport],
  );

  const handleRootPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== MIDDLE_MOUSE_BUTTON) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }, []);

  const handleRootPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isPanning) {
        return;
      }

      onSetViewport({
        x: viewport.x + event.movementX,
        y: viewport.y + event.movementY,
        zoom: viewport.zoom,
      });
    },
    [isPanning, onSetViewport, viewport],
  );

  const handleRootPointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Dựng.                                                                  */
  /* ---------------------------------------------------------------------- */

  const slowDuration = cssDurationMs('slow', { reducedMotion });
  const instantDuration = cssDurationMs('instant', { reducedMotion });

  const isSwipe = compareMode === 'swipe';
  const isSideBySide = compareMode === 'sideBySide';

  const layerFrame = {
    transitionDuration: slowDuration,
    // Kéo đường chia đôi là trực tiếp: bỏ `clip-path` khỏi danh sách được hoạt
    // cảnh thì nó bám con trỏ từng khung hình, không lê theo sau 340 ms.
    transitionProperty: isDraggingDivider ? 'opacity' : 'opacity, clip-path',
  };

  const scanClipPath = isSwipe ? `inset(0 ${(1 - swipePosition) * PERCENT}% 0 0)` : undefined;
  const resultClipPath = isSwipe ? `inset(0 0 0 ${swipePosition * PERCENT}%)` : undefined;

  const scanLayer = (
    <ScanLayer
      clipPath={scanClipPath}
      filterId={filterId}
      layer={layers.scan}
      scanUrl={scanUrl}
      {...layerFrame}
    />
  );

  const resultLayers = (
    <>
      <GeometryLayer
        clipPath={resultClipPath}
        geometry={geometry}
        layer={layers.geometry}
        {...layerFrame}
      />
      <DeviationLayer
        clipPath={resultClipPath}
        isInteractive={isInteractive}
        layer={layers.deviation}
        marks={marks}
        onSelectRegion={onSelectRegion}
        pulseDuration={cssDurationMs('standard', { reducedMotion })}
        {...layerFrame}
      />
      {measurement === null || planeSize.width === 0 ? null : (
        <MeasurementLabel
          currentPoint={toPixels(measurement.to, planeSize)}
          distanceFormatted={measurement.valueText}
          midPoint={midpointOf(
            toPixels(measurement.from, planeSize),
            toPixels(measurement.to, planeSize),
          )}
          startPoint={toPixels(measurement.from, planeSize)}
          state="committed"
        />
      )}
    </>
  );

  return (
    <div
      aria-label={CANVAS_ARIA_LABEL}
      className={cn('relative h-full w-full', isPanning ? 'cursor-grabbing' : undefined)}
      onPointerDown={handleRootPointerDown}
      onPointerMove={handleRootPointerMove}
      onPointerUp={handleRootPointerUp}
      onWheel={handleWheel}
      ref={rootRef}
      role="group"
    >
      <ScanInkFilter id={filterId} />

      <CanvasDissolve key={compareMode}>
        {isSideBySide ? (
          <>
            <ComparisonFrame
              ariaLabel={SOURCE_FRAME_ARIA_LABEL}
              isPanning={isPanning}
              transitionDuration={slowDuration}
              viewport={viewport}
            >
              {scanLayer}
            </ComparisonFrame>
            <ComparisonFrame
              ariaLabel={RESULT_FRAME_ARIA_LABEL}
              isPanning={isPanning}
              planeRef={(element) => {
                resultPlaneRef.current = element;
              }}
              transitionDuration={slowDuration}
              viewport={viewport}
            >
              {resultLayers}
            </ComparisonFrame>
          </>
        ) : (
          <ComparisonFrame
            ariaLabel={CANVAS_ARIA_LABEL}
            frameRef={(element) => {
              swipeFrameRef.current = element;
            }}
            isPanning={isPanning}
            planeRef={(element) => {
              resultPlaneRef.current = element;
            }}
            transitionDuration={slowDuration}
            viewport={viewport}
          >
            {scanLayer}
            {resultLayers}
          </ComparisonFrame>
        )}

        {isSwipe ? (
          <OverlayComparisonCanvasDivider
            frameRef={swipeFrameRef}
            hoverDuration={instantDuration}
            isInteractive={isInteractive}
            onDraggingChange={setIsDraggingDivider}
            onSetSwipePosition={onSetSwipePosition}
            swipePosition={swipePosition}
          />
        ) : null}
      </CanvasDissolve>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tỉ lệ sang pixel — chỉ cho `MeasurementLabel`, thứ duy nhất đòi pixel.       */
/* -------------------------------------------------------------------------- */

interface PlaneSize {
  readonly width: number;
  readonly height: number;
}

function toPixels(point: { readonly x: number; readonly y: number }, size: PlaneSize): Point {
  return { x: point.x * size.width, y: point.y * size.height };
}

function midpointOf(from: Point, to: Point): Point {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}
