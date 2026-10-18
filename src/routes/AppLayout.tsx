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

  // Chỉ nghe bộ đệm (skipToken): màn của dự án tự đọc #24, header không gọi thêm lượt nào.
  const detail = useQuery<{ readonly name?: string }>({
    queryKey: queryKeys.project.detail(projectId),
    queryFn: skipToken,
  });
  const projectName =
    location === null ? null : (detail.data?.name?.trim() || null) ?? cachedProjectName(queryClient, projectId);

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
        project={location === null ? null : { id: location.projectId, name: projectName, stepIndex: location.stepIndex }}
        onSignOut={handleSignOut}
      />
      <div data-app-content className="relative flex min-h-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
