/**
 * Chú giải của canvas (demo Z/S-15 vòng 7–9, WRU-B) — LUÔN hiện khi lớp Tường bật, góc dưới trái.
 *
 * Hàng một: màu tường = bậc tin cậy (`WallThicknessSwatch`, cùng màu với bản vẽ) kèm số tường —
 * Máy chắc chắn · Máy khá chắc · Máy chưa chắc · Đã duyệt. Hàng hai: các dải độ dày là nút lọc chữ
 * (bấm lại để bỏ lọc), cùng tên nhóm "Lọc theo độ dày tường"; Không chuẩn có mẫu sọc. Chữ "lệch
 * không quá … mm" đọc từ hằng domain (không gõ số).
 */

import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { WallLayerCanvasViewProps } from './wallLayerHatch';
import {
  countWallBands,
  THICKNESS_TOLERANCE_MM,
  WALL_CONFIDENCE_LEGEND_TIERS,
  WALL_CONFIDENCE_TIER_TEXT,
  WALL_THICKNESS_GROUP_LABELS,
} from './wallLayerHatch';
import { WallThicknessSwatch } from './WallThicknessSwatch';

type Props = Pick<WallLayerCanvasViewProps, 'isWallLayerVisible' | 'legendLevels' | 'shapes' | 'state'>;

const TRAY = 'absolute bottom-16 left-4 z-10 rounded-xl bg-bg-surface p-3 shadow-float';
const GROUP_LABEL = 'Lọc theo độ dày tường';
const NON_STANDARD_LABEL = 'Không chuẩn';
const CLEAR_LABEL = 'Xoá lọc';
const ITEM = 'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-text-primary';

export function WallLayerLegendTray({ isWallLayerVisible, legendLevels, shapes, state }: Props) {
  const counts = useMemo(() => {
    const pending = shapes.filter((shape) => !shape.isReviewed);
    const tiers = new Map(WALL_CONFIDENCE_LEGEND_TIERS.map((tier) => [tier, shapes.filter((shape) => shape.confidenceTier === tier).length]));

    return { ...countWallBands(pending.map((shape) => shape.thicknessMm)), tiers };
  }, [shapes]);

  if (!isWallLayerVisible) {
    return null;
  }

  if (state === 'loading') {
    return (
      <div aria-busy="true" aria-label="Đang tải chú giải" className={cn(TRAY, 'flex gap-2')}>
        {[0, 1, 2].map((index) => (
          <div className="h-3 w-16 animate-pulse rounded-sm bg-border-default" key={index} />
        ))}
      </div>
    );
  }

  if (state === 'error' || state === 'empty') {
    return (
      <div className={TRAY} role={state === 'error' ? 'alert' : undefined}>
        <span className="text-caption text-text-secondary">{state === 'error' ? 'Không tải được chú giải' : 'Chưa có dữ liệu tường'}</span>
      </div>
    );
  }

  const { activeFilter, onFilterChange } = legendLevels;

  return (
    <div aria-label={GROUP_LABEL} className={cn(TRAY, "max-w-[calc(100%-2rem)] p-1.5")} role="group" title={`Chuẩn: lệch không quá ${THICKNESS_TOLERANCE_MM} mm`}>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {[...counts.tiers].map(([tier, count]) => (
          <span className={ITEM} key={tier}>
            <WallThicknessSwatch kind={tier} />
            <span>{WALL_CONFIDENCE_TIER_TEXT[tier]}</span>
            <span className="tabular-nums text-text-secondary">{count}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 border-t border-border-default pt-0.5">
        {[...counts.bands].map(([band, count]) => {
          const isActive = activeFilter === band;
          const label = WALL_THICKNESS_GROUP_LABELS[String(band)] ?? `${band} mm`;

          return (
            <button
              aria-label={`${isActive ? 'Đang lọc' : 'Lọc theo'} ${label}`}
              aria-pressed={isActive}
              className={cn(
                ITEM,
                'transition-colors duration-180 hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isActive && 'bg-accent-wash',
                activeFilter != null && !isActive && 'opacity-60',
              )}
              key={band}
              onClick={() => onFilterChange?.(isActive ? null : band)}
              type="button"
            >
              <span className="tabular-nums">{label}</span>
              <span className="tabular-nums text-text-secondary">{count}</span>
            </button>
          );
        })}
        {counts.unbanded > 0 ? (
          <span className={ITEM}>
            <WallThicknessSwatch kind="nonStandard" />
            <span>{NON_STANDARD_LABEL}</span>
            <span className="tabular-nums text-text-secondary">{counts.unbanded}</span>
          </span>
        ) : null}
        {activeFilter == null ? null : (
          <button
            className="rounded-md px-1.5 py-1 text-caption text-accent hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onFilterChange?.(null)}
            type="button"
          >
            {CLEAR_LABEL}
          </button>
        )}
      </div>
    </div>
  );
}
