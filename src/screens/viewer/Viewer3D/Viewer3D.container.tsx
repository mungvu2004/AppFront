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
 * ## MỘT nguồn dữ liệu, không phải hai
 *
 * Trước đây vỏ và màn nội dung nhìn hai đồ thị khác nhau: `useViewerShell` mặc
 * định dùng cổng BỘ MẪU (`useViewerShell.ts:345-346`) nên thanh trạng thái hiện
 * "4 tầng · 14 phòng · 248,60 m²", còn `useViewer3D` mặc định đọc KHO — thứ ở
 * môi trường dev vẫn là `null`, vì bảy màn QC nạp kho đều đọc vòng tròn lại
 * chính nó. Kết quả: vỏ có 14 phòng, cảnh không có phòng nào, và không có phòng
 * nào để tìm.
 *
 * Container chốt đồ thị MỘT LẦN ở đây rồi tiêm cùng giá trị ấy vào cả hai qua
 * hai chỗ tiêm đã có sẵn (`ViewerShellContainerProps.gateway` và `.spatial`):
 *
 * - kho có đồ thị thật → đó là nguồn, và cổng là cổng THẬT;
 * - kho rỗng → dùng ĐÚNG bộ mẫu mà vỏ vẫn đang dùng
 *   (`VIEWER_FIXTURE_SPATIAL`), chứ không dựng một bảng dữ liệu thứ ba.
 *
 * **Đây là đường TẠM.** Nó ở đây vì chưa endpoint nào trả về `NormalizedSpatial`
 * — `data-gateway-contract.md` mục A ghi rõ khoảng trống ấy, và `FloorSchema`
 * không mang phòng. Ngày có endpoint thật, nhánh bộ mẫu này bị xoá và
 * `createViewerShellGateway` là nhánh duy nhất còn lại. Không ai được lấp chỗ
 * đó bằng một lượt gọi mạng tự chế (R-69).
 *
 * ## Vai người dùng vẫn chưa chảy tới màn — hệ quả, đã đo
 *
 * Mã của bộ mẫu vỏ ĐÃ được sửa cho hợp lệ theo `domain/spatial/ids.ts`
 * (`viewerShellFixture.ts`), nên `toBuildFloorInput` dựng được hình thật và
 * cảnh 3D ở dev đã có khối nhà bốn tầng — đo bằng Playwright, canvas 960×415.
 *
 * Thứ CÒN chặn là vai — **đã hết chặn (R1)**, và đoạn trên là bản ghi của lần
 * đo trước. Hai chỗ đứt, không phải một:
 *
 * 1. **Không nơi nào trong `src` gọi `configureAuth()`.** `setAuthenticatedSession`
 *    chỉ có đúng một người gọi (`lib/auth/refresh.ts`), và người ấy chạy trong
 *    `bootstrapSession()`, thứ ném ngay khi tầng phiên chưa được cấu hình. Nên
 *    chuỗi `signIn → bootstrapSession → roles` đứt ở mắt đầu tiên, cho cả bản
 *    thật lẫn bản mock. `AuthScreen.container.tsx` nay cấu hình tầng phiên ngay
 *    trước lượt post, và dưới `VITE_USE_MOCK_API` nó đưa vào một chuyến đi giả
 *    (`createMockAuthTransport`) để lượt gia hạn có người trả lời.
 * 2. **Khối `sr-only` của `Viewer3D.tsx` nuốt cú bấm.** Ngay cả khi `canEdit`
 *    đúng và `createPointerPicker` đã gắn, khối phủ kín khung nhìn ở trạng thái
 *    `success` nằm SAU `<canvas>` trong DOM nên đứng trên nó khi dò trúng đích.
 *    `pointer-events-none` gỡ chỗ ấy.
 *
 * Cả hai đều đo bằng trình duyệt thật, và `e2e/viewer3d.spec.ts` giữ hai bài
 * chứng minh: vai kỹ sư thì bấm chọn được một đối tượng, vai chỉ-xem thì cùng
 * cú bấm ấy không chọn gì.
 *
 * Ghi ra đây để người sau không phải dò lại (E.10).
 *
 * ## Ô tìm đối tượng: khe `onOpenSearch` cuối cùng cũng có người cắm vào
 *
 * Vỏ nhận `onOpenSearch` và gọi nó khi người dùng bấm `/`, nhưng docblock của
 * nó nói thẳng "vỏ không tự dựng hộp thoại nào". Trước đây màn này chỉ CHUYỂN
 * TIẾP một prop tuỳ chọn mà không nơi gọi nào cung cấp — đúng ca R-73 gọi là
 * "callback tồn tại trên giấy". Giờ chính container giữ trạng thái đóng/mở và
 * `Viewer3D` vẽ ô tìm, nên prop chuyển tiếp ấy đã bị gỡ.
 *
 * `useShortcutListener` được gọi ở đây vì không có gì khác trên nhánh route này
 * giữ listener bàn phím: `useViewerShell` chỉ `register` các phím của nó, còn
 * `registry.attach(window)` chỉ xảy ra qua một trong các hook của
 * `hooks/useShortcut.ts`. Thiếu nó thì phím `/` — và cả `F`, `H`, `I` của vỏ —
 * không bao giờ chạy, và A12 mất một nửa lời hứa.
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

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useSession } from '@/hooks/useSession';
import { useShortcutListener } from '@/hooks/useShortcut';
import type { ColoringModeId } from '@/lib/coloring/modes';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { useStore } from '@/store';
import {
  createViewerShellFixtureGateway,
  createViewerShellGateway,
  VIEWER_FIXTURE_SPATIAL,
  ViewerShellContainer,
  type ViewerShellGateway,
} from '@/screens/viewer/ViewerShell';
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
  /** Đồ thị container đã chốt — ĐÚNG cái vỏ đang đọc. Xem "MỘT nguồn" ở đầu file. */
  readonly resolvedSpatial: NormalizedSpatial | null;
  /** Cổng container đã chốt — cũng là cổng vỏ đang dùng. */
  readonly resolvedGateway: ViewerShellGateway;
  readonly isSearchOpen: boolean;
  readonly onOpenSearch: () => void;
  readonly onCloseSearch: () => void;
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
    // Đồ thị và cổng KHÔNG còn là chỗ tiêm có điều kiện: container đã chốt
    // chúng, và chốt một lần là cả điểm của mục "MỘT nguồn dữ liệu".
    spatial: props.resolvedSpatial,
    gateway: props.resolvedGateway,
    ...(props.sceneActions !== undefined ? { sceneActions: props.sceneActions } : {}),
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.forceState !== undefined ? { forceState: props.forceState } : {}),
    ...(props.coloringModeId !== undefined ? { coloringModeId: props.coloringModeId } : {}),
    ...(props.telemetry !== undefined ? { telemetry: props.telemetry } : {}),
    ...(props.mountScene !== undefined ? { mountScene: props.mountScene } : {}),
  });

  return (
    <Viewer3D
      {...model}
      canvasRef={setCanvas}
      search={{
        ...model.search,
        isOpen: props.isSearchOpen,
        onOpen: props.onOpenSearch,
        onClose: props.onCloseSearch,
      }}
    />
  );
}

export function Viewer3DContainer(props: Viewer3DContainerProps) {
  /* A12: giữ listener bàn phím sống suốt lúc màn còn gắn. Không có dòng này thì
     mọi phím vỏ đăng ký — kể cả `/` — không bao giờ tới được sổ phím. */
  useShortcutListener(props.registry !== undefined ? { registry: props.registry } : {});

  const storeSpatial = useStore((state) => state.spatial);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  /* Kho rỗng là chuyện thường ở dev, không phải một sự cố: rơi về đúng bộ mẫu
     vỏ vẫn dùng, và ghi rõ đây là đường tạm (xem đầu file). */
  const usesFixture = props.spatial === undefined && storeSpatial === null;

  const resolvedSpatial: NormalizedSpatial | null = usesFixture
    ? VIEWER_FIXTURE_SPATIAL
    : (props.spatial ?? storeSpatial);

  const resolvedGateway = useMemo((): ViewerShellGateway => {
    if (props.gateway !== undefined) {
      return props.gateway;
    }

    return usesFixture
      ? createViewerShellFixtureGateway(VIEWER_FIXTURE_SPATIAL)
      : createViewerShellGateway(() => useStore.getState().spatial);
  }, [props.gateway, usesFixture]);

  const onOpenSearch = useCallback((): void => {
    setIsSearchOpen(true);
  }, []);

  const onCloseSearch = useCallback((): void => {
    setIsSearchOpen(false);
  }, []);

  const renderScene = useCallback(
    // Hai tham số, tham số thứ hai TUỲ CHỌN — mục B của hợp đồng. Đây là hình
    // dạng duy nhất vừa gán được vào `renderScene` một tham số của vỏ, vừa đọc
    // được `actions` mà `ViewerViewport.tsx:123` luôn truyền thật.
    (frame: ViewerSceneFrame, actions?: ViewerSceneActions): ReactNode => (
      <WiredViewer3DScene
        {...props}
        frame={frame}
        isSearchOpen={isSearchOpen}
        onCloseSearch={onCloseSearch}
        onOpenSearch={onOpenSearch}
        resolvedGateway={resolvedGateway}
        resolvedSpatial={resolvedSpatial}
        sceneActions={actions}
      />
    ),
    [props, isSearchOpen, onCloseSearch, onOpenSearch, resolvedGateway, resolvedSpatial],
  );

  return (
    <ScreenErrorBoundary
      key={props.projectId}
      renderFallback={(fallback): ReactNode => <Viewer3DCrashFallback {...fallback} />}
      screenId={VIEWER_3D_SCREEN_ID}
    >
      <ViewerShellContainer
        gateway={resolvedGateway}
        onOpenSearch={onOpenSearch}
        projectId={props.projectId}
        renderScene={renderScene}
        spatial={resolvedSpatial}
        {...(props.roles !== undefined ? { roles: props.roles } : {})}
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
