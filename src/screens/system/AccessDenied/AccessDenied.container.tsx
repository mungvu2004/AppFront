/**
 * Màn "bạn chưa có quyền truy cập" — bọc `useAccessDenied` với ranh giới lỗi và
 * nối đủ props để bất cứ màn nào cũng mở được nó mà không phải viết thêm một
 * dòng logic (R-73). Cùng khuôn `NotFound.container.tsx` cạnh thư mục này.
 *
 * - {@link AccessDeniedContainer} nhận mọi thứ qua props (mở rộng
 *   {@link UseAccessDeniedOptions}), và mọi hành động ra ngoài đã được nối sẵn:
 *   `useAccessDenied` tự giữ `useNavigate()`/`useLocation()` bên trong nó, nên
 *   không có một `onNavigate` tuỳ chọn nào để người gọi quên truyền.
 * - {@link AccessDeniedRoute} là bản toàn màn cho route.
 *
 * ## Vì sao `isCompact` đo ở ĐÂY chứ không ở hook
 *
 * `useAccessDenied` cố ý nhận `isCompact` qua tuỳ chọn thay vì tự suy ra: viết
 * thêm một `useNarrowViewport` trong tầng hook là dựng thêm một nguồn sự thật
 * cho cùng một ngưỡng (R-71). Nhưng để trống thì trạng thái `collapsed` KHÔNG
 * BAO GIỜ xảy ra ở sản phẩm thật — bảy trạng thái xanh trong bài kiểm mà chỉ sáu
 * cái tồn tại thật, đúng kiểu thiếu sót không ai nhìn thấy. Nên container đo,
 * đúng chỗ và đúng khuôn `NotFound.container.tsx` và
 * `VersionHistory.container.tsx:61-98` đã làm.
 *
 * Ngưỡng là {@link NARROW_QUERY} của hợp đồng — một hằng CÓ TÊN, sống trong thư
 * mục màn, không rò ra ngoài. Người gọi vẫn ghi đè được bằng `isCompact`: một
 * màn chủ đã tự biết mình hẹp thì không cần đo lần hai.
 *
 * ## Vì sao dùng `ScreenErrorBoundary` của `components/feedback`
 *
 * Repo có hai thứ trùng tên. `src/lib/screen-state/screenErrorBoundary.ts` là
 * hàm dựng báo cáo, không phải component React — `src/lib` cấm React (mục 0.4),
 * nên nó không thể là ranh giới lỗi. Ranh giới thật là component ở
 * `components/feedback/ScreenErrorBoundary.tsx`, đúng cái `src/App.tsx` và
 * `NotFound.container.tsx` đang dùng.
 */

import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';

import { AccessDenied } from './AccessDenied';
import { NARROW_QUERY, SCREEN_ID } from './accessDeniedModel';
import { useAccessDenied, type UseAccessDeniedOptions } from './useAccessDenied';

export interface AccessDeniedContainerProps extends UseAccessDeniedOptions {}

/**
 * Ngưỡng thu gọn, theo dõi tại chỗ.
 *
 * `useAppShell.ts:5` có một `useBreakpoint` làm đúng việc này nhưng nó là hàm
 * riêng tư của file đó, và lượt này không được sửa `src/hooks`. Nên đây là bản
 * chép ngắn của cùng khuôn, sống trong thư mục màn và không rò ra ngoài.
 */
function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);

    setIsNarrow(media.matches);

    const listener = (event: MediaQueryListEvent): void => {
      setIsNarrow(event.matches);
    };

    media.addEventListener('change', listener);

    return (): void => {
      media.removeEventListener('change', listener);
    };
  }, []);

  return isNarrow;
}

/**
 * Thứ người dùng thấy thay cho màn đã sập.
 *
 * Chữ lấy thẳng từ `report.description`, nút "thử lại" chỉ hiện khi lỗi thuộc
 * loại đáng thử lại — cùng khuôn `ScreenCrashFallback` trong `src/App.tsx`.
 * Ranh giới không vẽ gì, mọi màu ở đây đều là token (A1), và không màu nào trong
 * số đó đỏ: màn này nói với một người vừa bị chặn, không tố cáo họ.
 */
function AccessDeniedCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-bg-sunken" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/** Màn thật, bên trong ranh giới lỗi. */
function ConnectedAccessDenied(props: AccessDeniedContainerProps) {
  const isNarrow = useIsNarrow();
  const vm = useAccessDenied({ ...props, isCompact: props.isCompact ?? isNarrow });

  return <AccessDenied {...vm} />;
}

export function AccessDeniedContainer(props: AccessDeniedContainerProps) {
  return (
    <ScreenErrorBoundary
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <AccessDeniedCrashFallback report={report} retry={retry} />
      )}
    >
      <ConnectedAccessDenied {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Bản toàn màn cho route.
 *
 * Không bọc `ScreenErrorBoundary` lần hai — ranh giới đã nằm BÊN TRONG
 * {@link AccessDeniedContainer}, đúng cách `NotFoundRoute` gọi
 * `NotFoundContainer`.
 */
export function AccessDeniedRoute() {
  return <AccessDeniedContainer />;
}
