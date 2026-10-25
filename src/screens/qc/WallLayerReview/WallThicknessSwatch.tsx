/**
 * Mẫu hình của một mã độ dày — CÙNG hình với tường trên bản vẽ (`WallShapeFigure`), để che hết
 * chữ và chuyển đen trắng vẫn phân biệt được (demo Z/S-15 vòng 7): 110 rỗng, 220 đặc, 330 đặc
 * viền đôi, không chuẩn gạch chéo + viền đậm, đã duyệt nền xanh nhạt + viền + dấu tích.
 */

export type WallSwatchKind = 110 | 220 | 330 | 'nonStandard' | 'reviewed';

const W = 20;
const H = 12;

export function WallThicknessSwatch({ kind, className }: { readonly kind: WallSwatchKind; readonly className?: string }) {
  return (
    <svg aria-hidden="true" className={className} height={H} viewBox={`0 0 ${W} ${H}`} width={W}>
      {kind === 110 ? (
        <rect fill="var(--bg-surface)" height={H - 2} stroke="var(--wall-330-stroke)" strokeWidth={1.5} width={W - 2} x={1} y={1} />
      ) : kind === 220 ? (
        <rect fill="var(--wall-220)" height={H} width={W} />
      ) : kind === 330 ? (
        <>
          <rect fill="var(--wall-330-stroke)" height={H} width={W} />
          <rect fill="var(--bg-surface)" height={H - 3} width={W - 3} x={1.5} y={1.5} />
          <rect fill="var(--wall-330)" height={H - 6} width={W - 6} x={3} y={3} />
        </>
      ) : kind === 'nonStandard' ? (
        <>
          <rect fill="var(--state-attention-tint)" height={H} width={W} />
          {[0, 6, 12, 18].map((x) => (
            <line key={x} stroke="var(--state-attention-stroke)" strokeWidth={1} x1={x} x2={x + H} y1={H} y2={0} />
          ))}
          <rect fill="none" height={H - 2} stroke="var(--state-attention-stroke)" strokeWidth={2} width={W - 2} x={1} y={1} />
        </>
      ) : (
        <>
          <rect fill="var(--state-verified-tint)" height={H - 2} stroke="var(--state-verified)" strokeWidth={1.5} width={W - 2} x={1} y={1} />
          <path d="M6 6.5l2.5 2.5L14 3.5" fill="none" stroke="var(--state-verified-text)" strokeWidth={1.6} />
        </>
      )}
    </svg>
  );
}
