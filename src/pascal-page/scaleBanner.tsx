/**
 * Dải cảnh báo tỷ lệ (WP8) — đứng đầu cột giữa canvas: `CanvasHelp` vẽ nó phía trên cụm trợ giúp,
 * nên hai thứ không bao giờ chồng nhau. Kiểu thẻ chép từ `BackToProjectCard`; lối sửa dẫn về màn
 * hiệu chỉnh tỷ lệ của tầng sai. Trạng thái "chưa hiệu chỉnh" phát qua `useScaleUnresolved` để nút
 * "Tiếp" và cụm trợ giúp đổi theo mà không đọc tầng lần hai.
 *
 * Câu nêu tên từng tầng sai (UX-R1 K44); có tầng không đo được tỷ lệ thì dải đỏ, không thì vàng.
 * Tầng ấy không được dựng trong cảnh (`bridge`, Codex P1); mọi tầng đều thế thì giữa cảnh có thẻ
 * nói rõ cảnh trống vì sao, kèm lối "Đặt tỷ lệ".
 */
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { scaleFloorsMessageOf } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';

import { setUnresolved } from './scaleUnresolved';
import { type ReadScale, useScaleStatus } from './useScaleStatus';

export const SCALE_HIDDEN_NOTE = 'Chưa dựng các tầng này trong 3D.';
export const SCALE_ALL_MISSING_TITLE = 'Chưa dựng được mô hình 3D';
export const SCALE_ALL_MISSING_BODY = 'Máy không đo được tỷ lệ của bản vẽ. Đặt tỷ lệ để dựng mô hình.';

const LINK_CLASS =
  'shrink-0 rounded font-medium text-[var(--pa-accent)] underline outline-none hover:text-[var(--pa-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)]';

export const SCALE_NEXT_REASON = 'Tỷ lệ chưa hiệu chỉnh — nên hiệu chỉnh trước khi kiểm tra quy chuẩn.';

export function ScaleBanner({ projectId, readScale }: { readonly projectId: string; readonly readScale?: ReadScale }) {
  const scale = useScaleStatus(projectId, readScale);
  const floorId = scale.status === 'unresolved' ? scale.floorId : null;
  useEffect(() => {
    setUnresolved(floorId);
    return () => setUnresolved(null);
  }, [floorId]);
  if (scale.status !== 'unresolved') return null;
  const missing = scale.missing.length > 0;
  const href = ROUTES.project.scale(projectId, scale.floorId);
  return (
    <div
      className={`pointer-events-auto inline-flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-xl border bg-[var(--pa-surface)] px-3 py-1.5 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] ${missing ? 'border-[var(--pa-danger)]' : 'border-[var(--pa-warn)]'}`}
      role="status"
    >
      <TriangleAlert
        aria-hidden="true"
        className={`h-3.5 w-3.5 shrink-0 ${missing ? 'text-[var(--pa-danger)]' : 'text-[var(--pa-warn)]'}`}
      />
      <span>
        {scaleFloorsMessageOf(scale.missing, scale.provisional)}
        {missing && !scale.allMissing ? ` ${SCALE_HIDDEN_NOTE}` : null}
      </span>
      <a className={LINK_CLASS} href={href}>
        Đặt tỷ lệ
      </a>
    </div>
  );
}

/**
 * Mọi tầng chưa có tỷ lệ: cảnh trống (cầu không dựng tầng nào), nên giữa màn nói rõ vì sao và dẫn
 * tới "Đặt tỷ lệ" thay vì để người dùng nhìn một khung trống. Đặt cạnh `CanvasHelp` trong khung
 * `relative` của trang; `useScaleStatus` dùng chung lượt đọc với dải cảnh báo.
 */
export function ScaleEmptyNotice({ projectId, readScale }: { readonly projectId: string; readonly readScale?: ReadScale }) {
  const scale = useScaleStatus(projectId, readScale);
  if (scale.status !== 'unresolved' || !scale.allMissing) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <section
        aria-labelledby="appfront-scale-empty-title"
        className="pointer-events-auto flex max-w-sm flex-col items-center gap-2 rounded-xl border border-[var(--pa-danger)] bg-[var(--pa-surface)] px-6 py-5 text-center text-[var(--pa-text)] shadow-[var(--pa-shadow-float)]"
      >
        <TriangleAlert aria-hidden="true" className="h-6 w-6 text-[var(--pa-danger)]" />
        <h2 className="font-semibold text-base" id="appfront-scale-empty-title">
          {SCALE_ALL_MISSING_TITLE}
        </h2>
        <p className="text-[13px] text-[var(--pa-text-2)]">{SCALE_ALL_MISSING_BODY}</p>
        <a className={`${LINK_CLASS} mt-1`} href={ROUTES.project.scale(projectId, scale.floorId)}>
          Đặt tỷ lệ
        </a>
      </section>
    </div>
  );
}
