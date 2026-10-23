/**
 * Một họ minh hoạ "nét mực bản vẽ" (V-14) cho 404 / 403 / trạng thái rỗng.
 *
 * Cùng ngôn ngữ với landing: nét mảnh 1,25px (`vector-effect: non-scaling-stroke`
 * nên phóng 120px vẫn mảnh, không thành nét 7px như bản cũ vẽ trên viewBox 24),
 * một màu chữ phụ, không tô, không màu trạng thái (A1). Mỗi biến thể là một
 * mảnh mặt bằng thật: tường + cung mở cửa.
 *
 * - `missing-wall` (404): phòng thiếu hẳn bức tường phải — "chỗ này không có".
 * - `closed-door` (403): phòng nằm sau cánh cửa đóng, cửa là nét đậm nhất.
 * - `empty-room` (rỗng): phòng trống có cửa mở — "chưa có gì bên trong".
 *
 * Vẽ ra đúng một lần (700ms, `AMBIENT_LOOP_MS`), giảm chuyển động thì hiện đủ ngay.
 * `aria-hidden` — tiêu đề của màn đã nói hết nghĩa.
 */

import { AMBIENT_LOOP_MS } from '@/lib/motion/tokens';

export type InkPlanVariant = 'missing-wall' | 'closed-door' | 'empty-room';

export interface InkPlanProps {
  readonly variant: InkPlanVariant;
  /** Bề rộng px; cao = 0,8 × rộng. */
  readonly size?: number;
}

/** Mặt bằng (nét chữ phụ nhạt) và nét nhấn (chữ phụ) của từng biến thể, viewBox 120 × 96. */
const PATHS: Record<InkPlanVariant, { readonly plan: readonly string[]; readonly accent: readonly string[] }> = {
  'missing-wall': {
    plan: [
      // tường trên/trái/dưới, cạnh phải bỏ trống
      'M100,12 H16 V84 H100',
      // vách trong có ô cửa + cung mở
      'M58,12 V34 M58,54 V84',
      'M58,34 A20,20 0 0 1 78,54',
    ],
    // hai đầu tường cụt ở mép phải
    accent: ['M100,8 V16 M100,80 V88'],
  },
  'closed-door': {
    plan: ['M60,12 H16 V84 H60', 'M38,12 V36 M38,58 V84', 'M38,36 A22,22 0 0 1 60,58'],
    accent: ['M64,6 H104 V90 H64 Z', 'M72,48 H78'],
  },
  'empty-room': {
    plan: ['M16,12 H104 V84 H70 M48,84 H16 V12'],
    accent: ['M48,84 V62', 'M48,62 A22,22 0 0 1 70,84'],
  },
};

const DRAW = 'ink-plan-draw';
const STROKE_BUDGET = 400;

const STYLE_TEXT = `
  @keyframes ${DRAW} { from { stroke-dashoffset: ${STROKE_BUDGET}; } to { stroke-dashoffset: 0; } }
  .${DRAW} { stroke-dasharray: ${STROKE_BUDGET}; stroke-dashoffset: 0; animation: ${DRAW} ${AMBIENT_LOOP_MS}ms ease-out forwards; }
  @media (prefers-reduced-motion: reduce) { .${DRAW} { animation: none; } }
`;

export const INK_STROKE_WIDTH = 1.25;

export function InkPlan({ variant, size = 120 }: InkPlanProps) {
  const { plan, accent } = PATHS[variant];
  return (
    <svg
      aria-hidden="true"
      data-ink-plan={variant}
      width={size}
      height={Math.round(size * 0.8)}
      viewBox="0 0 120 96"
      fill="none"
      strokeWidth={INK_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <style>{STYLE_TEXT}</style>
      {plan.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" className={`stroke-text-muted ${DRAW}`} />
      ))}
      {accent.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" className={`stroke-text-secondary ${DRAW}`} />
      ))}
    </svg>
  );
}
