/**
 * Route `ROUTE_PATTERNS.projectPipeline`, nối hook với router.
 *
 * Cùng khuôn `InputQualityGate.container.tsx` — hai lớp, cố ý tách:
 *
 * - {@link ProcessingScreenContainer} nhận đủ mọi thứ qua props và **không** gọi
 *   `useNavigate` hay `useParams`, nên bất kỳ màn nào cũng mở được nó bằng một
 *   dòng, kể cả trong test hay story (R-73). Nó cũng là nơi tiêm cổng dữ liệu
 *   thật vào hook.
 * - {@link ProcessingScreenRoute} là nơi duy nhất biết tới router. Nó chưa được
 *   đăng ký ở `src/routes/router.tsx` — route đó vẫn là `<Placeholder>` (phạm vi
 *   `src/routes/**` không thuộc nhiệm vụ này) — nhưng đã đủ hình dạng để nhiệm vụ
 *   nối route thật cắm vào bằng một dòng `lazy(...)`.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản đang được `src/App.tsx`
 * gắn (R-62), **không** phải bản chưa nối ở `src/lib/screen-state`. Phần dự
 * phòng dựng bằng `EmptyState` từ `report.description`, nên màn không bao giờ
 * trắng (A11).
 *
 * ## Vì sao `floorUploads` là props chứ không đọc từ URL
 *
 * `ENDPOINTS.drawings.progress` cần `(projectId, uploadId)`, còn route chỉ mang
 * `:id`. KHÔNG endpoint nào liệt kê được các `uploadId` đang chạy của một dự án
 * (đã soát `src/api/endpoints.ts` toàn bộ). Nơi biết `uploadId` là màn tải bản
 * vẽ, nên nó truyền sang. Mở màn này từ URL trần là hợp lệ và trung thực: không
 * có lượt xử lý nào để theo dõi thì màn ở trạng thái `empty`, không phải một
 * thanh tiến độ bịa.
 */

import { useMemo } from 'react';
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
import { createAppProcessingGateway } from './processingGateway';
import type { ProcessingGateway } from './processingGateway';
import { useProcessingScreen } from './useProcessingScreen';
import type { ProcessingFloorUpload } from './useProcessingScreen';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'processing-screen';

const MISSING_PROJECT_TITLE = 'Không xác định được dự án';
const MISSING_PROJECT_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên không biết phải mở màn xử lý của dự án nào.';

/** Ổn định qua các lượt render — nơi gọi không truyền gì thì vẫn là cùng một mảng. */
const NO_UPLOADS: readonly ProcessingFloorUpload[] = [];

export interface ProcessingScreenContainerProps {
  readonly projectId: string;
  /** Các lượt xử lý đang chạy. Rỗng là câu trả lời hợp lệ — xem ghi chú đầu file. */
  readonly floorUploads?: readonly ProcessingFloorUpload[];
  readonly roles?: readonly ProjectRole[];
  /** Điều hướng sau khi bấm các hành động của màn (ví dụ xem lại tường). */
  readonly onNavigate?: (path: string) => void;
  /** Nơi nút "liên hệ hỗ trợ" dẫn tới — repo chưa có route hỗ trợ nào. */
  readonly onGoToSupport?: () => void;
  /**
   * Cổng dữ liệu. Có mặc định thật, dựng ngay tại container; test và story cắm
   * `createProcessingGateway(createMockApiClient())` vào đúng phép ánh xạ mà bản
   * sản phẩm dùng (R-70).
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
  const appGateway = useMemo(() => createAppProcessingGateway(), []);

  const screenProps = useProcessingScreen({
    projectId: props.projectId,
    floorUploads: props.floorUploads ?? NO_UPLOADS,
    gateway: props.gateway ?? appGateway,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
    ...(props.onGoToSupport !== undefined ? { onGoToSupport: props.onGoToSupport } : {}),
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
