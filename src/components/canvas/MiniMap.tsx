import React from 'react';
import { cn } from '../../lib/utils';
import { useMiniMap, type ViewportRect } from '../../hooks/useMiniMap';

interface MiniMapProps {
  isVisible?: boolean;
  /** Nội dung bản vẽ thu nhỏ (SVG hoặc canvas) */
  children?: React.ReactNode;
  className?: string;
  /**
   * Khung nhìn ban đầu, theo phần trăm.
   *
   * Bỏ trống thì component tự giữ khung nhìn của nó như trước.
   */
  initialViewport?: Partial<ViewportRect>;
  /** Vùng nhìn do màn điều khiển (đi theo thu phóng); vắng thì component tự giữ như trước. */
  viewport?: ViewportRect;
  /**
   * Gọi mỗi khi người dùng kéo hoặc bấm để đổi vùng nhìn.
   *
   * Đây là đường DUY NHẤT để một màn biết minimap vừa được điều khiển; thiếu
   * nó thì nút bấm được nhưng không màn nào lái được khung nhìn theo.
   */
  onViewportChange?: (rect: ViewportRect) => void;
}

/** Sai số làm tròn phần trăm khi so khung nhìn với cả bản đồ. */
const WHOLE_MAP_EPSILON = 0.5;
const WHOLE_MAP_PERCENT = 100;

function coversWholeMap({ x, y, width, height }: ViewportRect): boolean {
  return (
    x <= WHOLE_MAP_EPSILON &&
    y <= WHOLE_MAP_EPSILON &&
    x + width >= WHOLE_MAP_PERCENT - WHOLE_MAP_EPSILON &&
    y + height >= WHOLE_MAP_PERCENT - WHOLE_MAP_EPSILON
  );
}

/**
 * MiniMap — 160×120, viền hairline, khung nhìn accent 1px.
 * Mờ 60% khi không hover.
 * Bấm để nhảy vùng (click-to-jump).
 */
export function MiniMap({
  isVisible = true,
  children,
  className,
  initialViewport,
  onViewportChange,
  viewport: controlledViewport,
}: MiniMapProps) {
  const {
    viewport,
    isDragging,
    isHovered,
    mapRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleClick,
    handleMouseEnter,
    handleMouseLeave,
    jumpToCentre,
  } = useMiniMap({
    // `exactOptionalPropertyTypes` bật, nên chỉ đặt khoá khi thật sự có giá trị;
    // truyền thẳng `undefined` là lỗi kiểu.
    ...(initialViewport === undefined ? {} : { initialViewport }),
    ...(onViewportChange === undefined ? {} : { onViewportChange }),
    ...(controlledViewport === undefined ? {} : { viewport: controlledViewport }),
  });

  // Khung nhìn đã phủ cả bản đồ (vd. "vừa khung") thì bản đồ nhỏ không có gì để chỉ đường,
  // chỉ đè lên mép bản vẽ: ẩn đi, phóng to là hiện lại.
  if (!isVisible || coversWholeMap(viewport)) return null;

  return (
    <div
      className={cn(
        'absolute top-4 right-4 z-20',
        // Mờ 60% khi không hover — dùng state từ hook (hover tracked trên div con)
        'transition-opacity duration-180',
        isHovered ? 'opacity-100' : 'opacity-60',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label="Bản đồ thu nhỏ"
      role="region"
    >
      {/* Map area: 160×120 cố định */}
      <div
        ref={mapRef}
        className={cn(
          'relative overflow-hidden',
          // Viền hairline
          'border border-border-default rounded-lg',
          // Nền nhẹ
          'bg-bg-sunken',
          isDragging ? 'cursor-grabbing' : 'cursor-pointer'
        )}
        style={{ width: 160, height: 120 }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Bấm để di chuyển vùng nhìn"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          // Bàn phím: Enter/Space để nhảy vào trung tâm
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            jumpToCentre();
          }
        }}
      >
        {/* Lưới nền nhỏ (không dùng inline style màu — dùng CSS var) */}
        <div 
          className="absolute inset-0 pointer-events-none border border-border-default-50" 
          aria-hidden="true" />

        {/* Nội dung bản vẽ (tuỳ chọn) */}
        {children && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {children}
          </div>
        )}

        {/* Khung nhìn: viền accent 1px */}
        <div
          className={cn(
            'absolute',
            'border border-accent',
            // Nền nhạt accent-wash với opacity rất thấp
            'bg-accent-wash-20',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          style={{
            left: `${viewport.x}%`,
            top: `${viewport.y}%`,
            width: `${viewport.width}%`,
            height: `${viewport.height}%`,
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
