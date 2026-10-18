/**
 * Hook cộng view, bọc trong ranh giới lỗi — cùng khuôn
 * `HistoryPanel.container.tsx` (S-34) và `ScaleCalibration.container.tsx`.
 *
 * `useOverlayComparison` và `OverlayComparisonGateway` (`overlayComparisonGateway.ts`)
 * chưa có trong worktree này — chúng nằm trên nhánh `overlay-hook`, viết song
 * song (xem chú thích đầu `OverlayComparison.tsx`). File này chỉ cần hình dạng
 * mà `types.ts` đã khai (`{ model, actions }`) để đúng khi Lớp 3 gộp; `pnpm
 * typecheck` đỏ ở hai import đó là kết quả ĐÚNG của lượt này.
 *
 * ## R-73 — nhận đủ props để mở được mà không phải viết thêm logic
 *
 * `projectId` và `floorId` là bắt buộc — không có chúng thì không biết phải
 * đối chiếu bản vẽ nào (cùng lý lẽ `ScaleCalibrationContainerProps`). Lối ra
 * `model.scaleFixHref` là chuỗi dựng sẵn từ hook (R-65). `onNavigate` chỉ có một
 * việc: "Chọn tầng" đổi URL, vì URL là nguồn sự thật của tầng đang xem (BUG-600).
 *
 * ## Vai không phải một prop bắt buộc — cùng khuôn `HistoryPanel.container.tsx`
 *
 * Màn cha không cần biết chuyện phân quyền: container tự đọc `useSession()`.
 * `status === 'unknown'` (phiên CHƯA tới) thì bỏ hẳn trường `roles` để hook đọc
 * ra `undefined` và ở trạng thái `loading` — khác hẳn "biết là không có quyền" —
 * và màn cha vẫn ĐÈ được bằng `props.roles` khi nó biết rõ hơn.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62), không phải `lib/screen-state`. Phần dự
 * phòng dựng bằng `EmptyState` từ `report.description`, nên màn không bao giờ
 * trắng (A11).
 */

import { AlertCircle } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { ProjectSpatialGate } from '@/components/feedback/ProjectSpatialGate';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useProjectSpatial } from '@/hooks/useProjectSpatial';
import { useSession } from '@/hooks/useSession';
import { useProjectFloors } from '@/hooks/useProjectFloors';
import { ROUTES } from '@/routes/paths';
import { QcFloorNav } from '@/screens/qc/shared/QcFloorNav';
import type { ProjectRole } from '@/types/project';

import { OverlayComparison } from './OverlayComparison';
import type { OverlayComparisonGateway } from './overlayComparisonGateway';
import type { OverlayComparisonState } from './types';
import { useOverlayComparison } from './useOverlayComparison';

/** Mã màn, cho ranh giới lỗi — một chỗ viết duy nhất. */
export const OVERLAY_COMPARISON_SCREEN_ID = 'overlay-comparison';

/**
 * Thiếu một trong hai tham số đường dẫn thì màn nói ra, không để trắng (A11).
 * Cùng câu chuyện `ScaleCalibrationRoute`.
 */
const MISSING_PARAMS_TITLE = 'Không xác định được bản vẽ cần đối chiếu';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án hoặc mã tầng nên chưa biết phải đối chiếu bản vẽ nào. Hãy mở lại màn này từ danh sách tầng.';

/** Props thật của container — mọi thứ một màn khác cần để mở màn này (R-73). */
export interface OverlayComparisonContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  /** Vai của người xem. Vắng mặt thì đọc từ phiên đăng nhập. */
  readonly roles?: readonly ProjectRole[];
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: OverlayComparisonState;
  /** Cổng thay thế, cho bài kiểm. Vắng mặt thì hook dựng cổng THẬT. */
  readonly gateway?: OverlayComparisonGateway;
  /** Đổi tầng = đổi URL (BUG-600). Route bắc `navigate` của router vào đây. */
  readonly onNavigate?: (path: string) => void;
}

/** Cùng khuôn `HistoryPanelCrashFallback` — R-62, chữ từ `report.description`. */
function OverlayComparisonCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<AlertCircle aria-hidden="true" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/** Hook cộng view, không provider nào ở giữa. */
function WiredOverlayComparison(props: OverlayComparisonContainerProps) {
  const session = useSession();

  const roleOption = useMemo(
    () =>
      props.roles !== undefined
        ? { roles: props.roles }
        : session.status === 'unknown'
          ? {}
          : { roles: session.roles },
    [props.roles, session.roles, session.status],
  );

  // N2-11: cấp Tầng đổi tầng theo mã API (đúng route), như mọi màn kiểm tra.
  const floors = useProjectFloors(props.projectId, props.gateway?.readFloorList);
  const { actions, model } = useOverlayComparison({
    floorId: props.floorId,
    projectId: props.projectId,
    ...roleOption,
    ...(props.forceState === undefined ? {} : { forceState: props.forceState }),
    ...(props.gateway === undefined ? {} : { gateway: props.gateway }),
    ...(props.onNavigate === undefined ? {} : { onNavigate: props.onNavigate }),
  });

  return (
    <OverlayComparison
      actions={actions}
      // Route tỷ lệ nhận mã tầng API như route này (G4b-25).
      alignHref={ROUTES.project.scale(props.projectId, props.floorId)}
      model={model}
      nav={<QcFloorNav floorId={props.floorId} floors={floors} layer="overlay" projectId={props.projectId} />}
    />
  );
}

/** `<OverlayComparisonContainer projectId={...} floorId={...} />` — màn thật, đã nối. */
export function OverlayComparisonContainer(props: OverlayComparisonContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={(fallback) => <OverlayComparisonCrashFallback {...fallback} />}
      screenId={OVERLAY_COMPARISON_SCREEN_ID}
    >
      <WiredOverlayComparison {...props} />
    </ScreenErrorBoundary>
  );
}


/**
 * Route thật của màn Đối chiếu bản vẽ, đăng ký tại `src/routes/router.tsx`.
 *
 * Đây là nơi DUY NHẤT của màn biết tới router, đúng khuôn
 * `ScaleCalibrationRoute`: `router.tsx` nạp nó qua `lazy(...)` và không phải
 * biết màn cần những tham số nào.
 *
 * Vai không đọc ở đây mà để container tự đọc `useSession()` — xem ghi chú "Vai
 * không phải một prop bắt buộc" ở trên. Route chỉ bắc hai tham số đường dẫn.
 */
function OverlayGate({ children, projectId }: { readonly children: ReactNode; readonly projectId: string }) {
  // Cổng thay cả màn bằng 404 trần nên vùng "Màn đối chiếu bản vẽ" mất (R-09): khi cổng thay màn, đặt lại vùng quanh nó.
  // Hai lần useProjectSpatial dùng chung khoá truy vấn.
  const { status } = useProjectSpatial({ projectId });
  const swapped = status === 'notFound' || status === 'error';

  // Một cây cố định: đổi kiểu phần tử theo `status` gỡ-gắn lại cổng, mỗi lần gắn lại truy vấn lỗi
  // refetch → `pending` → bỏ vùng → vòng lặp, màn kẹt ở "đang tải" (G13h).
  return (
    <div
      {...(swapped ? { 'aria-label': 'Màn đối chiếu bản vẽ', role: 'region' } : {})}
      className={swapped ? 'flex h-screen w-full' : 'contents'}
    >
      <ProjectSpatialGate projectId={projectId}>{children}</ProjectSpatialGate>
    </div>
  );
}

export function OverlayComparisonRoute() {
  const { floorId, projectId: id } = useParams<{ floorId: string; projectId: string }>();
  const navigate = useNavigate();

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

  return (
    <OverlayGate projectId={id}>
      <OverlayComparisonContainer floorId={floorId} onNavigate={navigate} projectId={id} />
    </OverlayGate>
  );
}
