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
 * đối chiếu bản vẽ nào (cùng lý lẽ `ScaleCalibrationContainerProps`). Không có
 * callback "rời màn" nào khác cần khai: {@link OverlayComparisonActions} không
 * có hành động điều hướng nào, và lối ra duy nhất của màn —
 * `model.scaleFixHref` — đã là một chuỗi dựng sẵn từ hook (dùng `ROUTES.project.scale`
 * bên trong nó), view chỉ đặt thẳng vào `href` (R-65), nên container không cần
 * một `onNavigate` để bắc `useNavigate` vào đâu cả.
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

import { useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import type { ProjectRole } from '@/types/project';

import { OverlayComparison } from './OverlayComparison';
import type { OverlayComparisonGateway } from './overlayComparisonGateway';
import type { OverlayComparisonState } from './types';
import { useOverlayComparison } from './useOverlayComparison';

/** Mã màn, cho ranh giới lỗi — một chỗ viết duy nhất. */
export const OVERLAY_COMPARISON_SCREEN_ID = 'overlay-comparison';

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
}

/** Cùng khuôn `HistoryPanelCrashFallback` — R-62, chữ từ `report.description`. */
function OverlayComparisonCrashFallback({ report, retry }: ScreenErrorFallback) {
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

  const { actions, model } = useOverlayComparison({
    floorId: props.floorId,
    projectId: props.projectId,
    ...roleOption,
    ...(props.forceState === undefined ? {} : { forceState: props.forceState }),
    ...(props.gateway === undefined ? {} : { gateway: props.gateway }),
  });

  return <OverlayComparison actions={actions} model={model} />;
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
