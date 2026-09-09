/**
 * Trung tâm thông báo — bọc `useNotificationCenter` với ranh giới lỗi và nối đủ
 * props để mở được từ bất cứ màn nào mà không phải viết thêm một dòng logic.
 *
 * Cùng khuôn `EditorTour.container.tsx`:
 *
 * - {@link NotificationCenterContainer} nhận mọi thứ qua props (mở rộng
 *   `UseNotificationCenterOptions`) và tự nối `onNavigate` mặc định vào
 *   router — R-73 cấm để một hành động ra ngoài chỉ tồn tại như một prop tuỳ
 *   chọn không ai truyền. Người gọi vẫn ghi đè được từng trường.
 * - {@link NotificationBellContainer} là cái chuông, xuất RIÊNG. `AppShell.tsx`
 *   nằm trong `src/components/**` — thư mục R-68 khoá — nên màn này không gắn
 *   được vào vỏ ứng dụng; nó cấp một chuông đã nối đủ để bất kỳ vỏ nào cũng
 *   gắn vào bằng một dòng khi vỏ ấy mở khoá.
 * - {@link NotificationCenterRoute} là bản toàn màn cho `/thong-bao`.
 *
 * ## Vì sao `isOpen`/`onDismiss` là props chứ không phải trạng thái nội bộ
 *
 * Hôm nay chưa có màn nào mở tấm trượt này. R-73 nói thẳng rằng "chưa có ai
 * dùng" không phải lý do hoãn: một màn chủ đã giữ sẵn trạng thái mở của riêng
 * nó (một menu, một phím tắt) phải cắm vào được mà không sinh ra nguồn sự thật
 * thứ hai. Nên `isOpen` truyền xuống thì hook nhường quyền giữ, bỏ trống thì
 * hook tự giữ và `onToggle` đủ dùng cho một cái chuông đứng một mình.
 *
 * ## Vì sao dùng `ScreenErrorBoundary` của `components/feedback`
 *
 * Repo có hai thứ trùng tên. `src/lib/screen-state/screenErrorBoundary.ts` là
 * hàm dựng báo cáo, không phải component React — `src/lib` cấm React (mục 0.4),
 * nên nó không thể là ranh giới lỗi. Ranh giới thật là component ở
 * `components/feedback/ScreenErrorBoundary.tsx`, đúng cái `src/App.tsx` và
 * `EditorTour.container.tsx` đang dùng.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';

import { NotificationBell, NotificationCenter } from './NotificationCenter';
import { useNotificationCenter, type UseNotificationCenterOptions } from './useNotificationCenter';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'system-notification-center';

export interface NotificationCenterContainerProps extends UseNotificationCenterOptions {
  /**
   * Đóng tấm trượt, nhìn từ phía màn chủ.
   *
   * Tên khác `onClose` của hook một cách có chủ ý: `onClose` là thứ hook GỌI
   * sau khi điều hướng xong, còn đây là thứ màn chủ dùng để hạ cờ mở của chính
   * nó. Hai vai khác nhau, và gộp tên lại là cách chắc chắn để một hôm nào đó
   * có người nối nhầm vòng.
   */
  readonly onDismiss?: (() => void) | undefined;
}

/** Thẻ nhỏ thay cho tấm trượt khi nó sập — không chắn thao tác của màn bên dưới. */
function NotificationCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto max-w-sm rounded-lg border border-border-default bg-bg-surface shadow-overlay">
        <EmptyState
          icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
          title={report.description.title}
          description={report.description.description}
          {...(report.retryable
            ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
            : {})}
        />
      </div>
    </div>
  );
}

/**
 * Nối `onNavigate`/`onClose` mặc định vào router một lần, cho cả tấm trượt lẫn
 * chuông — hai nơi gọi cùng một hook nên chúng phải nối giống hệt nhau.
 */
function useWiredNotificationCenter(props: NotificationCenterContainerProps) {
  const navigate = useNavigate();
  const { onDismiss, ...options } = props;

  const goTo = useCallback(
    (to: string): void => {
      navigate(to);
    },
    [navigate],
  );

  // `exactOptionalPropertyTypes` bật: một `onClose: undefined` viết thẳng ra
  // KHÔNG giống với việc bỏ trống trường ấy, nên nó chỉ được có mặt khi thật sự
  // có hàm để truyền.
  const onClose = options.onClose ?? onDismiss;

  return useNotificationCenter({
    ...options,
    onNavigate: options.onNavigate ?? goTo,
    ...(onClose === undefined ? {} : { onClose }),
  });
}

/** Hook và view — nối lại thành một tấm trượt đã sẵn sàng. */
function WiredNotificationCenter(props: NotificationCenterContainerProps) {
  const vm = useWiredNotificationCenter(props);

  return <NotificationCenter {...vm} />;
}

/** `<NotificationCenterContainer />` — tấm trượt thông báo, đã nối, một dòng là mở được. */
export function NotificationCenterContainer(props: NotificationCenterContainerProps) {
  return (
    <ScreenErrorBoundary
      key={SCREEN_ID}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <NotificationCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredNotificationCenter {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Chuông và tấm trượt của nó, dùng CHUNG một lượt gọi hook.
 *
 * Hai lượt gọi sẽ là hai `isOpen` và hai bộ đếm chưa đọc, và cái chuông sẽ hiện
 * một con số mà tấm trượt không đồng ý.
 */
function WiredNotificationBell(props: NotificationCenterContainerProps) {
  const vm = useWiredNotificationCenter(props);

  return (
    <>
      <NotificationBell
        unreadBadge={vm.unreadBadge}
        isOpen={vm.isOpen}
        onToggle={vm.onToggle}
        bellNudgeToken={vm.bellNudgeToken}
      />
      <NotificationCenter {...vm} />
    </>
  );
}

/** `<NotificationBellContainer />` — chuông + tấm trượt, một khối, cho một vỏ bất kỳ. */
export function NotificationBellContainer(props: NotificationCenterContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${SCREEN_ID}-bell`}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <NotificationCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredNotificationBell {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Bản toàn màn cho `/thong-bao` — trạng thái 7 "thu gọn, toàn màn".
 *
 * `isOpen` ghim `true` và `onDismiss` đưa người dùng lùi lại: ở một route thì
 * không có màn chủ nào để trượt về, nên "đóng" nghĩa là rời route.
 */
export function NotificationCenterRoute() {
  const navigate = useNavigate();

  const goBack = useCallback((): void => {
    navigate(-1);
  }, [navigate]);

  return <NotificationCenterContainer isOpen isCompact onDismiss={goBack} />;
}
