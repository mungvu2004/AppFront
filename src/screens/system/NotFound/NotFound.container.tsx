/**
 * Màn "không tìm thấy trang" — bọc `useNotFound` với ranh giới lỗi và nối đủ
 * props để bất cứ màn nào cũng mở được nó mà không phải viết thêm một dòng
 * logic (R-73). Cùng khuôn `NotificationCenter.container.tsx`.
 *
 * - {@link NotFoundContainer} nhận mọi thứ qua props (mở rộng
 *   {@link UseNotFoundOptions}), và mọi hành động ra ngoài đã được nối sẵn:
 *   `useNotFound` tự giữ `useNavigate()`/`useLocation()` bên trong nó, nên
 *   không có một `onNavigate` tuỳ chọn nào để người gọi quên truyền.
 * - {@link NotFoundRoute} là bản toàn màn của route `*`.
 *
 * ## Vì sao `isCompact` đo ở ĐÂY chứ không ở hook
 *
 * `useNotFound` cố ý nhận `isCompact` qua tuỳ chọn thay vì tự suy ra: viết một
 * `useNarrowViewport` thứ sáu trong tầng hook là dựng nguồn sự thật thứ sáu cho
 * cùng một ngưỡng (R-71, xem docblock `useNotFound.ts`). Nhưng để trống thì
 * trạng thái `collapsed` KHÔNG BAO GIỜ xảy ra ở sản phẩm thật — bảy trạng thái
 * xanh trong bài kiểm mà chỉ sáu cái tồn tại thật, đúng kiểu thiếu sót không ai
 * nhìn thấy. Nên container đo, đúng chỗ và đúng khuôn
 * `VersionHistory.container.tsx:61-98` (và `ModelLibrary.container.tsx`) đã làm:
 * ngưỡng là một hằng CÓ TÊN, sống trong thư mục màn, không rò ra ngoài.
 *
 * Người gọi vẫn ghi đè được bằng `isCompact` — một màn chủ đã tự biết mình hẹp
 * thì không cần đo lần hai.
 *
 * ## Vì sao dùng `ScreenErrorBoundary` của `components/feedback`
 *
 * Repo có hai thứ trùng tên. `src/lib/screen-state/screenErrorBoundary.ts` là
 * hàm dựng báo cáo, không phải component React — `src/lib` cấm React (mục 0.4),
 * nên nó không thể là ranh giới lỗi. Ranh giới thật là component ở
 * `components/feedback/ScreenErrorBoundary.tsx`, đúng cái `src/App.tsx` và
 * `NotificationCenter.container.tsx` đang dùng.
 */

import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';

import { NotFound } from './NotFound';
import { useNotFound, type UseNotFoundOptions } from './useNotFound';

/** Đặt tên màn cho ranh giới lỗi, và cho bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'system-not-found';

/** Trạng thái 7 của hợp đồng: dưới 1024 thì bỏ hình minh hoạ, thu khoảng cách. */
const NARROW_QUERY = '(max-width: 1023px)';

export interface NotFoundContainerProps extends UseNotFoundOptions {}

/**
 * Ngưỡng thu gọn, theo dõi tại chỗ.
 *
 * `useAppShell.ts:5` có một `useBreakpoint` làm đúng việc này nhưng nó là hàm
 * riêng tư của file đó, và lượt này không được sửa `src/hooks`. Nên đây là bản
 * chép ngắn của cùng khuôn (`VersionHistory.container.tsx:77-98`), sống trong
 * thư mục màn và không rò ra ngoài.
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
 * Ranh giới không vẽ gì, mọi màu ở đây đều là token (A1).
 */
function NotFoundCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
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
function WiredNotFound(props: NotFoundContainerProps) {
  const isNarrow = useIsNarrow();
  const vm = useNotFound({ ...props, isCompact: props.isCompact ?? isNarrow });

  return <NotFound {...vm} />;
}

export function NotFoundContainer(props: NotFoundContainerProps) {
  return (
    <ScreenErrorBoundary
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <NotFoundCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredNotFound {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Bản toàn màn của route `*`.
 *
 * Không bọc `ScreenErrorBoundary` lần hai — ranh giới đã nằm BÊN TRONG
 * {@link NotFoundContainer}, đúng cách `NotificationCenterRoute` gọi
 * `NotificationCenterContainer`.
 */
export function NotFoundRoute() {
  return <NotFoundContainer />;
}
