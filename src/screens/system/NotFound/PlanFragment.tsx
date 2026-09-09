/**
 * Mảnh mặt bằng thiếu một bức tường — hình minh hoạ trang trí của `NotFound`.
 *
 * Ba cạnh của một hình chữ nhật, cạnh phải để hở HẲN từ góc tới góc — không
 * phải một hình mờ, mà một khoảng trống đọc ra được ngay là "thiếu". Tách
 * khỏi `NotFound.tsx` đúng khuôn `ProjectCardTile.tsx` giữ `PlanPreview` /
 * `CommentThread.tsx` tách khỏi view chính của nó (mục D, R-22): chi tiết xếp
 * chỗ của riêng màn này, không phải component dùng chung.
 *
 * `aria-hidden` — hình trang trí, tiêu đề `h2` của `NotFound` đã nói hết
 * nghĩa. Một màu (`text-text-muted` qua `stroke-text-muted`, đúng cách
 * `ProjectCardTile.tsx`'s `PlanPreview` tô nét), không tô, không dựng 3D,
 * không chữ số.
 */

import { AMBIENT_LOOP_MS, cssDurationMs } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

import { ILLUSTRATION_SIZE_PX, ILLUSTRATION_STROKE_WIDTH } from './notFoundModel';

export interface PlanFragmentProps {
  /** `NotFoundVm.prefersReducedMotion` — hình hiện đủ luôn, chỉ hoà tan. */
  readonly prefersReducedMotion: boolean;
}

/**
 * Ba cạnh trên/trái/dưới của một mảnh mặt bằng; cạnh phải (góc trên-phải tới
 * góc dưới-phải) không được vẽ — đó là cả ý nghĩa của hình.
 */
const PLAN_FRAGMENT_PATH = 'M19,5 L5,5 L5,19 L19,19';

/**
 * Dài hơn chu vi thật của {@link PLAN_FRAGMENT_PATH} (42 đơn vị viewBox) để
 * `stroke-dashoffset` che kín toàn bộ nét lúc offset bằng con số này — cùng
 * cách `Glyph` của `WelcomeScreen.tsx` dùng 100 cho một đường ngắn hơn.
 */
const STROKE_LENGTH_BUDGET = 100;

const DRAW_ANIMATION_NAME = 'nf-plan-fragment-draw';
const FADE_ANIMATION_NAME = 'nf-plan-fragment-fade';

/**
 * CSS cục bộ của riêng hình này. `tailwind.config.ts` bị khoá (danh sách
 * trắng chỉ có hai file view) nên hai hoạt cảnh khai tại đây, không phải ở
 * đó — cùng cách hợp lệ `PipelineStepper.tsx` (`src/components/feedback`)
 * đã dùng cho `pipeline-sweep`.
 *
 * `AMBIENT_LOOP_MS` tên là "loop" nhưng nó là NGUỒN DUY NHẤT của 700ms trong
 * repo (`local/no-raw-duration`). Hình này dùng nó để chạy đúng MỘT lần rồi
 * giữ nguyên — `animation-fill-mode: forwards`, KHÔNG `infinite`, KHÔNG
 * `alternate`. Đặc tả cấm đích danh việc lặp lại.
 */
const STYLE_TEXT = `
  @keyframes ${DRAW_ANIMATION_NAME} {
    from { stroke-dashoffset: ${STROKE_LENGTH_BUDGET}; }
    to { stroke-dashoffset: 0; }
  }
  @keyframes ${FADE_ANIMATION_NAME} {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .${DRAW_ANIMATION_NAME} {
    stroke-dasharray: ${STROKE_LENGTH_BUDGET};
    stroke-dashoffset: 0;
    animation: ${DRAW_ANIMATION_NAME} ${AMBIENT_LOOP_MS}ms ease-out forwards;
  }
  .${FADE_ANIMATION_NAME} {
    animation: ${FADE_ANIMATION_NAME} ${cssDurationMs('instant')} ease-out forwards;
  }
`;

export function PlanFragment({ prefersReducedMotion }: PlanFragmentProps) {
  return (
    <svg
      aria-hidden="true"
      width={ILLUSTRATION_SIZE_PX}
      height={ILLUSTRATION_SIZE_PX}
      viewBox="0 0 24 24"
      fill="none"
      className={prefersReducedMotion ? FADE_ANIMATION_NAME : undefined}
    >
      <style>{STYLE_TEXT}</style>
      <path
        d={PLAN_FRAGMENT_PATH}
        className={cn('stroke-text-muted', !prefersReducedMotion && DRAW_ANIMATION_NAME)}
        strokeWidth={ILLUSTRATION_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
