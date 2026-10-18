import React from 'react';
import { Minus, Plus, Maximize2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useZoomCluster } from '../../hooks/useZoomCluster';

interface ZoomClusterProps {
  isVisible?: boolean;
  className?: string;
  /**
   * Mức thu phóng theo phần trăm, do người gọi làm chủ.
   *
   * Bỏ trống thì cụm tự giữ mức của nó như trước — mọi nơi gọi cũ không phải
   * đổi gì. Truyền vào thì cụm trở thành điều khiển có chủ, và màn là nơi giữ
   * trạng thái thật của khung nhìn.
   */
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitToScreen?: () => void;
}

/**
 * ZoomCluster — nút zoom nổi góc dưới phải.
 * Nền bg-surface, bóng shadow-float, bo-12.
 * Mờ 60% khi không hover.
 * Phần trăm mono bấm được để về 100%.
 */
export function ZoomCluster({
  isVisible = true,
  className,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
}: ZoomClusterProps) {
  // Hook vẫn chạy vô điều kiện (luật hook của React); props chỉ ĐÈ LÊN nó.
  const internal = useZoomCluster();

  const zoomIn = onZoomIn ?? internal.zoomIn;
  const zoomOut = onZoomOut ?? internal.zoomOut;
  const resetZoom = onResetZoom ?? internal.resetZoom;
  const fitToScreen = onFitToScreen ?? internal.fitToScreen;
  const zoomLabel = zoomLevel === undefined ? internal.zoomLabel : `${zoomLevel}%`;

  if (!isVisible) return null;

  const btnBase = cn(
    'flex items-center justify-center w-7 h-7 rounded-lg',
    'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
    'transition-colors duration-120',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
  );

  return (
    /* Wrapper vô hình mở rộng hover area */
    <div
      className={cn(
        'absolute bottom-0 right-0 z-20 pointer-events-none',
        // Ghost padding để hover dễ hơn; phải/dưới chỉ 16px (đúng lề): -m-10 cũ đẩy hộp 24px ra ngoài khung -> cuộn ngang ở 768.
        'pl-10 pt-10 pr-4 pb-4',
        'group',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center bg-bg-surface rounded-xl shadow-float px-2 py-1.5 gap-0.5',
          // G4b-05: bỏ mờ 60% khi không hover; nét bản vẽ (khung tên) hiện xuyên qua nút "+".
          'pointer-events-auto border border-border-default'
        )}
        role="group"
        aria-label="Cụm thu phóng"
      >
        {/* Thu nhỏ */}
        <button
          id="zoom-out-btn"
          onClick={zoomOut}
          className={btnBase}
          aria-label="Thu nhỏ"
          title="Thu nhỏ (−)"
        >
          <Minus size={14} strokeWidth={2} />
        </button>

        {/* Phần trăm — bấm để về 100% */}
        <button
          id="zoom-reset-btn"
          onClick={resetZoom}
          className={cn(
            'min-w-[52px] h-7 px-1 rounded-lg',
            'font-mono text-sm text-text-primary',
            'hover:bg-bg-hover transition-colors duration-120',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          )}
          aria-label={`Mức thu phóng ${zoomLabel}, bấm để về 100%`}
          title="Bấm để về 100%"
        >
          {zoomLabel}
        </button>

        {/* Phóng to */}
        <button
          id="zoom-in-btn"
          onClick={zoomIn}
          className={btnBase}
          aria-label="Phóng to"
          title="Phóng to (+)"
        >
          <Plus size={14} strokeWidth={2} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-border-default mx-1 shrink-0" aria-hidden="true" />

        {/* Vừa khung */}
        <button
          id="zoom-fit-btn"
          onClick={fitToScreen}
          className={btnBase}
          aria-label="Vừa khung nhìn"
          title="Vừa khung (F)"
        >
          <Maximize2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
