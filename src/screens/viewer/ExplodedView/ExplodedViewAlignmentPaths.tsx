/**
 * Đường nối dọc qua trọng tâm (kèm vạch cao độ ở mỗi tầng) và các đường dẫn
 * thẳng hàng chạy trên trục.
 *
 * View KHÔNG tự suy màu từ con số — chỉ đọc `path.tone` (A1, A15).
 *
 * ## Token màu thay `--data-axis`
 *
 * Đặc tả gốc ghi màu đường nối dọc là `--data-axis`. Token đó KHÔNG TỒN TẠI
 * trong `src/styles/globals.css` lẫn `tailwind.config.ts` (đã grep: không có
 * nhóm màu "data" nào) — đúng lỗ hổng `AxisGridCanvas.tsx:15-25` đã gặp và đã
 * được điều phối viên chốt trước đó: `--border-default` cho đường/nhãn trung
 * tính, giữ `--accent` chỉ cho thứ tương tác được hoặc đúng nghĩa "thẳng hàng"
 * (A2, A4). Đường nối dọc ở đây không tương tác nên dùng `--border-default`;
 * hai màu của `alignmentPaths` (`--accent`/`--state-attention`) đã có sẵn
 * trong hệ token, không cần thay.
 */
import { cn } from '@/lib/utils';

import { EXPLODED_LAYOUT } from './explodedViewTypes';
import type { ExplodedAlignmentPath, ExplodedElevationTick } from './explodedViewTypes';

export interface ExplodedViewAlignmentPathsProps {
  readonly ticks: readonly ExplodedElevationTick[];
  readonly alignmentPaths: readonly ExplodedAlignmentPath[];
}

export function ExplodedViewAlignmentPaths({ ticks, alignmentPaths }: ExplodedViewAlignmentPathsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border-default" />

      {ticks.map((tick) => (
        <div
          className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5"
          key={tick.storeyId}
          style={{ bottom: `${tick.fraction * 100}%` }}
        >
          <span aria-hidden="true" className="bg-border-default" style={{ height: 1, width: EXPLODED_LAYOUT.tickWidthPx }} />
          <span className="whitespace-nowrap text-[11px] leading-none text-text-muted">{tick.label}</span>
        </div>
      ))}

      {alignmentPaths.map((path) => (
        <div
          className={cn(
            'absolute inset-y-0 w-0 border-l border-dashed',
            path.tone === 'attention' ? 'border-state-attention' : 'border-accent',
          )}
          key={path.id}
          style={{ left: `${path.xFraction * 100}%` }}
        >
          {path.caption !== null && (
            <span className="absolute left-1.5 top-2 max-w-[220px] whitespace-normal text-[12px] leading-snug text-state-attention-text">
              {path.caption}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
