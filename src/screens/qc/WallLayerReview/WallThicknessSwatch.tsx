/**
 * Mẫu hình của một tường — CÙNG màu/hình với tường trên bản vẽ (`WallShapeFigure`): ô đặc theo
 * bậc tin cậy (`wallConfidenceToken`), chưa chắc thêm mép khắc màu nền như trên bản vẽ, đã duyệt nền xanh nhạt + viền + dấu tích, không chuẩn sọc
 * giấy + viền đậm (che chữ vẫn phân biệt được, demo Z/S-15 vòng 7).
 */

import { WALL_LOW_EDGE_CUT, wallConfidenceToken, type WallConfidenceTier } from '@/components/canvas/materialMap';

export type WallSwatchKind = WallConfidenceTier | 'nonStandard';

const W = 20;
const H = 12;

export function WallThicknessSwatch({ kind, className }: { readonly kind: WallSwatchKind; readonly className?: string }) {
  return (
    <svg aria-hidden="true" className={className} height={H} viewBox={`0 0 ${W} ${H}`} width={W}>
      {kind === 'nonStandard' ? (
        <>
          <rect fill="var(--wall-220)" height={H} width={W} />
          {[0, 6, 12, 18].map((x) => (
            <line key={x} stroke="var(--bg-surface)" strokeWidth={1.5} x1={x} x2={x + H} y1={H} y2={0} />
          ))}
          <rect fill="none" height={H - 2} stroke="var(--text-primary)" strokeWidth={2} width={W - 2} x={1} y={1} />
        </>
      ) : kind === 'reviewed' ? (
        <>
          <rect fill="var(--state-verified-tint)" height={H - 2} stroke="var(--state-verified)" strokeWidth={1.5} width={W - 2} x={1} y={1} />
          <path d="M6 6.5l2.5 2.5L14 3.5" fill="none" stroke="var(--state-verified-text)" strokeWidth={1.6} />
        </>
      ) : (
        /* Nét mép khắc nằm nửa ngoài khung svg (bị cắt) — còn đúng ~1 px khắc vào mép như trên bản vẽ. */
        <rect fill={wallConfidenceToken(kind)} height={H} width={W} {...(kind === 'needsReview' ? WALL_LOW_EDGE_CUT : null)} />
      )}
    </svg>
  );
}
