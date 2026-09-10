/**
 * Mảnh mặt bằng nằm sau một cánh cửa đóng — hình minh hoạ trang trí của
 * `AccessDenied`. Cùng vai trò `PlanFragment.tsx` giữ cho màn S-43: chi tiết
 * xếp chỗ của riêng một màn, không phải component dùng chung (mục D, R-22).
 *
 * **Hình nói đúng một câu:** bản vẽ vẫn ở đó, chỉ là bạn chưa mở được cửa.
 * Nên mặt bằng KHÔNG mờ đi và KHÔNG bị gạch chéo — nó đứt ở mép cánh cửa, và
 * cánh cửa là thứ đậm nhất trong hình. Không ổ khoá, không dấu cấm, không một
 * nét nào mang màu trạng thái: cả hình chỉ có hai token chữ (`--text-muted`
 * cho mặt bằng ở sau, `--text-secondary` cho cánh cửa ở trước), đúng cách
 * `PlanFragment` tô nét (A1).
 *
 * **Không nhận prop nào.** `AccessDeniedVm` không mang `prefersReducedMotion`
 * (khác `NotFoundVm`), nên nhánh giảm chuyển động đọc thẳng từ
 * `@media (prefers-reduced-motion: reduce)` trong khối CSS cục bộ dưới đây —
 * không `matchMedia`, không state, không prop mới đẻ ra ngoài hợp đồng.
 *
 * `aria-hidden` — hình trang trí; `h2` của `AccessDenied` đã nói hết nghĩa.
 */

import { AMBIENT_LOOP_MS } from '@/lib/motion/tokens';

import { ILLUSTRATION_SIZE_PX, ILLUSTRATION_STROKE_WIDTH } from './accessDeniedModel';

/**
 * Mặt bằng ở SAU: ba cạnh của một mảnh phòng, cụt hẳn ở `x=12` — đúng nơi mép
 * cánh cửa bắt đầu. Nét không chạy tiếp dưới cánh cửa, nên "ở sau" đọc ra được
 * mà không cần tô nền che (nền tô đặc sẽ phải chọn một màu, và chọn màu cho
 * một hình trang trí là thứ A1 không cần phải chịu).
 */
const PLAN_BEHIND_PATH = 'M12,6 H4 V18 H12';

/** Vách ngăn trong mảnh phòng, chừa một ô mở ở giữa — nghiệp vụ của app đấy. */
const PLAN_PARTITION_PATH = 'M8,6 V10 M8,14 V18';

/** Cánh cửa ĐÓNG ở trước: một khối chữ nhật kín, không khe hở nào. */
const DOOR_PATH = 'M13,2 H21 V22 H13 Z';

/** Tay nắm — điểm đậm của hình, và là nét được vẽ ra sau cùng. */
const DOOR_HANDLE_PATH = 'M14.6,12 h1.2';

/**
 * Dài hơn chu vi thật của nét dài nhất ({@link DOOR_PATH}, 56 đơn vị viewBox)
 * để `stroke-dashoffset` che kín mọi nét lúc offset bằng con số này — cùng
 * cách `PlanFragment.tsx` của S-43 dùng 100.
 */
const STROKE_LENGTH_BUDGET = 100;

const DRAW_ANIMATION_NAME = 'ad-plan-draw';

/**
 * CSS cục bộ của riêng hình này — `tailwind.config.ts` không nằm trong danh
 * sách trắng hai file của lượt này, và `PipelineStepper.tsx` đã có tiền lệ khai
 * `@keyframes` ngay tại nơi dùng.
 *
 * `AMBIENT_LOOP_MS` tên là "loop" nhưng đây là NGUỒN DUY NHẤT của 700ms trong
 * repo (`local/no-raw-duration`). Hình chạy đúng MỘT lần rồi giữ nguyên:
 * `forwards`, KHÔNG `infinite`, KHÔNG `alternate`.
 */
const STYLE_TEXT = `
  @keyframes ${DRAW_ANIMATION_NAME} {
    from { stroke-dashoffset: ${STROKE_LENGTH_BUDGET}; }
    to { stroke-dashoffset: 0; }
  }
  .${DRAW_ANIMATION_NAME} {
    stroke-dasharray: ${STROKE_LENGTH_BUDGET};
    stroke-dashoffset: 0;
    animation: ${DRAW_ANIMATION_NAME} ${AMBIENT_LOOP_MS}ms ease-out forwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .${DRAW_ANIMATION_NAME} {
      animation: none;
    }
  }
`;

/**
 * Mặt bằng phía sau một cánh cửa đóng, `ILLUSTRATION_SIZE_PX` vuông, nét
 * `ILLUSTRATION_STROKE_WIDTH` (1,5 — 120 là KÍCH THƯỚC, không phải độ dày nét).
 */
export function AccessDeniedPlan() {
  return (
    <svg
      aria-hidden="true"
      width={ILLUSTRATION_SIZE_PX}
      height={ILLUSTRATION_SIZE_PX}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={ILLUSTRATION_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <style>{STYLE_TEXT}</style>
      <path d={PLAN_BEHIND_PATH} className={`stroke-text-muted ${DRAW_ANIMATION_NAME}`} />
      <path d={PLAN_PARTITION_PATH} className={`stroke-text-muted ${DRAW_ANIMATION_NAME}`} />
      <path d={DOOR_PATH} className={`stroke-text-secondary ${DRAW_ANIMATION_NAME}`} />
      <path d={DOOR_HANDLE_PATH} className={`stroke-text-secondary ${DRAW_ANIMATION_NAME}`} />
    </svg>
  );
}
