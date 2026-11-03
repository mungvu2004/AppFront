/**
 * Chú giải (demo Z/S-15 vòng 7–9, WRU-B) — mục "Chú giải" của panel phải khi chưa chọn gì (bố cục
 * hai panel, `docs/figma-layout-spec.md`; không còn nổi trên bản vẽ). Hiện khi lớp Tường bật, xếp dọc.
 *
 * Nhóm một: màu tường = bậc tin cậy (`WallThicknessSwatch`, cùng màu với bản vẽ) kèm số tường —
 * Máy chắc chắn · Máy khá chắc · Máy chưa chắc · Đã duyệt. Nhóm hai: các dải độ dày kèm số đoạn chờ duyệt;
 * Không chuẩn có mẫu sọc. CHỈ ĐỌC — không nút: lọc theo dải độ dày nằm trong "Lọc" của cột việc. Chữ "lệch
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

const TRAY = 'flex flex-col';
const GROUP_LABEL = 'Chú giải tường';
const NON_STANDARD_LABEL = 'Không chuẩn';
const ITEM = 'flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-body-sm text-text-primary';
const COUNT = 'ml-auto tabular-nums text-text-secondary';

export function WallLayerLegendTray({ isWallLayerVisible, shapes, state }: Props) {
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
      <div aria-busy="true" aria-label="Đang tải chú giải" className={cn(TRAY, 'gap-2 py-1')}>
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

  return (
    <div aria-label={GROUP_LABEL} className={TRAY} role="group" title={`Chuẩn: lệch không quá ${THICKNESS_TOLERANCE_MM} mm`}>
      <div className="flex flex-col">
        {[...counts.tiers].map(([tier, count]) => (
          <span className={ITEM} key={tier}>
            <WallThicknessSwatch kind={tier} />
            <span>{WALL_CONFIDENCE_TIER_TEXT[tier]}</span>
            <span className={COUNT}>{count}</span>
          </span>
        ))}
      </div>
      <div className="mt-1 flex flex-col border-t border-border-default pt-1">
        {[...counts.bands].map(([band, count]) => (
          <span className={ITEM} key={band}>
            <span className="tabular-nums">{WALL_THICKNESS_GROUP_LABELS[String(band)] ?? `${band} mm`}</span>
            <span className={COUNT}>{count}</span>
          </span>
        ))}
        {counts.unbanded > 0 ? (
          <span className={ITEM}>
            <WallThicknessSwatch kind="nonStandard" />
            <span>{NON_STANDARD_LABEL}</span>
            <span className={COUNT}>{counts.unbanded}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
