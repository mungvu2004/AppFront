import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';

import { useCanvasPan } from '@/components/canvas/useCanvasPan';
import { cn } from '@/lib/utils';

import { useQcCompare } from './qcCompare';

/**
 * Chế độ "So sánh hai bên" (`qcCompare.ts`): trái là bản vẽ gốc rõ nét, phải là canvas đã nhận diện như cũ.
 *
 * Một khung nhìn cho cả hai: hai nửa cùng khổ, nên nửa trái đặt ảnh và vòng chọn ở ĐÚNG toạ độ khung mà
 * hook của màn đã tính cho canvas phải — không tính lại gì. Kéo/lăn ở nửa trái đẩy cùng khung nhìn đó
 * (`onPanBy`, `onZoom`). Bấm ở nửa trái chọn mục nằm ở cùng chỗ bên phải (chuyển cú bấm sang đó); khi
 * đang ở công cụ vẽ thì nửa trái chỉ để xem (`canPick = false`). Dưới 1024 px hai nửa xếp trên/dưới.
 *
 * Tắt chế độ thì chỉ còn canvas phải; cây DOM giữ nguyên chỗ của nó để canvas không bị dựng lại.
 */
export interface QcCompareRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface QcCompareSplitProps {
  /** Ảnh bản vẽ gốc của nửa trái, đứng ở pixel khung (hoặc trong `layerTransform`). */
  readonly drawing: ReactNode;
  /** Vòng chọn của canvas phải, cùng hệ toạ độ với `drawing`; `null` khi chưa chọn gì. */
  readonly haloRect: QcCompareRect | null;
  /** `transform` của lớp phóng khi canvas phải phóng bằng CSS (Cửa và nội thất). */
  readonly layerTransform?: string | undefined;
  readonly onPanBy: (dx: number, dy: number) => void;
  readonly onZoom: (direction: 1 | -1) => void;
  readonly canPick: boolean;
  /** Canvas phải. */
  readonly children: ReactNode;
}

export const COMPARE_LEFT_LABEL = 'Bản vẽ gốc';
export const COMPARE_RIGHT_LABEL = 'Đã nhận diện';

/** Cùng khung với canvas phải (viền 1 px như nhau) để hai nửa đo ra cùng một khổ. */
const PANE_CLASSES =
  'relative h-full w-full overflow-hidden rounded-2xl border border-border-default bg-canvas-2d';
const CHIP_CLASSES =
  'pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-bg-surface px-2 py-1 text-caption text-text-secondary shadow-float';
/** Kéo quá chừng này (px) là kéo bản vẽ, không phải bấm. */
const CLICK_SLOP_PX = 4;

export function QcCompareSplit({ children, ...pane }: QcCompareSplitProps) {
  const isOn = useQcCompare();
  const rightRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      className={cn('flex h-full w-full gap-2', isOn ? 'flex-col lg:flex-row' : undefined)}
      data-compare={isOn ? '' : undefined}
    >
      {isOn ? <DrawingPane {...pane} rightRef={rightRef} /> : null}
      {/* Xếp dọc: bỏ chiều cao tối thiểu của canvas để hai nửa bằng nhau. */}
      <div
        className={cn(
          'relative min-h-0 min-w-0 flex-1',
          isOn ? 'max-lg:[&>*]:!min-h-0' : undefined,
        )}
        ref={rightRef}
      >
        {children}
        {isOn ? <span className={CHIP_CLASSES}>{COMPARE_RIGHT_LABEL}</span> : null}
      </div>
    </div>
  );
}

function DrawingPane({
  canPick,
  drawing,
  haloRect,
  layerTransform,
  onPanBy,
  onZoom,
  rightRef,
}: Omit<QcCompareSplitProps, 'children'> & {
  readonly rightRef: RefObject<HTMLDivElement | null>;
}) {
  const pan = useCanvasPan(onZoom);
  const lastOffsetRef = useRef(pan.offset);
  useEffect(() => {
    const previous = lastOffsetRef.current;
    lastOffsetRef.current = pan.offset;
    if (pan.offset.x !== previous.x || pan.offset.y !== previous.y) {
      onPanBy(pan.offset.x - previous.x, pan.offset.y - previous.y);
    }
  }, [onPanBy, pan.offset]);
  const downAtRef = useRef<{ x: number; y: number } | null>(null);

  /** Chuyển cú bấm sang đúng điểm đó của canvas phải — chọn như bấm thẳng bên ấy. Chỉ trúng hình vẽ (tường, ký hiệu), không trúng nền. */
  const pick = (event: MouseEvent<HTMLDivElement>) => {
    const down = downAtRef.current;
    const right = rightRef.current;
    if (
      !canPick ||
      right === null ||
      (down !== null && Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP_PX)
    ) {
      return;
    }
    const from = event.currentTarget.getBoundingClientRect();
    const to = right.getBoundingClientRect();
    const x = to.left + event.clientX - from.left;
    const y = to.top + event.clientY - from.top;
    const hit = document.elementFromPoint(x, y);
    const svg = hit?.closest('svg') ?? null;
    if (hit === null || svg === null || hit === svg || !right.contains(hit)) return;
    hit.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        clientX: x,
        clientY: y,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      }),
    );
  };

  return (
    <div
      aria-label={`${COMPARE_LEFT_LABEL} (để so sánh)`}
      className={cn(
        'relative min-h-0 min-w-0 flex-1',
        PANE_CLASSES,
        pan.surfaceClassName,
        pan.isPanning ? 'cursor-grabbing' : undefined,
      )}
      data-testid="qc-compare-left"
      onClick={pick}
      onLostPointerCapture={pan.handlers.onLostPointerCapture}
      onPointerCancel={pan.handlers.onPointerCancel}
      onPointerDown={(event) => {
        downAtRef.current = { x: event.clientX, y: event.clientY };
        pan.handlers.onPointerDown(event);
      }}
      onPointerMove={pan.handlers.onPointerMove}
      onPointerUp={pan.handlers.onPointerUp}
      ref={pan.ref}
      role="img"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={layerTransform === undefined ? undefined : { transform: layerTransform }}
      >
        {drawing}
        {haloRect === null ? null : (
          <>
            {/* Thước chữ thập qua tâm mục đang chọn: dóng sang nửa phải để so cùng một chỗ. */}
            <div
              className="absolute inset-x-0 h-px bg-accent opacity-40"
              style={{ top: haloRect.y + haloRect.height / 2 }}
            />
            <div
              className="absolute inset-y-0 w-px bg-accent opacity-40"
              style={{ left: haloRect.x + haloRect.width / 2 }}
            />
            <div
              className="absolute rounded-sm outline outline-2 outline-offset-2 outline-accent"
              data-testid="qc-compare-halo"
              style={{
                height: haloRect.height,
                left: haloRect.x,
                top: haloRect.y,
                width: haloRect.width,
              }}
            />
          </>
        )}
      </div>
      <span className={CHIP_CLASSES}>{COMPARE_LEFT_LABEL}</span>
    </div>
  );
}
