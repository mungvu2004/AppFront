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
 * ## Sáu panel đã dựng sẵn, nay đã có người gọi
 *
 * Sáu container panel (`PropertyInspector`, `RoomAreaPanel`,
 * `FurnitureLibraryPanel`, `HistoryPanel`, `WallGeometryEditor`,
 * `CollaborationLayer`) đều ghi trong docblock của chúng rằng chúng là một
 * PHẦN của `Viewer3D` và "chưa nơi nào dựng thẻ này — nợ đã ghi nhận". Lượt
 * này trả nợ ấy, và nó chia làm hai đường vì sáu panel không cùng một hình
 * dạng:
 *
 * - **Bốn panel nội dung** đi vào khe `inspectorSections` của vỏ, qua
 *   `Viewer3DPanels.tsx`. Khe ấy đã có trong `viewerShellTypes.ts:371` cho
 *   VIEW từ đầu (`useMeasurementTool.ts:911` dùng nó thật), nhưng
 *   `useViewerShell` không trả trường ấy nên một màn đi qua CONTAINER không có
 *   đường nào chạm tới. `ViewerShell.container.tsx` nay nhận prop tuỳ chọn
 *   cùng tên và chuyển tiếp — thêm, không đổi: vắng mặt thì vỏ dựng y hệt hôm
 *   nay.
 * - **Hai lớp phủ** (`CollaborationLayer`, `WallGeometryEditor`) đi vào khe
 *   CẢNH qua `Viewer3DOverlays.tsx`, vì cả hai khai `absolute inset-0` ở gốc
 *   của chúng và đòi một khung phủ đúng khung nhìn 3D. Lý do đầy đủ ở đầu file
 *   ấy.
 *
 * Container đọc `selectedIds` và `activeFloorId` THẲNG TỪ KHO thay vì lấy từ
 * `frame`: `frame` chỉ tồn tại bên trong khe cảnh, còn `useViewerShell.ts:444`
 * cũng đọc đúng lát kho ấy — cùng một nguồn, không phải nguồn thứ hai.
 *
 * ## `useNavigate` nay có mặt ở CONTAINER, không chỉ ở vỏ route
 *
 * Ba đường ra ngoài của cột panel (`onOpenRuleScreen`, `onOpenExport`,
 * `onCheckWallGaps`) là CALLBACK chứ không phải `href`, và R-73 đòi mỗi cái có
 * một đích THẬT. Hệ quả: bài kiểm nào dựng `Viewer3DContainer` phải bọc một
 * `MemoryRouter`, cùng khuôn `ViewerShell.test.tsx`. Ghi ra để người sau không
 * phải dò lại (E.10).
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
import { useNavigate, useParams } from 'react-router-dom';

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
import { ROUTES } from '@/routes/paths';
import { isIdOfKind } from '@/domain/spatial/ids';
import type { EntityId } from '@/domain/spatial/types';
import type { ProjectRole } from '@/types/project';

import { Viewer3DPanels, type Viewer3DPanelId } from './Viewer3DPanels';
import { Viewer3DSceneSlot } from './Viewer3DSceneSlot';
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

export function Viewer3DContainer(props: Viewer3DContainerProps) {
  /* A12: giữ listener bàn phím sống suốt lúc màn còn gắn. Không có dòng này thì
     mọi phím vỏ đăng ký — kể cả `/` — không bao giờ tới được sổ phím. */
  useShortcutListener(props.registry !== undefined ? { registry: props.registry } : {});

  const navigate = useNavigate();
  const storeSpatial = useStore((state) => state.spatial);
  const storeFloorId = useStore((state) => state.activeFloorId);
  const selectedIds = useStore((state) => state.selectedIds);
  const setSelection = useStore((state) => state.setSelection);
  const clearSelection = useStore((state) => state.clearSelection);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [openPanelId, setOpenPanelId] = useState<Viewer3DPanelId | null>(null);
  const [isWallEditing, setIsWallEditing] = useState(false);

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

  /* Tầng đang mở — cùng phép rơi về của `useOverlayComparison.ts:365`: kho biết
     thì kho thắng, kho chưa biết thì tầng đầu của đồ thị đã chốt. `null` chỉ
     còn lại khi KHÔNG có tầng nào, và lúc ấy thư viện đồ đạc không có gì để
     lọc nên nút của nó không được dựng. */
  const resolvedFloorId: string | null =
    storeFloorId ?? resolvedSpatial?.byKind.level[0] ?? null;

  /* Bốn đường ra ngoài của cột panel. Không đường nào là hàm rỗng: mỗi cái tới
     một màn CÓ THẬT trong `ROUTES` (R-73). */
  const onOpenRuleScreen = useCallback((): void => {
    /* `ROUTES.project.rules` không nhận mã đối tượng — màn luật liệt kê vi phạm
       theo DỰ ÁN. Nên mã đối tượng không được gắn thành một tham số truy vấn mà
       màn kia không đọc; nó ở lại trong kho chọn, thứ màn luật đọc chung. */
    navigate(ROUTES.project.rules(props.projectId));
  }, [navigate, props.projectId]);

  const onOpenExport = useCallback((): void => {
    navigate(ROUTES.project.export(props.projectId));
  }, [navigate, props.projectId]);

  const onCheckWallGaps = useCallback((): void => {
    /* Soát khe hở tường là việc của lớp tường MỘT tầng. Chưa biết tầng thì đi
       tới danh sách tầng — cùng phép rơi về `qcHref` của `useViewer3D.ts:733`. */
    navigate(
      resolvedFloorId === null
        ? ROUTES.project.floors(props.projectId)
        : ROUTES.project.walls(props.projectId, resolvedFloorId),
    );
  }, [navigate, props.projectId, resolvedFloorId]);

  const onNavigateToObject = useCallback(
    (entityId: string): void => {
      /* A10: đi qua hành động của kho, không `set()`. Kho chọn LÀ đường dây
         chung giữa panel và mô hình (`useViewerShell.ts:444`), nên ghi vào đó
         là vừa đổi panel vừa làm sáng đối tượng trên hình. */
      setSelection([entityId as EntityId]);
    },
    [setSelection],
  );

  const onModelDropped = useCallback((_modelId: string, targetEntityId: string | null): void => {
    /* Thư viện đã tự chèn mô hình vào kho; việc còn lại của khung nhìn là đưa
       đối tượng vừa chèn vào vùng chọn để người dùng thấy ngay mình vừa thả gì.
       Thả ra chỗ trống thì không có mã nào để chọn. */
    if (targetEntityId !== null) {
      setSelection([targetEntityId as EntityId]);
    }
  }, [setSelection]);

  /* Chế độ sửa hình học chỉ mở được trên TƯỜNG, và tiền tố mã là dấu hiệu duy
     nhất đọc được lúc chạy (`domain/spatial/normalize.ts:60-64`). Vùng chọn
     đổi sang thứ khác thì chế độ tự đóng — không có nhánh nào để lại một lớp
     phủ sửa tường lơ lửng trên một cái ghế. */
  const canEditWallGeometry = selectedIds.some((entityId) => isIdOfKind('wall', entityId));
  const isWallEditingNow = isWallEditing && canEditWallGeometry;

  const onToggleWallEditing = useCallback((): void => {
    setIsWallEditing((editing) => !editing);
  }, []);

  const onExitWallEditMode = useCallback((): void => {
    setIsWallEditing(false);
  }, []);

  const inspectorSections = (
    <Viewer3DPanels
      canEditWallGeometry={canEditWallGeometry}
      floorId={resolvedFloorId}
      isWallEditing={isWallEditingNow}
      onCheckWallGaps={onCheckWallGaps}
      onDismissInspector={clearSelection}
      onModelDropped={onModelDropped}
      onNavigateToObject={onNavigateToObject}
      onOpenExport={onOpenExport}
      onOpenRuleScreen={onOpenRuleScreen}
      onTogglePanel={setOpenPanelId}
      onToggleWallEditing={onToggleWallEditing}
      openPanelId={openPanelId}
      projectId={props.projectId}
      selectedEntityId={selectedIds[0] ?? null}
      selectedEntityIds={selectedIds}
    />
  );

  const renderScene = useCallback(
    // Hai tham số, tham số thứ hai TUỲ CHỌN — mục B của hợp đồng. Đây là hình
    // dạng duy nhất vừa gán được vào `renderScene` một tham số của vỏ, vừa đọc
    // được `actions` mà `ViewerViewport.tsx:123` luôn truyền thật.
    (frame: ViewerSceneFrame, actions?: ViewerSceneActions): ReactNode => (
      <Viewer3DSceneSlot
        {...props}
        frame={frame}
        isSearchOpen={isSearchOpen}
        isWallEditing={isWallEditingNow}
        onCloseSearch={onCloseSearch}
        onExitWallEditMode={onExitWallEditMode}
        onOpenSearch={onOpenSearch}
        resolvedGateway={resolvedGateway}
        resolvedSpatial={resolvedSpatial}
        sceneActions={actions}
      />
    ),
    [
      props,
      isSearchOpen,
      isWallEditingNow,
      onCloseSearch,
      onExitWallEditMode,
      onOpenSearch,
      resolvedGateway,
      resolvedSpatial,
    ],
  );

  return (
    <ScreenErrorBoundary
      key={props.projectId}
      renderFallback={(fallback): ReactNode => <Viewer3DCrashFallback {...fallback} />}
      screenId={VIEWER_3D_SCREEN_ID}
    >
      <ViewerShellContainer
        gateway={resolvedGateway}
        inspectorSections={inspectorSections}
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
 * Vỏ route — chỗ DUY NHẤT trong thư mục màn đọc THAM SỐ ĐƯỜNG DẪN.
 *
 * (Container cũng nhập `react-router-dom` từ lượt gắn panel — xem mục
 * "`useNavigate` nay có mặt ở CONTAINER" ở đầu file.)
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
