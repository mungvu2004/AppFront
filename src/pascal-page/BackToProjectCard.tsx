/**
 * Thẻ nhỏ "về dự án" và dải bước của dự án — hai thứ AppFront thêm vào trang Pascal.
 * Nằm đầu khe `viewerToolbarLeft` nên không đè thanh bên; kiểu chép từ `TOOLBAR_CONTAINER`
 * của upstream `viewer-toolbar.tsx`.
 */
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { PROJECT_STEPS } from '@/routes/projectSteps';

export interface BackToProjectCardProps {
  readonly href: string;
  readonly projectName?: string | undefined;
}

export function BackToProjectCard({ href, projectName }: BackToProjectCardProps) {
  return (
    <a
      aria-label="Về dự án"
      className="inline-flex h-8 max-w-56 items-center gap-1.5 rounded-xl border border-border bg-background/90 px-2.5 font-medium text-foreground text-xs shadow-2xl backdrop-blur-md hover:bg-accent"
      href={href}
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{projectName ?? 'Về dự án'}</span>
    </a>
  );
}

const CARD = 'h-8 shrink-0 items-center rounded-xl border border-border bg-background/90 text-foreground text-xs shadow-2xl backdrop-blur-md';
const VIEWER_STEP = PROJECT_STEPS.findIndex((step) => step.id === 'viewer');

/**
 * Dải sáu bước gọn của dự án (bước "Mô hình 3D" đang mở) và lối "Bước tiếp theo" — trang 3D
 * không có header chung của app nên tự vẽ lại hai thứ này từ cùng bảng `PROJECT_STEPS` (G5-04, N0-07).
 * Khe thanh công cụ hẹp: bước khác chỉ hiện số (tên ở `title`/nhãn đọc); dưới 1536px tên bước
 * hiện tại ẩn và lối tiếp viết gọn "Tiếp:", dưới 1280px ẩn cả dải (còn lối tiếp).
 */
export function ProjectStepsCard({ projectId }: { readonly projectId: string }) {
  const next = PROJECT_STEPS[VIEWER_STEP + 1];
  return (
    <>
      <nav aria-label="Các bước của dự án" className={`${CARD} hidden px-1 xl:inline-flex`}>
        <ol className="flex items-center gap-0.5">
          {PROJECT_STEPS.map((step, index) =>
            index === VIEWER_STEP ? (
              <li key={step.id}>
                <span aria-current="step" className="flex h-6 items-center gap-1.5 rounded-lg bg-accent px-1.5 font-semibold" title={step.label}>
                  <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="sr-only 2xl:not-sr-only">{step.label}</span>
                </span>
              </li>
            ) : (
              <li key={step.id}>
                <a
                  aria-label={`Bước ${index + 1}: ${step.label}`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  href={step.path(projectId)}
                  title={step.label}
                >
                  {index + 1}
                </a>
              </li>
            ),
          )}
        </ol>
      </nav>
      {next !== undefined && (
        <a
          aria-label={`Bước tiếp theo: ${next.label}`}
          className={`${CARD} inline-flex gap-1 px-2.5 font-medium hover:bg-accent`}
          href={next.path(projectId)}
        >
          <span className="2xl:hidden">Tiếp:</span>
          <span className="hidden 2xl:inline">Bước tiếp theo:</span>
          {next.label}
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </a>
      )}
    </>
  );
}
