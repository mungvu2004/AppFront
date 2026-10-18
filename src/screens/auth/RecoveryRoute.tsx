/**
 * Ranh giới lỗi của hai màn mở từ thư, cùng khuôn với `AuthRoute`: không có nó, một
 * ngoại lệ bên dưới làm trắng trang đúng ở màn người dùng không có đường nào khác để đi
 * (A11). Nằm trong thư mục màn, không ở `src/components`.
 */

import { useLocation } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';

function CrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <main className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </main>
  );
}

export function RecoveryRoute({
  screenId,
  children,
}: {
  readonly screenId: string;
  readonly children: React.ReactNode;
}) {
  // Mở link khác (đổi `#token=`) trong cùng tab phải dựng lại màn, không giữ mã cũ trong state (G1-01).
  const { key, hash } = useLocation();

  return (
    <ScreenErrorBoundary
      key={`${key}${hash}`}
      screenId={screenId}
      renderFallback={({ report, retry }) => <CrashFallback report={report} retry={retry} />}
    >
      {children}
    </ScreenErrorBoundary>
  );
}
