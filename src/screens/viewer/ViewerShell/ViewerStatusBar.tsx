/**
 * Thanh trạng thái 32: "4 tầng · 14 phòng · 248,60 m² · 58 fps".
 *
 * View thuần (R-60). Chuỗi đến ĐÃ GHÉP SẴN từ `useViewerShell` — A15 nói định
 * dạng số xảy ra ở viewmodel, không ở view, và `local/no-raw-number` chặn
 * `toFixed`/`toLocaleString` ở đây. Dấu thập phân là dấu phẩy vì `formatArea`
 * của `src/lib/format/measure` đặt nó như vậy, không vì file này chọn.
 *
 * `aria-live="polite"` trên câu trạng thái: A7 nói hệ thống phải NÓI RA trạng
 * thái cho trình đọc màn hình, và "đang dựng mô hình" là đúng loại câu ấy.
 */

import { cn } from '@/lib/utils';

import type { ViewerStatusViewModel } from './viewerShellTypes';
import { VIEWER_LAYOUT } from './viewerShellTypes';

export interface ViewerStatusBarProps {
  readonly status: ViewerStatusViewModel;
  /** Chip hiệu năng, khi cờ nhà phát triển bật. */
  readonly children?: React.ReactNode;
}

export function ViewerStatusBar({ status, children }: ViewerStatusBarProps) {
  return (
    <footer
      aria-label="Thanh trạng thái"
      className={cn('flex shrink-0 items-center gap-3 px-4 text-[11px] text-text-secondary')}
      style={{ height: VIEWER_LAYOUT.statusBarPx }}
    >
      <span className="tabular-nums">{status.summary}</span>

      <span className="sr-only" aria-live="polite">
        {status.liveMessage}
      </span>

      <div aria-hidden="true" className="flex-1" />

      {children}
    </footer>
  );
}
