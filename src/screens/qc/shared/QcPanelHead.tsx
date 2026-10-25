import type { ReactNode } from 'react';

/**
 * Đầu panel trái của các màn duyệt lớp (HOP-DONG-V6 câu 1 + 2, demo Z/S-15):
 * H1 động từ + đối tượng, dòng trạng thái (Badge + câu có số + đã lưu).
 * Không còn eyebrow mặc định "Bước 3 · Kiểm tra tầng" (thanh bước đã nói, CONTRACT ux-2610 mục 1);
 * chỉ vẽ khi màn truyền rõ `eyebrow`. Câu 3 (cổng) nằm ở thanh bước qua `FlowGate`.
 * Màn dùng cái này thì truyền `titled` cho `QcFloorNav` để không có hai H1.
 */
export interface QcPanelHeadProps {
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
  readonly status?: ReactNode;
}

export function QcPanelHead({ eyebrow, title, status }: QcPanelHeadProps) {
  return (
    <header className="shrink-0 border-b border-border-default px-4 py-4">
      {eyebrow && <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{eyebrow}</p>}
      <h1 className={eyebrow ? 'mt-1 text-heading text-text-primary' : 'text-heading text-text-primary'}>{title}</h1>
      {status && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body-sm text-text-secondary">{status}</div>
      )}
    </header>
  );
}
