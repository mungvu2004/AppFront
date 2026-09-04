/**
 * VỎ CHUNG chín màn 3D, ĐÃ NỐI DÂY — hook cộng view, bọc trong ranh giới lỗi.
 *
 * Đây là thứ một màn 3D gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <ViewerShellContainer
 *   projectId={projectId}
 *   roles={session.roles}
 *   renderScene={(frame) => <MyStoreys frame={frame} />}
 * />
 * ```
 *
 * `renderScene` là khe cắm cảnh: chín màn nội dung dựng hình của riêng chúng và
 * nhận điểm nhìn, tầng đang hiện, độ tách, mặt phẳng cắt, đối tượng đang chọn.
 * Vắng mặt thì vỏ vẫn vẽ khung nhìn đúng chuẩn (nền, mặt đất, đường chân trời)
 * chứ không ra ô trắng — xem `ViewerViewport.tsx`.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản mà `src/App.tsx` đang gắn (R-62), **không** phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, y hệt `ScreenCrashFallback` của `App.tsx`, nên màn
 * không bao giờ trắng (A11). `key={projectId}` lặp lại đúng ý
 * `key={activeScreen}`: đổi sang dự án khác thì ranh giới gắn LẠI, nên một lần
 * sập ở dự án này không để phần dự phòng nằm lại khi người dùng mở dự án khác.
 *
 * ## Vì sao container này KHÔNG có `onNavigate`
 *
 * Mọi hành động của vỏ ở lại trên khung nhìn: quay, tách tầng, cắt, chọn, cô
 * lập. Breadcrumb là lối ra duy nhất, và nó nhận `onClick` qua chính
 * `breadcrumbs` mà hook dựng. Thêm một prop điều hướng mà không nút nào gọi là
 * đúng thứ prop chết mà R-73 cấm — cùng lựa chọn `AxisGridManager.container.tsx`
 * và `ThicknessStandardization.container.tsx` đã chốt.
 */

import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { ProjectRole } from '@/types/project';

import { ViewerShell } from './ViewerShell';
import type { ViewerShellGateway } from './viewerShellGateway';
import type { ViewerSceneFrame, ViewerScreenState } from './viewerShellTypes';
import { useViewerShell } from './useViewerShell';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const VIEWER_SHELL_SCREEN_ID = 'viewer-shell';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang mã dự án, nên chưa mở được khung nhìn 3D. Quay lại danh sách dự án rồi chọn lại dự án cần xem.';

export interface ViewerShellContainerProps {
  readonly projectId: string;
  /** Vai của người đang xem. Vai Người xem gỡ công cụ sửa khỏi ray. */
  readonly roles?: readonly ProjectRole[];
  /** Cảnh 3D của màn nội dung. */
  readonly renderScene?: (frame: ViewerSceneFrame) => ReactNode;
  /** Mở ô tìm đối tượng — phím `/`. Vỏ không tự dựng hộp thoại nào. */
  readonly onOpenSearch?: () => void;

  /* Chỗ tiêm của story và bài kiểm (R-73 — bản giả phải cắm được vào). */
  readonly gateway?: ViewerShellGateway;
  readonly spatial?: NormalizedSpatial | null;
  readonly forceState?: ViewerScreenState;
  readonly isDev?: boolean;
  readonly perf?: { readonly frameRate: number; readonly triangles: number } | null;
  readonly registry?: ShortcutRegistry;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function ViewerShellCrashFallback({ report, retry }: ScreenErrorFallback) {
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
 * Hook cộng view, không provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `ThicknessStandardization.container.tsx`.
 */
function WiredViewerShell(props: ViewerShellContainerProps) {
  const model = useViewerShell({
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.renderScene !== undefined ? { renderScene: props.renderScene } : {}),
    ...(props.onOpenSearch !== undefined ? { onOpenSearch: props.onOpenSearch } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.spatial !== undefined ? { spatial: props.spatial } : {}),
    ...(props.forceState !== undefined ? { forceState: props.forceState } : {}),
    ...(props.isDev !== undefined ? { isDev: props.isDev } : {}),
    ...(props.perf !== undefined ? { perf: props.perf } : {}),
    ...(props.registry !== undefined ? { registry: props.registry } : {}),
  });

  return <ViewerShell {...model} />;
}

export function ViewerShellContainer(props: ViewerShellContainerProps) {
  return (
    <ScreenErrorBoundary
      key={props.projectId}
      renderFallback={(fallback): ReactNode => <ViewerShellCrashFallback {...fallback} />}
      screenId={VIEWER_SHELL_SCREEN_ID}
    >
      <WiredViewerShell {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Vỏ route — thứ DUY NHẤT trong thư mục màn biết tới `react-router-dom`.
 *
 * Cùng khuôn `ThicknessStandardizationRoute`: đọc tham số đường dẫn, đọc vai từ
 * phiên, và từ chối tử tế khi đường dẫn thiếu mã dự án thay vì dựng một màn
 * không có gì để xem (A11).
 */
export function ViewerShellRoute() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();

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

  return <ViewerShellContainer projectId={id} roles={session.roles} />;
}
