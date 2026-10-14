/**
 * Hai mảnh tương tác nằm TRÊN canvas Hiệu chỉnh tỷ lệ, tách khỏi `ScaleCalibrationCanvas.tsx` cho
 * file đó dưới trần 400 dòng (R-22): tay cầm hai đầu đoạn tham chiếu, và cụm thu phóng + bản đồ nhỏ.
 * View thuần — mọi thứ vào bằng props.
 *
 * ## Vì sao tay nắm bù ngược zoom
 *
 * Tay nắm nằm trong cùng lớp nhận `transform: scale(zoom)` để vị trí của nó luôn
 * khớp đúng điểm tỉ lệ đang bám theo khi kéo/phóng; `scale(1 / zoom)` cục bộ giữ
 * đường kính 10px không đổi trên màn hình dù khung nhìn phóng to bao nhiêu — nét
 * 2px của chính đoạn thẳng dùng `vector-effect="non-scaling-stroke"` cho cùng lý do.
 */

import type { SyntheticEvent } from 'react';

import { MiniMap } from '@/components/canvas/MiniMap';
import { ZoomCluster } from '@/components/canvas/ZoomCluster';

import type {
  ImageRatioPoint,
  NudgeDirection,
  ReferenceLineEndpoint,
  ScaleCalibrationCanvasProps,
  ScaleCanvasViewModel,
} from './types';

type CanvasActions = ScaleCalibrationCanvasProps['actions'];

const HANDLE_ARIA_LABEL: Readonly<Record<ReferenceLineEndpoint, string>> = {
  start: 'Đầu đoạn tham chiếu, dùng phím mũi tên để nhích',
  end: 'Cuối đoạn tham chiếu, dùng phím mũi tên để nhích',
};
const ARROW_DIRECTIONS: Readonly<Record<string, NudgeDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

interface ReferenceHandleProps {
  readonly endpoint: ReferenceLineEndpoint;
  readonly point: ImageRatioPoint;
  readonly zoom: number;
  /** Nhấn tay cầm — kèm toạ độ con trỏ, để đầu đoạn đi theo quãng con trỏ đi chứ không nhảy tới nó (G51b). */
  readonly onGrab: (endpoint: ReferenceLineEndpoint, clientX: number, clientY: number) => void;
  readonly onNudge: CanvasActions['onNudgeEndpoint'];
}

/**
 * Tay cầm một đầu đoạn. Vùng bấm 24 px (WCAG 2.5.8), chấm thấy được vẫn 10 px. Nhấn = kéo ĐÚNG đầu
 * này; mũi tên khi đang focus = nhích ĐÚNG đầu này (BUG-587). `preventDefault` báo cho
 * `shortcutRegistry` là phím đã có chủ, nên phím nhích chung của canvas không chạy lần hai.
 */
export function ReferenceHandle({ endpoint, onGrab, onNudge, point, zoom }: ReferenceHandleProps) {
  return (
    <button
      aria-label={HANDLE_ARIA_LABEL[endpoint]}
      className="absolute flex h-6 w-6 items-center justify-center rounded-full"
      onKeyDown={(event) => {
        const direction = ARROW_DIRECTIONS[event.key];

        if (direction !== undefined) {
          event.preventDefault();
          onNudge(endpoint, direction, event.shiftKey ? 'coarse' : 'fine');
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onGrab(endpoint, event.clientX, event.clientY);
      }}
      style={{
        left: `${point.x * 100}%`,
        top: `${point.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
      }}
      type="button"
    >
      <span aria-hidden="true" className="h-[10px] w-[10px] rounded-full border-2 border-accent bg-white" />
    </button>
  );
}

/** Nhấn lên cụm thu phóng hay bản đồ nhỏ không được nổi lên canvas mà vẽ đoạn mới (BUG-596). */
function stopAtOverlay(event: SyntheticEvent): void {
  event.stopPropagation();
}

interface CanvasNavigationProps {
  readonly zoomPercent: number;
  readonly miniMapViewport: ScaleCanvasViewModel['miniMapViewport'];
  readonly onZoomIn: CanvasActions['onZoomIn'];
  readonly onZoomOut: CanvasActions['onZoomOut'];
  readonly onFitView: CanvasActions['onFitView'];
  readonly onMiniMapViewportChange: CanvasActions['onMiniMapViewportChange'];
}

/** Cụm thu phóng và bản đồ nhỏ, nối vào khung nhìn của màn — trước đây là hai điều khiển chết (BUG-596). */
export function CanvasNavigation({
  miniMapViewport,
  onFitView,
  onMiniMapViewportChange,
  onZoomIn,
  onZoomOut,
  zoomPercent,
}: CanvasNavigationProps) {
  return (
    <div className="contents" onPointerDown={stopAtOverlay} onPointerUp={stopAtOverlay}>
      {/* Ở màn này 100% CHÍNH LÀ vừa khung (ảnh vuông trong khung vuông), nên hai nút cùng một việc. */}
      <ZoomCluster
        onFitToScreen={onFitView}
        onResetZoom={onFitView}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        zoomLevel={zoomPercent}
      />
      <MiniMap onViewportChange={onMiniMapViewportChange} viewport={miniMapViewport} />
    </div>
  );
}
