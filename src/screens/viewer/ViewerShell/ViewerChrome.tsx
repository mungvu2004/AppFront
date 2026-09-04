/**
 * Hai mảnh vỏ mà vỏ 3D phải tự dựng: breadcrumb và cụm thu phóng.
 *
 * View thuần (R-60).
 *
 * ## Vì sao không dùng `components/shell/Breadcrumb` và `components/canvas/ZoomCluster`
 *
 * Cả hai chạy được, và cả hai đặt nhãn tiếng Anh lên vùng mà trình đọc màn hình
 * đọc — thứ `expectVietnamese` bắt và R-72 không cho đi qua:
 *
 * | Component | Nhãn hỏng |
 * |---|---|
 * | `shell/Breadcrumb.tsx:24` | `<nav aria-label="Breadcrumb">` |
 * | `canvas/ZoomCluster.tsx` | `aria-label="Điều khiển zoom"`, `"Zoom hiện tại 100%…"` |
 *
 * Đã dựng và xác nhận bằng lượt chạy thật: bốn lỗi `expectVietnamese`, ba trong
 * số đó đến từ hai component ấy chứ không từ màn.
 *
 * R-68 cấm sửa `src/components/**` trong lúc dựng màn, nên nước đi hợp lệ là
 * chọn thứ khác — cùng lựa chọn mà `ProjectSettings` đã phải làm với `Slider`,
 * và cùng lựa chọn `ViewerStoreyRail.tsx` làm với thanh trượt độ tách. Hai mảnh
 * ở đây nhỏ (một `nav` hai mắt xích, ba nút cộng một số phần trăm), nên chép
 * lại rẻ hơn nhiều so với việc để chín màn 3D không qua nổi R-72.
 *
 * **Đây là khoản nợ của component, không phải của màn.** Sửa đúng chỗ là đổi
 * `aria-label` của hai component kia sang tiếng Việt trong một thay đổi riêng;
 * lúc ấy hai mảnh này xoá đi được.
 */

import { ChevronRight, Maximize2, Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ViewerBreadcrumbItem } from './viewerShellTypes';

/* -------------------------------------------------------------------------- */
/* Breadcrumb.                                                                 */
/* -------------------------------------------------------------------------- */

export interface ViewerBreadcrumbProps {
  readonly items: readonly ViewerBreadcrumbItem[];
}

export function ViewerBreadcrumb({ items }: ViewerBreadcrumbProps) {
  return (
    <nav aria-label="Đường dẫn màn hình" className="flex items-center gap-1">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span className="flex items-center gap-1" key={item.id}>
            {index > 0 && (
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-text-muted" />
            )}

            {item.onClick === undefined || isLast ? (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={cn(
                  'text-[13px]',
                  isLast ? 'text-text-primary' : 'text-text-secondary',
                )}
              >
                {item.label}
              </span>
            ) : (
              <button
                className={cn(
                  'rounded-[6px] px-1 text-[13px] text-text-secondary',
                  'transition-colors duration-120 hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app',
                )}
                onClick={item.onClick}
                type="button"
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Cụm thu phóng.                                                              */
/* -------------------------------------------------------------------------- */

export interface ViewerZoomClusterProps {
  /** Mức thu phóng ĐÃ ĐỊNH DẠNG, ví dụ "100%" (A15 — view không tự làm tròn). */
  readonly zoomLabel: string;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onZoomReset: () => void;
  readonly onFitAll: () => void;
}

/** Nút của cụm, cùng một khuôn để bốn nút không lệch nhau từng pixel. */
function ClusterButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-[8px]',
        'text-text-secondary transition-colors duration-120 hover:bg-bg-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function ViewerZoomCluster({
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitAll,
}: ViewerZoomClusterProps) {
  return (
    <div
      aria-label="Cụm thu phóng"
      className={cn(
        'flex items-center gap-0.5 rounded-[12px] px-1 py-1',
        'border border-border-default bg-bg-surface shadow-float',
      )}
      role="group"
    >
      <ClusterButton label="Thu nhỏ" onClick={onZoomOut}>
        <Minus aria-hidden="true" className="h-4 w-4" />
      </ClusterButton>

      <button
        aria-label={`Mức thu phóng ${zoomLabel}, bấm để về mức chuẩn`}
        className={cn(
          'min-w-[48px] rounded-[8px] px-1 text-[11px] tabular-nums text-text-secondary',
          'transition-colors duration-120 hover:bg-bg-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
        )}
        onClick={onZoomReset}
        type="button"
      >
        {zoomLabel}
      </button>

      <ClusterButton label="Phóng to" onClick={onZoomIn}>
        <Plus aria-hidden="true" className="h-4 w-4" />
      </ClusterButton>

      <ClusterButton label="Vừa khung hình" onClick={onFitAll}>
        <Maximize2 aria-hidden="true" className="h-4 w-4" />
      </ClusterButton>
    </div>
  );
}
