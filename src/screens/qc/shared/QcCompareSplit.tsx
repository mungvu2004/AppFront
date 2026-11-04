import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react';

import { useCanvasPan } from '@/components/canvas/useCanvasPan';
import { cn } from '@/lib/utils';

import { WallLayerTag } from '../WallLayerReview/WallLayerTag';
import type { WallTagView } from '../WallLayerReview/wallLayerHatch';

import { pointInFrame, rectInFrame } from './qcAsk';
import { placeCompareTag, useQcCompare } from './qcCompare';

/**
 * Chế độ "So sánh hai bên" (`qcCompare.ts`): trái là bản vẽ gốc rõ nét, phải là canvas đã nhận diện như cũ.
 *
 * Một khung nhìn cho cả hai: hai nửa cùng khổ, nên nửa trái đặt ảnh và viền chọn ở ĐÚNG toạ độ khung mà
 * hook của màn đã tính cho canvas phải — không tính lại gì. Kéo/lăn ở nửa trái đẩy cùng khung nhìn đó
 * (`onPanBy`, `onZoom`). Bấm ở nửa trái chọn mục nằm ở cùng chỗ bên phải: cú bấm chuyển sang hình ở đó
 * nên đi đúng đường chọn của canvas phải (`canvasShapeAt`); khi đang ở công cụ vẽ thì nửa trái chỉ để
 * xem (`canPick = false`). Luôn đặt cạnh nhau: dưới 1024 px panel chi tiết kéo lên che nửa dưới màn, xếp trên/dưới thì mất nửa đã nhận diện.
 *
 * Thẻ của mục đang chọn (`tag`) vẽ một chỗ ở cả hai nửa. Nửa trái ngoài viền và thẻ thì không tô gì.
 *
 * Tắt chế độ thì chỉ còn canvas phải; cây DOM giữ nguyên chỗ của nó để canvas không bị dựng lại.
 */
export interface QcCompareRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Thẻ của mục đang chọn/rê: `rect`, `anchorPx` cùng hệ toạ độ với `drawing`; vắng neo thì neo ở tâm `rect`. */
export interface QcCompareTag {
  readonly rect: QcCompareRect;
  readonly anchorPx?: { readonly x: number; readonly y: number };
  readonly text: string;
  readonly tier: WallTagView['tier'];
}

export interface QcCompareSplitProps {
  /** Ảnh bản vẽ gốc của nửa trái, đứng ở pixel khung (hoặc trong lớp phóng `layerView`). */
  readonly drawing: ReactNode;
  /** Vòng chọn của canvas phải, cùng hệ toạ độ với `drawing`; `null` khi chưa chọn gì. */
  readonly haloRect: QcCompareRect | null;
  /** Lớp phóng `translate(offset) scale(scale)` khi canvas phải phóng bằng CSS (Cửa và nội thất). */
  readonly layerView?: { readonly scale: number; readonly offset: { readonly x: number; readonly y: number } } | undefined;
  /** Nửa phải luôn hiện; nửa trái chỉ hiện khi đã chọn (`haloRect` khác `null`), rê chuột thì nửa trái vẫn sạch. */
  readonly tag?: QcCompareTag | null | undefined;
  readonly onPanBy: (dx: number, dy: number) => void;
  readonly onZoom: (direction: 1 | -1) => void;
  readonly canPick: boolean;
  /** Canvas phải. */
  readonly children: ReactNode;
}

export const COMPARE_LEFT_LABEL = 'Bản vẽ gốc';
export const COMPARE_RIGHT_LABEL = 'Đã nhận diện';

/** Cùng khung phẳng với canvas phải (viền trong suốt 1 px như nhau) để hai nửa đo ra cùng một khổ. */
const PANE_CLASSES = 'relative h-full w-full overflow-hidden border border-transparent bg-canvas-2d';
/* Dưới 1024: dưới hàng nút nổi (Việc, cặp nút bước), ở cả hai nửa. */
const CHIP_CLASSES =
  'pointer-events-none absolute left-3 top-3 max-lg:top-14 z-10 rounded-md bg-bg-surface px-2 py-1 text-caption text-text-secondary shadow-float';
/** Kéo quá chừng này (px) là kéo bản vẽ, không phải bấm. */
const CLICK_SLOP_PX = 4;
/** Nửa gốc không vẽ gì để nhắm: bấm lệch chừng này vẫn trúng nét gần nhất. */
const PICK_RADII_PX = [0, 3, 6];
const PICK_DIRECTIONS = 8;

/**
 * Hình của canvas phải tại điểm màn hình (trình duyệt tự dò hình học), trên cùng trước, từ tâm ra ngoài.
 * Chỉ nhận hình trong `<g>` của `<svg>`: đó là tường và ký hiệu có đường chọn; đa giác tường nền của
 * Cửa và nội thất, nút và icon nổi không tính.
 */
function canvasShapeAt(right: HTMLElement, x: number, y: number): { readonly shape: Element; readonly x: number; readonly y: number } | null {
  for (const radius of PICK_RADII_PX) {
    for (let step = 0; step < (radius === 0 ? 1 : PICK_DIRECTIONS); step += 1) {
      const angle = (step / PICK_DIRECTIONS) * Math.PI * 2;
      const at = { x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle) };
      const shape = document
        .elementsFromPoint(at.x, at.y)
        .find((el) => right.contains(el) && el.closest('svg g') !== null && el.closest('button') === null);

      if (shape !== undefined) return { shape, ...at };
    }
  }
  return null;
}

export function QcCompareSplit({ children, tag = null, ...pane }: QcCompareSplitProps) {
  const isOn = useQcCompare();
  const rightRef = useRef<HTMLDivElement | null>(null);
  const { haloRect, layerView } = pane;

  /* Khổ hộp đệm của nửa trái = của canvas phải (cùng viền, cùng ô lưới): một khung cho cả hai. */
  const [leftEl, setLeftEl] = useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<{ readonly width: number; readonly height: number } | null>(null);
  useEffect(() => {
    if (leftEl === null) return undefined;
    const read = () => setFrame({ width: leftEl.clientWidth, height: leftEl.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(leftEl);
    return () => observer.disconnect();
  }, [leftEl]);

  const view = layerView === undefined || frame === null ? null : { ...layerView, ...frame };
  const tagAnchor = tag === null ? null : (tag.anchorPx ?? { x: tag.rect.x + tag.rect.width / 2, y: tag.rect.y + tag.rect.height / 2 });
  const tagSpot =
    !isOn || tag === null || tagAnchor === null || frame === null
      ? null
      : view === null
        ? placeCompareTag(tag.rect, tagAnchor, frame, tag.text)
        : placeCompareTag(rectInFrame(tag.rect, view), pointInFrame(tagAnchor, view), frame, tag.text);
  const tagNode = tagSpot === null || tag === null ? null : <WallLayerTag {...tagSpot} text={tag.text} tier={tag.tier} />;
  const haloInFrame = haloRect === null || view === null ? haloRect : rectInFrame(haloRect, view);

  return (
    <div
      /* Lưới, không flex: flex chia cả phần viền 1 px chỉ nửa trái có ở thân, nên khung trái rộng hơn 2 px và lệch tâm phóng. */
      className={cn('h-full w-full gap-px', isOn ? 'grid grid-cols-2' : 'flex')}
      data-compare={isOn ? '' : undefined}
    >
      {isOn ? (
        <DrawingPane {...pane} haloRect={haloInFrame} onElement={setLeftEl} rightRef={rightRef}>
          {haloRect === null ? null : tagNode}
        </DrawingPane>
      ) : null}
      {/* Dưới 1024: bỏ chiều cao tối thiểu của canvas để hai nửa bằng nhau. */}
      <div
        className={cn('relative min-h-0 min-w-0 flex-1', isOn ? 'max-lg:[&>*]:!min-h-0' : undefined)}
        ref={rightRef}
      >
        {children}
        {isOn ? <span className={CHIP_CLASSES}>{COMPARE_RIGHT_LABEL}</span> : null}
        {/* `inset-px`: đúng hộp đệm của khung canvas (trong viền 1 px), hệ toạ độ của thẻ. */}
        {tagNode === null ? null : (
          <div className="pointer-events-none absolute inset-px z-10 overflow-hidden" data-testid="qc-compare-right-tag">
            {tagNode}
          </div>
        )}
      </div>
    </div>
  );
}

function DrawingPane({
  canPick,
  children,
  drawing,
  haloRect,
  layerView,
  onElement,
  onPanBy,
  onZoom,
  rightRef,
}: Omit<QcCompareSplitProps, 'tag'> & {
  readonly onElement: (element: HTMLDivElement | null) => void;
  readonly rightRef: RefObject<HTMLDivElement | null>;
}) {
  const pan = useCanvasPan(onZoom);
  const panRef = pan.ref;
  const setPaneEl = useCallback(
    (element: HTMLDivElement | null) => {
      panRef(element);
      onElement(element);
    },
    [onElement, panRef],
  );
  const lastOffsetRef = useRef(pan.offset);
  useEffect(() => {
    const previous = lastOffsetRef.current;
    lastOffsetRef.current = pan.offset;
    if (pan.offset.x !== previous.x || pan.offset.y !== previous.y) {
      onPanBy(pan.offset.x - previous.x, pan.offset.y - previous.y);
    }
  }, [onPanBy, pan.offset]);
  const downAtRef = useRef<{ x: number; y: number } | null>(null);

  /** Chuyển cú bấm sang hình ở đúng điểm đó của canvas phải: chọn như bấm thẳng bên ấy, không thêm đường nào. */
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
    const hit = canvasShapeAt(right, to.left + event.clientX - from.left, to.top + event.clientY - from.top);
    if (hit === null) return;
    hit.shape.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        clientX: hit.x,
        clientY: hit.y,
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
      ref={setPaneEl}
      role="img"
    >
      <div
        className="pointer-events-none absolute inset-0"
        data-testid="qc-compare-layer"
        style={layerView === undefined ? undefined : { transform: `translate(${layerView.offset.x}px, ${layerView.offset.y}px) scale(${layerView.scale})` }}
      >
        {drawing}
      </div>
      {/* Viền mảnh ngoài lớp phóng, pixel khung: không dày lên theo mức phóng. */}
      {haloRect === null ? null : (
        <div
          className="pointer-events-none absolute rounded-sm outline outline-[1.5px] outline-offset-2 outline-accent"
          data-testid="qc-compare-halo"
          style={{ height: haloRect.height, left: haloRect.x, top: haloRect.y, width: haloRect.width }}
        />
      )}
      {children}
      <span className={CHIP_CLASSES}>{COMPARE_LEFT_LABEL}</span>
    </div>
  );
}
