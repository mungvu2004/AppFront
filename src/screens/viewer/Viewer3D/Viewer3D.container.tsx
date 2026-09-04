/**
 * `Viewer3D` ĐÃ NỐI DÂY — hook cộng view, cắm vào khe cảnh của vỏ chung, bọc
 * trong ranh giới lỗi.
 *
 * Đây là thứ router gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <Viewer3DContainer projectId={projectId} roles={session.roles} />
 * ```
 *
 * ## Ba tầng, không tầng nào dựng lại tầng dưới
 *
 * 1. `ViewerShellContainer` giữ nguyên chrome của vỏ — ray tầng, ViewCube, cụm
 *    thu phóng, thanh trạng thái, panel thanh tra (quyết định 3 của điều phối
 *    viên: `Viewer3D` DÙNG LẠI vỏ, không dựng bản thứ hai).
 * 2. `WiredViewer3DScene` là nội dung khe cắm: nó gọi `useViewer3D` rồi đưa
 *    đúng `Viewer3DProps` xuống `Viewer3D`.
 * 3. `Viewer3D` là view thuần — không chạm kho, không chạm mạng (R-60).
 *
 * ## `actions` phải khai TUỲ CHỌN — mục B của `shell-props-contract.md`
 *
 * `ViewerShellContainerProps.renderScene` khai MỘT tham số, còn
 * `ViewerViewport.tsx:123` gọi nó với HAI. Một hàm có tham số thứ hai TUỲ CHỌN
 * vẫn gán được vào kiểu một tham số, nên đó là đường duy nhất lấy được
 * `ViewerSceneActions` mà không đỏ typecheck. Ở runtime `actions` luôn có giá
 * trị; kiểu vẫn buộc nhánh `undefined` phải xử lý được, và hook đã xử lý
 * (`sceneActions` tuỳ chọn của `UseViewer3DOptions`).
 *
 * `ViewerSceneActions` KHÔNG được `ViewerShell/index.ts` tái xuất, nên nó nhập
 * thẳng từ `viewerShellTypes.ts` — cùng ngoại lệ mục A của hợp đồng đã ghi.
 *
 * ## Canvas ở đâu
 *
 * `viewer3dTypes.ts:230-232` chốt: `canvas` không phải một prop của view mà là
 * một phần tử chỉ tồn tại sau khi view gắn xong, lấy ra bằng callback ref rồi
 * đưa vào hook. Nên `<canvas>` do `Viewer3D` vẽ (đúng thứ tự z: trên nền và mặt
 * đất, dưới mọi lớp nội dung), còn state giữ phần tử ấy nằm ở đây.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62), không phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, nên màn không bao giờ ra ô trắng (A11).
 * `key={projectId}` lặp lại đúng ý `key={activeScreen}` của `App.tsx`: đổi sang
 * dự án khác thì ranh giới gắn LẠI.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useSession } from '@/hooks/useSession';
import type { ColoringModeId } from '@/lib/coloring/modes';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { ViewerShellContainer, type ViewerShellGateway } from '@/screens/viewer/ViewerShell';
import type {
  ViewerSceneActions,
  ViewerSceneFrame,
  ViewerScreenState,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';
import type { ProjectRole } from '@/types/project';

import { Viewer3D } from './Viewer3D';
import { useViewer3D } from './useViewer3D';
import type { MountViewerScene, Viewer3DTelemetry } from './viewer3dTypes';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const VIEWER_3D_SCREEN_ID = 'viewer-3d';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang mã dự án, nên chưa mở được khung nhìn 3D. Quay lại danh sách dự án rồi chọn lại dự án cần xem.';

export interface Viewer3DContainerProps {
  readonly projectId: string;
  /** Vai của người đang xem. Vai Người xem gỡ công cụ sửa khỏi ray và khỏi cảnh. */
  readonly roles?: readonly ProjectRole[];
  /** Mở ô tìm đối tượng — phím `/`. Vỏ không tự dựng hộp thoại nào. */
  readonly onOpenSearch?: () => void;
  /** Chế độ tô màu P-06; `'default'` khi vắng mặt. */
  readonly coloringModeId?: ColoringModeId;

  /* Chỗ tiêm của story và bài kiểm (R-73 — bản giả phải cắm được vào). */
  readonly gateway?: ViewerShellGateway;
  readonly spatial?: NormalizedSpatial | null;
  readonly forceState?: ViewerScreenState;
  readonly isDev?: boolean;
  readonly perf?: { readonly frameRate: number; readonly triangles: number } | null;
  readonly registry?: ShortcutRegistry;
  /** Chỗ gửi O-01; vắng mặt thì hook tự dựng một sender. */
  readonly telemetry?: Viewer3DTelemetry;
  /** Thay module cảnh, cho bài kiểm không cần WebGL. */
  readonly mountScene?: MountViewerScene;
}

/** Cùng khuôn `ScreenCrashFallback` của `src/App.tsx` — R-62. */
function Viewer3DCrashFallback({ report, retry }: ScreenErrorFallback) {
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

interface WiredViewer3DSceneProps extends Viewer3DContainerProps {
  readonly frame: ViewerSceneFrame;
  readonly sceneActions: ViewerSceneActions | undefined;
}

/**
 * Nội dung khe cắm cảnh: hook cộng view, không provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `ViewerShell.container.tsx:107-115`.
 */
function WiredViewer3DScene(props: WiredViewer3DSceneProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const model = useViewer3D({
    projectId: props.projectId,
    canvas,
    frame: props.frame,
    ...(props.sceneActions !== undefined ? { sceneActions: props.sceneActions } : {}),
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.spatial !== undefined ? { spatial: props.spatial } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.forceState !== undefined ? { forceState: props.forceState } : {}),
    ...(props.coloringModeId !== undefined ? { coloringModeId: props.coloringModeId } : {}),
    ...(props.telemetry !== undefined ? { telemetry: props.telemetry } : {}),
    ...(props.mountScene !== undefined ? { mountScene: props.mountScene } : {}),
  });

  return <Viewer3D {...model} canvasRef={setCanvas} />;
}

export function Viewer3DContainer(props: Viewer3DContainerProps) {
  const renderScene = useCallback(
    // Hai tham số, tham số thứ hai TUỲ CHỌN — mục B của hợp đồng. Đây là hình
    // dạng duy nhất vừa gán được vào `renderScene` một tham số của vỏ, vừa đọc
    // được `actions` mà `ViewerViewport.tsx:123` luôn truyền thật.
    (frame: ViewerSceneFrame, actions?: ViewerSceneActions): ReactNode => (
      <WiredViewer3DScene {...props} frame={frame} sceneActions={actions} />
    ),
    [props],
  );

  return (
    <ScreenErrorBoundary
      key={props.projectId}
      renderFallback={(fallback): ReactNode => <Viewer3DCrashFallback {...fallback} />}
      screenId={VIEWER_3D_SCREEN_ID}
    >
      <ViewerShellContainer
        projectId={props.projectId}
        renderScene={renderScene}
        {...(props.roles !== undefined ? { roles: props.roles } : {})}
        {...(props.onOpenSearch !== undefined ? { onOpenSearch: props.onOpenSearch } : {})}
        {...(props.gateway !== undefined ? { gateway: props.gateway } : {})}
        {...(props.spatial !== undefined ? { spatial: props.spatial } : {})}
        {...(props.forceState !== undefined ? { forceState: props.forceState } : {})}
        {...(props.isDev !== undefined ? { isDev: props.isDev } : {})}
        {...(props.perf !== undefined ? { perf: props.perf } : {})}
        {...(props.registry !== undefined ? { registry: props.registry } : {})}
      />
    </ScreenErrorBoundary>
  );
}

/**
 * Vỏ route — thứ DUY NHẤT trong thư mục màn biết tới `react-router-dom`.
 *
 * Cùng khuôn `ViewerShellRoute`: đọc tham số đường dẫn, đọc vai từ phiên, và từ
 * chối tử tế khi đường dẫn thiếu mã dự án thay vì dựng một màn không có gì để
 * xem (A11).
 */
export function Viewer3DRoute() {
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

  return <Viewer3DContainer projectId={id} roles={session.roles} />;
}
