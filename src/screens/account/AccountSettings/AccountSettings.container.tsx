/**
 * Route `ROUTE_PATTERNS.account` (`/tai-khoan`), nối hook với view và với ranh
 * giới lỗi.
 *
 * Hai lớp, cùng khuôn `ProjectSettings.container.tsx`:
 *
 * - {@link AccountSettingsContainer} nhận đủ mọi thứ qua props và **không** gọi
 *   `useParams`. Nhờ vậy bất kỳ màn nào cũng mở được nó bằng một dòng, kể cả
 *   khi ở đó chưa có router nào (R-73).
 * - {@link AccountSettingsRoute} là tên router mount. Màn này không đọc tham số
 *   nào khỏi URL — tài khoản là tài khoản đang đăng nhập — nên nó chỉ thêm
 *   `Toast.Provider` cho toast hoàn tác của A8, rồi giao lại.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản `src/App.tsx` đang gắn
 * (R-62). Phần dự phòng dựng bằng `EmptyState` từ `report.description`, cùng
 * khuôn `ProjectDashboard.container.tsx` và `ProjectSettings.container.tsx`.
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { Toast } from '@/components/feedback/Toast';

import { AccountSettings } from './AccountSettings';
import { useAccountSettings, type UseAccountSettingsOptions } from './useAccountSettings';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'account-settings';

export interface AccountSettingsContainerProps extends UseAccountSettingsOptions {}

/** Cùng khuôn với `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function AccountSettingsCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/** Hook cộng view, không có provider nào ở giữa. */
function WiredAccountSettings(props: AccountSettingsContainerProps) {
  const vm = useAccountSettings(props);

  return <AccountSettings vm={vm} />;
}

/** `<AccountSettingsContainer />` — màn cài đặt tài khoản thật, đã nối. */
export function AccountSettingsContainer(props: AccountSettingsContainerProps) {
  return (
    <ScreenErrorBoundary
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <AccountSettingsCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredAccountSettings {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Route thật của màn cài đặt tài khoản, đăng ký tại `src/routes/router.tsx`.
 *
 * `Toast.Provider` dựng ở đây chứ không ở trong container: A8 nói mọi thay đổi
 * hoàn tác được đều kèm một toast hoàn tác, và ba khối sẽ cần tới nó — nhưng
 * story và test phải dựng được container mà không bắt buộc phải có provider.
 */
export function AccountSettingsRoute() {
  return (
    <Toast.Provider>
      <AccountSettingsContainer />
    </Toast.Provider>
  );
}
