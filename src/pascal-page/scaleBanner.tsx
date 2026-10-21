/**
 * Dải cảnh báo tỷ lệ (WP8) — nằm ở khe `viewerBanner` của Pascal, không chặn thao tác.
 * Kiểu thẻ chép từ `BackToProjectCard`; lối sửa dẫn về màn hiệu chỉnh tỷ lệ của tầng sai.
 */
import { TriangleAlert } from 'lucide-react';

import { ROUTES } from '@/routes/paths';

import { type ReadScale, useScaleStatus } from './useScaleStatus';

export const SCALE_BANNER_TEXT = 'Bản vẽ chưa hiệu chỉnh tỷ lệ — kích thước 3D có thể sai.';

export function ScaleBanner({ projectId, readScale }: { readonly projectId: string; readonly readScale?: ReadScale }) {
  const scale = useScaleStatus(projectId, readScale);
  if (scale.status !== 'unresolved') return null;
  return (
    <div
      className="pointer-events-auto absolute top-14 left-1/2 z-20 inline-flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-3 py-1.5 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)]"
      role="status"
    >
      <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-warn)]" />
      <span>{SCALE_BANNER_TEXT}</span>
      <a className="rounded font-medium text-[var(--pa-accent)] underline outline-none hover:text-[var(--pa-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)]" href={ROUTES.project.scale(projectId, scale.floorId)}>
        Hiệu chỉnh tỷ lệ
      </a>
    </div>
  );
}
