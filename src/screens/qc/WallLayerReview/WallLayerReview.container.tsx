/**
 * Màn S-12 "Duyệt lớp tường" đã NỐI DÂY — hook, view panel và view canvas ghép
 * lại, bọc trong ranh giới lỗi.
 *
 * Đây là thứ một màn khác gắn vào khung của nó bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <WallLayerReviewContainer
 *   floorId={floorId}
 *   onNavigate={(path) => navigate(path)}
 *   projectId={projectId}
 *   roles={session.roles}
 * />
 * ```
 *
 * ## Canvas vào bằng GHÉP, không bằng `import`
 *
 * `WallLayerReview.tsx` nhận `canvasSlot?: React.ReactNode` và cố ý không nhập
 * `WallLayerCanvas` (xem đầu file đó: hai view được viết song song trên hai
 * nhánh, một dòng `import` thẳng sẽ làm `pnpm typecheck` đỏ ngay lúc đó). Khe
 * đã có sẵn, nên file này truyền `<WallLayerCanvas … />` vào và KHÔNG sửa một
 * dòng nào của view.
 *
 * ## R-73 — `onNavigate` là prop BẮT BUỘC, không phải tuỳ chọn
 *
 * Ở trạng thái `success`, panel trái hiện nút "Sang lớp Cửa và nội thất", và
 * cây lớp có bốn mục điều hướng khác. Một `onNavigate?` tuỳ chọn mà không nơi
 * gọi nào truyền sẽ biến cả năm thứ đó thành nút bấm không có tác dụng — đúng
 * thứ A2 tồn tại để chặn. Nên nó bắt buộc, và {@link WallLayerReviewRoute} cấp
 * bản thật bằng `useNavigate`.
 *
 * Container KHÔNG viết một đường dẫn nào: bốn đường ra tra từ `ROUTES` của
 * `@/routes/paths` (R-65 — màn nhập `@/routes/paths`, phần vỏ nhập `@/routes`;
 * nhập nhầm sẽ khép một vòng `router.tsx` → màn → `router.tsx` và `pnpm cycles`
 * sẽ đỏ).
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản mà `src/App.tsx` đang gắn (R-62), **không** phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, y hệt `ScreenCrashFallback` của `App.tsx`, nên màn
 * không bao giờ trắng (A11). `key` lặp lại đúng ý `key={activeScreen}` của
 * `App.tsx`: đổi sang một tầng khác thì ranh giới gắn LẠI, nên một lần sập ở
 * Tầng 01 không để phần dự phòng nằm lại khi màn cha chuyển sang Tầng 02.
 *
 * ## Toast hoàn tác đi qua `notificationBus`, KHÔNG qua `Toast.Provider`
 *
 * A8 đòi lượt xoá có toast hoàn tác. Repo có hai chỗ hiện toast, và chỉ một
 * chỗ đúng cho màn này:
 *
 * - `Toast.Provider` (`src/components/feedback/Toast.tsx`) mang thêm một cầu
 *   nối riêng tới `useUndoableToast`, thứ tự phát một toast cho MỌI lượt
 *   `commit()` và gắn vào nút "Hoàn tác" của nó `useStore.temporal.undo()` —
 *   tức ngăn xếp **zundo**, không phải ngăn xếp 100 bước của S-06 mà màn này
 *   dùng. Bọc provider đó quanh màn sẽ cho mỗi lượt xoá HAI toast, và cái thứ
 *   hai hoàn tác bằng một ngăn xếp khác, để lại lịch sử của màn lệch pha.
 * - `NotificationHost` (`src/main.tsx:66`) vẽ `appNotificationBus` bằng đúng
 *   `Toast.Item`, và nút "Hoàn tác" của nó gọi `undoTicket.undo()` — tức đúng
 *   vé mà `createWallUndoTicket` dựng.
 *
 * Nên hook đẩy thông báo vào bus (xem `useWallLayerReview.ts`), và container
 * không bọc provider nào. Tiền lệ: `ProcessingScreen/useProcessingScreen.ts`.
 *
 * ## Khoảng trống đã biết: KHÔNG có đường lưu tường lên máy chủ
 *
 * `FloorWriteBody` (`src/api/client.ts`) chỉ có `name`/`order`/`elevationMm`/
 * `heightMm`/`drawings` — không có mảng tường — và không có `ENDPOINTS.*.walls`.
 * Nên D-07 không có chỗ gửi thay đổi tường đi, và `persistWallLayer` của cổng
 * trả `unsupported`. Người duyệt đã quyết: màn chạy TRONG BỘ NHỚ (kho cộng ngăn
 * xếp hoàn tác 100 bước), và không ai được bịa một endpoint để lấp chỗ đó.
 * Việc thêm đường lưu tường là một lượt làm riêng của nhóm lô-gic, không phải
 * của màn này.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { LevelId } from '@/domain/spatial/types';
import { useSession } from '@/hooks/useSession';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import { WallLayerCanvas } from './WallLayerCanvas';
import type { WallLayerOtherKind } from './WallLayerLeftPanel';
import { WallLayerReview } from './WallLayerReview';
import type { WallLayerReviewGateway } from './wallLayerReviewGateway';
import { useWallLayerReview } from './useWallLayerReview';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const WALL_LAYER_REVIEW_SCREEN_ID = 'wall-layer-review';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án hoặc mã tầng';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang đủ mã dự án và mã tầng, nên chưa mở được lớp tường. Quay lại danh sách tầng rồi chọn lại tầng cần duyệt.';

/**
 * Bốn lớp còn lại của cây lớp → đường dẫn thật.
 *
 * Bốn hằng này là các route TĨNH của `ROUTE_PATTERNS` (`/layers/objects`…), nên
 * chúng không nhận mã dự án hay mã tầng; tra bảng ở đây thay vì ghép chuỗi giữ
 * cho màn không viết một đường dẫn nào của riêng nó (R-65).
 */
const LAYER_ROUTE: Readonly<Record<WallLayerOtherKind, string>> = {
  openingsAndFurniture: ROUTES.layerObjects,
  dimensions: ROUTES.layerDimensions,
  axes: ROUTES.layerGrids,
  rooms: ROUTES.layerRooms,
};

/**
 * Props màn cha truyền vào.
 *
 * Sáu trường đầu là những gì một màn khác cần biết để mở màn này; ba trường
 * cuối là chỗ tiêm của test và story (R-73 — bản giả phải cắm được vào, và cắm
 * CÙNG bộ mẫu chứ không bịa bảng dữ liệu thứ hai, R-70).
 */
export interface WallLayerReviewContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang duyệt. Vắng mặt thì hook lấy tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Lối ra duy nhất của màn. BẮT BUỘC — xem "R-73" ở đầu file. */
  readonly onNavigate: (path: string) => void;
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng bản thật, đúng một lần. */
  readonly gateway?: WallLayerReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn hai panel — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function WallLayerReviewCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/**
 * Hook cộng hai view, không có provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `PipelineFailure.container.tsx`.
 */
function WiredWallLayerReview(props: WallLayerReviewContainerProps) {
  const { panel, canvas, toolRail, statusBar, leftPanel } = useWallLayerReview({
    floorId: props.floorId,
    projectId: props.projectId,
    ...(props.levelId !== undefined ? { levelId: props.levelId } : {}),
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.registry !== undefined ? { registry: props.registry } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
  });

  const { onNavigate, projectId } = props;
  const onNavigateLayer = useCallback(
    (layer: WallLayerOtherKind) => {
      onNavigate(LAYER_ROUTE[layer]);
    },
    [onNavigate],
  );

  /**
   * Đổi tầng: mở lớp tường của tầng khác (BC-05).
   *
   * `ROUTES.project.walls` là đường dẫn CÓ SẴN của chính màn này
   * (`src/routes/paths.ts`), nên panel trái không ghép một chuỗi nào và R-65
   * giữ nguyên: mọi đường dẫn của màn tra từ `ROUTES`.
   */
  const onNavigateFloor = useCallback(
    (floorId: string) => {
      onNavigate(ROUTES.project.walls(projectId, floorId));
    },
    [onNavigate, projectId],
  );

  return (
    <WallLayerReview
      canvas={canvas}
      canvasSlot={<WallLayerCanvas {...canvas} />}
      leftPanel={leftPanel}
      onNavigateFloor={onNavigateFloor}
      onNavigateLayer={onNavigateLayer}
      panel={panel}
      statusBar={statusBar}
      toolRail={toolRail}
    />
  );
}

/** `<WallLayerReviewContainer … />` — màn S-12 thật, đã nối, gắn được bằng một thẻ. */
export function WallLayerReviewContainer(props: WallLayerReviewContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      renderFallback={({ report, retry }) => (
        <WallLayerReviewCrashFallback report={report} retry={retry} />
      )}
      screenId={WALL_LAYER_REVIEW_SCREEN_ID}
    >
      <WiredWallLayerReview {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong router thật, nên `useNavigate` chắc chắn tìm được provider. */
function WallLayerReviewRouteBody({
  floorId,
  projectId,
  roles,
}: {
  readonly floorId: string;
  readonly projectId: string;
  readonly roles: readonly ProjectRole[];
}) {
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  /*
   * Mã tầng của đường dẫn CŨNG là mã `Level` của đồ thị: cả hai đến từ cùng một
   * `createId('level')`. Truyền xuống để hook duyệt đúng tầng thay vì lấy tầng
   * đầu tiên của đồ thị.
   */
  const levelId = useMemo(() => floorId as LevelId, [floorId]);

  return (
    <WallLayerReviewContainer
      floorId={floorId}
      levelId={levelId}
      onNavigate={handleNavigate}
      projectId={projectId}
      roles={roles}
    />
  );
}

/** Route thật của màn Duyệt lớp tường, đăng ký tại `src/routes/router.tsx`. */
export function WallLayerReviewRoute() {
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

  return <WallLayerReviewRouteBody floorId={floorId} projectId={id} roles={session.roles} />;
}
