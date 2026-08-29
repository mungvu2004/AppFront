/**
 * Route `ROUTE_PATTERNS.projectScale`, nối hook với router.
 *
 * Cùng khuôn `ProcessingScreen.container.tsx` — hai lớp, cố ý tách:
 *
 * - {@link ScaleCalibrationContainer} nhận đủ mọi thứ qua props và **không** gọi
 *   `useNavigate` hay `useParams`, nên bất kỳ màn nào cũng mở được nó bằng một
 *   dòng, kể cả trong test hay story (R-73). Nó cũng là nơi tiêm cổng dữ liệu
 *   thật vào hook.
 * - {@link ScaleCalibrationRoute} là nơi duy nhất biết tới router. `router.tsx`
 *   nạp đúng tên này qua `lazy(...)`.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản đang được `src/App.tsx`
 * gắn (R-62), **không** phải bản chưa nối ở `src/lib/screen-state`. Phần dự
 * phòng dựng bằng `EmptyState` từ `report.description`, nên màn không bao giờ
 * trắng (A11).
 *
 * ## Vì sao route mang cả `:id` lẫn `:floorId`
 *
 * Tỷ lệ mm/px là thuộc tính của MỘT tầng: `Level.scaleMillimetresPerPixel` nằm
 * trên từng tầng, và cổng dữ liệu đọc bản vẽ theo `(projectId, floorId)`. Một
 * đường dẫn chỉ mang mã dự án không đủ để biết phải hiệu chỉnh bản vẽ nào, nên
 * `ROUTE_PATTERNS.projectScale` mang cả hai — cùng khuôn `projectWalls`.
 *
 * Thiếu một trong hai tham số thì màn nói ra bằng `InlineAlert`, không để trắng
 * (A11) — cùng khuôn `processingScreen.missingProject`.
 *
 * ## Điều hướng không viết chuỗi đường dẫn (R-65)
 *
 * Container không dựng đường dẫn nào. Lối "quay lại bước tiền xử lý" là
 * `actions.onGoToPreprocessing`, và chính hook gọi `ROUTES.project.quality(...)`
 * rồi đẩy kết quả qua `onNavigate` — nên bảng đường dẫn là nguồn duy nhất và
 * chỗ này chỉ bắc `navigate` của router vào đó. Không chuỗi bắt đầu bằng `/`
 * nào được gõ tay trong thư mục màn.
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
import type { ProjectRole } from '@/types/project';

import { ScaleCalibration } from './ScaleCalibration';
import { createAppScaleCalibrationGateway } from './scaleCalibrationGateway';
import type { ScaleCalibrationGateway } from './scaleCalibrationGateway';
import { useScaleCalibration } from './useScaleCalibration';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'scale-calibration';

const MISSING_PARAMS_TITLE = 'Không xác định được bản vẽ cần hiệu chỉnh';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án hoặc mã tầng, nên không biết phải hiệu chỉnh tỷ lệ cho bản vẽ nào.';

export interface ScaleCalibrationContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly ProjectRole[];
  /** Điều hướng ra khỏi màn — quay lại tiền xử lý, sang màn kế. */
  readonly onNavigate?: (path: string) => void;
  /**
   * Cổng dữ liệu. Có mặc định thật, dựng ngay tại container; test và story cắm
   * `createMockScaleCalibrationGateway()` vào đúng phép ánh xạ mà bản sản phẩm
   * dùng (R-70).
   */
  readonly gateway?: ScaleCalibrationGateway;
  /** Ép panel thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/** Cùng khuôn `ProcessingScreenCrashFallback` — R-62. */
function ScaleCalibrationCrashFallback({ report, retry }: ScreenErrorFallback) {
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
function WiredScaleCalibration(props: ScaleCalibrationContainerProps) {
  const appGateway = useMemo(() => createAppScaleCalibrationGateway(), []);

  const screenProps = useScaleCalibration({
    projectId: props.projectId,
    floorId: props.floorId,
    gateway: props.gateway ?? appGateway,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
  });

  return <ScaleCalibration actions={screenProps.actions} model={screenProps.model} />;
}

/** `<ScaleCalibrationContainer projectId={...} floorId={...} />` — màn thật, đã nối. */
export function ScaleCalibrationContainer(props: ScaleCalibrationContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <ScaleCalibrationCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredScaleCalibration {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong router thật, nên `useNavigate` chắc chắn tìm được provider. */
function ScaleCalibrationRouteBody({
  floorId,
  projectId,
  roles,
}: {
  floorId: string;
  projectId: string;
  roles: readonly ProjectRole[];
}) {
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  return (
    <ScaleCalibrationContainer
      floorId={floorId}
      onNavigate={handleNavigate}
      projectId={projectId}
      roles={roles}
    />
  );
}

/** Route thật của màn Hiệu chỉnh tỷ lệ, đăng ký tại `src/routes/router.tsx`. */
export function ScaleCalibrationRoute() {
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

  return <ScaleCalibrationRouteBody floorId={floorId} projectId={id} roles={session.roles} />;
}

