/**
 * Vỏ đã nối của màn duyệt bảy trạng thái (S-47), và cổng chặn của nó.
 *
 * Đây là công cụ NỘI BỘ, chỉ dùng trong bản dựng phát triển — không có màn
 * sản phẩm nào trỏ tới nó, và nó không bao giờ được lọt vào gói sản phẩm thật
 * khi tắt (đặc tả gốc). Cổng chặn đứng NGOÀI ranh giới lỗi, TRƯỚC khi
 * {@link useStateGallery} hay `StateGallery` được dựng: `isDevelopmentBuild()`
 * là `false` thì màn không dựng gì cả, kể cả hook — không chỉ view tự vẽ ra
 * trạng thái `forbidden` của nó (phòng hai lớp, đúng yêu cầu "KHÔNG dựng
 * màn" của đặc tả).
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản `src/App.tsx` đang
 * gắn (R-62). Phần dự phòng dựng bằng `EmptyState` từ `report.description`,
 * cùng khuôn `RuleReport.container.tsx`, `MobileViewer.container.tsx`.
 */

import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { isDevelopmentBuild } from '@/lib/telemetry/flags';

import { StateGallery } from './StateGallery';
import { useStateGallery } from './useStateGallery';

/** Tên màn này với ranh giới lỗi. */
const SCREEN_ID = 'state-gallery';

const FORBIDDEN_TITLE = 'không có quyền truy cập';
const FORBIDDEN_MESSAGE =
  'trang này chỉ dùng nội bộ trong bản dựng phát triển, không có ở bản dựng thật.';

/** Cùng khuôn `RuleReportCrashFallback` — R-62, chữ lấy từ `report.description`. */
function StateGalleryCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-state-violation-tint" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

function WiredStateGallery() {
  const viewProps = useStateGallery();

  return <StateGallery {...viewProps} />;
}

export function StateGalleryContainer() {
  if (!isDevelopmentBuild()) {
    return (
      <div className="p-6">
        <InlineAlert level="attention" message={FORBIDDEN_MESSAGE} title={FORBIDDEN_TITLE} />
      </div>
    );
  }

  return (
    <ScreenErrorBoundary
      key={SCREEN_ID}
      renderFallback={(fallback): ReactNode => <StateGalleryCrashFallback {...fallback} />}
      screenId={SCREEN_ID}
    >
      <WiredStateGallery />
    </ScreenErrorBoundary>
  );
}

/** Vỏ route, thứ `src/routes/router.tsx` mount qua `lazy(() => import(...))`. */
export function StateGalleryRoute() {
  return <StateGalleryContainer />;
}
