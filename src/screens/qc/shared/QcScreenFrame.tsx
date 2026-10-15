import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Khung chung của các màn QC (BUG-413, AES-01/AES-04): một gốc cao bằng khung nhìn,
 * một lề trang (`QC_BODY_CLASS`: p-2, gap-2), một khung bản vẽ (`bg-bg-sunken`, bo 16).
 * Chỉ là lớp bọc: vùng (role/aria-label) do màn truyền vào, không đổi tên truy cập.
 */
export const QC_BODY_CLASS = 'gap-2 p-2';

interface QcScreenFrameProps {
  readonly label: string;
  readonly children: ReactNode;
  /** Màn dạng trang cuộn (Độ dày): gốc tự cuộn thay vì chia cột. */
  readonly scroll?: boolean;
}

export function QcScreenFrame({ label, children, scroll = false }: QcScreenFrameProps) {
  return (
    <div
      aria-label={label}
      className={cn('flex h-screen min-h-0 w-full flex-col bg-bg-app', scroll && 'overflow-y-auto')}
      role="region"
    >
      {children}
    </div>
  );
}

interface QcCanvasFrameProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Khung bản vẽ: nền và viền bo thống nhất cho cả trạng thái rỗng / đang tải / lỗi. */
export function QcCanvasFrame({ label, children, className }: QcCanvasFrameProps) {
  return (
    <section
      aria-label={label}
      className={cn('min-h-0 min-w-0 overflow-hidden rounded-2xl bg-bg-sunken', className)}
    >
      {children}
    </section>
  );
}
