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
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppHeader } from '@/components/shell/AppHeader';
import { rememberAppPath } from '@/pascal-page/bridge/backHref';
import { useSession } from '@/hooks/useSession';
import { signOut } from '@/lib/auth';
import { initialsOf } from '@/lib/format/initials';
import { cachedProjectName } from '@/lib/query/cachedProjectName';
import { queryKeys } from '@/lib/query/queryKeys';

import { ROUTES } from './paths';

const LAST_PROJECT_KEY = 'appfront.lastProject';

function readLastProject(): { readonly id: string; readonly name: string } | null {
  try {
    const raw = sessionStorage.getItem(LAST_PROJECT_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && 'id' in parsed && 'name' in parsed
      ? { id: String(parsed.id), name: String(parsed.name) }
      : null;
  } catch {
    return null;
  }
}
import { projectLocationOf } from './projectSteps';

const LazyNotificationBell = lazy(() =>
  import('@/screens/system/NotificationCenter').then((m) => ({ default: m.NotificationBellContainer })),
);

export function AppLayout() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routerLocation = useLocation();
  const location = projectLocationOf(routerLocation.pathname);
  // N1-01/N5-13/N3-09: trang 3D (tài liệu riêng) đọc đường này để "Về dự án" về đúng màn vừa rời.
  useEffect(() => {
    rememberAppPath(routerLocation.pathname + routerLocation.search);
  }, [routerLocation.pathname, routerLocation.search]);
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

  // N4-05: nhớ dự án vừa rời để màn Quản trị có lối quay về đúng chỗ.
  const [lastProject, setLastProject] = useState<{ readonly id: string; readonly name: string } | null>(() => readLastProject());
  useEffect(() => {
    if (projectId === '' || projectName === null) return;
    const next = { id: projectId, name: projectName };
    setLastProject(next);
    try {
      sessionStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(next));
    } catch {
      /* sessionStorage có thể bị chặn: lối quay về chỉ là tiện ích. */
    }
  }, [projectId, projectName]);

  // G4a-34/N4-08: nhớ màn kiểm tra tầng gần nhất của từng dự án (đường có `/floors/<tầng>/`).
  const floorPathKey = `appfront.lastFloorPath.${projectId}`;
  useEffect(() => {
    if (location?.floorId === undefined) return;
    try {
      sessionStorage.setItem(floorPathKey, routerLocation.pathname);
    } catch {
      /* sessionStorage bị chặn: ô bước 3 về danh sách tầng như cũ. */
    }
  }, [floorPathKey, location?.floorId, routerLocation.pathname]);
  let lastFloorPath: string | undefined;
  try {
    lastFloorPath = projectId === '' ? undefined : (sessionStorage.getItem(floorPathKey) ?? undefined);
  } catch {
    lastFloorPath = undefined;
  }

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
            : { id: location.projectId, name: projectName, stepIndex: location.stepIndex, floorId: location.floorId, layerIndex: location.layerIndex, blocker, lastFloorPath }
        }
        returnProject={lastProject}
        onSignOut={handleSignOut}
      />
      <div data-app-content className="relative flex min-h-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
