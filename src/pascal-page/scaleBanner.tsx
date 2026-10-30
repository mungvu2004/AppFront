/**
 * Dải cảnh báo tỷ lệ (WP8) — đứng đầu cột giữa canvas: `CanvasHelp` vẽ nó phía trên cụm trợ giúp,
 * nên hai thứ không bao giờ chồng nhau. Kiểu thẻ chép từ `BackToProjectCard`; lối sửa dẫn về màn
 * hiệu chỉnh tỷ lệ của tầng sai. Trạng thái "chưa hiệu chỉnh" phát qua `useScaleUnresolved` để nút
 * "Tiếp" và cụm trợ giúp đổi theo mà không đọc tầng lần hai.
 *
 * UX-R2 K36: hai dòng tách bạch. Dòng đỏ chỉ nêu tầng KHÔNG dựng (không đo được tỷ lệ — `bridge`
 * bỏ nội dung của chúng khỏi cảnh), kèm "Đặt tỷ lệ". Dòng vàng nêu tầng vẫn dựng nhưng kích thước
 * có thể lệch. Mọi tầng đều không dựng thì giữa cảnh có thẻ nói rõ cảnh trống vì sao.
 */
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { ROUTES } from '@/routes/paths';

import { floorNamesOf } from './floorNames';
import { setUnresolved } from './scaleUnresolved';
import { type ReadScale, useScaleStatus } from './useScaleStatus';

export const SCALE_HIDDEN_PREFIX = 'Không dựng (chưa có tỷ lệ): ';
export const SCALE_PROVISIONAL_PREFIX = 'Kích thước có thể lệch: ';
export const SCALE_ALL_MISSING_TITLE = 'Chưa dựng được mô hình 3D';
export const SCALE_ALL_MISSING_BODY = 'Máy không đo được tỷ lệ của bản vẽ. Đặt tỷ lệ để dựng mô hình.';
/** UX41 U22: người xem không đặt được tỷ lệ — nói ai làm được, không bày nút. */
export const SCALE_ALL_MISSING_BODY_READ_ONLY =
  'Chủ dự án chưa đặt tỷ lệ cho bản vẽ nên chưa dựng được mô hình. Nhờ người có quyền sửa dự án đặt tỷ lệ.';

const LINK_CLASS =
  'shrink-0 rounded font-medium text-[var(--pa-accent)] underline outline-none hover:text-[var(--pa-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)]';

export const SCALE_NEXT_REASON = 'Tỷ lệ chưa hiệu chỉnh — nên đặt tỷ lệ trước khi kiểm tra quy chuẩn.';

const TONE_TEXT = { danger: 'text-[var(--pa-danger)]', warn: 'text-[var(--pa-warn)]' } as const;


function ScaleLine({ tone, text, href }: { readonly tone: 'danger' | 'warn'; readonly text: string; readonly href?: string }) {
  return (
    <p className="m-0 flex min-w-0 items-center gap-2 whitespace-nowrap">
      <TriangleAlert aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${TONE_TEXT[tone]}`} />
      <span className="min-w-0 truncate" title={text}>
        {text}
      </span>
      {href === undefined ? null : (
        <a className={LINK_CLASS} href={href}>
          Đặt tỷ lệ
        </a>
      )}
    </p>
  );
}

export function ScaleBanner({
  projectId,
  readScale,
  readOnly = false,
}: {
  readonly projectId: string;
  readonly readScale?: ReadScale;
  /** Người xem: không có lối "Đặt tỷ lệ" (UX41 U22). */
  readonly readOnly?: boolean;
}) {
  const scale = useScaleStatus(projectId, readScale);
  const floorId = scale.status === 'unresolved' ? scale.floorId : null;
  useEffect(() => {
    setUnresolved(floorId);
    return () => setUnresolved(null);
  }, [floorId]);
  if (scale.status !== 'unresolved') return null;
  const missing = scale.missing.length > 0;
  // `floorId` là tầng đỏ đầu tiên khi có, không thì tầng vàng đầu tiên: lối sửa nằm ở dòng của nó.
  const href = readOnly ? undefined : ROUTES.project.scale(projectId, scale.floorId);
  return (
    <div
      className={`pointer-events-auto flex max-w-[calc(100vw-32px)] flex-col gap-0.5 rounded-xl border bg-[var(--pa-surface)] px-3 py-1.5 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] ${missing ? 'border-[var(--pa-danger)]' : 'border-[var(--pa-warn)]'}`}
      role="status"
    >
      {missing ? (
        <ScaleLine {...(href === undefined ? {} : { href })} text={`${SCALE_HIDDEN_PREFIX}${floorNamesOf(scale.missing)}`} tone="danger" />
      ) : null}
      {scale.provisional.length > 0 ? (
        <ScaleLine
          {...(missing || href === undefined ? {} : { href })}
          text={`${SCALE_PROVISIONAL_PREFIX}${floorNamesOf(scale.provisional)}`}
          tone="warn"
        />
      ) : null}
    </div>
  );
}

/**
 * Mọi tầng chưa có tỷ lệ: cảnh trống (cầu không dựng tầng nào), nên giữa màn nói rõ vì sao và dẫn
 * tới "Đặt tỷ lệ" thay vì để người dùng nhìn một khung trống. Đặt cạnh `CanvasHelp` trong khung
 * `relative` của trang; `useScaleStatus` dùng chung lượt đọc với dải cảnh báo.
 */
export function ScaleEmptyNotice({
  projectId,
  readScale,
  readOnly = false,
}: {
  readonly projectId: string;
  readonly readScale?: ReadScale;
  readonly readOnly?: boolean;
}) {
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
        <p className="text-[13px] text-[var(--pa-text-2)]">
          {readOnly ? SCALE_ALL_MISSING_BODY_READ_ONLY : SCALE_ALL_MISSING_BODY}
        </p>
        {readOnly ? null : (
          <a className={`${LINK_CLASS} mt-1`} href={ROUTES.project.scale(projectId, scale.floorId)}>
            Đặt tỷ lệ
          </a>
        )}
      </section>
    </div>
  );
}
