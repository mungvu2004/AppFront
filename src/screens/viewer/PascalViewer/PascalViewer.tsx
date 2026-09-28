/**
 * Màn xem 3D dựng bằng Pascal — phần view, thuần.
 *
 * Không chạm store, không chạm mạng, không nhập `@pascal-app/*`. Mọi thứ nó
 * cần nằm trong `props.viewModel`, nên bài kiểm bảy trạng thái dựng được cả
 * bảy mà không cần WebGL — và đó là điểm của mục D.
 *
 * Luật riêng của màn này: **cả bảy nhánh đều trả về một cây có nội dung.**
 * Pascal thì không như vậy — `viewer/src/components/viewer/render-error.tsx:29-45`
 * dựng `fallback={null}`, tức lỗi render ra màn trắng thật. Đó chính là thất
 * bại duy nhất mà A11 tồn tại để chặn, nên khung nhúng nằm dưới nhánh
 * `success`/`partial` và không bao giờ là thứ duy nhất trên màn.
 */

import { AlertTriangle, Box, EyeOff, Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

import type { PascalViewerProps } from './pascalViewerTypes';

/** Khung chứa, dùng chung cho cả bảy nhánh để không nhánh nào lạc ra ngoài bố cục. */
function Frame({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="mô hình 3d"
      className="flex h-full min-h-0 flex-col gap-3 bg-bg-app p-4"
    >
      <p className="text-sm text-text-muted" role="status">
        {caption}
      </p>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Khối khung xương lúc nạp: hộp rỗng có nhịp thở, không chữ. */
function Skeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-full min-h-48 w-full animate-pulse rounded-md bg-bg-sunken"
    />
  );
}

export function PascalViewer({ viewModel, canvasRef, onRetry, onExpand }: PascalViewerProps) {
  const { state, caption, summary, skipped, errorCode } = viewModel;

  if (state === 'loading') {
    return (
      <Frame caption={caption}>
        <Skeleton />
      </Frame>
    );
  }

  if (state === 'forbidden') {
    return (
      <Frame caption={caption}>
        <EmptyState
          icon={<Lock aria-hidden="true" />}
          title="chưa bật cho tài khoản này"
          description="màn xem 3D mới đang chạy thử theo nhóm. người trực có thể bật nó cho bạn."
        />
      </Frame>
    );
  }

  if (state === 'empty') {
    return (
      <Frame caption={caption}>
        <EmptyState
          icon={<Box aria-hidden="true" />}
          title="chưa có gì để dựng"
          description="bản vẽ này chưa có tường, phòng hay ô mở nào. dò lại bản vẽ rồi quay lại đây."
        />
      </Frame>
    );
  }

  if (state === 'error') {
    return (
      <Frame caption={caption}>
        <EmptyState
          icon={<AlertTriangle aria-hidden="true" />}
          title="không nạp được khung dựng hình"
          description={
            errorCode === null
              ? 'thử lại một lần; nếu vẫn vậy thì báo người trực.'
              : `thử lại một lần; nếu vẫn vậy thì báo người trực kèm mã ${errorCode}.`
          }
          action={{ label: 'thử lại', onClick: onRetry }}
        />
      </Frame>
    );
  }

  if (state === 'collapsed') {
    return (
      <Frame caption={caption}>
        <EmptyState
          icon={<EyeOff aria-hidden="true" />}
          title="khung xem đang thu gọn"
          description="mô hình 3D không chạy khi thu gọn, để đỡ tốn máy."
          action={{ label: 'mở khung xem', onClick: onExpand }}
        />
      </Frame>
    );
  }

  // success và partial: khung nhúng có mặt, kèm số đo.
  return (
    <Frame caption={caption}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div
          ref={canvasRef}
          data-testid="pascal-canvas"
          aria-label="khung dựng mô hình 3d"
          className="min-h-48 flex-1 overflow-hidden rounded-md border border-border-default bg-bg-sunken"
        />

        {summary !== null && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted">
            <div className="flex gap-1.5">
              <dt>tầng</dt>
              <dd className="font-medium text-text-primary">{summary.levelLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>tường</dt>
              <dd className="font-medium text-text-primary">{summary.wallLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>ô mở</dt>
              <dd className="font-medium text-text-primary">{summary.openingLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>phòng</dt>
              <dd className="font-medium text-text-primary">{summary.roomLabel}</dd>
            </div>
          </dl>
        )}

        {skipped.length > 0 && (
          <div className="rounded-md border border-border-default bg-bg-sunken p-3">
            <p className="text-sm font-medium text-text-primary">chưa chuyển sang được</p>
            <ul className="mt-2 flex flex-col gap-1">
              {skipped.map((item) => (
                <li key={item.kind} className="text-sm text-text-muted">
                  <span className="font-medium text-text-primary">
                    {item.countLabel} {item.kind}
                  </span>{' '}
                  — {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Frame>
  );
}
