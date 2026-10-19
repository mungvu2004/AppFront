/**
 * Thẻ nhỏ "về dự án" và dải bước của dự án — hai thứ AppFront thêm vào trang Pascal.
 * Nằm đầu khe `viewerToolbarLeft` nên không đè thanh bên; kiểu chép từ `TOOLBAR_CONTAINER`
 * của upstream `viewer-toolbar.tsx`.
 */
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';

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
 * hiện tại ẩn và lối tiếp viết gọn "Tiếp:".
 * QA-2 L1: các ngưỡng dưới đây đo theo bề rộng thanh trên (container `appbar`, khai ở pascal.css),
 * không theo khổ màn — thanh bên mở/kéo rộng cũng làm thanh hẹp lại. Thanh < 1400px: dải sáu bước
 * thu thành một chip "bước hiện tại + menu" (`<details>`); < 960px: ẩn lối tiếp (đã có trong menu).
 */
export function ProjectStepsCard({ projectId }: { readonly projectId: string }) {
  const next = PROJECT_STEPS[VIEWER_STEP + 1];
  const current = PROJECT_STEPS[VIEWER_STEP] ?? PROJECT_STEPS[0]!;
  return (
    <>
      <nav aria-label="Các bước của dự án" className={`${CARD} hidden px-1 @min-[1400px]/appbar:inline-flex`}>
        <ol className="flex items-center gap-0.5">
          {PROJECT_STEPS.map((step, index) =>
            index === VIEWER_STEP ? (
              <li key={step.id}>
                <span aria-current="step" className="flex h-6 items-center gap-1.5 rounded-lg bg-accent px-1.5 font-semibold" title={step.label}>
                  <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="sr-only @min-[1600px]/appbar:not-sr-only">{step.label}</span>
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
      <details className="relative @min-[1400px]/appbar:hidden">
        <summary
          aria-label={`Bước ${VIEWER_STEP + 1}/${PROJECT_STEPS.length}: ${current.label} — mở danh sách bước`}
          className={`${CARD} flex cursor-pointer list-none gap-1.5 px-2 font-semibold hover:bg-accent [&::-webkit-details-marker]:hidden`}
        >
          <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {VIEWER_STEP + 1}
          </span>
          <span className="hidden @min-[1000px]/appbar:inline">{current.label}</span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </summary>
        <ol aria-label="Danh sách bước" className="absolute top-full left-0 z-50 mt-1 min-w-48 rounded-xl border border-border bg-popover/95 p-1 text-xs shadow-2xl backdrop-blur-xl">
          {PROJECT_STEPS.map((step, index) => (
            <li key={step.id}>
              <a
                {...(index === VIEWER_STEP ? { 'aria-current': 'step' as const } : {})}
                className="flex h-7 items-center gap-2 whitespace-nowrap rounded-lg px-2 hover:bg-accent aria-[current=step]:bg-accent aria-[current=step]:font-semibold"
                href={step.path(projectId)}
              >
                <span className="w-3 text-muted-foreground">{index + 1}</span>
                {step.label}
              </a>
            </li>
          ))}
        </ol>
      </details>
      {next !== undefined && (
        <a
          aria-label={`Bước tiếp theo: ${next.label}`}
          className={`${CARD} hidden gap-1 whitespace-nowrap px-2.5 font-medium hover:bg-accent @min-[960px]/appbar:inline-flex`}
          href={next.path(projectId)}
        >
          <span className="@min-[1600px]/appbar:hidden">Tiếp:</span>
          <span className="hidden @min-[1600px]/appbar:inline">Bước tiếp theo:</span>
          {next.label}
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </a>
      )}
    </>
  );
}
