/**
 * `NotFound` — view thuần của route `*` (S-43). Chữ của nút, tiêu đề, câu giải
 * thích, mã lỗi và hàng gợi ý đến từ `NotFoundVm` (`notFoundModel.ts`); file này
 * chỉ thêm nhãn trình bày cố định theo `reason` (eyebrow, chip trạng thái).
 * Không store, không mạng, không `src/api`, không `src/domain` — test được chỉ
 * từ props (mục D, R-60).
 *
 * **Bố cục (demo Z/S-43, vòng 6).** Một cột 720 căn giữa ngang, đặt từ trên
 * xuống như mọi trang ngoài dự án: `PageHead` trả lời ba câu — eyebrow + H1
 * (chuyện gì xảy ra), chip + câu trạng thái, dòng lý do, rồi hai lối ra (một
 * nút chính). Dưới đó MỘT khung `Section` "Có thể bạn đang tìm" — đường phục
 * hồi chính, hàng cao 72 như S-02, cả hàng bấm được. Cuối cùng là mã lỗi chọn
 * được + "Chép mã". Không chữ số 404 lớn, không hình minh hoạ chung chung.
 *
 * **Không vẽ phần cần BE.** Nhánh "dự án đã xoá / khôi phục" và chip bước của
 * từng dự án không có nguồn dữ liệu (xem docblock `notFoundModel.ts`), nên
 * không có ở đây — không dữ liệu giả.
 *
 * **Hoạt cảnh** chỉ là nội dung nâng `CONTENT_LIFT_PX` khi hiện ra (`slow`),
 * giảm chuyển động thì chỉ mờ dần — đọc từ `prefersReducedMotion` của VM.
 */

import { ChevronLeft, ChevronRight, FileImage } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Button } from '@/components/ui/Button';
import { MOTION_DURATIONS_MS, cssDurationMs } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

import {
  CONTENT_LIFT_PX,
  RECENT_PROJECT_LIMIT,
  type NotFoundReason,
  type NotFoundVm,
} from './notFoundModel';

const ENTER_ANIMATION_NAME = 'nf-notfound-enter';
const FADE_ANIMATION_NAME = 'nf-notfound-fade';

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

interface HeadCopy {
  readonly eyebrow: string;
}

/** Eyebrow cho từng nguyên nhân (câu 1 và câu 2 của màn). */
const HEAD_BY_REASON: Readonly<Record<NotFoundReason, HeadCopy>> = {
  missing: {
    eyebrow: 'Đường dẫn không mở được',
  },
  forbidden: {
    eyebrow: 'Cần đăng nhập',
  },
  offline: {
    eyebrow: 'Mất kết nối',
  },
};

const UNHARMED_SENTENCE = 'Dữ liệu của bạn không bị ảnh hưởng';
const PICK_BELOW_SENTENCE = 'Nếu bạn đang tìm một dự án, chọn ở danh sách dưới đây.';
const RECENT_SUB_SUFFIX = ' dự án cập nhật gần nhất';
const OPEN_LABEL = 'Mở';

/** Vành tiêu điểm 2px offset 2px A12 đòi, cho hàng dự án không đi qua `Button`. */
const ROW_FOCUS_RING_CLASS =
  'outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

export function NotFound({
  reason,
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
  // Con số người dùng THẤY là con số màn này chịu trách nhiệm, nên nó được ép
  // ở đúng chỗ vẽ ra, không chỉ ở chỗ lấy dữ liệu.
  const visibleProjects = recentProjects.slice(0, RECENT_PROJECT_LIMIT);
  const hasRecentProjects = visibleProjects.length > 0;
  const head = HEAD_BY_REASON[reason];

  return (
    <div className="min-h-full w-full bg-bg-app">
      <style>{STYLE_TEXT}</style>
      <div
        className={cn(
          'mx-auto box-content max-w-[720px] px-8 pb-12',
          isCompact ? 'pt-12' : 'pt-[72px]',
          prefersReducedMotion ? FADE_ANIMATION_NAME : ENTER_ANIMATION_NAME,
        )}
      >
        <PageHead
          className="mb-0"
          eyebrow={head.eyebrow}
          title={title}
          status={
            <>
              <span>{UNHARMED_SENTENCE}</span>
            </>
          }
        />
        <p className="mt-3 max-w-[600px] text-[14px] leading-[22px] text-text-secondary">
          {description}
          {hasRecentProjects && ` ${PICK_BELOW_SENTENCE}`}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Lối ra">
          <Button variant="primary" onClick={primaryAction.onActivate}>
            {primaryAction.label}
          </Button>
          <Button
            variant="ghost"
            iconBefore={<ChevronLeft size={16} aria-hidden="true" />}
            onClick={secondaryAction.onActivate}
          >
            {secondaryAction.label}
          </Button>
        </div>

        {hasRecentProjects && (
          <Section
            className="mt-6"
            flush
            title={recentHeading}
            actions={
              <span className="text-[13px] text-text-muted">
                {`${String(visibleProjects.length)}${RECENT_SUB_SUFFIX}`}
              </span>
            }
          >
            <ul className="flex flex-col p-2">
              {visibleProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    to={project.to}
                    className={cn(
                      'group flex h-[72px] items-center gap-4 rounded-lg px-3 text-text-primary transition-colors duration-instant hover:bg-bg-hover',
                      ROW_FOCUS_RING_CLASS,
                    )}
                  >
                    <span
                      className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-bg-sunken text-text-secondary"
                      aria-hidden="true"
                    >
                      <FileImage size={18} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium leading-5">{project.name}</span>
                      <span className="mt-0.5 text-[13px] leading-[18px] text-text-secondary">
                        {project.recencyLabel}
                      </span>
                    </span>
                    <span className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-2 text-[13px] font-medium text-accent group-hover:bg-accent-wash">
                      {OPEN_LABEL}
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-6 flex items-center gap-2">
          <samp className="select-all rounded bg-bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-text-secondary">
            {errorCaption}
          </samp>
        </div>
      </div>
    </div>
  );
}
