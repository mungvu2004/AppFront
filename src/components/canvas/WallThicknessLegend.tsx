import React from 'react';
import { cn } from '../../lib/utils';
import { wallStrokeToken } from './materialMap';
import {
  useWallThicknessLegend,
  WALL_THICKNESS_LEVELS,
} from '../../hooks/useWallThicknessLegend';
import type { WallThickness } from '../../types/spatial';

const LABEL_MAP: Record<string, string> = {
  '110': '110 mm',
  '220': '220 mm',
  '330': '330 mm',
  CONCRETE_COLUMN: 'Cột BTCT',
};

interface WallThicknessLegendProps {
  isVisible?: boolean;
  /** Trạng thái 7 chiều */
  state?: 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'no-permission' | 'collapsed';
  /** Cấp nào đang có dữ liệu (để hiển thị partial) */
  availableLevels?: WallThickness[];
  className?: string;
}

/**
 * WallThicknessLegend — chú giải 4 cấp độ dày tường.
 * Màu lấy từ materialMap. Ô màu tối đa 16×16.
 * Bấm để lọc (toggle).
 */
export function WallThicknessLegend({
  isVisible = true,
  state = 'success',
  availableLevels = WALL_THICKNESS_LEVELS,
  className,
}: WallThicknessLegendProps) {
  const { activeThickness, toggleThickness, clearFilter } = useWallThicknessLegend();

  // ── Trạng thái không hiện ──
  if (!isVisible || state === 'no-permission') return null;

  // ── Thu gọn ──
  if (state === 'collapsed') {
    return (
      <div
        className={cn(
          'absolute bottom-16 left-4 bg-bg-surface rounded-[12px] shadow-float p-2 z-10',
          className
        )}
        title="Chú giải độ dày tường"
        aria-label="Chú giải độ dày tường (thu gọn)"
      >
        <span className="font-mono text-xs text-text-muted leading-none">T</span>
      </div>
    );
  }

  // ── Đang tải ──
  if (state === 'loading') {
    return (
      <div
        className={cn(
          'absolute bottom-16 left-4 bg-bg-surface rounded-[12px] shadow-float p-3 z-10 flex flex-col gap-2',
          className
        )}
        aria-busy="true"
        aria-label="Đang tải chú giải"
      >
        {[...Array(4)].map((_, i) => (
          <div key={`wall-thickness-skeleton-${i}`} className="flex items-center gap-2 px-2 py-1">
            <div className="w-4 h-4 rounded-[4px] bg-bg-sunken animate-pulse" />
            <div className="w-16 h-3 rounded bg-bg-sunken animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // ── Lỗi ──
  if (state === 'error') {
    return (
      <div
        className={cn(
          'absolute bottom-16 left-4 bg-bg-surface rounded-[12px] shadow-float p-3 z-10',
          className
        )}
        role="alert"
      >
        <span className="font-mono text-xs text-state-violation-text leading-none">
          Không tải được chú giải
        </span>
      </div>
    );
  }

  // ── Rỗng ──
  if (state === 'empty') {
    return (
      <div
        className={cn(
          'absolute bottom-16 left-4 bg-bg-surface rounded-[12px] shadow-float p-3 z-10',
          className
        )}
      >
        <span className="font-mono text-xs text-text-muted leading-none">
          Chưa có dữ liệu tường
        </span>
      </div>
    );
  }

  // ── Thành công / Một phần ──
  const visibleLevels =
    state === 'partial' ? availableLevels : WALL_THICKNESS_LEVELS;
  const hasActiveFilter = activeThickness !== null;

  return (
    <div
      className={cn(
        'absolute bottom-16 left-4 bg-bg-surface rounded-[12px] shadow-float p-3 z-10 flex flex-col gap-1',
        className
      )}
      role="group"
      aria-label="Lọc theo độ dày tường"
    >
      {/* Header nhỏ */}
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="font-mono text-[10px] text-text-muted leading-none uppercase tracking-wide">
          Độ dày
        </span>
        {hasActiveFilter && (
          <button
            onClick={clearFilter}
            className="font-mono text-[10px] text-accent leading-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Xoá lọc"
          >
            xoá
          </button>
        )}
      </div>

      {visibleLevels.map((thickness) => {
        const key = String(thickness);
        const label = LABEL_MAP[key] ?? key;
        const tokenColor = wallStrokeToken(thickness);
        const isDimmed =
          activeThickness !== null && activeThickness !== thickness;
        const isActive = activeThickness === thickness;

        return (
          <button
            key={key}
            id={`legend-${key}`}
            onClick={() => toggleThickness(thickness)}
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded-md transition-colors duration-180',
              'hover:bg-bg-hover',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              isDimmed ? 'opacity-40' : 'opacity-100'
            )}
            aria-pressed={isActive}
            aria-label={`${isActive ? 'Đang lọc' : 'Lọc theo'} ${label}`}
          >
            {/* Ô màu: tối đa 16×16 */}
            <span
              className="shrink-0 rounded-[3px]"
              style={{
                width: 16,
                height: 16,
                backgroundColor: tokenColor,
              }}
              aria-hidden="true"
            />
            <span className="font-mono text-sm text-text-primary leading-none">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
