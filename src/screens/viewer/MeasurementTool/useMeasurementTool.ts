/**
 * Hook của màn `MeasurementTool`: nối lại logic đã có, không phát minh thêm cái nào.
 *
 * Mỗi việc dưới đây đã có chủ, và hook chỉ đưa dữ liệu đi qua đúng chủ của nó:
 *
 * | Việc | Ai làm |
 * |---|---|
 * | Chrome, camera, ray tầng, ray công cụ, panel phải | `useViewerShell` của vỏ |
 * | Bắn tia, gạn nhịp, phân biệt kéo với chấm | `createScenePick` + `createPointerPicker` (R-09) |
 * | Bắt điểm | `snapToTargets` của `src/domain/units/snap` (M-03) |
 * | Bốn phép đo | `measureDistance` · `measurePointToPlane` · `measureHeight` · `measurePolygonArea` |
 * | Mét → milimét | `metresToMillimetres` của `src/domain/units` |
 * | Số thành chuỗi | `formatLength` · `formatArea` · `formatNumber` (A15) |
 * | Phím tắt | `useShortcut` → `shortcutRegistry` (R-54, A12, R-72) |
 * | `isLoading` / `error` | `useQuery` / `useMutation` (R-64) |
 * | Vé hoàn tác | `deleteMeasurement` → `createUndoTicket` (A8, D-05) |
 * | Trạng thái công cụ | `reduceTool` của S-08 |
 *
 * Không một phép đo, một phép quy đổi đơn vị hay một phép làm tròn nào được viết
 * mới ở đây (R-61). Phần số học thuần nằm ở `measurementToolViewModel.ts`, phần
 * mạng và phần dựng mồi bắt điểm nằm ở `measurementToolGateway.ts`.
 *
 * ## Cảnh 3D đi VÀO hook, không ra từ nó
 *
 * Màn đo không dựng canvas: `MeasurementToolProps` không có `canvasRef` và view
 * là một lớp phủ. Camera, cây cảnh và cỡ khung nhìn tới qua
 * {@link UseMeasurementToolOptions.scene}, do container cắm vào. Vắng cảnh thì
 * không chấm được điểm và `screenPoints` là `null` — danh sách, đổi đơn vị, ẩn
 * hiện, xoá và hoàn tác vẫn chạy đủ.
 *
 * ## `M` được đăng ký hai lần, và bản của màn thắng
 *
 * `buildViewerShortcuts` của vỏ đã giữ `M` ở phạm vi `canvas`, nhưng nó chỉ
 * **bật** công cụ đo (`setActiveToolId('measure')`). Hợp đồng của màn đòi `M`
 * **bật tắt**, và một phím chỉ bật được là một phím người dùng không tắt được.
 * Nên màn đăng ký `M` của riêng nó sau vỏ; `handleKeyDown` duyệt sổ từ cuối lên
 * nên binding đăng ký sau trả lời trước. `findOverlaps()` sẽ kể tên cả hai —
 * đó là một sự thật đúng, không phải một lỗi cần giấu.
 *
 * ## `Esc` ở phạm vi `canvas`, và chỉ ở đó
 *
 * `SCOPE_PRIORITY` xếp `dialog` trước `canvas`, nên một hộp thoại đang mở vẫn
 * nuốt `Escape` trước màn đo — đúng lời hứa A12 mà không tính năng nào được lấy
 * đi. Đăng ký nó ở `global` hay `dialog` sẽ cướp mất `closeTopLayer`.
 *
 * ## Bộ đệm điểm KHÔNG phải một máy trạng thái thứ hai
 *
 * `reduceTool` giữ pha cử chỉ của S-08 (`activate` / `cancel`), và nó là chỗ duy
 * nhất giữ pha ấy. Nó KHÔNG giữ được các điểm đã chấm của màn này:
 * `MEASURE_TOOL` của `src/lib/tools/tools.ts` khai đúng HAI bước `point` và
 * `complete` của nó luôn gọi `measureDistance` — nên chế độ "diện tích mặt sàn"
 * (từ ba điểm trở lên) không đi lọt qua nó, còn "chiều cao" và "vuông góc" sẽ
 * nhận về một khoảng cách thẳng thay vì phép đo của chúng. Một danh sách điểm
 * không phải một máy trạng thái; nó là dữ liệu của cử chỉ mà S-08 chưa có từ
 * vựng để mang.
 */

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MeasurePoint } from '@/domain/measure/measure';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useShortcut, useShortcutListener } from '@/hooks/useShortcut';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { deleteMeasurement, saveMeasurement } from '@/lib/mutations/measurement';
import type { UndoTicket } from '@/lib/mutations/undoTicket';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { measurementKeys } from '@/lib/query/queryKeys';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createPointerPicker, createScenePick, type PickAt } from '@/lib/three/interaction/raycast';
import { TOOLS } from '@/lib/tools/tools';
import {
  createToolState,
  reduceTool,
  DEFAULT_TOOL_SETTINGS,
  type ToolContext,
  type ToolEvent,
  type ToolMachineState,
} from '@/lib/tools/toolMachine';
import type { MeasurementRecord } from '@/types/measurement';
import type { ProjectRole } from '@/types/project';
import { useStore } from '@/store';
import {
  createViewerShellGateway,
  useViewerShell,
  type ViewerShellGateway,
} from '@/screens/viewer/ViewerShell';
import type { ViewerPointPx, ViewerShellProps } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { MeasurementList } from './MeasurementList';
import { MeasurementTool } from './MeasurementTool';
import {
  createMeasurementHttpClient,
  createMeasurementToolGateway,
  formatMeasurementRow,
  INITIAL_MEASURE_UNIT,
  measurementCountLabel,
  nextMeasurementIdentity,
  NO_SNAP_LABEL,
  snapIndicatorOf,
  snapMeasurePoint,
  snapTargetsOf,
  toMeasurementRecord,
  toMeasurementRowCore,
} from './measurementToolGateway';
import type {
  DraftMeasurement,
  MeasurementScreenState,
  MeasurementToolGateway,
  MeasurementToolProps,
  MeasureMode,
  MeasureUnit,
  PinnedMeasurement,
  PinnedMeasurementId,
  ScreenPoint,
  SnapIndicator,
} from './measurementToolTypes';
import {
  attemptMeasure,
  projectAll,
  projectorFor,
  rawValueOf,
  REQUIRED_POINTS,
  toMeasurePoint,
  VIEWER_STATE_BY_MEASUREMENT,
  type MeasurementScene,
  type MeasurePick,
  type ScreenProjector,
} from './measurementToolViewModel';

/* -------------------------------------------------------------------------- */
/* Hằng số.                                                                    */
/* -------------------------------------------------------------------------- */

/** Mã binding — cái tên mà cảnh báo trùng phím của registry in ra. */
const TOGGLE_ID = 'measurementTool.tool.toggle';
const ESCAPE_ID = 'measurementTool.draft.cancel';
const PIN_ID = 'measurementTool.draft.pin';
const DELETE_ID = 'measurementTool.list.delete';

const TOGGLE_COMBO = 'M';
const ESCAPE_COMBO = 'Escape';
const PIN_COMBO = 'Enter';
const DELETE_COMBO = 'Delete';

/** Câu tiếng Việt cho bảng phím tắt, viết thường kiểu câu (A6). */
const TOGGLE_DESCRIPTION = 'bật tắt công cụ đo';
const ESCAPE_DESCRIPTION = 'thoát chế độ đo, bỏ phần đường dở dang';
const PIN_DESCRIPTION = 'ghim phép đo đang đọc';
const DELETE_DESCRIPTION = 'xoá phép đo đang chọn';

/**
 * Công cụ đo, và công cụ mỗi bên trả về khi tắt.
 *
 * Hai cái tên "tắt" khác nhau vì hai bảng công cụ khác nhau: ray trái của vỏ
 * dùng `ViewerToolId` (`'orbit'` là công cụ mặc định của nó), còn máy công cụ
 * S-08 dùng `ToolId` (`'select'` là công cụ mặc định của nó). `'measure'` là ô
 * duy nhất hai bảng cùng có, và đó là ô màn này sống trong.
 */
const MEASURE_TOOL_ID = 'measure';
const IDLE_SHELL_TOOL_ID = 'orbit';
const IDLE_MACHINE_TOOL_ID = 'select';

/** Trạng thái 4: tia trúng một bề mặt không mang pháp tuyến nào. */
const NO_SURFACE_MESSAGE =
  'Chưa bắt được bề mặt để đo vuông góc. Hãy chấm lại vào một mặt tường hoặc mặt sàn.';

/** Trạng thái 4: lượt tải danh sách hỏng. */
const LOAD_ERROR_MESSAGE =
  'Chưa tải được danh sách phép đo của dự án. Kiểm tra kết nối rồi thử lại.';

/** Trạng thái 6: có quyền xem, không có quyền ghim. */
const PIN_BLOCKED_CAPTION =
  'bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường.';

/** Câu của toast hoàn tác — cửa sổ tám giây do chính vé mang (`UNDO_WINDOW_MS`). */
const DELETE_NOTIFICATION_TYPE = 'measurementTool.deleteMeasurement';

/** Không có phép đo nào. */
const NO_ROWS: readonly PinnedMeasurement[] = Object.freeze([]);
const NO_RECORDS: readonly MeasurementRecord[] = Object.freeze([]);
const NO_PICKS: readonly MeasurePick[] = Object.freeze([]);
const NO_HIDDEN: ReadonlySet<PinnedMeasurementId> = new Set<PinnedMeasurementId>();
const NO_SCREEN_POINTS: readonly ScreenPoint[] = Object.freeze([]);

/** Chip lúc chưa có con trỏ nào trên khung nhìn — vẫn gọi tên tình trạng. */
const IDLE_SNAP: SnapIndicator = Object.freeze({ kind: null, label: NO_SNAP_LABEL });

/** Mã tầng rỗng: máy công cụ chưa dựng được gì khi đồ thị chưa tới. */
const NO_LEVEL_ID = '';

/**
 * Ngữ cảnh của máy công cụ S-08.
 *
 * `reduceTool` chỉ đọc `context` khi một bước cử chỉ được điền, và hook này chỉ
 * gửi `activate`/`cancel` — hai sự kiện không chạm tới nó. Ngữ cảnh vẫn phải có
 * thật vì kiểu đòi, nên nó là một hằng: công cụ đo có `creates: null` nên
 * `nextId` không bao giờ được gọi, và gọi nó là một lỗi lập trình chứ không
 * phải một ca người dùng.
 */
const TOOL_CONTEXT: ToolContext = {
  levelId: NO_LEVEL_ID as LevelId,
  settings: DEFAULT_TOOL_SETTINGS,
  nextId: (): never => {
    throw new Error('Màn đo không tạo thực thể nào, nên không có mã nào để cấp.');
  },
};

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn.                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseMeasurementToolOptions {
  readonly projectId: string;
  /** Cổng riêng của màn. Vắng mặt thì hook dựng cổng THẬT đi ra mạng. */
  readonly gateway?: MeasurementToolGateway;
  /** Cổng của vỏ. Vắng mặt thì hook dựng cổng THẬT đọc kho. */
  readonly shellGateway?: ViewerShellGateway;
  /** Đồ thị tiêm cho story/bài kiểm; vắng mặt thì đọc kho. */
  readonly spatial?: NormalizedSpatial | null;
  /** Vai người xem. Vắng mặt KHÔNG vào `forbidden` — "chưa biết vai" khác "không có quyền". */
  readonly roles?: readonly ProjectRole[];
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: MeasurementScreenState;
  readonly isDev?: boolean;
  readonly registry?: ShortcutRegistry;
  /** Khe `/` của vỏ; vỏ gọi nó khi người dùng bấm phím tìm. */
  readonly onOpenSearch?: () => void;
  /** Cảnh 3D để bắn tia và chiếu điểm — xem {@link MeasurementScene}. */
  readonly scene?: MeasurementScene | null;
  /** Thay lượt bắn tia, cho bài kiểm không cần WebGL. */
  readonly pick?: PickAt;
  /** Thay phép chiếu, cho bài kiểm không cần camera. */
  readonly projectToScreen?: ScreenProjector;
  /** Nơi toast hoàn tác đi tới. Vắng mặt thì bus dùng chung của ứng dụng. */
  readonly notifications?: NotificationBus;
  /** Tầng đang soát, để lọc mồi bắt điểm. Vắng mặt thì lấy mồi của cả mô hình. */
  readonly levelId?: string | null;
}

/** Câu của trạng thái 4, hoặc `null` khi không có gì hỏng. */
function errorMessageOf(surfaceFailed: boolean, loadFailed: boolean): string | null {
  if (surfaceFailed) {
    return NO_SURFACE_MESSAGE;
  }

  return loadFailed ? LOAD_ERROR_MESSAGE : null;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ container của `MeasurementTool` cần, và không gì hơn.
 *
 * @param options Dự án, hai cổng, cảnh 3D, và các chỗ tiêm cho story và bài kiểm.
 * @returns `ViewerShellProps` đủ để dựng `<ViewerShell {...props} />` bằng đúng
 * một thẻ: `renderScene` đã cắm sẵn `<MeasurementTool>`, `inspectorSections` đã
 * cắm sẵn mục "Phép đo".
 */
export function useMeasurementTool(options: UseMeasurementToolOptions): ViewerShellProps {
  /* A12: giữ listener bàn phím sống suốt lúc màn còn gắn. Sổ thuê đếm người
     giữ, nên gọi ở đây không gắn listener lần thứ hai. */
  useShortcutListener(options.registry !== undefined ? { registry: options.registry } : {});

  /* ---- Kho và cổng của vỏ ------------------------------------------------ */

  const storeSpatial = useStore((state) => state.spatial);
  const spatial = options.spatial !== undefined ? options.spatial : storeSpatial;

  const shellGateway = useMemo(
    () => options.shellGateway ?? createViewerShellGateway(() => useStore.getState().spatial),
    [options.shellGateway],
  );

  /* ---- Tầng máy chủ: một lượt đọc, hai lượt ghi (R-64) ------------------- */

  const queryClient = useQueryClient();
  const http = useMemo(() => createMeasurementHttpClient(), []);

  const saveMutation = useMutation(saveMeasurement({ http, queryClient }));
  const deleteMutation = useMutation(deleteMeasurement({ http, queryClient }));

  const notifications = options.notifications ?? appNotificationBus;

  /**
   * Vé hoàn tác thành một toast có nút "Hoàn tác" (A8).
   *
   * `NotificationHost` của `src/main.tsx` vẽ bus này và gọi thẳng
   * `ticket.undo()`. Cửa sổ tám giây do chính vé mang (`UNDO_WINDOW_MS`), nên
   * không có thời lượng nào phải truyền ở đây (R-71).
   */
  const publishUndo = useCallback(
    (ticket: UndoTicket): void => {
      notifications.publish({
        type: DELETE_NOTIFICATION_TYPE,
        title: ticket.description,
        description: '',
        undoTicket: ticket,
      });
    },
    [notifications],
  );

  /* `mutateAsync` giữ nguyên danh tính qua các lượt vẽ của react-query, nhưng
     đọc qua ref vẫn rẻ hơn là dựng lại cổng mỗi khi một lượt ghi đổi trạng
     thái — và cổng phải ổn định vì `renderScene` chạy lại mỗi khung hình. */
  const runnersRef = useRef({ save: saveMutation.mutateAsync, remove: deleteMutation.mutateAsync });
  runnersRef.current = { save: saveMutation.mutateAsync, remove: deleteMutation.mutateAsync };

  const gateway = useMemo(
    (): MeasurementToolGateway =>
      options.gateway ??
      createMeasurementToolGateway({
        http,
        queryClient,
        save: (variables) => runnersRef.current.save(variables),
        remove: (variables) => runnersRef.current.remove(variables),
        onUndoTicket: publishUndo,
      }),
    [options.gateway, http, queryClient, publishUndo],
  );

  const { projectId } = options;

  /**
   * Lượt đọc danh sách.
   *
   * Bộ nhớ đệm dưới khoá `measurementKeys.all` thuộc về `src/lib/mutations`: hai
   * lượt cập nhật lạc quan ở đó ghi `MeasurementRecord[]` vào đúng khoá này. Nên
   * `queryFn` trả về bản ghi chứ không trả hàng đã định dạng — nếu không, một
   * lượt ghim sẽ chèn một hình dạng khác vào cùng một mảng. `select` là chỗ bản
   * ghi thành hàng, và nó chạy lại khi `unit` đổi.
   */
  const rowsQuery = useQuery({
    queryKey: measurementKeys.all(projectId),
    queryFn: async (): Promise<readonly MeasurementRecord[]> =>
      (await gateway.listMeasurements(projectId)).map(toMeasurementRecord),
  });

  /* ---- Trạng thái của màn ----------------------------------------------- */

  const [mode, setMode] = useState<MeasureMode>('pointToPoint');
  const [unit, setUnit] = useState<MeasureUnit>(INITIAL_MEASURE_UNIT);
  const [unitJustChanged, setUnitJustChanged] = useState(false);
  const [picks, setPicks] = useState<readonly MeasurePick[]>(NO_PICKS);
  const [cursor, setCursor] = useState<{
    readonly point: MeasurePoint | null;
    readonly px: ScreenPoint | null;
    readonly snap: SnapIndicator;
  }>({ point: null, px: null, snap: IDLE_SNAP });
  const [hidden, setHidden] = useState<ReadonlySet<PinnedMeasurementId>>(NO_HIDDEN);
  const [highlightedId, setHighlightedId] = useState<PinnedMeasurementId | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [surfaceFailed, setSurfaceFailed] = useState(false);
  const [toolState, setToolState] = useState<ToolMachineState>(() =>
    createToolState(IDLE_MACHINE_TOOL_ID),
  );

  /* ---- Vỏ chung --------------------------------------------------------- */

  const buildPropsRef = useRef<() => MeasurementToolProps>(() => {
    throw new Error('renderScene được gọi trước khi hook dựng xong phép dựng props.');
  });

  const renderScene = useCallback(
    (): ReactNode => createElement(MeasurementTool, buildPropsRef.current()),
    [],
  );

  const shell = useViewerShell({
    projectId,
    gateway: shellGateway,
    spatial,
    renderScene,
    ...(options.roles !== undefined ? { roles: options.roles } : {}),
    ...(options.isDev !== undefined ? { isDev: options.isDev } : {}),
    ...(options.registry !== undefined ? { registry: options.registry } : {}),
    ...(options.onOpenSearch !== undefined ? { onOpenSearch: options.onOpenSearch } : {}),
  });

  /**
   * Một sự kiện của máy công cụ S-08.
   *
   * `reduceTool` thuần và không bao giờ ghi; nó là chỗ DUY NHẤT giữ pha cử chỉ
   * của màn, và hook không dựng một máy thứ hai bên cạnh nó.
   */
  const runToolEvent = useCallback((event: ToolEvent): void => {
    setToolState(
      (current) => reduceTool(current, event, { tools: TOOLS, context: TOOL_CONTEXT }).state,
    );
  }, []);

  /*
   * Ray công cụ của vỏ là MẶT của S-08, không phải một trạng thái thứ hai.
   *
   * Vỏ giữ `activeToolId` cho chrome của nó (ô nào sáng trên ray trái), còn máy
   * công cụ giữ công cụ và pha cử chỉ. Một chiều đồng bộ, từ vỏ sang máy: bấm
   * vào ô "đo" trên ray và bấm phím `M` đều đi qua `shell.onToolChange`, nên
   * không có đường nào làm hai bên lệch nhau.
   */
  useEffect(() => {
    runToolEvent({
      type: 'activate',
      tool: shell.activeToolId === MEASURE_TOOL_ID ? MEASURE_TOOL_ID : IDLE_MACHINE_TOOL_ID,
    });
  }, [shell.activeToolId, runToolEvent]);

  const isMeasuring = toolState.tool === MEASURE_TOOL_ID;

  /* ---- Bắt điểm --------------------------------------------------------- */

  const snapTargets = useMemo(
    () => snapTargetsOf(spatial, options.levelId ?? null),
    [spatial, options.levelId],
  );

  /**
   * Một điểm bắn tia, đã bắt vào mồi gần nhất.
   *
   * `snapToTargets` làm việc trên mặt bằng hai chiều, nên trục ĐỨNG giữ nguyên
   * từ điểm bắn tia: kéo cao độ của một cú chấm về đỉnh tường gần nhất sẽ đổi
   * chiều cao mà người dùng vừa đo mà không nói gì.
   */
  const snapPoint = useCallback(
    (point: MeasurePoint): { readonly point: MeasurePoint; readonly snap: SnapIndicator } => {
      const result = snapMeasurePoint(point, snapTargets);

      return {
        point: { x: result.point.x, y: result.point.y, ...(point.z !== undefined ? { z: point.z } : {}) },
        snap: snapIndicatorOf(result),
      };
    },
    [snapTargets],
  );

  /* ---- Bắn tia ---------------------------------------------------------- */

  const scene = options.scene ?? null;

  const pick = useMemo((): PickAt | null => {
    if (options.pick !== undefined) {
      return options.pick;
    }

    if (scene === null) {
      return null;
    }

    return createScenePick({
      camera: scene.camera,
      root: scene.root,
      viewport: scene.viewport,
      ...(scene.merge !== undefined ? { merge: scene.merge } : {}),
      ...(scene.layers !== undefined ? { layers: scene.layers } : {}),
    });
  }, [options.pick, scene]);

  const project = useMemo(
    (): ScreenProjector | null =>
      options.projectToScreen ?? (scene === null ? null : projectorFor(scene)),
    [options.projectToScreen, scene],
  );

  /* Con trỏ và cú chấm đọc trạng thái mới nhất qua ref: picker được dựng một
     lần cho mỗi lượt bắn tia và không được dựng lại theo từng lượt vẽ. */
  const latest = useRef({ isMeasuring, snapPoint, project });
  useEffect(() => {
    latest.current = { isMeasuring, snapPoint, project };
  });

  const picker = useMemo(() => {
    if (pick === null) {
      return null;
    }

    return createPointerPicker({
      pick,
      onEvent: (event) => {
        if (!latest.current.isMeasuring) {
          return;
        }

        const hit = event.hit;

        if (hit === null) {
          setCursor((current) => ({ ...current, point: null, px: event.pointer, snap: IDLE_SNAP }));

          return;
        }

        const snapped = latest.current.snapPoint(toMeasurePoint(hit.point));

        if (event.type === 'hover') {
          setCursor({ point: snapped.point, px: event.pointer, snap: snapped.snap });

          return;
        }

        setSurfaceFailed(false);
        setPicks((current) => [...current, { point: snapped.point, normal: hit.normal }]);
      },
    });
  }, [pick]);

  useEffect(() => (): void => picker?.dispose(), [picker]);

  /* ---- Con trỏ của vỏ, bọc thêm một lượt cho picker ---------------------- */

  const lastPointerRef = useRef<ViewerPointPx>({ x: 0, y: 0 });

  const onViewportPointerMove = useCallback(
    (point: ViewerPointPx, buttons: number): void => {
      lastPointerRef.current = point;
      shell.onViewportPointerMove(point, buttons);
      picker?.pointerMove(point);
    },
    [shell, picker],
  );

  const onViewportPointerDown = useCallback(
    (point: ViewerPointPx): void => {
      lastPointerRef.current = point;
      shell.onViewportPointerDown(point);
      picker?.pointerDown(point);
    },
    [shell, picker],
  );

  const onViewportPointerUp = useCallback((): void => {
    shell.onViewportPointerUp();
    picker?.pointerUp(lastPointerRef.current);
  }, [shell, picker]);

  /* ---- Phép đo đang dở --------------------------------------------------- */

  const livePicks = useMemo((): readonly MeasurePick[] => {
    if (cursor.point === null || picks.length >= REQUIRED_POINTS[mode]) {
      return picks;
    }

    return [...picks, { point: cursor.point, normal: null }];
  }, [picks, cursor.point, mode]);

  const attempt = useMemo(() => attemptMeasure(mode, picks), [mode, picks]);
  const liveAttempt = useMemo(() => attemptMeasure(mode, livePicks), [mode, livePicks]);

  useEffect(() => {
    if (attempt.kind === 'noSurface') {
      setSurfaceFailed(true);
    }
  }, [attempt]);

  const draftRow = useMemo((): PinnedMeasurement | null => {
    if (attempt.kind !== 'measured') {
      return null;
    }

    const identity = nextMeasurementIdentity(rowsQuery.data ?? NO_RECORDS);

    return formatMeasurementRow(
      {
        ...identity,
        mode,
        rawValueMm: rawValueOf(attempt.measurement),
        points: attempt.measurement.points,
        visible: true,
        stale: false,
        staleReason: null,
      },
      unit,
    );
  }, [attempt, mode, unit, rowsQuery.data]);

  const draft = useMemo((): DraftMeasurement | null => {
    if (picks.length === 0) {
      return null;
    }

    const points = livePicks.map((entry) => entry.point);
    const label =
      liveAttempt.kind === 'measured'
        ? formatMeasurementRow(
            {
              id: 'MS-draft',
              name: '',
              mode,
              rawValueMm: rawValueOf(liveAttempt.measurement),
              points: liveAttempt.measurement.points,
              visible: true,
              stale: false,
              staleReason: null,
            },
            unit,
          ).valueLabel
        : null;

    return {
      mode,
      points,
      valueLabel: label,
      screenPoints: projectAll(points, project) ?? NO_SCREEN_POINTS,
      cursorPx: cursor.px,
      snap: cursor.snap,
    };
  }, [picks.length, livePicks, liveAttempt, mode, unit, project, cursor.px, cursor.snap]);

  /* ---- Danh sách đã ghim ------------------------------------------------- */

  const rows = useMemo((): readonly PinnedMeasurement[] => {
    const records = rowsQuery.data;

    if (records === undefined || records.length === 0) {
      return NO_ROWS;
    }

    return records.map((record) => {
      const row = formatMeasurementRow(toMeasurementRowCore(record), unit);

      return {
        ...row,
        visible: !hidden.has(row.id),
        screenPoints: projectAll(row.points, project),
      };
    });
  }, [rowsQuery.data, unit, hidden, project]);

  /* ---- Hành động --------------------------------------------------------- */

  const clearDraft = useCallback((): void => {
    setPicks(NO_PICKS);
    setSurfaceFailed(false);
    setCursor((current) => ({ ...current, point: null }));
  }, []);

  const onEscape = useCallback((): void => {
    runToolEvent({ type: 'cancel' });
    clearDraft();
  }, [runToolEvent, clearDraft]);

  const onToggleTool = useCallback((): void => {
    shell.onToolChange(isMeasuring ? IDLE_SHELL_TOOL_ID : MEASURE_TOOL_ID);
    clearDraft();
  }, [shell, isMeasuring, clearDraft]);

  const canPin = shell.state !== 'forbidden';

  const onPin = useCallback((): void => {
    if (!canPin || draftRow === null) {
      return;
    }

    void gateway.saveMeasurement(projectId, draftRow);
    clearDraft();
  }, [canPin, draftRow, gateway, projectId, clearDraft]);

  const onDelete = useCallback(
    (id: PinnedMeasurementId): void => {
      setHighlightedId((current) => (current === id ? null : current));
      void gateway.deleteMeasurement(projectId, id);
    },
    [gateway, projectId],
  );

  const onToggleVisibility = useCallback((id: PinnedMeasurementId): void => {
    setHidden((current) => {
      const next = new Set(current);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });
  }, []);

  const onUnitChange = useCallback((next: MeasureUnit): void => {
    setUnit(next);
    setUnitJustChanged(true);
  }, []);

  /**
   * Nhãn chạy số đúng MỘT nhịp sau khi đổi đơn vị.
   *
   * `standard` (260 ms) là chỗ đặc tả nói "240 ms"; 240 không có trong
   * `MOTION_DURATIONS_MS` và R-71 cấm viết một con số thứ năm.
   */
  useEffect(() => {
    if (!unitJustChanged) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setUnitJustChanged(false);
    }, MOTION_DURATIONS_MS.standard);

    return (): void => {
      clearTimeout(timer);
    };
  }, [unitJustChanged]);

  const onRetry = useCallback((): void => {
    setSurfaceFailed(false);
    void rowsQuery.refetch();
  }, [rowsQuery]);

  /* ---- Phím tắt (A12, R-54, R-72) ---------------------------------------- */

  const registryOption = options.registry !== undefined ? { registry: options.registry } : {};

  useShortcut(
    {
      id: TOGGLE_ID,
      combo: TOGGLE_COMBO,
      scope: 'canvas',
      description: TOGGLE_DESCRIPTION,
      onTrigger: onToggleTool,
    },
    registryOption,
  );

  useShortcut(
    {
      id: ESCAPE_ID,
      combo: ESCAPE_COMBO,
      scope: 'canvas',
      // Không chặn hành vi Escape của trình duyệt (thoát toàn màn hình), đúng
      // như binding Escape của vỏ.
      preventDefault: false,
      description: ESCAPE_DESCRIPTION,
      onTrigger: onEscape,
    },
    registryOption,
  );

  useShortcut(
    { id: PIN_ID, combo: PIN_COMBO, scope: 'canvas', description: PIN_DESCRIPTION, onTrigger: onPin },
    registryOption,
  );

  useShortcut(
    {
      id: DELETE_ID,
      combo: DELETE_COMBO,
      scope: 'canvas',
      description: DELETE_DESCRIPTION,
      onTrigger: (): void => {
        if (highlightedId !== null) {
          onDelete(highlightedId);
        }
      },
    },
    registryOption,
  );

  /* ---- Bảy trạng thái (A11, R-63) ---------------------------------------- */

  const state = useMemo((): MeasurementScreenState => {
    if (options.forceState !== undefined) {
      return options.forceState;
    }
    if (surfaceFailed || rowsQuery.isError) {
      return 'error';
    }
    if (collapsed) {
      return 'collapsed';
    }
    if (shell.state === 'forbidden') {
      return 'forbidden';
    }
    if (picks.length > 0) {
      // Đủ điểm mà chưa ghim là chuỗi đo CHƯA ĐÓNG; một điểm là đang đo.
      return picks.length >= REQUIRED_POINTS[mode] ? 'partial' : 'measuring';
    }
    if (rows.length === 0) {
      return 'empty';
    }

    return 'ready';
  }, [
    options.forceState,
    surfaceFailed,
    rowsQuery.isError,
    collapsed,
    shell.state,
    picks.length,
    mode,
    rows.length,
  ]);

  const errorMessage = errorMessageOf(surfaceFailed, rowsQuery.isError);

  /* ---- Props của view, chốt lại mỗi lượt vẽ ------------------------------ */

  const toolProps = useMemo(
    (): MeasurementToolProps => ({
      state,
      mode,
      onModeChange: (next: MeasureMode): void => {
        setMode(next);
        clearDraft();
      },
      snap: cursor.snap,
      draft,
      measurements: rows,
      countLabel: measurementCountLabel(rows.length),
      highlightedId,
      onHighlight: setHighlightedId,
      onToggleVisibility,
      onDelete,
      onToggleTool,
      onEscape,
      onPin,
      unit,
      onUnitChange,
      unitJustChanged,
      canPin,
      pinBlockedCaption: canPin ? null : PIN_BLOCKED_CAPTION,
      collapsed,
      onToggleCollapsed: (): void => {
        setCollapsed((current) => !current);
      },
      errorMessage,
      onRetry,
    }),
    [
      state,
      mode,
      cursor.snap,
      draft,
      rows,
      highlightedId,
      onToggleVisibility,
      onDelete,
      onToggleTool,
      onEscape,
      onPin,
      unit,
      onUnitChange,
      unitJustChanged,
      canPin,
      collapsed,
      errorMessage,
      onRetry,
      clearDraft,
    ],
  );

  buildPropsRef.current = (): MeasurementToolProps => toolProps;

  /* ---- `ViewerShellProps` đầy đủ ----------------------------------------- */

  return {
    ...shell,
    state: VIEWER_STATE_BY_MEASUREMENT[state],
    onViewportPointerMove,
    onViewportPointerDown,
    onViewportPointerUp,
    inspectorSections: createElement(MeasurementList, {
      measurements: toolProps.measurements,
      countLabel: toolProps.countLabel,
      highlightedId: toolProps.highlightedId,
      onHighlight: toolProps.onHighlight,
      onToggleVisibility: toolProps.onToggleVisibility,
      onDelete: toolProps.onDelete,
      unit: toolProps.unit,
      onUnitChange: toolProps.onUnitChange,
      canPin: toolProps.canPin,
      pinBlockedCaption: toolProps.pinBlockedCaption,
      collapsed: toolProps.collapsed,
      onToggleCollapsed: toolProps.onToggleCollapsed,
    }),
  };
}
