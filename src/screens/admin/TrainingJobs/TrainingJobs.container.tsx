/**
 * Lớp ráp của màn huấn luyện (`/admin/training/jobs`): client, cổng, ngưỡng thu gọn, ranh
 * giới lỗi — khuôn `ModelRegistry.container.tsx`.
 *
 * Client mặc định dựng TRONG `useMemo` chứ không ở cấp module (R13): trong vitest và
 * Storybook `resolveUseMockApi()` là `false`, nên bài kiểm và story tiêm client tường minh.
 */

import { useEffect, useMemo, useState } from 'react';

import { createAppAdminMlJobsClient, type AdminMlJobsClient } from '@/api/adminMlJobsClient';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { appNotificationBus } from '@/hooks/useNotifications';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import type { ChannelClock } from '@/lib/realtime/eventChannel';
import type { PollingVisibilityTarget } from '@/lib/realtime/cursorPolling';

import { TrainingJobs } from './TrainingJobs';
import { createTrainingJobsGateway } from './trainingJobsGateway';
import { COLLAPSE_BREAKPOINT_PX, useTrainingJobs } from './useTrainingJobs';

const SCREEN_ID = 'training-jobs';
const NARROW_QUERY = `(max-width: ${String(COLLAPSE_BREAKPOINT_PX - 1)}px)`;

export interface TrainingJobsContainerProps {
  /** Client tiêm cho test và story. Không truyền thì container dựng client của ứng dụng. */
  readonly client?: AdminMlJobsClient;
  readonly notifications?: NotificationBus;
  readonly forceCompact?: boolean;
  readonly now?: () => number;
  readonly createKey?: () => string;
  /** Đồng hồ và đích hiển thị của luồng số đo/nhật ký — bài kiểm tiêm. */
  readonly clock?: ChannelClock;
  readonly visibilityTarget?: PollingVisibilityTarget;
}

function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const listener = (event: MediaQueryListEvent): void => {
      setIsNarrow(event.matches);
    };

    setIsNarrow(media.matches);
    media.addEventListener('change', listener);

    return (): void => {
      media.removeEventListener('change', listener);
    };
  }, []);

  return isNarrow;
}

function TrainingJobsCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-state-violation-tint" />}
        title={report.description.title}
        {...(report.retryable ? { action: { label: report.description.primaryButtonLabel, onClick: retry } } : {})}
      />
    </div>
  );
}

function WiredTrainingJobs({
  client: injectedClient,
  clock,
  createKey,
  forceCompact = false,
  notifications = appNotificationBus,
  now,
  visibilityTarget,
}: TrainingJobsContainerProps) {
  const mediaIsNarrow = useIsNarrow();

  const gateway = useMemo(
    () =>
      createTrainingJobsGateway({
        client: injectedClient ?? createAppAdminMlJobsClient(),
        notifications,
        ...(now !== undefined ? { now } : {}),
        ...(createKey !== undefined ? { createKey } : {}),
      }),
    [injectedClient, notifications, now, createKey],
  );

  const { actions, model } = useTrainingJobs({
    gateway,
    isNarrow: forceCompact || mediaIsNarrow,
    ...(clock !== undefined ? { clock } : {}),
    ...(visibilityTarget !== undefined ? { visibilityTarget } : {}),
  });

  return <TrainingJobs actions={actions} model={model} />;
}

export function TrainingJobsContainer(props: TrainingJobsContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => <TrainingJobsCrashFallback report={report} retry={retry} />}
      screenId={SCREEN_ID}
    >
      <WiredTrainingJobs {...props} />
    </ScreenErrorBoundary>
  );
}

/** Route thật, đăng ký tại `src/routes/router.tsx`. */
export function TrainingJobsRoute() {
  return <TrainingJobsContainer />;
}
