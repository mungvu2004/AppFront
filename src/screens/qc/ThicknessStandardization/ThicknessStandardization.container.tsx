/**
 * Màn S-18 "Chuẩn hoá độ dày tường" đã NỐI DÂY — hook, biểu đồ, hai bảng,
 * canvas xem trước và thanh áp dụng ghép lại, bọc trong ranh giới lỗi.
 *
 * Đây là thứ một màn khác gắn vào khung của nó bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <ThicknessStandardizationContainer
 *   floorId={floorId}
 *   projectId={projectId}
 *   roles={session.roles}
 * />
 * ```
 *
 * ## Vì sao container này KHÔNG có `onNavigate`
 *
 * Khác `RoomLabelReview` (nút "Xem tại lớp tường" của nó là một lối ra thật),
 * mọi hành động của màn này ở lại trên màn: kéo ngưỡng, tích nhóm, xem trước,
 * áp, hoàn tác. Thêm một prop điều hướng mà không nút nào gọi là đúng thứ prop
 * chết mà R-73 cấm. Cùng lựa chọn `AxisGridManager.container.tsx` đã chốt.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản mà `src/App.tsx` đang gắn (R-62), **không** phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, y hệt `ScreenCrashFallback` của `App.tsx`, nên màn
 * không bao giờ trắng (A11). `key={projectId}:{floorId}` lặp lại đúng ý
 * `key={activeScreen}` của `App.tsx`: đổi sang tầng khác thì ranh giới gắn
 * LẠI, nên một lần sập ở Tầng 01 không để phần dự phòng nằm lại khi màn cha
 * chuyển sang Tầng 02.
 *
 * ## Toast hoàn tác đi qua `notificationBus`, KHÔNG qua `Toast.Provider`
 *
 * `useThicknessStandardization` đẩy thông báo vào `appNotificationBus`, thứ mà
 * `NotificationHost` (`src/main.tsx`) vẽ ra bằng `Toast.Item`, và nút "Hoàn
 * tác" của nó gọi đúng vé mà `createThicknessUndoTicket` dựng. Bọc thêm
 * `Toast.Provider` quanh màn sẽ cho mỗi lượt áp MỘT toast thứ hai hoàn tác
 * bằng ngăn xếp **zundo**, tức một ngăn xếp khác với ngăn xếp lệnh của màn —
 * và một lượt `runTransaction` N lệnh gọi `commit()` N lần, nên cái toast thứ
 * hai ấy còn hoàn tác thiếu. Tiền lệ: `WallLayerReview.container.tsx`.
 *
 * ## Khoảng trống đã biết: chưa có đường lưu độ dày lên máy chủ
 *
 * `THICKNESS_MISSING_CAPABILITIES` của cổng khai thẳng
 * `persistThicknessStandardization`: `PatchSpatialFloorInput.body` không mang
 * mảng tường. Màn chạy TRONG BỘ NHỚ (kho cộng ngăn xếp hoàn tác), cổng trả
 * nhánh `supported: false` có kiểu, và hook NÓI RA điều đó thay vì hiện "Đã
 * lưu lúc…" cho một lượt chưa rời máy (A7/E.10). Không ai được bịa một
 * endpoint để lấp chỗ đó.
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import type { HistoryStack } from '@/lib/commands/history';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import type { ProjectRole } from '@/types/project';
import { useParams } from 'react-router-dom';

import { ThicknessStandardization } from './ThicknessStandardization';
import type { ThicknessStandardizationGateway } from './thicknessStandardizationGateway';
import { useThicknessStandardization } from './useThicknessStandardization';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const THICKNESS_STANDARDIZATION_SCREEN_ID = 'thickness-standardization';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án hoặc mã tầng';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang đủ mã dự án và mã tầng, nên chưa mở được lớp số đo độ dày. Quay lại danh sách tầng rồi chọn lại tầng cần chuẩn hoá.';

/**
 * Props màn cha truyền vào.
 *
 * Ba trường đầu là những gì một màn khác cần biết để mở màn này; các trường
 * còn lại là chỗ tiêm của test và story (R-73 — bản giả phải cắm được vào, và
 * cắm CÙNG bộ mẫu chứ không bịa bảng dữ liệu thứ hai, R-70).
 */
export interface ThicknessStandardizationContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng bản thật, đúng một lần. */
  readonly gateway?: ThicknessStandardizationGateway;
  /** Bus thông báo tiêm được — bài kiểm đọc toast hoàn tác trên bus của riêng nó. */
  readonly notifications?: NotificationBus;
  /** Ép thu gọn canvas xem trước — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /**
   * Ngăn xếp hoàn tác tiêm được.
   *
   * `ThicknessStandardizationProps` không mang số bước lịch sử (hợp đồng kiểu
   * đã đóng băng), nên đây là cửa để bài kiểm của bản nghiệm thu đếm bước bằng
   * chính `HistoryStack` thật trong lúc lái MÀN ĐÃ RÁP, thay vì dựng một bảng
   * đếm thứ hai hoặc lùi xuống đo ở tầng hook. Vắng mặt thì hook dựng ngăn xếp
   * của riêng nó, đúng như lúc chạy thật.
   */
  readonly history?: HistoryStack;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function ThicknessStandardizationCrashFallback({ report, retry }: ScreenErrorFallback) {
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
 * `RoomLabelReview.container.tsx`.
 *
 * Kết quả hook chuyền THẲNG xuống view bằng một phép trải: hai bên cùng đúng
 * một kiểu (`UseThicknessStandardizationResult` LÀ
 * `ThicknessStandardizationViewProps`), nên liệt kê lại bốn mươi tên trường ở
 * đây chỉ tạo thêm một chỗ để quên một cái.
 */
function WiredThicknessStandardization(props: ThicknessStandardizationContainerProps) {
  const model = useThicknessStandardization({
    floorId: props.floorId,
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.notifications !== undefined ? { notifications: props.notifications } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
    ...(props.history !== undefined ? { history: props.history } : {}),
  });

  return <ThicknessStandardization {...model} />;
}

/** `<ThicknessStandardizationContainer … />` — màn S-18 thật, gắn được bằng một thẻ. */
export function ThicknessStandardizationContainer(
  props: ThicknessStandardizationContainerProps,
) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      renderFallback={({ report, retry }) => (
        <ThicknessStandardizationCrashFallback report={report} retry={retry} />
      )}
      screenId={THICKNESS_STANDARDIZATION_SCREEN_ID}
    >
      <WiredThicknessStandardization {...props} />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn Chuẩn hoá độ dày tường, đăng ký tại `src/routes/router.tsx`. */
export function ThicknessStandardizationRoute() {
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

  return (
    <ThicknessStandardizationContainer floorId={floorId} projectId={id} roles={session.roles} />
  );
}
