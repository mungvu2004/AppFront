/**
 * `MobileViewer` ĐÃ NỐI DÂY — ranh giới lỗi, ranh giới chunk, và vỏ route.
 *
 * Đây là thứ router gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <MobileViewerContainer projectId={projectId} roles={session.roles} />
 * ```
 *
 * Mọi chỗ tiêm của {@link ConnectedMobileViewerProps} đi thẳng qua đây, nên một
 * màn khác — hay một bài kiểm — mở được màn này mà không phải viết thêm một dòng
 * logic nào: cổng dữ liệu, cổng chia sẻ, đồ thị, đồng hồ, cảnh giả, bus thông
 * báo riêng, tất cả đều là props. Hôm nay chỉ có route gọi nó; "chưa ai dùng"
 * không phải lý do để một callback tồn tại trên giấy (R-73).
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62). `src/lib/screen-state/screenErrorBoundary.ts`
 * là hàm dựng BÁO CÁO, không phải component React — `src/lib` cấm React (mục
 * 0.4), nên nó không thể là ranh giới. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, nên màn không bao giờ ra ô trắng (A11).
 *
 * `key={projectId}` lặp lại đúng ý `key={activeScreen}` của `App.tsx`: đổi sang
 * dự án khác thì ranh giới gắn LẠI, và một lần sập ở dự án cũ không dính sang
 * dự án mới.
 *
 * ## Ranh giới chunk: vì sao có `lazy()` ở giữa
 *
 * `MobileViewer.connected.tsx` nhập tĩnh module cảnh, tức nhập `three`. Ngân
 * sách `routeChunk` là 280 KiB đo trên **bao đóng nhập tĩnh** của chunk màn, và
 * `three` một mình đã ~137 KiB gzip. `lazy()` đẩy cả nhánh ấy sang
 * `dynamicImports`, nên bước vào màn này chỉ tải phần vỏ trước, cảnh đến sau.
 *
 * Phần chờ KHÔNG phải một ô trắng và không phải chữ tiếng Anh: nó là đúng câu
 * mà trạng thái `loading` của view nói, trên đúng nền `bg-canvas-3d` mà view
 * dùng — chunk tới nơi thì chữ đổi, nền không nháy.
 */

import { lazy, Suspense, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';

import type { ConnectedMobileViewerProps } from './MobileViewer.connected';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const MOBILE_VIEWER_SCREEN_ID = 'mobile-viewer';

const MISSING_PARAMS_TITLE = 'thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'đường dẫn không mang mã dự án, nên chưa mở được mô hình. quay lại danh sách dự án rồi chọn lại dự án cần xem.';

/**
 * Nhánh đã nối, tải muộn.
 *
 * `lazy()` ở cấp module là cố ý và đúng với khuôn `router.tsx`: chunk này CÓ
 * người trỏ tới, nên không có gì để Rollup lọc bỏ, và giữ nó ở cấp module là
 * cách duy nhất để hai lần dựng container không sinh ra hai component khác
 * danh tính (React sẽ gỡ rồi gắn lại cả cây con nếu thế).
 */
const LazyConnectedMobileViewer = lazy(async () => {
  const module = await import('./MobileViewer.connected');

  return { default: module.ConnectedMobileViewer };
});

export interface MobileViewerContainerProps extends ConnectedMobileViewerProps {}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function MobileViewerCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-bg-sunken" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/**
 * Lúc chunk cảnh còn trên đường.
 *
 * `role="status"` chứ không phải một khối câm: trình đọc màn hình phải biết màn
 * đang bận, đúng lời hứa A11 rằng bảy trạng thái đều nói ra được thành lời.
 */
function MobileViewerChunkFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-canvas-3d" role="status">
      <span className="rounded-md bg-bg-surface px-3 py-1.5 text-[13px] text-text-secondary shadow-sm">
        đang tải mô hình
      </span>
    </div>
  );
}

export function MobileViewerContainer(props: MobileViewerContainerProps) {
  return (
    <ScreenErrorBoundary
      key={props.projectId}
      renderFallback={(fallback): ReactNode => <MobileViewerCrashFallback {...fallback} />}
      screenId={MOBILE_VIEWER_SCREEN_ID}
    >
      <Suspense fallback={<MobileViewerChunkFallback />}>
        <LazyConnectedMobileViewer {...props} />
      </Suspense>
    </ScreenErrorBoundary>
  );
}

/**
 * Vỏ route — thứ DUY NHẤT trong thư mục màn biết tới `react-router-dom`.
 *
 * Cùng khuôn `Viewer3DRoute`: đọc tham số đường dẫn, đọc vai từ phiên, và từ
 * chối tử tế khi đường dẫn thiếu mã dự án thay vì dựng một màn không có gì để
 * xem (A11). Không bọc `ScreenErrorBoundary` lần hai — ranh giới đã nằm BÊN
 * TRONG {@link MobileViewerContainer}.
 */
export function MobileViewerRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const session = useSession();

  if (projectId === undefined || projectId.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert level="violation" message={MISSING_PARAMS_MESSAGE} title={MISSING_PARAMS_TITLE} />
      </div>
    );
  }

  return <MobileViewerContainer projectId={projectId} roles={session.roles} />;
}
