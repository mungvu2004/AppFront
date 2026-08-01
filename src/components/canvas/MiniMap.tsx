import React from 'react';
import { cn } from '../../lib/utils';
import { useMiniMap } from '../../hooks/useMiniMap';

interface MiniMapProps {
  isVisible?: boolean;
  /** Nội dung bản vẽ thu nhỏ (SVG hoặc canvas) */
  children?: React.ReactNode;
  className?: string;
}

/**
 * MiniMap — 160×120, viền hairline, khung nhìn accent 1px.
 * Mờ 60% khi không hover.
 * Bấm để nhảy vùng (click-to-jump).
 */
export function MiniMap({ isVisible = true, children, className }: MiniMapProps) {
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
  } = useMiniMap();

  if (!isVisible) return null;

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
          'border border-border-default rounded-[8px]',
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
            // Nhảy về trung tâm
          }
        }}
      >
        {/* Lưới nền nhỏ (không dùng inline style màu — dùng CSS var) */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: [
              `linear-gradient(to right, var(--border-default) 1px, transparent 1px)`,
              `linear-gradient(to bottom, var(--border-default) 1px, transparent 1px)`,
            ].join(', '),
            backgroundSize: '20px 20px',
          }}
          aria-hidden="true"
        />

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
            'bg-accent-wash/20',
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
