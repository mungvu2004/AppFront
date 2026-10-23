/**
 * Dải cảnh báo tỷ lệ (WP8) — đứng đầu cột giữa canvas: `CanvasHelp` vẽ nó phía trên cụm trợ giúp,
 * nên hai thứ không bao giờ chồng nhau. Kiểu thẻ chép từ `BackToProjectCard`; lối sửa dẫn về màn
 * hiệu chỉnh tỷ lệ của tầng sai. Trạng thái "chưa hiệu chỉnh" phát qua `useScaleUnresolved` để nút
 * "Tiếp" và cụm trợ giúp đổi theo mà không đọc tầng lần hai.
 */
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { ROUTES } from '@/routes/paths';

import { setUnresolved } from './scaleUnresolved';
import { type ReadScale, useScaleStatus } from './useScaleStatus';

export const SCALE_BANNER_TEXT = 'Bản vẽ chưa hiệu chỉnh tỷ lệ — kích thước 3D có thể sai.';
export const SCALE_NEXT_REASON = 'Tỷ lệ chưa hiệu chỉnh — nên hiệu chỉnh trước khi kiểm tra quy chuẩn.';

export function ScaleBanner({ projectId, readScale }: { readonly projectId: string; readonly readScale?: ReadScale }) {
  const scale = useScaleStatus(projectId, readScale);
  const show = scale.status === 'unresolved';
  useEffect(() => {
    setUnresolved(show);
    return () => setUnresolved(false);
  }, [show]);
  if (scale.status !== 'unresolved') return null;
  return (
    <div
      className="pointer-events-auto inline-flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-xl border border-[var(--pa-warn)] bg-[var(--pa-surface)] px-3 py-1.5 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)]"
      role="status"
    >
      <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-warn)]" />
      <span>{SCALE_BANNER_TEXT}</span>
      <a className="shrink-0 rounded font-medium text-[var(--pa-accent)] underline outline-none hover:text-[var(--pa-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)]" href={ROUTES.project.scale(projectId, scale.floorId)}>
        Hiệu chỉnh tỷ lệ
      </a>
    </div>
  );
}
