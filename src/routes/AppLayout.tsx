/**
 * Khung của mọi màn sau đăng nhập: {@link AppHeader} ở trên, màn con lấp phần
 * còn lại. Màn con nào tự đặt `h-dvh`/`h-screen`/`min-h-screen` được
 * `[data-app-content]` (globals.css) thu về 100% vùng dưới header, nên không màn
 * nào phải sửa để chừa chỗ cho header.
 *
 * Chuông tải muộn vì cùng lý do bảng phím tắt tải muộn ở `router.tsx`: khung
 * này nằm trên đường tải đầu của mọi màn.
 */
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppHeader } from '@/components/shell/AppHeader';
import { useSession } from '@/hooks/useSession';
import { signOut } from '@/lib/auth';
import { initialsOf } from '@/lib/format/initials';
import { cachedProjectName } from '@/lib/query/cachedProjectName';
import { queryKeys } from '@/lib/query/queryKeys';

import { ROUTES } from './paths';
import { projectLocationOf } from './projectSteps';

const LazyNotificationBell = lazy(() =>
  import('@/screens/system/NotificationCenter').then((m) => ({ default: m.NotificationBellContainer })),
);

export function AppLayout() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = projectLocationOf(useLocation().pathname);
  const projectId = location?.projectId ?? '';

  // Header tự đọc #24 một lần (dùng chung khóa với màn con).
  const detail = useQuery<{
    readonly name?: string;
    readonly status?: string;
    readonly floors?: readonly { readonly drawings: readonly unknown[] }[];
  }>({
    queryKey: queryKeys.project.detail(projectId),
    // Tự nạp chi tiết khi đang trong dự án, để tên có ở mọi màn (cùng khóa nên dùng chung bộ đệm với màn con).
    queryFn:
      projectId === ''
        ? skipToken
        : async ({ signal }) => {
            const [{ readProjectDetail }, { createAppApiClient }] = await Promise.all([
              import('@/api/floorLayerGraph'),
              import('@/api/appClient'),
            ]);
            return readProjectDetail(createAppApiClient().projects, { projectId, signal });
          },
    staleTime: 60_000,
  });
  const projectName =
    location === null ? null : (detail.data?.name?.trim() || null) ?? cachedProjectName(queryClient, projectId) ?? (detail.isError ? 'Dự án' : null);

  // Nút "Bước tiếp theo" theo trạng thái dự án (G3-06, G3-28, G3-32): chưa có bản vẽ / xử lý lỗi thì không mời đi tiếp.
  const floors = detail.data?.floors;
  const blocker =
    detail.data?.status === 'error'
      ? ('pipeline-error' as const)
      : floors !== undefined && !floors.some((floor) => floor.drawings.length > 0)
        ? ('no-drawings' as const)
        : undefined;

  const handleSignOut = useCallback((): void => {
    void signOut().finally(() => navigate(ROUTES.login));
  }, [navigate]);

  return (
    <div className="flex h-dvh flex-col bg-bg-app">
      <AppHeader
        accountInitials={initialsOf(session.user?.name ?? '', session.user?.email ?? '')}
        accountLabel={session.user?.name || session.user?.email || 'Tài khoản'}
        showAdmin={session.roles.includes('admin')}
        notificationBell={
          <Suspense fallback={null}>
            <LazyNotificationBell />
          </Suspense>
        }
        project={
          location === null
            ? null
            : { id: location.projectId, name: projectName, stepIndex: location.stepIndex, floorId: location.floorId, layerIndex: location.layerIndex, blocker }
        }
        onSignOut={handleSignOut}
      />
      <div data-app-content className="relative flex min-h-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
