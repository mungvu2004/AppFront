/**
 * `ExplodedView` ĐÃ NỐI DÂY — hook cộng vỏ chung, bọc trong ranh giới lỗi.
 *
 * Đây là thứ router gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <ExplodedViewContainer projectId={projectId} />
 * ```
 *
 * ## Ba tầng, không tầng nào dựng lại tầng dưới
 *
 * 1. `useExplodedView` trả về `ViewerShellProps` ĐẦY ĐỦ — `renderScene` đã cắm
 *    sẵn ở trong nó — nên file này không dựng một mảnh chrome nào của vỏ.
 * 2. `<ViewerShell {...shellProps} />` là vỏ chung của chín màn 3D, giữ nguyên
 *    ray tầng, thanh trượt "Độ tách", phím `E`, camera và bảy trạng thái
 *    (R-61, R-64: màn này KHÔNG dựng lại một thứ nào trong đó).
 * 3. `ExplodedView` là view thuần, và nó nằm ở đầu kia của `renderScene` chứ
 *    không phải một thẻ trong file này.
 *
 * ## Vì sao `ViewerShell` chứ không phải `ViewerShellContainer`
 *
 * `Viewer3D.container.tsx` gắn `ViewerShellContainer` vì `useViewer3D` chỉ dựng
 * phần NỘI DUNG và để container của vỏ tự gọi `useViewerShell`. Ở màn này thì
 * ngược lại, và hợp đồng đã chốt lý do (mục "Vì sao hàng ba mức sẵn KHÔNG nằm
 * trong `ViewerSceneActions`"): thứ đặt được độ tách là
 * `ViewerShellProps.onSeparationChange`, và nó chỉ có trong tay người GỌI
 * `useViewerShell`. Nên `useExplodedView` gọi `useViewerShell` bên trong, đóng
 * gói `onSeparationChange` vào `ExplodedViewActions`, rồi trả cả gói props ra
 * đây. Gắn thêm `ViewerShellContainer` ở đây sẽ là lượt gọi `useViewerShell`
 * THỨ HAI cho cùng một màn — hai vỏ, hai trạng thái, một màn.
 *
 * ## Vai không phải một prop bắt buộc — cùng khuôn `OverlayComparison.container.tsx`
 *
 * Màn cha không cần biết chuyện phân quyền: container tự đọc `useSession()`.
 * `status === 'unknown'` (phiên CHƯA tới) thì bỏ hẳn trường `roles` để hook đọc
 * ra `undefined` — "chưa biết vai" khác hẳn "biết là không có quyền", và hợp
 * đồng của hook nói rõ vai vắng mặt KHÔNG vào `forbidden`. Màn cha vẫn ĐÈ được
 * bằng `props.roles` khi nó biết rõ hơn.
 *
 * ## Không `useShortcutListener` ở đây
 *
 * `Viewer3D.container.tsx` phải tự thuê listener bàn phím vì `useViewer3D`
 * không thuê. `useExplodedView` thì có gọi `useShortcutListener` ngay ở đầu
 * hook, nên gọi lại ở đây chỉ là người giữ thứ hai của cùng một sổ thuê. A12
 * đã được lo, chỗ lo nó là hook.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62), không phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, nên màn không bao giờ ra ô trắng (A11). `key={projectId}`
 * lặp lại đúng ý `key={activeScreen}` của `App.tsx`: đổi sang dự án khác thì
 * ranh giới gắn LẠI. Hook được gọi BÊN TRONG ranh giới — đó là điểm của
 * `WiredExplodedView`: một cú ném lúc dựng cảnh hay lúc đọc cổng phải rơi vào
 * phần dự phòng, không rơi ra ngoài màn.
 */

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useSession } from '@/hooks/useSession';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { ViewerShell, type ViewerShellGateway } from '@/screens/viewer/ViewerShell';
import type { ProjectRole } from '@/types/project';

import type { MountExplodedScene } from './explodedViewScene';
import type { ExplodedViewGateway, ExplodedViewState } from './explodedViewTypes';
import { useExplodedView } from './useExplodedView';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const EXPLODED_VIEW_SCREEN_ID = 'exploded-view';

/** Thiếu mã dự án thì màn nói ra, không để trắng (A11). Cùng câu chuyện `Viewer3DRoute`. */
const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang mã dự án, nên chưa mở được màn tách tầng. Quay lại danh sách dự án rồi chọn lại dự án cần xem.';

/** Props thật của container — mọi thứ một màn khác cần để mở màn này (R-73). */
export interface ExplodedViewContainerProps {
  readonly projectId: string;
  /** Vai của người đang xem. Vắng mặt thì đọc từ phiên đăng nhập. */
  readonly roles?: readonly ProjectRole[];

  /* Chỗ tiêm của story và bài kiểm (R-73 — bản giả phải cắm được vào). */

  /** Cổng riêng của màn (diện tích từng tầng, báo cáo thẳng hàng). */
  readonly gateway?: ExplodedViewGateway;
  /** Cổng của vỏ chung. Vắng mặt thì hook dựng cổng THẬT đọc kho. */
  readonly shellGateway?: ViewerShellGateway;
  /** Đồ thị không gian tiêm thẳng; vắng mặt thì đọc kho. */
  readonly spatial?: NormalizedSpatial | null;
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: ExplodedViewState;
  readonly isDev?: boolean;
  readonly perf?: { readonly frameRate: number; readonly triangles: number } | null;
  readonly registry?: ShortcutRegistry;
  /** Thay module cảnh, cho bài kiểm không cần WebGL. */
  readonly mountScene?: MountExplodedScene;
  /** Khe `/` của vỏ; vỏ gọi nó khi người dùng bấm phím tìm. */
  readonly onOpenSearch?: () => void;
}

/** Cùng khuôn `Viewer3DCrashFallback` — R-62, chữ lấy từ `report.description`. */
function ExplodedViewCrashFallback({ report, retry }: ScreenErrorFallback) {
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
 * Hook cộng vỏ, không provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `Viewer3D.container.tsx`.
 */
function WiredExplodedView(props: ExplodedViewContainerProps) {
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

  const shellProps = useExplodedView({
    projectId: props.projectId,
    ...roleOption,
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.shellGateway !== undefined ? { shellGateway: props.shellGateway } : {}),
    ...(props.spatial !== undefined ? { spatial: props.spatial } : {}),
    ...(props.forceState !== undefined ? { forceState: props.forceState } : {}),
    ...(props.isDev !== undefined ? { isDev: props.isDev } : {}),
    ...(props.perf !== undefined ? { perf: props.perf } : {}),
    ...(props.registry !== undefined ? { registry: props.registry } : {}),
    ...(props.mountScene !== undefined ? { mountScene: props.mountScene } : {}),
    ...(props.onOpenSearch !== undefined ? { onOpenSearch: props.onOpenSearch } : {}),
  });

  return <ViewerShell {...shellProps} />;
}

/** `<ExplodedViewContainer projectId={...} />` — màn thật, đã nối. */
export function ExplodedViewContainer(props: ExplodedViewContainerProps) {
  return (
    <ScreenErrorBoundary
      key={props.projectId}
      renderFallback={(fallback) => <ExplodedViewCrashFallback {...fallback} />}
      screenId={EXPLODED_VIEW_SCREEN_ID}
    >
      <WiredExplodedView {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Vỏ route — thứ DUY NHẤT trong thư mục màn biết tới `react-router-dom`.
 *
 * Cùng khuôn `Viewer3DRoute`: đọc tham số đường dẫn và từ chối tử tế khi đường
 * dẫn thiếu mã dự án, thay vì dựng một màn không có gì để xem (A11). Vai không
 * đọc ở đây mà để container tự đọc `useSession()` — xem ghi chú "Vai không phải
 * một prop bắt buộc" ở trên.
 */
export function ExplodedViewRoute() {
  const { id } = useParams<{ id: string }>();

  if (id === undefined || id.length === 0) {
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

  return <ExplodedViewContainer projectId={id} />;
}
