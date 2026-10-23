/**
 * Khung nhìn 3D: nền, mặt đất vô tận, đường chân trời, khe cắm cảnh, và nhãn
 * bám con trỏ.
 *
 * View thuần (R-60).
 *
 * ## Nền và vật liệu — thứ quyết định sản phẩm trông như bản vẽ hay như game
 *
 * Ba token, không mã màu nào (A1):
 *
 * - `--canvas-3d` (`#EDEBE6`) — nền khung nhìn,
 * - `--canvas-3d-ground` (`#E4E1DA`) — mặt đất vô tận,
 * - `--canvas-3d-horizon` (`#D9D5CD`) — đường chân trời, **1px đặc**.
 *
 * Ba mã màu ấy là đúng ba mã đặc tả ghi, và chúng đã có sẵn trong
 * `src/styles/globals.css:187-189` từ trước — vỏ không thêm token nào.
 *
 * Đường chân trời là `border-t` một pixel trên khối mặt đất, KHÔNG phải một
 * dải chuyển màu: đặc tả nói thẳng "không gradient trời", và một gradient là
 * thứ đầu tiên làm khung nhìn trông như game.
 *
 * ## Con trỏ: viền 1px ở 60% trong 120 ms
 *
 * 120 ms là `MOTION_DURATIONS_MS.instant` — lớp `duration-120` của Tailwind đọc
 * thẳng từ bảng ấy (`tailwind.config.ts`), nên không có con số nào viết tay và
 * `local/no-raw-duration` không có gì để bắt.
 */

import { useEffect, useRef, type ReactNode } from 'react';

import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import type {
  ViewerPointPx,
  ViewerSceneActions,
  ViewerSceneFrame,
  ViewerScreenState,
} from './viewerShellTypes';
import { VIEWER_LAYOUT } from './viewerShellTypes';

/** Nhãn nhỏ lệch khỏi đầu con trỏ chừng này để không nằm dưới chính nó. */
const HOVER_LABEL_OFFSET_PX = 12;

export interface ViewerViewportProps {
  readonly state: ViewerScreenState;
  readonly frame: ViewerSceneFrame;
  readonly renderScene?:
    | ((frame: ViewerSceneFrame, actions: ViewerSceneActions) => ReactNode)
    | undefined;
  readonly sceneActions: ViewerSceneActions;
  readonly onPointerMove: (point: ViewerPointPx, buttons: number) => void;
  readonly onPointerDown: (point: ViewerPointPx) => void;
  readonly onPointerUp: () => void;
  readonly onWheel: (notches: number) => void;
  readonly onDoubleClick: () => void;
  readonly hoverLabel: string | null;
  readonly hoverPointPx: ViewerPointPx | null;
  /** Lớp nổi neo vào bốn góc — vỏ dựng, khung nhìn chỉ đặt chỗ. */
  readonly children?: ReactNode;
}

/** Toạ độ con trỏ, quy về gốc toạ độ của chính khung nhìn. */
function pointOf(
  event: { clientX: number; clientY: number; currentTarget: Element },
): ViewerPointPx {
  const bounds = event.currentTarget.getBoundingClientRect();

  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

export function ViewerViewport({
  state,
  frame,
  renderScene,
  sceneActions,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onWheel,
  onDoubleClick,
  hoverLabel,
  hoverPointPx,
  children,
}: ViewerViewportProps) {
  const viewportRef = useRef<HTMLElement>(null);

  /* Dưới `lg` vỏ cuộn dọc, nên một nấc lăn trên mô hình vừa thu phóng vừa cuộn
     trang. `onWheel` của React gắn dạng passive, không chặn được — gắn listener
     gốc `passive: false` để thu phóng là việc DUY NHẤT nấc lăn làm (BUG-385). */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return undefined;
    }
    const listener = (event: WheelEvent): void => {
      event.preventDefault();
      onWheel(Math.sign(event.deltaY));
    };
    viewport.addEventListener('wheel', listener, { passive: false });

    return (): void => {
      viewport.removeEventListener('wheel', listener);
    };
  }, [onWheel]);

  return (
    <main
      /* Tín hiệu dương "cảnh chưa sẵn sàng" cho trình đọc màn hình và e2e
         (NO-386) — đi cùng skeleton bên dưới, cùng một điều kiện. */
      aria-busy={state === 'loading'}
      aria-label="Khung nhìn mô hình"
      className={cn(
        /* `touch-none`: kéo ngón để xoay không bị cuộn trang nuốt (`pointercancel`). */
        'relative min-w-0 flex-1 touch-none overflow-hidden bg-canvas-3d',
        /* Dưới `lg` vỏ cuộn dọc nên khung nhìn tự mang chiều cao; từ `lg` nó kéo
           theo dòng ba cột và giữ bề ngang tối thiểu cũ (BUG-369, BUG-385). */
        'h-[60vh] min-h-80 max-md:flex-none lg:h-auto lg:min-h-0 lg:min-w-[480px]',
        /* `tabIndex={-1}` cho phép lập trình đưa tiêu điểm vào khung nhìn (liên
           kết bỏ qua, và phím tắt phạm vi canvas). Đưa được tiêu điểm vào thì
           A12 đòi phải THẤY nó, nên viền tiêu điểm đi theo `focus-visible` của
           trình duyệt thay vì bị `outline-hidden` xoá đi. */
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app',
      )}
      onDoubleClick={onDoubleClick}
      onPointerDown={(event): void => {
        onPointerDown(pointOf(event));
      }}
      onPointerLeave={onPointerUp}
      onPointerMove={(event): void => {
        onPointerMove(pointOf(event), event.buttons);
      }}
      onPointerUp={onPointerUp}
      ref={viewportRef}
      style={{
        borderRadius: VIEWER_LAYOUT.viewportRadiusPx,
        margin: VIEWER_LAYOUT.viewportInsetPx,
      }}
      tabIndex={-1}
    >
      {/* ── Mặt đất vô tận + đường chân trời 1px đặc. Không gradient trời. ── */}
      <div aria-hidden="true" className="absolute inset-0 flex flex-col">
        <div className="flex-1" />
        <div className="h-1/2 border-t border-canvas-3d-horizon bg-canvas-3d-ground" />
      </div>

      {/* ── Cảnh của màn nội dung ─────────────────────────────────────────── */}
      {renderScene !== undefined && (
        <div className="absolute inset-0">{renderScene(frame, sceneActions)}</div>
      )}

      {/* ── Đang dựng ─────────────────────────────────────────────────────── */}
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <Skeleton className="h-full w-full" preset="canvas" />
        </div>
      )}

      {/* ── Nhãn nhỏ bám con trỏ ──────────────────────────────────────────── */}
      {hoverLabel !== null && hoverPointPx !== null && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-10 rounded-md px-2 py-1',
            'border border-accent bg-bg-surface text-[11px] leading-none text-text-primary',
            'opacity-60 transition-opacity duration-120',
          )}
          style={{
            left: hoverPointPx.x + HOVER_LABEL_OFFSET_PX,
            top: hoverPointPx.y + HOVER_LABEL_OFFSET_PX,
          }}
        >
          {hoverLabel}
        </span>
      )}

      {children}
    </main>
  );
}
