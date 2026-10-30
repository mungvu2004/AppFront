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
import { LAST_PROJECT_KEY, lastFloorPathKey, signOut } from '@/lib/auth';
import { initialsOf } from '@/lib/format/initials';
import { cachedProjectName } from '@/lib/query/cachedProjectName';
import { queryKeys } from '@/lib/query/queryKeys';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { ROUTES } from './paths';
import { projectLocationOf, projectScreenTitleOf, projectStepStates } from './projectSteps';

/** Đích của skip link "Bỏ qua tới nội dung": vùng chứa màn con dưới header. */
const MAIN_CONTENT_ID = 'noi-dung';

/** Tên màn ngoài dự án cho tiêu đề tab. */
function appScreenTitleOf(pathname: string): string | null {
  if (pathname === ROUTES.dashboard) return 'Dự án';
  if (pathname.startsWith('/admin')) return 'Quản trị';
  if (pathname.startsWith(ROUTES.account)) return 'Tài khoản';
  if (pathname === ROUTES.notifications) return 'Thông báo';
  if (pathname === ROUTES.accessDenied) return 'Không có quyền';
  if (pathname === ROUTES.onboarding || pathname.startsWith('/m/')) return null; // giữ như cũ: không đặt tên màn
  // Còn lại trong khung này là route `*` (gồm đường lạ trong dự án, xem projectLocationOf).
  return 'Không tìm thấy trang';
}

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
    readonly floors?: readonly { readonly id?: string; readonly drawings: readonly unknown[]; readonly areaM2?: number }[];
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
    // Dải góc phải "Đang xử lý" phải tắt ngay khi AI xong/lỗi, không đợi hết bộ đệm 60 giây.
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 5_000 : false),
  });
  const projectName =
    location === null ? null : (detail.data?.name?.trim() || null) ?? cachedProjectName(queryClient, projectId) ?? (detail.isError ? 'Dự án' : null);

  // N4-05: nhớ dự án vừa rời để màn Quản trị có lối quay về đúng chỗ.
  const [lastProject, setLastProject] = useState<{ readonly id: string; readonly name: string } | null>(() => readLastProject());
  // RV5 #4: chỉ nhớ dự án đọc được; 403/404 (đã xoá, không quyền) không thành lối "Về dự án".
  const rememberedName = detail.isSuccess ? projectName : null;
  useEffect(() => {
    if (projectId === '' || rememberedName === null) return;
    const next = { id: projectId, name: rememberedName };
    setLastProject(next);
    try {
      sessionStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(next));
    } catch {
      /* sessionStorage có thể bị chặn: lối quay về chỉ là tiện ích. */
    }
  }, [projectId, rememberedName]);

  // G4a-34/N4-08: nhớ màn kiểm tra tầng gần nhất của từng dự án (đường có `/floors/<tầng>/`).
  const floorPathKey = lastFloorPathKey(projectId);
  useEffect(() => {
    if (location?.floorId === undefined) return;
    try {
      sessionStorage.setItem(floorPathKey, routerLocation.pathname);
    } catch {
      /* sessionStorage bị chặn: ô bước 3 về danh sách tầng như cũ. */
    }
  }, [floorPathKey, location?.floorId, routerLocation.pathname]);
  const floors = detail.data?.floors;
  let lastFloorPath: string | undefined;
  try {
    lastFloorPath = projectId === '' ? undefined : (sessionStorage.getItem(floorPathKey) ?? undefined);
  } catch {
    lastFloorPath = undefined;
  }
  // RV5 #2: tầng đã xoá (hoặc chưa biết danh sách tầng) thì ô bước 3 về danh sách tầng, không mở đường chết.
  const lastFloorId = lastFloorPath === undefined ? undefined : projectLocationOf(lastFloorPath)?.floorId;
  if (lastFloorId === undefined || floors?.some((floor) => floor.id === lastFloorId) !== true) lastFloorPath = undefined;

  // Nút "Tiếp: <bước>" theo trạng thái dự án (G3-06, G3-28, G3-32): chưa có bản vẽ / xử lý lỗi thì không mời đi tiếp.
  const blocker =
    detail.data?.status === 'error'
      ? ('pipeline-error' as const)
      : detail.data?.status === 'processing' && location?.stepIndex !== 0
        ? ('processing' as const) // J-4; màn Tải bản vẽ có nút "Bắt đầu xử lý" riêng nên không hiện dải này: đang xử lý thì không mời tải bản vẽ lần nữa
        : floors !== undefined && !floors.some((floor) => floor.drawings.length > 0)
          ? ('no-drawings' as const)
          : undefined;

  // Bước 2 "xong" khi có tầng đã ra kết quả xử lý, không đợi dự án duyệt.
  const stepStates = projectStepStates({
    status: detail.data?.status,
    // ponytail: tầng 0 m² (AI không dựng được phòng nào) vẫn coi là chưa xử lý; cần cờ "đã xử lý" từ BE nếu hay gặp.
    hasProcessedFloor: floors?.some((floor) => floor.drawings.length > 0 && (floor.areaM2 ?? 0) > 0),
    hasDrawings: floors?.some((floor) => floor.drawings.length > 0),
  });

  // Tiêu đề tab tiếng Việt cho mọi màn sau đăng nhập: "<Màn> · <Dự án> · AppFront".
  const screenTitle = location === null ? appScreenTitleOf(routerLocation.pathname) : projectScreenTitleOf(routerLocation.pathname);
  useDocumentTitle([screenTitle, projectName].filter((part): part is string => part !== null && part !== '').join(' · ') || null);

  const handleSignOut = useCallback((): void => {
    void signOut().finally(() => navigate(ROUTES.login));
  }, [navigate]);

  return (
    <div className="flex h-dvh flex-col bg-bg-app">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only z-[100] rounded-md bg-bg-surface px-4 py-2 text-[13px] font-medium text-accent shadow-float focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:outline-hidden focus:ring-2 focus:ring-accent"
        onClick={(event) => {
          // Đưa focus vào vùng nội dung (không đổi URL, router không bắt hash).
          event.preventDefault();
          document.getElementById(MAIN_CONTENT_ID)?.focus();
        }}
      >
        Bỏ qua tới nội dung
      </a>
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
            : { id: location.projectId, name: projectName, stepIndex: location.stepIndex, floorId: location.floorId, layerIndex: location.layerIndex, blocker, lastFloorPath, stepStates }
        }
        returnProject={lastProject}
        onSignOut={handleSignOut}
      />
      <div data-app-content id={MAIN_CONTENT_ID} tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col overflow-auto outline-hidden">
        <Outlet />
      </div>
    </div>
  );
}
