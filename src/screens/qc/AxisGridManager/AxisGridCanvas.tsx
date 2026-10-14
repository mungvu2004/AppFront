/**
 * Canvas giữa của màn QC "Quản lý trục & căn tầng" — trục dò được vẽ nét
 * gạch-chấm, gốc toạ độ, và bóng ma tầng dưới chồng lên để đối chiếu.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng {@link AxisGridCanvasProps},
 * không `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`.
 * **Không một phép hình học nào ở đây** — hai đầu trục (`startPx`/`endPx`),
 * điểm gốc (`origin.pointPx`) và đường bao bóng ma (`ghostFloor.outlinePx`)
 * tới nơi ĐÃ TÍNH SẴN trong `AxisCanvasViewModel` (T3, `axisGridTypes.ts`,
 * đã đóng băng). Kéo trục (`onAxisDrag`) chỉ chuyển tiếp toạ độ pixel do
 * TRÌNH DUYỆT đổi qua `getScreenCTM().inverse()`, ĐÚNG MỘT lần lúc thả chuột —
 * trong lúc kéo canvas chỉ vẽ trục ở chỗ con trỏ, nên một lần kéo là một bước
 * hoàn tác chứ không phải một bước cho mỗi `pointermove` (BUG-595) — đúng khuôn
 * `WallLayerCanvas.tsx`'s `readPointer` — chọn trục X hay Y theo
 * `axis.direction` là đọc một trường có sẵn, không phải suy hình học.
 *
 * ## Token màu thay `--data-axis`
 *
 * Đặc tả gốc ghi màu trục là `--data-axis`. Token đó KHÔNG TỒN TẠI trong
 * `src/styles/globals.css` lẫn `tailwind.config.ts` (đã grep: không có nhóm
 * màu "data" nào, chỉ accent/bg/border/text/danger/state/wall/canvas/scene) —
 * đúng lỗ hổng `--data-dimension` mà `DimensionOcrCanvas.tsx:46` từng gặp.
 * Điều phối viên đã chốt (`orca orchestration ask`, 01-09-2026), đúng khuôn đó:
 * {@link AXIS_DEFAULT_TOKEN} (`--border-default`) cho trục/nhãn mặc định,
 * {@link AXIS_HIGHLIGHT_TOKEN} (`--accent`) CHỈ cho trục đang trỏ/chọn — nếu
 * MỌI trục đều `--accent` thì màu nhấn hết phân biệt được thứ gì tương tác
 * được (A2), đúng lý do A4 tồn tại để chặn màu thứ tư.
 *
 * `axis.isHighlighted` đã do hook tính (chọn HOẶC trỏ) — canvas chỉ đọc, không
 * tự giữ state chọn/hover nào; hợp đồng gốc (`AxisGridManagerProps`) cũng
 * không có `onAxisHover`, nên trục ở đây không có trạng thái hover riêng.
 *
 * Nhãn trục lặp ở CẢ HAI đầu đoạn (quy ước bản vẽ kiến trúc: bong bóng trục ở
 * hai đầu lưới, không riêng một đầu) — một lựa chọn trình bày cục bộ, không
 * phải một quyết định nghiệp vụ cần hỏi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import { fitCanvas } from './axisGridCanvasFit';
import { AxisGridGhostFloor } from './AxisGridGhostFloor';
import { AxisGridOriginMarker } from './AxisGridOriginMarker';
import type { AxisCanvasAxisViewModel, AxisCanvasViewModel } from './axisGridTypes';

/* -------------------------------------------------------------------------- */
/* Token màu — xem JSDoc đầu file.                                             */
/* -------------------------------------------------------------------------- */

const AXIS_DEFAULT_TOKEN = 'var(--border-default)';
const AXIS_HIGHLIGHT_TOKEN = 'var(--accent)';
const AXIS_BADGE_FILL_TOKEN = 'var(--bg-surface)';

/* -------------------------------------------------------------------------- */
/* Kích thước vẽ — hằng có tên, không rải số thô (R-71).                      */
/* -------------------------------------------------------------------------- */

const AXIS_STROKE_WIDTH_PX = 1;
/** Nét gạch-chấm 1px: gạch 8, hở 3, chấm 1, hở 3 (px màn). */
const AXIS_DASH_ARRAY = [8, 3, 1, 3];
const AXIS_BADGE_DIAMETER_PX = 24;
const AXIS_BADGE_RADIUS_PX = AXIS_BADGE_DIAMETER_PX / 2;
const AXIS_BADGE_STROKE_WIDTH_PX = 1;
/** Cỡ 13, chữ đều — đúng đặc tả "nhãn trục là chữ đều (tabular figures) cỡ 13". */
const AXIS_LABEL_FONT_SIZE_PX = 13;

/** BUG-404: bong bóng nằm NGOÀI đầu trục một khoảng (px màn) — không chồng lên nhau hay lên dấu gốc ở góc lưới. */
const AXIS_BADGE_OVERHANG_PX = AXIS_BADGE_RADIUS_PX + 8;
/** BUG-404: lề quanh lưới khi vừa khung (px màn) — đủ chỗ cho bong bóng, không bị mép khung cắt nửa. */
const FIT_MARGIN_PX = AXIS_BADGE_OVERHANG_PX + AXIS_BADGE_RADIUS_PX + 4;

const AXIS_TRANSITION_CLASSES = 'transition-colors duration-180 motion-reduce:transition-none';

/** Khung canvas: tối thiểu 640 từ 1280px, bo 16, thụt 12; dưới 1280 tối thiểu 60vh (như FIX-1506), dưới 1024 lấp vùng 360 px — BUG-317, BUG-404. */
const CANVAS_FRAME_CLASSES =
  'relative h-full min-h-[320px] w-full overflow-hidden rounded-[16px] border border-border-default p-3 lg:min-h-[60vh] xl:min-h-[640px]';
/** BUG-413: khung chưa có trục cùng nền chìm với khung bản vẽ trống của SCR-18/20; có trục thì là giấy vẽ. */
const CANVAS_EMPTY_BG = 'bg-bg-sunken';
const CANVAS_DRAWING_BG = 'bg-canvas-2d';

/** `canvas.ariaLabel` của bảng đối chiếu S15-T4-copy.md. */
const CANVAS_ARIA_LABEL = 'Khung xem bản vẽ quản lý trục và gốc toạ độ';
const CANVAS_READ_ONLY_NOTICE_ID = 'axis-grid-canvas-read-only';

/* -------------------------------------------------------------------------- */
/* Một trục: đoạn thẳng nét gạch-chấm + hai bong bóng nhãn ở hai đầu.          */
/* -------------------------------------------------------------------------- */

interface AxisFigureProps {
  readonly axis: AxisCanvasAxisViewModel;
  readonly isInteractive: boolean;
  readonly unit: number;
  /** Toạ độ con trỏ trong lúc kéo (y của trục ngang, x của trục dọc) — vẽ trục ở đó, chưa gửi lệnh. */
  readonly dragCoordinatePx: number | null;
  readonly onPointerDownAxis: (event: ReactPointerEvent<SVGGElement>, axisId: string) => void;
  readonly onSelect: (axisId: string) => void;
}

function AxisFigure({ axis, dragCoordinatePx, isInteractive, onPointerDownAxis, onSelect, unit }: AxisFigureProps) {
  const token = axis.isHighlighted ? AXIS_HIGHLIGHT_TOKEN : AXIS_DEFAULT_TOKEN;
  const overhang = AXIS_BADGE_OVERHANG_PX * unit;
  const isHorizontal = axis.direction === 'horizontal';
  const lineY = dragCoordinatePx ?? axis.startPx.y;
  const lineX = dragCoordinatePx ?? axis.startPx.x;
  const start = isHorizontal
    ? { x: axis.startPx.x - overhang, y: lineY }
    : { x: lineX, y: axis.startPx.y - overhang };
  const end = isHorizontal
    ? { x: axis.endPx.x + overhang, y: dragCoordinatePx ?? axis.endPx.y }
    : { x: dragCoordinatePx ?? axis.endPx.x, y: axis.endPx.y + overhang };

  const handleClick = useCallback(
    (event: ReactMouseEvent<SVGGElement>) => {
      event.stopPropagation();

      if (isInteractive) {
        onSelect(axis.id);
      }
    },
    [axis.id, isInteractive, onSelect],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGGElement>) => {
      event.stopPropagation();
      onPointerDownAxis(event, axis.id);
    },
    [axis.id, onPointerDownAxis],
  );

  return (
    <g
      aria-label={axis.label}
      className={
        isInteractive ? `cursor-move ${AXIS_TRANSITION_CLASSES}` : `pointer-events-none ${AXIS_TRANSITION_CLASSES}`
      }
      onClick={handleClick}
      onPointerDown={isInteractive ? handlePointerDown : undefined}
      role="presentation"
    >
      <line
        stroke={token}
        strokeDasharray={AXIS_DASH_ARRAY.map((dash) => dash * unit).join(' ')}
        strokeWidth={AXIS_STROKE_WIDTH_PX * unit}
        x1={start.x}
        x2={end.x}
        y1={start.y}
        y2={end.y}
      />
      {([
        ['start', start],
        ['end', end],
      ] as const).map(([key, point]) => (
        <g key={key} transform={`translate(${point.x} ${point.y}) scale(${unit})`}>
          <circle fill={AXIS_BADGE_FILL_TOKEN} r={AXIS_BADGE_RADIUS_PX} stroke={token} strokeWidth={AXIS_BADGE_STROKE_WIDTH_PX} />
          <text
            className="select-none tabular-nums"
            dominantBaseline="middle"
            fill={token}
            fontSize={AXIS_LABEL_FONT_SIZE_PX}
            textAnchor="middle"
          >
            {axis.label}
          </text>
        </g>
      ))}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Canvas.                                                                     */
/* -------------------------------------------------------------------------- */

export interface AxisGridCanvasProps {
  readonly canvas: AxisCanvasViewModel;
  readonly isInteractive: boolean;
  /** Đọc thẳng `AxisGridViewModel.viewerRoleNotice` — canvas không tự soạn câu (A15, R-69). */
  readonly viewerRoleNotice: string | null;
  readonly onAxisSelect: (axisId: string | null) => void;
  /** Kéo trục trên canvas tới toạ độ pixel mới; hook quy đổi mm và soát 100mm (Q3.1). */
  readonly onAxisDrag: (axisId: string, coordinatePx: number) => void;
}

export function AxisGridCanvas({ canvas, isInteractive, onAxisDrag, onAxisSelect, viewerRoleNotice }: AxisGridCanvasProps) {
  const [draggingAxisId, setDraggingAxisId] = useState<string | null>(null);
  const [dragCoordinatePx, setDragCoordinatePx] = useState<number | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  /* Lượt bấm bắt đầu trên một trục: pointer capture đẩy `click` sau đó về svg (G16). */
  const axisPressRef = useRef(false);
  const visibleAxes = canvas.axes.filter((axis) => axis.isVisible);

  useEffect(() => {
    const svg = svgRef.current;

    if (svg === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry !== undefined) {
        setFrame({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    observer.observe(svg);

    return () => observer.disconnect();
  }, []);

  /**
   * Toạ độ con trỏ — KHÔNG một phép tính nào ở đây, đúng khuôn
   * `WallLayerCanvas.tsx`'s `readPointer`. `getScreenCTM().inverse()` là ma
   * trận của chính `<svg>`; jsdom không cài hàm này nên nhánh `null` là đường
   * đi thật của bài kiểm, không phải một lối thoát phòng hờ.
   */
  const readPointer = useCallback((event: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } | null => {
    const matrix = event.currentTarget.getScreenCTM?.();

    if (matrix === null || matrix === undefined) {
      return null;
    }

    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());

    return { x: point.x, y: point.y };
  }, []);

  const handlePointerDownAxis = useCallback(
    (event: ReactPointerEvent<SVGGElement>, axisId: string) => {
      onAxisSelect(axisId);
      axisPressRef.current = true;
      setDraggingAxisId(axisId);
      event.currentTarget.ownerSVGElement?.setPointerCapture?.(event.pointerId);
    },
    [onAxisSelect],
  );

  const handleSvgPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (draggingAxisId === null) {
        return;
      }

      const axis = visibleAxes.find((candidate) => candidate.id === draggingAxisId);

      if (axis === undefined) {
        return;
      }

      const reading = readPointer(event);

      if (reading === null) {
        return;
      }

      setDragCoordinatePx(axis.direction === 'horizontal' ? reading.y : reading.x);
    },
    [draggingAxisId, readPointer, visibleAxes],
  );

  /* Thả chuột: ĐÚNG MỘT lượt `onAxisDrag` cho cả lần kéo (BUG-595). Bấm mà không kéo thì không gửi gì. */
  const handleSvgPointerUp = useCallback(() => {
    if (draggingAxisId !== null && dragCoordinatePx !== null) {
      onAxisDrag(draggingAxisId, dragCoordinatePx);
    }

    setDraggingAxisId(null);
    setDragCoordinatePx(null);
  }, [dragCoordinatePx, draggingAxisId, onAxisDrag]);

  const handleBackgroundClick = useCallback(() => {
    if (axisPressRef.current) {
      axisPressRef.current = false;

      return;
    }

    if (isInteractive) {
      onAxisSelect(null);
    }
  }, [isInteractive, onAxisSelect]);

  const fit = fitCanvas(canvas.boundsPx, frame, FIT_MARGIN_PX);

  return (
    <div
      aria-describedby={isInteractive ? undefined : CANVAS_READ_ONLY_NOTICE_ID}
      aria-label={CANVAS_ARIA_LABEL}
      className={`${CANVAS_FRAME_CLASSES} ${canvas.axes.length === 0 ? CANVAS_EMPTY_BG : CANVAS_DRAWING_BG}`}
      role="group"
    >
      <svg
        aria-label={CANVAS_ARIA_LABEL}
        className="absolute inset-0 h-full w-full"
        onClick={handleBackgroundClick}
        onPointerDown={() => {
          axisPressRef.current = false;
        }}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        ref={svgRef}
        role="img"
        viewBox={fit.viewBox}
      >
        <AxisGridGhostFloor ghostFloors={canvas.ghostFloors} unit={fit.unit} />

        {visibleAxes.map((axis) => (
          <AxisFigure
            axis={axis}
            dragCoordinatePx={axis.id === draggingAxisId ? dragCoordinatePx : null}
            isInteractive={isInteractive}
            key={axis.id}
            onPointerDownAxis={handlePointerDownAxis}
            onSelect={onAxisSelect}
            unit={fit.unit}
          />
        ))}

        {/* BUG-404: chưa có trục thì chưa có gốc toạ độ để chỉ — panel phải đã nói vậy. */}
        {canvas.axes.length === 0 ? null : <AxisGridOriginMarker origin={canvas.origin} unit={fit.unit} />}
      </svg>

      {isInteractive ? null : (
        <p className="sr-only" id={CANVAS_READ_ONLY_NOTICE_ID}>
          {viewerRoleNotice}
        </p>
      )}
    </div>
  );
}
