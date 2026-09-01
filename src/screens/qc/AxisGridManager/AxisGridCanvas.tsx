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
 * TRÌNH DUYỆT đổi qua `getScreenCTM().inverse()` — đúng khuôn
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
import { useCallback, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

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
/** Nét gạch-chấm 1px: gạch 8, hở 3, chấm 1, hở 3. */
const AXIS_DASH_ARRAY = '8 3 1 3';
const AXIS_BADGE_DIAMETER_PX = 24;
const AXIS_BADGE_RADIUS_PX = AXIS_BADGE_DIAMETER_PX / 2;
const AXIS_BADGE_STROKE_WIDTH_PX = 1;
/** Cỡ 13, chữ đều — đúng đặc tả "nhãn trục là chữ đều (tabular figures) cỡ 13". */
const AXIS_LABEL_FONT_SIZE_PX = 13;

const AXIS_TRANSITION_CLASSES = 'transition-colors duration-180 motion-reduce:transition-none';

/** Khung canvas: tối thiểu 640, bo 16, thụt 12 — đúng khuôn ba màn QC anh em. */
const CANVAS_FRAME_CLASSES =
  'relative min-h-[640px] w-full overflow-hidden rounded-[16px] border border-border-default bg-canvas-2d p-3';

/** `canvas.ariaLabel` của bảng đối chiếu S15-T4-copy.md. */
const CANVAS_ARIA_LABEL = 'Khung xem bản vẽ quản lý trục và gốc toạ độ';
const CANVAS_READ_ONLY_NOTICE_ID = 'axis-grid-canvas-read-only';

/* -------------------------------------------------------------------------- */
/* Một trục: đoạn thẳng nét gạch-chấm + hai bong bóng nhãn ở hai đầu.          */
/* -------------------------------------------------------------------------- */

interface AxisFigureProps {
  readonly axis: AxisCanvasAxisViewModel;
  readonly isInteractive: boolean;
  readonly onPointerDownAxis: (event: ReactPointerEvent<SVGGElement>, axisId: string) => void;
  readonly onSelect: (axisId: string) => void;
}

function AxisFigure({ axis, isInteractive, onPointerDownAxis, onSelect }: AxisFigureProps) {
  const token = axis.isHighlighted ? AXIS_HIGHLIGHT_TOKEN : AXIS_DEFAULT_TOKEN;

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
        strokeDasharray={AXIS_DASH_ARRAY}
        strokeWidth={AXIS_STROKE_WIDTH_PX}
        x1={axis.startPx.x}
        x2={axis.endPx.x}
        y1={axis.startPx.y}
        y2={axis.endPx.y}
      />
      {([
        ['start', axis.startPx],
        ['end', axis.endPx],
      ] as const).map(([end, point]) => (
        <g key={end} transform={`translate(${point.x} ${point.y})`}>
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
  const visibleAxes = canvas.axes.filter((axis) => axis.isVisible);

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

      onAxisDrag(draggingAxisId, axis.direction === 'horizontal' ? reading.y : reading.x);
    },
    [draggingAxisId, onAxisDrag, readPointer, visibleAxes],
  );

  const handleSvgPointerUp = useCallback(() => {
    setDraggingAxisId(null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    if (isInteractive) {
      onAxisSelect(null);
    }
  }, [isInteractive, onAxisSelect]);

  const viewBox = `${canvas.boundsPx.x} ${canvas.boundsPx.y} ${canvas.boundsPx.width} ${canvas.boundsPx.height}`;

  return (
    <div
      aria-describedby={isInteractive ? undefined : CANVAS_READ_ONLY_NOTICE_ID}
      aria-label={CANVAS_ARIA_LABEL}
      className={CANVAS_FRAME_CLASSES}
      role="group"
    >
      <svg
        aria-label={CANVAS_ARIA_LABEL}
        className="absolute inset-0 h-full w-full"
        onClick={handleBackgroundClick}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        role="img"
        viewBox={viewBox}
      >
        <AxisGridGhostFloor ghostFloors={canvas.ghostFloors} />

        {visibleAxes.map((axis) => (
          <AxisFigure
            axis={axis}
            isInteractive={isInteractive}
            key={axis.id}
            onPointerDownAxis={handlePointerDownAxis}
            onSelect={onAxisSelect}
          />
        ))}

        <AxisGridOriginMarker origin={canvas.origin} />
      </svg>

      {isInteractive ? null : (
        <p className="sr-only" id={CANVAS_READ_ONLY_NOTICE_ID}>
          {viewerRoleNotice}
        </p>
      )}
    </div>
  );
}
