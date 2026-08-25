/**
 * Route `ROUTE_PATTERNS.projectSettings`, nối với client thật, với bộ đệm query
 * và với router.
 *
 * Hai lớp, cố ý tách:
 *
 * - {@link ProjectSettingsContainer} nhận đủ mọi thứ qua props và **không** gọi
 *   `useToast` hay `useParams`. Nhờ vậy bất kỳ màn nào cũng mở được nó bằng một
 *   dòng — `<ProjectSettingsContainer projectId={id} />` — kể cả khi ở đó chưa
 *   có `Toast.Provider` nào (R-73). Cùng lý do `CreateProjectModal.container.tsx`
 *   nhận `onToast` làm prop thay vì tự đi tìm provider.
 * - {@link ProjectSettingsRoute} là nơi duy nhất biết tới router: nó đọc `:id`
 *   khỏi URL, đọc vai khỏi phiên làm việc, dựng `Toast.Provider`, và điều hướng
 *   về bảng dự án sau khi dự án bị xoá.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản đang được `src/App.tsx`
 * gắn (R-62). Phần dự phòng dựng bằng `EmptyState` từ `report.description`,
 * cùng khuôn `ProjectDashboard.container.tsx`.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { Toast, useToast } from '@/components/feedback/Toast';
import { useSession } from '@/hooks/useSession';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import { ProjectSettingsView } from './ProjectSettings';
import { createAppProjectSettingsGateway } from './projectSettingsGateway';
import { useProjectSettings } from './useProjectSettings';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'project-settings';

export interface ProjectSettingsContainerProps {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Toast của A8. Tiêm vào bởi nơi đã dựng `Toast.Provider`. */
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void }) => void;
  readonly onProjectDeleted?: () => void;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/** Cùng khuôn với `DashboardCrashFallback` — R-62. */
function ProjectSettingsCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/**
 * Hook cộng view, không có provider nào ở giữa.
 *
 * Gọi thẳng `useProjectSettings` thay vì mượn `ProjectSettingsConnected`: bản
 * đó gọi `useToast()`, tức nó ném lỗi ở bất cứ đâu chưa có provider — đúng thứ
 * container này tồn tại để tránh.
 */
function WiredProjectSettings(props: ProjectSettingsContainerProps) {
  const gateway = useMemo(() => createAppProjectSettingsGateway(), []);

  const model = useProjectSettings({
    gateway,
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onToast !== undefined ? { onToast: props.onToast } : {}),
    ...(props.onProjectDeleted !== undefined ? { onProjectDeleted: props.onProjectDeleted } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
  });

  return <ProjectSettingsView {...model} />;
}

/** `<ProjectSettingsContainer projectId={...} />` — màn cài đặt thật, đã nối. */
export function ProjectSettingsContainer(props: ProjectSettingsContainerProps) {
  return (
    <ScreenErrorBoundary
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <ProjectSettingsCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredProjectSettings {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong `Toast.Provider`, nên `useToast` ở đây chắc chắn tìm được provider. */
function ProjectSettingsRouteBody({ projectId, roles }: { projectId: string; roles: readonly ProjectRole[] }) {
  const { addToast } = useToast();
  const navigate = useNavigate();

  return (
    <ProjectSettingsContainer
      projectId={projectId}
      roles={roles}
      onToast={addToast}
      onProjectDeleted={() => navigate(ROUTES.dashboard)}
    />
  );
}

/** Route thật của màn cài đặt, đăng ký tại `src/routes/router.tsx`. */
export function ProjectSettingsRoute() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();

  if (id === undefined || id.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          title="Không xác định được dự án"
          message="Đường dẫn thiếu mã dự án, nên không biết phải mở cài đặt của dự án nào."
        />
      </div>
    );
  }

  return (
    <Toast.Provider>
      <ProjectSettingsRouteBody projectId={id} roles={session.roles} />
    </Toast.Provider>
  );
}
