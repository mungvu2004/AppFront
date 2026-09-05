/**
 * Hook của màn `Viewer3D`: nối lại logic đã có, không phát minh thêm cái nào.
 *
 * Mỗi việc dưới đây đã có chủ ở tầng logic, và hook chỉ đưa dữ liệu đi qua đúng
 * chủ của nó:
 *
 * | Việc | Ai làm |
 * |---|---|
 * | Đồ thị → đầu vào của R-01 | `toBuildFloorInput` (`@/domain/spatial`) |
 * | Ba con số thanh trạng thái, tầng | `shellDataOf` / `storeysOf` của vỏ |
 * | Chọn (S-10) | `selectSingle` / `toggleSelection` / `clearSelection` |
 * | Tô màu (P-06) | `createColoringMode` |
 * | Chú giải (P-07) | `generateLegend` |
 * | Quyền | `can('edit', 'layer', …)` |
 * | Đường dẫn | `ROUTES.project.*` |
 * | fps trung bình (O-01) | `PerfMonitor` đo, `scene.frame-rate` ghi |
 * | khuôn camera vào phòng vừa tìm (R-07) | `CameraDirector.frameObjects`, qua `ViewerSceneHandle.frameEntities` |
 *
 * ## `loading` và `error` không phải `useState`
 *
 * R-64: hai trạng thái ấy đến từ `useQuery` với khoá của `src/lib/query`, không
 * phải từ hai biến hook tự giữ. Ba `useState` còn lại trong file này KHÔNG phải
 * trạng thái truy vấn: chúng là tiến độ của một worker dựng hình (không có
 * lượt HTTP nào phía sau để `useQuery` theo dõi), việc máy có WebGL hay không,
 * và số lần người dùng bấm "thử lại".
 *
 * ## Cổng mặc định là cổng THẬT
 *
 * `useViewerShell` mặc định dùng cổng GIẢ (`data-gateway-contract.md` mục B,
 * cạm bẫy 4) — chạy được, không báo lỗi, và hiện đúng bộ mẫu 4 tầng dù dự án
 * là dự án khác. Hook này mặc định ngược lại: cổng thật đọc kho, và bản giả chỉ
 * vào được bằng cách truyền tường minh.
 *
 * ## Kho đọc một lần
 *
 * `state.spatial` được đọc ở đây và chỉ ở đây; giá trị ấy đi vào cả phép chuyển
 * `BuildFloorInput` lẫn `shellDataOf`. Không có nhánh nào tự `useStore` lần hai
 * (khuyến nghị cuối mục B của `data-gateway-contract.md`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { ENDPOINTS } from '@/api/endpoints';
import { isEntityOfKind, resolveLevelId, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import { isValidId } from '@/domain/spatial/ids';
import type { EntityId, LevelId, Room } from '@/domain/spatial/types';
import { can } from '@/lib/auth/permissions';
import { generateLegend } from '@/lib/coloring/legend';
import { createColoringMode, type ColoringMode, type PaintSubject } from '@/lib/coloring/modes';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { formatArea } from '@/lib/format/measure';
import { formatPercent } from '@/lib/format/number';
import { createUuid } from '@/lib/http/ids';
import { queryKeys } from '@/lib/query/queryKeys';
import {
  clearSelection,
  selectSingle,
  toggleSelection,
  type Selection,
  type SelectionContext,
} from '@/lib/selection/selectionOps';
import { createBeaconTransport, createTelemetrySender } from '@/lib/telemetry/sender';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { BuildPartKind } from '@/lib/three/build/scene';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import {
  createViewerShellGateway,
  shellDataOf,
  type ViewerShellData,
} from '@/screens/viewer/ViewerShell';
import type {
  ViewerSceneActions,
  ViewerScreenState,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { mountViewerScene } from './viewer3dScene';
import type { ViewerRoomOption } from './roomSearch';
import type {
  UseViewer3DOptions,
  Viewer3DModel,
  Viewer3DTelemetry,
  ViewerSceneHandle,
  ViewerSceneStatus,
} from './viewer3dTypes';

/* -------------------------------------------------------------------------- */
/* Hằng số.                                                                    */
/* -------------------------------------------------------------------------- */

/** Câu dưới một tầng chưa dựng xong. Khoá `viewer3d.partial.wireframeCaption`. */
const WIREFRAME_CAPTION_SUFFIX = ' — chưa dựng xong';

/** Tên dự phòng khi đồ thị chưa mang tên tầng nào. */
const UNNAMED_STOREY = 'Tầng';

/** Chưa dựng gì cả. */
const IDLE_STATUS: ViewerSceneStatus = {
  phase: 'idle',
  progress: { settledCount: 0, totalCount: 0, failedCount: 0, readyLevelIds: [] },
};

const EMPTY_LEVELS: readonly BuildFloorInput[] = [];
const EMPTY_SUBJECTS: readonly PaintSubject[] = [];
const EMPTY_ROOMS: readonly ViewerRoomOption[] = [];

/** Tiền tố mã của một phòng — cùng quy ước `representativeOf` đọc. */
const ROOM_ID_PREFIX = 'R-';

/* -------------------------------------------------------------------------- */
/* Phép đọc thuần trên đồ thị.                                                 */
/* -------------------------------------------------------------------------- */

/** `EntityId` từ một chuỗi cảnh 3D báo lên, hoặc `null` nếu không phải id hợp lệ. */
function toEntityId(value: string): EntityId | null {
  return isValidId(value) ? (value as EntityId) : null;
}

/**
 * Mọi vật có thể tô, dạng phẳng mà `src/lib/coloring` đọc.
 *
 * Tường, phòng và ô mở — đúng ba loại `buildFloorMesh` dựng ra hình. `worstSeverity`
 * luôn `null`: mức vi phạm đến từ một lượt chạy luật mà màn chỉ-xem này không
 * chạy, và đoán một mức là tô sai màu cho một bức tường không có lỗi nào.
 */
function paintSubjectsOf(spatial: NormalizedSpatial | null): readonly PaintSubject[] {
  if (spatial === null) {
    return EMPTY_SUBJECTS;
  }

  const subjects: PaintSubject[] = [];

  for (const kind of ['wall', 'room', 'opening'] as const) {
    for (const id of spatial.byKind[kind]) {
      const entity = spatial.byId[id];

      if (entity === undefined) {
        continue;
      }

      const isRoom = isEntityOfKind('room', entity);

      subjects.push({
        id: entity.id,
        levelId: resolveLevelId(entity, spatial.byId),
        review: {
          confidence: entity.confidence,
          source: entity.source,
          reviewed: entity.reviewed,
        },
        usage: isRoom ? entity.usage : null,
        areaM2: isRoom ? entity.areaM2 : null,
        worstSeverity: null,
      });
    }
  }

  return subjects;
}

/**
 * Vật đại diện cho mỗi loại bộ phận, để lấy token màu của cả loại.
 *
 * `paintByPartKind` cấp MỘT vật liệu cho mỗi `BuildPartKind` — bốn mươi tám bức
 * tường dùng chung một vật liệu, đó là cả điểm của nó. Nên câu hỏi ở đây không
 * phải "tường này màu gì" mà "loại tường màu gì", và câu trả lời là màu mà chế
 * độ P-06 tô cho một vật thuộc loại ấy trong view hiện tại.
 */
function representativeOf(
  kind: BuildPartKind,
  subjects: readonly PaintSubject[],
): PaintSubject | undefined {
  const prefix = kind === 'wall' ? 'W-' : kind === 'opening' ? 'D-' : 'R-';

  if (kind === 'level' || kind === 'furniture') {
    return undefined;
  }

  return subjects.find((subject) => subject.id.startsWith(prefix));
}

/** Tầng nào đang là tầng "đang xem" khi vật được chọn không nói được tầng nào. */
function activeLevelOf(
  visibleStoreyIds: readonly string[],
  data: ViewerShellData,
): LevelId | null {
  const first = visibleStoreyIds[0] ?? data.storeys[0]?.id ?? null;

  return first === null ? null : (first as LevelId);
}

/** Mọi thứ một lượt chọn cần đọc, chụp lại ở mỗi lần vẽ. */
interface SelectionSource {
  readonly selection: Selection;
  readonly spatial: NormalizedSpatial | null;
  readonly visibleStoreyIds: readonly string[];
  readonly fallbackLevelId: LevelId | null;
}

/**
 * `SelectionContext` của S-10 cho MỘT lượt chọn.
 *
 * `isSelectable` từ chối mọi thứ không nằm trên "tầng đang xem", và trong một
 * màn 2D thì tầng ấy có đúng một nghĩa. Ở khung nhìn 3D thì không: **mọi tầng
 * đang hiện đều nằm trên màn cùng lúc**, xếp chồng lên nhau. Lấy
 * `visibleStoreyIds[0]` làm tầng đang xem — như trước — nghĩa là bấm vào một
 * phòng tầng 3 đang hiện rành rành cũng không chọn được nó, vì tầng trệt mới là
 * tầng đầu danh sách.
 *
 * Nên tầng đang xem của một lượt chọn là tầng CỦA CHÍNH VẬT ẤY, miễn là tầng đó
 * đang hiện. Tầng người dùng đã ẩn vẫn không chọn được — đúng ý ban đầu của
 * `isSelectable`, và đó là phần luật này KHÔNG nới.
 */
function selectionContextOf(
  source: SelectionSource,
  id: EntityId | null,
): SelectionContext | null {
  const { spatial } = source;

  if (spatial === null) {
    return null;
  }

  const entity = id === null ? undefined : spatial.byId[id];
  const ownLevelId = entity === undefined ? null : resolveLevelId(entity, spatial.byId);
  const activeLevelId =
    ownLevelId !== null && source.visibleStoreyIds.includes(ownLevelId)
      ? ownLevelId
      : source.fallbackLevelId;

  return activeLevelId === null ? null : { spatial, activeLevelId, layers: {} };
}

/**
 * Mọi phòng của đồ thị, rút gọn về đúng những gì ô tìm vẽ ra.
 *
 * Đọc theo HÌNH DẠNG (`'name' in entity`), **không** qua `isEntityOfKind` — và
 * đó không phải một lối tắt. `isEntityOfKind` hỏi `isValidId`, thứ đòi phần
 * thân của mã dài ít nhất mười ký tự (`domain/spatial/ids.ts:40-43`); bộ mẫu
 * của vỏ đánh mã `R-001`, thân dài ba. Nên với bộ mẫu ấy `isEntityOfKind('room', …)`
 * trả `false` cho **cả mười bốn phòng**, và một danh sách phòng rỗng là thứ
 * người dùng nhìn thấy.
 *
 * `shellDataOf` và `storeysOf` của vỏ đã đọc theo hình dạng đúng vì lý do này;
 * file này theo chúng thay vì dựng một danh sách rỗng rồi gọi đó là "không có
 * phòng nào".
 */
function roomOptionsOf(
  spatial: NormalizedSpatial | null,
  storeys: ViewerShellData['storeys'],
): readonly ViewerRoomOption[] {
  if (spatial === null) {
    return EMPTY_ROOMS;
  }

  const storeyNameById = new Map(storeys.map((storey) => [String(storey.id), storey.name]));
  const options: ViewerRoomOption[] = [];

  for (const id of spatial.byKind.room) {
    const entity = spatial.byId[id];

    if (entity === undefined || !('name' in entity) || !('areaM2' in entity)) {
      continue;
    }

    const room = entity as Room;

    options.push({
      id: room.id,
      name: room.name,
      storeyName: storeyNameById.get(room.levelId) ?? UNNAMED_STOREY,
      // A15: định dạng xảy ra ở viewmodel, không ở view — cùng `formatArea` mà
      // panel thanh tra của vỏ dùng, nên hai chỗ không in ra hai con số khác.
      areaLabel: formatArea(room.areaM2),
    });
  }

  return options;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ `Viewer3D.tsx` cần, và không gì hơn.
 *
 * @param options Dự án, canvas để vẽ, khung của vỏ, và các chỗ tiêm.
 * @returns Đúng {@link Viewer3DModel} — {@link Viewer3DProps} của
 * `shell-props-contract.md` mục D trừ hai trường hook không cấp được
 * (`canvasRef` và phần đóng/mở của ô tìm); container ghép chúng vào.
 */
export function useViewer3D(options: UseViewer3DOptions): Viewer3DModel {
  const { canvas, frame, projectId } = options;

  /* ---- Kho: đọc một lần ------------------------------------------------- */

  const storeSpatial = useStore((state) => state.spatial);
  const selectedIds = useStore((state) => state.selectedIds);
  const setSelection = useStore((state) => state.setSelection);
  const setHovered = useStore((state) => state.setHovered);

  const spatial = options.spatial !== undefined ? options.spatial : storeSpatial;

  /* ---- Truy vấn: nguồn DUY NHẤT của loading và error (R-64) -------------- */

  const gateway = useMemo(
    () => options.gateway ?? createViewerShellGateway(() => useStore.getState().spatial),
    [options.gateway],
  );

  const projectQuery = useQuery({
    queryKey: queryKeys.project.detail(projectId),
    queryFn: (): Promise<string | null> => gateway.readProjectName(projectId),
  });

  const data = useMemo(() => shellDataOf(spatial), [spatial]);

  /* ---- Đồ thị → đầu vào của R-01 ---------------------------------------- */

  const [buildAttempt, setBuildAttempt] = useState(0);

  const conversion = useMemo((): { levels: readonly BuildFloorInput[]; failed: boolean } => {
    if (spatial === null) {
      return { levels: EMPTY_LEVELS, failed: false };
    }

    try {
      const levels: BuildFloorInput[] = [];

      for (const storey of data.storeys) {
        const input = toBuildFloorInput(spatial, storey.id);

        if (input !== null) {
          levels.push(input);
        }
      }

      return { levels, failed: false };
    } catch {
      // `toBuildFloorInput` ném khi đồ thị hỏng chỉ mục hoặc mang số đo không
      // hữu hạn. Đó là một mô hình không dựng được, không phải một sự cố kỹ
      // thuật để hiện mã lỗi: nó thành trạng thái `error` với nút thử lại.
      return { levels: EMPTY_LEVELS, failed: true };
    }
  }, [spatial, data.storeys]);

  /* ---- Tô màu P-06 và chú giải P-07 ------------------------------------- */

  const subjects = useMemo(() => paintSubjectsOf(spatial), [spatial]);

  const coloring = useMemo((): { mode: ColoringMode; unpaintedToken: ColorTokenName } => {
    const mode = createColoringMode(options.coloringModeId ?? 'default', {
      subjects,
      levelIds: data.storeys.map((storey) => storey.id),
    });

    // Chú giải dựng ở đây, không ở cảnh: nó là câu trả lời cho "bậc nào ứng với
    // màu nào trên view NÀY", và bậc của `area`/`aiConfidence` bị đóng băng
    // theo đúng tập `subjects` truyền vào (cạm bẫy 9 của T3). Cảnh chỉ nhận
    // token đã chốt, nên hai bên không thể tô theo hai lượt cắt quantile khác
    // nhau. `unpaintedToken` là màu của loại bộ phận không có vật nào trong
    // view — cố ý nằm ngoài dải liên tục, để "không có trị số" không bị đọc
    // thành "trị số nhỏ nhất".
    const legend = generateLegend(mode, subjects);

    return { mode, unpaintedToken: legend.unpaintedToken };
  }, [options.coloringModeId, subjects, data.storeys]);

  const tokenOfPartKind = useCallback(
    (kind: BuildPartKind): ColorTokenName => {
      const subject = representativeOf(kind, subjects);

      return subject === undefined ? coloring.unpaintedToken : coloring.mode.paint(subject);
    },
    [coloring, subjects],
  );

  /* ---- Quyền ------------------------------------------------------------ */

  const roles = options.roles;
  const canEdit = useMemo(
    () => can('edit', 'layer', roles === undefined ? {} : { roles }),
    [roles],
  );

  /* ---- Chọn: S-10 tính, S-11 đi cả hai chiều ---------------------------- */

  const selectionRef = useRef<SelectionSource>({
    selection: selectedIds,
    spatial,
    visibleStoreyIds: frame.visibleStoreyIds,
    fallbackLevelId: null,
  });

  selectionRef.current = {
    selection: selectedIds,
    spatial,
    visibleStoreyIds: frame.visibleStoreyIds,
    fallbackLevelId: activeLevelOf(frame.visibleStoreyIds, data),
  };

  const shellActions = options.sceneActions;

  const sceneActions = useMemo<ViewerSceneActions>(
    () => ({
      selectEntity: (entityId, additive) => {
        const source = selectionRef.current;

        if (entityId === null) {
          setSelection(clearSelection(source.selection));
        } else {
          // `toEntityId` trả `null` khi mã KHÔNG hợp lệ với `src/domain` — thân
          // mã ngắn hơn mười ký tự, đúng những mã mà bộ mẫu của vỏ đánh
          // (`R-001`). Đó KHÔNG phải "bỏ chọn": coi nó là bỏ chọn thì mỗi lần
          // chọn một phòng của bộ mẫu lại xoá sạch lựa chọn đang có. Đại số
          // S-10 chỉ chạy khi mã đọc được, và phần ghi kho của vỏ ở dưới vẫn
          // chạy trong cả hai trường hợp.
          const id = toEntityId(entityId);
          const context = id === null ? null : selectionContextOf(source, id);

          if (id !== null && context !== null) {
            // Đại số chọn của S-10, không phải phép hợp/hiệu viết tay ở đây.
            setSelection(
              additive
                ? toggleSelection(source.selection, id, context)
                : selectSingle(source.selection, id, context),
            );
          }
        }

        // Chiều "3D → panel" của S-11: vỏ cuộn hàng tương ứng vào tầm nhìn.
        shellActions?.selectEntity(entityId, additive);
      },
      hoverEntity: (entityId) => {
        setHovered(entityId === null ? null : toEntityId(entityId));
        shellActions?.hoverEntity(entityId);
      },
      ...(shellActions?.setSectionPosition !== undefined
        ? { setSectionPosition: shellActions.setSectionPosition.bind(shellActions) }
        : {}),
    }),
    [setSelection, setHovered, shellActions],
  );

  /* ---- Telemetry O-01 --------------------------------------------------- */

  const [fallbackTelemetry] = useState((): Viewer3DTelemetry => {
    const sender = createTelemetrySender({
      transport: createBeaconTransport({ url: ENDPOINTS.telemetry }),
      sessionId: createUuid(),
    });

    return { track: sender.track, flushOnClose: sender.flushOnClose };
  });

  const telemetry = options.telemetry ?? fallbackTelemetry;

  /* ---- Vòng đời cảnh ---------------------------------------------------- */

  const [sceneStatus, setSceneStatus] = useState<ViewerSceneStatus>(IDLE_STATUS);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const handleRef = useRef<ViewerSceneHandle | null>(null);
  const latest = useRef({ frame, sceneActions, tokenOfPartKind, canEdit, telemetry });

  useEffect(() => {
    latest.current = { frame, sceneActions, tokenOfPartKind, canEdit, telemetry };
  });

  const levels = conversion.levels;
  const mountScene = options.mountScene ?? mountViewerScene;

  useEffect(() => {
    if (canvas === null || levels.length === 0) {
      return;
    }

    const current = latest.current;
    const mount = mountScene(canvas, {
      levels,
      frame: current.frame,
      actions: current.sceneActions,
      tokenOfPartKind: (kind: BuildPartKind) => latest.current.tokenOfPartKind(kind),
      canSelect: current.canEdit,
      onStatusChange: setSceneStatus,
    });

    if (!mount.ok) {
      setWebglUnavailable(true);
      return;
    }

    setWebglUnavailable(false);
    handleRef.current = mount.handle;

    return () => {
      // O-01: MỘT sự kiện lúc rời màn, không phải một dòng số theo chu kỳ.
      const reading = mount.handle.frameRate();

      if (reading.durationMs > 0) {
        latest.current.telemetry.track({ name: 'scene.frame-rate', ...reading });
        latest.current.telemetry.flushOnClose();
      }

      mount.handle.dispose();
      handleRef.current = null;
      setSceneStatus(IDLE_STATUS);
    };
  }, [canvas, levels, mountScene, buildAttempt]);

  useEffect(() => {
    handleRef.current?.update(frame);
  }, [frame]);

  /* ---- Viewmodel -------------------------------------------------------- */

  const buildProgressLabel = useMemo((): string | null => {
    const { phase, progress } = sceneStatus;

    if (phase !== 'building' || progress.totalCount === 0) {
      return null;
    }

    return formatPercent(progress.settledCount / progress.totalCount, { fractionDigits: 0 });
  }, [sceneStatus]);

  const readyStoreyIds = sceneStatus.progress.readyLevelIds;

  const wireframeCaptionOf = useCallback(
    (storeyId: string): string => {
      const storey = data.storeys.find((candidate) => candidate.id === storeyId);

      return `${storey?.name ?? UNNAMED_STOREY}${WIREFRAME_CAPTION_SUFFIX}`;
    },
    [data.storeys],
  );

  const buildFailed = conversion.failed || sceneStatus.phase === 'failed';

  const state = useMemo((): ViewerScreenState => {
    if (options.forceState !== undefined) {
      return options.forceState;
    }
    if (webglUnavailable || buildFailed || projectQuery.isError) {
      return 'error';
    }
    // Vắng `roles` là "chưa biết vai", không phải "biết là không có quyền" —
    // hai thứ A11 phân biệt rõ (data-gateway mục D).
    if (!canEdit && roles !== undefined) {
      return 'forbidden';
    }
    if (projectQuery.isLoading || sceneStatus.phase === 'building') {
      return 'loading';
    }
    if (data.storeys.length === 0) {
      return 'empty';
    }
    if (data.isPartial || readyStoreyIds.length < data.storeys.length) {
      return 'partial';
    }
    return 'success';
  }, [
    options.forceState,
    webglUnavailable,
    buildFailed,
    projectQuery.isError,
    projectQuery.isLoading,
    canEdit,
    roles,
    sceneStatus.phase,
    data,
    readyStoreyIds.length,
  ]);

  const onRetryBuild = useCallback(() => {
    setWebglUnavailable(false);
    setBuildAttempt((attempt) => attempt + 1);
  }, []);

  /* ---- Ô tìm đối tượng --------------------------------------------------- */

  const rooms = useMemo(() => roomOptionsOf(spatial, data.storeys), [spatial, data.storeys]);

  const selectedRoomId = useMemo(
    () => selectedIds.find((id) => id.startsWith(ROOM_ID_PREFIX)) ?? null,
    [selectedIds],
  );

  /**
   * Chọn một phòng từ ô tìm.
   *
   * Hai việc, đúng thứ tự, và cả hai đều đi qua chủ cũ của chúng:
   *
   * 1. **Chọn thật** — cùng `sceneActions.selectEntity` mà cú bấm chuột trong
   *    cảnh 3D gọi, nên đại số S-10 và chiều "3D → panel" của S-11 chỉ có một
   *    đường dây, không phải hai.
   * 2. **Khuôn camera** — `frameEntities` của cảnh, tức
   *    `CameraDirector.frameObjects` của R-07 chạy trên chính cây lưới đã dựng.
   *
   * Việc 2 im lặng không làm gì khi cảnh chưa dựng xong tầng ấy, hoặc khi máy
   * không có WebGL: phòng vẫn được CHỌN và panel phải vẫn nói ra tên nó, nên
   * việc "tìm được một phòng" không phụ thuộc vào việc camera bay tới nơi.
   */
  const onSelectRoom = useCallback(
    (roomId: string): void => {
      sceneActions.selectEntity(roomId, false);
      handleRef.current?.frameEntities([roomId]);
    },
    [sceneActions],
  );

  const firstStoreyId = data.storeys[0]?.id;

  return {
    state,
    frame,
    sceneActions,
    buildProgressLabel,
    readyStoreyIds,
    wireframeCaptionOf,
    webglUnavailable,
    // Bản 2D của cùng dự án là danh sách tầng — luôn hợp lệ, kể cả khi đồ thị
    // chưa có tầng nào để đặt tên vào đường dẫn.
    fallback2dHref: ROUTES.project.floors(projectId),
    qcHref:
      firstStoreyId === undefined
        ? ROUTES.project.floors(projectId)
        : ROUTES.project.walls(projectId, firstStoreyId),
    onRetryBuild,
    search: { rooms, selectedRoomId, onSelectRoom },
    // `canEdit` KHÔNG nằm trong Viewer3DProps (N2): view đã gỡ nút "sửa hình
    // học" nên không đọc trường này; nó chỉ còn dùng nội bộ ở trên
    // (canSelect cho mountViewerScene, và nhánh forbidden của state).
  };
}
