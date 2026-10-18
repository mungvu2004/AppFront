/**
 * Màn S-15 "Trục và gốc toạ độ" đã NỐI DÂY — hook, canvas và hai panel ghép
 * lại, bọc trong ranh giới lỗi.
 *
 * Đây là thứ một màn khác gắn vào khung của nó bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <AxisGridManagerContainer
 *   floorId={floorId}
 *   projectId={projectId}
 *   roles={session.roles}
 * />
 * ```
 *
 * ## `onNavigate` tuỳ chọn — lối ra duy nhất là trạng thái đọc lớp hỏng
 *
 * Hai nút mang chữ "Xem trên bản vẽ" của màn đều Ở LẠI trên màn: hợp đồng props
 * đã đóng băng của T3 nói rõ `onViewFloorOnDrawing` là "bay khung nhìn tới tầng
 * lệch" và `onViewOnDrawing` là "chọn một trục rồi bay khung nhìn canvas tới
 * nó", và `useAxisGridManager` cài đặt đúng như vậy — bật bóng ma, trỏ đúng
 * tầng, đọc độ lệch lên `aria-live`. Không nút nào rời màn.
 *
 * Lối ra duy nhất là nút "Về quản lý tầng" / "Về danh sách dự án" của trạng
 * thái đọc lớp hỏng (BUG-326, `qc/shared/floorLayerReadFailure`), nên
 * `onNavigate` tuỳ chọn như `ThicknessStandardization.container.tsx`: route nối
 * `useNavigate`, story/test vắng thì nút không đi đâu.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản mà `src/App.tsx` đang gắn (R-62), **không** phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, y hệt `ScreenCrashFallback` của `App.tsx`, nên màn
 * không bao giờ trắng (A11). `key={projectId}:{floorId}` lặp lại đúng ý
 * `key={activeScreen}` của `App.tsx`: đổi sang tầng khác thì ranh giới gắn LẠI,
 * nên một lần sập ở Tầng 01 không để phần dự phòng nằm lại khi màn cha chuyển
 * sang Tầng 02.
 *
 * ## Toast hoàn tác đi qua `notificationBus`, KHÔNG qua `Toast.Provider`
 *
 * `useAxisGridManager` đẩy thông báo vào `appNotificationBus`, thứ mà
 * `NotificationHost` (`src/main.tsx`) vẽ ra bằng `Toast.Item` và nút "Hoàn tác"
 * của nó gọi `undoTicket.undo()` — đúng vé mà `createAxisUndoTicket` dựng. Bọc
 * thêm `Toast.Provider` quanh màn sẽ cho mỗi lượt commit MỘT toast thứ hai hoàn
 * tác bằng ngăn xếp **zundo**, tức một ngăn xếp khác với ngăn xếp lệnh của màn.
 * Nên container không bọc provider nào. Tiền lệ: `WallLayerReview.container.tsx`.
 *
 * ## Khoảng trống đã biết: chưa có đường lưu lưới trục lên máy chủ
 *
 * `AXIS_GRID_MISSING_CAPABILITIES` của cổng khai thẳng hai khả năng còn thiếu
 * (`persistAxisGrid`, `persistAxisOrigin`): `ENDPOINTS` không có đường nào cho
 * trục, và `FloorWriteBody` không mang mảng trục. Màn chạy TRONG BỘ NHỚ (kho
 * cộng ngăn xếp hoàn tác), cổng trả nhánh `supported: false` có kiểu, và hook
 * NÓI RA điều đó cho người dùng. Không ai được bịa một endpoint để lấp chỗ đó —
 * thêm đường lưu trục là một lượt làm riêng của nhóm lô-gic.
 */

import { useCallback, useMemo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { LevelId } from '@/domain/spatial/types';
import { pixels } from '@/domain/units/scale';
import { useSession } from '@/hooks/useSession';
import type { Announcer } from '@/lib/input/announcer';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import type { ProjectRole } from '@/types/project';

import { QcFloorNav } from '../shared/QcFloorNav';

import { AxisGridManager } from './AxisGridManager';
import type { AxisGridManagerGateway } from './axisGridManagerGateway';
import { useAxisGridManager } from './useAxisGridManager';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const AXIS_GRID_MANAGER_SCREEN_ID = 'axis-grid-manager';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án hoặc mã tầng';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang đủ mã dự án và mã tầng, nên chưa mở được lưới trục. Quay lại danh sách tầng rồi chọn lại tầng cần xem.';

/**
 * Props màn cha truyền vào.
 *
 * Bốn trường đầu là những gì một màn khác cần biết để mở màn này; các trường
 * còn lại là chỗ tiêm của test và story (R-73 — bản giả phải cắm được vào, và
 * cắm CÙNG bộ mẫu chứ không bịa bảng dữ liệu thứ hai, R-70).
 */
export interface AxisGridManagerContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang xem. Vắng mặt thì hook lấy tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng bản thật, đúng một lần. */
  readonly gateway?: AxisGridManagerGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Bus thông báo tiêm được — bài kiểm đọc toast hoàn tác trên bus của riêng nó. */
  readonly notifications?: NotificationBus;
  /** Bộ đọc `aria-live` tiêm được — bài kiểm nghe câu chặn 100 mm qua nó. */
  readonly announcer?: Announcer;
  /** Ép thu gọn hai cột — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Dưới 1.024px cột trái xếp dọc; màn cha đo bề rộng và truyền vào. */
  readonly isCompact?: boolean;
  /** Lối ra của trạng thái đọc lớp hỏng (BUG-326). */
  readonly onNavigate?: (path: string) => void;
  /** `QcFloorNav` dựng ở route (cần Router); vắng thì view giữ đầu màn cũ. */
  readonly floorNav?: ReactNode;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function AxisGridManagerCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<AlertCircle />}
        title={report.description.title}
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
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `WallLayerReview.container.tsx`.
 */
function WiredAxisGridManager(props: AxisGridManagerContainerProps) {
  const result = useAxisGridManager({
    floorId: props.floorId,
    projectId: props.projectId,
    ...(props.levelId !== undefined ? { levelId: props.levelId } : {}),
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.registry !== undefined ? { registry: props.registry } : {}),
    ...(props.notifications !== undefined ? { notifications: props.notifications } : {}),
    ...(props.announcer !== undefined ? { announcer: props.announcer } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
    ...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
  });

  /*
   * Gắn nhãn đơn vị cho toạ độ canvas đọc lên — chỗ DUY NHẤT hai hình dạng của
   * `onAxisDrag` gặp nhau (xem `AxisGridManager.tsx`). Không phép tính nào ở
   * đây: `pixels()` chỉ dán nhãn `px` lên đúng con số canvas đưa lên, và mọi
   * quy đổi milimét cùng lượt soát 100 mm vẫn nằm trong hook.
   */
  const { onAxisDrag } = result;
  const handleAxisDrag = useCallback(
    (axisId: string, coordinatePx: number) => {
      onAxisDrag(axisId, pixels(coordinatePx));
    },
    [onAxisDrag],
  );

  return (
    <AxisGridManager
      onAnchorChange={result.onAnchorChange}
      onAutoAlign={result.onAutoAlign}
      onAxisAdd={result.onAxisAdd}
      onAxisDrag={handleAxisDrag}
      onAxisRemove={result.onAxisRemove}
      onAxisRename={result.onAxisRename}
      onAxisSpacingChange={result.onAxisSpacingChange}
      onAxisSelect={result.onAxisSelect}
      onAxisToggleVisibility={result.onAxisToggleVisibility}
      onFloorRowHover={result.onFloorRowHover}
      onGhostToggle={result.onGhostToggle}
      onRetry={result.onRetry}
      onToggleCollapsed={result.onToggleCollapsed}
      onUndo={result.onUndo}
      onViewFloorOnDrawing={result.onViewFloorOnDrawing}
      onViewOnDrawing={result.onViewOnDrawing}
      readFailure={result.readFailure}
      spacingMessage={result.spacingMessage}
      unsavedNotice={result.unsavedNotice}
      provisionalScaleNotice={result.provisionalScaleNotice}
      background={result.background}
      floorNav={props.floorNav}
      autoAlignBlockedReason={result.autoAlignBlockedReason}
      viewModel={result.viewModel}
    />
  );
}

/** `<AxisGridManagerContainer … />` — màn S-15 thật, đã nối, gắn được bằng một thẻ. */
export function AxisGridManagerContainer(props: AxisGridManagerContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      renderFallback={({ report, retry }) => (
        <AxisGridManagerCrashFallback report={report} retry={retry} />
      )}
      screenId={AXIS_GRID_MANAGER_SCREEN_ID}
    >
      <WiredAxisGridManager {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong router thật, nên `useNavigate` chắc chắn tìm được provider. */
function AxisGridManagerRouteBody({
  floorId,
  projectId,
  roles,
}: {
  readonly floorId: string;
  readonly projectId: string;
  readonly roles: readonly ProjectRole[];
}) {
  /*
   * Mã tầng của đường dẫn CŨNG là mã `Level` của đồ thị: cả hai đến từ cùng một
   * `createId('level')`. Truyền xuống để hook mở đúng tầng thay vì lấy tầng đầu
   * tiên của đồ thị.
   */
  const levelId = useMemo(() => floorId as LevelId, [floorId]);
  const navigate = useNavigate();
  const onNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <AxisGridManagerContainer
      floorId={floorId}
      floorNav={<QcFloorNav floorId={floorId} layer="grids" projectId={projectId} />}
      levelId={levelId}
      onNavigate={onNavigate}
      projectId={projectId}
      roles={roles}
    />
  );
}

/** Route thật của màn Trục và gốc toạ độ, đăng ký tại `src/routes/router.tsx`. */
export function AxisGridManagerRoute() {
  const { floorId, projectId: id } = useParams<{ floorId: string; projectId: string }>();
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

  return <AxisGridManagerRouteBody floorId={floorId} projectId={id} roles={session.roles} />;
}
