/**
 * Đường chia đôi của kiểu **Trượt**, và cách nó được kéo.
 *
 * Tách khỏi `OverlayComparisonCanvas.tsx` vì trần 400 dòng của R-22 — cùng lý do
 * với `OverlayComparisonCanvasLayers.tsx`, và cùng tiền tố `OverlayComparisonCanvas*`
 * để `index.ts` không phải khai thêm đường nhập nào.
 *
 * ## Vì sao đây là pointer handler viết tay chứ không phải `lib/input/dragDrop`
 *
 * `DragSession` (`src/lib/input/dragDrop.ts:68`) dành cho việc kéo **nội thất**
 * từ thư viện xuống mặt bằng: nó đi kèm `DragLibraryItem`, `FurnitureDropRequest`
 * và `validateDrop`, tức một điểm thả có thể **hợp lệ hoặc không**. Đường chia
 * đôi không có khái niệm thả hỏng — mọi vị trí trong khung đều hợp lệ, và cái
 * cần là một tỉ lệ liên tục chứ không phải một lượt thả. Ép nó vào `DragSession`
 * là mượn một mô hình sai; ba trình xử lý dưới đây là toàn bộ thứ cần.
 *
 * ## Bàn phím là đường đi hạng nhất (A12)
 *
 * Một tay cầm chỉ kéo được bằng chuột là một tay cầm không dùng được. Nên nó là
 * một `slider` thật: focus được, tự nói ra nó là gì, mũi tên trái/phải dịch từng
 * nhịp và `Home`/`End` đưa về hai biên.
 *
 * `aria-valuenow` mang thẳng tỉ lệ `0..1` chứ không phải phần trăm, vì đổi nó
 * thành "50%" là **định dạng một con số ở view** — đúng thứ A15 giao cho hook.
 * Thang `0..1` là thang thật của giá trị này, và `aria-valuemin`/`aria-valuemax`
 * nói rõ điều đó cho trình đọc màn hình.
 */

import { useCallback, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

import { cn } from '@/lib/utils';

/** Nhãn tiếng Việt, viết thường (A6) — khớp `vi.canvas.fragment.json`. */
const DIVIDER_ARIA_LABEL = 'đường chia đôi, dùng phím mũi tên trái và phải để dịch';

/** Tỉ lệ `0..1` sang phần trăm CSS. */
const PERCENT = 100;

/** Bề rộng vùng bắt của tay cầm, theo đặc tả. Nét nhìn thấy mảnh hơn nhiều. */
const HANDLE_HIT_WIDTH_PX = 32;

/** Một nhịp mũi tên dịch đường chia đôi bao nhiêu phần khung. */
const KEYBOARD_STEP_RATIO = 0.02;

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface OverlayComparisonCanvasDividerProps {
  readonly swipePosition: number;
  readonly isInteractive: boolean;
  /** Khung mà tỉ lệ được đo theo — cùng khung đang bị cắt làm đôi. */
  readonly frameRef: RefObject<HTMLDivElement | null>;
  /** Thời lượng nét to lên khi trỏ chuột, đã lấy từ `MOTION_DURATIONS_MS.instant`. */
  readonly hoverDuration: string;
  readonly onSetSwipePosition: (ratio: number) => void;
  /**
   * Báo lên trên rằng đang kéo, để lớp thị giác bỏ `clip-path` khỏi transition.
   *
   * Kéo là **trực tiếp**: đường chia đôi bám con trỏ từng khung hình, không lê
   * theo sau 340 ms. Cờ này là cách một quyết định về chuyển động của lớp cha
   * được lái từ nơi biết chuyện — chứ không phải một state bị nhân đôi.
   */
  readonly onDraggingChange: (isDragging: boolean) => void;
}

export function OverlayComparisonCanvasDivider({
  swipePosition,
  isInteractive,
  frameRef,
  hoverDuration,
  onSetSwipePosition,
  onDraggingChange,
}: OverlayComparisonCanvasDividerProps) {
  const [isDragging, setIsDragging] = useState(false);

  const ratioAtClientX = useCallback(
    (clientX: number): number | null => {
      const frame = frameRef.current;

      if (frame === null) {
        return null;
      }

      const bounds = frame.getBoundingClientRect();

      if (bounds.width === 0) {
        return null;
      }

      return clampRatio((clientX - bounds.left) / bounds.width);
    },
    [frameRef],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isInteractive) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      onDraggingChange(true);

      const ratio = ratioAtClientX(event.clientX);

      if (ratio !== null) {
        onSetSwipePosition(ratio);
      }
    },
    [isInteractive, onDraggingChange, onSetSwipePosition, ratioAtClientX],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isDragging) {
        return;
      }

      const ratio = ratioAtClientX(event.clientX);

      if (ratio !== null) {
        onSetSwipePosition(ratio);
      }
    },
    [isDragging, onSetSwipePosition, ratioAtClientX],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    onDraggingChange(false);
  }, [onDraggingChange]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isInteractive) {
        return;
      }

      const next =
        event.key === 'ArrowLeft'
          ? swipePosition - KEYBOARD_STEP_RATIO
          : event.key === 'ArrowRight'
            ? swipePosition + KEYBOARD_STEP_RATIO
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? 1
                : null;

      if (next === null) {
        return;
      }

      event.preventDefault();
      onSetSwipePosition(clampRatio(next));
    },
    [isInteractive, onSetSwipePosition, swipePosition],
  );

  return (
    <div
      aria-label={DIVIDER_ARIA_LABEL}
      aria-orientation="horizontal"
      aria-valuemax={1}
      aria-valuemin={0}
      aria-valuenow={swipePosition}
      className={cn(
        'group absolute inset-y-0 z-10 flex -translate-x-1/2 cursor-col-resize items-stretch justify-center',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
      )}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="slider"
      style={{ left: `${swipePosition * PERCENT}%`, width: `${HANDLE_HIT_WIDTH_PX}px` }}
      tabIndex={isInteractive ? 0 : -1}
    >
      <span
        className="w-[4px] bg-accent group-hover:w-[6px] group-focus-visible:w-[6px]"
        style={{ transitionDuration: hoverDuration, transitionProperty: 'width' }}
      />
    </div>
  );
}
