/**
 * Nối hook vào view. Đây là chỗ DUY NHẤT của màn biết cả hai nửa tồn tại.
 *
 * `ScreenErrorBoundary` bọc ở đây và bắt được lỗi của **cây này**. Lỗi ở
 * **gốc React thứ hai** của Pascal thì nó KHÔNG với tới — đường báo cho chúng
 * là `onFatal` trong `usePascalViewer`, đẩy màn sang trạng thái `error`. Hai
 * đường khác nhau cho hai loại lỗi khác nhau, và đó là hệ quả bắt buộc của
 * việc Pascal dựng gốc riêng.
 *
 * `key` đổi theo bản vẽ để ranh giới gắn lại mỗi lần đổi bản vẽ — cùng khuôn
 * `src/App.tsx` dùng.
 */

import { AlertCircle } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ProjectSpatialGate } from '@/components/feedback/ProjectSpatialGate';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { ApiClient } from '@/api/client';
import { denormalizeSpatial } from '@/domain/spatial/normalize';
import type { SpatialGraph } from '@/domain/spatial/types';
import { useFloorLayerAutosave } from '@/hooks/useAutosave';
import { useNotifications } from '@/hooks/useNotifications';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import { useSession } from '@/hooks/useSession';
import { useShortcut } from '@/hooks/useShortcut';
import type { PascalMeasurementDelete } from '@/components/pascal/pascalMountTypes';
import { can } from '@/lib/auth/permissions';
import { savePascalNodeAsTemplate } from '@/lib/pascal/template';
import type { PascalScene } from '@/lib/pascal/types';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import type { ProjectRole } from '@/types/project';
import { ROUTES } from '@/routes/paths';
// Nhập THẲNG module, KHÔNG qua barrel `index.ts` của màn kia: đi qua barrel là
// kéo cả cụm màn ấy vào chunk của route này, và cổng "chi phí thêm cho một màn"
// đo được đúng điều đó — 282,1 / 280 KiB, vượt 2,1.
//
// Và luật nhà mẫu nhập từ ĐÚNG module giữ `VIEWER_FIXTURE_SPATIAL`, không từ
// `Viewer3D/useViewer3DSource`: hai màn cùng nhập module thứ hai ấy thì Rollup
// tách nó ra một chunk dùng chung 507 byte và cổng lại đỏ vì 39 byte.
import { CollaborationLayerContainer } from '@/screens/system/CollaborationLayer';
import { selectViewerSpatial } from '@/screens/viewer/ViewerShell/viewerShellGateway';
import { useStore } from '@/store';

import { PascalViewer } from './PascalViewer';
import {
  PASCAL_HISTORY_TOASTS,
  PASCAL_SIDE_PANEL_LABELS,
  type PascalSidePanel,
  type PascalSidePanelId,
} from './pascalViewerTypes';
import { usePascalEdits } from './usePascalEdits';
import { usePascalViewer, type UsePascalViewerOptions } from './usePascalViewer';

/*
 * Bảng lịch sử nạp muộn, và đó là một phép đo chứ không phải thói quen: ngân
 * sách `routeChunk` là 280 KiB, `HistoryPanel` là ~4 000 dòng, còn bảng chỉ
 * dựng khi người dùng mở nó. Nhập tĩnh là bắt mọi lượt mở `/3d` trả tiền cho
 * một bảng phần lớn phiên không ai bấm tới.
 */
const LazyHistoryPanel = lazy(() =>
  import('@/screens/viewer/HistoryPanel').then((module) => ({
    default: module.HistoryPanelContainer,
  })),
);

/** Loại thông báo của một lượt sửa bị chặn — toast gom theo loại. */
export const PASCAL_REJECTED_NOTIFICATION_TYPE = 'pascal.edit.rejected';

/** Tiêu đề toast khi lượt sửa bị chặn; lý do đi vào phần mô tả. */
export const PASCAL_REJECTED_TITLE = 'Không ghi được thay đổi';

/** Loại thông báo khi bộ tự lưu tầng không gửi được thay đổi lên máy chủ (A7). */
export const PASCAL_SAVE_FAILED_NOTIFICATION_TYPE = 'pascal.save.failed';

/** Tiêu đề toast khi lưu hỏng; câu chi tiết của bộ tự lưu đi vào mô tả. */
export const PASCAL_SAVE_FAILED_TITLE = 'Chưa lưu được thay đổi';

/** Loại thông báo của một cú nhảy lịch sử — toast gom theo loại (A8). */
export const PASCAL_HISTORY_NOTIFICATION_TYPE = 'pascal.history.jump';

/** Loại thông báo của một phép đo vừa bị xoá — kèm nút hoàn tác (A8, #63). */
export const PASCAL_MEASUREMENT_DELETE_NOTIFICATION_TYPE = 'pascal.measurement.deleted';

export interface PascalViewerContainerProps {
  readonly graph: SpatialGraph | null;
  /**
   * Vai chỉ-xem. Bỏ trống thì container tự hỏi quyền theo vai của dự án —
   * `can('edit', 'layer', …)`, cùng cổng `VersionHistory` dùng cho nút khôi phục.
   */
  readonly readOnly?: boolean | undefined;
  readonly collapsed?: boolean | undefined;
  /**
   * Cửa nạp gói vách ngăn, tách ra để bài kiểm chạy qua **cây component thật**.
   *
   * Không phải chỗ tiêm cho vui: một vòng chết từng sống sót qua 41 bài kiểm
   * đơn vị vì bộ dựng thử của hook gắn `canvasRef` vào một `div` vô điều kiện,
   * đi vòng qua nhánh điều kiện của view. Có chỗ tiêm này thì bài kiểm dựng
   * đúng `PascalViewerContainer` → `PascalViewer` → `usePascalViewer` như lúc
   * chạy thật, và bắt được vòng chết ấy mà không cần WebGL.
   */
  readonly loadMount?: UsePascalViewerOptions['loadMount'] | undefined;
  /** Lối ra ở đầu màn và hành động của trạng thái rỗng — `PascalViewerProps`. */
  readonly onLeave?: (() => void) | undefined;
  readonly onReprocess?: (() => void) | undefined;
  /**
   * Bảng phụ thêm vào ba cái của màn (#45).
   *
   * "Lịch sử thao tác" đã nối sẵn ở đây. "Diện tích phòng" và "Thư viện đồ
   * đạc" cần cổng riêng của chúng (`onOpenExport`, `onCheckWallGaps`…), nên
   * màn cha truyền vào qua đây thay vì container tự đoán.
   */
  readonly extraPanels?: readonly PascalSidePanel[] | undefined;
  /** Dự án mà bộ tự lưu tầng ghi vào. Vắng thì lấy dự án của kho đang nạp. */
  readonly projectId?: string | undefined;
  /** Chỉ dành cho test — mặc định bộ tự lưu dùng client của ứng dụng. */
  readonly apiClient?: Pick<ApiClient, 'spatial'> | undefined;
}

/** Thứ người dùng thấy thay cho màn đã sập. Chữ lấy thẳng từ `report.description`. */
function CrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="flex h-full items-center justify-center bg-bg-app">
      <EmptyState
        icon={<AlertCircle aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

function PascalViewerBody({
  apiClient,
  graph,
  collapsed,
  extraPanels,
  loadMount,
  onLeave,
  onReprocess,
  projectId,
  readOnly,
}: PascalViewerContainerProps) {
  const session = useSession();
  const spatialProjectId = useStore((state) => state.spatialProjectId);
  const storeRoles = useStore((state) => state.userRoles);
  const spatial = useStore((state) => state.spatial);
  const { publish } = useNotifications();
  /* `/3d?tool=measure` (route đo cũ chuyển hướng về đây). Đọc thẳng URL một lần
     thay vì `useSearchParams`, để thân màn không bắt buộc nằm trong `<Router>`. */
  const initialTool = useMemo(
    () => (new URLSearchParams(window.location.search).get('tool') === 'measure' ? 'measure' : undefined),
    [],
  );

  // Vai theo dự án đang mở là nguồn đúng nhất; phiên đăng nhập là nguồn dự phòng.
  const roles: readonly ProjectRole[] = storeRoles.length > 0 ? storeRoles : session.roles;
  const isReadOnly = readOnly ?? !can('edit', 'layer', { roles });
  const [searchParams] = useSearchParams();
  const explodeLevels = searchParams.get('view') === 'exploded';

  /* A8 — mọi thay đổi hoàn tác được, KÈM TOAST. Không có nút lưu (A7), nên
     toast này là chỗ duy nhất nói ra rằng cú nhảy vừa rồi đã thành việc thật
     và đang trên đường lưu. Chỉ cú nhảy người dùng bấm mới tới đây — xem
     `PascalFrameProps.onHistoryJump`. */
  const onHistoryJump = useCallback(
    (kind: 'undo' | 'redo') => {
      publish({
        ...PASCAL_HISTORY_TOASTS[kind],
        type: PASCAL_HISTORY_NOTIFICATION_TYPE,
      });
    },
    [publish],
  );

  const onMeasurementDelete = useCallback(
    ({ ordinal, undo }: PascalMeasurementDelete) => {
      const title = `Đã xoá phép đo ${ordinal}`;
      publish({
        description: 'Bấm "Hoàn tác" để đưa phép đo trở lại.',
        title,
        type: PASCAL_MEASUREMENT_DELETE_NOTIFICATION_TYPE,
        undoTicket: createUndoTicket({ description: title, undo: () => undo() }),
      });
    },
    [publish],
  );

  const onRejected = useCallback(
    (reason: string) => {
      publish({
        description: reason,
        title: PASCAL_REJECTED_TITLE,
        type: PASCAL_REJECTED_NOTIFICATION_TYPE,
      });
    },
    [publish],
  );

  /* A7 — bộ tự lưu lớp tầng dùng chung (cùng saver màn `/3d` cũ dùng): mọi
     `commit` của `usePascalEdits` làm kho đổi, saver thấy tầng bị đổi và gửi
     PUT `…/spatial/layer` sau 800 ms. Thiếu nó thì editor nói "đã lưu" mà
     không gì tới máy chủ (F-15 R2). */
  const floorSave = useFloorLayerAutosave({
    projectId: projectId ?? spatialProjectId ?? '',
    ...(apiClient === undefined ? {} : { apiClient }),
  });
  const indicator = useSaveIndicator(floorSave.autosave);
  /* Câu lưu của màn lấy từ bộ tự lưu AppFront — lưu THẬT xong mới "Đã lưu lúc
     HH:MM". Trạng thái lưu nội bộ của editor Pascal không còn lên màn. */
  const saveLabel =
    floorSave.saveBlock?.message ?? (indicator.state === 'saved' ? floorSave.label : indicator.label);

  useEffect(() => {
    if (indicator.state !== 'failed') return;

    publish({
      description: indicator.label,
      title: PASCAL_SAVE_FAILED_TITLE,
      type: PASCAL_SAVE_FAILED_NOTIFICATION_TYPE,
    });
  }, [indicator.state, indicator.label, publish]);

  /* Cảnh đã đẩy sang Pascal là mốc "trước" của lượt sửa đầu tiên. Hook xem
     dựng nó trong một hiệu ứng, nên nó về qua state sau một nhịp —
     `usePascalEdits` chịu được `null` và chỉ bỏ qua lượt ghi đến trước mốc ấy. */
  const [loadedScene, setLoadedScene] = useState<PascalScene | null>(null);
  const { onSceneCommit, validateCommit } = usePascalEdits({
    spatial,
    loadedScene,
    readOnly: isReadOnly,
    onRejected,
  });

  /* #25 "Lưu làm khuôn mẫu": cùng lời gọi `propertyTemplates.create` màn cũ dùng.
     Máy khách API nạp động để màn 3D không kéo cả `appClient` vào chunk của nó. */
  const onSaveAsTemplate = useCallback(async (nodeId: string) => {
    const { createAppApiClient } = await import('@/api/appClient');
    const state = useStore.getState();
    const projectId = state.project?.id;

    return savePascalNodeAsTemplate({
      nodeId,
      spatial: state.spatial,
      projectId: projectId === undefined || projectId === '' ? null : projectId,
      api: createAppApiClient(),
    });
  }, []);

  const { viewModel, canvasRef, sceneTarget, loadedScene: viewerScene, onRetry, onExpand } = usePascalViewer({
    graph,
    mode: 'edit',
    readOnly: isReadOnly,
    onSceneCommit,
    validateCommit,
    onCommitRejected: onRejected,
    ...(isReadOnly ? {} : { onSaveAsTemplate }),
    initialTool,
    onHistoryJump,
    onMeasurementDelete,
    explodeLevels,
    mountKey: projectId ?? spatialProjectId ?? '',
    ...(collapsed === undefined ? {} : { collapsed }),
    ...(loadMount === undefined ? {} : { loadMount }),
  });

  useEffect(() => {
    setLoadedScene(viewerScene);
  }, [viewerScene]);

  const [activePanel, setActivePanel] = useState<PascalSidePanelId | null>(null);

  const panels = useMemo<readonly PascalSidePanel[]>(
    () => [
      {
        id: 'history',
        label: PASCAL_SIDE_PANEL_LABELS.history,
        render: () => (
          <Suspense fallback={<p className="p-3 text-sm text-text-muted">Đang mở bảng…</p>}>
            {/* Vỏ `panel` cố định: vùng bảng của `PascalViewer` tự làm tấm trượt dưới
                `lg`, nên vỏ `sheet` riêng của bảng sẽ thoát khỏi vùng ấy (23H-F-002). */}
            <LazyHistoryPanel layout="panel" />
          </Suspense>
        ),
      },
      ...(extraPanels ?? []),
    ],
    [extraPanels],
  );

  /* A12/#46 — Esc đóng lớp trên cùng, và khi một bảng phụ đang mở thì bảng ấy
     LÀ lớp trên cùng của màn. Đăng ký ở `sidePanel` chứ không ở `global`, nên
     một hộp thoại mở đè lên vẫn giành Esc trước. `enabled` tắt hẳn đăng ký khi
     không bảng nào mở: không bảng nào mở thì Esc không thuộc về màn này. */
  useShortcut(
    {
      id: 'pascalViewer.sidePanel.close',
      combo: 'Escape',
      scope: 'sidePanel',
      description: 'Đóng bảng phụ đang mở',
      onTrigger: () => setActivePanel(null),
    },
    { enabled: activePanel !== null },
  );

  /* #37 — phím của màn đi qua registry chung, nên lượt trùng phím nào cũng bị
     `shortcutRegistry` báo ra thay vì im lặng đè lên nhau. */
  useShortcut({
    id: 'pascalViewer.sidePanel.history',
    combo: 'Ctrl+H',
    scope: 'canvas',
    description: 'Mở hoặc đóng bảng lịch sử thao tác',
    onTrigger: () => setActivePanel((current) => (current === 'history' ? null : 'history')),
  });

  return (
    <PascalViewer
      viewModel={{ ...viewModel, saveLabel }}
      canvasRef={canvasRef}
      onRetry={onRetry}
      onExpand={onExpand}
      onLeave={onLeave}
      onReprocess={onReprocess}
      panels={panels}
      activePanel={activePanel}
      onPanelChange={setActivePanel}
      sceneOverlay={<CollaborationLayerContainer scene={sceneTarget} />}
    />
  );
}

export function PascalViewerContainer({
  apiClient,
  graph,
  collapsed,
  extraPanels,
  loadMount,
  onLeave,
  onReprocess,
  projectId,
  readOnly,
}: PascalViewerContainerProps) {
  return (
    <ScreenErrorBoundary
      key={graph === null ? 'trong' : graph.building.name}
      screenId="pascal-viewer"
      renderFallback={(fallback) => <CrashFallback {...fallback} />}
    >
      <PascalViewerBody
        apiClient={apiClient}
        collapsed={collapsed}
        extraPanels={extraPanels}
        graph={graph}
        loadMount={loadMount}
        onLeave={onLeave}
        onReprocess={onReprocess}
        projectId={projectId}
        readOnly={readOnly}
      />
    </ScreenErrorBoundary>
  );
}

/**
 * Cửa vào của router.
 *
 * ## Vì sao không đọc thẳng `store.spatial`
 *
 * Bản đầu của màn này làm thế, và nó **kẹt ở "đang nạp" mãi**: không ai nạp kho.
 * Nay cổng `ProjectSpatialGate` nạp kho theo `:projectId` (B-V12-01), và màn đọc
 * qua `selectViewerSpatial` — cùng luật nhà mẫu với `/3d` (mock + kho chưa có
 * tường thì nhà mẫu; nối BE thật thì kho rỗng là kho rỗng), cộng một chốt: cổng
 * đang nạp thì `null`, để kho của dự án trước không hiện dưới tên dự án này.
 */
export function PascalViewerRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const spatial = useStore(selectViewerSpatial);

  // `null` đẩy màn sang "đang nạp" chứ không dựng một đồ thị rỗng giả.
  const graph = useMemo(() => (spatial === null ? null : denormalizeSpatial(spatial)), [spatial]);

  /* Màn đứng một mình dưới router, không vỏ nào cấp chiều cao: thiếu `h-screen`
     thì `h-full` của khung ra 0 và cả màn co về `min-h-[24rem]` — đo 1440×900:
     trang 384 px, hộp dựng 192 px (B-V10-02). Bọc ở đây chứ không ở `Frame`, để
     chỗ nhúng màn vào bố cục khác vẫn tự quyết chiều cao. */
  return (
    <div className="h-screen">
      <ProjectSpatialGate projectId={projectId}>
        {/* Không còn `onLeave`: màn này LÀ `/3d` sau F-15, nên "về màn xem 3D"
            sẽ trỏ về chính nó. Lối đi tiếp của trạng thái rỗng thì vẫn thật. */}
        <PascalViewerContainer
          graph={graph}
          projectId={projectId}
          onReprocess={
            projectId === undefined ? undefined : () => navigate(ROUTES.project.pipeline(projectId))
          }
        />
      </ProjectSpatialGate>
    </div>
  );
}
