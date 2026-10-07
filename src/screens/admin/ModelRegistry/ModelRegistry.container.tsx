/**
 * Lớp ráp của màn registry model (`/admin/training/models`): client, cổng, ngưỡng thu gọn,
 * ranh giới lỗi — khuôn `UserManagement.container.tsx`.
 *
 * Client mặc định dựng TRONG `useMemo` chứ không ở cấp module (R13): trong vitest và
 * Storybook `resolveUseMockApi()` là `false`, nên bài kiểm và story tiêm client giả tường
 * minh qua prop `client`.
 */

import { useEffect, useMemo, useState } from 'react';

import { createAppAdminMlClient, type AdminMlClient } from '@/api/adminMlClient';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { appNotificationBus } from '@/hooks/useNotifications';
import type { NotificationBus } from '@/lib/mutations/notificationBus';

import { ModelRegistry } from './ModelRegistry';
import { createModelRegistryGateway } from './modelRegistryGateway';
import type { RelatedLinkModel } from './types';
import { COLLAPSE_BREAKPOINT_PX, useModelRegistry } from './useModelRegistry';

const SCREEN_ID = 'model-registry';
const NARROW_QUERY = `(max-width: ${String(COLLAPSE_BREAKPOINT_PX - 1)}px)`;

export interface ModelRegistryContainerProps {
  /** Client tiêm cho test và story. Không truyền thì container dựng client của ứng dụng. */
  readonly client?: AdminMlClient;
  /** Bus toast tiêm được; mặc định là bus của phiên mà `NotificationHost` vẽ. */
  readonly notifications?: NotificationBus;
  /** Ép bố cục hẹp bất kể bề ngang thật. */
  readonly forceCompact?: boolean;
  readonly now?: () => number;
  /** Liên kết sang màn huấn luyện; mặc định là `TRAINING_JOBS_LINK` của hook, `null` thì ẩn. */
  readonly relatedLink?: RelatedLinkModel | null;
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

function ModelRegistryCrashFallback({ report, retry }: ScreenErrorFallback) {
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

function WiredModelRegistry({
  client: injectedClient,
  forceCompact = false,
  notifications = appNotificationBus,
  now,
  relatedLink,
}: ModelRegistryContainerProps) {
  const mediaIsNarrow = useIsNarrow();

  const gateway = useMemo(
    () =>
      createModelRegistryGateway({
        client: injectedClient ?? createAppAdminMlClient(),
        notifications,
        ...(now !== undefined ? { now } : {}),
      }),
    [injectedClient, notifications, now],
  );

  const { actions, model } = useModelRegistry({
    gateway,
    isNarrow: forceCompact || mediaIsNarrow,
    ...(relatedLink !== undefined ? { relatedLink } : {}),
  });

  return <ModelRegistry actions={actions} model={model} />;
}

export function ModelRegistryContainer(props: ModelRegistryContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => <ModelRegistryCrashFallback report={report} retry={retry} />}
      screenId={SCREEN_ID}
    >
      <WiredModelRegistry {...props} />
    </ScreenErrorBoundary>
  );
}

/** Route thật, đăng ký tại `src/routes/router.tsx`. */
export function ModelRegistryRoute() {
  return <ModelRegistryContainer />;
}
