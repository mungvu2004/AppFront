/**
 * Thẻ nhỏ "về dự án" — thứ duy nhất AppFront thêm vào trang Pascal.
 * Nằm đầu khe `viewerToolbarLeft` nên không đè thanh bên; kiểu chép từ `TOOLBAR_CONTAINER`
 * của upstream `viewer-toolbar.tsx`.
 */
import { ArrowLeft } from 'lucide-react';

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
