/**
 * Màn S-13 "Lớp đối tượng" đã NỐI DÂY — hook cộng view, bọc trong ranh giới lỗi.
 *
 * Đây là thứ một màn khác gắn vào khung của nó bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <ObjectLayerReviewContainer
 *   floorId={floorId}
 *   projectId={projectId}
 *   roles={session.roles}
 * />
 * ```
 *
 * ## R-73 — không một prop tuỳ chọn nào là "lối ra chết"
 *
 * Màn tường anh em đòi `onNavigate` bắt buộc vì panel trái của nó có năm lối ra
 * (cây lớp, nút "sang lớp Cửa và nội thất"). Liên kết tường chủ của màn NÀY chỉ
 * chọn tường và bay khung nhìn tới trong chính canvas của màn (R-07); lối ra duy
 * nhất là nút "Hiệu chỉnh tỉ lệ" của dải tỉ lệ tạm (F-04x-2), nên `onNavigate`
 * tuỳ chọn và route nối `useNavigate`. Ba trường cuối là chỗ tiêm của test và story,
 * cắm CÙNG bộ mẫu chứ không bịa bảng dữ liệu thứ hai (R-70).
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản mà `src/App.tsx` đang gắn (R-62), **không** phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, y hệt `ScreenCrashFallback` của `App.tsx`, nên màn
 * không bao giờ trắng (A11). `key` lặp lại đúng ý `key={activeScreen}` của
 * `App.tsx`: đổi sang tầng khác thì ranh giới gắn LẠI, nên một lần sập ở tầng
 * này không để phần dự phòng nằm lại khi màn cha chuyển sang tầng khác.
 *
 * ## Toast hoàn tác đi qua `notificationBus`, KHÔNG qua `Toast.Provider`
 *
 * A8 đòi lượt xoá có toast hoàn tác, và hook đẩy thông báo vào bus
 * (`useObjectLayerReview.ts`). `NotificationHost` ở `src/main.tsx` vẽ bus đó
 * bằng `Toast.Item`, và nút "Hoàn tác" của nó gọi đúng vé mà hook dựng. Bọc
 * `Toast.Provider` quanh màn sẽ cho mỗi lượt xoá HAI toast, cái thứ hai hoàn
 * tác bằng ngăn xếp zundo chứ không phải ngăn xếp 100 bước của S-06 — cùng lý
 * lẽ đã ghi ở màn tường anh em.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { FloorLayerSaveBlock } from '@/hooks/useAutosave';
import { useSession } from '@/hooks/useSession';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import type { ProjectRole } from '@/types/project';

import { ObjectLayerReview } from './ObjectLayerReview';
import type { ObjectLayerReviewGateway } from './objectLayerReviewGateway';
import { useObjectLayerReview } from './useObjectLayerReview';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const OBJECT_LAYER_REVIEW_SCREEN_ID = 'object-layer-review';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án hoặc mã tầng';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang đủ mã dự án và mã tầng, nên chưa mở được lớp đối tượng. Quay lại danh sách tầng rồi chọn lại tầng cần duyệt.';

/**
 * Props màn cha truyền vào.
 *
 * Hai trường đầu là những gì một màn khác cần biết để mở màn này; bốn trường
 * còn lại là chỗ tiêm của test và story.
 */
export interface ObjectLayerReviewContainerProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly ProjectRole[];
  /** Lối ra của dải tỉ lệ tạm — xem đầu file. */
  readonly onNavigate?: (path: string) => void;
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng bản thật, đúng một lần. */
  readonly gateway?: ObjectLayerReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn hai panel — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Ép dải lưu lớp (F-04x-1) — cho story "Xung đột — tải lại" / "Không lưu được". */
  readonly forceSaveBlock?: FloorLayerSaveBlock;
  /** Bus thông báo riêng — hai lượt kiểm không thấy toast của nhau. */
  readonly notifications?: NotificationBus;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function ObjectLayerReviewCrashFallback({ report, retry }: ScreenErrorFallback) {
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
 * `WallLayerReview.container.tsx`.
 */
function WiredObjectLayerReview(props: ObjectLayerReviewContainerProps) {
  const model = useObjectLayerReview({
    floorId: props.floorId,
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.registry !== undefined ? { registry: props.registry } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
    ...(props.notifications !== undefined ? { notifications: props.notifications } : {}),
  });

  return <ObjectLayerReview {...model} saveBlock={props.forceSaveBlock ?? model.saveBlock} />;
}

/** `<ObjectLayerReviewContainer … />` — màn S-13 thật, đã nối, gắn được bằng một thẻ. */
export function ObjectLayerReviewContainer(props: ObjectLayerReviewContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      renderFallback={({ report, retry }) => (
        <ObjectLayerReviewCrashFallback report={report} retry={retry} />
      )}
      screenId={OBJECT_LAYER_REVIEW_SCREEN_ID}
    >
      <WiredObjectLayerReview {...props} />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn Lớp đối tượng, đăng ký tại `src/routes/router.tsx`. */
export function ObjectLayerReviewRoute() {
  const { floorId, projectId: id } = useParams<{ floorId: string; projectId: string }>();
  const session = useSession();
  const roles = useMemo(() => session.roles, [session.roles]);
  const navigate = useNavigate();
  const onNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

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
    <ObjectLayerReviewContainer floorId={floorId} onNavigate={onNavigate} projectId={id} roles={roles} />
  );
}
