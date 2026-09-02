/**
 * Màn S-17 "Duyệt tên phòng" đã NỐI DÂY — hook, canvas, hai panel và hai hộp
 * thoại ghép lại, bọc trong ranh giới lỗi.
 *
 * Đây là thứ một màn khác gắn vào khung của nó bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <RoomLabelReviewContainer
 *   floorId={floorId}
 *   onNavigate={(path) => navigate(path)}
 *   projectId={projectId}
 *   roles={session.roles}
 * />
 * ```
 *
 * ## Vì sao container này CÓ `onNavigate`, và vì sao nó bắt buộc
 *
 * Khác `AxisGridManager` (mọi nút "Xem trên bản vẽ" của nó ở lại trên màn), màn
 * này có một lối ra THẬT: `onNavigateToWalls` của panel trái — nút "Xem tại lớp
 * tường" cạnh mỗi vòng hở, và là "bước đi tiếp cụ thể" mà CẤM TUYỆT ĐỐI về
 * vòng hở đòi. Hook ghép đường dẫn bằng `ROUTES.project.walls(...)` (R-65) rồi
 * gọi `options.onNavigate`; nếu container để prop đó tuỳ chọn và không ai
 * truyền, nút vẫn bấm được nhưng KHÔNG đi đâu — một lối ra chết, đúng thứ R-73
 * cấm. Nên `onNavigate` là BẮT BUỘC ở đây, và {@link RoomLabelReviewRoute} nối
 * nó vào `useNavigate` thật.
 *
 * Dòng nhắc công năng đi đường khác và không cần `onNavigate`:
 * {@link RoomLabelNoticeViewModel.ruleRouteHref} đã là một đường dẫn ghép sẵn ở
 * hook, và `RoomLabelInspectorFields` render nó thành liên kết thẳng.
 *
 * Nhập `@/routes/paths` chứ KHÔNG nhập `@/routes`: `router.tsx` lazy-import mọi
 * màn, và một màn nhập ngược `@/routes` khép một vòng làm `pnpm cycles` đỏ.
 * Ở file này thậm chí không cần `ROUTES` — hook đã ghép hết đường dẫn.
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
 * `useRoomLabelReview` đẩy thông báo vào `appNotificationBus`, thứ mà
 * `NotificationHost` (`src/main.tsx`) vẽ ra bằng `Toast.Item`, và nút "Hoàn
 * tác" của nó gọi đúng vé mà `createRoomLabelUndoTicket` dựng. Bọc thêm
 * `Toast.Provider` quanh màn sẽ cho mỗi lượt commit MỘT toast thứ hai hoàn tác
 * bằng ngăn xếp **zundo**, tức một ngăn xếp khác với ngăn xếp lệnh của màn. Nên
 * container không bọc provider nào. Tiền lệ: `WallLayerReview.container.tsx`.
 *
 * ## Khoảng trống đã biết: chưa có đường lưu lớp phòng lên máy chủ
 *
 * `ROOM_LABEL_MISSING_CAPABILITIES` của cổng khai thẳng hai khả năng còn thiếu
 * (`readClearHeight`, `persistRoomLabels`): `Room` không có `heightMm` riêng, và
 * `PatchSpatialFloorInput.body` không mang mảng phòng. Màn chạy TRONG BỘ NHỚ
 * (kho cộng ngăn xếp hoàn tác), cổng trả nhánh `supported: false` có kiểu, và
 * hook NÓI RA điều đó thay vì hiện "Đã lưu lúc…" cho một lượt chưa rời máy
 * (A7/E.10). Không ai được bịa một endpoint để lấp chỗ đó.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { LevelId } from '@/domain/spatial/types';
import { useSession } from '@/hooks/useSession';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import type { ProjectRole } from '@/types/project';

import { RoomLabelReview } from './RoomLabelReview';
import type { RoomLabelReviewGateway } from './roomLabelReviewGateway';
import { useRoomLabelReview } from './useRoomLabelReview';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const ROOM_LABEL_REVIEW_SCREEN_ID = 'room-label-review';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án hoặc mã tầng';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang đủ mã dự án và mã tầng, nên chưa mở được lớp phòng. Quay lại danh sách tầng rồi chọn lại tầng cần duyệt.';

/**
 * Props màn cha truyền vào.
 *
 * Năm trường đầu là những gì một màn khác cần biết để mở màn này; các trường
 * còn lại là chỗ tiêm của test và story (R-73 — bản giả phải cắm được vào, và
 * cắm CÙNG bộ mẫu chứ không bịa bảng dữ liệu thứ hai, R-70).
 */
export interface RoomLabelReviewContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang duyệt. Vắng mặt thì hook lấy tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Lối ra thật của màn — xem "Vì sao container này CÓ `onNavigate`" ở đầu file. */
  readonly onNavigate: (path: string) => void;
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng bản thật, đúng một lần. */
  readonly gateway?: RoomLabelReviewGateway;
  /** Bus thông báo tiêm được — bài kiểm đọc toast hoàn tác trên bus của riêng nó. */
  readonly notifications?: NotificationBus;
  /** Ép thu gọn hai cột — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Dưới 1.024px cột trái xếp dọc; màn cha đo bề rộng và truyền vào. */
  readonly forceCompact?: boolean;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function RoomLabelReviewCrashFallback({ report, retry }: ScreenErrorFallback) {
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
 * Hook cộng view, không có provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `AxisGridManager.container.tsx`.
 *
 * Kết quả hook chuyền THẲNG xuống view bằng một phép trải: hai bên cùng đúng
 * một kiểu (`UseRoomLabelReviewResult` LÀ `RoomLabelReviewProps`), nên liệt kê
 * lại ba mươi tên trường ở đây chỉ tạo thêm một chỗ để quên một cái.
 */
function WiredRoomLabelReview(props: RoomLabelReviewContainerProps) {
  const model = useRoomLabelReview({
    floorId: props.floorId,
    onNavigate: props.onNavigate,
    projectId: props.projectId,
    ...(props.levelId !== undefined ? { levelId: props.levelId } : {}),
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.notifications !== undefined ? { notifications: props.notifications } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
    ...(props.forceCompact !== undefined ? { forceCompact: props.forceCompact } : {}),
  });

  return <RoomLabelReview {...model} />;
}

/** `<RoomLabelReviewContainer … />` — màn S-17 thật, đã nối, gắn được bằng một thẻ. */
export function RoomLabelReviewContainer(props: RoomLabelReviewContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      renderFallback={({ report, retry }) => (
        <RoomLabelReviewCrashFallback report={report} retry={retry} />
      )}
      screenId={ROOM_LABEL_REVIEW_SCREEN_ID}
    >
      <WiredRoomLabelReview {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong router thật, nên `useNavigate` chắc chắn tìm được provider. */
function RoomLabelReviewRouteBody({
  floorId,
  projectId,
  roles,
}: {
  readonly floorId: string;
  readonly projectId: string;
  readonly roles: readonly ProjectRole[];
}) {
  const navigate = useNavigate();

  /*
   * Mã tầng của đường dẫn CŨNG là mã `Level` của đồ thị: cả hai đến từ cùng một
   * `createId('level')`. Truyền xuống để hook mở đúng tầng thay vì lấy tầng đầu
   * tiên của đồ thị.
   */
  const levelId = useMemo(() => floorId as LevelId, [floorId]);

  return (
    <RoomLabelReviewContainer
      floorId={floorId}
      levelId={levelId}
      onNavigate={(path) => navigate(path)}
      projectId={projectId}
      roles={roles}
    />
  );
}

/** Route thật của màn Duyệt tên phòng, đăng ký tại `src/routes/router.tsx`. */
export function RoomLabelReviewRoute() {
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

  return <RoomLabelReviewRouteBody floorId={floorId} projectId={id} roles={session.roles} />;
}
