/**
 * Route `ROUTE_PATTERNS.billing` — nối hook với view, và với ranh giới lỗi.
 *
 * Hai lớp, cùng khuôn `AccountSettings.container.tsx` và
 * `WelcomeScreen.container.tsx`:
 *
 * - {@link BillingScreenContainer} nhận **mọi thứ** qua props và không gọi
 *   `useParams`, không đọc tham số nào khỏi URL. Nhờ vậy bất kỳ màn, story hay
 *   bài kiểm nào cũng mở được nó bằng một dòng, kể cả khi ở đó chưa có router
 *   nào (R-73). Ba tuỳ chọn nó chuyển tiếp — `gateway`, `announcer`,
 *   `forceCollapsed` — là ba cái seam `useBillingScreen` để ngỏ, nên một chủ
 *   muốn tiêm nguồn dữ liệu khác không phải sửa một dòng nào ở đây.
 * - {@link BillingRoute} là tên router mount. Màn này không có tham số đường dẫn
 *   — hạn mức là hạn mức của tài khoản đang đăng nhập — nên route chỉ giao lại.
 *
 * ## Vì sao không có `Toast.Provider`
 *
 * A8 nói mọi thay đổi hoàn tác được đều kèm toast hoàn tác, còn A9 nói thứ
 * **không** hoàn tác được thì hỏi trước bằng hộp thoại. Đổi gói là một cam kết
 * tài chính: nó đi đường A9 — `onSelect` → `quoteChangePlan` → bảng tóm tắt có
 * số tiền chia theo tỷ lệ → `onConfirmAccept` — nên màn này không sinh toast
 * hoàn tác nào, và một provider không ai dùng chỉ làm cây render nặng thêm.
 * Ngày khối 4 có một hành động hoàn tác được thì chỗ thêm provider là đây, bên
 * **trong** ranh giới lỗi, đúng thứ tự `src/App.tsx:95-105` xếp.
 *
 * ## Ranh giới lỗi
 *
 * Bản ở `@/components/feedback` — bản `src/App.tsx` đang gắn (R-62), **không**
 * phải bản ở `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, cùng khuôn `ProjectDashboard.container.tsx`,
 * `ProjectSettings.container.tsx` và `AccountSettings.container.tsx`.
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';

import { BillingScreen } from './BillingScreen';
import { useBillingScreen, type UseBillingScreenOptions } from './useBillingScreen';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'billing';

export interface BillingScreenContainerProps extends UseBillingScreenOptions {}

/** Cùng khuôn với `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function BillingCrashFallback({ report, retry }: ScreenErrorFallback) {
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
function WiredBillingScreen(props: BillingScreenContainerProps) {
  const vm = useBillingScreen(props);

  return <BillingScreen {...vm} />;
}

/** `<BillingScreenContainer />` — màn thanh toán thật, đã nối. */
export function BillingScreenContainer(props: BillingScreenContainerProps) {
  return (
    <ScreenErrorBoundary
      key={SCREEN_ID}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => <BillingCrashFallback report={report} retry={retry} />}
    >
      <WiredBillingScreen {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Route thật của màn thanh toán, đăng ký tại `src/routes/router.tsx`.
 *
 * Không tham số đường dẫn nào để đọc và không provider nào phải thêm — container
 * đã tự đủ — nên lớp này mỏng đúng một dòng. Nó vẫn tồn tại vì router mount tên
 * này, và vì ngày màn cần một provider chỉ route mới có thì chỗ thêm là đây.
 */
export function BillingRoute() {
  return <BillingScreenContainer />;
}
