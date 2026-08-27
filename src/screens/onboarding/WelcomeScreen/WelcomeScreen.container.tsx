/**
 * Route `ROUTE_PATTERNS.onboarding` — nối hook với view, với hộp
 * thoại tạo dự án, và với ranh giới lỗi.
 *
 * Hai lớp, cùng khuôn `AccountSettings.container.tsx`:
 *
 * - {@link WelcomeScreenContainer} nhận mọi thứ qua props và **không** đọc tham
 *   số nào khỏi URL, nên bất kỳ story hay bài kiểm nào cũng mở được nó bằng một
 *   dòng (R-73).
 * - {@link WelcomeRoute} là tên router mount. Màn này không có tham số đường dẫn
 *   — nó chào người đang đăng nhập — nên route chỉ giao lại.
 *
 * ## `onCreateProject` nối vào đâu, và vì sao phải nối
 *
 * `useWelcomeScreen` để ngỏ `options.onCreateProject` vì một hook không được
 * nhập component, mà luồng tạo dự án trong repo là một **hộp thoại**
 * (`screens/project/CreateProjectModal`) chứ không phải một URL. Một prop tuỳ
 * chọn không ai truyền chính là lỗ hổng R-73 sinh ra để chặn, nên chỗ nối nằm ở
 * đây: trạng thái đóng/mở giữ tại container, `CreateProjectModalContainer` thật
 * được dựng, đúng cách `ProjectDashboard.container.tsx:63-79` đang làm. Người
 * gọi vẫn ghi đè được bằng `props.onCreateProject` — một màn chủ đã có hộp thoại
 * riêng thì dùng của nó, và lúc đó hộp thoại ở đây không bao giờ mở.
 *
 * ## Vì sao `Toast.Provider` nằm trong container chứ không chỉ trong route
 *
 * `CreateProjectModalContainer` nhận `onToast` để trả toast hoàn tác của A8, và
 * `useToast` ném ngay khi không có provider. Đặt provider trong route thôi thì
 * container — thứ story và test mount — sẽ sập. Nên nó nằm **trong** ranh giới
 * lỗi và **trong** container, đúng thứ tự `src/App.tsx:95-105` xếp: ranh giới ở
 * ngoài cùng, để phần dự phòng không phụ thuộc vào provider vừa sập cùng màn.
 */

import { useCallback, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { Toast, useToast } from '@/components/feedback/Toast';
import { useSession } from '@/hooks/useSession';
import { CreateProjectModalContainer } from '@/screens/project/CreateProjectModal';

import { WelcomeScreen } from './WelcomeScreen';
import { useWelcomeScreen, type UseWelcomeScreenOptions } from './useWelcomeScreen';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'onboarding-welcome';

export interface WelcomeScreenContainerProps extends UseWelcomeScreenOptions {}

/** Cùng khuôn với `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function WelcomeCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/** Hook, view, và hộp thoại tạo dự án — ba thứ nối lại thành một màn. */
function WiredWelcomeScreen(props: WelcomeScreenContainerProps) {
  const session = useSession();
  const role = session.roles[0];
  const { addToast } = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const openCreate = useCallback((): void => {
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback((): void => {
    setCreateOpen(false);
  }, []);

  const vm = useWelcomeScreen({
    ...props,
    onCreateProject: props.onCreateProject ?? openCreate,
  });

  return (
    <>
      <WelcomeScreen {...vm} />
      <CreateProjectModalContainer
        isOpen={isCreateOpen}
        onDismiss={closeCreate}
        onToast={addToast}
        {...(role !== undefined ? { role } : {})}
      />
    </>
  );
}

/** `<WelcomeScreenContainer />` — màn chào thật, đã nối. */
export function WelcomeScreenContainer(props: WelcomeScreenContainerProps) {
  return (
    <ScreenErrorBoundary
      key={SCREEN_ID}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => <WelcomeCrashFallback report={report} retry={retry} />}
    >
      <Toast.Provider>
        <WiredWelcomeScreen {...props} />
      </Toast.Provider>
    </ScreenErrorBoundary>
  );
}

/**
 * Route thật của màn chào, đăng ký tại `src/routes/router.tsx`.
 *
 * Không tham số đường dẫn nào để đọc và không provider nào phải thêm — container
 * đã tự đủ — nên lớp này mỏng đúng một dòng. Nó vẫn tồn tại vì router mount tên
 * này, và vì ngày màn chào cần một provider chỉ route mới có thì chỗ thêm là đây.
 */
export function WelcomeRoute() {
  return <WelcomeScreenContainer />;
}
