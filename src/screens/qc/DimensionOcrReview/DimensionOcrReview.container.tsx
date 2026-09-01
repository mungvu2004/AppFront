/**
 * Màn S-14 "Đọc kích thước OCR" đã NỐI DÂY — hook cộng view, bọc trong ranh
 * giới lỗi.
 *
 * Đây là thứ một màn khác gắn vào khung của nó bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <DimensionOcrReviewContainer
 *   floorId={floorId}
 *   projectId={projectId}
 *   roles={session.roles}
 * />
 * ```
 *
 * ## R-73 — lối ra duy nhất của màn được nối THẬT
 *
 * Trạng thái Rỗng dẫn người duyệt sang hiệu chỉnh tỷ lệ thủ công, vì nguyên
 * nhân thường gặp nhất khiến OCR không đọc được chuỗi nào là tầng chưa có tỷ
 * lệ. Đường dẫn ấy dựng ở ĐÂY bằng `ROUTES.project.scale(projectId, floorId)`
 * và đi xuống view như một chuỗi bắt buộc — không phải một `onNavigate?` tuỳ
 * chọn mà không nơi gọi nào truyền, đúng cái nút chết R-73 tồn tại để chặn.
 * Màn không có lối ra thứ hai: liên kết tường chủ chỉ chọn tường và bay khung
 * nhìn trong chính canvas của màn (R-07).
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản mà `src/App.tsx` đang gắn (R-62), **không** phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, y hệt `ScreenCrashFallback` của `App.tsx`, nên màn
 * không bao giờ trắng (A11). `key={projectId:floorId}` lặp lại đúng ý
 * `key={activeScreen}` của `App.tsx`: đổi sang tầng khác thì ranh giới gắn LẠI,
 * nên một lần sập ở tầng này không để phần dự phòng nằm lại khi màn cha chuyển
 * sang tầng khác.
 *
 * ## Toast hoàn tác đi qua `notificationBus`, KHÔNG qua `Toast.Provider`
 *
 * A8 đòi mọi thay đổi có toast hoàn tác, và hook đẩy thông báo vào bus
 * (`useDimensionOcrReview.ts`). `NotificationHost` ở `src/main.tsx` vẽ bus đó
 * bằng `Toast.Item`, và nút "Hoàn tác" của nó gọi đúng vé mà hook dựng. Bọc
 * `Toast.Provider` quanh màn sẽ cho mỗi lượt sửa HAI toast, cái thứ hai hoàn
 * tác bằng ngăn xếp zundo chứ không phải ngăn xếp 100 bước của S-06 — cùng lý
 * lẽ đã ghi ở hai màn QC anh em.
 *
 * ## `react-router-dom` chỉ có mặt ở vỏ route
 *
 * `DimensionOcrReviewRoute` là thứ DUY NHẤT đọc `useParams`. Container nhận
 * `projectId`/`floorId` như hai chuỗi thường, nên story và bài kiểm dựng nó mà
 * không phải giả lập một router; và view không biết `react-router-dom` tồn tại.
 */

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import { DimensionOcrReview } from './DimensionOcrReview';
import type { DimensionOcrReviewGateway } from './dimensionOcrReviewGateway';
import { useDimensionOcrReview } from './useDimensionOcrReview';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const DIMENSION_OCR_REVIEW_SCREEN_ID = 'dimension-ocr-review';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án hoặc mã tầng';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang đủ mã dự án và mã tầng, nên chưa mở được lớp kích thước OCR. Quay lại danh sách tầng rồi chọn lại tầng cần duyệt.';

/**
 * Props màn cha truyền vào.
 *
 * Hai trường đầu là những gì một màn khác cần biết để mở màn này; bốn trường
 * còn lại là chỗ tiêm của test và story, cắm CÙNG bộ mẫu chứ không bịa bảng dữ
 * liệu thứ hai (R-70).
 */
export interface DimensionOcrReviewContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng bản thật, đúng một lần. */
  readonly gateway?: DimensionOcrReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn bảng duyệt — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Bus thông báo riêng — hai lượt kiểm không thấy toast của nhau. */
  readonly notifications?: NotificationBus;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function DimensionOcrReviewCrashFallback({ report, retry }: ScreenErrorFallback) {
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
 * `ObjectLayerReview.container.tsx`.
 */
function WiredDimensionOcrReview(props: DimensionOcrReviewContainerProps) {
  const model = useDimensionOcrReview({
    floorId: props.floorId,
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.registry !== undefined ? { registry: props.registry } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
    ...(props.notifications !== undefined ? { notifications: props.notifications } : {}),
  });

  const scaleCalibrationHref = useMemo(
    () => ROUTES.project.scale(props.projectId, props.floorId),
    [props.floorId, props.projectId],
  );

  return <DimensionOcrReview {...model} scaleCalibrationHref={scaleCalibrationHref} />;
}

/** `<DimensionOcrReviewContainer … />` — màn S-14 thật, đã nối, gắn được bằng một thẻ. */
export function DimensionOcrReviewContainer(props: DimensionOcrReviewContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      renderFallback={({ report, retry }) => (
        <DimensionOcrReviewCrashFallback report={report} retry={retry} />
      )}
      screenId={DIMENSION_OCR_REVIEW_SCREEN_ID}
    >
      <WiredDimensionOcrReview {...props} />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn Đọc kích thước OCR, đăng ký tại `src/routes/router.tsx`. */
export function DimensionOcrReviewRoute() {
  const { floorId, id } = useParams<{ floorId: string; id: string }>();
  const session = useSession();
  const roles = useMemo(() => session.roles, [session.roles]);

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

  return <DimensionOcrReviewContainer floorId={floorId} projectId={id} roles={roles} />;
}
