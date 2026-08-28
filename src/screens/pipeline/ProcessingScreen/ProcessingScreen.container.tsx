/**
 * Route `ROUTE_PATTERNS.projectPipeline`, nối hook với router.
 *
 * Cùng khuôn `InputQualityGate.container.tsx` — hai lớp, cố ý tách:
 *
 * - {@link ProcessingScreenContainer} nhận đủ mọi thứ qua props và **không** gọi
 *   `useNavigate` hay `useParams`, nên bất kỳ màn nào cũng mở được nó bằng một
 *   dòng, kể cả trong test hay story (R-73).
 * - {@link ProcessingScreenRoute} là nơi duy nhất biết tới router. Nó chưa được
 *   đăng ký ở `src/routes/router.tsx` — route đó vẫn là `<Placeholder>` (phạm vi
 *   `src/routes/**` không thuộc nhiệm vụ này) — nhưng đã đủ hình dạng để nhiệm vụ
 *   nối route thật cắm vào bằng một dòng `lazy(...)`.
 *
 * `useProcessingScreen` hiện NÉM LỖI ở mọi lượt gọi (xem file đó) vì bốn endpoint
 * xử lý chưa tồn tại. `ScreenErrorBoundary` (bản đã gắn ở `src/App.tsx`, R-62) bắt
 * đúng lỗi đó và vẽ phần dự phòng bằng `EmptyState`, nên màn không bao giờ trắng
 * (A11) dù logic thật chưa xong.
 */

import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import type { ProjectRole } from '@/types/project';

import { ProcessingScreen } from './ProcessingScreen';
import type { ProcessingGateway } from './processingGateway';
import { useProcessingScreen } from './useProcessingScreen';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'processing-screen';

const MISSING_PROJECT_TITLE = 'Không xác định được dự án';
const MISSING_PROJECT_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên không biết phải mở màn xử lý của dự án nào.';

export interface ProcessingScreenContainerProps {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Điều hướng sau khi bấm các hành động của màn (ví dụ xem lại tường). */
  readonly onNavigate?: (path: string) => void;
  /**
   * Cổng dữ liệu. KHÔNG có mặc định thật bên trong hook (khác `InputQualityGate`):
   * `processingGateway.ts` chưa có factory, vì chưa có endpoint thật nào để gọi.
   */
  readonly gateway?: ProcessingGateway;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/** Cùng khuôn với `InputQualityGateCrashFallback` — R-62. */
function ProcessingScreenCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-state-violation-tint" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/** Hook cộng view, không có provider nào ở giữa. */
function WiredProcessingScreen(props: ProcessingScreenContainerProps) {
  const screenProps = useProcessingScreen({
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
  });

  return <ProcessingScreen {...screenProps} />;
}

/** `<ProcessingScreenContainer projectId={...} />` — màn Xử lý thật, đã nối. */
export function ProcessingScreenContainer(props: ProcessingScreenContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <ProcessingScreenCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredProcessingScreen {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong router thật, nên `useNavigate` chắc chắn tìm được provider. */
function ProcessingScreenRouteBody({
  projectId,
  roles,
}: {
  projectId: string;
  roles: readonly ProjectRole[];
}) {
  const navigate = useNavigate();

  return (
    <ProcessingScreenContainer
      onNavigate={(path) => navigate(path)}
      projectId={projectId}
      roles={roles}
    />
  );
}

/**
 * Route thật của màn Xử lý — CHƯA đăng ký tại `src/routes/router.tsx` (ngoài phạm
 * vi nhiệm vụ này, xem ghi chú đầu file).
 */
export function ProcessingScreenRoute() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();

  if (id === undefined || id.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          message={MISSING_PROJECT_MESSAGE}
          title={MISSING_PROJECT_TITLE}
        />
      </div>
    );
  }

  return <ProcessingScreenRouteBody projectId={id} roles={session.roles} />;
}
