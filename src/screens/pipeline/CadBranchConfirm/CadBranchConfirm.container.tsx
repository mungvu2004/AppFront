/**
 * Route `ROUTE_PATTERNS.projectCadConfirm`, nối hook với router.
 *
 * Cùng khuôn `ScaleCalibration.container.tsx` và `ProcessingScreen.container.tsx`
 * — hai lớp, cố ý tách:
 *
 * - {@link CadBranchConfirmContainer} nhận đủ mọi thứ qua props và **không** gọi
 *   `useNavigate` hay `useParams`, nên bất kỳ màn nào cũng mở được nó bằng một
 *   dòng, kể cả trong test hay story (R-73). Nó cũng là nơi tiêm cổng dữ liệu
 *   thật vào hook.
 * - {@link CadBranchConfirmRoute} là nơi duy nhất biết tới router. `router.tsx`
 *   nạp đúng tên này qua `lazy(...)`.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản đang được `src/App.tsx`
 * gắn (R-62), **không** phải bản chưa nối ở `src/lib/screen-state`. Phần dự
 * phòng dựng bằng `EmptyState` từ `report.description`, nên màn không bao giờ
 * trắng (A11).
 *
 * ## Vì sao route mang cả `:id` lẫn `:floorId`
 *
 * Tệp CAD gắn với MỘT tầng: cổng dữ liệu đọc nội dung tệp theo
 * `(projectId, floorId)` và bảng tầng nói tầng nào có tệp CAD, tầng nào chỉ có
 * ảnh. Một đường dẫn chỉ mang mã dự án không đủ để biết phải đọc tệp của tầng
 * nào — nên đường dẫn mang cả hai, đúng khuôn `projectScale` và `projectWalls`.
 *
 * Thiếu một trong hai tham số thì màn nói ra bằng `InlineAlert`, không để trắng
 * (A11) — cùng khuôn `ScaleCalibration.container.tsx`.
 *
 * ## Điều hướng không viết chuỗi đường dẫn (R-65)
 *
 * Container không dựng đường dẫn nào. Nhánh AI hoà tan sang phần cài đặt AI của
 * dự án, và chính hook gọi `ROUTES.project.pipeline(...)` rồi đẩy kết quả qua
 * `onNavigate` — nên bảng đường dẫn là nguồn duy nhất và chỗ này chỉ bắc
 * `navigate` của router vào đó.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';

import { CadBranchConfirm } from './CadBranchConfirm';
import { createAppCadBranchConfirmGateway } from './cadBranchConfirmGateway';
import type { CadBranchConfirmGateway } from './cadBranchConfirmGateway';
import { useCadBranchConfirm } from './useCadBranchConfirm';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'cad-branch-confirm';

const MISSING_PARAMS_TITLE = 'Không xác định được tệp CAD cần đọc';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án hoặc mã tầng, nên không biết phải đọc tệp bản vẽ của tầng nào.';

export interface CadBranchConfirmContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  /** Vai trò của phiên đăng nhập. Thiếu thì hook tự dùng vai trò mặc định của nó. */
  readonly roles?: readonly string[];
  /** Điều hướng ra khỏi màn — nhánh AI hoà tan sang phần cài đặt AI của dự án. */
  readonly onNavigate?: (path: string) => void;
  /**
   * Cổng dữ liệu. Có mặc định thật, dựng ngay tại container; test và story cắm
   * `createMockCadBranchConfirmGateway()` vào đúng phép ánh xạ mà bản sản phẩm
   * dùng (R-70).
   */
  readonly gateway?: CadBranchConfirmGateway;
  /** Ép panel ánh xạ thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceMappingPanelCollapsed?: boolean;
}

/** Cùng khuôn `ScaleCalibrationCrashFallback` — R-62. */
function CadBranchConfirmCrashFallback({ report, retry }: ScreenErrorFallback) {
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
function WiredCadBranchConfirm(props: CadBranchConfirmContainerProps) {
  const appGateway = useMemo(() => createAppCadBranchConfirmGateway(), []);

  const screenProps = useCadBranchConfirm({
    projectId: props.projectId,
    floorId: props.floorId,
    gateway: props.gateway ?? appGateway,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
    ...(props.forceMappingPanelCollapsed !== undefined
      ? { forceMappingPanelCollapsed: props.forceMappingPanelCollapsed }
      : {}),
  });

  return <CadBranchConfirm actions={screenProps.actions} model={screenProps.model} />;
}

/** `<CadBranchConfirmContainer projectId={...} floorId={...} />` — màn thật, đã nối. */
export function CadBranchConfirmContainer(props: CadBranchConfirmContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <CadBranchConfirmCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredCadBranchConfirm {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong router thật, nên `useNavigate` chắc chắn tìm được provider. */
function CadBranchConfirmRouteBody({
  floorId,
  projectId,
  roles,
}: {
  floorId: string;
  projectId: string;
  roles: readonly string[];
}) {
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  return (
    <CadBranchConfirmContainer
      floorId={floorId}
      onNavigate={handleNavigate}
      projectId={projectId}
      roles={roles}
    />
  );
}

/** Route thật của màn Phát hiện tệp CAD, đăng ký tại `src/routes/router.tsx`. */
export function CadBranchConfirmRoute() {
  const { floorId, id } = useParams<{ floorId: string; id: string }>();
  const session = useSession();

  if (id === undefined || id.length === 0 || floorId === undefined || floorId.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          message={MISSING_PARAMS_MESSAGE}
          title={MISSING_PARAMS_TITLE}
        />
      </div>
    );
  }

  return <CadBranchConfirmRouteBody floorId={floorId} projectId={id} roles={session.roles} />;
}
