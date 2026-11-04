/**
 * Chuột trên khung vẽ của màn Duyệt tường: phân biệt bấm, kéo-để-vẽ và kéo nền.
 *
 * Đang ở công cụ Vẽ tường (`onWallDrawPress` khác rỗng): chuột trái trên bản vẽ là nét vẽ, không kéo
 * nền. Nhấn khi chưa có điểm đầu thì nét bắt đầu ngay để kéo có xem trước; thả sau khi kéo quá
 * {@link WALL_DRAW_DRAG_PX} là điểm cuối; kéo ít hơn là một cú bấm, để `click` lo. Space + trái và
 * chuột giữa vẫn đi đường kéo nền của `useCanvasPan`.
 */

import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';

import type { CanvasPanState } from '@/components/canvas/useCanvasPan';

import { drawingPointOf } from './wallLayerCanvasActions';
import type { WallLayerPointerReading } from './wallLayerHatch';

const WALL_DRAW_DRAG_PX = 8;
/** Công cụ khác: lệch quá ngần này là cú kéo nền, `click` theo sau bị bỏ. */
const CLICK_SLOP_PX = 4;

const movedFrom = (downAt: { readonly x: number; readonly y: number }, event: { readonly clientX: number; readonly clientY: number }): number =>
  Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);

export function useWallDrawPointer(options: {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly pan: CanvasPanState;
  readonly isInteractive: boolean;
  readonly onCanvasPoint: (at: WallLayerPointerReading) => void;
  readonly onWallDrawPress: ((at: WallLayerPointerReading) => boolean) | null;
}) {
  const { svgRef, pan, isInteractive, onCanvasPoint, onWallDrawPress } = options;
  const downAtRef = useRef<{ x: number; y: number } | null>(null);
  /* 'start': lượt nhấn đã là điểm đầu. 'end': đang chờ điểm cuối. 'done': `click` theo sau không còn gì để làm. */
  const pressRef = useRef<'start' | 'end' | 'done' | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    downAtRef.current = { x: event.clientX, y: event.clientY };
    pressRef.current = null;

    if (onWallDrawPress !== null && isInteractive && event.button === 0) {
      const svg = svgRef.current;

      if (pan.spaceHeld) {
        pressRef.current = 'done';
      } else if (svg !== null && (event.target === event.currentTarget || svg.contains(event.target as Node))) {
        const reading = drawingPointOf(svg, event.clientX, event.clientY);

        pressRef.current = reading !== null && onWallDrawPress(reading) ? 'start' : 'end';

        return;
      }
    }

    pan.handlers.onPointerDown(event);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pan.handlers.onPointerUp(event);

    const press = pressRef.current;
    const downAt = downAtRef.current;
    const svg = svgRef.current;

    if ((press !== 'start' && press !== 'end') || event.button !== 0 || downAt === null || svg === null) {
      return;
    }

    if (movedFrom(downAt, event) > WALL_DRAW_DRAG_PX) {
      const reading = drawingPointOf(svg, event.clientX, event.clientY);

      pressRef.current = 'done';

      if (reading !== null) {
        onCanvasPoint(reading);
      }
    }
  };

  /** `click` này đã được xử lý lúc nhấn/thả, hoặc thuộc về một cú kéo nền: bỏ qua. */
  const isClickConsumed = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): boolean => {
      if (onWallDrawPress !== null) {
        const press = pressRef.current;

        pressRef.current = null;

        return press === 'start' || press === 'done';
      }

      return downAtRef.current !== null && movedFrom(downAtRef.current, event) > CLICK_SLOP_PX;
    },
    [onWallDrawPress],
  );

  return { onPointerDown, onPointerUp, isClickConsumed };
}
