/**
 * `NotFound` — view thuần của route `*`. Mọi chuỗi tiếng Việt và mọi con số
 * đã thành chữ đến từ `NotFoundVm` (`notFoundModel.ts`, hợp đồng đông lạnh);
 * file này chỉ in ra (A15). Không store, không mạng, không `src/api`, không
 * `src/domain` — test được chỉ từ props (mục D, R-60).
 *
 * **Bố cục.** Một cột rộng `CONTENT_COLUMN_PX`, căn giữa cả ngang lẫn dọc,
 * nền `--bg-app`: hình minh hoạ (`PlanFragment`, bỏ khi `isCompact`) → `h2`
 * `title` → một câu `description` → hai nút cạnh nhau → khối "Có thể bạn
 * đang tìm" → caption chân trang chọn được.
 *
 * **Khối gợi ý là đường phục hồi chính**, không phải hai cái nút — nó đứng
 * sau chúng trong luồng đọc nhưng mang trọng lượng thị giác của một danh
 * sách thật (nền `bg-surface`, viền, mỗi hàng đủ cao) chứ không nép thành
 * chữ nhỏ. Rỗng thì ẩn cả khối.
 *
 * **Ba hoạt cảnh, không con số thời lượng nào ngoài mục B.** `PlanFragment`
 * tự vẽ một lần bằng `AMBIENT_LOOP_MS`; nội dung nâng `CONTENT_LIFT_PX` khi
 * hiện ra trong `slow`; hàng dự án nâng `ROW_HOVER_LIFT_PX` khi trỏ vào qua
 * `hover:-translate-y-px` có sẵn của Tailwind (đúng 1px, đúng cách
 * `ProjectCardTile.tsx` đang dùng). `framer-motion` bị cấm trong
 * `src/screens/**` (`local/no-framer-outside-motion`) nên cả ba là CSS
 * thuần — hai hoạt cảnh đầu khai `@keyframes` cục bộ vì `tailwind.config.ts`
 * bị khoá (không có trong danh sách trắng hai file của lượt này).
 *
 * **Giảm chuyển động đọc từ prop, không tự `matchMedia`.** Mọi nhánh hoạt
 * cảnh rẽ theo `prefersReducedMotion` của `NotFoundVm` — nguồn duy nhất,
 * cũng là thứ khiến view test được chỉ từ props (không cần polyfill
 * `window.matchMedia` trong jsdom).
 */

import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { MOTION_DURATIONS_MS, cssDurationMs } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

import {
  CONTENT_COLUMN_PX,
  CONTENT_LIFT_PX,
  RECENT_PROJECT_LIMIT,
  type NotFoundVm,
} from './notFoundModel';
import { PlanFragment } from './PlanFragment';

const ENTER_ANIMATION_NAME = 'nf-notfound-enter';
const FADE_ANIMATION_NAME = 'nf-notfound-fade';

/**
 * CSS cục bộ cho hoạt cảnh "nội dung hiện ra". `tailwind.config.ts` đã có
 * `panel-rise` cho cùng ý tưởng nhưng nâng 12px — đặc tả màn này xin đúng
 * `CONTENT_LIFT_PX` (8px), một con số khác, nên không tái dùng được; khai
 * cục bộ ở đây thay vì sửa file bị khoá. Cả hai hoạt cảnh đều
 * `animation-fill-mode: forwards`, không lặp.
 */
const STYLE_TEXT = `
  @keyframes ${ENTER_ANIMATION_NAME} {
    from { opacity: 0; transform: translateY(${CONTENT_LIFT_PX}px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ${FADE_ANIMATION_NAME} {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .${ENTER_ANIMATION_NAME} {
    animation: ${ENTER_ANIMATION_NAME} ${MOTION_DURATIONS_MS.slow}ms ease-out forwards;
  }
  .${FADE_ANIMATION_NAME} {
    animation: ${FADE_ANIMATION_NAME} ${cssDurationMs('instant')} ease-out forwards;
  }
`;

/** Vành tiêu điểm 2px offset 2px A12 đòi, cho hàng dự án không đi qua `Button`. */
const ROW_FOCUS_RING_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app';

export function NotFound({
  title,
  description,
  errorCaption,
  primaryAction,
  secondaryAction,
  recentProjects,
  recentHeading,
  isCompact,
  prefersReducedMotion,
}: NotFoundVm) {
  // Hợp đồng nói `recentProjects` đã "tối đa RECENT_PROJECT_LIMIT hàng" và cổng
  // thật cắt sẵn — nhưng con số người dùng THẤY là con số màn này chịu trách
  // nhiệm, nên nó được ép ở đúng chỗ vẽ ra, không chỉ ở chỗ lấy dữ liệu.
  const visibleProjects = recentProjects.slice(0, RECENT_PROJECT_LIMIT);
  const hasRecentProjects = visibleProjects.length > 0;

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-bg-app px-6 py-16">
      <style>{STYLE_TEXT}</style>
      <div
        className={cn(
          'flex flex-col items-center text-center',
          isCompact ? 'gap-4' : 'gap-6',
          prefersReducedMotion ? FADE_ANIMATION_NAME : ENTER_ANIMATION_NAME,
        )}
        style={{ width: CONTENT_COLUMN_PX }}
      >
        {!isCompact && <PlanFragment prefersReducedMotion={prefersReducedMotion} />}

        <h2 className="text-[20px] font-semibold text-text-primary">{title}</h2>
        <p className="text-[14px] leading-relaxed text-text-secondary">{description}</p>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={primaryAction.onActivate}>
            {primaryAction.label}
          </Button>
          <Button variant="ghost" onClick={secondaryAction.onActivate}>
            {secondaryAction.label}
          </Button>
        </div>

        {hasRecentProjects && (
          <div className="flex w-full flex-col items-stretch gap-2 text-left">
            <h3 className="text-[13px] font-medium text-text-secondary">{recentHeading}</h3>
            <ul className="flex flex-col gap-1.5">
              {visibleProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    to={project.to}
                    className={cn(
                      'group flex items-center justify-between gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3',
                      'text-text-primary transition-transform duration-instant hover:-translate-y-px focus-visible:-translate-y-px',
                      ROW_FOCUS_RING_CLASS,
                    )}
                  >
                    <span className="truncate text-[14px] font-medium">{project.name}</span>
                    <span className="shrink-0 text-[12px] text-text-muted opacity-0 transition-opacity duration-instant group-hover:opacity-100 group-focus-visible:opacity-100">
                      {project.recencyLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="select-text text-[12px] font-normal text-text-muted">{errorCaption}</p>
      </div>
    </div>
  );
}
